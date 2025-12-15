/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

const mockCreate = vi.fn();
vi.mock('@/lib/openai', () => ({
    getOpenAIClient: () => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }),
    handleOpenAIError: vi.fn()
}));

vi.mock('@/lib/prompts', () => ({
    SYSTEM_PROMPT: 'test-system-prompt',
    VISION_ANALYSIS_PROMPT: 'test-vision-analysis-prompt',
}));

describe('POST /api/analyze', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should normalize partial AI response', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ summary: 'test summary' }) } }]
        });

        const body = { image: 'data:image/png;base64,abc' };
        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.analysis.summary).toBe('test summary');
        expect(data.analysis.identifiedComponents).toEqual([]);
        expect(data.analysis.suggestedFeatures).toEqual([]);
        expect(data.analysis.complexityScore).toBe(5);
        expect(data.analysis.complexity).toBe('moderate');
        expect(data.analysis.questions).toEqual([]);
    });

    it('should reject non-object AI JSON', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify([]) } }]
        });

        const body = { image: 'data:image/png;base64,abc' };
        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
    });

    it('should handle validation errors', async () => {
        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify({})
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
    });

    it('should explain content-filtered empty response', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ finish_reason: 'content_filter', message: { content: null } }]
        });

        const body = { image: 'data:image/png;base64,abc' };
        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(String(data.error)).toContain('safety filters');
    });

    it('should surface AI refusals', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ finish_reason: 'stop', message: { content: null, refusal: 'Cannot comply' } }]
        });

        const body = { image: 'data:image/png;base64,abc' };
        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(String(data.error)).toContain('refused');
    });
});
