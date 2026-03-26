'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Image from 'next/image';
import { Card } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import type { ProjectOutputs } from '@/shared/types';
import { BomTable } from './BomTable';
import { MarkdownContent } from './MarkdownContent';
import { PipelineProgress } from './PipelineProgress';
import { ThreeDTab } from './ThreeDTab';
import { useOutputActions } from './useOutputActions';

type OutputType = 'bom' | 'assembly' | 'firmware' | 'schematic' | 'openscad';

const OUTPUT_TABS: { id: OutputType; label: string }[] = [
    { id: 'openscad', label: '3D Model' },
    { id: 'bom', label: 'BOM' },
    { id: 'assembly', label: 'Assembly' },
    { id: 'firmware', label: 'Firmware' },
    { id: 'schematic', label: 'Schematic' },
];

export function OutputTabs() {
    const [activeTab, setActiveTab] = useState<OutputType>('openscad');

    const {
        copiedTab,
        isCompiling,
        stlDownloadUrl,
        isBuildingGuide,
        isRendering,
        generationLogs,
        pipelineTrace,
        isExploded: _isExploded,
        setIsExploded,
        outputs,
        hasAnyOutput,
        hasBuildGuideContent,
        recentSnapshots,
        demoPreset,
        heroView,
        isLockedHero,
        effectiveIsExploded,
        reportTabs,
        currentProject,
        isGenerating,
        isExporting,
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
    } = useOutputActions();

    const renderContent = (
        content: string | undefined,
        type: OutputType | keyof ProjectOutputs,
        options: { allowGenerate?: boolean } = {}
    ) => {
        if (type === 'schematic' && demoPreset?.assets.circuitDiagram) {
            return (
                <div className="rounded-lg border border-neutral-200 bg-background p-3">
                    <Image
                        src={demoPreset.assets.circuitDiagram}
                        alt="Circuit diagram"
                        width={700}
                        height={420}
                        className="w-full h-auto"
                    />
                </div>
            );
        }

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
                            aria-label={`Generate ${OUTPUT_TABS.find(t => t.id === type)?.label}`}
                        >
                            Generate {OUTPUT_TABS.find(t => t.id === type)?.label}
                        </Button>
                    )}
                </div>
            );
        }

        const body = type === 'bom' ? <BomTable content={content} /> : <MarkdownContent content={content} />;

        return (
            <div className="relative">
                <button
                    onClick={() => handleCopy(content, type)}
                    className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-600 transition-colors z-10"
                    aria-label={copiedTab === type ? 'Content copied to clipboard' : `Copy ${type} content`}
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

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-background border border-neutral-200 rounded-2xl shadow-sm">
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
                        aria-label={isGenerating ? 'Generation in progress' : 'Generate all outputs'}
                    >
                        {isGenerating ? 'Generating...' : 'Generate All'}
                    </Button>
                    <Button
                        onClick={handleRefine}
                        variant="outline"
                        className="border-neutral-200 rounded-full"
                        aria-label="Scroll to design assistant to refine outputs"
                    >
                        Refine
                    </Button>
                    <Button
                        onClick={handleDownloadBuildGuide}
                        disabled={isBuildingGuide || !hasBuildGuideContent}
                        variant="outline"
                        className="border-neutral-200 rounded-full"
                        aria-label={isBuildingGuide ? 'Preparing build guide' : 'Download build guide'}
                    >
                        {isBuildingGuide ? 'Preparing Guide...' : 'Download Build Guide'}
                    </Button>
                    {hasAnyOutput && (
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            variant="outline"
                            className="border-neutral-200 rounded-full"
                            aria-label={isExporting ? 'Exporting project' : 'Export project as ZIP'}
                        >
                            {isExporting ? 'Exporting...' : 'Export ZIP'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6">
                <PipelineProgress
                    generationLogs={generationLogs}
                    pipelineTrace={pipelineTrace}
                    isGenerating={isGenerating}
                />

                {recentSnapshots.length > 0 && (
                    <div className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-background p-3">
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
                                        aria-label={`Restore snapshot from ${new Date(snapshot.timestamp).toLocaleString()}`}
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
                                className="flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"
                            >
                                {tab.label}
                                {outputs[tab.id] && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
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
                                        {tab.id === 'openscad' ? (
                                            <ThreeDTab
                                                outputs={outputs}
                                                currentProject={currentProject}
                                                demoPreset={demoPreset ?? null}
                                                effectiveIsExploded={effectiveIsExploded}
                                                isLockedHero={isLockedHero}
                                                heroView={heroView}
                                                isExploded={_isExploded}
                                                setIsExploded={setIsExploded}
                                                isGenerating={isGenerating}
                                                isCompiling={isCompiling}
                                                isRendering={isRendering}
                                                stlDownloadUrl={stlDownloadUrl}
                                                copiedTab={copiedTab}
                                                handleGenerate={handleGenerate}
                                                handleCompile3D={handleCompile3D}
                                                handleDownloadSTL={handleDownloadSTL}
                                                handleGenerateRender={handleGenerateRender}
                                                handleCopy={handleCopy}
                                                downloadDataUrl={downloadDataUrl}
                                                hideScenePreview
                                            />
                                        ) : renderContent(outputs[tab.id], tab.id)}
                                    </motion.div>
                                </TabsContent>
                            ))}
                        </AnimatePresence>
                    </div>
                </Tabs>

                {reportTabs.length > 0 && (
                    <div className="mx-4 mb-6 rounded-2xl border border-neutral-200 bg-background p-4">
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
