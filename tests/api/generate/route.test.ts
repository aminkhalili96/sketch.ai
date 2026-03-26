/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/generate/route';
import { NextRequest } from 'next/server';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('@/backend/ai/openai', () => ({
    getLLMClient: () => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }),
    getModelName: () => 'test-model',
    isOfflineMode: () => false,
    handleOpenAIError: vi.fn(),
    recordChatError: vi.fn(),
    recordChatUsage: vi.fn()
}));

// Mock prompt helpers
vi.mock('@/backend/ai/prompts', () => ({
    SYSTEM_PROMPT: 'test-system-prompt',
    ASSEMBLY_SPEC_PROMPT: 'test-assembly-spec-prompt',
    ASSEMBLY_SPEC_REFINE_PROMPT: 'test-assembly-refine-prompt',
    BOM_GENERATION_PROMPT: 'test-bom-prompt',
    ASSEMBLY_INSTRUCTIONS_PROMPT: 'test-assembly-prompt',
    FIRMWARE_GENERATION_PROMPT: 'test-firmware-prompt',
    OPENSCAD_GENERATION_PROMPT: 'test-openscad-prompt',
    OPENSCAD_OBJECT_PROMPT: 'test-openscad-object-prompt',
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
            choices: [{
                message: {
                    content: JSON.stringify({
                        version: 1,
                        units: 'mm',
                        kind: 'enclosure',
                        enclosure: {
                            shape: 'round',
                            width: 100,
                            depth: 100,
                            height: 30,
                            wall: 2,
                            cornerRadius: 8,
                            topHeight: 16,
                            bottomHeight: 10,
                            gap: 4,
                            material: 'plastic',
                            colorTop: '#B9B2A8',
                            colorBottom: '#8F8983',
                            colorAccent: '#6F6A64',
                        },
                        pcb: {
                            shape: 'round',
                            width: 80,
                            depth: 80,
                            thickness: 2,
                            offsetY: 0,
                            color: '#C9A571',
                        },
                        ports: [],
                        components: [],
                        view: { explodedGap: 18 },
                    })
                }
            }]
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
        expect(data.outputs.openscad).toContain('module enclosure_parts');
        expect(data.metadata).toBeDefined();
    });

    it('should tolerate partial analysisContext', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        version: 1,
                        units: 'mm',
                        kind: 'enclosure',
                        enclosure: {
                            shape: 'rect',
                            width: 110,
                            depth: 78,
                            height: 28,
                            wall: 2,
                            cornerRadius: 8,
                            topHeight: 16,
                            bottomHeight: 10,
                            gap: 4,
                            material: 'plastic',
                            colorTop: '#B9B2A8',
                            colorBottom: '#8F8983',
                            colorAccent: '#6F6A64',
                        },
                        pcb: {
                            shape: 'rect',
                            width: 90,
                            depth: 64,
                            thickness: 2,
                            offsetY: 0,
                            color: '#C9A571',
                        },
                        ports: [],
                        components: [],
                        view: { explodedGap: 18 },
                    })
                }
            }]
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
                        version: 1,
                        units: 'mm',
                        kind: 'enclosure',
                        enclosure: {
                            shape: 'round',
                            width: 100,
                            depth: 100,
                            height: 30,
                            wall: 2,
                            cornerRadius: 8,
                            topHeight: 16,
                            bottomHeight: 10,
                            gap: 4,
                            material: 'plastic',
                            colorTop: '#B9B2A8',
                            colorBottom: '#8F8983',
                            colorAccent: '#6F6A64',
                        },
                        pcb: {
                            shape: 'round',
                            width: 80,
                            depth: 80,
                            thickness: 2,
                            offsetY: 0,
                            color: '#C9A571',
                        },
                        ports: [],
                        components: [],
                        view: { explodedGap: 18 },
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
