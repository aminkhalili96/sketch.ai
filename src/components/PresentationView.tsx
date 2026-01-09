'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SceneRenderer } from '@/components/SceneRenderer';
import { useProjectStore } from '@/stores/projectStore';
import { buildProjectDescription } from '@/lib/projectDescription';
import { buildPresentationScene } from '@/lib/presentationScene';
import { fallbackScene } from '@/lib/scene';
import { infer3DKind } from '@/lib/projectKind';

type PresentationViewProps = {
    onExit: () => void;
};

type PcbPreviewProps = {
    seed: string;
    side: 'front' | 'back';
    shape: 'round' | 'rect';
};

function hashSeed(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function mulberry32(seed: number) {
    let t = seed + 0x6D2B79F5;
    return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function PcbPreview({ seed, side, shape }: PcbPreviewProps) {
    const layout = useMemo(() => {
        const rand = mulberry32(hashSeed(`${seed}-${side}`));
        const chips = Array.from({ length: 12 }).map(() => ({
            x: 18 + rand() * 64,
            y: 18 + rand() * 64,
            w: 6 + rand() * 10,
            h: 6 + rand() * 10,
        }));
        const vias = Array.from({ length: 18 }).map(() => ({
            x: 10 + rand() * 80,
            y: 10 + rand() * 80,
            r: 1.2 + rand() * 1.4,
        }));
        return { chips, vias };
    }, [seed, side]);

    const boardFill = side === 'front' ? '#2F6D43' : '#27573A';
    const silkscreen = side === 'front' ? '#E6E2D8' : '#C7C2B7';

    return (
        <svg viewBox="0 0 100 100" className="h-20 w-20">
            {shape === 'round' ? (
                <circle cx="50" cy="50" r="45" fill={boardFill} stroke="#1E4630" strokeWidth="3" />
            ) : (
                <rect x="10" y="10" width="80" height="80" rx="14" fill={boardFill} stroke="#1E4630" strokeWidth="3" />
            )}
            <circle cx="50" cy="50" r="6" fill="#1B1B1B" opacity="0.7" />
            {layout.chips.map((chip, idx) => (
                <rect
                    key={`chip-${idx}`}
                    x={chip.x}
                    y={chip.y}
                    width={chip.w}
                    height={chip.h}
                    rx="2"
                    fill={side === 'front' ? '#C9B18A' : '#B49C7A'}
                    stroke="#8A7354"
                    strokeWidth="0.6"
                />
            ))}
            {layout.vias.map((via, idx) => (
                <circle key={`via-${idx}`} cx={via.x} cy={via.y} r={via.r} fill={silkscreen} opacity="0.8" />
            ))}
            <text x="12" y="18" fontSize="6" fill={silkscreen} fontFamily="Arial, sans-serif">
                PCB {side === 'front' ? 'FRONT' : 'BACK'}
            </text>
        </svg>
    );
}

type SchematicDiagramProps = {
    description: string;
    analysis?: { summary?: string; identifiedComponents?: string[]; suggestedFeatures?: string[] };
};

function SchematicDiagram({ description, analysis }: SchematicDiagramProps) {
    const [svg, setSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { setError, selectedModel } = useProjectStore();

    useEffect(() => {
        let isActive = true;
        const fetchDiagram = async () => {
            if (!description.trim()) return;
            setIsLoading(true);
            setSvg(null);
            try {
                const response = await fetch('/api/schematic-diagram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description,
                        analysis,
                        model: selectedModel,
                    }),
                });
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error || 'Diagram generation failed');
                }
                if (isActive) {
                    setSvg(data.svg);
                }
            } catch (error) {
                if (isActive) {
                    setError(error instanceof Error ? error.message : 'Diagram generation failed');
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };
        fetchDiagram();
        return () => {
            isActive = false;
        };
    }, [description, analysis, selectedModel, setError]);

    if (isLoading) {
        return <div className="text-xs text-neutral-400">Generating schematic...</div>;
    }

    if (!svg) {
        return <div className="text-xs text-neutral-400">No schematic generated yet.</div>;
    }

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-2">
            <img
                src={dataUrl}
                alt="Circuit diagram"
                className="w-full h-auto"
            />
        </div>
    );
}

export function PresentationView({ onExit }: PresentationViewProps) {
    const { currentProject } = useProjectStore();
    const [isExploded, setIsExploded] = useState(true);

    const description =
        buildProjectDescription(currentProject?.description, currentProject?.analysis?.summary) ||
        currentProject?.description ||
        'Hardware product';
    const sceneJson = currentProject?.outputs?.['scene-json'];
    const kind = infer3DKind(description, currentProject?.analysis);

    const presentation = useMemo(
        () => buildPresentationScene({ description, analysis: currentProject?.analysis, sceneJson }),
        [description, currentProject?.analysis, sceneJson]
    );

    const displaySceneJson = useMemo(() => {
        if (kind !== 'enclosure') {
            if (sceneJson) return sceneJson;
            return JSON.stringify(fallbackScene(description));
        }
        const elements = isExploded ? presentation.exploded : presentation.assembled;
        return JSON.stringify(elements, null, 2);
    }, [kind, sceneJson, presentation, isExploded, description]);

    const sceneMode = kind === 'enclosure' ? 'presentation' : 'default';
    const boardShape = presentation.boardShape;
    const seed = `${description}-${currentProject?.id ?? 'project'}`;

    const handleRefine = () => {
        onExit();
        setTimeout(() => {
            const target = document.getElementById('design-assistant');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    };

    const handleDownloadBuildGuide = async () => {
        if (!currentProject) return;
        const outputs = currentProject.outputs || {};
        if (!outputs.bom && !outputs.assembly && !outputs.schematic) {
            return;
        }
        const response = await fetch('/api/build-guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectName: currentProject.name,
                outputs,
                metadata: currentProject.metadata,
            }),
        });
        if (!response.ok) return;
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name}-build-guide.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full bg-background overflow-hidden">
            <div className="max-w-screen-2xl mx-auto px-6 py-6 h-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-neutral-900">Product Overview</h2>
                    <Button variant="outline" onClick={onExit} className="rounded-full">
                        Exit Presentation
                    </Button>
                </div>

                <div className="mt-6 flex gap-6 h-[calc(100%-48px)]">
                    <div className="flex-1 min-w-0">
                        <Card className="p-6 h-full">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">{currentProject?.name || 'Hardware Concept'}</p>
                                    <p className="text-xs text-neutral-500">{description}</p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => setIsExploded((prev) => !prev)}
                                >
                                    {isExploded ? 'Compact View' : 'Exploded View'}
                                </Button>
                            </div>

                            <SceneRenderer
                                sceneJson={displaySceneJson || JSON.stringify(fallbackScene(description))}
                                exploded={false}
                                mode={sceneMode}
                                height={540}
                            />
                        </Card>
                    </div>

                    <div className="w-[320px] flex-shrink-0">
                        <Card className="p-4 space-y-6 h-full overflow-auto">
                            <div>
                                <h3 className="text-sm font-semibold text-neutral-900">Electronics</h3>
                                <p className="text-xs text-neutral-500 mt-1">PCB Front &amp; Back</p>
                                <div className="mt-3 flex items-center gap-4">
                                    <PcbPreview seed={seed} side="front" shape={boardShape} />
                                    <PcbPreview seed={seed} side="back" shape={boardShape} />
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-neutral-500 mb-2">Circuit Diagram</p>
                                <SchematicDiagram
                                    description={description}
                                    analysis={currentProject?.analysis}
                                />
                            </div>

                            <div className="space-y-2 pt-2 border-t border-neutral-200">
                                <Button onClick={handleRefine} className="w-full rounded-full">
                                    Refine Product
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadBuildGuide}
                                    className="w-full rounded-full"
                                >
                                    Download Instruction
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
