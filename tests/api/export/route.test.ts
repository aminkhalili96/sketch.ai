/**
 * @vitest-environment node
 */
import { vi, describe, it, expect } from 'vitest';
import JSZip from 'jszip';

// No LLM calls in export, but we still need to avoid any transitive import issues
vi.mock('@/backend/ai/openai', () => ({
    getLLMClient: vi.fn(),
    getModelName: vi.fn(() => 'test-model'),
    isOfflineMode: vi.fn(() => false),
    recordChatUsage: vi.fn(),
    recordChatError: vi.fn(),
    recordTokenUsage: vi.fn(),
}));

import { POST } from '@/app/api/export/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/export', () => {
    it('returns a ZIP file with valid outputs', async () => {
        const body = {
            projectName: 'Test Project',
            outputs: {
                bom: '| Component | Qty |\n|---|---|\n| ESP32 | 1 |',
                assembly: '## Step 1\nSolder the ESP32.',
            },
        };

        const res = await POST(makeRequest(body));

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/zip');
        expect(res.headers.get('Content-Disposition')).toContain('Test_Project.zip');

        // Verify the ZIP contents
        const arrayBuffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const folder = zip.folder('Test_Project');
        expect(folder).not.toBeNull();

        // Check that BOM file exists in the ZIP
        const bomFile = zip.file('Test_Project/Bill-of-Materials.md');
        expect(bomFile).not.toBeNull();
        const bomContent = await bomFile!.async('string');
        expect(bomContent).toContain('ESP32');

        // Check that assembly file exists
        const assemblyFile = zip.file('Test_Project/Assembly-Instructions.md');
        expect(assemblyFile).not.toBeNull();

        // Check that README exists
        const readmeFile = zip.file('Test_Project/README.md');
        expect(readmeFile).not.toBeNull();
    });

    it('returns validation error with missing projectName', async () => {
        const body = {
            outputs: {
                bom: 'Some BOM content',
            },
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
    });

    it('returns validation error with empty projectName', async () => {
        const body = {
            projectName: '',
            outputs: {
                bom: 'Some BOM content',
            },
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
    });

    it('returns validation error when outputs is missing', async () => {
        const body = {
            projectName: 'My Project',
        };

        const res = await POST(makeRequest(body));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
    });

    it('includes metadata in README when provided', async () => {
        const body = {
            projectName: 'MetaProject',
            outputs: {
                bom: '| Part | Qty |\n|---|---|\n| LED | 5 |',
            },
            metadata: {
                estimatedCost: 25.50,
                complexity: 'moderate',
                buildTime: '2 hours',
            },
        };

        const res = await POST(makeRequest(body));
        expect(res.status).toBe(200);

        const arrayBuffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const readmeFile = zip.file('MetaProject/README.md');
        expect(readmeFile).not.toBeNull();
        const readmeContent = await readmeFile!.async('string');
        expect(readmeContent).toContain('25.5');
        expect(readmeContent).toContain('moderate');
        expect(readmeContent).toContain('2 hours');
    });

    it('includes scene-json as scene_model.json file', async () => {
        const sceneData = JSON.stringify([{ type: 'box', position: [0, 0, 0] }]);
        const body = {
            projectName: 'SceneProject',
            outputs: {
                'scene-json': sceneData,
            },
        };

        const res = await POST(makeRequest(body));
        expect(res.status).toBe(200);

        const arrayBuffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const sceneFile = zip.file('SceneProject/scene_model.json');
        expect(sceneFile).not.toBeNull();
        const content = await sceneFile!.async('string');
        expect(content).toBe(sceneData);
    });

    it('sanitizes special characters in project name', async () => {
        const body = {
            projectName: 'My Project / Special <Name>',
            outputs: {
                bom: 'Some content',
            },
        };

        const res = await POST(makeRequest(body));
        expect(res.status).toBe(200);

        // The filename should be sanitized
        const disposition = res.headers.get('Content-Disposition');
        expect(disposition).not.toContain('/');
        expect(disposition).not.toContain('<');
    });
});
