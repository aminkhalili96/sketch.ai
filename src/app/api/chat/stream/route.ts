import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError, isOfflineMode, recordChatError, recordTokenUsage } from '@/lib/openai';
import { SYSTEM_PROMPT, CHAT_REFINEMENT_PROMPT, fillPromptTemplate } from '@/lib/prompts';
import { chatRequestSchema } from '@/lib/validators';
import { createApiContext } from '@/lib/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.ai);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (payload: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };

            try {
                const body = await request.json();

                const validationResult = chatRequestSchema.safeParse(body);
                if (!validationResult.success) {
                    send({ type: 'error', error: validationResult.error.message });
                    controller.close();
                    return;
                }

                const { message, history, projectContext, model } = validationResult.data;
                const llmClient = getLLMClient();
                const modelName = getModelName('text', model);

                const contextPrompt = fillPromptTemplate(CHAT_REFINEMENT_PROMPT, {
                    description: projectContext?.description || 'No project description provided',
                    analysis: projectContext?.analysis
                        ? JSON.stringify(projectContext.analysis, null, 2)
                        : 'No analysis available',
                    outputs: projectContext?.outputs
                        ? `BOM: ${projectContext.outputs.bom ? 'Generated' : 'Not generated'}, Assembly: ${projectContext.outputs.assembly ? 'Generated' : 'Not generated'}, Firmware: ${projectContext.outputs.firmware ? 'Generated' : 'Not generated'}`
                        : 'No outputs generated yet',
                    message,
                });

                const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextPrompt },
                ];

                for (const msg of history.slice(-10)) {
                    messages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                }

                messages.push({ role: 'user', content: message });

                const response = await llmClient.chat.completions.create({
                    model: modelName,
                    messages,
                    max_tokens: 2000,
                    stream: true,
                    ...(isOfflineMode() ? {} : { stream_options: { include_usage: true } }),
                });

                let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

                for await (const chunk of response as AsyncIterable<{
                    choices?: Array<{ delta?: { content?: string } }>;
                    usage?: { prompt_tokens?: number; completion_tokens?: number };
                }>) {
                    const delta = chunk.choices?.[0]?.delta?.content;
                    if (delta) {
                        send({ type: 'delta', text: delta });
                    }
                    if (chunk.usage) {
                        usage = chunk.usage;
                    }
                }

                recordTokenUsage(
                    modelName,
                    usage?.prompt_tokens ?? 0,
                    usage?.completion_tokens ?? 0,
                    { requestId: ctx.requestId, source: 'chat:stream' }
                );

                send({ type: 'done' });
                controller.close();
            } catch (error) {
                let message = 'An unexpected error occurred';
                ctx.logError(error as Error);
                recordChatError(getModelName('text'), { requestId: ctx.requestId, source: 'chat:stream' }, error as Error);
                try {
                    await handleOpenAIError(error);
                } catch (handledError) {
                    message = (handledError as Error).message;
                }
                send({ type: 'error', error: message });
                controller.close();
            }
        },
    });

    const response = new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });

    return ctx.finalize(response);
}
