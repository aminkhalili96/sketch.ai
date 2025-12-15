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
