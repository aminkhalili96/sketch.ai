import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, handleOpenAIError } from '@/lib/openai';
import { SYSTEM_PROMPT, CHAT_REFINEMENT_PROMPT, fillPromptTemplate } from '@/lib/prompts';
import { chatRequestSchema } from '@/lib/validators';
import type { ChatResponse } from '@/types';

function explainEmptyChoice(choice: unknown): string {
    if (!choice || typeof choice !== 'object') return 'AI returned an empty response.';

    const maybeChoice = choice as { finish_reason?: unknown; message?: unknown };
    const finishReason = typeof maybeChoice.finish_reason === 'string' ? maybeChoice.finish_reason : undefined;

    const message = maybeChoice.message;
    const messageObj = message && typeof message === 'object' ? (message as Record<string, unknown>) : null;
    const refusal = messageObj && typeof messageObj.refusal === 'string' ? messageObj.refusal : null;

    if (refusal) return `AI refused to answer: ${refusal}`;
    if (finishReason === 'content_filter') {
        return 'AI response was blocked by safety filters. Try rephrasing your request.';
    }
    if (finishReason) return `AI returned an empty response (finish_reason=${finishReason}).`;
    return 'AI returned an empty response.';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request
        const validationResult = chatRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json<ChatResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            );
        }

        const { message, history, projectContext } = validationResult.data;

        const openai = getOpenAIClient();

        // Build context-aware prompt
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

        // Build message history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextPrompt },
        ];

        // Add conversation history
        for (const msg of history.slice(-10)) { // Keep last 10 messages for context
            messages.push({
                role: msg.role,
                content: msg.content,
            });
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            max_tokens: 2000,
        });

        const firstChoice = response.choices?.[0];
        const reply = firstChoice?.message?.content;
        if (!reply) {
            try {
                const msg = firstChoice?.message as unknown as Record<string, unknown> | undefined;
                const refusal = typeof msg?.refusal === 'string' ? true : false;
                console.warn('Chat: OpenAI returned empty content', {
                    finishReason: (firstChoice as unknown as { finish_reason?: unknown } | undefined)?.finish_reason,
                    hasRefusal: refusal,
                });
            } catch {
                // Ignore logging failures.
            }
            return NextResponse.json<ChatResponse>(
                { success: false, error: explainEmptyChoice(firstChoice) },
                { status: 500 }
            );
        }

        // Analyze response for suggested actions
        const suggestedActions: string[] = [];
        const lowerReply = reply.toLowerCase();
        const lowerMessage = message.toLowerCase();

        // Detect if user asked about 3D model
        if (lowerMessage.includes('3d') || lowerMessage.includes('model') || lowerMessage.includes('teddy') || lowerMessage.includes('bear') || lowerMessage.includes('shape')) {
            suggestedActions.push('Regenerate 3D Model');
        }
        if (lowerReply.includes('update') || lowerReply.includes('modify')) {
            suggestedActions.push('Regenerate affected outputs');
        }
        if (lowerReply.includes('component') || lowerReply.includes('part')) {
            suggestedActions.push('Update Bill of Materials');
        }
        if (lowerReply.includes('code') || lowerReply.includes('firmware')) {
            suggestedActions.push('Regenerate firmware code');
        }

        return NextResponse.json<ChatResponse>({
            success: true,
            reply,
            suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
        });

    } catch (error) {
        console.error('Chat error:', error);

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return NextResponse.json<ChatResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            );
        }

        return NextResponse.json<ChatResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
