/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock fs/promises
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('mock-stl-content'));
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockMkdtemp = vi.fn().mockResolvedValue('/tmp/sketch-ai-3d-test');
const mockRm = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => ({
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    mkdtemp: (...args: unknown[]) => mockMkdtemp(...args),
    rm: (...args: unknown[]) => mockRm(...args),
}));

// We need to mock util.promisify because the route uses promisify(execFile) at module load.
// vitest hoists vi.mock calls, so we use vi.hoisted to define the mock fn before it's referenced.
const { mockExecFileAsync } = vi.hoisted(() => {
    return { mockExecFileAsync: vi.fn() };
});

vi.mock('child_process', () => ({
    execFile: vi.fn(),
}));

vi.mock('util', () => ({
    promisify: () => mockExecFileAsync,
}));

// Import the route after mocks are set up
import { POST } from '@/app/api/compile-3d/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/compile-3d', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/compile-3d', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
        mockReadFile.mockResolvedValue(Buffer.from('mock-stl-content'));
        mockMkdtemp.mockResolvedValue('/tmp/sketch-ai-3d-test');
    });

    it('validates that openscadCode is required', async () => {
        const res = await POST(makeRequest({}));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('required');
    });

    it('validates that openscadCode must be a string', async () => {
        const res = await POST(makeRequest({ openscadCode: 123 }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
    });

    it('rejects invalid export format', async () => {
        const res = await POST(makeRequest({
            openscadCode: 'cube([10,10,10]);',
            format: 'exe',
        }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('format');
    });

    it('rejects overly large OpenSCAD code', async () => {
        const largeCode = 'x'.repeat(300_001);
        const res = await POST(makeRequest({
            openscadCode: largeCode,
        }));
        const data = await res.json();

        expect(res.status).toBe(413);
        expect(data.success).toBe(false);
        expect(data.error).toContain('too large');
    });

    it('compiles valid openscad code to STL', async () => {
        const res = await POST(makeRequest({
            openscadCode: 'cube([10,10,10]);',
            format: 'stl',
        }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.stlBase64).toBe(Buffer.from('mock-stl-content').toString('base64'));
    });

    it('returns appropriate error when OpenSCAD is not installed (ENOENT)', async () => {
        const err = new Error('spawn openscad ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        mockExecFileAsync.mockRejectedValue(err);

        const res = await POST(makeRequest({
            openscadCode: 'cube([10,10,10]);',
        }));
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('not installed');
    });

    it('returns error when OpenSCAD compilation fails', async () => {
        mockExecFileAsync.mockRejectedValue(
            new Error('OpenSCAD compilation failed: ERROR: syntax error')
        );

        const res = await POST(makeRequest({
            openscadCode: 'invalid_code();',
        }));
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
    });

    it('accepts valid 3mf format', async () => {
        const res = await POST(makeRequest({
            openscadCode: 'cube([10,10,10]);',
            format: '3mf',
        }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('accepts valid off format', async () => {
        const res = await POST(makeRequest({
            openscadCode: 'sphere(r=5);',
            format: 'off',
        }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('cleans up temp directory even on failure', async () => {
        mockExecFileAsync.mockRejectedValue(new Error('compilation failed'));

        await POST(makeRequest({
            openscadCode: 'bad_code();',
        }));

        // rm should be called to clean up the temp directory
        expect(mockRm).toHaveBeenCalled();
    });
});
