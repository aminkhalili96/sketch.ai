/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock OpenAI
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

// Mock prompt helpers
vi.mock('@/lib/prompts', () => ({
    SYSTEM_PROMPT: 'test-system-prompt',
    BOM_GENERATION_PROMPT: 'test-bom-prompt',
    ASSEMBLY_INSTRUCTIONS_PROMPT: 'test-assembly-prompt',
    FIRMWARE_GENERATION_PROMPT: 'test-firmware-prompt',
    OPENSCAD_GENERATION_PROMPT: 'test-openscad-prompt',
    SCENE_GENERATION_PROMPT: 'test-scene-prompt',
    fillPromptTemplate: (t: string) => t,
}));

describe('POST /api/generate', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        vi.clearAllMocks();
    });

    it('should generate requested outputs', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'mock-openscad-code' } }]
        });

        const body = {
            projectDescription: 'A simple cube',
            outputTypes: ['openscad']
        };

        const req = new NextRequest('http://localhost:3000/api/generate', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.outputs.openscad).toBe('mock-openscad-code');
        expect(data.metadata).toBeDefined();
    });

    it('should tolerate partial analysisContext', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'mock-openscad-code' } }]
        });

        const body = {
            projectDescription: 'A simple cube',
            analysisContext: { summary: 'cube sketch' },
            outputTypes: ['openscad']
        };

        const req = new NextRequest('http://localhost:3000/api/generate', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('should handle validation errors', async () => {
        const body = {
            projectDescription: '' // Invalid
        };

        const req = new NextRequest('http://localhost:3000/api/generate', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
    });

    it('should generate valid scene-json output', async () => {
        const planResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        elements: [
                            {
                                type: 'box',
                                position: [0, 0, 0],
                                rotation: [0, 0, 0],
                                dimensions: [10, 2, 10],
                                color: '#333333',
                                material: 'plastic',
                                name: 'base'
                            }
                        ]
                    })
                }
            }]
        };

        const critiqueResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        score: 8,
                        isAcceptable: true,
                        matchesInput: true,
                        issues: [],
                        missingParts: [],
                        extraneousParts: [],
                        colorIssues: [],
                        proportionIssues: [],
                        summary: 'Looks good'
                    })
                }
            }]
        };

        mockCreate
            .mockResolvedValueOnce(planResponse)
            .mockResolvedValueOnce(critiqueResponse)
            .mockResolvedValueOnce(critiqueResponse);

        const body = {
            projectDescription: 'A simple cube',
            outputTypes: ['scene-json']
        };

        const req = new NextRequest('http://localhost:3000/api/generate', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(typeof data.outputs['scene-json']).toBe('string');

        const parsed = JSON.parse(data.outputs['scene-json']);
        expect(Array.isArray(parsed)).toBe(true);
        expect(['box', 'rounded-box', 'sphere', 'capsule', 'cylinder']).toContain(parsed[0].type);
    });
});
