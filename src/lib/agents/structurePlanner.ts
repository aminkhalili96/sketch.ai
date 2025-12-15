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

const STRUCTURE_PLANNER_PROMPT = `You are a 3D structure planner. Based on the vision analysis, create a detailed 3D structure plan.

Vision Analysis:
{visionAnalysis}

Project Description: {description}

Create a complete 3D structure with precise positions and dimensions.

Rules:
1. Center the main body at [0, 0, 0]
2. Use millimeters for all dimensions
3. Position child elements relative to center
4. Ensure no floating parts - everything should connect
5. Use appropriate shapes for each part type
6. Apply colors from the suggested palette
7. Include ALL parts identified in the vision analysis

For electronics (PCB, enclosure):
- Use rounded-box for PCB base
- Use box for chips/ICs
- Use cylinder for capacitors/LEDs
- Use box/rounded-box for connectors

For organic shapes (toys, characters):
- Use sphere for heads, eyes
- Use capsule for bodies, limbs
- Use sphere for ears, noses

Return JSON:
{
  "elements": [
    {
      "id": "body",
      "name": "main-body",
      "type": "rounded-box",
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "dimensions": [50, 5, 40],
      "color": "#228B22",
      "material": "plastic"
    }
  ],
  "reasoning": "Created PCB-style base with components..."
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
