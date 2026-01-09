import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, isOfflineMode, handleOpenAIError, recordChatError, recordChatUsage } from '@/lib/openai';
import { DESCRIPTION_ANALYSIS_PROMPT, SYSTEM_PROMPT, VISION_ANALYSIS_PROMPT } from '@/lib/prompts';
import { analyzeRequestSchema, analysisResultSchema } from '@/lib/validators';
import type { AnalyzeResponse, AnalysisResult } from '@/types';
import { createApiContext } from '@/lib/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/lib/rateLimit';

function explainEmptyChoice(choice: unknown): string {
    if (!choice || typeof choice !== 'object') return 'AI returned an empty response.';

    const maybeChoice = choice as { finish_reason?: unknown; message?: unknown };
    const finishReason = typeof maybeChoice.finish_reason === 'string' ? maybeChoice.finish_reason : undefined;

    const message = maybeChoice.message;
    const messageObj = message && typeof message === 'object' ? (message as Record<string, unknown>) : null;
    const refusal = messageObj && typeof messageObj.refusal === 'string' ? messageObj.refusal : null;
    const toolCalls = messageObj && Array.isArray(messageObj.tool_calls) ? messageObj.tool_calls : null;

    if (refusal) return `AI refused to answer: ${refusal}`;

    if (finishReason === 'content_filter') {
        return 'AI response was blocked by safety filters. Try a different image or provide more context.';
    }

    if (toolCalls && toolCalls.length > 0) {
        return 'AI attempted to call tools, but tool calls are not enabled for this request. Please try again.';
    }

    if (finishReason) return `AI returned an empty response (finish_reason=${finishReason}).`;
    return 'AI returned an empty response.';
}

type OpenAIClient = ReturnType<typeof getLLMClient>;

function extractJsonCandidate(content: string): string[] {
    const trimmed = content.trim();
    const candidates = new Set<string>();

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
        candidates.add(fenceMatch[1].trim());
    }

    if (trimmed) {
        candidates.add(trimmed);
    }

    const objStart = trimmed.indexOf('{');
    const objEnd = trimmed.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
        candidates.add(trimmed.slice(objStart, objEnd + 1));
    }

    return Array.from(candidates);
}

function tryParseJson(content: string): unknown | null {
    const candidates = extractJsonCandidate(content);
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {
            // Try the next candidate.
        }
    }
    return null;
}

async function analyzeFromDescription(
    openai: OpenAIClient,
    description: string,
    preferredModel?: string,
    telemetry?: { requestId?: string }
): Promise<AnalysisResult | null> {
    try {
        const modelName = getModelName('text', preferredModel);
        const response = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `${DESCRIPTION_ANALYSIS_PROMPT}\n\nDescription: ${description}`
                }
            ],
            max_tokens: 1500,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
        });

        recordChatUsage(response, modelName, { requestId: telemetry?.requestId, source: 'analyze:description' });

        const content = response.choices?.[0]?.message?.content;
        if (!content) return null;

        const rawAnalysis = tryParseJson(content);
        if (!rawAnalysis) return null;
        const analysisValidation = analysisResultSchema.safeParse(rawAnalysis);
        if (!analysisValidation.success) return null;

        return analysisValidation.data;
    } catch (error) {
        recordChatError(getModelName('text', preferredModel), { requestId: telemetry?.requestId, source: 'analyze:description' }, error as Error);
        console.warn('Analyze: description-only analysis failed', error);
        return null;
    }
}

function buildLocalFallback(description?: string): AnalysisResult {
    const trimmed = description?.trim() ?? '';
    const shortDescription =
        trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;

    if (!shortDescription) {
        return analysisResultSchema.parse({
            identifiedComponents: [],
            suggestedFeatures: [],
            complexityScore: 3,
            complexity: 'simple',
            questions: [
                'Can you add a short description of the sketch?',
                'What electronics or interactivity do you want?',
                'Any size or material constraints?'
            ],
            summary: 'Image analysis was unavailable. Add a short description to continue.'
        });
    }

    return analysisResultSchema.parse({
        identifiedComponents: [],
        suggestedFeatures: ['Consider adding sensors or outputs if interactivity is needed.'],
        complexityScore: 4,
        complexity: 'moderate',
        questions: [
            'What size should the final object be?',
            'Any required electronics, sensors, or motion?',
            'Preferred materials or finish?'
        ],
        summary: `Based on the description, this appears to be ${shortDescription}. Image analysis was unavailable.`
    });
}

async function buildFallbackAnalysis(
    openai: OpenAIClient,
    description?: string,
    preferredModel?: string,
    telemetry?: { requestId?: string }
): Promise<AnalysisResult> {
    const trimmed = description?.trim() ?? '';
    if (trimmed) {
        const descriptionOnly = await analyzeFromDescription(openai, trimmed, preferredModel, telemetry);
        if (descriptionOnly) return descriptionOnly;
    }

    return buildLocalFallback(description);
}

export async function POST(request: NextRequest) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.analyze);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    try {
        const body = await request.json();

        // Validate request
        const validationResult = analyzeRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return ctx.finalize(NextResponse.json<AnalyzeResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            ));
        }

        const { image, description, model } = validationResult.data;

        const openai = getLLMClient();
        const visionModel = getModelName('vision', model);

        // Build the prompt with optional description
        let userPrompt = VISION_ANALYSIS_PROMPT;
        if (description) {
            userPrompt += `\n\nAdditional context from user: ${description}`;
        }

        const response = await openai.chat.completions.create({
            model: visionModel,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
                                detail: 'high',
                            },
                        },
                    ],
                },
            ],
            max_tokens: 2000,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
        });

        recordChatUsage(response, visionModel, { requestId: ctx.requestId, source: 'analyze:vision' });

        const firstChoice = response.choices?.[0];
        const content = firstChoice?.message?.content;
        if (!content) {
            const reason = explainEmptyChoice(firstChoice);
            try {
                const msg = firstChoice?.message as unknown as Record<string, unknown> | undefined;
                const toolCalls = Array.isArray(msg?.tool_calls) ? msg?.tool_calls.length : 0;
                const refusal = typeof msg?.refusal === 'string' ? true : false;
                console.warn('Analyze: OpenAI returned empty content', {
                    finishReason: (firstChoice as unknown as { finish_reason?: unknown } | undefined)?.finish_reason,
                    hasRefusal: refusal,
                    toolCalls,
                    reason
                });
            } catch {
                // Ignore logging failures.
            }
            const fallbackAnalysis = await buildFallbackAnalysis(openai, description, model, { requestId: ctx.requestId });
            return ctx.finalize(NextResponse.json<AnalyzeResponse>({
                success: true,
                analysis: fallbackAnalysis
            }));
        }

        const rawAnalysis = tryParseJson(content);
        if (!rawAnalysis) {
            if (isOfflineMode()) {
                const fallbackAnalysis = await buildFallbackAnalysis(openai, description, model, { requestId: ctx.requestId });
                return ctx.finalize(NextResponse.json<AnalyzeResponse>({
                    success: true,
                    analysis: fallbackAnalysis
                }));
            }
            return ctx.finalize(NextResponse.json<AnalyzeResponse>(
                { success: false, error: 'Failed to parse AI response' },
                { status: 500 }
            ));
        }
        const analysisValidation = analysisResultSchema.safeParse(rawAnalysis);
        if (!analysisValidation.success) {
            if (isOfflineMode()) {
                const fallbackAnalysis = await buildFallbackAnalysis(openai, description, model, { requestId: ctx.requestId });
                return ctx.finalize(NextResponse.json<AnalyzeResponse>({
                    success: true,
                    analysis: fallbackAnalysis
                }));
            }
            return ctx.finalize(NextResponse.json<AnalyzeResponse>(
                { success: false, error: 'AI response did not match expected format' },
                { status: 500 }
            ));
        }

        const analysis: AnalysisResult = analysisValidation.data;

        return ctx.finalize(NextResponse.json<AnalyzeResponse>({
            success: true,
            analysis,
        }));

    } catch (error) {
        console.error('Analyze error:', error);
        ctx.logError(error as Error);

        if (error instanceof SyntaxError) {
            return ctx.finalize(NextResponse.json<AnalyzeResponse>(
                { success: false, error: 'Failed to parse AI response' },
                { status: 500 }
            ));
        }

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return ctx.finalize(NextResponse.json<AnalyzeResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            ));
        }

        return ctx.finalize(NextResponse.json<AnalyzeResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        ));
    }
}
