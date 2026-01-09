// LLM Client - Supports both OpenAI and Ollama (local/offline) models
import OpenAI from 'openai';
import {
    DEFAULT_OPENAI_TEXT_MODEL,
    DEFAULT_OPENAI_VISION_MODEL,
    isVisionCapableModel,
    normalizeModelId,
} from '@/lib/modelCatalog';
import { logger } from '@/lib/logger';
import { trackOpenAICall, trackError } from '@/lib/metrics';
import { trackTokenUsage } from '@/lib/tokenTracker';

// Model configuration for offline mode
export const OFFLINE_MODELS: Record<'vision' | 'text', string> = {
    // Vision model for image analysis
    vision: process.env.OLLAMA_VISION_MODEL || 'llava:7b',
    // Text model for chat, planning, critique, etc.
    text: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',
};

// Singleton clients
let openaiClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;

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
    return isOfflineMode() ? getOllamaClient() : getOpenAIClient();
}

/**
 * Get the model name for a given task type
 */
export function getModelName(taskType: 'vision' | 'text', preferredModel?: string): string {
    if (isOfflineMode()) {
        return OFFLINE_MODELS[taskType];
    }

    const selected = normalizeModelId(preferredModel);

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
