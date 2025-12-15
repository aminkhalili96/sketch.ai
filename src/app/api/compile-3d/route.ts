import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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

        if (!openscadCode || typeof openscadCode !== 'string') {
            return NextResponse.json<CompileResponse>(
                { success: false, error: 'OpenSCAD code is required' },
                { status: 400 }
            );
        }

        // Create temp directory if needed
        const tempDir = path.join(os.tmpdir(), 'sketch-ai-3d');
        await mkdir(tempDir, { recursive: true });

        // Generate unique filenames
        const timestamp = Date.now();
        const scadFile = path.join(tempDir, `model_${timestamp}.scad`);
        const outputFile = path.join(tempDir, `model_${timestamp}.${format}`);

        try {
            // Write OpenSCAD code to temp file
            await writeFile(scadFile, openscadCode, 'utf-8');

            // Compile using OpenSCAD CLI
            // On macOS: /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
            // Or if installed via brew: openscad
            const openscadPath = process.env.OPENSCAD_PATH || 'openscad';

            const { stderr } = await execAsync(
                `"${openscadPath}" -o "${outputFile}" "${scadFile}"`,
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
            // Cleanup on error
            await unlink(scadFile).catch(() => { });
            await unlink(outputFile).catch(() => { });

            const errorMessage = execError instanceof Error ? execError.message : 'Compilation failed';

            // Check if OpenSCAD is not installed
            if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
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
        }

    } catch (error) {
        console.error('Compile 3D error:', error);
        return NextResponse.json<CompileResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
