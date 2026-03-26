'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/frontend/state/projectStore';
import { buildProjectDescription } from '@/shared/domain/projectDescription';
import { getDemoPreset } from '@/frontend/lib/demoPresets';
import type { ProjectMetadata, ProjectOutputs } from '@/shared/types';

type OutputType = 'bom' | 'assembly' | 'firmware' | 'schematic' | 'openscad';
type GenerateOutputType = OutputType | 'scene-json';

export function useOutputActions() {
    const [copiedTab, setCopiedTab] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isExploded, setIsExploded] = useState(false);
    const [stlDownloadUrl, setStlDownloadUrl] = useState<string | null>(null);
    const [isBuildingGuide, setIsBuildingGuide] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [generationLogs, setGenerationLogs] = useState<string[]>([]);
    const [pipelineTrace, setPipelineTrace] = useState<string[]>([]);
    const stlUrlRef = useRef<string | null>(null);

    const {
        currentProject,
        setOutputs,
        setMetadata,
        isGenerating,
        setGenerating,
        isExporting,
        setExporting,
        outputSnapshots,
        pushOutputsSnapshot,
        replaceOutputs,
        setError,
        selectedModel,
    } = useProjectStore();

    const outputs = currentProject?.outputs || {};
    const hasAnyOutput = Object.values(outputs).some(Boolean);
    const hasBuildGuideContent = Boolean(outputs.bom || outputs.assembly || outputs.schematic);
    const projectDescription =
        buildProjectDescription(currentProject?.description, currentProject?.analysis?.summary) ||
        'Hardware project';
    const recentSnapshots = outputSnapshots.slice(-3).reverse();
    const demoPreset = getDemoPreset(currentProject?.demoPresetId);
    const demoPresetId = demoPreset?.id;
    const heroView = demoPreset?.heroView;
    const isLockedHero = Boolean(heroView?.locked);
    const effectiveIsExploded = isLockedHero ? true : isExploded;

    useEffect(() => {
        stlUrlRef.current = stlDownloadUrl;
    }, [stlDownloadUrl]);

    useEffect(() => {
        return () => {
            if (stlUrlRef.current) {
                URL.revokeObjectURL(stlUrlRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setStlDownloadUrl((prev) => {
            if (!prev) return prev;
            URL.revokeObjectURL(prev);
            return null;
        });
    }, [outputs.openscad]);

    useEffect(() => {
        if (demoPresetId) {
            setIsExploded(true);
        }
    }, [demoPresetId]);

    const appendGenerationLog = useCallback((message: string) => {
        setGenerationLogs((prev) => [...prev.slice(-5), message]);
    }, []);

    const handleGenerate = useCallback(async (types: OutputType[]) => {
        if (!currentProject?.description && !currentProject?.analysis) {
            setError('Please upload a sketch or add a description first');
            return;
        }

        setGenerating(true);
        setError(null);
        setGenerationLogs([]);
        setPipelineTrace([]);
        appendGenerationLog('Preparing generation...');

        try {
            if (hasAnyOutput) {
                pushOutputsSnapshot(`Generate ${types.join(', ')}`);
            }
            const outputTypesToRequest: GenerateOutputType[] = [...types];
            if (types.includes('openscad')) {
                outputTypesToRequest.push('scene-json');
            }

            const payload = {
                projectDescription,
                analysisContext: currentProject.analysis,
                outputTypes: outputTypesToRequest,
                sketchImage: currentProject.sketchBase64,
                model: selectedModel,
            };

            const streamed = await (async () => {
                const response = await fetch('/api/generate/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok || !response.body) {
                    return false;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                appendGenerationLog('Streaming generation started...');

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        const event = JSON.parse(trimmed) as {
                            type: string;
                            message?: string;
                            outputType?: OutputType | 'scene-json' | 'assembly-spec';
                            content?: string;
                            metadata?: unknown;
                            trace?: string[];
                            error?: string;
                        };

                        if (event.type === 'status' && event.message) {
                            appendGenerationLog(event.message);
                        } else if (event.type === 'output' && event.outputType && typeof event.content === 'string') {
                            setOutputs({ [event.outputType]: event.content });
                        } else if (event.type === 'metadata' && event.metadata) {
                            setMetadata(event.metadata as ProjectMetadata);
                        } else if (event.type === 'trace' && Array.isArray(event.trace)) {
                            setPipelineTrace(event.trace);
                        } else if (event.type === 'error') {
                            throw new Error(event.error || 'Generation failed');
                        } else if (event.type === 'done') {
                            appendGenerationLog('Generation complete.');
                        }
                    }
                }

                return true;
            })();

            if (!streamed) {
                appendGenerationLog('Generating outputs...');
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Generation failed');
                }

                setOutputs(data.outputs);
                if (data.metadata) {
                    setMetadata(data.metadata);
                }
                if (Array.isArray(data.trace)) {
                    setPipelineTrace(data.trace);
                }
                appendGenerationLog('Generation complete.');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Generation failed');
        } finally {
            setGenerating(false);
        }
    }, [currentProject, hasAnyOutput, projectDescription, selectedModel, setError, setGenerating, setOutputs, setMetadata, pushOutputsSnapshot, appendGenerationLog]);

    const handleExport = useCallback(async () => {
        if (!hasAnyOutput) return;

        setExporting(true);
        setError(null);

        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: currentProject?.name || 'sketch-ai-project',
                    outputs,
                    metadata: currentProject?.metadata,
                }),
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentProject?.name || 'project'}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [hasAnyOutput, currentProject, outputs, setExporting, setError]);

    const handleDownloadBuildGuide = useCallback(async () => {
        if (!hasBuildGuideContent) {
            setError('Generate BOM, Assembly, or Schematic first');
            return;
        }

        setIsBuildingGuide(true);
        setError(null);

        try {
            const response = await fetch('/api/build-guide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: currentProject?.name || 'sketch-ai-project',
                    outputs,
                    metadata: currentProject?.metadata,
                }),
            });

            if (!response.ok) {
                throw new Error('Build guide failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentProject?.name || 'project'}-build-guide.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Build guide failed');
        } finally {
            setIsBuildingGuide(false);
        }
    }, [hasBuildGuideContent, currentProject, outputs, setError]);

    const handleRefine = useCallback(() => {
        const target = document.getElementById('design-assistant');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleRestoreSnapshot = useCallback((snapshotIndex: number) => {
        const snapshot = recentSnapshots[snapshotIndex];
        if (!snapshot) return;
        pushOutputsSnapshot('Before restore');
        replaceOutputs(snapshot.outputs);
        setMetadata(snapshot.metadata ?? null);
    }, [recentSnapshots, pushOutputsSnapshot, replaceOutputs, setMetadata]);

    const handleCopy = useCallback(async (content: string, tabId: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedTab(tabId);
        setTimeout(() => setCopiedTab(null), 2000);
    }, []);

    const handleCompile3D = useCallback(async () => {
        const openscadCode = outputs.openscad;
        if (!openscadCode) return;

        setIsCompiling(true);
        setError(null);

        try {
            const response = await fetch('/api/compile-3d', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openscadCode }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Compilation failed');
            }

            const byteCharacters = atob(data.stlBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/sla' });
            const url = URL.createObjectURL(blob);
            setStlDownloadUrl((prev) => {
                if (prev) {
                    URL.revokeObjectURL(prev);
                }
                return url;
            });
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Compilation failed');
        } finally {
            setIsCompiling(false);
        }
    }, [outputs.openscad, setError]);

    const handleDownloadSTL = useCallback(() => {
        if (!stlDownloadUrl) return;
        const a = document.createElement('a');
        a.href = stlDownloadUrl;
        a.download = `${currentProject?.name || 'model'}.stl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, [stlDownloadUrl, currentProject?.name]);

    const downloadDataUrl = useCallback((dataUrl: string, filename: string) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, []);

    const handleGenerateRender = useCallback(async () => {
        if (!currentProject?.description && !currentProject?.analysis) {
            setError('Please upload a sketch or add a description first');
            return;
        }

        setIsRendering(true);
        setError(null);

        try {
            const response = await fetch('/api/render-3d', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectDescription,
                    analysisContext: currentProject.analysis,
                    assemblySpec: outputs['assembly-spec'],
                    renderMode: effectiveIsExploded ? 'exploded' : 'assembled',
                    model: selectedModel,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Render failed');
            }

            const renderDataUrl = `data:image/png;base64,${data.renderPngBase64}`;
            const stepDataUrl = `data:model/step;base64,${data.cadStepBase64}`;
            const stlDataUrl = `data:model/stl;base64,${data.cadStlBase64}`;

            setOutputs({
                'render-png': renderDataUrl,
                'cad-step': stepDataUrl,
                'cad-stl': stlDataUrl,
                ...(data.assemblySpec ? { 'assembly-spec': data.assemblySpec } : {}),
            });
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Render failed');
        } finally {
            setIsRendering(false);
        }
    }, [currentProject, projectDescription, outputs, effectiveIsExploded, selectedModel, setError, setOutputs]);

    const reportTabs = (REPORT_OUTPUTS as readonly { id: keyof ProjectOutputs; label: string }[]).filter(
        (report) => outputs[report.id]
    );

    return {
        // State
        copiedTab,
        isCompiling,
        isExploded,
        setIsExploded,
        stlDownloadUrl,
        isBuildingGuide,
        isRendering,
        generationLogs,
        pipelineTrace,

        // Derived
        outputs,
        hasAnyOutput,
        hasBuildGuideContent,
        projectDescription,
        recentSnapshots,
        demoPreset,
        heroView,
        isLockedHero,
        effectiveIsExploded,
        reportTabs,
        currentProject,
        isGenerating,
        isExporting,

        // Actions
        handleGenerate,
        handleExport,
        handleDownloadBuildGuide,
        handleRefine,
        handleRestoreSnapshot,
        handleCopy,
        handleCompile3D,
        handleDownloadSTL,
        downloadDataUrl,
        handleGenerateRender,
    };
}

const REPORT_OUTPUTS: Array<{ id: keyof ProjectOutputs; label: string }> = [
    { id: 'safety', label: 'Safety Review' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'cost-optimization', label: 'Cost Optimization' },
    { id: 'dfm', label: 'DFM' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'patent-risk', label: 'Patent Risk' },
];
