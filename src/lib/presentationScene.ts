import { computeSceneBounds, parseSceneElements } from '@/lib/scene';
import { infer3DKind } from '@/lib/projectKind';
import type { AnalysisResult } from '@/types';

export type PresentationElement = {
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule';
    position: [number, number, number];
    rotation?: [number, number, number];
    dimensions: [number, number, number];
    color: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber';
    name?: string;
    radius?: number;
    smoothness?: number;
};

export type PresentationScene = {
    assembled: PresentationElement[];
    exploded: PresentationElement[];
    boardShape: 'round' | 'rect';
    boardRadius: number;
    boardSize: { width: number; depth: number };
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
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

function isRoundForm(description: string, width: number, depth: number): boolean {
    const roundHint = /(round|circular|disc|puck|coin|button)/i.test(description);
    if (roundHint) return true;
    const ratio = Math.abs(width - depth) / Math.max(width, depth);
    return ratio < 0.15;
}

function buildComponentArray(
    boardRadius: number,
    boardThickness: number,
    seed: number,
    count: number
): PresentationElement[] {
    const rand = mulberry32(seed);
    const components: PresentationElement[] = [];

    const palette = ['#5A5248', '#6A5F52', '#4D463E', '#72685C'];
    for (let i = 0; i < count; i++) {
        const w = clamp(4 + rand() * 9, 4, 14);
        const d = clamp(4 + rand() * 9, 4, 14);
        const h = clamp(1.5 + rand() * 2.5, 1.5, 4);
        const angle = rand() * Math.PI * 2;
        const radius = boardRadius * (0.15 + rand() * 0.65);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        components.push({
            type: 'box',
            position: [x, boardThickness / 2 + h / 2 + 0.4, z],
            rotation: [0, rand() * 0.2 - 0.1, 0],
            dimensions: [w, h, d],
            color: palette[i % palette.length],
            material: 'plastic',
            name: `component-${i + 1}`,
        });
    }

    components.push({
        type: 'box',
        position: [0, boardThickness / 2 + 2.5, 0],
        rotation: [0, 0, 0],
        dimensions: [20, 4, 18],
        color: '#2F2A24',
        material: 'plastic',
        name: 'main-ic',
    });

    return components;
}

export function buildPresentationScene(options: {
    description: string;
    analysis?: AnalysisResult;
    sceneJson?: string;
}): PresentationScene {
    const { description, analysis, sceneJson } = options;
    const parsed = sceneJson ? parseSceneElements(sceneJson) : null;
    const bounds = parsed ? computeSceneBounds(parsed) : null;

    const width = bounds?.width ?? 110;
    const depth = bounds?.depth ?? width;
    const height = bounds?.height ?? 32;

    const kind = infer3DKind(description, analysis);
    if (kind === 'object' && parsed) {
        return {
            assembled: parsed as PresentationElement[],
            exploded: parsed as PresentationElement[],
            boardShape: 'round',
            boardRadius: Math.min(width, depth) / 2,
            boardSize: { width, depth },
        };
    }

    const roundBody = isRoundForm(description, width, depth);
    const bodyRadius = Math.max(38, Math.min(width, depth) / 2);
    const bodyWidth = Math.max(90, width);
    const bodyDepth = Math.max(90, depth);
    const bodyHeight = Math.max(26, height);

    const boardRadius = clamp(bodyRadius * 0.82, 26, 60);
    const boardWidth = clamp(bodyWidth * 0.82, 60, 100);
    const boardDepth = clamp(bodyDepth * 0.82, 60, 100);

    const boardThickness = clamp(bodyHeight * 0.12, 2, 4);
    const topHeight = clamp(bodyHeight * 0.55, 12, 26);
    const bottomHeight = clamp(bodyHeight * 0.4, 10, 22);
    const gap = clamp(bodyHeight * 0.12, 2, 5);

    const palette = {
        shellTop: '#B5ABA0',
        shellBottom: '#9E9488',
        board: '#B28A5A',
        metal: '#B7BCC2',
        gasket: '#7C746B',
    };

    const topY = boardThickness / 2 + gap + topHeight / 2;
    const bottomY = -(boardThickness / 2 + gap + bottomHeight / 2);

    const shellTop: PresentationElement = roundBody
        ? {
            type: 'cylinder',
            position: [0, topY, 0],
            rotation: [0, 0, 0],
            dimensions: [bodyRadius, topHeight, 0],
            color: palette.shellTop,
            material: 'plastic',
            name: 'shell-top',
        }
        : {
            type: 'rounded-box',
            position: [0, topY, 0],
            rotation: [0, 0, 0],
            dimensions: [bodyWidth, topHeight, bodyDepth],
            radius: clamp(Math.min(bodyWidth, bodyDepth) * 0.12, 6, 14),
            smoothness: 10,
            color: palette.shellTop,
            material: 'plastic',
            name: 'shell-top',
        };

    const shellBottom: PresentationElement = roundBody
        ? {
            type: 'cylinder',
            position: [0, bottomY, 0],
            rotation: [0, 0, 0],
            dimensions: [bodyRadius * 0.95, bottomHeight, 0],
            color: palette.shellBottom,
            material: 'plastic',
            name: 'shell-bottom',
        }
        : {
            type: 'rounded-box',
            position: [0, bottomY, 0],
            rotation: [0, 0, 0],
            dimensions: [bodyWidth * 0.96, bottomHeight, bodyDepth * 0.96],
            radius: clamp(Math.min(bodyWidth, bodyDepth) * 0.1, 6, 12),
            smoothness: 10,
            color: palette.shellBottom,
            material: 'plastic',
            name: 'shell-bottom',
        };

    const pcb: PresentationElement = roundBody
        ? {
            type: 'cylinder',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            dimensions: [boardRadius, boardThickness, 0],
            color: palette.board,
            material: 'plastic',
            name: 'pcb-board',
        }
        : {
            type: 'rounded-box',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            dimensions: [boardWidth, boardThickness, boardDepth],
            radius: clamp(Math.min(boardWidth, boardDepth) * 0.08, 4, 10),
            smoothness: 8,
            color: palette.board,
            material: 'plastic',
            name: 'pcb-board',
        };

    const portX = roundBody ? bodyRadius * 0.75 : bodyWidth / 2 - 10;
    const port: PresentationElement = {
        type: 'rounded-box',
        position: [portX, 0, 0],
        rotation: [0, Math.PI / 2, 0],
        dimensions: [12, 6, 16],
        radius: 1.5,
        smoothness: 6,
        color: palette.metal,
        material: 'metal',
        name: 'usb-port',
    };

    const seedBase = hashString(description || 'presentation');
    const componentCount = clamp(analysis?.identifiedComponents?.length ?? 10, 8, 16);
    const components = buildComponentArray(boardRadius, boardThickness, seedBase, componentCount);

    const assembled = [shellTop, pcb, ...components, port, shellBottom];
    const exploded = assembled.map((el) => {
        const [x, y, z] = el.position;
        let offset = 0;
        if (el.name?.includes('shell-top')) offset = 28;
        if (el.name?.includes('pcb')) offset = 8;
        if (el.name?.includes('component')) offset = 10;
        if (el.name?.includes('port')) offset = 12;
        if (el.name?.includes('shell-bottom')) offset = -26;
        return {
            ...el,
            position: [x, y + offset, z] as [number, number, number],
        };
    });

    return {
        assembled,
        exploded,
        boardShape: roundBody ? 'round' : 'rect',
        boardRadius,
        boardSize: { width: boardWidth, depth: boardDepth },
    };
}
