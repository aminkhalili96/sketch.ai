// Critic Agent - Validates generated scene against original input
import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { SYSTEM_PROMPT } from '@/backend/ai/prompts';
import type { VisionAnalysis } from './visionAnalyzer';
import type { StructurePlan } from './structurePlanner';

export interface CritiqueResult {
    score: number; // 0-10
    isAcceptable: boolean;
    matchesInput: boolean;
    issues: Array<{
        severity: 'critical' | 'major' | 'minor';
        description: string;
        suggestedFix?: string;
    }>;
    missingParts: string[];
    extraneousParts: string[];
    colorIssues: string[];
    proportionIssues: string[];
    summary: string;
}

const CRITIC_PROMPT = `You are an enterprise-grade 3D model critic. Compare the generated scene against the original vision analysis.

Original Vision Analysis (what the sketch shows):
{visionAnalysis}

Generated Scene:
{scene}

Evaluate these criteria:
1. **Object type match**: Does the scene match the object type? (enclosure vs organic vs mechanical)
2. **Parts completeness**: Are all identified parts present?
3. **Internal detail** (CRITICAL for electronics): Does the model include:
   - PCB/circuit board? (layer: "pcb")
   - IC chips/processors? (layer: "internal")
   - Battery if applicable? (layer: "internal")
   - Connectors at port locations? (layer: "internal")
   If the product is electronic and lacks ANY internal components, add a MAJOR issue.
4. **Layer annotations**: Do elements have proper layer tags? (shell, pcb, internal, detail, label)
   Missing layer tags = MINOR issue per element.
5. **Color authenticity**: Are colors realistic for the product category?
   - Generic gray (#808080) on electronics = issue
   - PCB should be green (#2D5016), not gray
   - IC chips should be dark (#1A1A1A), not colorful
6. **Proportions**: Are proportions reasonable?

Scoring:
- 9-10: Perfect — correct type, all parts, internal components, proper layers, realistic colors
- 7-8: Good — minor issues (missing labels, few missing layer tags)
- 5-6: Partial — missing internal components OR wrong colors
- 3-4: Poor — shell-only model for an electronic product, missing PCB/chips
- 0-2: Wrong object type entirely

A scene is "acceptable" if score >= 7.
A scene "matchesInput" if the object type is correct.

Return JSON:
{
  "score": 8,
  "isAcceptable": true,
  "matchesInput": true,
  "issues": [
    {"severity": "minor", "description": "Missing LED indicator", "suggestedFix": "Add small half-sphere with emissive material"}
  ],
  "missingParts": ["led"],
  "extraneousParts": [],
  "colorIssues": [],
  "proportionIssues": [],
  "summary": "Good representation with PCB and chips. Missing LED indicator on front panel."
}

Be strict about:
- Object type matching (PCB sketch -> must have box shapes not organic)
- Internal component presence for electronics (no PCB/chips = MAJOR issue)
- Realistic product colors (not default grays)
Output ONLY valid JSON.`;

export async function critiqueScene(
    visionAnalysis: VisionAnalysis,
    scene: StructurePlan['elements'],
    preferredModel?: string
): Promise<CritiqueResult> {
    const llmClient = getLLMClient();
    const modelName = getModelName('text', preferredModel);

    const prompt = CRITIC_PROMPT
        .replace('{visionAnalysis}', JSON.stringify(visionAnalysis, null, 2))
        .replace('{scene}', JSON.stringify(scene, null, 2));

    try {
        const response = await llmClient.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1500,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
        });
        recordChatUsage(response, modelName, { source: 'agent:critic' });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from critic');
        }

        // Parse JSON (handle markdown code blocks for local models)
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
        }

        const critique = JSON.parse(jsonContent) as CritiqueResult;

        return {
            score: typeof critique.score === 'number' ? critique.score : 5,
            isAcceptable: critique.isAcceptable ?? critique.score >= 7,
            matchesInput: critique.matchesInput ?? true,
            issues: Array.isArray(critique.issues) ? critique.issues : [],
            missingParts: Array.isArray(critique.missingParts) ? critique.missingParts : [],
            extraneousParts: Array.isArray(critique.extraneousParts) ? critique.extraneousParts : [],
            colorIssues: Array.isArray(critique.colorIssues) ? critique.colorIssues : [],
            proportionIssues: Array.isArray(critique.proportionIssues) ? critique.proportionIssues : [],
            summary: critique.summary || 'Critique completed'
        };
    } catch (error) {
        recordChatError(modelName, { source: 'agent:critic' }, error as Error);
        console.error('Critique failed:', error);

        // Quick local validation
        const expectedType = visionAnalysis.objectType;
        const hasOrganic = scene.some(e => e.type === 'sphere' || e.type === 'capsule');
        const hasBoxes = scene.some(e => e.type === 'box' || e.type === 'rounded-box');

        // Check for type mismatch
        const typeMismatch =
            (expectedType === 'enclosure' && hasOrganic && !hasBoxes) ||
            (expectedType === 'organic' && hasBoxes && !hasOrganic);

        return {
            score: typeMismatch ? 2 : 6,
            isAcceptable: !typeMismatch,
            matchesInput: !typeMismatch,
            issues: typeMismatch ? [{
                severity: 'critical',
                description: `Object type mismatch: expected ${expectedType} but got different shape types`,
                suggestedFix: `Use appropriate shapes for ${expectedType}`
            }] : [],
            missingParts: [],
            extraneousParts: [],
            colorIssues: [],
            proportionIssues: [],
            summary: typeMismatch ? 'Critical type mismatch detected' : 'Quick validation passed'
        };
    }
}
