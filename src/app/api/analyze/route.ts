import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, handleOpenAIError } from '@/lib/openai';
import { SYSTEM_PROMPT, VISION_ANALYSIS_PROMPT } from '@/lib/prompts';
import { analyzeRequestSchema, analysisResultSchema } from '@/lib/validators';
import type { AnalyzeResponse, AnalysisResult } from '@/types';

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request
        const validationResult = analyzeRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json<AnalyzeResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            );
        }

        const { image, description } = validationResult.data;

        const openai = getOpenAIClient();

        // Build the prompt with optional description
        let userPrompt = VISION_ANALYSIS_PROMPT;
        if (description) {
            userPrompt += `\n\nAdditional context from user: ${description}`;
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
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
            response_format: { type: 'json_object' },
        });

        const firstChoice = response.choices?.[0];
        const content = firstChoice?.message?.content;
        if (!content) {
            try {
                const msg = firstChoice?.message as unknown as Record<string, unknown> | undefined;
                const toolCalls = Array.isArray(msg?.tool_calls) ? msg?.tool_calls.length : 0;
                const refusal = typeof msg?.refusal === 'string' ? true : false;
                console.warn('Analyze: OpenAI returned empty content', {
                    finishReason: (firstChoice as unknown as { finish_reason?: unknown } | undefined)?.finish_reason,
                    hasRefusal: refusal,
                    toolCalls,
                });
            } catch {
                // Ignore logging failures.
            }
            return NextResponse.json<AnalyzeResponse>(
                { success: false, error: explainEmptyChoice(firstChoice) },
                { status: 500 }
            );
        }

        const rawAnalysis = JSON.parse(content);
        const analysisValidation = analysisResultSchema.safeParse(rawAnalysis);
        if (!analysisValidation.success) {
            return NextResponse.json<AnalyzeResponse>(
                { success: false, error: 'AI response did not match expected format' },
                { status: 500 }
            );
        }

        const analysis: AnalysisResult = analysisValidation.data;

        return NextResponse.json<AnalyzeResponse>({
            success: true,
            analysis,
        });

    } catch (error) {
        console.error('Analyze error:', error);

        if (error instanceof SyntaxError) {
            return NextResponse.json<AnalyzeResponse>(
                { success: false, error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return NextResponse.json<AnalyzeResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            );
        }

        return NextResponse.json<AnalyzeResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
