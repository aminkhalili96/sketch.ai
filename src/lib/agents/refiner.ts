// Refiner Agent - Fixes issues identified by the Critic
import { getOpenAIClient } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import type { VisionAnalysis } from './visionAnalyzer';
import type { StructurePlan } from './structurePlanner';
import type { CritiqueResult } from './critic';

export interface RefinementResult {
    elements: StructurePlan['elements'];
    changes: string[];
    success: boolean;
}

const REFINER_PROMPT = `You are a 3D model refiner. Fix the issues identified in the critique.

Original Vision Analysis (what the sketch shows):
{visionAnalysis}

Current Scene:
{scene}

Critique (issues to fix):
{critique}

Fix ALL issues:
1. Add any missing parts
2. Remove extraneous parts (parts not in original vision)
3. Fix colors if wrong
4. Correct proportions
5. Most importantly: ensure object TYPE matches (enclosure = boxes, organic = spheres/capsules)

CRITICAL RULES:
- For "enclosure" type: Use ONLY box, rounded-box, cylinder. NO spheres/capsules for body.
- For "organic" type: Use spheres, capsules for body/limbs. Boxes only for small details.
- For "mechanical" type: Use cylinders, boxes for gears/parts.

Return the COMPLETE fixed scene JSON:
{
  "elements": [...all elements including fixes...],
  "changes": ["Added missing LED", "Changed body to rounded-box", ...]
}

Output ONLY valid JSON with all elements.`;

export async function refineScene(
    visionAnalysis: VisionAnalysis,
    scene: StructurePlan['elements'],
    critique: CritiqueResult
): Promise<RefinementResult> {
    const openai = getOpenAIClient();

    const prompt = REFINER_PROMPT
        .replace('{visionAnalysis}', JSON.stringify(visionAnalysis, null, 2))
        .replace('{scene}', JSON.stringify(scene, null, 2))
        .replace('{critique}', JSON.stringify({
            issues: critique.issues,
            missingParts: critique.missingParts,
            extraneousParts: critique.extraneousParts,
            colorIssues: critique.colorIssues,
            proportionIssues: critique.proportionIssues,
            summary: critique.summary
        }, null, 2));

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 3000,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from refiner');
        }

        const result = JSON.parse(content);
        const elements = Array.isArray(result.elements) ? result.elements : result;

        if (!Array.isArray(elements) || elements.length === 0) {
            throw new Error('Invalid refinement result');
        }

        return {
            elements: elements.map((el: StructurePlan['elements'][0], idx: number) => ({
                id: el.id || `element-${idx}`,
                name: el.name || `part-${idx}`,
                type: el.type || 'box',
                position: el.position || [0, 0, 0],
                rotation: el.rotation || [0, 0, 0],
                dimensions: el.dimensions || [10, 10, 10],
                color: el.color || '#808080',
                material: el.material || 'plastic'
            })),
            changes: Array.isArray(result.changes) ? result.changes : ['Refinement applied'],
            success: true
        };
    } catch (error) {
        console.error('Refinement failed:', error);

        // If refinement fails and we have a type mismatch, do emergency local fix
        if (!critique.matchesInput && visionAnalysis.objectType === 'enclosure') {
            // Convert organic shapes to boxes for enclosure
            const fixedElements = scene.map(el => {
                if (el.type === 'sphere' || el.type === 'capsule') {
                    return {
                        ...el,
                        type: 'rounded-box' as const,
                        dimensions: [
                            el.dimensions[0] * 2 || 20,
                            el.dimensions[1] || el.dimensions[0] || 10,
                            el.dimensions[2] || el.dimensions[0] * 2 || 20
                        ] as [number, number, number]
                    };
                }
                return el;
            });

            return {
                elements: fixedElements,
                changes: ['Emergency fix: converted organic shapes to boxes for enclosure'],
                success: true
            };
        }

        return {
            elements: scene,
            changes: [],
            success: false
        };
    }
}
