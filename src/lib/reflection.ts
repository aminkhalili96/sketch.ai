// 3D Scene Reflection and Validation
// This module provides LLM-based self-critique for generated 3D scenes

import { getOpenAIClient } from '@/lib/openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import type { z } from 'zod';
import type { sceneSchema } from '@/lib/validators';

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

const REQUIRED_TEDDY_PARTS = [
    'body', 'head', 'ear-left', 'ear-right', 'muzzle',
    'eye-left', 'eye-right', 'nose', 'arm-left', 'arm-right',
    'leg-left', 'leg-right'
];

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
- 10: Perfect representation with all body parts, correct colors, good proportions
- 7-9: Good representation, minor issues
- 4-6: Recognizable but missing important features
- 1-3: Poor representation, major issues
- 0: Completely wrong or unusable

For a teddy bear, check for:
- Body, head, 2 ears, muzzle, 2 eyes, nose, 2 arms, 2 legs (12 parts total)
- Brown/tan colors for body
- Dark colors for eyes/nose
- Proper proportions (head slightly smaller than body)
- No floating parts

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
1. Adding any missing body parts
2. Correcting any proportion issues
3. Fixing colors if wrong
4. Ensuring all parts are properly connected

For teddy bears, ensure:
- Body: capsule, radius ~35mm, length ~80mm, color #8B4513
- Head: sphere, radius ~45mm, above body, color #A0522D
- Ears: 2 spheres, radius ~15mm, on top of head, color #8B4513
- Eyes: 2 spheres, radius ~6mm, on front of head, color #1A1A1A
- Nose: sphere, radius ~5mm, on muzzle, color #2D2D2D
- Muzzle: sphere, radius ~18mm, on front of head, color #F5DEB3
- Arms: 2 capsules, radius ~12mm, length ~50mm, color #A0522D
- Legs: 2 capsules, radius ~15mm, length ~55mm, color #8B4513

Return ONLY the fixed scene JSON with "elements" array. No explanations.`;

/**
 * Quick structural validation without LLM call
 */
export function quickValidateScene(elements: SceneElements, description: string): ReflectionResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const missingParts: string[] = [];

    const isTeddyBear = /teddy|bear|plush|stuffed|toy/i.test(description);

    if (isTeddyBear) {
        const elementNames = new Set(elements.map(e => e.name?.toLowerCase() || ''));

        for (const part of REQUIRED_TEDDY_PARTS) {
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
            issues.push(`Found ${boxCount} box elements - teddy bears should use spheres/capsules only`);
            suggestions.push('Replace boxes with spheres or capsules for organic shapes');
        }

        // Check for eyes
        const hasEyes = elements.some(e => e.name?.toLowerCase().includes('eye'));
        if (!hasEyes) {
            suggestions.push('Add black eyes for a more complete appearance');
        }

        // Check colors
        const hasRealisticColors = elements.some(e =>
            e.color && /#[89AB][0-9A-F]{4}/i.test(e.color) // Brown-ish colors
        );
        if (!hasRealisticColors) {
            suggestions.push('Use realistic brown colors for the teddy bear body');
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
    const openai = getOpenAIClient();

    const prompt = SCENE_JUDGE_PROMPT
        .replace('{description}', description)
        .replace('{analysis}', analysisContext || 'No analysis provided')
        .replace('{scene}', JSON.stringify(elements, null, 2));

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from judge');
        }

        const result = JSON.parse(content) as ReflectionResult;
        return {
            isValid: result.isValid ?? result.score >= 7,
            issues: result.issues || [],
            suggestions: result.suggestions || [],
            missingParts: result.missingParts || [],
            score: result.score ?? 5
        };
    } catch (error) {
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
    const openai = getOpenAIClient();

    const prompt = SCENE_FIX_PROMPT
        .replace('{description}', description)
        .replace('{scene}', JSON.stringify(elements, null, 2))
        .replace('{issues}', reflection.issues.join('\n'))
        .replace('{missingParts}', reflection.missingParts.join(', ') || 'None');

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from fixer');
        }

        const parsed = JSON.parse(content);
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
