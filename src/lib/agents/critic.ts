// Critic Agent - Validates generated scene against original input
import { getLLMClient, getModelName, isOfflineMode } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
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

const CRITIC_PROMPT = `You are a 3D model critic. Compare the generated scene against the original vision analysis.

Original Vision Analysis (what the sketch shows):
{visionAnalysis}

Generated Scene:
{scene}

Evaluate:
1. Does the scene match the object type? (enclosure vs organic vs mechanical)
2. Are all identified parts present?
3. Are there extra parts that shouldn't be there?
4. Are colors appropriate?
5. Are proportions reasonable?

Scoring:
- 9-10: Perfect match, all parts present, correct type
- 7-8: Good match, minor issues
- 5-6: Partial match, some missing/wrong parts
- 3-4: Poor match, significant issues
- 0-2: Wrong object type entirely

A scene is "acceptable" if score >= 7.
A scene "matchesInput" if the object type is correct.

Return JSON:
{
  "score": 8,
  "isAcceptable": true,
  "matchesInput": true,
  "issues": [
    {"severity": "minor", "description": "Missing LED indicator", "suggestedFix": "Add small cylinder for LED"}
  ],
  "missingParts": ["led"],
  "extraneousParts": [],
  "colorIssues": [],
  "proportionIssues": [],
  "summary": "Good representation of PCB with minor details missing"
}

Be strict about object type matching - if vision shows a PCB but scene has organic shapes (spheres/capsules for toys), that's a CRITICAL issue.
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
