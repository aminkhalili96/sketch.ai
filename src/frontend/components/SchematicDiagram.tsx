'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useProjectStore } from '@/frontend/state/projectStore';

type SchematicDiagramProps = {
    description: string;
    analysis?: { summary?: string; identifiedComponents?: string[]; suggestedFeatures?: string[] };
    imageUrl?: string;
};

export function SchematicDiagram({ description, analysis, imageUrl }: SchematicDiagramProps) {
    const [svg, setSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { setError, selectedModel } = useProjectStore();

    useEffect(() => {
        let isActive = true;
        const fetchDiagram = async () => {
            if (imageUrl) return;
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
    }, [description, analysis, selectedModel, setError, imageUrl]);

    if (imageUrl) {
        return (
            <div className="rounded-lg border border-neutral-200 bg-background p-2">
                <Image
                    src={imageUrl}
                    alt="Circuit diagram"
                    width={420}
                    height={280}
                    className="w-full h-auto"
                />
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-xs text-neutral-400">Generating schematic...</div>;
    }

    if (!svg) {
        return <div className="text-xs text-neutral-400">No schematic generated yet.</div>;
    }

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return (
        <div className="rounded-lg border border-neutral-200 bg-background p-2">
            <Image
                src={dataUrl}
                alt="Circuit diagram"
                width={700}
                height={420}
                className="w-full h-auto"
                unoptimized
            />
        </div>
    );
}
