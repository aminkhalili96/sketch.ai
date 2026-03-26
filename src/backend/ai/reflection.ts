// 3D Scene Reflection and Validation
// This module provides LLM-based self-critique for generated 3D scenes

import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { SYSTEM_PROMPT, stripCodeFences } from '@/backend/ai/prompts';
import type { z } from 'zod';
import type { sceneSchema } from '@/shared/schemas/validators';

type SceneElements = z.infer<typeof sceneSchema>;

export interface ReflectionResult {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    missingParts: string[];
    score: number; // 0-10
}

export interface ReflectionFixResult {
    fixedScene: SceneElements;
    appliedFixes: string[];
}

/**
 * Common organic-object parts. Only enforced when the description matches
 * a teddy-bear / plush-toy pattern; other objects derive expected parts
 * from the description itself.
 */
const TEDDY_BEAR_PARTS = [
    'body', 'head', 'ear-left', 'ear-right', 'muzzle',
    'eye-left', 'eye-right', 'nose', 'arm-left', 'arm-right',
    'leg-left', 'leg-right'
];

const COMMON_ORGANIC_PARTS = ['body', 'head'];

function getExpectedParts(description: string): string[] {
    if (/teddy|bear|plush|stuffed/i.test(description)) {
        return TEDDY_BEAR_PARTS;
    }
    return COMMON_ORGANIC_PARTS;
}

const SCENE_JUDGE_PROMPT = `You are a 3D model quality judge. Evaluate this scene JSON against the original project description.

Project Description: {description}
Analysis Context: {analysis}

Generated Scene JSON:
{scene}

Evaluate the scene and respond in JSON format:
{
  "score": 8,
  "isValid": true,
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": ["Add eyes", "Adjust proportions"],
  "missingParts": ["eye-left", "eye-right"]
}

Scoring criteria (0-10):
- 10: Perfect representation with all expected parts, correct colors, good proportions
- 7-9: Good representation, minor issues
- 4-6: Recognizable but missing important features
- 1-3: Poor representation, major issues
- 0: Completely wrong or unusable

Check for:
- All major structural/anatomical parts expected for this kind of object
- Appropriate colors matching the object's real-world appearance
- Proper proportions between parts
- No floating/disconnected parts

Output ONLY valid JSON.`;

const SCENE_FIX_PROMPT = `You are a 3D model fixer. The current scene has issues that need fixing.

Project Description: {description}
Current Scene JSON:
{scene}

Issues to fix:
{issues}

Missing parts to add:
{missingParts}

Fix the scene by:
1. Adding any missing structural/body parts that the description implies
2. Correcting any proportion issues
3. Fixing colors to match the object's real-world appearance
4. Ensuring all parts are properly connected (no floating pieces)
5. Using spheres and capsules for organic/rounded shapes, boxes for mechanical/enclosure shapes

Return ONLY the fixed scene JSON with "elements" array. No explanations.`;

/**
 * Quick structural validation without LLM call
 */
export function quickValidateScene(elements: SceneElements, description: string): ReflectionResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const missingParts: string[] = [];

    const isOrganic = /teddy|bear|plush|stuffed|toy|doll|character|animal|bunny|cat|dog|figurine/i.test(description);

    if (isOrganic) {
        const elementNames = new Set(elements.map(e => e.name?.toLowerCase() || ''));
        const expectedParts = getExpectedParts(description);

        for (const part of expectedParts) {
            if (!elementNames.has(part)) {
                missingParts.push(part);
            }
        }

        if (missingParts.length > 0) {
            issues.push(`Missing ${missingParts.length} body parts: ${missingParts.join(', ')}`);
        }

        // Check for organic shapes (should use spheres/capsules, not boxes)
        const boxCount = elements.filter(e => e.type === 'box' || e.type === 'rounded-box').length;
        if (boxCount > 0) {
            issues.push(`Found ${boxCount} box elements - organic objects should use spheres/capsules`);
            suggestions.push('Replace boxes with spheres or capsules for organic shapes');
        }

        // Check for eyes (only for animals/characters)
        if (/teddy|bear|animal|bunny|cat|dog|character|doll/i.test(description)) {
            const hasEyes = elements.some(e => e.name?.toLowerCase().includes('eye'));
            if (!hasEyes) {
                suggestions.push('Add eyes for a more complete appearance');
            }
        }
    }

    // General validation
    if (elements.length < 3) {
        issues.push('Scene has too few elements for a complete model');
    }

    // Calculate score
    let score = 10;
    score -= issues.length * 2;
    score -= suggestions.length * 0.5;
    score = Math.max(0, Math.min(10, score));

    return {
        isValid: issues.length === 0,
        issues,
        suggestions,
        missingParts,
        score
    };
}

/**
 * Deep validation using LLM as judge
 */
export async function llmJudgeScene(
    elements: SceneElements,
    description: string,
    analysisContext?: string
): Promise<ReflectionResult> {
    const llmClient = getLLMClient();

    const prompt = SCENE_JUDGE_PROMPT
        .replace('{description}', description)
        .replace('{analysis}', analysisContext || 'No analysis provided')
        .replace('{scene}', JSON.stringify(elements, null, 2));

    try {
        const response = await llmClient.chat.completions.create({
            model: getModelName('text'),
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
        });
        recordChatUsage(response, getModelName('text'), { source: 'reflection:judge' });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) {
            throw new Error('No response from judge');
        }
        const jsonContent = stripCodeFences(rawContent);

        const result = JSON.parse(jsonContent) as ReflectionResult;
        return {
            isValid: result.isValid ?? result.score >= 7,
            issues: result.issues || [],
            suggestions: result.suggestions || [],
            missingParts: result.missingParts || [],
            score: result.score ?? 5
        };
    } catch (error) {
        recordChatError(getModelName('text'), { source: 'reflection:judge' }, error as Error);
        console.error('LLM judge failed, using quick validation:', error);
        return quickValidateScene(elements, description);
    }
}

/**
 * Attempt to fix scene issues using LLM
 */
export async function llmFixScene(
    elements: SceneElements,
    description: string,
    reflection: ReflectionResult
): Promise<ReflectionFixResult> {
    const llmClient = getLLMClient();

    const prompt = SCENE_FIX_PROMPT
        .replace('{description}', description)
        .replace('{scene}', JSON.stringify(elements, null, 2))
        .replace('{issues}', reflection.issues.join('\n'))
        .replace('{missingParts}', reflection.missingParts.join(', ') || 'None');

    try {
        const response = await llmClient.chat.completions.create({
            model: getModelName('text'),
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
        });
        recordChatUsage(response, getModelName('text'), { source: 'reflection:fix' });

        const rawFixContent = response.choices[0]?.message?.content;
        if (!rawFixContent) {
            throw new Error('No response from fixer');
        }
        const jsonContent = stripCodeFences(rawFixContent);

        const parsed = JSON.parse(jsonContent);
        const fixedElements = Array.isArray(parsed) ? parsed : parsed.elements;

        if (!Array.isArray(fixedElements)) {
            throw new Error('Invalid fixed scene format');
        }

        return {
            fixedScene: fixedElements as SceneElements,
            appliedFixes: [
                ...reflection.issues.map(i => `Fixed: ${i}`),
                ...reflection.missingParts.map(p => `Added: ${p}`)
            ]
        };
    } catch (error) {
        recordChatError(getModelName('text'), { source: 'reflection:fix' }, error as Error);
        console.error('LLM fix failed:', error);
        return {
            fixedScene: elements,
            appliedFixes: []
        };
    }
}

/**
 * Full reflection loop: validate and fix if needed
 */
export async function reflectAndFix(
    elements: SceneElements,
    description: string,
    analysisContext?: string,
    options: { maxIterations?: number; minScore?: number; useLlmJudge?: boolean } = {}
): Promise<{ scene: SceneElements; reflections: ReflectionResult[]; fixes: string[] }> {
    const { maxIterations = 2, minScore = 7, useLlmJudge = true } = options;

    let currentScene = elements;
    const reflections: ReflectionResult[] = [];
    const allFixes: string[] = [];

    for (let i = 0; i < maxIterations; i++) {
        // Validate
        const reflection = useLlmJudge
            ? await llmJudgeScene(currentScene, description, analysisContext)
            : quickValidateScene(currentScene, description);

        reflections.push(reflection);

        console.log(`Reflection ${i + 1}: score=${reflection.score}, valid=${reflection.isValid}, issues=${reflection.issues.length}`);

        // If good enough, stop
        if (reflection.isValid && reflection.score >= minScore) {
            break;
        }

        // Try to fix
        if (reflection.issues.length > 0 || reflection.missingParts.length > 0) {
            const fixResult = await llmFixScene(currentScene, description, reflection);
            currentScene = fixResult.fixedScene;
            allFixes.push(...fixResult.appliedFixes);
        }
    }

    return {
        scene: currentScene,
        reflections,
        fixes: allFixes
    };
}
