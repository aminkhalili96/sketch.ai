// Vision Analyzer Agent - Extracts object structure from sketch image
import { getOpenAIClient } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';

export interface VisionAnalysis {
    objectType: 'enclosure' | 'organic' | 'mechanical' | 'abstract';
    objectName: string;
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

const VISION_ANALYSIS_PROMPT = `Analyze this sketch/image and extract 3D modeling information.

Determine:
1. What type of object is this?
   - "enclosure": Electronics enclosure, PCB housing, device case
   - "organic": Toy, plush, animal, character, organic shape
   - "mechanical": Machine part, gear, bracket, structural component  
   - "abstract": Art piece, abstract shape, unknown

2. What are the main parts/components visible?
   For each part, specify:
   - name: descriptive name (e.g., "body", "lid", "chip", "connector")
   - shape: best primitive (box, cylinder, sphere, capsule, rounded-box)
   - relativeSize: large/medium/small/tiny
   - color: if visible, hex color

3. What colors are appropriate for this object?

4. Approximate dimensions in millimeters

Respond in JSON:
{
  "objectType": "enclosure",
  "objectName": "Microchip Development Board",
  "mainParts": [
    {"name": "pcb-base", "shape": "rounded-box", "relativeSize": "large", "color": "#228B22"},
    {"name": "main-chip", "shape": "box", "relativeSize": "medium", "color": "#1A1A1A"},
    {"name": "pin-header", "shape": "box", "relativeSize": "small", "color": "#C0C0C0"}
  ],
  "suggestedColors": ["#228B22", "#1A1A1A", "#C0C0C0", "#FFD700"],
  "overallDimensions": {"width": 50, "height": 10, "depth": 40},
  "confidence": 0.85
}

Be specific to what you SEE in the image. Do not assume or hallucinate parts that are not visible.
Output ONLY valid JSON.`;

export async function analyzeSketchVision(imageBase64: string): Promise<VisionAnalysis> {
    const openai = getOpenAIClient();

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: VISION_ANALYSIS_PROMPT },
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
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from vision analysis');
        }

        const analysis = JSON.parse(content) as VisionAnalysis;

        // Validate and provide defaults
        return {
            objectType: analysis.objectType || 'enclosure',
            objectName: analysis.objectName || 'Unknown Object',
            mainParts: Array.isArray(analysis.mainParts) ? analysis.mainParts : [],
            suggestedColors: Array.isArray(analysis.suggestedColors) ? analysis.suggestedColors : ['#808080'],
            overallDimensions: analysis.overallDimensions || { width: 50, height: 20, depth: 40 },
            confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5
        };
    } catch (error) {
        console.error('Vision analysis failed:', error);
        // Return a generic fallback
        return {
            objectType: 'enclosure',
            objectName: 'Generic Object',
            mainParts: [
                { name: 'body', shape: 'rounded-box', relativeSize: 'large' }
            ],
            suggestedColors: ['#808080', '#606060'],
            overallDimensions: { width: 50, height: 20, depth: 40 },
            confidence: 0.3
        };
    }
}
