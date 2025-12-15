import { sceneSchema } from '@/lib/validators';
import { infer3DKind, infer3DKindFromSceneElements } from '@/lib/projectKind';
import type { z } from 'zod';

type SceneElements = z.infer<typeof sceneSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function cleanModelJson(text: string): string {
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

export function parseSceneElements(text: string): SceneElements | null {
    const cleaned = cleanModelJson(text);
    const tryParse = (jsonText: string) => {
        const parsed = JSON.parse(jsonText) as unknown;
        const elements = Array.isArray(parsed)
            ? parsed
            : isRecord(parsed)
                ? parsed.elements ?? parsed.scene ?? parsed.objects
                : undefined;

        const validated = sceneSchema.safeParse(elements);
        if (validated.success) return validated.data;
        return null;
    };

    try {
        return tryParse(cleaned);
    } catch {
        // Try extracting the first JSON array substring.
    }

    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        try {
            return tryParse(cleaned.slice(arrayStart, arrayEnd + 1));
        } catch {
            return null;
        }
    }

    return null;
}

function fallbackEnclosureScene(description: string): SceneElements {
    const defaultDims: [number, number, number] = [80, 22, 35];
    const lower = description.toLowerCase();
    const dims: [number, number, number] =
        lower.includes('small') ? [40, 16, 28] :
            lower.includes('large') ? [120, 40, 80] :
                defaultDims;

    const [width, height, depth] = dims;
    const cornerRadius = Math.max(2, Math.min(8, Math.min(width, depth) * 0.08));
    const lidThickness = Math.max(2, Math.min(4, height * 0.15));

    const body: SceneElements[number] = {
        type: 'rounded-box',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        dimensions: [width, height, depth],
        radius: cornerRadius,
        smoothness: 8,
        color: '#F5F5F5',
        material: 'plastic',
        name: 'enclosure-body'
    };

    const lid: SceneElements[number] = {
        type: 'rounded-box',
        position: [0, height / 2 - lidThickness / 2 + 0.4, 0],
        rotation: [0, 0, 0],
        dimensions: [Math.max(1, width - 1.6), lidThickness, Math.max(1, depth - 1.6)],
        radius: Math.max(1, cornerRadius - 1),
        smoothness: 8,
        color: '#E5E5E5',
        material: 'plastic',
        name: 'enclosure-lid'
    };

    const screwOffsetX = width / 2 - Math.max(6, cornerRadius + 2);
    const screwOffsetZ = depth / 2 - Math.max(6, cornerRadius + 2);
    const screwTopY = height / 2 - lidThickness + 0.6;

    const screws: SceneElements = [
        { type: 'cylinder', position: [screwOffsetX, screwTopY, screwOffsetZ], rotation: [Math.PI / 2, 0, 0], dimensions: [1.6, lidThickness, 0], color: '#C0C0C0', material: 'metal', name: 'screw-1' },
        { type: 'cylinder', position: [-screwOffsetX, screwTopY, screwOffsetZ], rotation: [Math.PI / 2, 0, 0], dimensions: [1.6, lidThickness, 0], color: '#C0C0C0', material: 'metal', name: 'screw-2' },
        { type: 'cylinder', position: [screwOffsetX, screwTopY, -screwOffsetZ], rotation: [Math.PI / 2, 0, 0], dimensions: [1.6, lidThickness, 0], color: '#C0C0C0', material: 'metal', name: 'screw-3' },
        { type: 'cylinder', position: [-screwOffsetX, screwTopY, -screwOffsetZ], rotation: [Math.PI / 2, 0, 0], dimensions: [1.6, lidThickness, 0], color: '#C0C0C0', material: 'metal', name: 'screw-4' },
    ];

    return [body, lid, ...screws];
}

function fallbackToyScene(_description: string): SceneElements {
    // Approximate a cute "teddy bear" style silhouette using simple primitives.
    const headR = 45;
    const bodyR = 36;
    const bodyLen = 90;
    const armR = 14;
    const armLen = 55;
    const legR = 16;
    const legLen = 60;
    const earR = 16;
    const muzzleR = 16;
    const eyeR = 6;
    const noseR = 5;

    const headY = bodyLen / 2 + bodyR + headR * 0.6;

    const body: SceneElements[number] = {
        type: 'capsule',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        dimensions: [bodyR, bodyLen, 0],
        color: '#8B4513',
        material: 'plastic',
        name: 'body'
    };

    const head: SceneElements[number] = {
        type: 'sphere',
        position: [0, headY, 0],
        rotation: [0, 0, 0],
        dimensions: [headR, 0, 0],
        color: '#A0522D',
        material: 'plastic',
        name: 'head'
    };

    const earOffsetX = headR * 0.55;
    const earOffsetY = headY + headR * 0.55;
    const ears: SceneElements = [
        {
            type: 'sphere',
            position: [earOffsetX, earOffsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [earR, 0, 0],
            color: '#8B4513',
            material: 'plastic',
            name: 'ear-right'
        },
        {
            type: 'sphere',
            position: [-earOffsetX, earOffsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [earR, 0, 0],
            color: '#8B4513',
            material: 'plastic',
            name: 'ear-left'
        }
    ];

    const muzzle: SceneElements[number] = {
        type: 'sphere',
        position: [0, headY - headR * 0.1, headR * 0.7],
        rotation: [0, 0, 0],
        dimensions: [muzzleR, 0, 0],
        color: '#F5DEB3',
        material: 'plastic',
        name: 'muzzle'
    };

    // Eyes - positioned on the front of the head
    const eyeOffsetX = headR * 0.35;
    const eyeY = headY + headR * 0.15;
    const eyeZ = headR * 0.85;
    const eyes: SceneElements = [
        {
            type: 'sphere',
            position: [eyeOffsetX, eyeY, eyeZ],
            rotation: [0, 0, 0],
            dimensions: [eyeR, 0, 0],
            color: '#1A1A1A',
            material: 'plastic',
            name: 'eye-right'
        },
        {
            type: 'sphere',
            position: [-eyeOffsetX, eyeY, eyeZ],
            rotation: [0, 0, 0],
            dimensions: [eyeR, 0, 0],
            color: '#1A1A1A',
            material: 'plastic',
            name: 'eye-left'
        }
    ];

    // Nose - on the muzzle
    const nose: SceneElements[number] = {
        type: 'sphere',
        position: [0, headY - headR * 0.05, headR * 0.95],
        rotation: [0, 0, 0],
        dimensions: [noseR, 0, 0],
        color: '#2D2D2D',
        material: 'plastic',
        name: 'nose'
    };

    const armOffsetX = bodyR + armR + 8;
    const armOffsetY = bodyLen * 0.15;
    const arms: SceneElements = [
        {
            type: 'capsule',
            position: [armOffsetX, armOffsetY, 0],
            rotation: [0, 0, Math.PI / 7],
            dimensions: [armR, armLen, 0],
            color: '#A0522D',
            material: 'plastic',
            name: 'arm-right'
        },
        {
            type: 'capsule',
            position: [-armOffsetX, armOffsetY, 0],
            rotation: [0, 0, -Math.PI / 7],
            dimensions: [armR, armLen, 0],
            color: '#A0522D',
            material: 'plastic',
            name: 'arm-left'
        }
    ];

    const legOffsetX = bodyR * 0.5;
    const legOffsetY = -(bodyLen * 0.35 + legR);
    const legs: SceneElements = [
        {
            type: 'capsule',
            position: [legOffsetX, legOffsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [legR, legLen, 0],
            color: '#8B4513',
            material: 'plastic',
            name: 'leg-right'
        },
        {
            type: 'capsule',
            position: [-legOffsetX, legOffsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [legR, legLen, 0],
            color: '#8B4513',
            material: 'plastic',
            name: 'leg-left'
        }
    ];

    return [body, head, muzzle, nose, ...eyes, ...ears, ...arms, ...legs];
}

export function fallbackScene(description: string): SceneElements {
    const kind = infer3DKind(description);
    return kind === 'object' ? fallbackToyScene(description) : fallbackEnclosureScene(description);
}

export function computeSceneBounds(elements: SceneElements): { width: number; height: number; depth: number } | null {
    if (elements.length === 0) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const el of elements) {
        const [x, y, z] = el.position;
        const [a, b, c] = el.dimensions;

        let halfX = 0;
        let halfY = 0;
        let halfZ = 0;

        switch (el.type) {
            case 'box':
            case 'rounded-box':
                halfX = a / 2;
                halfY = b / 2;
                halfZ = c / 2;
                break;
            case 'cylinder':
                halfX = a;
                halfY = b / 2;
                halfZ = a;
                break;
            case 'sphere':
                halfX = a;
                halfY = a;
                halfZ = a;
                break;
            case 'capsule':
                halfX = a;
                halfY = b / 2 + a;
                halfZ = a;
                break;
            default:
                halfX = a / 2;
                halfY = b / 2;
                halfZ = c / 2;
        }

        minX = Math.min(minX, x - halfX);
        minY = Math.min(minY, y - halfY);
        minZ = Math.min(minZ, z - halfZ);
        maxX = Math.max(maxX, x + halfX);
        maxY = Math.max(maxY, y + halfY);
        maxZ = Math.max(maxZ, z + halfZ);
    }

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const depth = Math.max(0, maxZ - minZ);
    if (width === 0 || height === 0 || depth === 0) return null;

    return { width, height, depth };
}

function elementVolume(el: SceneElements[number]): number {
    const [a, b, c] = el.dimensions;
    switch (el.type) {
        case 'box':
        case 'rounded-box':
            return Math.abs(a * b * c);
        case 'cylinder':
            return Math.abs(Math.PI * a * a * b);
        case 'sphere':
            return Math.abs((4 / 3) * Math.PI * a * a * a);
        case 'capsule':
            // Cylinder plus two hemispheres.
            return Math.abs(Math.PI * a * a * b + (4 / 3) * Math.PI * a * a * a);
        default:
            return Math.abs(a * b * c);
    }
}

export function normalizeSceneColors(elements: SceneElements): SceneElements {
    if (elements.length === 0) return elements;

    let largestIndex = 0;
    let largestVolume = -1;
    for (let i = 0; i < elements.length; i++) {
        const vol = elementVolume(elements[i]);
        if (vol > largestVolume) {
            largestVolume = vol;
            largestIndex = i;
        }
    }

    return elements.map((el, idx) => {
        const normalizedMaterial = el.material ?? 'plastic';

        // Default colors - only used if LLM didn't provide a color
        const defaultColorByMaterial: Record<NonNullable<typeof normalizedMaterial>, string> = {
            plastic: idx === largestIndex ? '#D4A574' : '#C4956A', // Warm brown for plush toys
            metal: '#C0C0C0',
            glass: '#E5E7EB',
            rubber: '#8B7355',
        };

        // Preserve LLM-generated colors if valid, otherwise use defaults
        const hasValidColor = el.color && /^#[0-9A-Fa-f]{6}$/.test(el.color);

        return {
            ...el,
            material: normalizedMaterial,
            color: hasValidColor ? el.color : defaultColorByMaterial[normalizedMaterial],
        };
    });
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function distance3([x, y, z]: [number, number, number]): number {
    return Math.sqrt(x * x + y * y + z * z);
}

export function beautifyScene(elements: SceneElements, description?: string): SceneElements {
    const kind = description
        ? infer3DKind(description)
        : infer3DKindFromSceneElements(elements);

    const filtered = elements.filter((el) => {
        const [a, b, c] = el.dimensions;
        return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && (a !== 0 || b !== 0 || c !== 0);
    });

    if (filtered.length === 0) {
        return fallbackScene(description || 'Hardware project');
    }

    // Find the largest element and treat it as the main body.
    let largestIndex = 0;
    let largestVolume = -1;
    for (let i = 0; i < filtered.length; i++) {
        const vol = elementVolume(filtered[i]);
        if (vol > largestVolume) {
            largestVolume = vol;
            largestIndex = i;
        }
    }

    const main = filtered[largestIndex];
    const mainDims: [number, number, number] = [
        Math.abs(main.dimensions[0]),
        Math.abs(main.dimensions[1]),
        Math.abs(main.dimensions[2]),
    ];
    const maxDim = Math.max(Math.abs(mainDims[0]), Math.abs(mainDims[1]), Math.abs(mainDims[2]), 1);
    const outlierDistance = maxDim * 2;

    const recentered = filtered
        .map((el, idx) => {
            const isMain = idx === largestIndex;
            const [x, y, z] = el.position;

            const position: [number, number, number] = isMain ? [0, 0, 0] : [x - main.position[0], y - main.position[1], z - main.position[2]];
            const rotation: [number, number, number] | undefined = isMain
                ? [0, 0, 0]
                : el.rotation
                    ? [
                        clampNumber(el.rotation[0], -Math.PI, Math.PI),
                        clampNumber(el.rotation[1], -Math.PI, Math.PI),
                        clampNumber(el.rotation[2], -Math.PI, Math.PI),
                    ]
                    : undefined;

            // Encourage a clean, product-like enclosure: rounded main body.
            const shouldRoundMain = kind === 'enclosure' && isMain && (el.type === 'box' || el.type === 'rounded-box');
            const type = shouldRoundMain ? 'rounded-box' : el.type;
            const radius = shouldRoundMain
                ? clampNumber(el.radius ?? Math.min(Math.abs(mainDims[0]), Math.abs(mainDims[2])) * 0.08, 1, 12)
                : el.radius;

            return {
                ...el,
                type,
                position,
                rotation,
                radius,
                smoothness: shouldRoundMain ? (el.smoothness ?? 8) : el.smoothness,
                dimensions: [
                    Math.abs(clampNumber(el.dimensions[0], -500, 500)),
                    Math.abs(clampNumber(el.dimensions[1], -500, 500)),
                    Math.abs(clampNumber(el.dimensions[2], -500, 500)),
                ] as [number, number, number],
            };
        })
        .filter((el) => distance3(el.position) <= outlierDistance);

    // Ensure at least a body + lid for a more realistic enclosure look.
    const hasLid = recentered.some((el) => (el.name || '').toLowerCase().includes('lid'));
    if (kind === 'enclosure' && !hasLid) {
        const [width, height, depth] = mainDims;
        const cornerRadius = clampNumber(Math.min(Math.abs(width), Math.abs(depth)) * 0.08, 2, 10);
        const lidThickness = clampNumber(Math.abs(height) * 0.15, 2, 4);

        recentered.push({
            type: 'rounded-box',
            position: [0, height / 2 - lidThickness / 2 + 0.4, 0],
            rotation: [0, 0, 0],
            dimensions: [Math.max(1, width - 1.6), lidThickness, Math.max(1, depth - 1.6)] as [number, number, number],
            radius: Math.max(1, cornerRadius - 1),
            smoothness: 8,
            color: '#E5E5E5',
            material: 'plastic',
            name: 'enclosure-lid'
        });
    }

    return recentered;
}
