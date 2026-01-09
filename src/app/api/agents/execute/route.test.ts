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
    recordChatUsage: vi.fn(),
    recordChatError: vi.fn()
}));

vi.mock('@/lib/metrics', () => ({
    __esModule: true,
    trackAgentExecution: vi.fn(),
    trackError: vi.fn(),
    trackRequest: vi.fn(),
    default: {
        trackAgentExecution: vi.fn(),
        trackError: vi.fn(),
        trackRequest: vi.fn()
    }
}));

// Mock apiContext to avoid redis
vi.mock('@/lib/apiContext', () => ({
    createApiContext: () => ({
        rateLimitResponse: null,
        finalize: (res: Response) => res,
        logError: vi.fn(),
        requestId: 'test-req-id'
    })
}));

describe('POST /api/agents/execute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should only execute tasks for explicitly requested outputs', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: '| Item | Qty |\n|---|---|\n| Resistor | 1 |' } }]
        });

        const body = {
            plan: {
                version: 1,
                requestedOutputs: ['bom'],
                tasks: [
                    { id: 't1', agent: 'BOMAgent', outputType: 'bom', action: 'update', instruction: 'Add a resistor' },
                    { id: 't2', agent: 'FirmwareAgent', outputType: 'firmware', action: 'update', instruction: 'Do not run' },
                ],
            },
            projectContext: {
                description: 'Test project',
                outputs: {
                    bom: '| old |',
                    firmware: 'old firmware'
                }
            }
        };

        const req = new NextRequest('http://localhost:3000/api/agents/execute', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.updatedOutputs.bom).toContain('Resistor');
        expect(data.updatedOutputs.firmware).toBeUndefined();
    });

    it('should preserve LLM-generated scene colors', async () => {
        mockCreate
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            elements: [
                                {
                                    type: 'box',
                                    position: [0, 0, 0],
                                    rotation: [0, 0, 0],
                                    dimensions: [10, 2, 10],
                                    color: '#8B4513',
                                    material: 'plastic',
                                    name: 'body'
                                }
                            ]
                        })
                    }
                }]
            })
            .mockResolvedValueOnce({
                choices: [{ message: { content: '// Project: test\ncube([10,10,10]);' } }]
            });

        const body = {
            plan: {
                version: 1,
                requestedOutputs: ['3d-model'],
                tasks: [
                    { id: 't1', agent: 'SceneJsonAgent', outputType: 'scene-json', action: 'regenerate', instruction: 'Make it nicer' },
                    { id: 't2', agent: 'OpenSCADAgent', outputType: 'openscad', action: 'regenerate', instruction: 'Make it nicer', dependsOn: ['t1'] },
                ],
            },
            projectContext: {
                description: 'test',
                outputs: {}
            }
        };

        const req = new NextRequest('http://localhost:3000/api/agents/execute', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);

        const scene = data.updatedOutputs['scene-json'];
        expect(scene).toContain('#8B4513');
        expect(data.updatedOutputs.openscad).toContain('cube');
    });

    it('should return a fallback scene if the model call fails', async () => {
        mockCreate.mockRejectedValueOnce(new Error('OpenAI down'));

        const body = {
            plan: {
                version: 1,
                requestedOutputs: ['3d-model'],
                tasks: [
                    { id: 't1', agent: 'SceneJsonAgent', outputType: 'scene-json', action: 'regenerate', instruction: 'Make it nicer' },
                ],
            },
            projectContext: {
                description: 'test',
                outputs: {}
            }
        };

        const req = new NextRequest('http://localhost:3000/api/agents/execute', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.updatedOutputs['scene-json']).toContain('enclosure-body');
    });
});
