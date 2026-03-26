'use client';

import Image from 'next/image';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/frontend/components/ui/button';
import { SceneRenderer } from '@/frontend/components/SceneRenderer';
import { getDemoSceneJson } from '@/frontend/lib/demoPresets';
import type { ProjectOutputs } from '@/shared/types';
import type { DemoPreset } from '@/frontend/lib/demoPresets';

interface ThreeDTabProps {
    outputs: ProjectOutputs;
    currentProject: {
        name?: string;
        description?: string;
        analysis?: { summary?: string } | null;
    } | null;
    demoPreset: DemoPreset | null;
    effectiveIsExploded: boolean;
    isLockedHero: boolean;
    heroView: DemoPreset['heroView'];
    isExploded: boolean;
    setIsExploded: (fn: (prev: boolean) => boolean) => void;
    isGenerating: boolean;
    isCompiling: boolean;
    isRendering: boolean;
    stlDownloadUrl: string | null;
    copiedTab: string | null;
    handleGenerate: (types: ('bom' | 'assembly' | 'firmware' | 'schematic' | 'openscad')[]) => void;
    handleCompile3D: () => void;
    handleDownloadSTL: () => void;
    handleGenerateRender: () => void;
    handleCopy: (content: string, tabId: string) => void;
    downloadDataUrl: (dataUrl: string, filename: string) => void;
    hideScenePreview?: boolean;
}

export function ThreeDTab({
    outputs,
    currentProject,
    demoPreset,
    effectiveIsExploded,
    isLockedHero,
    heroView,
    isExploded: _isExploded,
    setIsExploded,
    isGenerating,
    isCompiling,
    isRendering,
    stlDownloadUrl,
    copiedTab,
    handleGenerate,
    handleCompile3D,
    handleDownloadSTL,
    handleGenerateRender,
    handleCopy,
    downloadDataUrl,
    hideScenePreview,
}: ThreeDTabProps) {
    const openscadCode = outputs.openscad;
    const sceneJson = outputs['scene-json'];
    const renderImage = outputs['render-png'];
    const cadStep = outputs['cad-step'];
    const cadStl = outputs['cad-stl'];
    const demoSceneJson = demoPreset
        ? getDemoSceneJson(demoPreset.id, effectiveIsExploded ? 'exploded' : 'assembled')
        : null;
    const activeSceneJson = demoSceneJson ?? sceneJson;

    const renderSection = (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-neutral-900">Photoreal Render</p>
                    <p className="text-xs text-neutral-500">Cycles render from CAD geometry.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleGenerateRender}
                        disabled={isRendering || (!currentProject?.analysis && !currentProject?.description)}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        aria-label="Generate photoreal render"
                    >
                        {isRendering ? 'Rendering...' : 'Generate Photoreal Render'}
                    </Button>
                    {renderImage && (
                        <Button
                            onClick={() => downloadDataUrl(renderImage, `${currentProject?.name || 'render'}.png`)}
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            aria-label="Download render image"
                        >
                            Download Render
                        </Button>
                    )}
                </div>
            </div>

            {renderImage ? (
                <div className="rounded-xl border border-neutral-200 bg-background p-3">
                    <Image
                        src={renderImage}
                        alt="Photoreal render"
                        width={1200}
                        height={900}
                        className="w-full h-auto"
                        unoptimized
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                        {cadStep && (
                            <Button
                                onClick={() => downloadDataUrl(cadStep, `${currentProject?.name || 'model'}.step`)}
                                variant="outline"
                                size="sm"
                                aria-label="Download STEP file"
                            >
                                Download STEP
                            </Button>
                        )}
                        {cadStl && (
                            <Button
                                onClick={() => downloadDataUrl(cadStl, `${currentProject?.name || 'model'}.stl`)}
                                variant="outline"
                                size="sm"
                                aria-label="Download STL file"
                            >
                                Download STL
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                    Generate a photoreal render to see a high-quality product image.
                </div>
            )}
        </div>
    );

    if (activeSceneJson) {
        return (
            <div className="space-y-6">
                {renderSection}
                {!hideScenePreview && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-medium text-neutral-900">3D Preview</p>
                                <p className="text-xs text-neutral-500">Toggle exploded view to inspect parts.</p>
                            </div>
                            <Button
                                onClick={() => setIsExploded((prev) => !prev)}
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                disabled={isLockedHero}
                                aria-label={isLockedHero ? 'Exploded view locked' : effectiveIsExploded ? 'Switch to compact view' : 'Switch to exploded view'}
                            >
                                {isLockedHero ? 'Exploded View (Locked)' : (effectiveIsExploded ? 'Compact View' : 'Exploded View')}
                            </Button>
                        </div>

                        <SceneRenderer
                            sceneJson={activeSceneJson}
                            exploded={demoSceneJson ? false : effectiveIsExploded}
                            mode={demoPreset ? 'presentation' : 'default'}
                            showToolbar={!isLockedHero}
                            lockControls={isLockedHero}
                            initialView={heroView ? {
                                position: heroView.cameraPosition,
                                target: heroView.cameraTarget,
                                fov: heroView.fov,
                            } : undefined}
                            forcedEnvironment={heroView?.environment}
                            forcedBackground={heroView?.background}
                        />
                    </>
                )}

                <div className="flex gap-2 flex-wrap items-center justify-between border-t border-neutral-100 pt-4">
                    <h3 className="text-sm font-medium text-neutral-900">OpenSCAD Source</h3>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleCompile3D}
                            disabled={isCompiling}
                            size="sm"
                            variant="outline"
                            aria-label={isCompiling ? 'Compiling STL' : 'Compile to STL'}
                        >
                            {isCompiling ? 'Compiling STL...' : 'Compile to STL'}
                        </Button>
                        {stlDownloadUrl && (
                            <Button
                                onClick={handleDownloadSTL}
                                variant="outline"
                                className="border-green-500 text-green-600 hover:bg-green-50 rounded-xl"
                                aria-label="Download compiled STL file"
                            >
                                Download STL
                            </Button>
                        )}
                    </div>
                </div>

                {openscadCode && (
                    <div className="mt-4">
                        <details className="text-xs text-neutral-500">
                            <summary className="cursor-pointer hover:text-neutral-700 mb-2">Show OpenSCAD Code</summary>
                            <SyntaxHighlighter
                                language="openscad"
                                style={oneLight}
                                customStyle={{
                                    margin: 0,
                                    borderRadius: '0.75rem',
                                    background: '#fafafa',
                                    fontSize: '13px',
                                }}
                                showLineNumbers
                            >
                                {openscadCode}
                            </SyntaxHighlighter>
                        </details>
                    </div>
                )}
            </div>
        );
    }

    if (!openscadCode) {
        return (
            <div className="space-y-6">
                {renderSection}
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-neutral-400 text-sm">No 3D model generated yet</p>
                    <Button
                        onClick={() => handleGenerate(['openscad'])}
                        disabled={isGenerating || (!currentProject?.analysis && !currentProject?.description)}
                        variant="outline"
                        className="mt-4 rounded-xl border-neutral-200"
                        aria-label="Generate 3D model"
                    >
                        Generate 3D Model
                    </Button>
                </div>
            </div>
        );
    }

    // Classic OpenSCAD-only view (no scene JSON available)
    return (
        <div className="space-y-4">
            {renderSection}
            <div className="flex gap-2 flex-wrap">
                <Button
                    onClick={handleCompile3D}
                    disabled={isCompiling}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    aria-label={isCompiling ? 'Compiling STL' : 'Compile to STL'}
                >
                    {isCompiling ? 'Compiling...' : 'Compile to STL'}
                </Button>
                {stlDownloadUrl && (
                    <Button
                        onClick={handleDownloadSTL}
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 rounded-xl"
                        aria-label="Download compiled STL file"
                    >
                        Download STL
                    </Button>
                )}
                <button
                    onClick={() => {
                        const blob = new Blob([openscadCode], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentProject?.name || 'model'}.scad`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-xs text-purple-700 transition-colors"
                    aria-label="Download OpenSCAD file"
                >
                    Download .scad
                </button>
                <button
                    onClick={() => handleCopy(openscadCode, 'openscad')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-600 transition-colors"
                    aria-label={copiedTab === 'openscad' ? 'Code copied to clipboard' : 'Copy OpenSCAD code'}
                >
                    {copiedTab === 'openscad' ? 'Copied!' : 'Copy Code'}
                </button>
            </div>
            <SyntaxHighlighter
                language="cpp"
                style={oneLight}
                customStyle={{
                    margin: 0,
                    borderRadius: '0.75rem',
                    background: '#fafafa',
                    fontSize: '13px',
                }}
                showLineNumbers
            >
                {openscadCode}
            </SyntaxHighlighter>
        </div>
    );
}
