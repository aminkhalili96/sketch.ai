'use client';

import { useMemo } from 'react';
import Image from 'next/image';

type PcbPreviewProps = {
    seed: string;
    side: 'front' | 'back';
    shape: 'round' | 'rect';
    imageUrl?: string;
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

export function PcbPreview({ seed, side, shape, imageUrl }: PcbPreviewProps) {
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

    if (imageUrl) {
        return (
            <div className="h-20 w-20 rounded-lg border border-neutral-200 bg-background p-1">
                <Image
                    src={imageUrl}
                    alt={`PCB ${side}`}
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                />
            </div>
        );
    }

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
