/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { POST as generatePOST } from '@/app/api/generate/route';
import { POST as compilePOST } from '@/app/api/compile-3d/route';
import { NextRequest } from 'next/server';

// Re-apply mocks needed for both
vi.mock('@/lib/openai', () => ({
    getLLMClient: () => ({
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'cube([10,10,10]);' } }]
                })
            }
        }
    }),
    getModelName: () => 'test-model',
    isOfflineMode: () => false,
    handleOpenAIError: vi.fn(),
    recordChatError: vi.fn(),
    recordChatUsage: vi.fn()
}));

vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
    readFile: vi.fn().mockResolvedValue(Buffer.from('model-stl-data')),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn().mockResolvedValue('/tmp/sketch-ai-3d-test'),
    rm: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('util', () => ({
    promisify: () => async () => {
        return { stdout: '', stderr: '' };
    }
}));


describe('E2E 3D Generation Flow', () => {
    it('should generate and compile a 3D model from user description', async () => {
        // Step 1: User asks for a cube
        const generateBody = {
            projectDescription: 'A custom cube',
            outputTypes: ['openscad']
        };

        const generateReq = new NextRequest('http://localhost:3000/api/generate', {
            method: 'POST',
            body: JSON.stringify(generateBody)
        });

        const generateRes = await generatePOST(generateReq);
        const generateData = await generateRes.json();

        expect(generateData.success).toBe(true);
        const openscadCode = generateData.outputs.openscad;
        expect(openscadCode).toContain('cube');

        // Step 2: Client sends code to compile
        const compileBody = {
            openscadCode,
            format: 'stl'
        };

        const compileReq = new NextRequest('http://localhost:3000/api/compile-3d', {
            method: 'POST',
            body: JSON.stringify(compileBody)
        });

        const compileRes = await compilePOST(compileReq);
        const compileData = await compileRes.json();

        expect(compileData.success).toBe(true);
        expect(compileData.stlBase64).toBeDefined();
    });
});
