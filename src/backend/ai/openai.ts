// LLM Client - Supports both OpenAI and Ollama (local/offline) models
import OpenAI from 'openai';
import {
    DEFAULT_OPENAI_TEXT_MODEL,
    DEFAULT_OPENAI_VISION_MODEL,
    isVisionCapableModel,
    normalizeModelId,
} from '@/shared/ai/modelCatalog';
import { logger } from '@/backend/infra/logger';
import { trackOpenAICall, trackError } from '@/backend/infra/metrics';
import { trackTokenUsage } from '@/backend/infra/tokenTracker';

// Model configuration for offline mode
export const OFFLINE_MODELS: Record<'vision' | 'text', string> = {
    // Vision model for image analysis (Qwen3-VL has best 3D spatial understanding)
    vision: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b',
    // Text model for chat, planning, critique, etc. (DeepSeek has best JSON output)
    text: process.env.OLLAMA_TEXT_MODEL || 'deepseek-coder-v2:16b',
};

// Singleton clients
let openaiClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;
let openaiWrapped = false;
let ollamaWrapped = false;

const MAX_COMPLETION_TOKEN_MODELS: RegExp[] = [
    /^gpt-5(\.|$)/i,
    /^gpt-4\.5(\.|-|$)/i,
];

function requiresMaxCompletionTokens(model?: string): boolean {
    if (!model) return false;
    return MAX_COMPLETION_TOKEN_MODELS.some((pattern) => pattern.test(model));
}

function adjustChatCompletionParams(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    if (isOfflineMode()) return params;
    if (!params?.model) return params;
    if (params.max_completion_tokens != null) return params;
    if (!requiresMaxCompletionTokens(params.model)) return params;

    const { max_tokens, ...rest } = params;
    if (max_tokens == null) return params;

    return {
        ...rest,
        max_completion_tokens: max_tokens,
    };
}

function wrapChatClient(client: OpenAI, marker: 'openai' | 'ollama'): OpenAI {
    const alreadyWrapped = marker === 'openai' ? openaiWrapped : ollamaWrapped;
    if (alreadyWrapped) return client;

    const completions = client.chat.completions;
    const originalCreate = completions.create.bind(completions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    completions.create = ((...args: any[]) => {
        args[0] = adjustChatCompletionParams(args[0]);
        return originalCreate(...(args as Parameters<typeof originalCreate>));
    }) as typeof completions.create;

    if (marker === 'openai') {
        openaiWrapped = true;
    } else {
        ollamaWrapped = true;
    }

    return client;
}

/**
 * Check if offline mode is enabled
 */
export function isOfflineMode(): boolean {
    return process.env.USE_OFFLINE_MODEL === 'true';
}

/**
 * Get the OpenAI client (for online mode)
 */
export function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        const baseURL = process.env.OPENAI_BASE_URL;
        const organization = process.env.OPENAI_ORG_ID;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        openaiClient = new OpenAI({
            apiKey,
            baseURL: baseURL?.trim() || undefined,
            organization: organization?.trim() || undefined,
        });
    }

    return openaiClient;
}

/**
 * Get the Ollama client (for offline mode)
 * Ollama exposes an OpenAI-compatible API at http://localhost:11434/v1
 */
export function getOllamaClient(): OpenAI {
    if (!ollamaClient) {
        const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

        ollamaClient = new OpenAI({
            baseURL,
            apiKey: 'ollama', // Ollama doesn't require an API key, but OpenAI SDK needs one
        });
    }

    return ollamaClient;
}

/**
 * Get the appropriate LLM client based on mode
 */
export function getLLMClient(): OpenAI {
    if (isOfflineMode()) {
        return wrapChatClient(getOllamaClient(), 'ollama');
    }
    return wrapChatClient(getOpenAIClient(), 'openai');
}

/**
 * Get the model name for a given task type
 */
export function getModelName(taskType: 'vision' | 'text', preferredModel?: string): string {
    const selected = normalizeModelId(preferredModel);

    if (isOfflineMode()) {
        if (selected) {
            if (taskType === 'text') {
                return selected;
            }
            if (isVisionCapableModel(selected)) {
                return selected;
            }
        }
        return OFFLINE_MODELS[taskType];
    }

    if (taskType === 'text') {
        if (selected) return selected;
        return process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_OPENAI_TEXT_MODEL;
    }

    if (selected && isVisionCapableModel(selected)) {
        return selected;
    }
    return process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_OPENAI_VISION_MODEL;
}

type UsageTokens = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
};

type OpenAITelemetryContext = {
    requestId?: string;
    source?: string;
    agent?: string;
};

export function recordChatUsage(
    response: unknown,
    model: string,
    context?: OpenAITelemetryContext
): void {
    const usage = (response as { usage?: UsageTokens } | null)?.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    trackOpenAICall(model, true, inputTokens, outputTokens);
    if (usage) {
        trackTokenUsage(model, inputTokens, outputTokens, context?.requestId);
    }

    logger.info('OpenAI call complete', {
        requestId: context?.requestId,
        source: context?.source,
        agent: context?.agent,
        model,
        inputTokens,
        outputTokens,
    });
}

export function recordChatError(
    model: string,
    context?: OpenAITelemetryContext,
    error?: Error
): void {
    trackOpenAICall(model, false, 0, 0);
    trackError('openai', context?.source ?? 'unknown');
    logger.error('OpenAI call failed', {
        requestId: context?.requestId,
        source: context?.source,
        agent: context?.agent,
        model,
    }, error);
}

export function recordTokenUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    context?: OpenAITelemetryContext
): void {
    trackOpenAICall(model, true, inputTokens, outputTokens);
    trackTokenUsage(model, inputTokens, outputTokens, context?.requestId);
    logger.info('OpenAI stream usage', {
        requestId: context?.requestId,
        source: context?.source,
        agent: context?.agent,
        model,
        inputTokens,
        outputTokens,
    });
}

// Helper for error handling
export class OpenAIError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'OpenAIError';
    }
}

export async function handleOpenAIError(error: unknown): Promise<never> {
    if (error instanceof OpenAI.APIError) {
        throw new OpenAIError(
            error.message,
            error.code ?? undefined,
            error.status
        );
    }

    if (error instanceof Error) {
        throw new OpenAIError(error.message);
    }

    throw new OpenAIError('An unknown error occurred');
}

/**
 * Retries an async operation with exponential backoff.
 * @param operation The async operation to retry.
 * @param retries Number of retries (default 3).
 * @param delay Initial delay in ms (default 1000).
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries <= 0) {
            if (error instanceof Error) {
                console.error(`Operation failed after retries: ${error.message}`);
            }
            throw error;
        }

        console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return withRetry(operation, retries - 1, delay * 2);
    }
}
