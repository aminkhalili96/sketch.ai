// Visual Aesthetics Refiner Agent - Automatically improves 3D model visual appeal
import { getLLMClient, getModelName, isOfflineMode } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import type { VisualCritiqueResult } from './visualCritic';

export interface VisualRefinementResult {
    refinedScene: unknown;
    changesApplied: string[];
    summary: string;
}

const VISUAL_REFINER_PROMPT = `You are a professional 3D product designer. Improve this scene's VISUAL APPEAL based on the critique.

Current Scene JSON:
{scene}

Project Description:
{description}

Visual Critique (issues to fix):
{critique}

Apply these visual improvements:

1. **Color Improvements**
   - Replace dull/repetitive colors with a harmonious palette
   - Add accent colors for contrast (buttons, indicators, trim)
   - Use appropriate colors for the product type:
     - Tech products: White/silver body + colored accents (#2563EB blue, #10B981 green)
     - Toys: Bright, playful colors (#F59E0B yellow, #EF4444 red, #8B5CF6 purple)
     - Tools: Professional grays + safety colors
   - Ensure sufficient contrast between adjacent elements

2. **Polish & Refinement**
   - Increase corner radius on sharp edges (rounded-box: radius 2-5mm)
   - Add appropriate smoothness values (smoothness: 8-16 for quality)
   - Use appropriate materials: "plastic" for bodies, "metal" for accents, "rubber" for grips

3. **Proportion Fixes**
   - Adjust sizes for better visual balance
   - Ensure hierarchy (main body largest, details smaller)

4. **Professional Touches**
   - Add subtle details: indicator lights (small colored spheres)
   - Ensure consistent style across all elements
   - Make it look like a real product, not a prototype

IMPORTANT RULES:
- Keep all existing elements, just improve their appearance
- Don't change positions drastically (keep structural integrity)
- Use hex color codes (#RRGGBB format)
- Maintain the same element names for tracking

Return JSON with the complete refined scene:
{
  "refinedScene": {
    "elements": [
      // All elements with improved colors, materials, and polish
    ]
  },
  "changesApplied": [
    "Changed body color from #808080 to #F5F5F5 (clean white)",
    "Added accent color #2563EB to button",
    "Increased corner radius from 1mm to 4mm"
  ],
  "summary": "Applied modern tech aesthetic with white body and blue accents"
}

Output ONLY valid JSON.`;

export async function refineVisualAppeal(
    scene: unknown,
    description: string,
    critique: VisualCritiqueResult,
    preferredModel?: string
): Promise<VisualRefinementResult> {
    const llmClient = getLLMClient();
    const modelName = getModelName('text', preferredModel);

    const prompt = VISUAL_REFINER_PROMPT
        .replace('{scene}', JSON.stringify(scene, null, 2))
        .replace('{description}', description)
        .replace('{critique}', JSON.stringify(critique, null, 2));

    try {
        const response = await llmClient.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 3000,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from visual refiner');
        }

        // Parse JSON (handle markdown code blocks for local models)
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
        }

        const result = JSON.parse(jsonContent) as VisualRefinementResult;

        return {
            refinedScene: result.refinedScene || scene,
            changesApplied: Array.isArray(result.changesApplied) ? result.changesApplied : [],
            summary: result.summary || 'Visual improvements applied'
        };
    } catch (error) {
        console.error('Visual refinement failed:', error);

        // Fallback: apply basic color improvements
        const fallbackScene = applyFallbackPolish(scene);
        return {
            refinedScene: fallbackScene,
            changesApplied: ['Applied fallback color palette'],
            summary: 'Applied default visual improvements'
        };
    }
}

// Fallback polish when AI fails - applies sensible defaults
function applyFallbackPolish(scene: unknown): unknown {
    if (!scene || typeof scene !== 'object') return scene;

    const sceneObj = scene as { elements?: Array<Record<string, unknown>> };
    if (!Array.isArray(sceneObj.elements)) return scene;

    // Professional color palette
    const palette = {
        primary: '#F8FAFC',    // Clean white
        secondary: '#E2E8F0',   // Light gray
        accent: '#3B82F6',      // Blue accent
        dark: '#1E293B',        // Dark contrast
        highlight: '#10B981'    // Green highlight
    };

    let colorIndex = 0;
    const colors = [palette.primary, palette.secondary, palette.primary];

    const polishedElements = sceneObj.elements.map((element, index) => {
        const polished = { ...element };

        // Improve colors if they look dull (grays, blacks)
        const currentColor = String(element.color || '').toLowerCase();
        if (currentColor.includes('808080') || currentColor.includes('333333') || currentColor.includes('000000')) {
            polished.color = colors[colorIndex % colors.length];
            colorIndex++;
        }

        // Add smoothness if missing
        if (element.type === 'rounded-box' && !element.smoothness) {
            polished.smoothness = 8;
        }

        // Ensure radius for rounded boxes
        if (element.type === 'rounded-box' && (!element.radius || Number(element.radius) < 2)) {
            polished.radius = 3;
        }

        // Set material if missing
        if (!element.material) {
            polished.material = index === 0 ? 'plastic' : 'metal';
        }

        return polished;
    });

    return { elements: polishedElements };
}
