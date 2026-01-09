// Visual Aesthetics Critic Agent - Evaluates visual appeal of 3D models
import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';

export interface VisualCritiqueResult {
    score: number; // 1-10 (10 = professional product render quality)
    isAcceptable: boolean; // true if score >= 8
    issues: Array<{
        category: 'color' | 'proportion' | 'polish' | 'composition' | 'contrast';
        severity: 'critical' | 'major' | 'minor';
        description: string;
        suggestedFix: string;
    }>;
    strengths: string[];
    overallImpression: string;
}

const VISUAL_CRITIC_PROMPT = `You are a professional 3D product designer and visual quality critic. 
Evaluate this 3D scene for VISUAL APPEAL, not structural accuracy.

Scene JSON:
{scene}

Project Description:
{description}

Evaluate these aspects of VISUAL QUALITY:

1. **Color Harmony** (0-2 points)
   - Are colors complementary or clashing?
   - Is there good use of accent colors?
   - Is the palette appropriate for the product type?

2. **Contrast & Readability** (0-2 points)
   - Is there sufficient contrast between elements?
   - Can you clearly distinguish different parts?
   - Are buttons/controls visually distinct?

3. **Proportions & Balance** (0-2 points)
   - Does the composition feel balanced?
   - Are element sizes proportional?
   - Is there appropriate visual hierarchy?

4. **Surface Polish** (0-2 points)
   - Do edges look refined (rounded where appropriate)?
   - Are materials well-chosen (plastic, metal, glass)?
   - Does it look like a real product vs a rough prototype?

5. **Professional Finish** (0-2 points)
   - Would this look good in a product catalog?
   - Does it feel premium or cheap?
   - Is attention to detail evident?

SCORING:
- 9-10: Product render quality, ready for marketing
- 7-8: Good quality, minor polish needed
- 5-6: Acceptable, noticeable issues
- 3-4: Below average, significant improvements needed
- 1-2: Poor visual quality, major redesign needed

A scene is "acceptable" only if score >= 8.

Return JSON:
{
  "score": 7,
  "isAcceptable": false,
  "issues": [
    {
      "category": "color",
      "severity": "major",
      "description": "All elements are the same gray color, no visual interest",
      "suggestedFix": "Add a contrasting accent color for buttons and indicators"
    },
    {
      "category": "polish", 
      "severity": "minor",
      "description": "Sharp corners on enclosure look industrial, not consumer-friendly",
      "suggestedFix": "Increase corner radius to 3-5mm for softer appearance"
    }
  ],
  "strengths": ["Good proportions", "Appropriate size"],
  "overallImpression": "Functional but visually bland. Needs color and polish."
}

Be specific in your suggestions - include exact colors (hex codes), dimensions, or material changes.
Output ONLY valid JSON.`;

export async function critiqueVisualAppeal(
    scene: unknown,
    description: string,
    preferredModel?: string
): Promise<VisualCritiqueResult> {
    const llmClient = getLLMClient();
    const modelName = getModelName('text', preferredModel);

    const prompt = VISUAL_CRITIC_PROMPT
        .replace('{scene}', JSON.stringify(scene, null, 2))
        .replace('{description}', description);

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
        recordChatUsage(response, modelName, { source: 'agent:visual-critic' });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from visual critic');
        }

        // Parse JSON (handle markdown code blocks for local models)
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
        }

        const critique = JSON.parse(jsonContent) as VisualCritiqueResult;

        return {
            score: typeof critique.score === 'number' ? Math.min(10, Math.max(1, critique.score)) : 5,
            isAcceptable: critique.isAcceptable ?? critique.score >= 8,
            issues: Array.isArray(critique.issues) ? critique.issues : [],
            strengths: Array.isArray(critique.strengths) ? critique.strengths : [],
            overallImpression: critique.overallImpression || 'Visual quality evaluated'
        };
    } catch (error) {
        recordChatError(modelName, { source: 'agent:visual-critic' }, error as Error);
        console.error('Visual critique failed:', error);

        // Fallback: assume it needs improvement
        return {
            score: 6,
            isAcceptable: false,
            issues: [{
                category: 'polish',
                severity: 'minor',
                description: 'Unable to fully evaluate visual quality',
                suggestedFix: 'Apply general visual improvements'
            }],
            strengths: [],
            overallImpression: 'Evaluation incomplete, applying default polish'
        };
    }
}
