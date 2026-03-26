// Vision Analyzer Agent - Extracts object structure from sketch image
import { getLLMClient, getModelName, withRetry, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { SYSTEM_PROMPT } from '@/backend/ai/prompts';
import { z } from 'zod';

export interface VisionAnalysis {
    objectType: 'enclosure' | 'organic' | 'mechanical' | 'abstract' | 'mixed';
    objectName: string;
    structuralBlueprint: string;
    productCategory?: 'consumer-electronics' | 'toy' | 'tool' | 'appliance' | 'medical' | 'other';
    expectedInternals?: string[]; // e.g. ['pcb', 'battery', 'ic', 'connector', 'sensor']
    mainParts: Array<{
        name: string;
        shape: 'box' | 'cylinder' | 'sphere' | 'capsule' | 'rounded-box' | 'cone' | 'torus' | 'plane' | 'half-sphere';
        relativeSize: 'large' | 'medium' | 'small' | 'tiny';
        color?: string;
    }>;
    suggestedColors: string[];
    overallDimensions: { width: number; height: number; depth: number };
    confidence: number;
}

const visionResponseSchema = z.object({
    objectType: z.enum(['enclosure', 'organic', 'mechanical', 'abstract', 'mixed']).catch('mixed'),
    objectName: z.string().catch('Unknown Object'),
    structuralBlueprint: z.string().optional().default('A generic object composed of basic shapes.'),
    mainParts: z.array(z.object({
        name: z.string(),
        shape: z.string(),
        relativeSize: z.string(),
        color: z.string().optional(),
    })).optional().default([]),
    suggestedColors: z.array(z.string()).optional().default(['#808080']),
    overallDimensions: z.object({
        width: z.number(),
        height: z.number(),
        depth: z.number(),
    }).optional().default({ width: 50, height: 50, depth: 50 }),
    confidence: z.number().optional().default(0.5),
});

const VISION_ANALYSIS_PROMPT = `Analyze this sketch/image and create a UNIVERSAL STRUCTURAL BLUEPRINT for 3D modeling.

YOUR GOAL: Deconstruct the object into simple geometric primitives so a blind modeler could recreate it — including INTERNAL components that would be visible in an exploded view.

1. What type of object is this? (enclosure, organic, mechanical, abstract, mixed)

2. What PRODUCT CATEGORY? (consumer-electronics, toy, tool, appliance, medical, other)

3. STRUCTURAL BLUEPRINT (Critical for Universal Generation):
   Describe the object's anatomy step-by-step:
   - "SHELL": What is the outer enclosure? (e.g. "A rounded rectangular plastic housing")
   - "INTERNALS": What is inside? (e.g. "A PCB with chips, a battery compartment, a speaker")
   - "ATTACHMENTS": External features? (e.g. "USB-C port on back, two buttons on top")
   - "DETAILS": Surface features? (e.g. "LED indicator, brand label")
   - Explain how parts connect/overlap.

4. EXPECTED INTERNALS: List what components would be inside this product.
   For electronics: pcb, ic, battery, connector, sensor, led, speaker, antenna
   For mechanical: motor, gears, springs, bearings
   For toys: stuffing (none visible), joints

5. List main parts with primitive shapes (box, cylinder, sphere, capsule, rounded-box, cone, torus, plane, half-sphere).
6. Suggest realistic product colors (not generic grays).
7. Estimate dimensions (mm).

Respond in JSON:
{
  "objectType": "enclosure",
  "objectName": "Smart Speaker",
  "productCategory": "consumer-electronics",
  "structuralBlueprint": "SHELL: Cylindrical plastic housing with fabric mesh grille. INTERNALS: Circular PCB with main processor, WiFi antenna, speaker driver, microphone array. ATTACHMENTS: Power port on bottom, mute button on top. DETAILS: LED ring on top surface.",
  "expectedInternals": ["pcb", "ic", "speaker", "antenna", "connector"],
  "mainParts": [ ... ],
  "suggestedColors": ["#2C2C2C", "#1A1A1A"],
  "overallDimensions": {"width": 80, "height": 120, "depth": 80},
  "confidence": 0.95
}

Be specific. Do not assume. Output ONLY valid JSON.`;

// Helper to infer from description (moved from orchestrator logic or duplicated for robustness)
function inferFromDescriptionFallback(description?: string): VisionAnalysis {
    if (!description) {
        return {
            objectType: 'mixed',
            objectName: 'Generic Object',
            structuralBlueprint: 'A simple generic structure with a central body.',
            mainParts: [{ name: 'body', shape: 'rounded-box', relativeSize: 'large' }],
            suggestedColors: ['#808080', '#606060'],
            overallDimensions: { width: 50, height: 50, depth: 50 },
            confidence: 0.3
        };
    }

    const lower = description.toLowerCase();
    let objectType: VisionAnalysis['objectType'] = 'enclosure';
    let blueprint = 'A standard enclosure with a body and lid.';
    let parts: VisionAnalysis['mainParts'] = [{ name: 'body', shape: 'box', relativeSize: 'large' }];
    let colors = ['#808080'];

    if (/teddy|bear|plush|toy|animal|doll/i.test(lower)) {
        objectType = 'organic';
        blueprint = 'CORE VOLUME: Central capsule torso. ATTACHMENTS: Spherical head on top. Four capsule limbs. DETAILS: Ears, eyes, nose.';
        parts = [
            { name: 'torso', shape: 'capsule', relativeSize: 'large' },
            { name: 'head', shape: 'sphere', relativeSize: 'large' },
            { name: 'arm_L', shape: 'capsule', relativeSize: 'medium' },
            { name: 'arm_R', shape: 'capsule', relativeSize: 'medium' },
            { name: 'leg_L', shape: 'capsule', relativeSize: 'medium' },
            { name: 'leg_R', shape: 'capsule', relativeSize: 'medium' }
        ];
        colors = ['#8B4513', '#A0522D'];
    }

    return {
        objectType,
        objectName: description.slice(0, 30),
        structuralBlueprint: blueprint,
        mainParts: parts,
        suggestedColors: colors,
        overallDimensions: { width: 60, height: 80, depth: 60 },
        confidence: 0.4
    };
}

export async function analyzeSketchVision(
    imageBase64: string,
    description?: string,
    preferredModel?: string
): Promise<VisionAnalysis> {
    const llmClient = getLLMClient();
    const modelName = getModelName('vision', preferredModel);

    try {
        const response = await withRetry(async () => {
            // Build the request - Ollama/LLaVA may not support JSON mode
            const requestOptions: Parameters<typeof llmClient.chat.completions.create>[0] = {
                model: modelName,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: VISION_ANALYSIS_PROMPT + (description ? `\n\nContext/Description: ${description}` : '') },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1500,
                stream: false as const, // Ensure non-streaming response
            };

            // Only add response_format for OpenAI (Ollama/LLaVA may not support it)
            if (!isOfflineMode()) {
                requestOptions.response_format = { type: 'json_object' };
            }

            return await llmClient.chat.completions.create(requestOptions);
        });

        recordChatUsage(response, modelName, { source: 'agent:vision' });

        // Type assertion since we set stream: false
        const content = (response as { choices: { message: { content: string | null } }[] }).choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from vision analysis');
        }

        // Parse JSON from response (handle potential markdown code blocks from local models)
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
        }

        const rawAnalysis = JSON.parse(jsonContent);

        // Validate with Zod schema, falling back to manual defaults if validation fails
        const parseResult = visionResponseSchema.safeParse(rawAnalysis);
        if (parseResult.success) {
            return parseResult.data as VisionAnalysis;
        }

        // Zod validation failed — fall back to manual defaults for resilience
        console.warn('Vision response Zod validation failed, using manual defaults:', parseResult.error.message);
        const analysis = rawAnalysis as Partial<VisionAnalysis>;
        return {
            objectType: analysis.objectType || 'mixed',
            objectName: analysis.objectName || 'Unknown Object',
            structuralBlueprint: analysis.structuralBlueprint || 'A generic object composed of basic shapes.',
            mainParts: Array.isArray(analysis.mainParts) ? analysis.mainParts : [],
            suggestedColors: Array.isArray(analysis.suggestedColors) ? analysis.suggestedColors : ['#808080'],
            overallDimensions: analysis.overallDimensions || { width: 50, height: 50, depth: 50 },
            confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5
        };
    } catch (error) {
        recordChatError(modelName, { source: 'agent:vision' }, error as Error);
        console.error('Vision analysis failed:', error);
        return inferFromDescriptionFallback(description);
    }
}
