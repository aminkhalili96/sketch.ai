'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { SceneRenderer } from '@/components/SceneRenderer';
import { buildProjectDescription } from '@/lib/projectDescription';
import { parseBomTable } from '@/lib/bom';
import type { ProjectMetadata } from '@/types';

type OutputType = 'bom' | 'assembly' | 'firmware' | 'schematic' | 'openscad';
type GenerateOutputType = OutputType | 'scene-json';

const OUTPUT_TABS: { id: OutputType; label: string }[] = [
    { id: 'openscad', label: '3D Model' },
    { id: 'bom', label: 'BOM' },
    { id: 'assembly', label: 'Assembly' },
    { id: 'firmware', label: 'Firmware' },
    { id: 'schematic', label: 'Schematic' },
];

const REPORT_OUTPUTS: Array<{ id: keyof ProjectOutputs; label: string }> = [
    { id: 'safety', label: 'Safety Review' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'cost-optimization', label: 'Cost Optimization' },
    { id: 'dfm', label: 'DFM' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'patent-risk', label: 'Patent Risk' },
];

export function OutputTabs() {
    const [activeTab, setActiveTab] = useState<OutputType>('openscad');
    const [copiedTab, setCopiedTab] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isExploded, setIsExploded] = useState(false);
    const [stlDownloadUrl, setStlDownloadUrl] = useState<string | null>(null);
    const [isBuildingGuide, setIsBuildingGuide] = useState(false);
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
    const reportTabs = REPORT_OUTPUTS.filter((report) => outputs[report.id]);

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

    const appendGenerationLog = (message: string) => {
        setGenerationLogs((prev) => [...prev.slice(-5), message]);
    };

    const handleGenerate = async (types: OutputType[]) => {
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
            // Always try to fetch scene-json if we are asking for openscad
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
                            outputType?: OutputType | 'scene-json';
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
    };

    const handleExport = async () => {
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
    };

    const handleDownloadBuildGuide = async () => {
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
    };

    const handleRefine = () => {
        const target = document.getElementById('design-assistant');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleRestoreSnapshot = (snapshotIndex: number) => {
        const snapshot = recentSnapshots[snapshotIndex];
        if (!snapshot) return;
        pushOutputsSnapshot('Before restore');
        replaceOutputs(snapshot.outputs);
        setMetadata(snapshot.metadata ?? null);
    };

    const handleCopy = async (content: string, tabId: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedTab(tabId);
        setTimeout(() => setCopiedTab(null), 2000);
    };

    const handleCompile3D = async () => {
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

            // Convert base64 to blob and create download URL
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
    };

    const handleDownloadSTL = () => {
        if (!stlDownloadUrl) return;
        const a = document.createElement('a');
        a.href = stlDownloadUrl;
        a.download = `${currentProject?.name || 'model'}.stl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const renderMarkdownContent = (content: string) => (
        <div className="prose prose-sm max-w-none prose-neutral">
            <ReactMarkdown
                components={{
                    code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return isInline ? (
                            <code className="px-1 py-0.5 rounded bg-neutral-100 text-sm font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <SyntaxHighlighter
                                language={match[1]}
                                style={oneLight}
                                customStyle={{ borderRadius: '0.5rem', fontSize: '13px' }}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        );
                    },
                    p: ({ children }) => <p className="m-0">{children}</p>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );

    const renderBomContent = (content: string) => {
        const parsed = parseBomTable(content);
        if (!parsed) {
            return renderMarkdownContent(content);
        }

        const numericHeaders = new Set(['qty', 'unit price', 'ext price', 'price', 'cost']);
        const isNumericColumn = (header: string) => {
            const lowered = header.toLowerCase();
            return Array.from(numericHeaders).some((key) => lowered.includes(key));
        };

        const isMonoColumn = (header: string) => {
            const lowered = header.toLowerCase();
            return lowered.includes('mpn') || lowered.includes('part') || lowered.includes('sku');
        };

        return (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <table className="min-w-full text-xs">
                    <thead className="bg-neutral-50 text-neutral-600">
                        <tr>
                            {parsed.headers.map((header, idx) => (
                                <th
                                    key={`${header}-${idx}`}
                                    className={`px-3 py-2 text-left font-medium border-b border-neutral-200 ${isNumericColumn(header) ? 'text-right' : ''}`}
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {parsed.rows.map((row, rowIndex) => (
                            <tr key={`row-${rowIndex}`} className="hover:bg-neutral-50">
                                {row.map((cell, colIndex) => {
                                    const header = parsed.headers[colIndex] ?? '';
                                    const numeric = isNumericColumn(header);
                                    const mono = isMonoColumn(header);
                                    return (
                                        <td
                                            key={`cell-${rowIndex}-${colIndex}`}
                                            className={`px-3 py-2 align-top ${numeric ? 'text-right' : ''} ${mono ? 'font-mono text-[11px]' : ''}`}
                                        >
                                            <ReactMarkdown
                                                components={{
                                                    p: ({ children }) => <span>{children}</span>,
                                                    a: ({ children, ...props }) => (
                                                        <a
                                                            {...props}
                                                            className="text-blue-600 hover:text-blue-700 underline"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            {children}
                                                        </a>
                                                    ),
                                                }}
                                            >
                                                {cell || '-'}
                                            </ReactMarkdown>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderContent = (
        content: string | undefined,
        type: OutputType | keyof ProjectOutputs,
        options: { allowGenerate?: boolean } = {}
    ) => {
        const allowGenerate = options.allowGenerate ?? true;
        if (!content) {
            return (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-neutral-400 text-sm">No content yet</p>
                    {allowGenerate && typeof type === 'string' && OUTPUT_TABS.find(t => t.id === type) && (
                        <Button
                            onClick={() => handleGenerate([type as OutputType])}
                            disabled={isGenerating || (!currentProject?.analysis && !currentProject?.description)}
                            variant="outline"
                            className="mt-4 rounded-xl border-neutral-200"
                        >
                            Generate {OUTPUT_TABS.find(t => t.id === type)?.label}
                        </Button>
                    )}
                </div>
            );
        }

        const body = type === 'bom' ? renderBomContent(content) : renderMarkdownContent(content);

        return (
            <div className="relative">
                <button
                    onClick={() => handleCopy(content, type)}
                    className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-600 transition-colors z-10"
                >
                    {copiedTab === type ? 'Copied!' : 'Copy'}
                </button>
                {type === 'firmware' ? (
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
                        {content}
                    </SyntaxHighlighter>
                ) : (
                    body
                )}
            </div>
        );
    };

    const render3DContent = () => {
        const openscadCode = outputs.openscad;
        const sceneJson = outputs['scene-json'];

        if (sceneJson) {
        return (
            <div className="space-y-6">
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
                    >
                        {isExploded ? 'Compact View' : 'Exploded View'}
                    </Button>
                </div>

                <SceneRenderer sceneJson={sceneJson} exploded={isExploded} />

                <div className="flex gap-2 flex-wrap items-center justify-between border-t border-neutral-100 pt-4">
                    <h3 className="text-sm font-medium text-neutral-900">OpenSCAD Source</h3>
                    <div className="flex gap-2">
                            <Button
                                onClick={handleCompile3D}
                                disabled={isCompiling}
                                size="sm"
                                variant="outline"
                            >
                                {isCompiling ? 'Compiling STL...' : 'Compile to STL'}
                            </Button>
                            {stlDownloadUrl && (
                                <Button
                                    onClick={handleDownloadSTL}
                                    variant="outline"
                                    className="border-green-500 text-green-600 hover:bg-green-50 rounded-xl"
                                >
                                    Download STL
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Existing OpenSCAD code view as fallback/reference */}
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-neutral-400 text-sm">No 3D model generated yet</p>
                    <Button
                        onClick={() => handleGenerate(['openscad'])} // This will trigger the updated handleGenerate which adds scene-json
                        disabled={isGenerating || (!currentProject?.analysis && !currentProject?.description)}
                        variant="outline"
                        className="mt-4 rounded-xl border-neutral-200"
                    >
                        Generate 3D Model
                    </Button>
                </div>
            );
        }

        // ... classic OpenSCAD only view
        return (
            <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                    <Button
                        onClick={handleCompile3D}
                        disabled={isCompiling}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    >
                        {isCompiling ? 'Compiling...' : 'Compile to STL'}
                    </Button>
                    {stlDownloadUrl && (
                        <Button
                            onClick={handleDownloadSTL}
                            variant="outline"
                            className="border-green-500 text-green-600 hover:bg-green-50 rounded-xl"
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
                    >
                        Download .scad
                    </button>
                    <button
                        onClick={() => handleCopy(openscadCode, 'openscad')}
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-600 transition-colors"
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
    };

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-white border border-neutral-200 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-medium text-neutral-900">
                        Generated Outputs
                    </h2>
                    {currentProject?.metadata && (
                        <div className="flex gap-4 mt-1 text-xs text-neutral-500">
                            <span>~${currentProject.metadata.estimatedCost}</span>
                            <span>{currentProject.metadata.buildTime}</span>
                            <span className="capitalize">{currentProject.metadata.complexity}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                        onClick={() => handleGenerate(['bom', 'assembly', 'firmware', 'schematic', 'openscad'])}
                        disabled={isGenerating || (!currentProject?.analysis && !currentProject?.description)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                    >
                        {isGenerating ? 'Generating...' : 'Generate All'}
                    </Button>
                    <Button
                        onClick={handleRefine}
                        variant="outline"
                        className="border-neutral-200 rounded-full"
                    >
                        Refine
                    </Button>
                    <Button
                        onClick={handleDownloadBuildGuide}
                        disabled={isBuildingGuide || !hasBuildGuideContent}
                        variant="outline"
                        className="border-neutral-200 rounded-full"
                    >
                        {isBuildingGuide ? 'Preparing Guide...' : 'Download Build Guide'}
                    </Button>
                    {hasAnyOutput && (
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            variant="outline"
                            className="border-neutral-200 rounded-full"
                        >
                            {isExporting ? 'Exporting...' : 'Export ZIP'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6">
                {generationLogs.length > 0 && (
                    <div className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-800">Generation Activity</span>
                            <span className={`text-xs ${isGenerating ? 'text-amber-600' : 'text-green-600'}`}>
                                {isGenerating ? 'In progress' : 'Complete'}
                            </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-neutral-500">
                            {generationLogs.map((log, idx) => (
                                <div key={`${log}-${idx}`} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-300" />
                                    <span>{log}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {pipelineTrace.length > 0 && (
                    <div className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-800">Pipeline Trace</span>
                            <span className="text-xs text-neutral-400">{pipelineTrace.length} steps</span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-neutral-600">
                            {pipelineTrace.map((step, idx) => (
                                <div key={`${step}-${idx}`} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-300" />
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {recentSnapshots.length > 0 && (
                    <div className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-neutral-900">Recent Versions</h4>
                            <span className="text-xs text-neutral-400">Last {recentSnapshots.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            {recentSnapshots.map((snapshot, index) => (
                                <div
                                    key={snapshot.timestamp}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2"
                                >
                                    <div>
                                        <p className="text-xs font-medium text-neutral-700">
                                            {snapshot.note || 'Snapshot'}
                                        </p>
                                        <p className="text-[11px] text-neutral-400">
                                            {new Date(snapshot.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => handleRestoreSnapshot(index)}
                                    >
                                        Restore
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OutputType)} className="flex flex-col">
                    <TabsList className="mx-4 mt-4 bg-neutral-100 rounded-xl p-1">
                        {OUTPUT_TABS.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className="flex items-center gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm"
                            >
                                {tab.label}
                                {outputs[tab.id] && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <div className="p-4">
                        <AnimatePresence mode="wait">
                            {OUTPUT_TABS.map((tab) => (
                                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 overflow-auto"
                                    >
                                        {tab.id === 'openscad' ? render3DContent() : renderContent(outputs[tab.id], tab.id)}
                                    </motion.div>
                                </TabsContent>
                            ))}
                        </AnimatePresence>
                    </div>
                </Tabs>

                {reportTabs.length > 0 && (
                    <div className="mx-4 mb-6 rounded-2xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-neutral-900">Reports</h4>
                            <span className="text-xs text-neutral-400">{reportTabs.length} available</span>
                        </div>
                        <div className="mt-3 space-y-4">
                            {reportTabs.map((report) => (
                                <div
                                    key={report.id}
                                    className="rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                                >
                                    <div className="mb-2 text-xs font-semibold text-neutral-700">
                                        {report.label}
                                    </div>
                                    {renderContent(outputs[report.id], report.id, { allowGenerate: false })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
