import OpenAI from 'openai';

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        openaiClient = new OpenAI({
            apiKey,
        });
    }

    return openaiClient;
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
