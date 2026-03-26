import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createApiContext } from '@/backend/infra/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/backend/infra/rateLimit';
import { isOfflineMode } from '@/backend/ai/openai';

const execFileAsync = promisify(execFile);
const GENERIC_MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]{2,120}$/;

type OfflineModelsResponse = {
    success: boolean;
    offlineMode: boolean;
    models?: string[];
    source?: 'ollama-tags' | 'openai-models' | 'ollama-cli' | 'none';
    error?: string;
};

function normalizeModelName(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return GENERIC_MODEL_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function uniqueModels(models: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const model of models) {
        const normalized = normalizeModelName(model);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(normalized);
    }
    return unique.sort((a, b) => a.localeCompare(b));
}

function resolveOllamaBaseUrls() {
    const configured = process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1';
    const openAiCompatBase = configured;
    const ollamaNativeBase = configured.replace(/\/v1\/?$/i, '');
    return { openAiCompatBase, ollamaNativeBase };
}

async function fetchFromOllamaTags(baseUrl: string): Promise<string[]> {
    const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
        throw new Error(`Ollama /api/tags failed with status ${response.status}`);
    }

    const payload = await response.json() as {
        models?: Array<{ name?: unknown; model?: unknown }>;
    };

    const names = (payload.models ?? [])
        .map((entry) => normalizeModelName(entry.name) ?? normalizeModelName(entry.model))
        .filter((model): model is string => Boolean(model));

    return uniqueModels(names);
}

async function fetchFromOpenAIModels(baseUrl: string): Promise<string[]> {
    const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
        throw new Error(`OpenAI-compatible /models failed with status ${response.status}`);
    }

    const payload = await response.json() as {
        data?: Array<{ id?: unknown }>;
    };

    const ids = (payload.data ?? [])
        .map((entry) => normalizeModelName(entry.id))
        .filter((model): model is string => Boolean(model));

    return uniqueModels(ids);
}

async function fetchFromOllamaCli(): Promise<string[]> {
    const { stdout } = await execFileAsync('ollama', ['list']);
    const lines = stdout
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length <= 1) {
        return [];
    }

    const models = lines
        .slice(1)
        .map((line) => line.split(/\s+/g)[0])
        .map((name) => normalizeModelName(name))
        .filter((model): model is string => Boolean(model));

    return uniqueModels(models);
}

export async function GET(request: Request) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.general);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    const { openAiCompatBase, ollamaNativeBase } = resolveOllamaBaseUrls();

    try {
        let models: string[] = [];
        let source: OfflineModelsResponse['source'] = 'none';

        try {
            models = await fetchFromOllamaTags(ollamaNativeBase);
            if (models.length > 0) {
                source = 'ollama-tags';
            }
        } catch {
            // Fallback below.
        }

        if (models.length === 0) {
            try {
                models = await fetchFromOpenAIModels(openAiCompatBase);
                if (models.length > 0) {
                    source = 'openai-models';
                }
            } catch {
                // Fallback below.
            }
        }

        if (models.length === 0) {
            try {
                models = await fetchFromOllamaCli();
                if (models.length > 0) {
                    source = 'ollama-cli';
                }
            } catch {
                // Return empty model list if CLI is unavailable.
            }
        }

        return ctx.finalize(NextResponse.json<OfflineModelsResponse>({
            success: true,
            offlineMode: isOfflineMode(),
            models,
            source,
        }));
    } catch (error) {
        ctx.logError(error as Error);
        return ctx.finalize(NextResponse.json<OfflineModelsResponse>(
            {
                success: false,
                offlineMode: isOfflineMode(),
                error: error instanceof Error ? error.message : 'Failed to load offline models',
            },
            { status: 500 }
        ));
    }
}
