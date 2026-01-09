// Vision Analyzer Agent - Extracts object structure from sketch image
import { getLLMClient, getModelName, withRetry, isOfflineMode, recordChatError, recordChatUsage } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';

export interface VisionAnalysis {
    objectType: 'enclosure' | 'organic' | 'mechanical' | 'abstract' | 'mixed';
    objectName: string;
    structuralBlueprint: string; // New field for universal decomposition
    mainParts: Array<{
        name: string;
        shape: 'box' | 'cylinder' | 'sphere' | 'capsule' | 'rounded-box';
        relativeSize: 'large' | 'medium' | 'small' | 'tiny';
        color?: string;
    }>;
    suggestedColors: string[];
    overallDimensions: { width: number; height: number; depth: number };
    confidence: number;
}

const VISION_ANALYSIS_PROMPT = `Analyze this sketch/image and create a UNIVERSAL STRUCTURAL BLUEPRINT for 3D modeling.

YOUR GOAL: Deconstruct the object into simple geometric primitives so a blind modeler could recreate it.

1. What type of object is this? (enclosure, organic, mechanical, abstract, mixed)

2. STRUCTURAL BLUEPRINT (Critical for Universal Generation):
   Describe the object's anatomy step-by-step:
   - "CORE VOLUME": What is the main central shape? (e.g. "A large central sphere", "A flat rectangular base")
   - "ATTACHMENTS": What is connected to the core? (e.g. "Four cylindrical legs attached at 45 degrees")
   - "DETAILS": Surface features? (e.g. "Two small buttons on top")
   - Explain how parts connect/overlap.

3. List main parts with primitive shapes (box, cylinder, sphere, capsule, rounded-box).
4. Suggest colors.
5. Estimate dimensions (mm).

Respond in JSON:
{
  "objectType": "organic",
  "objectName": "Teddy Bear",
  "structuralBlueprint": "The object consists of a large central capsule acting as the torso. A spherical head sits directly on top. Four smaller capsule limbs are attached to the torso's corners. Two small spherical ears are on the head.",
  "mainParts": [ ... ],
  "suggestedColors": ["#8B4513"],
  "overallDimensions": {"width": 60, "height": 100, "depth": 40},
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

        const analysis = JSON.parse(jsonContent) as VisionAnalysis;


        // Validate and provide defaults
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
