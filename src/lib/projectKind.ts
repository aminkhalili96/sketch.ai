import type { AnalysisResult } from '@/types';

export type Project3DKind = 'enclosure' | 'object';

const OBJECT_KEYWORDS = [
    'teddy',
    'bear',
    'plush',
    'plushie',
    'stuffed',
    'toy',
    'doll',
    'figurine',
    'character',
    'animal',
    'bunny',
    'cat',
    'dog',
    'soft toy',
];

const ENCLOSURE_KEYWORDS = [
    'pcb',
    'circuit',
    'microcontroller',
    'mcu',
    'arduino',
    'esp32',
    'sensor',
    'battery',
    'led',
    'resistor',
    'capacitor',
    'connector',
    'enclosure',
    'firmware',
    'schematic',
    'bom',
];

function normalizeText(input: unknown): string {
    return typeof input === 'string' ? input.toLowerCase() : '';
}

function flattenAnalysis(analysis?: Partial<AnalysisResult>): string {
    if (!analysis) return '';
    const parts: string[] = [];
    if (analysis.summary) parts.push(analysis.summary);
    if (Array.isArray(analysis.identifiedComponents)) parts.push(analysis.identifiedComponents.join(' '));
    if (Array.isArray(analysis.suggestedFeatures)) parts.push(analysis.suggestedFeatures.join(' '));
    return parts.join('\n');
}

export function infer3DKind(description: string, analysis?: Partial<AnalysisResult>): Project3DKind {
    const text = `${description}\n${flattenAnalysis(analysis)}`.toLowerCase();

    // If it looks like a toy/character/object, model the object itself.
    if (OBJECT_KEYWORDS.some((k) => text.includes(k))) return 'object';

    // Otherwise default to the core product use-case: a hardware enclosure.
    // (We keep the keyword list mainly for future refinement.)
    if (ENCLOSURE_KEYWORDS.some((k) => text.includes(k))) return 'enclosure';
    return 'enclosure';
}

export function infer3DKindFromSceneElements(
    elements: Array<{ type: string; name?: string }> | null | undefined
): Project3DKind {
    if (!elements || elements.length === 0) return 'enclosure';

    const names = elements.map((e) => normalizeText(e.name)).join(' ');
    if (names.includes('enclosure') || names.includes('lid') || names.includes('pcb')) return 'enclosure';

    const enclosureTypes = new Set(['box', 'rounded-box']);
    const enclosureLikeCount = elements.filter((e) => enclosureTypes.has(e.type)).length;
    const organicCount = elements.filter((e) => e.type === 'sphere' || e.type === 'capsule').length;

    // If the scene is mostly spheres/capsules, it's likely an organic object (toy/character).
    if (organicCount >= Math.max(2, Math.ceil(elements.length * 0.4)) && organicCount > enclosureLikeCount) {
        return 'object';
    }

    // If most elements are boxes/rounded-boxes, treat as enclosure.
    if (enclosureLikeCount >= Math.ceil(elements.length * 0.6)) return 'enclosure';

    // Default to enclosure to preserve the app’s hardware-first behavior.
    return 'enclosure';
}

