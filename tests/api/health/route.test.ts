/**
 * @vitest-environment node
 */
import { vi, describe, it, expect } from 'vitest';

// Mock the openai module (imported by health route for isOfflineMode)
vi.mock('@/backend/ai/openai', () => ({
    getLLMClient: vi.fn(),
    getModelName: vi.fn(() => 'test-model'),
    isOfflineMode: vi.fn(() => false),
    recordChatUsage: vi.fn(),
    recordChatError: vi.fn(),
    recordTokenUsage: vi.fn(),
}));

import { GET } from '@/app/api/health/route';

function makeRequest(queryString = ''): Request {
    return new Request(`http://localhost:3000/api/health${queryString}`);
}

describe('GET /api/health', () => {
    it('returns 200 with success status', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.status).toBe('ok');
    });

    it('includes timestamp in ISO format', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.timestamp).toBeDefined();
        // Validate ISO date format
        const parsed = new Date(data.timestamp);
        expect(parsed.toISOString()).toBe(data.timestamp);
    });

    it('includes version string', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.version).toBeDefined();
        expect(typeof data.version).toBe('string');
    });

    it('includes uptime as a number', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.uptime).toBeDefined();
        expect(typeof data.uptime).toBe('number');
        expect(data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes memory check in health checks', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.checks).toBeDefined();
        expect(data.checks.memory).toBeDefined();
        expect(['ok', 'warning']).toContain(data.checks.memory);
    });

    it('includes memory details', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.details).toBeDefined();
        expect(data.details.memory).toBeDefined();
        expect(data.details.memory.heapUsed).toBeDefined();
        expect(data.details.memory.heapTotal).toBeDefined();
        expect(data.details.memory.rss).toBeDefined();
    });

    it('sets openai check to unchecked when deep=false', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        expect(data.checks.openai).toBe('unchecked');
    });
});
