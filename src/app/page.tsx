'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SketchUploader } from '@/frontend/components/SketchUploader';
import { ChatInterface } from '@/frontend/components/ChatInterface';
import { OutputTabs } from '@/frontend/components/OutputTabs';
import { Button } from '@/frontend/components/ui/button';
import { SceneRenderer } from '@/frontend/components/SceneRenderer';
import { PcbPreview } from '@/frontend/components/PcbPreview';
import { SchematicDiagram } from '@/frontend/components/SchematicDiagram';
import { useProjectStore } from '@/frontend/state/projectStore';
import { buildProjectDescription } from '@/shared/domain/projectDescription';
import { buildPresentationScene } from '@/frontend/lib/presentationScene';
import { fallbackScene } from '@/shared/domain/scene';
import { infer3DKind } from '@/shared/domain/projectKind';
import { getDemoPreset } from '@/frontend/lib/demoPresets';
import { parseBomTable } from '@/shared/domain/bom';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Upload, MessageSquare } from 'lucide-react';

export default function Home() {
    const {
        currentProject,
        createProject,
        resetProject,
        error,
        clearError,
    } = useProjectStore();

    const [isExploded, setIsExploded] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);

    // Upload section: user override (null = auto), auto-collapses when project has content
    const hasOutputs = Object.values(currentProject?.outputs || {}).some(Boolean);
    const autoCollapsed = hasOutputs || Boolean(currentProject?.demoPresetId);
    const [uploadOverride, setUploadOverride] = useState<boolean | null>(null);
    // Reset override when demo preset changes (e.g., user selected a new demo)
    const prevDemoRef = useRef(currentProject?.demoPresetId);
    if (currentProject?.demoPresetId !== prevDemoRef.current) {
        prevDemoRef.current = currentProject?.demoPresetId;
        if (uploadOverride !== null) setUploadOverride(null);
    }
    const uploadOpen = uploadOverride !== null ? uploadOverride : !autoCollapsed;
    const toggleUpload = () => setUploadOverride(uploadOpen ? false : true);

    useEffect(() => {
        if (!currentProject) {
            createProject('New Hardware Project', '');
        }
    }, [currentProject, createProject]);

    useEffect(() => {
        if (error) {
            toast.error(error);
            clearError();
        }
    }, [error, clearError]);

    // Scene computation (from PresentationView logic)
    const demoPreset = useMemo(
        () => getDemoPreset(currentProject?.demoPresetId),
        [currentProject?.demoPresetId]
    );

    const description =
        buildProjectDescription(currentProject?.description, currentProject?.analysis?.summary) ||
        currentProject?.description ||
        'Hardware product';

    const sceneJson = currentProject?.outputs?.['scene-json'];
    const kind = infer3DKind(description, currentProject?.analysis);

    const presentation = useMemo(
        () => buildPresentationScene({
            description,
            analysis: currentProject?.analysis,
            sceneJson,
            demoPresetId: demoPreset?.id,
        }),
        [description, currentProject?.analysis, sceneJson, demoPreset?.id]
    );

    const sceneMode = kind === 'enclosure' ? 'presentation' : 'default';
    const boardShape = presentation.boardShape;
    const seed = `${description}-${currentProject?.id ?? 'project'}`;
    const heroView = demoPreset?.heroView;
    const isLockedHero = Boolean(heroView?.locked);
    const effectiveIsExploded = isLockedHero ? true : isExploded;

    const displaySceneJson = useMemo(() => {
        if (kind !== 'enclosure') {
            if (sceneJson) return sceneJson;
            return JSON.stringify(fallbackScene(description));
        }
        const elements = effectiveIsExploded ? presentation.exploded : presentation.assembled;
        return JSON.stringify(elements, null, 2);
    }, [kind, sceneJson, presentation, effectiveIsExploded, description]);

    // BOM data for sidebar
    const bomRaw = currentProject?.outputs?.bom || demoPreset?.outputs?.bom;
    const bom = bomRaw ? parseBomTable(bomRaw) : null;

    const bomStats = useMemo(() => {
        if (!bom) return null;
        const componentCount = bom.rows.reduce((sum, row) => {
            const qtyCol = bom.headers.findIndex((h) => /qty|quantity/i.test(h));
            const qty = qtyCol >= 0 ? parseInt(row[qtyCol] ?? '1', 10) : 1;
            return sum + (isNaN(qty) ? 1 : qty);
        }, 0);
        const totalCost = bom.rows.reduce((sum, row) => {
            const costCol = bom.headers.findIndex((h) => /cost|price/i.test(h));
            if (costCol < 0) return sum;
            const cell = row[costCol] ?? '';
            const match = cell.match(/[\d.]+/);
            const val = match ? parseFloat(match[0]) : 0;
            const qtyCol = bom.headers.findIndex((h) => /qty|quantity/i.test(h));
            const qty = qtyCol >= 0 ? parseInt(row[qtyCol] ?? '1', 10) : 1;
            return sum + val * (isNaN(qty) ? 1 : qty);
        }, 0);
        const nameCol = bom.headers.findIndex((h) => /component|part|name/i.test(h));
        const qtyCol = bom.headers.findIndex((h) => /qty|quantity/i.test(h));
        const previewRows = bom.rows.slice(0, 6);
        return { componentCount, totalCost, nameCol, qtyCol, previewRows, totalRows: bom.rows.length };
    }, [bom]);

    return (
        <main className="h-screen flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 bg-background/95 backdrop-blur-md border-b border-border">
                <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
                    <span className="text-xl font-semibold tracking-tight text-foreground">
                        Sketch.ai
                    </span>

                    <div className="flex items-center gap-3">
                        {currentProject?.analysis && (
                            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-accent rounded-full">
                                Analysis complete
                            </span>
                        )}

                        <Button
                            onClick={resetProject}
                            variant="outline"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground hover:bg-secondary border-border rounded-full h-7 px-3"
                        >
                            New Project
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Layout: 2-column */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Column: 3D Scene + Output Tabs */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {/* 3D Scene */}
                    <div className="flex-shrink-0 border-b border-border">
                        <div className="p-4 pb-2">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">
                                        {currentProject?.name || 'Hardware Concept'}
                                    </p>
                                    <p className="text-xs text-neutral-500 truncate max-w-md">
                                        {description}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => setIsExploded((prev) => !prev)}
                                    disabled={isLockedHero}
                                >
                                    {isLockedHero
                                        ? 'Exploded View (Locked)'
                                        : effectiveIsExploded
                                            ? 'Compact View'
                                            : 'Exploded View'}
                                </Button>
                            </div>

                            <SceneRenderer
                                sceneJson={displaySceneJson || JSON.stringify(fallbackScene(description))}
                                exploded={false}
                                mode={sceneMode}
                                height={420}
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
                        </div>
                    </div>

                    {/* Output Tabs */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <OutputTabs />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="w-[340px] flex-shrink-0 border-l border-border overflow-y-auto bg-card">
                    <div className="p-4 space-y-4">

                        {/* Upload / Demo Gallery Section */}
                        <div className="rounded-xl border border-neutral-200 bg-background overflow-hidden">
                            <button
                                onClick={toggleUpload}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Upload size={14} />
                                    {currentProject?.demoPresetId ? 'Change Sketch' : 'Upload Sketch'}
                                </span>
                                {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {uploadOpen && (
                                <div className="border-t border-neutral-200 max-h-[400px] overflow-y-auto">
                                    <SketchUploader />
                                </div>
                            )}
                        </div>

                        {/* Electronics: PCB Previews */}
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-900">Electronics</h3>
                            <p className="text-xs text-neutral-500 mt-1">PCB Front &amp; Back</p>
                            <div className="mt-2 flex items-center gap-4">
                                <PcbPreview
                                    seed={seed}
                                    side="front"
                                    shape={boardShape}
                                    imageUrl={demoPreset?.assets.pcbFront}
                                />
                                <PcbPreview
                                    seed={seed}
                                    side="back"
                                    shape={boardShape}
                                    imageUrl={demoPreset?.assets.pcbBack}
                                />
                            </div>
                        </div>

                        {/* Circuit Diagram */}
                        <div>
                            <p className="text-xs text-neutral-500 mb-2">Circuit Diagram</p>
                            <SchematicDiagram
                                description={description}
                                analysis={currentProject?.analysis}
                                imageUrl={demoPreset?.assets.circuitDiagram}
                            />
                        </div>

                        {/* Key Specs + BOM Summary */}
                        {bomStats && (
                            <>
                                <div>
                                    <h3 className="text-sm font-semibold text-neutral-900">Key Specs</h3>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-center">
                                            <p className="text-lg font-bold text-neutral-900">{bomStats.componentCount}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Components</p>
                                        </div>
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-center">
                                            <p className="text-lg font-bold text-neutral-900">${bomStats.totalCost.toFixed(2)}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Est. BOM Cost</p>
                                        </div>
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-center">
                                            <p className="text-lg font-bold text-neutral-900">{bomStats.totalRows}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Unique Parts</p>
                                        </div>
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-center">
                                            <p className="text-lg font-bold text-neutral-900">{boardShape === 'round' ? 'Round' : 'Rect'}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Board Shape</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-neutral-900">BOM Summary</h3>
                                    <div className="mt-2 space-y-1">
                                        {bomStats.previewRows.map((row, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-neutral-700">
                                                <span className="truncate flex-1">
                                                    {bomStats.nameCol >= 0 ? row[bomStats.nameCol] : row[0]}
                                                </span>
                                                <span className="ml-2 text-neutral-500 flex-shrink-0">
                                                    x{bomStats.qtyCol >= 0 ? row[bomStats.qtyCol] : '1'}
                                                </span>
                                            </div>
                                        ))}
                                        {bomStats.totalRows > 6 && (
                                            <p className="text-[10px] text-neutral-400">+ {bomStats.totalRows - 6} more parts</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        {demoPreset && (
                            <div className="pt-2 border-t border-neutral-200">
                                <Button className="w-full rounded-full bg-green-600 hover:bg-green-700 text-white">
                                    {demoPreset.orderCtaLabel ?? 'Order Now (RM90.00)'}
                                </Button>
                            </div>
                        )}

                        {/* Design Assistant Chat */}
                        <div className="rounded-xl border border-neutral-200 bg-background overflow-hidden">
                            <button
                                onClick={() => setChatOpen((prev) => !prev)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <MessageSquare size={14} />
                                    Design Assistant
                                </span>
                                {chatOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {chatOpen && (
                                <div className="border-t border-neutral-200 h-[360px]">
                                    <ChatInterface />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
