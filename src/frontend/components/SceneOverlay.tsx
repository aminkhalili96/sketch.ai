'use client';

import type { SceneElement } from './SceneRenderer';

interface SceneOverlayProps {
    element: SceneElement;
    onClose: () => void;
}

export function SceneOverlay({ element, onClose }: SceneOverlayProps) {
    const { name, type, dimensions, material, color, opacity } = element;

    const dimLabel = (() => {
        switch (type) {
            case 'sphere':
            case 'half-sphere':
                return `r=${dimensions[0].toFixed(1)}`;
            case 'cylinder':
            case 'cone':
            case 'capsule':
                return `r=${dimensions[0].toFixed(1)}, h=${dimensions[1].toFixed(1)}`;
            case 'torus':
                return `R=${dimensions[0].toFixed(1)}, tube=${dimensions[1].toFixed(1)}`;
            case 'plane':
                return `${dimensions[0].toFixed(1)} x ${dimensions[2].toFixed(1)}`;
            default:
                return `${dimensions[0].toFixed(1)} x ${dimensions[1].toFixed(1)} x ${dimensions[2].toFixed(1)}`;
        }
    })();

    return (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-md rounded-xl shadow-lg border border-neutral-200 p-3 max-w-[220px] text-xs z-10">
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-neutral-900 truncate">
                    {name || 'Unnamed Part'}
                </span>
                <button
                    onClick={onClose}
                    className="ml-2 text-neutral-400 hover:text-neutral-700 transition-colors"
                    aria-label="Close part details"
                >
                    x
                </button>
            </div>

            <div className="space-y-1 text-neutral-600">
                <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Type</span>
                    <span className="font-medium">{type}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Size</span>
                    <span className="font-mono">{dimLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Material</span>
                    <span className="capitalize">{material || 'plastic'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Color</span>
                    <div className="flex items-center gap-1.5">
                        <span
                            className="inline-block w-3 h-3 rounded-full border border-neutral-300"
                            style={{ backgroundColor: color }}
                        />
                        <span className="font-mono">{color}</span>
                    </div>
                </div>
                {opacity !== undefined && opacity < 1 && (
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Opacity</span>
                        <span>{Math.round(opacity * 100)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
