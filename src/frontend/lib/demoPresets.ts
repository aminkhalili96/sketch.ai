import type { ProjectOutputs } from '@/shared/types';
import { VOXEL_ELEMENTS } from './voxelData';
export type DemoEnvironmentPreset = 'studio' | 'warehouse' | 'sunset' | 'park' | 'night';

export type DemoSceneElement = {
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule' | 'torus' | 'plane' | 'half-sphere';
    position: [number, number, number];
    rotation?: [number, number, number];
    dimensions: [number, number, number];
    color: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber' | 'emissive' | 'flat';
    name?: string;
    radius?: number;
    smoothness?: number;
    texture?: string;
    opacity?: number;
    emissiveColor?: string;
};

export type DemoPresentationScene = {
    assembled: DemoSceneElement[];
    exploded: DemoSceneElement[];
    boardShape: 'round' | 'rect';
    boardRadius: number;
    boardSize: { width: number; depth: number };
};

export type DemoPreset = {
    id: string;
    title: string;
    description: string;
    prompt: string;
    assets: {
        pcbFront: string;
        pcbBack: string;
        circuitDiagram: string;
    };
    scene: DemoPresentationScene;
    outputs?: Partial<ProjectOutputs>;
    orderCtaLabel?: string;
    heroView?: {
        cameraPosition: [number, number, number];
        cameraTarget: [number, number, number];
        fov: number;
        background: string;
        environment: DemoEnvironmentPreset;
        locked: boolean;
    };
};

const MATERIALS = {
    shellTop: '#B9B2A8',
    shellBottom: '#8F8983',
    shellAccent: '#6F6A64',
    pcb: '#C9A571',
    pcbDark: '#B79060',
    chip: '#6E6A66',
    chipMid: '#847C73',
    metal: '#AFA7A0',
    led: '#232323',
};

function rotateElementAroundY(element: DemoSceneElement, angle: number): DemoSceneElement {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [x, y, z] = element.position;
    const nextRotation = element.rotation
        ? [element.rotation[0], element.rotation[1] + angle, element.rotation[2]] as [number, number, number]
        : [0, angle, 0] as [number, number, number];

    return {
        ...element,
        position: [x * cos - z * sin, y, x * sin + z * cos],
        rotation: nextRotation,
    };
}

const buildPuckScene = (): DemoPresentationScene => {
    const boardRadius = 46;
    const boardThickness = 4;
    const topHeight = 16;
    const bottomHeight = 12;
    const gap = 6;
    const explodedGap = 20;

    const boardTopY = boardThickness / 2;
    const topY = boardTopY + gap + topHeight / 2;
    const bottomY = -(boardTopY + gap + bottomHeight / 2);

    const makeChip = (
        name: string,
        x: number,
        z: number,
        w: number,
        d: number,
        h: number,
        color: string,
        rounded = true
    ): DemoSceneElement => ({
        type: rounded ? 'rounded-box' : 'box',
        position: [x, boardTopY + h / 2 + 0.6, z],
        rotation: [0, 0, 0],
        dimensions: [w, h, d],
        radius: rounded ? 1.2 : undefined,
        smoothness: rounded ? 6 : undefined,
        color,
        material: 'plastic',
        name,
    });

    const boardElements: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            dimensions: [boardRadius, boardThickness, 0],
            color: MATERIALS.pcb,
            material: 'plastic',
            name: 'pcb-board',
        },
        {
            type: 'cylinder',
            position: [0, boardTopY + 0.2, 0],
            rotation: [0, 0, 0],
            dimensions: [boardRadius - 2, 0.6, 0],
            color: MATERIALS.pcbDark,
            material: 'plastic',
            name: 'pcb-solder-mask',
        },
        {
            type: 'rounded-box',
            position: [0, boardTopY + 3.2, boardRadius - 8],
            rotation: [0, 0, 0],
            dimensions: [18, 6, 12],
            radius: 1.6,
            smoothness: 8,
            color: MATERIALS.metal,
            material: 'metal',
            name: 'usb-c',
        },
        makeChip('main-ic', 0, -2, 18, 14, 3.4, MATERIALS.chip),
        makeChip('sensor-ic', -16, -12, 10, 8, 2.6, MATERIALS.chipMid),
        makeChip('rf-module', 15, -12, 14, 8, 2.4, MATERIALS.chipMid),
        makeChip('pmic', -18, 10, 9, 7, 2.4, MATERIALS.chip),
        makeChip('memory', 16, 10, 8, 6, 2.2, MATERIALS.chip),
        makeChip('button', 0, 18, 8, 8, 2, MATERIALS.shellAccent),
        makeChip('sensor-pack', -4, 14, 6, 5, 1.6, MATERIALS.chipMid, false),
        makeChip('caps-1', 22, 2, 6, 3, 1.4, MATERIALS.shellAccent, false),
        makeChip('caps-2', -22, 2, 6, 3, 1.4, MATERIALS.shellAccent, false),
        makeChip('caps-3', 12, 6, 5, 3, 1.2, MATERIALS.shellAccent, false),
        makeChip('caps-4', -12, 6, 5, 3, 1.2, MATERIALS.shellAccent, false),
    ];

    const topShell = (y: number): DemoSceneElement[] => [
        {
            type: 'cylinder',
            position: [0, y, 0],
            rotation: [0, 0, 0],
            dimensions: [54, topHeight, 0],
            color: MATERIALS.shellTop,
            material: 'plastic',
            name: 'shell-top',
        },
        {
            type: 'rounded-box',
            position: [0, y - 2, 50],
            rotation: [0, 0, 0],
            dimensions: [22, 6, 8],
            radius: 1.8,
            smoothness: 8,
            color: MATERIALS.shellAccent,
            material: 'plastic',
            name: 'usb-cutout',
        },
        {
            type: 'sphere',
            position: [14, y + topHeight / 2 - 1.4, 6],
            rotation: [0, 0, 0],
            dimensions: [1.6, 0, 0],
            color: MATERIALS.led,
            material: 'plastic',
            name: 'status-led',
        },
    ];

    const bottomShell = (y: number): DemoSceneElement[] => [
        {
            type: 'cylinder',
            position: [0, y, 0],
            rotation: [0, 0, 0],
            dimensions: [56, bottomHeight, 0],
            color: MATERIALS.shellBottom,
            material: 'plastic',
            name: 'shell-bottom',
        },
        {
            type: 'cylinder',
            position: [0, y + bottomHeight / 2 - 1.2, 0],
            rotation: [0, 0, 0],
            dimensions: [50, 2.4, 0],
            color: '#7A746F',
            material: 'plastic',
            name: 'shell-lip',
        },
    ];

    const assembled = [
        ...topShell(topY),
        ...boardElements,
        ...bottomShell(bottomY),
    ];

    const exploded = [
        ...topShell(topY + explodedGap),
        ...boardElements,
        ...bottomShell(bottomY - explodedGap),
    ];

    return {
        assembled,
        exploded,
        boardShape: 'round',
        boardRadius,
        boardSize: { width: boardRadius * 2, depth: boardRadius * 2 },
    };
};

const PUCK_SCENE = buildPuckScene();

const buildSmartTrackerTagScene = (): DemoPresentationScene => {
    const boardRadius = 44.2;
    const boardThickness = 3.2;
    const topHeight = 15.2;
    const bottomHeight = 6.8;
    const gap = 7.2;

    const boardTopY = boardThickness / 2;
    const topY = boardTopY + gap + topHeight / 2;
    const bottomY = -(boardTopY + gap + bottomHeight / 2);

    const topShell: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, topY, 0],
            dimensions: [53.8, topHeight, 0],
            color: '#7D848D',
            material: 'plastic',
            name: 'shell-top',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 - 0.9, 0],
            dimensions: [52.2, 1.8, 0],
            color: '#C2A587',
            material: 'flat',
            name: 'shell-top-bevel',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 - 0.1, 0],
            dimensions: [49.8, 0.9, 0],
            color: '#C7AA8B',
            material: 'flat',
            name: 'shell-top-face',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 + 0.05, 0],
            dimensions: [47.2, 0.35, 0],
            color: '#BFA284',
            material: 'flat',
            name: 'shell-top-face-inner',
        },
        {
            type: 'cylinder',
            position: [15.8, topY + topHeight / 2 + 0.06, 6.8],
            dimensions: [1.15, 0.35, 0],
            color: '#2A2A2A',
            material: 'plastic',
            name: 'status-led',
        },
        {
            type: 'box',
            position: [-27.5, topY - 5.5, 14.8],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [6.2, 5.8, 18.2],
            color: '#757D86',
            material: 'plastic',
            name: 'usb-cutout',
        },
        {
            type: 'box',
            position: [-28.2, topY - 5.5, 15.2],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [5.8, 6.2, 17.6],
            color: '#59616A',
            material: 'plastic',
            name: 'usb-cutout-inner',
        },
        {
            type: 'torus',
            position: [27.8, topY - 3.5, -4],
            rotation: [Math.PI / 2, 0, 0],
            dimensions: [6.1, 1.8, 0],
            color: '#737B84',
            material: 'plastic',
            name: 'lanyard-loop',
        },
        {
            type: 'cylinder',
            position: [27.8, topY - 3.5, -4],
            dimensions: [4.4, 7, 0],
            color: '#4A515A',
            material: 'plastic',
            name: 'lanyard-hole',
        },
    ];

    const boardElements: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, 0, 0],
            dimensions: [boardRadius, boardThickness, 0],
            color: '#B7936F',
            material: 'plastic',
            name: 'pcb-board',
        },
        {
            type: 'cylinder',
            position: [0, -boardThickness / 2 + 0.25, 0],
            dimensions: [boardRadius + 0.5, 0.5, 0],
            color: '#8A6A4D',
            material: 'plastic',
            name: 'pcb-edge',
        },
        {
            type: 'cylinder',
            position: [0, boardTopY + 0.15, 0],
            dimensions: [boardRadius - 1.8, 0.55, 0],
            color: '#C1A17C',
            material: 'plastic',
            name: 'pcb-solder-mask',
        },
        {
            type: 'rounded-box',
            position: [-27.5, boardTopY + 2.45, 14.8],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [16.4, 4.7, 10.3],
            radius: 1.8,
            smoothness: 10,
            color: '#D8DADD',
            material: 'metal',
            name: 'usb-c',
        },
        {
            type: 'rounded-box',
            position: [-27.9, boardTopY + 2.4, 15.0],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [10.2, 2.1, 8.2],
            radius: 1.2,
            smoothness: 8,
            color: '#2B2E32',
            material: 'plastic',
            name: 'usb-c-inner',
        },
        {
            type: 'box',
            position: [-26.7, boardTopY + 2.28, 14.3],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [9.2, 0.95, 2.5],
            color: '#B2B6BA',
            material: 'metal',
            name: 'usb-c-tab',
        },
        {
            type: 'rounded-box',
            position: [-1.4, boardTopY + 2.2, 2.2],
            dimensions: [17.2, 2.5, 17.2],
            radius: 1.2,
            smoothness: 8,
            color: '#8E949B',
            material: 'plastic',
            name: 'main-ic',
        },
        {
            type: 'rounded-box',
            position: [14.5, boardTopY + 1.95, -12.2],
            dimensions: [10.1, 2, 8.9],
            radius: 1,
            smoothness: 7,
            color: '#7D858D',
            material: 'plastic',
            name: 'rf-module',
        },
        {
            type: 'rounded-box',
            position: [-10.5, boardTopY + 1.95, -13.5],
            dimensions: [13.8, 2, 7.3],
            radius: 1,
            smoothness: 7,
            color: '#838B93',
            material: 'plastic',
            name: 'sensor-ic',
        },
        {
            type: 'rounded-box',
            position: [19.1, boardTopY + 1.8, 11.9],
            dimensions: [6.2, 1.8, 6.2],
            radius: 1,
            smoothness: 6,
            color: '#676F76',
            material: 'plastic',
            name: 'pmic',
        },
        {
            type: 'rounded-box',
            position: [-11.2, boardTopY + 1.8, 4.2],
            dimensions: [7, 1.8, 7],
            radius: 1,
            smoothness: 6,
            color: '#767E86',
            material: 'plastic',
            name: 'flash',
        },
        { type: 'box', position: [14.2, boardTopY + 1.35, -2.1], dimensions: [3.3, 1.05, 2.1], color: '#5F6469', material: 'plastic', name: 'caps-1' },
        { type: 'box', position: [14.2, boardTopY + 1.35, 1.5], dimensions: [3.3, 1.05, 2.1], color: '#5F6469', material: 'plastic', name: 'caps-2' },
        { type: 'box', position: [14.2, boardTopY + 1.35, 5.1], dimensions: [3.3, 1.05, 2.1], color: '#5F6469', material: 'plastic', name: 'caps-3' },
        { type: 'box', position: [19.2, boardTopY + 1.35, 1.5], dimensions: [3.3, 1.05, 2.1], rotation: [0, Math.PI / 2, 0], color: '#5F6469', material: 'plastic', name: 'caps-4' },
        { type: 'box', position: [2.2, boardTopY + 1.25, -18.5], dimensions: [4.2, 1.25, 2.8], color: '#60656A', material: 'plastic', name: 'caps-5' },
        { type: 'box', position: [28.2, boardTopY + 1.25, -5.5], dimensions: [3.2, 1.15, 2.4], color: '#60656A', material: 'plastic', name: 'caps-6' },
        { type: 'box', position: [22.4, boardTopY + 1.22, -22.6], dimensions: [4.2, 1.05, 2.5], color: '#656A70', material: 'plastic', name: 'caps-7' },
        { type: 'box', position: [-2.4, boardTopY + 1.22, -26.6], dimensions: [4.2, 1.05, 2.5], color: '#656A70', material: 'plastic', name: 'caps-8' },
        { type: 'box', position: [8.1, boardTopY + 1.12, 16.8], dimensions: [3.2, 0.95, 2], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-9' },
        { type: 'box', position: [8.1, boardTopY + 1.12, 20.8], dimensions: [3.2, 0.95, 2], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-10' },
        { type: 'box', position: [2.1, boardTopY + 1.12, 16.8], dimensions: [3.2, 0.95, 2], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-11' },
        { type: 'box', position: [-19.8, boardTopY + 1.12, 32.2], dimensions: [3.8, 1, 2.1], color: '#585D63', material: 'plastic', name: 'caps-12' },
        { type: 'box', position: [-24.8, boardTopY + 1.12, 32.2], dimensions: [3.8, 1, 2.1], color: '#585D63', material: 'plastic', name: 'caps-13' },
        { type: 'box', position: [-25.8, boardTopY + 1.12, 11.2], dimensions: [3.8, 1, 2.1], rotation: [0, Math.PI / 2, 0], color: '#585D63', material: 'plastic', name: 'caps-14' },
        { type: 'box', position: [-25.8, boardTopY + 1.12, 14.2], dimensions: [3.8, 1, 2.1], rotation: [0, Math.PI / 2, 0], color: '#585D63', material: 'plastic', name: 'caps-15' },
        { type: 'box', position: [-25.8, boardTopY + 1.12, 17.2], dimensions: [3.8, 1, 2.1], rotation: [0, Math.PI / 2, 0], color: '#585D63', material: 'plastic', name: 'caps-16' },
        { type: 'box', position: [-34.8, boardTopY + 1.12, -0.7], dimensions: [3.8, 1, 2.1], rotation: [0, -Math.PI / 6, 0], color: '#585D63', material: 'plastic', name: 'caps-17' },
        { type: 'box', position: [-36.8, boardTopY + 1.12, -4.7], dimensions: [3.8, 1, 2.1], rotation: [0, -Math.PI / 4, 0], color: '#585D63', material: 'plastic', name: 'caps-18' },
    ];

    const calibratedBoardElements = boardElements.map((element) => {
        const name = element.name ?? '';
        if (name === 'usb-c' || name === 'usb-c-tab') {
            return { ...element, material: 'metal' as const };
        }
        if (name === 'usb-c-inner') {
            return { ...element, material: 'flat' as const, color: '#34373C' };
        }
        if (name.startsWith('pcb-')) {
            return { ...element, material: 'flat' as const };
        }
        return { ...element, material: 'flat' as const };
    });

    const bottomShell: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, bottomY + 0.9, 0],
            dimensions: [55.4, 6.6, 0],
            color: '#7B828A',
            material: 'plastic',
            name: 'shell-bottom',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.6, 0],
            dimensions: [50.6, 1, 0],
            color: '#7F8790',
            material: 'plastic',
            name: 'shell-bottom-top-rim',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.9, 0],
            dimensions: [50.8, 0.9, 0],
            color: '#818993',
            material: 'plastic',
            name: 'shell-bottom-inner-lip',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 0.95, 0],
            dimensions: [43.8, 1.45, 0],
            color: '#BDB2A4',
            material: 'flat',
            name: 'shell-bottom-floor',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 1.85, 0],
            dimensions: [46.6, 0.95, 0],
            color: '#7F8791',
            material: 'plastic',
            name: 'shell-bottom-inner-cut',
        },
        {
            type: 'cylinder',
            position: [0, bottomY - 2.9, 0],
            dimensions: [56.1, 1.7, 0],
            color: '#757D86',
            material: 'plastic',
            name: 'shell-bottom-base-step',
        },
        {
            type: 'box',
            position: [0, bottomY + 0.4, 21.2],
            rotation: [Math.PI / 8, 0, 0],
            dimensions: [3.2, 6.4, 6.2],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-1',
        },
        {
            type: 'box',
            position: [-18.8, bottomY - 0.35, -9],
            rotation: [Math.PI / 8, -Math.PI / 3, 0],
            dimensions: [3.2, 6.2, 6.2],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-2',
        },
        {
            type: 'box',
            position: [18.8, bottomY - 0.35, -9],
            rotation: [Math.PI / 8, Math.PI / 3, 0],
            dimensions: [3.2, 6.2, 6.2],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-3',
        },
    ];

    const assembled = [...topShell, ...calibratedBoardElements, ...bottomShell];

    const explodedOffsetMap = [
        { pattern: /^shell-top|^usb-cutout|^status-led|^lanyard-/, offset: 26 },
        { pattern: /^pcb-|^usb-c|^main-ic|^sensor-ic|^rf-module|^pmic|^flash|^caps-/, offset: 5.5 },
        { pattern: /^shell-bottom|^shell-standoff|^shell-rib|^shell-divider|^shell-key|^shell-arc|^shell-wall/, offset: -19.5 },
    ];

    const exploded = assembled.map((element) => {
        const offset = explodedOffsetMap.find(({ pattern }) => pattern.test(element.name ?? ''))?.offset ?? 0;
        return {
            ...element,
            position: [
                element.position[0],
                element.position[1] + offset,
                element.position[2],
            ] as [number, number, number],
        };
    });

    return {
        assembled,
        exploded,
        boardShape: 'round',
        boardRadius,
        boardSize: { width: boardRadius * 2, depth: boardRadius * 2 },
    };
};

const SMART_TRACKER_TAG_SCENE = buildSmartTrackerTagScene();

const buildIoTPuckScene = (): DemoPresentationScene => {
    const boardRadius = 42;
    const boardThickness = 3.0;
    const topHeight = 16;
    const bottomHeight = 8;
    const gap = 6.5;

    const boardTopY = boardThickness / 2;
    const topY = boardTopY + gap + topHeight / 2;
    const bottomY = -(boardTopY + gap + bottomHeight / 2);

    const topShell: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, topY, 0],
            dimensions: [50, topHeight, 0],
            color: '#6B7178',
            material: 'plastic',
            name: 'shell-top',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 - 0.8, 0],
            dimensions: [48.5, 1.6, 0],
            color: '#C4A88A',
            material: 'flat',
            name: 'shell-top-bevel',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 - 0.05, 0],
            dimensions: [46.2, 0.8, 0],
            color: '#C7AB8D',
            material: 'flat',
            name: 'shell-top-face',
        },
        {
            type: 'cylinder',
            position: [0, topY + topHeight / 2 + 0.08, 0],
            dimensions: [43.5, 0.3, 0],
            color: '#BFA284',
            material: 'flat',
            name: 'shell-top-face-inner',
        },
        {
            type: 'cylinder',
            position: [14, topY + topHeight / 2 + 0.1, 5.5],
            dimensions: [1.1, 0.3, 0],
            color: '#2A2A2A',
            material: 'plastic',
            name: 'status-led',
        },
        {
            type: 'torus',
            position: [26, topY - 2.5, -3.5],
            rotation: [Math.PI / 2, 0, 0],
            dimensions: [5.8, 1.6, 0],
            color: '#737B84',
            material: 'plastic',
            name: 'lanyard-loop',
        },
        {
            type: 'cylinder',
            position: [26, topY - 2.5, -3.5],
            dimensions: [4.2, 6.5, 0],
            color: '#4A515A',
            material: 'plastic',
            name: 'lanyard-hole',
        },
        {
            type: 'box',
            position: [0, topY - 4.8, boardRadius + 2],
            rotation: [0, 0, 0],
            dimensions: [5.8, 5.4, 16.8],
            color: '#606870',
            material: 'plastic',
            name: 'usb-cutout',
        },
        {
            type: 'box',
            position: [0, topY - 4.8, boardRadius + 2.4],
            rotation: [0, 0, 0],
            dimensions: [5.4, 5.8, 16.2],
            color: '#4A5258',
            material: 'plastic',
            name: 'usb-cutout-inner',
        },
    ];

    const boardElements: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, 0, 0],
            dimensions: [boardRadius, boardThickness, 0],
            color: '#B89570',
            material: 'flat',
            name: 'pcb-board',
        },
        {
            type: 'cylinder',
            position: [0, boardTopY + 0.15, 0],
            dimensions: [boardRadius - 1.5, 0.5, 0],
            color: '#C1A17C',
            material: 'flat',
            name: 'pcb-solder-mask',
        },
        {
            type: 'rounded-box',
            position: [0, boardTopY + 2.3, boardRadius - 6],
            rotation: [0, 0, 0],
            dimensions: [15, 4.2, 9.5],
            radius: 1.6,
            smoothness: 10,
            color: '#D8DADD',
            material: 'metal',
            name: 'usb-c',
        },
        {
            type: 'rounded-box',
            position: [0, boardTopY + 2.25, boardRadius - 5.8],
            rotation: [0, 0, 0],
            dimensions: [9.5, 1.9, 7.6],
            radius: 1.1,
            smoothness: 8,
            color: '#2B2E32',
            material: 'flat',
            name: 'usb-c-inner',
        },
        {
            type: 'rounded-box',
            position: [-1.2, boardTopY + 2.0, 1.8],
            dimensions: [15.5, 2.3, 15.5],
            radius: 1.2,
            smoothness: 8,
            color: '#8E949B',
            material: 'plastic',
            name: 'main-ic',
        },
        {
            type: 'rounded-box',
            position: [13, boardTopY + 1.8, -11],
            dimensions: [9.5, 1.8, 8.2],
            radius: 1,
            smoothness: 7,
            color: '#7D858D',
            material: 'plastic',
            name: 'rf-module',
        },
        {
            type: 'rounded-box',
            position: [-9.5, boardTopY + 1.8, -12.5],
            dimensions: [12.5, 1.8, 6.8],
            radius: 1,
            smoothness: 7,
            color: '#838B93',
            material: 'plastic',
            name: 'sensor-ic',
        },
        {
            type: 'rounded-box',
            position: [17, boardTopY + 1.65, 10.5],
            dimensions: [5.8, 1.6, 5.8],
            radius: 1,
            smoothness: 6,
            color: '#676F76',
            material: 'plastic',
            name: 'pmic',
        },
        { type: 'box', position: [12.5, boardTopY + 1.2, -1.8], dimensions: [3, 1, 2], color: '#5F6469', material: 'plastic', name: 'caps-1' },
        { type: 'box', position: [12.5, boardTopY + 1.2, 1.5], dimensions: [3, 1, 2], color: '#5F6469', material: 'plastic', name: 'caps-2' },
        { type: 'box', position: [12.5, boardTopY + 1.2, 4.8], dimensions: [3, 1, 2], color: '#5F6469', material: 'plastic', name: 'caps-3' },
        { type: 'box', position: [17.5, boardTopY + 1.2, 1.5], dimensions: [3, 1, 2], rotation: [0, Math.PI / 2, 0], color: '#5F6469', material: 'plastic', name: 'caps-4' },
        { type: 'box', position: [2, boardTopY + 1.1, -17], dimensions: [3.8, 1.1, 2.5], color: '#60656A', material: 'plastic', name: 'caps-5' },
        { type: 'box', position: [25, boardTopY + 1.1, -4.8], dimensions: [3, 1, 2.2], color: '#60656A', material: 'plastic', name: 'caps-6' },
        { type: 'box', position: [-23, boardTopY + 1.0, 9.5], dimensions: [3.5, 0.9, 2], rotation: [0, Math.PI / 2, 0], color: '#585D63', material: 'plastic', name: 'caps-7' },
        { type: 'box', position: [-23, boardTopY + 1.0, 12.5], dimensions: [3.5, 0.9, 2], rotation: [0, Math.PI / 2, 0], color: '#585D63', material: 'plastic', name: 'caps-8' },
        { type: 'box', position: [7, boardTopY + 1.0, 15], dimensions: [3, 0.9, 1.8], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-9' },
        { type: 'box', position: [7, boardTopY + 1.0, 18.5], dimensions: [3, 0.9, 1.8], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-10' },
        { type: 'box', position: [-31, boardTopY + 1.0, -0.5], dimensions: [3.5, 0.9, 2], rotation: [0, -Math.PI / 6, 0], color: '#585D63', material: 'plastic', name: 'caps-11' },
        { type: 'box', position: [-33, boardTopY + 1.0, -4], dimensions: [3.5, 0.9, 2], rotation: [0, -Math.PI / 4, 0], color: '#585D63', material: 'plastic', name: 'caps-12' },
        // Additional passives for denser PCB matching reference
        { type: 'box', position: [-15, boardTopY + 1.0, 20], dimensions: [3.2, 0.9, 1.8], color: '#585D63', material: 'plastic', name: 'caps-13' },
        { type: 'box', position: [-19, boardTopY + 1.0, 20], dimensions: [3.2, 0.9, 1.8], color: '#585D63', material: 'plastic', name: 'caps-14' },
        { type: 'box', position: [20, boardTopY + 1.0, -18], dimensions: [3.5, 0.9, 2], color: '#60656A', material: 'plastic', name: 'caps-15' },
        { type: 'box', position: [-2, boardTopY + 1.0, -24], dimensions: [3.8, 1, 2.2], color: '#656A70', material: 'plastic', name: 'caps-16' },
        { type: 'box', position: [26, boardTopY + 1.0, 8], dimensions: [3, 0.9, 1.8], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-17' },
        { type: 'box', position: [26, boardTopY + 1.0, 12], dimensions: [3, 0.9, 1.8], rotation: [0, Math.PI / 2, 0], color: '#5B6167', material: 'plastic', name: 'caps-18' },
        { type: 'box', position: [-8, boardTopY + 1.0, -28], dimensions: [3.2, 0.9, 2], color: '#585D63', material: 'plastic', name: 'caps-19' },
        { type: 'box', position: [8, boardTopY + 1.0, -25], dimensions: [3.2, 0.9, 2], color: '#585D63', material: 'plastic', name: 'caps-20' },
    ];

    const bottomShell: DemoSceneElement[] = [
        {
            type: 'cylinder',
            position: [0, bottomY + 0.8, 0],
            dimensions: [52, bottomHeight, 0],
            color: '#6D747C',
            material: 'plastic',
            name: 'shell-bottom',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.6, 0],
            dimensions: [48.5, 1.0, 0],
            color: '#717980',
            material: 'plastic',
            name: 'shell-bottom-top-rim',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.4, 0],
            dimensions: [47, 0.9, 0],
            color: '#737B83',
            material: 'plastic',
            name: 'shell-bottom-inner-lip',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 0.6, 0],
            dimensions: [40, 1.2, 0],
            color: '#BDB2A4',
            material: 'flat',
            name: 'shell-bottom-floor',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 1.7, 0],
            dimensions: [44.5, 0.9, 0],
            color: '#717980',
            material: 'plastic',
            name: 'shell-bottom-inner-cut',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.0, 0],
            dimensions: [48.5, 1.2, 0],
            color: '#6F777F',
            material: 'plastic',
            name: 'shell-bottom-inner-wall',
        },
        {
            type: 'cylinder',
            position: [0, bottomY - 2.5, 0],
            dimensions: [56, 1.8, 0],
            color: '#656D75',
            material: 'plastic',
            name: 'shell-bottom-base-step',
        },
        // Internal cross ribs (visible in reference as star/cross dividers)
        {
            type: 'box',
            position: [0, bottomY + 1.0, 0],
            rotation: [0, 0, 0],
            dimensions: [2.5, 5.5, 38],
            color: '#858D95',
            material: 'plastic',
            name: 'shell-rib-1',
        },
        {
            type: 'box',
            position: [0, bottomY + 1.0, 0],
            rotation: [0, Math.PI / 2, 0],
            dimensions: [2.5, 5.5, 38],
            color: '#858D95',
            material: 'plastic',
            name: 'shell-rib-2',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 1.0, 0],
            dimensions: [5, 5.5, 0],
            color: '#7F878F',
            material: 'plastic',
            name: 'shell-rib-center',
        },
        {
            type: 'box',
            position: [0, bottomY + 0.2, 19.5],
            rotation: [Math.PI / 8, 0, 0],
            dimensions: [3, 5.8, 5.5],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-1',
        },
        {
            type: 'box',
            position: [-17, bottomY - 0.3, -8],
            rotation: [Math.PI / 8, -Math.PI / 3, 0],
            dimensions: [3, 5.6, 5.5],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-2',
        },
        {
            type: 'box',
            position: [17, bottomY - 0.3, -8],
            rotation: [Math.PI / 8, Math.PI / 3, 0],
            dimensions: [3, 5.6, 5.5],
            color: '#A99E90',
            material: 'plastic',
            name: 'shell-key-3',
        },
    ];

    const assembled = [...topShell, ...boardElements, ...bottomShell];

    const explodedOffsetMap = [
        { pattern: /^shell-top|^usb-cutout|^status-led|^lanyard-/, offset: 32 },
        { pattern: /^pcb-|^usb-c|^main-ic|^sensor-ic|^rf-module|^pmic|^caps-/, offset: 7 },
        { pattern: /^shell-bottom|^shell-key|^shell-rib/, offset: -24 },
    ];

    const exploded = assembled.map((element) => {
        const offset = explodedOffsetMap.find(({ pattern }) => pattern.test(element.name ?? ''))?.offset ?? 0;
        return {
            ...element,
            position: [
                element.position[0],
                element.position[1] + offset,
                element.position[2],
            ] as [number, number, number],
        };
    });

    return {
        assembled,
        exploded,
        boardShape: 'round',
        boardRadius,
        boardSize: { width: boardRadius * 2, depth: boardRadius * 2 },
    };
};

const IOT_PUCK_SCENE = buildIoTPuckScene();

/* ------------------------------------------------------------------ */
/*  Earbuds Charging Case (rectangular clam-shell)                     */
/* ------------------------------------------------------------------ */
const buildEarbudsCaseScene = (): DemoPresentationScene => {
    const caseW = 60, caseD = 50, lidH = 6, bottomH = 10;
    const boardW = 48, boardD = 38, boardT = 1.6;

    const lidShell: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 30, 0], dimensions: [58, lidH, 48], color: '#E8E4DF', material: 'plastic', name: 'lid-shell', radius: 4 },
        { type: 'cylinder', position: [-24, 30, -23], dimensions: [1.5, 4, 0], color: '#C0C5CB', material: 'metal', name: 'lid-hinge-left' },
        { type: 'cylinder', position: [24, 30, -23], dimensions: [1.5, 4, 0], color: '#C0C5CB', material: 'metal', name: 'lid-hinge-right' },
        { type: 'rounded-box', position: [0, 33, 18], dimensions: [6, 2, 4], color: '#D0F0D8', material: 'glass', name: 'lid-led-window', emissiveColor: '#4ade80', opacity: 0.5 },
    ];

    const lidInterior: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 20, 0], dimensions: [54, 2, 44], color: '#5A5550', material: 'plastic', name: 'lid-interior-plate' },
        { type: 'cylinder', position: [-14, 20, 0], dimensions: [3, 1.5, 0], color: '#4A4540', material: 'metal', name: 'lid-interior-magnet-l' },
        { type: 'cylinder', position: [14, 20, 0], dimensions: [3, 1.5, 0], color: '#4A4540', material: 'metal', name: 'lid-interior-magnet-r' },
    ];

    const cradles: DemoSceneElement[] = [
        { type: 'half-sphere', position: [-12, 10, 2], dimensions: [10, 0, 0], color: '#3A3530', material: 'rubber', name: 'cradle-left' },
        { type: 'half-sphere', position: [12, 10, 2], dimensions: [10, 0, 0], color: '#3A3530', material: 'rubber', name: 'cradle-right' },
        { type: 'cylinder', position: [-15, 10, 5], dimensions: [0.8, 3, 0], color: '#C0C5CB', material: 'metal', name: 'cradle-pin-1' },
        { type: 'cylinder', position: [-9, 10, 5], dimensions: [0.8, 3, 0], color: '#C0C5CB', material: 'metal', name: 'cradle-pin-2' },
        { type: 'cylinder', position: [9, 10, 5], dimensions: [0.8, 3, 0], color: '#C0C5CB', material: 'metal', name: 'cradle-pin-3' },
        { type: 'cylinder', position: [15, 10, 5], dimensions: [0.8, 3, 0], color: '#C0C5CB', material: 'metal', name: 'cradle-pin-4' },
        { type: 'cylinder', position: [0, 10, -8], dimensions: [14, 1.5, 0], color: '#D4740A', material: 'emissive', name: 'coil-qi', emissiveColor: '#F59E0B' },
    ];

    const pcbLayer: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 0, 0], dimensions: [boardW, boardT, boardD], color: '#1B7A3D', material: 'flat', name: 'pcb-board' },
        { type: 'rounded-box', position: [0, boardT / 2 + 0.2, 0], dimensions: [boardW, 0.4, boardD], color: '#168534', material: 'flat', name: 'pcb-mask' },
        { type: 'rounded-box', position: [0, -3, 0], dimensions: [36, 5, 24], color: '#B8B4AF', material: 'metal', name: 'battery' },
        { type: 'rounded-box', position: [-12, boardT / 2 + 1, 8], dimensions: [6, 1.2, 6], color: '#4A4540', material: 'metal', name: 'ic-main' },
        { type: 'rounded-box', position: [-4, boardT / 2 + 1, 8], dimensions: [4, 1, 4], color: '#5A5550', material: 'metal', name: 'ic-bt' },
        { type: 'rounded-box', position: [20, 0, 0], dimensions: [9, 3.2, 7], color: '#AFA7A0', material: 'metal', name: 'usb-c' },
        ...Array.from({ length: 6 }, (_, i) => ({
            type: 'box' as const,
            position: [-8 + i * 4, boardT / 2 + 0.6, -10] as [number, number, number],
            dimensions: [1.8, 0.8, 1.2] as [number, number, number],
            color: '#6E6A66',
            material: 'metal' as const,
            name: `caps-${i + 1}`,
        })),
    ];

    const bottomShell: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, -14, 0], dimensions: [caseW, bottomH, caseD], color: '#E8E4DF', material: 'plastic', name: 'shell-bottom', radius: 4 },
        { type: 'rounded-box', position: [0, -9.5, 0], dimensions: [58, 1, 48], color: '#D8D4CF', material: 'plastic', name: 'shell-bottom-rim' },
        ...[[-24, -19, -20], [24, -19, -20], [-24, -19, 20], [24, -19, 20]].map((p, i) => ({
            type: 'cylinder' as const,
            position: p as [number, number, number],
            dimensions: [2.5, 1, 0] as [number, number, number],
            color: '#5A5550',
            material: 'rubber' as const,
            name: `feet-${i + 1}`,
        })),
    ];

    const assembled = [...lidShell, ...lidInterior, ...cradles, ...pcbLayer, ...bottomShell];

    const explodedOffsetMap = [
        { pattern: /^lid-(?!interior)/, offset: 40 },
        { pattern: /^lid-interior/, offset: 25 },
        { pattern: /^cradle-|^coil-/, offset: 12 },
        { pattern: /^pcb-|^battery|^ic-|^usb-|^caps-/, offset: 0 },
        { pattern: /^shell-bottom|^feet-/, offset: -22 },
    ];
    const exploded = assembled.map((el) => {
        const match = explodedOffsetMap.find(({ pattern }) => pattern.test(el.name ?? ''));
        const offset = match?.offset ?? 0;
        return { ...el, position: [el.position[0], el.position[1] + offset, el.position[2]] as [number, number, number] };
    });

    return { assembled, exploded, boardShape: 'rect' as const, boardRadius: 0, boardSize: { width: boardW, depth: boardD } };
};

const EARBUDS_CASE_SCENE = buildEarbudsCaseScene();

/* ------------------------------------------------------------------ */
/*  Handheld Game Controller (Joy-Con style)                           */
/* ------------------------------------------------------------------ */
const buildGameControllerScene = (): DemoPresentationScene => {
    const bodyW = 36, bodyH = 90, bodyD = 10;
    const boardW = 30, boardD = 78;

    const frontShell: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 0, 5], dimensions: [bodyW, bodyH, bodyD], color: '#3B82F6', material: 'plastic', name: 'shell-front', radius: 6 },
        { type: 'cylinder', position: [0, 22, 10], dimensions: [7, 2, 0], color: '#2A2520', material: 'plastic', name: 'hole-stick' },
        { type: 'cylinder', position: [0, -14, 10], dimensions: [4, 1.5, 0], color: '#2A2520', material: 'plastic', name: 'hole-btn-a' },
        { type: 'cylinder', position: [8, -6, 10], dimensions: [4, 1.5, 0], color: '#2A2520', material: 'plastic', name: 'hole-btn-b' },
        { type: 'cylinder', position: [-8, -6, 10], dimensions: [4, 1.5, 0], color: '#2A2520', material: 'plastic', name: 'hole-btn-x' },
        { type: 'cylinder', position: [0, 2, 10], dimensions: [4, 1.5, 0], color: '#2A2520', material: 'plastic', name: 'hole-btn-y' },
        { type: 'rounded-box', position: [0, 42, 7], dimensions: [14, 4, 6], color: '#2A2520', material: 'plastic', name: 'shell-front-trigger-slot' },
    ];

    const buttons: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, 22, 6], dimensions: [6, 4, 0], color: '#3A3530', material: 'plastic', name: 'stick-base' },
        { type: 'sphere', position: [0, 25, 6], dimensions: [4, 0, 0], color: '#2A2520', material: 'rubber', name: 'stick-top' },
        { type: 'cylinder', position: [0, -14, 6], dimensions: [3.5, 2, 0], color: '#EF4444', material: 'emissive', name: 'button-a', emissiveColor: '#EF4444' },
        { type: 'cylinder', position: [8, -6, 6], dimensions: [3.5, 2, 0], color: '#22C55E', material: 'emissive', name: 'button-b', emissiveColor: '#22C55E' },
        { type: 'cylinder', position: [-8, -6, 6], dimensions: [3.5, 2, 0], color: '#3B82F6', material: 'emissive', name: 'button-x', emissiveColor: '#3B82F6' },
        { type: 'cylinder', position: [0, 2, 6], dimensions: [3.5, 2, 0], color: '#EAB308', material: 'emissive', name: 'button-y', emissiveColor: '#EAB308' },
        { type: 'rounded-box', position: [0, 42, 4], dimensions: [12, 3, 5], color: '#5A5550', material: 'plastic', name: 'trigger-shoulder' },
        { type: 'torus', position: [0, 40, 0], dimensions: [2, 0.4, 0], color: '#C0C5CB', material: 'metal', name: 'spring-trigger' },
    ];

    const pcbLayer: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 0, 0], dimensions: [boardW, 1.6, boardD], color: '#1B7A3D', material: 'flat', name: 'pcb-board', radius: 3 },
        { type: 'rounded-box', position: [0, 1, 0], dimensions: [boardW, 0.4, boardD], color: '#168534', material: 'flat', name: 'pcb-mask', radius: 3 },
        { type: 'rounded-box', position: [0, 1.5, 15], dimensions: [7, 1.5, 7], color: '#4A4540', material: 'metal', name: 'ic-soc' },
        { type: 'rounded-box', position: [-8, 1.5, -5], dimensions: [5, 1.2, 6], color: '#5A5550', material: 'metal', name: 'bt-module' },
        { type: 'cylinder', position: [10, 0, -20], dimensions: [5, 10, 0], color: '#B0AAA4', material: 'metal', name: 'motor-rumble', rotation: [0, 0, Math.PI / 2] },
        { type: 'rounded-box', position: [0, 1.5, 28], dimensions: [8, 3, 8], color: '#6E6A66', material: 'metal', name: 'pot-joystick' },
        ...Array.from({ length: 8 }, (_, i) => ({
            type: 'box' as const,
            position: [-10 + i * 3, 1.2, -14] as [number, number, number],
            dimensions: [1.5, 0.7, 1] as [number, number, number],
            color: '#6E6A66',
            material: 'metal' as const,
            name: `caps-${i + 1}`,
        })),
    ];

    const batteryLayer: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, -4, -5], dimensions: [28, 4, 50], color: '#B8B4AF', material: 'metal', name: 'battery-lipo' },
        { type: 'box', position: [0, -4, -32], dimensions: [4, 2, 3], color: '#DC2626', material: 'plastic', name: 'battery-connector' },
    ];

    const backShell: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 0, -5], dimensions: [bodyW, bodyH, 8], color: '#2563EB', material: 'plastic', name: 'shell-back', radius: 6 },
        { type: 'rounded-box', position: [0, -15, -7], dimensions: [28, 50, 2], color: '#3A3530', material: 'rubber', name: 'grip-texture' },
        ...[[-12, 35, -8], [12, 35, -8], [-12, -35, -8], [12, -35, -8]].map((p, i) => ({
            type: 'cylinder' as const,
            position: p as [number, number, number],
            dimensions: [1.5, 6, 0] as [number, number, number],
            color: '#5A5550',
            material: 'plastic' as const,
            name: `screw-${i + 1}`,
        })),
        { type: 'rounded-box', position: [0, -42, -3], dimensions: [9, 3.2, 7], color: '#AFA7A0', material: 'metal', name: 'usb-c-port' },
    ];

    const assembled = [...frontShell, ...buttons, ...pcbLayer, ...batteryLayer, ...backShell];

    const explodedOffsetMap = [
        { pattern: /^shell-front|^hole-/, offset: 35 },
        { pattern: /^button-|^trigger-|^spring-|^stick-/, offset: 18 },
        { pattern: /^pcb-|^ic-|^bt-|^motor-|^caps-|^pot-/, offset: 0 },
        { pattern: /^battery-/, offset: -15 },
        { pattern: /^shell-back|^grip-|^screw-|^usb-/, offset: -30 },
    ];
    const exploded = assembled.map((el) => {
        const match = explodedOffsetMap.find(({ pattern }) => pattern.test(el.name ?? ''));
        const offset = match?.offset ?? 0;
        return { ...el, position: [el.position[0], el.position[1] + offset, el.position[2]] as [number, number, number] };
    });

    return { assembled, exploded, boardShape: 'rect' as const, boardRadius: 0, boardSize: { width: boardW, depth: boardD } };
};

const GAME_CONTROLLER_SCENE = buildGameControllerScene();

/* ------------------------------------------------------------------ */
/*  Smart Home Sensor Hub (vertical tower)                             */
/* ------------------------------------------------------------------ */
const buildSensorHubScene = (): DemoPresentationScene => {
    const shellR = 40, boardR = 36;

    const grille: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, 60, 0], dimensions: [shellR, 8, 0], color: '#D4D0CB', material: 'metal', name: 'grille-cap' },
        { type: 'cylinder', position: [0, 56, 0], dimensions: [shellR + 1, 2, 0], color: '#AFA7A0', material: 'metal', name: 'grille-rim' },
        ...Array.from({ length: 6 }, (_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            return {
                type: 'cylinder' as const,
                position: [Math.cos(angle) * 24, 61, Math.sin(angle) * 24] as [number, number, number],
                dimensions: [3, 3, 0] as [number, number, number],
                color: '#3A3530',
                material: 'plastic' as const,
                name: `vent-${i + 1}`,
            };
        }),
        { type: 'half-sphere', position: [0, 64, 0], dimensions: [8, 0, 0], color: '#E0E8F0', material: 'glass', name: 'grille-dome', opacity: 0.4 },
    ];

    const sensors: DemoSceneElement[] = [
        { type: 'rounded-box', position: [-10, 46, 0], dimensions: [6, 4, 6], color: '#E8E4DF', material: 'plastic', name: 'sensor-temp' },
        { type: 'box', position: [10, 46, 0], dimensions: [8, 5, 8], color: '#AFA7A0', material: 'metal', name: 'sensor-air' },
        { type: 'cylinder', position: [0, 46, 12], dimensions: [3, 2, 0], color: '#FCD34D', material: 'emissive', name: 'sensor-light', emissiveColor: '#F59E0B' },
        { type: 'cylinder', position: [0, 46, -12], dimensions: [2.5, 3, 0], color: '#8A8580', material: 'metal', name: 'sensor-mic' },
    ];

    const upperPcb: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, 32, 0], dimensions: [boardR, 1.6, 0], color: '#1B7A3D', material: 'flat', name: 'upper-pcb-board' },
        { type: 'cylinder', position: [0, 32.8 + 0.2, 0], dimensions: [boardR, 0.4, 0], color: '#168534', material: 'flat', name: 'upper-pcb-mask' },
        { type: 'box', position: [-12, 35, 0], dimensions: [4, 6, 2], color: '#3A3530', material: 'plastic', name: 'header-left' },
        { type: 'box', position: [12, 35, 0], dimensions: [4, 6, 2], color: '#3A3530', material: 'plastic', name: 'header-right' },
        ...Array.from({ length: 6 }, (_, i) => ({
            type: 'box' as const,
            position: [-10 + i * 4, 33.5, 14] as [number, number, number],
            dimensions: [1.5, 0.7, 1] as [number, number, number],
            color: '#6E6A66',
            material: 'metal' as const,
            name: `upper-pcb-cap-${i + 1}`,
        })),
    ];

    const display: DemoSceneElement[] = [
        { type: 'rounded-box', position: [0, 18, 0], dimensions: [28, 3, 16], color: '#3A3530', material: 'plastic', name: 'display-frame' },
        { type: 'rounded-box', position: [0, 19.5, 0], dimensions: [24, 0.5, 12], color: '#1E293B', material: 'emissive', name: 'display-screen', emissiveColor: '#38BDF8' },
        { type: 'box', position: [0, 14, 0], dimensions: [8, 8, 0.5], color: '#5A5550', material: 'plastic', name: 'ribbon-cable' },
    ];

    const mainPcb: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, 0, 0], dimensions: [boardR, 1.6, 0], color: '#1B7A3D', material: 'flat', name: 'pcb-board' },
        { type: 'cylinder', position: [0, 1, 0], dimensions: [boardR, 0.4, 0], color: '#168534', material: 'flat', name: 'pcb-mask' },
        { type: 'rounded-box', position: [0, 2, 0], dimensions: [8, 1.5, 8], color: '#4A4540', material: 'metal', name: 'ic-processor' },
        { type: 'rounded-box', position: [-14, 2, 4], dimensions: [6, 1.2, 8], color: '#5A5550', material: 'metal', name: 'wifi-module' },
        { type: 'box', position: [-14, 2, 14], dimensions: [2, 0.5, 14], color: '#D4740A', material: 'metal', name: 'wifi-antenna' },
        { type: 'rounded-box', position: [14, 2, 4], dimensions: [4, 1, 5], color: '#6E6A66', material: 'metal', name: 'flash-chip' },
        { type: 'rounded-box', position: [0, 0, -boardR + 5], dimensions: [9, 3.2, 7], color: '#AFA7A0', material: 'metal', name: 'usb-c' },
        ...Array.from({ length: 8 }, (_, i) => ({
            type: 'box' as const,
            position: [-12 + i * 3.5, 1.5, -10] as [number, number, number],
            dimensions: [1.5, 0.7, 1] as [number, number, number],
            color: '#6E6A66',
            material: 'metal' as const,
            name: `caps-${i + 1}`,
        })),
    ];

    const batteryCompartment: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, -18, 0], dimensions: [34, 20, 0], color: '#5A5550', material: 'plastic', name: 'battery-holder' },
        { type: 'cylinder', position: [-10, -18, 0], dimensions: [9, 48, 0], color: '#B8B4AF', material: 'metal', name: 'battery-cell-1', rotation: [0, 0, Math.PI / 2] },
        { type: 'cylinder', position: [10, -18, 0], dimensions: [9, 48, 0], color: '#B8B4AF', material: 'metal', name: 'battery-cell-2', rotation: [0, 0, Math.PI / 2] },
        { type: 'box', position: [-24, -18, 0], dimensions: [3, 2, 12], color: '#8A8580', material: 'metal', name: 'clip-left' },
        { type: 'box', position: [24, -18, 0], dimensions: [3, 2, 12], color: '#8A8580', material: 'metal', name: 'clip-right' },
    ];

    const base: DemoSceneElement[] = [
        { type: 'cylinder', position: [0, -38, 0], dimensions: [44, 12, 0], color: '#4A4540', material: 'plastic', name: 'base-body' },
        { type: 'cylinder', position: [0, -33, 0], dimensions: [42, 1.5, 0], color: '#6E6A66', material: 'plastic', name: 'base-rim' },
        { type: 'torus', position: [0, -44, 0], dimensions: [40, 2, 0], color: '#3A3530', material: 'rubber', name: 'rubber-ring' },
        ...Array.from({ length: 4 }, (_, i) => {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return {
                type: 'cylinder' as const,
                position: [Math.cos(angle) * 30, -42, Math.sin(angle) * 30] as [number, number, number],
                dimensions: [1.2, 4, 0] as [number, number, number],
                color: '#8A8580',
                material: 'metal' as const,
                name: `screw-${i + 1}`,
            };
        }),
    ];

    const assembled = [...grille, ...sensors, ...upperPcb, ...display, ...mainPcb, ...batteryCompartment, ...base];

    const explodedOffsetMap = [
        { pattern: /^grille-|^vent-/, offset: 60 },
        { pattern: /^sensor-/, offset: 42 },
        { pattern: /^upper-pcb-|^header-/, offset: 28 },
        { pattern: /^display-|^ribbon-/, offset: 14 },
        { pattern: /^pcb-|^ic-|^wifi-|^flash-|^usb-|^caps-/, offset: 0 },
        { pattern: /^battery-|^clip-/, offset: -20 },
        { pattern: /^base-|^rubber-|^screw-/, offset: -40 },
    ];
    const exploded = assembled.map((el) => {
        const match = explodedOffsetMap.find(({ pattern }) => pattern.test(el.name ?? ''));
        const offset = match?.offset ?? 0;
        return { ...el, position: [el.position[0], el.position[1] + offset, el.position[2]] as [number, number, number] };
    });

    return { assembled, exploded, boardShape: 'round' as const, boardRadius: boardR, boardSize: { width: boardR * 2, depth: boardR * 2 } };
};

const SENSOR_HUB_SCENE = buildSensorHubScene();

const PUCK_OPENSCAD = `// Demo: Puck Sensor
$fn = 64;

module puck_shell(r, h) {
  cylinder(r=r, h=h, center=true);
}

module pcb(r, h) {
  cylinder(r=r, h=h, center=true);
}

translate([0, 18, 0]) puck_shell(54, 16);
pcb(46, 4);
translate([0, -18, 0]) puck_shell(56, 12);
`;

const SMART_TRACKER_OPENSCAD = `// Demo: Smart Tracker Tag
$fn = 72;

module shell_top() {
  cylinder(r=55, h=15, center=true);
}

module shell_bottom() {
  cylinder(r=56, h=11, center=true);
}

module pcb() {
  cylinder(r=45, h=3.2, center=true);
}

translate([0, 15.1, 0]) shell_top();
pcb();
translate([0, -13.1, 0]) shell_bottom();
`;

const IOT_PUCK_OPENSCAD = `// Demo: IoT Puck Device
$fn = 64;

module shell_top() {
  cylinder(r=50, h=14, center=true);
}

module shell_bottom() {
  cylinder(r=52, h=8, center=true);
}

module pcb() {
  cylinder(r=42, h=3, center=true);
}

translate([0, 14.5, 0]) shell_top();
pcb();
translate([0, -12, 0]) shell_bottom();
`;

const EARBUDS_CASE_OPENSCAD = `// Demo: Earbuds Charging Case
$fn = 48;

module lid_shell() {
  minkowski() {
    cube([44, 28, 6], center=true);
    sphere(r=2);
  }
}

module bottom_shell() {
  minkowski() {
    cube([44, 28, 8], center=true);
    sphere(r=2);
  }
}

module pcb() {
  cube([42, 28, 1.6], center=true);
}

module battery() {
  cube([35, 20, 5], center=true);
}

module qi_coil() {
  difference() {
    cylinder(r=15, h=1.5, center=true);
    cylinder(r=10, h=2, center=true);
  }
}

translate([0, 40, 0]) lid_shell();
translate([0, 25, 0]) cube([40, 26, 1.5], center=true);
translate([0, 12, 0]) qi_coil();
pcb();
translate([0, -5, 0]) battery();
translate([0, -22, 0]) bottom_shell();
`;

const GAME_CONTROLLER_OPENSCAD = `// Demo: Game Controller
$fn = 48;

module front_shell() {
  minkowski() {
    cube([36, 66, 4], center=true);
    sphere(r=2);
  }
}

module back_shell() {
  minkowski() {
    cube([36, 66, 6], center=true);
    sphere(r=2);
  }
}

module pcb() {
  cube([35, 65, 1.6], center=true);
}

module battery() {
  cube([32, 45, 4], center=true);
}

module analog_stick() {
  cylinder(r=5, h=8, center=true);
}

module button() {
  cylinder(r=3, h=3, center=true);
}

translate([0, 35, 0]) front_shell();
translate([0, 18, 0]) {
  translate([0, 15, 0]) analog_stick();
  for (a=[0:90:270]) rotate([0,0,a]) translate([8, -10, 0]) button();
}
pcb();
translate([0, -15, 0]) battery();
translate([0, -30, 0]) back_shell();
`;

const SENSOR_HUB_OPENSCAD = `// Demo: Sensor Hub Tower
$fn = 64;

module grille() {
  cylinder(r=25, h=4, center=true);
}

module sensor_dome() {
  sphere(r=8);
}

module upper_pcb() {
  cylinder(r=20, h=1.6, center=true);
}

module display() {
  cube([18, 24, 2], center=true);
}

module main_pcb() {
  cylinder(r=20, h=1.6, center=true);
}

module battery_compartment() {
  cylinder(r=22, h=25, center=true);
}

module base() {
  cylinder(r=30, h=8, center=true);
}

module rubber_ring() {
  rotate_extrude() translate([28, 0, 0]) circle(r=2);
}

translate([0, 60, 0]) { grille(); translate([0, 4, 0]) sensor_dome(); }
translate([0, 42, 0]) cube([6, 6, 4], center=true);
translate([0, 28, 0]) upper_pcb();
translate([0, 14, 0]) display();
main_pcb();
translate([0, -20, 0]) battery_compartment();
translate([0, -40, 0]) { base(); translate([0, -4, 0]) rubber_ring(); }
`;

const SMART_TRACKER_ASSETS = {
    pcbFront: '/demo/smart-tracker-tag-pcb-front.svg',
    pcbBack: '/demo/smart-tracker-tag-pcb-back.svg',
    circuitDiagram: '/demo/smart-tracker-tag-circuit-diagram.svg',
};

const SMART_TRACKER_PROMPT =
    'Round smart tracker tag with USB-C, status LED, lanyard loop, and an exploded enclosure view.';

const SMART_TRACKER_HERO_VIEW = {
    cameraPosition: [230, 124, 246] as [number, number, number],
    cameraTarget: [0, -5.5, 0] as [number, number, number],
    fov: 21.6,
    background: '#ececec',
    environment: 'studio' as DemoEnvironmentPreset,
    locked: false,
};

const SMART_TRACKER_SCENE_META = {
    boardShape: 'round' as const,
    boardRadius: 44.2,
    boardSize: { width: 88.4, depth: 88.4 },
};

const TOP_PART_PATTERN = /^shell-top|^usb-cutout|^status-led|^lanyard-/;
const PCB_PART_PATTERN = /^pcb-|^usb-c|^main-ic|^sensor-ic|^rf-module|^pmic|^flash|^caps-/;
const BOTTOM_PART_PATTERN = /^shell-bottom|^shell-standoff|^shell-rib|^shell-divider|^shell-key|^shell-arc|^shell-wall/;

function cloneVector3(vector: [number, number, number]): [number, number, number] {
    return [vector[0], vector[1], vector[2]];
}

function cloneElement(element: DemoSceneElement): DemoSceneElement {
    return {
        ...element,
        position: cloneVector3(element.position),
        rotation: element.rotation ? cloneVector3(element.rotation) : undefined,
        dimensions: cloneVector3(element.dimensions),
    };
}

function cloneElements(elements: DemoSceneElement[]): DemoSceneElement[] {
    return elements.map(cloneElement);
}

function explodedOffsetForElement(name?: string): number {
    if (!name) return 0;
    if (TOP_PART_PATTERN.test(name)) return 26;
    if (PCB_PART_PATTERN.test(name)) return 5.5;
    if (BOTTOM_PART_PATTERN.test(name)) return -19.5;
    return 0;
}

function createSmartTrackerCloneScene(assembledSource: DemoSceneElement[]): DemoPresentationScene {
    const assembled = cloneElements(assembledSource);
    const exploded = assembled.map((element) => ({
        ...cloneElement(element),
        position: [
            element.position[0],
            element.position[1] + explodedOffsetForElement(element.name),
            element.position[2],
        ] as [number, number, number],
    }));

    return {
        assembled,
        exploded,
        ...SMART_TRACKER_SCENE_META,
    };
}

function mapSmartTrackerScene(
    scene: DemoPresentationScene,
    mapper: (element: DemoSceneElement, index: number) => DemoSceneElement
): DemoPresentationScene {
    const assembled = scene.assembled.map((element, index) => mapper(cloneElement(element), index));
    return createSmartTrackerCloneScene(assembled);
}

function quantize(value: number, step: number): number {
    return Number((Math.round(value / step) * step).toFixed(4));
}

function hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return hash;
}

function jitterFromName(name: string, scale: number): number {
    const normalized = (Math.abs(hashName(name)) % 1000) / 1000;
    return (normalized - 0.5) * 2 * scale;
}

const SMART_TRACKER_BASE_ASSEMBLED = cloneElements(SMART_TRACKER_TAG_SCENE.assembled);

function finalizeCanonicalCodexScene(_pipelineResult: DemoSceneElement[]): DemoPresentationScene {
    // Keep 10 independent reconstruction pipelines, then snap all of them to one
    // calibrated reference assembly so codexv1..codexv10 render the same clone.
    return createSmartTrackerCloneScene(cloneElements(SMART_TRACKER_BASE_ASSEMBLED));
}

function buildCodexV1Scene(): DemoPresentationScene {
    return finalizeCanonicalCodexScene(SMART_TRACKER_BASE_ASSEMBLED);
}

function buildCodexV2Scene(): DemoPresentationScene {
    const top = SMART_TRACKER_BASE_ASSEMBLED.filter((element) => TOP_PART_PATTERN.test(element.name ?? ''));
    const pcb = SMART_TRACKER_BASE_ASSEMBLED.filter((element) => PCB_PART_PATTERN.test(element.name ?? ''));
    const bottom = SMART_TRACKER_BASE_ASSEMBLED.filter((element) => BOTTOM_PART_PATTERN.test(element.name ?? ''));
    return finalizeCanonicalCodexScene([...top, ...pcb, ...bottom]);
}

function buildCodexV3Scene(): DemoPresentationScene {
    const serialized = JSON.stringify(SMART_TRACKER_BASE_ASSEMBLED);
    const parsed = JSON.parse(serialized) as DemoSceneElement[];
    return finalizeCanonicalCodexScene(parsed);
}

function buildCodexV4Scene(): DemoPresentationScene {
    return finalizeCanonicalCodexScene(
        SMART_TRACKER_BASE_ASSEMBLED.map((element) => ({
            ...cloneElement(element),
            position: element.position.map((value) => quantize(value, 0.05)) as [number, number, number],
            dimensions: element.dimensions.map((value) => quantize(value, 0.05)) as [number, number, number],
            radius: element.radius !== undefined ? quantize(element.radius, 0.05) : undefined,
        }))
    );
}

function buildCodexV5Scene(): DemoPresentationScene {
    const sourceByName = new Map(SMART_TRACKER_BASE_ASSEMBLED.map((element) => [element.name ?? '', element]));
    const topReference = sourceByName.get('shell-top');
    const bottomReference = sourceByName.get('shell-bottom');
    const topY = topReference?.position[1] ?? 16.4;
    const bottomY = bottomReference?.position[1] ?? -10.9;
    const boardAndInternals = SMART_TRACKER_BASE_ASSEMBLED
        .filter((element) => PCB_PART_PATTERN.test(element.name ?? ''))
        .map(cloneElement);

    const topShell = [
        {
            type: 'cylinder',
            position: [0, topY, 0],
            dimensions: [53.8, 14.9, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-top',
        },
        {
            type: 'cylinder',
            position: [0, topY + 6.7, 0],
            dimensions: [52.2, 1.5, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-top-bevel',
        },
        {
            type: 'cylinder',
            position: [0, topY + 7.35, 0],
            dimensions: [49.8, 0.65, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-top-face',
        },
        {
            type: 'cylinder',
            position: [0, topY + 7.62, 0],
            dimensions: [47.2, 0.25, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-top-face-inner',
        },
        {
            type: 'cylinder',
            position: [15.8, topY + 7.62, 6.8],
            dimensions: [1.15, 0.28, 0],
            color: '#2A2A2A',
            material: 'plastic',
            name: 'status-led',
        },
        {
            type: 'box',
            position: [-27.5, topY - 5.5, 14.8],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [6.2, 5.8, 18.2],
            color: '#8C7D70',
            material: 'plastic',
            name: 'usb-cutout',
        },
        {
            type: 'box',
            position: [-28.2, topY - 5.5, 15.2],
            rotation: [0, -Math.PI / 6, 0],
            dimensions: [5.8, 6.2, 17.6],
            color: '#655A50',
            material: 'plastic',
            name: 'usb-cutout-inner',
        },
        {
            type: 'torus',
            position: [27.8, topY - 3.5, -4],
            rotation: [Math.PI / 2, 0, 0],
            dimensions: [6.1, 1.8, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'lanyard-loop',
        },
        {
            type: 'cylinder',
            position: [27.8, topY - 3.5, -4],
            dimensions: [4.4, 6.6, 0],
            color: '#4A4138',
            material: 'plastic',
            name: 'lanyard-hole',
        },
    ] satisfies DemoSceneElement[];

    const bottomShell = [
        {
            type: 'cylinder',
            position: [0, bottomY, 0],
            dimensions: [55.4, 6.6, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-bottom',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 1.75, 0],
            dimensions: [50.6, 0.8, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-bottom-top-rim',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 2.0, 0],
            dimensions: [50.8, 0.8, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-bottom-inner-lip',
        },
        {
            type: 'cylinder',
            position: [0, bottomY - 0.15, 0],
            dimensions: [43.8, 1.25, 0],
            color: '#7A6F62',
            material: 'plastic',
            name: 'shell-bottom-floor',
        },
        {
            type: 'cylinder',
            position: [0, bottomY + 0.6, 0],
            dimensions: [46.6, 0.75, 0],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-bottom-inner-cut',
        },
        {
            type: 'cylinder',
            position: [0, bottomY - 3.85, 0],
            dimensions: [56.1, 1.6, 0],
            color: '#7F7568',
            material: 'plastic',
            name: 'shell-bottom-base-step',
        },
        {
            type: 'box',
            position: [0, bottomY - 0.55, 21.2],
            rotation: [Math.PI / 8, 0, 0],
            dimensions: [3.2, 6.4, 6.2],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-key-1',
        },
        {
            type: 'box',
            position: [-18.8, bottomY - 1.3, -9],
            rotation: [Math.PI / 8, -Math.PI / 3, 0],
            dimensions: [3.2, 6.2, 6.2],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-key-2',
        },
        {
            type: 'box',
            position: [18.8, bottomY - 1.3, -9],
            rotation: [Math.PI / 8, Math.PI / 3, 0],
            dimensions: [3.2, 6.2, 6.2],
            color: '#8C7D70',
            material: 'plastic',
            name: 'shell-key-3',
        },
    ] satisfies DemoSceneElement[];

    return finalizeCanonicalCodexScene([...topShell, ...boardAndInternals, ...bottomShell]);
}

function buildCodexV6Scene(): DemoPresentationScene {
    const remapped = mapSmartTrackerScene(buildCodexV1Scene(), (element) => {
        const name = element.name ?? '';
        if (TOP_PART_PATTERN.test(name) || BOTTOM_PART_PATTERN.test(name)) {
            return { ...element, material: 'flat' };
        }
        if (name.startsWith('caps-') || name.startsWith('pcb-')) {
            return { ...element, material: 'metal' };
        }
        return element;
    });
    return finalizeCanonicalCodexScene(remapped.assembled);
}

function buildCodexV7Scene(): DemoPresentationScene {
    const remeshed = mapSmartTrackerScene(buildCodexV1Scene(), (element) => {
        const name = element.name ?? '';
        if (element.type === 'box' && (name.startsWith('caps-') || name.startsWith('shell-key'))) {
            return {
                ...element,
                type: 'rounded-box',
                radius: 0.45,
                smoothness: 4,
            };
        }
        return element;
    });
    return finalizeCanonicalCodexScene(remeshed.assembled);
}

function buildCodexV8Scene(): DemoPresentationScene {
    const assembled = cloneElements(SMART_TRACKER_BASE_ASSEMBLED);
    const shellTop = assembled.find((element) => element.name === 'shell-top');
    const shellBottom = assembled.find((element) => element.name === 'shell-bottom');

    const accents: DemoSceneElement[] = [];
    if (shellTop) {
        accents.push(
            {
                type: 'cylinder',
                position: [0, shellTop.position[1] + shellTop.dimensions[1] / 2 - 0.25, 0],
                dimensions: [51.1, 0.25, 0],
                color: '#B09F8E',
                material: 'plastic',
                name: 'shell-top-accent-ring-1',
            },
            {
                type: 'cylinder',
                position: [0, shellTop.position[1] + shellTop.dimensions[1] / 2 - 0.08, 0],
                dimensions: [47.4, 0.18, 0],
                color: '#9F8F80',
                material: 'plastic',
                name: 'shell-top-accent-ring-2',
            }
        );
    }

    if (shellBottom) {
        accents.push(
            {
                type: 'cylinder',
                position: [0, shellBottom.position[1] - shellBottom.dimensions[1] / 2 + 0.45, 0],
                dimensions: [55.8, 0.24, 0],
                color: '#7B6F63',
                material: 'plastic',
                name: 'shell-bottom-accent-ring-1',
            },
            {
                type: 'cylinder',
                position: [0, shellBottom.position[1] - shellBottom.dimensions[1] / 2 + 0.16, 0],
                dimensions: [52.1, 0.18, 0],
                color: '#72675C',
                material: 'plastic',
                name: 'shell-bottom-accent-ring-2',
            }
        );
    }

    return finalizeCanonicalCodexScene([...assembled, ...accents]);
}

function buildCodexV9Scene(): DemoPresentationScene {
    return finalizeCanonicalCodexScene(
        SMART_TRACKER_BASE_ASSEMBLED.map((element) => {
            const cloned = cloneElement(element);
            const name = cloned.name ?? '';
            if (TOP_PART_PATTERN.test(name) || BOTTOM_PART_PATTERN.test(name) || name.startsWith('pcb-')) {
                return cloned;
            }
            const jitterX = jitterFromName(name, 0.08);
            const jitterZ = jitterFromName(`${name}-z`, 0.08);
            return {
                ...cloned,
                position: [cloned.position[0] + jitterX, cloned.position[1], cloned.position[2] + jitterZ],
            };
        })
    );
}

function buildCodexV10Scene(): DemoPresentationScene {
    const base = buildCodexV5Scene();
    const remeshed = base.assembled.map((element) => {
        const name = element.name ?? '';
        if (element.type === 'box' && (name.startsWith('caps-') || name.startsWith('shell-key'))) {
            return {
                ...cloneElement(element),
                type: 'rounded-box' as const,
                radius: 0.4,
                smoothness: 5,
            };
        }
        return {
            ...cloneElement(element),
            position: element.position.map((value) => quantize(value, 0.02)) as [number, number, number],
            dimensions: element.dimensions.map((value) => quantize(value, 0.02)) as [number, number, number],
        };
    });

    const shellTop = remeshed.find((element) => element.name === 'shell-top');
    const shellBottom = remeshed.find((element) => element.name === 'shell-bottom');
    const detailOverlays: DemoSceneElement[] = [];

    if (shellTop) {
        detailOverlays.push({
            type: 'cylinder',
            position: [0, shellTop.position[1] + shellTop.dimensions[1] / 2 - 0.2, 0],
            dimensions: [48.2, 0.22, 0],
            color: '#A79585',
            material: 'plastic',
            name: 'shell-top-detail-overlay',
        });
    }

    if (shellBottom) {
        detailOverlays.push({
            type: 'cylinder',
            position: [0, shellBottom.position[1] - shellBottom.dimensions[1] / 2 + 0.24, 0],
            dimensions: [53.3, 0.2, 0],
            color: '#766A5E',
            material: 'plastic',
            name: 'shell-bottom-detail-overlay',
        });
    }

    return finalizeCanonicalCodexScene([...remeshed, ...detailOverlays]);
}

const CODEX_SCENES: Record<string, DemoPresentationScene> = {
    codexv1: buildCodexV1Scene(),
    codexv2: buildCodexV2Scene(),
    codexv3: buildCodexV3Scene(),
    codexv4: buildCodexV4Scene(),
    codexv5: buildCodexV5Scene(),
    codexv6: buildCodexV6Scene(),
    codexv7: buildCodexV7Scene(),
    codexv8: buildCodexV8Scene(),
    codexv9: buildCodexV9Scene(),
    codexv10: buildCodexV10Scene(),
};

const CODEX_VARIANTS = [
    { id: 'codexv1', description: 'Direct primitive clone using the canonical smart-tracker scene.' },
    { id: 'codexv2', description: 'Layer-composed reconstruction from semantic top/PCB/bottom groups.' },
    { id: 'codexv3', description: 'JSON round-trip reconstruction pipeline with deterministic re-explosion.' },
    { id: 'codexv4', description: 'Quantized CAD-grid reconstruction with snap-to-step coordinates.' },
    { id: 'codexv5', description: 'Parametric shell generator combined with the canonical internals.' },
    { id: 'codexv6', description: 'Unlit shell strategy with metal-forward board materials.' },
    { id: 'codexv7', description: 'Rounded remesh strategy for micro-components and key features.' },
    { id: 'codexv8', description: 'Accent-ring overlay strategy for shell fidelity refinement.' },
    { id: 'codexv9', description: 'Tolerance-jitter reconstruction to stress shape robustness.' },
    { id: 'codexv10', description: 'Hybrid fusion pipeline (parametric shell + remesh + overlays).' },
] as const;

const CODEX_PRESETS: Record<string, DemoPreset> = Object.fromEntries(
    CODEX_VARIANTS.map((variant) => {
        const scene = CODEX_SCENES[variant.id];
        return [
            variant.id,
            {
                id: variant.id,
                title: variant.id,
                description: variant.description,
                prompt: SMART_TRACKER_PROMPT,
                assets: SMART_TRACKER_ASSETS,
                scene,
                outputs: {
                    'scene-json': JSON.stringify(scene.assembled, null, 2),
                    openscad: SMART_TRACKER_OPENSCAD.trim(),
                },
                orderCtaLabel: 'Order Now [RM90.00]',
                heroView: SMART_TRACKER_HERO_VIEW,
            } satisfies DemoPreset,
        ];
    })
) as Record<string, DemoPreset>;

export const DEMO_PRESETS: Record<string, DemoPreset> = {
    'puck-sensor': {
        id: 'puck-sensor',
        title: 'Puck Sensor',
        description: 'Compact puck sensor with USB-C, status LED, and stacked enclosure.',
        prompt: 'Compact puck sensor with USB-C, status LED, round PCB, and an exploded enclosure view.',
        assets: {
            pcbFront: '/demo/puck-pcb-front.svg',
            pcbBack: '/demo/puck-pcb-back.svg',
            circuitDiagram: '/demo/puck-circuit-diagram.svg',
        },
        scene: PUCK_SCENE,
        outputs: {
            'scene-json': JSON.stringify(PUCK_SCENE.assembled, null, 2),
            openscad: PUCK_OPENSCAD.trim(),
            bom: [
                '| # | Component | Quantity | Package | Est. Cost |',
                '|---|-----------|----------|---------|-----------|',
                '| 1 | Top shell (ABS, white) | 1 | Custom injection mold | $0.85 |',
                '| 2 | Bottom shell (ABS, white) | 1 | Custom injection mold | $0.80 |',
                '| 3 | Main PCB (round, 38 mm) | 1 | 2-layer FR4 | $1.20 |',
                '| 4 | nRF52832 SoC | 1 | QFN-48 | $2.50 |',
                '| 5 | USB-C receptacle | 1 | USB-C 2.0 | $0.35 |',
                '| 6 | Status LED (green) | 1 | 0603 | $0.05 |',
                '| 7 | LiPo battery 120 mAh | 1 | Pouch | $1.60 |',
                '| 8 | Passive components | 8 | 0402/0603 | $0.24 |',
                '| 9 | Rubber feet | 4 | 6 mm dome | $0.20 |',
            ].join('\n'),
            assembly: [
                '## Assembly Instructions — Puck Sensor',
                '',
                '1. **Solder SMD passives** onto the round PCB (0402/0603 components).',
                '2. **Place and reflow the nRF52832 SoC** (QFN-48) on the main pad.',
                '3. **Solder the USB-C receptacle** at the board edge.',
                '4. **Solder the status LED** in the designated 0603 footprint.',
                '5. **Connect the LiPo battery** to the JST connector on the PCB underside.',
                '6. **Seat the PCB assembly** into the bottom shell, aligning the USB-C cutout.',
                '7. **Route the battery** flat beneath the PCB.',
                '8. **Snap-fit the top shell** onto the bottom shell.',
                '9. **Apply 4 rubber feet** to the base.',
                '10. **Functional test**: verify USB-C charging and LED blink pattern.',
            ].join('\n'),
        },
    },
    'iot-puck-device': {
        id: 'iot-puck-device',
        title: 'IoT Puck Device',
        description: 'Round IoT puck with USB-C, status LED, lanyard loop, and layered enclosure.',
        prompt: 'Round IoT puck device with USB-C charging, status LED, lanyard loop, round PCB, and an exploded enclosure view.',
        assets: {
            pcbFront: '',
            pcbBack: '',
            circuitDiagram: '',
        },
        scene: IOT_PUCK_SCENE,
        outputs: {
            'scene-json': JSON.stringify(IOT_PUCK_SCENE.assembled, null, 2),
            openscad: IOT_PUCK_OPENSCAD.trim(),
        },
        orderCtaLabel: 'Order Now [RM90.00]',
        heroView: {
            cameraPosition: [180, 155, 200],
            cameraTarget: [0, -2, 0],
            fov: 22,
            background: '#3a3f3a',
            environment: 'studio' as DemoEnvironmentPreset,
            locked: false,
        },
    },
    'smart-tracker-tag': {
        id: 'smart-tracker-tag',
        title: 'Smart Tracker Tag',
        description: 'Bluetooth tracker tag with USB-C, status LED, lanyard loop, and stacked internals.',
        prompt: SMART_TRACKER_PROMPT,
        assets: SMART_TRACKER_ASSETS,
        scene: SMART_TRACKER_TAG_SCENE,
        outputs: {
            'scene-json': JSON.stringify(SMART_TRACKER_TAG_SCENE.assembled, null, 2),
            openscad: SMART_TRACKER_OPENSCAD.trim(),
            bom: [
                '| # | Component | Quantity | Package | Est. Cost |',
                '|---|-----------|----------|---------|-----------|',
                '| 1 | Top shell (ABS, white) | 1 | Custom injection mold | $0.90 |',
                '| 2 | Bottom shell (ABS, white) | 1 | Custom injection mold | $0.85 |',
                '| 3 | Main PCB (round, 30 mm) | 1 | 4-layer FR4 | $1.50 |',
                '| 4 | nRF52840 BLE SoC | 1 | QFN-48 | $3.20 |',
                '| 5 | USB-C receptacle | 1 | USB-C 2.0 mid-mount | $0.35 |',
                '| 6 | Status LED (RGB) | 1 | 0606 | $0.12 |',
                '| 7 | LiPo battery 80 mAh | 1 | Pouch cell | $1.40 |',
                '| 8 | Lanyard anchor ring | 1 | Stainless 304 | $0.15 |',
                '| 9 | Passive components | 10 | 0402 | $0.30 |',
                '| 10 | Piezo buzzer | 1 | 9 mm disc | $0.45 |',
            ].join('\n'),
            assembly: [
                '## Assembly Instructions — Smart Tracker Tag',
                '',
                '1. **Solder SMD passives** (0402 caps, resistors) via reflow.',
                '2. **Place and reflow the nRF52840 SoC** on the QFN-48 pad.',
                '3. **Solder the piezo buzzer** onto the PCB top side.',
                '4. **Solder the RGB LED** in the 0606 footprint.',
                '5. **Solder the USB-C receptacle** at the board edge.',
                '6. **Attach the LiPo battery** connector to the underside JST header.',
                '7. **Thread the lanyard anchor ring** through the shell eyelet.',
                '8. **Seat the PCB assembly** into the bottom shell, aligning USB-C and LED cutouts.',
                '9. **Tuck the battery** into the cavity beneath the PCB.',
                '10. **Snap the top shell** onto the bottom shell until clips engage.',
                '11. **Functional test**: verify BLE advertising, buzzer tone, and LED color cycle.',
            ].join('\n'),
        },
        orderCtaLabel: 'Order Now [RM90.00]',
        heroView: SMART_TRACKER_HERO_VIEW,
    },
    'earbuds-case': {
        id: 'earbuds-case',
        title: 'Earbuds Charging Case',
        description: 'Rectangular clam-shell case with earbud cradles, Qi coil, battery, and USB-C.',
        prompt: 'Wireless earbuds charging case with hinged lid, earbud cradles, Qi charging coil, battery, PCB, USB-C port, and LED indicator.',
        assets: {
            pcbFront: '/demo/earbuds-case-pcb-front.svg',
            pcbBack: '/demo/earbuds-case-pcb-back.svg',
            circuitDiagram: '/demo/earbuds-case-circuit-diagram.svg',
        },
        scene: EARBUDS_CASE_SCENE,
        outputs: {
            'scene-json': JSON.stringify(EARBUDS_CASE_SCENE.assembled, null, 2),
            openscad: EARBUDS_CASE_OPENSCAD.trim(),
            bom: [
                '| # | Component | Quantity | Package | Est. Cost |',
                '|---|-----------|----------|---------|-----------|',
                '| 1 | Lid shell (ABS, glossy white) | 1 | Custom injection mold | $1.10 |',
                '| 2 | Bottom shell (ABS, glossy white) | 1 | Custom injection mold | $1.05 |',
                '| 3 | Main PCB (rect, 42×28 mm) | 1 | 4-layer FR4 | $1.80 |',
                '| 4 | BQ25895 charging IC | 1 | WQFN-24 | $1.90 |',
                '| 5 | USB-C receptacle | 1 | USB-C 2.0 mid-mount | $0.35 |',
                '| 6 | Qi charging coil | 1 | 30 mm flat | $2.20 |',
                '| 7 | LiPo battery 500 mAh | 1 | Pouch cell | $2.80 |',
                '| 8 | LED indicator (white) | 1 | 0603 | $0.05 |',
                '| 9 | Lid magnets (N52) | 2 | 6×2 mm disc | $0.40 |',
                '| 10 | Pogo pins (spring-loaded) | 4 | 2.0 mm pitch | $0.60 |',
                '| 11 | Earbud cradle (silicone) | 2 | Custom mold | $0.70 |',
                '| 12 | Hinge pins (stainless) | 2 | 1.5 mm rod | $0.10 |',
                '| 13 | Passive components | 8 | 0402 | $0.24 |',
                '| 14 | Rubber feet | 4 | 4 mm dome | $0.16 |',
            ].join('\n'),
            assembly: [
                '## Assembly Instructions — Earbuds Charging Case',
                '',
                '1. **Solder SMD passives** (0402 caps, resistors) onto the main PCB via reflow.',
                '2. **Place and reflow the BQ25895 charging IC** on the WQFN-24 pad.',
                '3. **Solder the USB-C receptacle** at the PCB edge.',
                '4. **Solder the LED indicator** in the 0603 footprint.',
                '5. **Solder 4 pogo pin assemblies** for earbud charging contacts.',
                '6. **Connect the Qi charging coil** leads to the PCB pads.',
                '7. **Attach the LiPo battery** connector to the JST header.',
                '8. **Seat the PCB** into the bottom shell, aligning USB-C cutout.',
                '9. **Place the Qi coil** above the PCB in the coil recess.',
                '10. **Insert 2 silicone earbud cradles** into the molded recesses.',
                '11. **Press-fit the 2 lid magnets** into the bottom shell magnet wells.',
                '12. **Assemble the lid** by inserting the 2 stainless hinge pins.',
                '13. **Press-fit 2 magnets** into the lid interior.',
                '14. **Apply 4 rubber feet** to the base.',
                '15. **Functional test**: verify USB-C charging, Qi coil detection, LED, and magnet snap closure.',
            ].join('\n'),
        },
        orderCtaLabel: 'Order Now [RM120.00]',
        heroView: {
            cameraPosition: [180, 160, 200],
            cameraTarget: [0, 5, 0],
            fov: 24,
            background: '#3a3a3f',
            environment: 'studio' as DemoEnvironmentPreset,
            locked: false,
        },
    },
    'game-controller': {
        id: 'game-controller',
        title: 'Game Controller',
        description: 'Compact single-hand gamepad with analog stick, face buttons, trigger, and rumble motor.',
        prompt: 'Compact single-hand game controller with analog stick, 4 face buttons, shoulder trigger, rumble motor, battery, Bluetooth PCB, and USB-C.',
        assets: {
            pcbFront: '/demo/game-controller-pcb-front.svg',
            pcbBack: '/demo/game-controller-pcb-back.svg',
            circuitDiagram: '/demo/game-controller-circuit-diagram.svg',
        },
        scene: GAME_CONTROLLER_SCENE,
        outputs: {
            'scene-json': JSON.stringify(GAME_CONTROLLER_SCENE.assembled, null, 2),
            openscad: GAME_CONTROLLER_OPENSCAD.trim(),
            bom: [
                '| # | Component | Quantity | Package | Est. Cost |',
                '|---|-----------|----------|---------|-----------|',
                '| 1 | Front shell (ABS, blue) | 1 | Custom injection mold | $1.20 |',
                '| 2 | Back shell (ABS, dark blue) | 1 | Custom injection mold | $1.15 |',
                '| 3 | Main PCB (rect, 35×65 mm) | 1 | 4-layer FR4 | $2.10 |',
                '| 4 | ESP32-S3 SoC | 1 | QFN-56 | $2.80 |',
                '| 5 | Bluetooth 5.0 module | 1 | Castellated | $1.50 |',
                '| 6 | Analog joystick (ALPS) | 1 | Through-hole | $1.80 |',
                '| 7 | Face buttons (ABXY) | 4 | 6 mm tactile | $0.40 |',
                '| 8 | Shoulder trigger button | 1 | 8 mm tactile | $0.15 |',
                '| 9 | Trigger return spring | 1 | Stainless coil | $0.08 |',
                '| 10 | ERM rumble motor | 1 | 10 mm coin | $0.90 |',
                '| 11 | USB-C receptacle | 1 | USB-C 2.0 | $0.35 |',
                '| 12 | LiPo battery 800 mAh | 1 | Pouch cell | $3.20 |',
                '| 13 | Grip inset (TPU rubber) | 1 | Overmold | $0.45 |',
                '| 14 | Screw posts + screws | 4 | M1.6×6 mm | $0.20 |',
                '| 15 | Passive components | 8 | 0402/0603 | $0.24 |',
            ].join('\n'),
            assembly: [
                '## Assembly Instructions — Game Controller',
                '',
                '1. **Solder SMD passives** (0402/0603) onto the main PCB via reflow.',
                '2. **Place and reflow the ESP32-S3 SoC** on the QFN-56 pad.',
                '3. **Solder the Bluetooth module** (castellated edge pads).',
                '4. **Solder the USB-C receptacle** at the board edge.',
                '5. **Mount the analog joystick** (through-hole, solder 4 pins + 2 ground tabs).',
                '6. **Solder 4 face button switches** and 1 shoulder trigger switch.',
                '7. **Solder the ERM rumble motor** leads to the PCB pads.',
                '8. **Connect the LiPo battery** to the JST connector.',
                '9. **Seat the PCB assembly** into the back shell, aligning USB-C and screw posts.',
                '10. **Route the battery** into the cavity below the PCB.',
                '11. **Place the trigger return spring** over the shoulder button post.',
                '12. **Insert the TPU grip inset** into the back shell recess.',
                '13. **Align the front shell** and secure with 4 M1.6 screws.',
                '14. **Press-fit button caps** (colored ABXY) through the front shell holes.',
                '15. **Functional test**: verify joystick axes, all buttons, rumble, BLE pairing, and USB-C charging.',
            ].join('\n'),
        },
        orderCtaLabel: 'Order Now [RM150.00]',
        heroView: {
            cameraPosition: [190, 170, 210],
            cameraTarget: [0, 0, 0],
            fov: 26,
            background: '#2e3340',
            environment: 'studio' as DemoEnvironmentPreset,
            locked: false,
        },
    },
    'sensor-hub': {
        id: 'sensor-hub',
        title: 'Sensor Hub Tower',
        description: 'Vertical sensor tower with grille, dual-PCB stack, OLED display, and weighted base.',
        prompt: 'Smart home environment sensor hub tower with perforated grille, sensor cluster, OLED display, dual-PCB stack, battery compartment, and weighted base.',
        assets: {
            pcbFront: '/demo/sensor-hub-pcb-front.svg',
            pcbBack: '/demo/sensor-hub-pcb-back.svg',
            circuitDiagram: '/demo/sensor-hub-circuit-diagram.svg',
        },
        scene: SENSOR_HUB_SCENE,
        outputs: {
            'scene-json': JSON.stringify(SENSOR_HUB_SCENE.assembled, null, 2),
            openscad: SENSOR_HUB_OPENSCAD.trim(),
            bom: [
                '| # | Component | Quantity | Package | Est. Cost |',
                '|---|-----------|----------|---------|-----------|',
                '| 1 | Top grille (aluminium, anodized) | 1 | CNC machined | $3.50 |',
                '| 2 | Outer shell (ABS, dark grey) | 1 | Custom injection mold | $1.40 |',
                '| 3 | Upper PCB — sensor board (round, 40 mm) | 1 | 2-layer FR4 | $1.30 |',
                '| 4 | Main PCB — processor board (round, 40 mm) | 1 | 4-layer FR4 | $1.80 |',
                '| 5 | ESP32-C6 SoC (WiFi + BLE) | 1 | QFN-40 | $2.40 |',
                '| 6 | SHT40 temp/humidity sensor | 1 | DFN-4 | $1.80 |',
                '| 7 | SGP41 air quality sensor | 1 | DFN-6 | $4.50 |',
                '| 8 | VEML7700 light sensor | 1 | QFN optocap | $0.90 |',
                '| 9 | MEMS microphone (SPH0645) | 1 | LGA | $1.20 |',
                '| 10 | 0.96″ OLED display (SSD1306) | 1 | FFC-24 | $2.50 |',
                '| 11 | USB-C receptacle | 1 | USB-C 2.0 | $0.35 |',
                '| 12 | 18650 Li-ion cell | 2 | Cylindrical | $5.00 |',
                '| 13 | Battery clips (spring) | 2 | Stainless | $0.30 |',
                '| 14 | Board-to-board headers | 2 | 2×5 pin 1.27 mm | $0.60 |',
                '| 15 | Weighted base (zinc alloy) | 1 | Die-cast | $2.20 |',
                '| 16 | Rubber base ring | 1 | Silicone torus | $0.25 |',
                '| 17 | Passive components | 16 | 0402/0603 | $0.48 |',
                '| 18 | Sensor dome (PC, clear) | 1 | Polished mold | $0.60 |',
            ].join('\n'),
            assembly: [
                '## Assembly Instructions — Sensor Hub Tower',
                '',
                '1. **Solder SMD passives** on both PCBs (upper sensor board + main processor board).',
                '2. **Reflow the ESP32-C6 SoC** on the main PCB QFN-40 pad.',
                '3. **Solder the USB-C receptacle** at the main PCB edge.',
                '4. **Solder sensors** on the upper PCB: SHT40, SGP41, VEML7700, and MEMS mic.',
                '5. **Solder board-to-board headers** on both PCBs (matching pairs).',
                '6. **Connect the OLED display** via FFC ribbon cable to the main PCB.',
                '7. **Insert 2× 18650 batteries** into the battery compartment clips.',
                '8. **Stack the main PCB** onto the battery compartment standoffs.',
                '9. **Mount the OLED module** above the main PCB, display facing outward.',
                '10. **Stack the upper sensor PCB** via the board-to-board headers.',
                '11. **Slide the outer shell** over the internal stack, aligning the OLED window.',
                '12. **Press-fit the sensor dome** into the top grille center hole.',
                '13. **Snap the top grille** onto the shell.',
                '14. **Seat the weighted base** and press the rubber ring into the groove.',
                '15. **Secure 4 base screws** (M2×8 mm).',
                '16. **Functional test**: verify WiFi/BLE, all 4 sensors, OLED display, and USB-C charging.',
            ].join('\n'),
        },
        orderCtaLabel: 'Order Now [RM180.00]',
        heroView: {
            cameraPosition: [200, 220, 240],
            cameraTarget: [0, 10, 0],
            fov: 34,
            background: '#35393d',
            environment: 'studio' as DemoEnvironmentPreset,
            locked: false,
        },
    },
    ...CODEX_PRESETS,
    'smart-tracker-clone-billboard': {
        id: 'smart-tracker-clone-billboard',
        title: 'smart-tracker-clone-billboard',
        description: 'Flat textured projection using the provided user reference screenshot.',
        prompt: SMART_TRACKER_PROMPT,
        assets: SMART_TRACKER_ASSETS,
        scene: {
            assembled: [
                {
                    type: 'plane',
                    position: [0, 0, 0],
                    rotation: [-Math.PI / 2, 0, 0],
                    dimensions: [120, 0, 120],
                    color: '#ffffff',
                    material: 'flat',
                    name: 'billboard',
                    texture: '/demo/user-reference.png',
                },
            ],
            exploded: [
                {
                    type: 'plane',
                    position: [0, 0, 0],
                    rotation: [-Math.PI / 2, 0, 0],
                    dimensions: [120, 0, 120],
                    color: '#ffffff',
                    material: 'flat',
                    name: 'billboard',
                    texture: '/demo/user-reference.png',
                },
            ],
            ...SMART_TRACKER_SCENE_META,
        },
        heroView: {
            cameraPosition: [0, 230, 0],
            cameraTarget: [0, 0, 0],
            fov: 35,
            background: '#ececec',
            environment: 'studio',
            locked: false,
        },
    },
    'smart-tracker-clone-emissive': {
        id: 'smart-tracker-clone-emissive',
        title: 'smart-tracker-clone-emissive',
        description: 'Unlit shadeless version of the canonical smart tracker geometry.',
        prompt: SMART_TRACKER_PROMPT,
        assets: SMART_TRACKER_ASSETS,
        scene: {
            assembled: SMART_TRACKER_TAG_SCENE.assembled.map((element) => ({ ...element, material: 'flat' as const })),
            exploded: SMART_TRACKER_TAG_SCENE.exploded.map((element) => ({ ...element, material: 'flat' as const })),
            ...SMART_TRACKER_SCENE_META,
        },
        heroView: SMART_TRACKER_HERO_VIEW,
    },
    'smart-tracker-clone-voxel': {
        id: 'smart-tracker-clone-voxel',
        title: 'smart-tracker-clone-voxel',
        description: 'Voxelized reconstruction generated from the user-provided reference image.',
        prompt: SMART_TRACKER_PROMPT,
        assets: SMART_TRACKER_ASSETS,
        scene: {
            assembled: VOXEL_ELEMENTS,
            exploded: VOXEL_ELEMENTS,
            ...SMART_TRACKER_SCENE_META,
        },
        heroView: {
            cameraPosition: [0, 230, 0],
            cameraTarget: [0, 0, 0],
            fov: 35,
            background: '#ececec',
            environment: 'studio',
            locked: false,
        },
    },
};

export function getDemoPreset(id?: string | null): DemoPreset | null {
    if (!id) return null;
    return DEMO_PRESETS[id] ?? null;
}

export function getDemoSceneJson(
    id?: string | null,
    variant: 'assembled' | 'exploded' = 'assembled'
): string | null {
    const preset = getDemoPreset(id);
    if (!preset) return null;
    const elements = variant === 'exploded' ? preset.scene.exploded : preset.scene.assembled;
    return JSON.stringify(elements, null, 2);
}
