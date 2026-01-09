import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);
const MAX_OPENSCAD_CHARS = 300_000;
const ALLOWED_FORMATS = new Set(['stl', 'off', '3mf']);

interface CompileRequest {
    openscadCode: string;
    format?: 'stl' | 'off' | '3mf';
}

interface CompileResponse {
    success: boolean;
    stlBase64?: string;
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: CompileRequest = await request.json();
        const { openscadCode, format = 'stl' } = body;
        const normalizedFormat =
            typeof format === 'string' ? format.toLowerCase() : 'stl';

        if (!openscadCode || typeof openscadCode !== 'string') {
            return NextResponse.json<CompileResponse>(
                { success: false, error: 'OpenSCAD code is required' },
                { status: 400 }
            );
        }

        if (!ALLOWED_FORMATS.has(normalizedFormat)) {
            return NextResponse.json<CompileResponse>(
                { success: false, error: 'Invalid export format requested' },
                { status: 400 }
            );
        }

        if (openscadCode.length > MAX_OPENSCAD_CHARS) {
            return NextResponse.json<CompileResponse>(
                { success: false, error: 'OpenSCAD code is too large to compile' },
                { status: 413 }
            );
        }

        const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sketch-ai-3d-'));

        // Generate unique filenames
        const timestamp = Date.now();
        const scadFile = path.join(tempDir, `model_${timestamp}.scad`);
        const outputFile = path.join(tempDir, `model_${timestamp}.${normalizedFormat}`);

        try {
            // Write OpenSCAD code to temp file
            await writeFile(scadFile, openscadCode, 'utf-8');

            // Compile using OpenSCAD CLI
            // On macOS: /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
            // Or if installed via brew: openscad
            const openscadPath = process.env.OPENSCAD_PATH || 'openscad';

            const { stderr } = await execFileAsync(
                openscadPath,
                ['-o', outputFile, scadFile],
                { timeout: 60000 } // 60 second timeout
            );

            if (stderr && stderr.includes('ERROR')) {
                throw new Error(`OpenSCAD compilation failed: ${stderr}`);
            }

            // Read the compiled file
            const stlBuffer = await readFile(outputFile);
            const stlBase64 = stlBuffer.toString('base64');

            // Cleanup temp files
            await unlink(scadFile).catch(() => { });
            await unlink(outputFile).catch(() => { });

            return NextResponse.json<CompileResponse>({
                success: true,
                stlBase64,
            });

        } catch (execError) {
            const errorMessage = execError instanceof Error ? execError.message : 'Compilation failed';
            const errorCode = (execError as NodeJS.ErrnoException | null)?.code;

            // Check if OpenSCAD is not installed
            if (errorCode === 'ENOENT' || errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
                return NextResponse.json<CompileResponse>(
                    {
                        success: false,
                        error: 'OpenSCAD is not installed. Install via: brew install openscad'
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json<CompileResponse>(
                { success: false, error: errorMessage },
                { status: 500 }
            );
        } finally {
            await rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }

    } catch (error) {
        console.error('Compile 3D error:', error);
        return NextResponse.json<CompileResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
