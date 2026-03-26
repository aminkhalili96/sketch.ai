/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/backend/pipeline/cadRender', () => ({
    generateCadRender: vi.fn(),
}));

describe('POST /api/render-3d', () => {
    const loadRoute = async () => {
        const module = await import('@/app/api/render-3d/route');
        return module.POST;
    };

    const loadMock = async () => {
        const module = await import('@/backend/pipeline/cadRender');
        return vi.mocked(module.generateCadRender);
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns render and CAD outputs for enclosure specs', async () => {
        const mockGenerateCadRender = await loadMock();
        mockGenerateCadRender.mockResolvedValue({
            renderPngBase64: 'png-base64',
            cadStepBase64: 'step-base64',
            cadStlBase64: 'stl-base64',
        });

        const assemblySpec = JSON.stringify({
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
        });

        const req = new NextRequest('http://localhost:3000/api/render-3d', {
            method: 'POST',
            body: JSON.stringify({
                projectDescription: 'Puck sensor enclosure',
                assemblySpec,
                renderMode: 'exploded',
            }),
        });

        const POST = await loadRoute();
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.renderPngBase64).toBe('png-base64');
        expect(data.cadStepBase64).toBe('step-base64');
        expect(data.cadStlBase64).toBe('stl-base64');
    });

    it('rejects non-enclosure requests', async () => {
        const req = new NextRequest('http://localhost:3000/api/render-3d', {
            method: 'POST',
            body: JSON.stringify({
                projectDescription: 'Teddy bear toy',
            }),
        });

        const POST = await loadRoute();
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(422);
        expect(data.success).toBe(false);
    });
});
