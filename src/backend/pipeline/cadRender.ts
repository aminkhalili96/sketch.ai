import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { AssemblySpec } from '@/backend/pipeline/assemblySpec';

const execFileAsync = promisify(execFile);

export type CadRenderResult = {
    renderPngBase64: string;
    cadStepBase64: string;
    cadStlBase64: string;
};

type RenderMode = 'assembled' | 'exploded';

function resolveScript(relativePath: string) {
    return path.join(process.cwd(), relativePath);
}

function isCommandNotFound(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT') return true;
    const message = error instanceof Error ? error.message : '';
    return message.includes('command not found') || message.includes('ENOENT');
}

export async function generateCadRender(
    spec: AssemblySpec,
    options?: { mode?: RenderMode }
): Promise<CadRenderResult> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sketch-ai-cad-'));
    const specPath = path.join(tempDir, 'assembly_spec.json');
    const cadDir = path.join(tempDir, 'cad');
    const renderPath = path.join(tempDir, 'render.png');
    const mode = options?.mode ?? 'exploded';

    try {
        await mkdir(cadDir, { recursive: true });
        await writeFile(specPath, JSON.stringify(spec, null, 2), 'utf-8');

        const cadScript = resolveScript('scripts/cad/cadquery_generate.py');
        const blenderScript = resolveScript('scripts/cad/blender_render.py');

        const pythonPath = process.env.CADQUERY_PYTHON || 'python3';
        try {
            await execFileAsync(
                pythonPath,
                [cadScript, '--spec', specPath, '--out-dir', cadDir, '--mode', mode],
                { timeout: 120000 }
            );
        } catch (error) {
            if (isCommandNotFound(error)) {
                throw new Error('CadQuery is not installed. Install CadQuery and set CADQUERY_PYTHON if needed.');
            }
            throw error;
        }

        const manifestPath = path.join(cadDir, 'manifest.json');
        const blenderPath = process.env.BLENDER_PATH || 'blender';

        try {
            await execFileAsync(
                blenderPath,
                ['-b', '-P', blenderScript, '--', '--manifest', manifestPath, '--output', renderPath],
                { timeout: 180000 }
            );
        } catch (error) {
            if (isCommandNotFound(error)) {
                throw new Error('Blender is not installed. Install Blender and set BLENDER_PATH if needed.');
            }
            throw error;
        }

        const [pngBuffer, stepBuffer, stlBuffer] = await Promise.all([
            readFile(renderPath),
            readFile(path.join(cadDir, 'assembly.step')),
            readFile(path.join(cadDir, 'assembly.stl')),
        ]);

        return {
            renderPngBase64: pngBuffer.toString('base64'),
            cadStepBase64: stepBuffer.toString('base64'),
            cadStlBase64: stlBuffer.toString('base64'),
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}
