/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

const mockCreate = vi.fn();
vi.mock('@/lib/openai', () => ({
    getLLMClient: () => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }),
    getModelName: () => 'test-model',
    isOfflineMode: () => false,
    handleOpenAIError: vi.fn()
}));

describe('POST /api/agents/plan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should always include both tasks for 3d-model', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    // Invalid per schema (tasks empty), forcing deterministic normalization fallback
                    content: JSON.stringify({ version: 1, requestedOutputs: ['3d-model'], tasks: [] })
                }
            }]
        });

        const body = {
            message: 'Make the enclosure bigger',
            requestedOutputs: ['3d-model'],
            projectContext: { description: 'Test project' }
        };

        const req = new NextRequest('http://localhost:3000/api/agents/plan', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.plan.requestedOutputs).toEqual(['3d-model']);

        const taskOutputs = data.plan.tasks.map((t: { outputType: string }) => t.outputType).sort();
        expect(taskOutputs).toEqual(['openscad', 'scene-json']);

        const openscadTask = data.plan.tasks.find((t: { outputType: string; dependsOn?: string[] }) => t.outputType === 'openscad');
        expect(openscadTask.dependsOn?.length).toBe(1);
    });

    it('should return 400 on validation error', async () => {
        const req = new NextRequest('http://localhost:3000/api/agents/plan', {
            method: 'POST',
            body: JSON.stringify({ message: 'hi', requestedOutputs: [] })
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
