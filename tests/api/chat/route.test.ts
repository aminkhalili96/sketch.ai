/**
 * @vitest-environment node
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the openai module
const mockCreate = vi.fn();
vi.mock('@/backend/ai/openai', () => ({
    getLLMClient: vi.fn(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    })),
    getModelName: vi.fn(() => 'test-model'),
    isOfflineMode: vi.fn(() => false),
    handleOpenAIError: vi.fn().mockRejectedValue(new Error('OpenAI error')),
    recordChatUsage: vi.fn(),
    recordChatError: vi.fn(),
    recordTokenUsage: vi.fn(),
}));

// Mock prompt templates
vi.mock('@/backend/ai/prompts', () => ({
    SYSTEM_PROMPT: 'test-system-prompt',
    CHAT_REFINEMENT_PROMPT: 'Refine: {{description}} {{analysis}} {{outputs}} {{message}}',
    fillPromptTemplate: vi.fn((template: string) => template),
}));

import { POST } from '@/app/api/chat/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/chat', () => {
    beforeEach(() => {
        mockCreate.mockReset();
    });

    it('returns a successful chat response with valid request', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'Here is my suggestion for your hardware project.' } }],
            usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        });

        const body = {
            message: 'How can I improve my circuit design?',
            history: [],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.reply).toBe('Here is my suggestion for your hardware project.');
    });

    it('returns validation error with empty message', async () => {
        const body = {
            message: '',
            history: [],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
    });

    it('returns validation error with missing message field', async () => {
        const body = {
            history: [],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
    });

    it('accepts request with project context', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'Updated BOM recommendation.' } }],
            usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        });

        const body = {
            message: 'Add a temperature sensor to the BOM',
            history: [],
            projectContext: {
                description: 'Smart home sensor hub',
                analysis: {
                    identifiedComponents: ['ESP32'],
                    suggestedFeatures: ['WiFi'],
                    complexityScore: 5,
                    complexity: 'moderate',
                    questions: [],
                    summary: 'A sensor hub',
                },
                outputs: {
                    bom: '| Component | Qty |\n|---|---|\n| ESP32 | 1 |',
                },
            },
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.reply).toBeDefined();
    });

    it('includes suggested actions when reply mentions relevant terms', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: 'You should update the component list and add the new part.',
                },
            }],
            usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        });

        const body = {
            message: 'I want to change the 3D model shape',
            history: [],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.suggestedActions).toBeDefined();
        expect(data.suggestedActions!.length).toBeGreaterThan(0);
    });

    it('handles conversation history', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'Follow-up response.' } }],
            usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
        });

        const body = {
            message: 'Tell me more about that',
            history: [
                {
                    id: 'msg-1',
                    role: 'user',
                    content: 'What components do I need?',
                    timestamp: new Date().toISOString(),
                },
                {
                    id: 'msg-2',
                    role: 'assistant',
                    content: 'You need an ESP32 and sensors.',
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('returns error when LLM returns empty content', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: null }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 50, completion_tokens: 0, total_tokens: 50 },
        });

        const body = {
            message: 'Hello',
            history: [],
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('empty response');
    });
});
