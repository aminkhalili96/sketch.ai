/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/models/offline/route';

vi.mock('@/backend/ai/openai', () => ({
    isOfflineMode: () => true,
}));

describe('GET /api/models/offline', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns installed models from Ollama tags endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                models: [
                    { name: 'qwen3-vl:8b' },
                    { name: 'llava:7b' },
                ],
            }),
        });
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const res = await GET(new Request('http://localhost:3000/api/models/offline'));
        const data = await res.json() as {
            success: boolean;
            source?: string;
            models?: string[];
            offlineMode?: boolean;
        };

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.offlineMode).toBe(true);
        expect(data.source).toBe('ollama-tags');
        expect(data.models).toEqual(['llava:7b', 'qwen3-vl:8b']);
    });
});
