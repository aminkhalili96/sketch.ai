// Structure Planner Agent - Plans 3D structure based on vision analysis
import { getOpenAIClient } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import type { VisionAnalysis } from './visionAnalyzer';

export interface StructurePlan {
    elements: Array<{
        id: string;
        name: string;
        type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule';
        position: [number, number, number];
        rotation: [number, number, number];
        dimensions: [number, number, number];
        color: string;
        material: 'plastic' | 'metal' | 'glass' | 'rubber';
        parent?: string; // ID of parent element for relative positioning
    }>;
    reasoning: string;
}

const STRUCTURE_PLANNER_PROMPT = `You are an expert 3D Structural Engineer.
Your goal is to build a 3D model that EXACTLY matches the provided Structural Blueprint.

Vision Analysis & Blueprint:
{visionAnalysis}

Project Description: {description}

## UNIVERSAL CONSTRUCTION PROTOCOL
Follow these steps recursively to build ANY object:

PHASE 1: THE CORE (Blockout)
- Identify the "Core Volume" from the blueprint.
- Place it at [0, 0, 0].
- This is the anchor for all other parts.

PHASE 2: ATTACHMENTS (Skeleton)
- Attach major limbs/components to the Core.
- Calculate positions based on the Core's dimensions.
- Example: If Core is 50mm wide, Left Arm x-position should be approx -30mm.
- Ensure parts OVERLAP slightly to form a solid object.

PHASE 3: DETAILING (Surface)
- Add surface details (eyes, buttons, screens) as small shapes.
- Position them on the surface of the parent part.

## RULES
1. Center main body at [0, 0, 0].
2. Use specified colors from blueprint.
3. ENSURE STRUCTURAL INTEGRITY: Parts must touch/intersect. No floating parts.
4. Use primitive shapes: box, rounded-box, cylinder, sphere, capsule.
5. Dimensions in millimeters.

Return JSON:
{
  "elements": [
    {
      "id": "core",
      "name": "torso",
      "type": "capsule",
      "position": [0, 0, 0],
      "dimensions": [40, 60, 30],
      "color": "#8B4513"
    },
    {
      "id": "limb-1",
      "name": "left-arm",
      "type": "capsule",
      "position": [-25, 10, 0],
      "dimensions": [15, 40, 15],
      "color": "#8B4513"
    }
  ],
  "reasoning": "Built torso as core capsule. Attached arms to sides..."
}

Output ONLY valid JSON.`;

export async function planStructure(
    visionAnalysis: VisionAnalysis,
    description: string
): Promise<StructurePlan> {
    const openai = getOpenAIClient();

    const prompt = STRUCTURE_PLANNER_PROMPT
        .replace('{visionAnalysis}', JSON.stringify(visionAnalysis, null, 2))
        .replace('{description}', description);

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2500,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from structure planner');
        }

        const plan = JSON.parse(content) as StructurePlan;

        // Validate elements
        if (!Array.isArray(plan.elements) || plan.elements.length === 0) {
            throw new Error('Invalid structure plan: no elements');
        }

        return {
            elements: plan.elements.map((el, idx) => ({
                id: el.id || `element-${idx}`,
                name: el.name || `part-${idx}`,
                type: el.type || 'box',
                position: el.position || [0, 0, 0],
                rotation: el.rotation || [0, 0, 0],
                dimensions: el.dimensions || [10, 10, 10],
                color: el.color || '#808080',
                material: el.material || 'plastic'
            })),
            reasoning: plan.reasoning || 'Structure planned based on vision analysis'
        };
    } catch (error) {
        console.error('Structure planning failed:', error);

        // Generate fallback based on vision analysis
        const dims = visionAnalysis.overallDimensions;
        const color = visionAnalysis.suggestedColors[0] || '#808080';

        return {
            elements: [
                {
                    id: 'body',
                    name: 'main-body',
                    type: visionAnalysis.objectType === 'organic' ? 'capsule' : 'rounded-box',
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    dimensions: [dims.width, dims.height, dims.depth],
                    color,
                    material: 'plastic'
                }
            ],
            reasoning: 'Fallback structure due to planning error'
        };
    }
}
