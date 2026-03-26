import { z } from 'zod';
import type { AnalysisResult } from '@/shared/types';

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

const safeNumberSchema = z.preprocess((value) => {
    const num =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? Number(value)
                : Number.NaN;
    return Number.isFinite(num) ? num : 0;
}, z.number());

const vec3Schema = z.preprocess((value) => {
    if (Array.isArray(value)) {
        const arr = value.slice(0, 3);
        while (arr.length < 3) arr.push(0);
        return arr;
    }
    return [0, 0, 0];
}, z.tuple([safeNumberSchema, safeNumberSchema, safeNumberSchema]));

const vec2Schema = z.preprocess((value) => {
    if (Array.isArray(value)) {
        const arr = value.slice(0, 2);
        while (arr.length < 2) arr.push(0);
        return arr;
    }
    return [0, 0];
}, z.tuple([safeNumberSchema, safeNumberSchema]));

const assemblySpecSchema = z.object({
    version: z.number().int().min(1).optional(),
    units: z.literal('mm').optional(),
    kind: z.enum(['enclosure', 'object']).optional(),
    enclosure: z.object({
        shape: z.enum(['rect', 'round']).optional(),
        width: safeNumberSchema.optional(),
        depth: safeNumberSchema.optional(),
        height: safeNumberSchema.optional(),
        wall: safeNumberSchema.optional(),
        cornerRadius: safeNumberSchema.optional(),
        topHeight: safeNumberSchema.optional(),
        bottomHeight: safeNumberSchema.optional(),
        gap: safeNumberSchema.optional(),
        material: z.enum(['plastic', 'metal']).optional(),
        colorTop: z.string().optional(),
        colorBottom: z.string().optional(),
        colorAccent: z.string().optional(),
    }).optional(),
    pcb: z.object({
        shape: z.enum(['rect', 'round']).optional(),
        width: safeNumberSchema.optional(),
        depth: safeNumberSchema.optional(),
        thickness: safeNumberSchema.optional(),
        offsetY: safeNumberSchema.optional(),
        color: z.string().optional(),
    }).optional(),
    ports: z.array(z.object({
        type: z.enum(['usb-c', 'usb-a', 'button', 'led', 'switch', 'audio', 'vent', 'sensor']),
        side: z.enum(['front', 'back', 'left', 'right', 'top', 'bottom']),
        size: vec3Schema,
        offset: vec2Schema.optional(),
        name: z.string().optional(),
    })).optional(),
    components: z.array(z.object({
        name: z.string().optional(),
        role: z.enum(['ic', 'sensor', 'connector', 'button', 'led', 'battery', 'speaker', 'antenna', 'coil', 'capacitor', 'resistor', 'mount']),
        size: vec3Schema,
        position: vec3Schema,
        rotation: vec3Schema.optional(),
        color: z.string().optional(),
        material: z.enum(['plastic', 'metal', 'glass', 'rubber']).optional(),
    })).optional(),
    view: z.object({
        explodedGap: safeNumberSchema.optional(),
    }).optional(),
});

export type AssemblySpec = {
    version: number;
    units: 'mm';
    kind: 'enclosure' | 'object';
    enclosure: {
        shape: 'rect' | 'round';
        width: number;
        depth: number;
        height: number;
        wall: number;
        cornerRadius: number;
        topHeight: number;
        bottomHeight: number;
        gap: number;
        material: 'plastic' | 'metal';
        colorTop: string;
        colorBottom: string;
        colorAccent: string;
    };
    pcb: {
        shape: 'rect' | 'round';
        width: number;
        depth: number;
        thickness: number;
        offsetY: number;
        color: string;
    };
    ports: Array<{
        type: 'usb-c' | 'usb-a' | 'button' | 'led' | 'switch' | 'audio' | 'vent' | 'sensor';
        side: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
        size: Vec3;
        offset: Vec2;
        name: string;
    }>;
    components: Array<{
        name: string;
        role: 'ic' | 'sensor' | 'connector' | 'button' | 'led' | 'battery' | 'speaker' | 'antenna' | 'coil' | 'capacitor' | 'resistor' | 'mount';
        size: Vec3;
        position: Vec3;
        rotation: Vec3;
        color: string;
        material: 'plastic' | 'metal' | 'glass' | 'rubber';
    }>;
    view: {
        explodedGap: number;
    };
};

const DEFAULT_COLORS = {
    shellTop: '#B9B2A8',
    shellBottom: '#8F8983',
    accent: '#6F6A64',
    pcb: '#C9A571',
    pcbMask: '#B79060',
    metal: '#B7BCC2',
    dark: '#403B35',
};

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

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

function normalizeHexColor(value: string | undefined, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
    return fallback;
}

export function parseAssemblySpec(text: string): AssemblySpec | null {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned) as unknown;
        const validated = assemblySpecSchema.safeParse(parsed);
        if (validated.success) {
            return normalizeAssemblySpec(validated.data);
        }
    } catch {
        return null;
    }
    return null;
}

export function normalizeAssemblySpec(spec: z.infer<typeof assemblySpecSchema>): AssemblySpec {
    const kind = spec.kind === 'object' ? 'object' : 'enclosure';
    const enclosureShape = spec.enclosure?.shape === 'round' ? 'round' : 'rect';

    const defaultWidth = enclosureShape === 'round' ? 96 : 110;
    const defaultDepth = enclosureShape === 'round' ? 96 : 78;

    const width = clamp(spec.enclosure?.width ?? defaultWidth, 50, 200);
    const depth = clamp(spec.enclosure?.depth ?? defaultDepth, 50, 200);
    const height = clamp(spec.enclosure?.height ?? 28, 14, 80);

    const wall = clamp(spec.enclosure?.wall ?? 2, 1.2, 4);
    const cornerRadius = clamp(spec.enclosure?.cornerRadius ?? Math.min(width, depth) * 0.12, 2, Math.min(width, depth) * 0.45);

    const pcbThickness = clamp(spec.pcb?.thickness ?? 2, 1, 3);
    const gap = clamp(spec.enclosure?.gap ?? 4, 1, 8);

    let topHeight = clamp(spec.enclosure?.topHeight ?? height * 0.55, 8, height);
    let bottomHeight = clamp(spec.enclosure?.bottomHeight ?? height * 0.4, 6, height);

    const totalHeight = topHeight + bottomHeight + gap + pcbThickness;
    if (totalHeight > height) {
        const scale = (height - gap - pcbThickness) / Math.max(1, topHeight + bottomHeight);
        topHeight = clamp(topHeight * scale, 8, height);
        bottomHeight = clamp(bottomHeight * scale, 6, height);
    }

    const pcbShape = spec.pcb?.shape === 'round' ? 'round' : enclosureShape;
    const pcbWidth = clamp(spec.pcb?.width ?? width * 0.82, 30, width * 0.92);
    const pcbDepth = clamp(spec.pcb?.depth ?? depth * 0.82, 30, depth * 0.92);
    const pcbOffsetY = clamp(spec.pcb?.offsetY ?? 0, -4, 4);

    const ports = (spec.ports ?? []).map((port) => ({
        type: port.type,
        side: port.side,
        size: port.size as Vec3,
        offset: (port.offset ?? [0, 0]) as Vec2,
        name: port.name ?? port.type,
    }));

    const components = (spec.components ?? []).map((comp, idx) => ({
        name: comp.name ?? `${comp.role}-${idx + 1}`,
        role: comp.role,
        size: comp.size as Vec3,
        position: comp.position as Vec3,
        rotation: (comp.rotation ?? [0, 0, 0]) as Vec3,
        color: normalizeHexColor(comp.color, DEFAULT_COLORS.dark),
        material: comp.material ?? 'plastic',
    }));

    return {
        version: spec.version ?? 1,
        units: 'mm',
        kind,
        enclosure: {
            shape: enclosureShape,
            width,
            depth,
            height,
            wall,
            cornerRadius,
            topHeight,
            bottomHeight,
            gap,
            material: spec.enclosure?.material ?? 'plastic',
            colorTop: normalizeHexColor(spec.enclosure?.colorTop, DEFAULT_COLORS.shellTop),
            colorBottom: normalizeHexColor(spec.enclosure?.colorBottom, DEFAULT_COLORS.shellBottom),
            colorAccent: normalizeHexColor(spec.enclosure?.colorAccent, DEFAULT_COLORS.accent),
        },
        pcb: {
            shape: pcbShape,
            width: pcbWidth,
            depth: pcbDepth,
            thickness: pcbThickness,
            offsetY: pcbOffsetY,
            color: normalizeHexColor(spec.pcb?.color, DEFAULT_COLORS.pcb),
        },
        ports,
        components,
        view: {
            explodedGap: clamp(spec.view?.explodedGap ?? 18, 0, 40),
        },
    };
}

export function buildFallbackAssemblySpec(description: string, analysis?: Partial<AnalysisResult>): AssemblySpec {
    const lower = description.toLowerCase();
    const round = /(round|circular|disc|puck|coin|button)/i.test(lower);

    const base = normalizeAssemblySpec({
        kind: 'enclosure',
        enclosure: {
            shape: round ? 'round' : 'rect',
        },
        pcb: {
            shape: round ? 'round' : 'rect',
        },
        ports: lower.includes('usb') ? [{
            type: 'usb-c',
            side: 'front',
            size: [12, 6, 16],
            offset: [0, 0],
            name: 'usb-c',
        }] : [],
    });

    const identified = analysis?.identifiedComponents ?? [];
    const seed = hashSeed(`${description}-${identified.join(',')}`);
    const rand = mulberry32(seed);

    const componentCount = clamp(identified.length || 8, 6, 14);
    const components = Array.from({ length: componentCount }).map((_, idx) => {
        const w = clamp(6 + rand() * 10, 6, 16);
        const d = clamp(6 + rand() * 10, 6, 16);
        const h = clamp(1.6 + rand() * 3.2, 1.2, 4.2);
        const x = (rand() - 0.5) * base.pcb.width * 0.6;
        const z = (rand() - 0.5) * base.pcb.depth * 0.6;
        return {
            name: `component-${idx + 1}`,
            role: 'ic' as const,
            size: [w, h, d] as Vec3,
            position: [x, 0, z] as Vec3,
            rotation: [0, rand() * 0.2 - 0.1, 0] as Vec3,
            color: DEFAULT_COLORS.dark,
            material: 'plastic' as const,
        };
    });

    return {
        ...base,
        components,
    };
}

type SceneElement = {
    id?: string;
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule' | 'cone' | 'torus' | 'plane' | 'half-sphere';
    position: Vec3;
    rotation?: Vec3;
    dimensions: Vec3;
    color: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber' | 'emissive';
    name?: string;
    radius?: number;
    smoothness?: number;
    opacity?: number;
    emissiveColor?: string;
    emissiveIntensity?: number;
    layer?: 'shell' | 'internal' | 'pcb' | 'detail' | 'label';
    group?: string;
    parent?: string;
};

function mapPortToScene(port: AssemblySpec['ports'][number], spec: AssemblySpec): SceneElement {
    const { width, depth, height, wall } = spec.enclosure;
    const [offsetA, offsetB] = port.offset;
    const size = port.size;

    let position: Vec3 = [0, 0, 0];
    let rotation: Vec3 = [0, 0, 0];

    switch (port.side) {
        case 'front':
            position = [offsetA, offsetB, depth / 2 - wall / 2];
            rotation = [0, 0, 0];
            break;
        case 'back':
            position = [offsetA, offsetB, -(depth / 2 - wall / 2)];
            rotation = [0, 0, 0];
            break;
        case 'left':
            position = [-(width / 2 - wall / 2), offsetB, offsetA];
            rotation = [0, Math.PI / 2, 0];
            break;
        case 'right':
            position = [width / 2 - wall / 2, offsetB, offsetA];
            rotation = [0, Math.PI / 2, 0];
            break;
        case 'top':
            position = [offsetA, height / 2 - wall / 2, offsetB];
            rotation = [Math.PI / 2, 0, 0];
            break;
        case 'bottom':
            position = [offsetA, -(height / 2 - wall / 2), offsetB];
            rotation = [Math.PI / 2, 0, 0];
            break;
    }

    return {
        type: 'rounded-box',
        position,
        rotation,
        dimensions: size,
        radius: 1.4,
        smoothness: 6,
        color: DEFAULT_COLORS.metal,
        material: 'metal',
        name: port.name || port.type,
    };
}

export function assemblySpecToScene(spec: AssemblySpec): SceneElement[] {
    const { enclosure, pcb } = spec;
    const boardThickness = pcb.thickness;
    const explodedOffset = spec.view.explodedGap;
    const topY = boardThickness / 2 + enclosure.gap + enclosure.topHeight / 2 + explodedOffset;
    const bottomY = -(boardThickness / 2 + enclosure.gap + enclosure.bottomHeight / 2 + explodedOffset);

    const boardTopY = pcb.offsetY + boardThickness / 2;

    // --- Material mapping by component role ---
    const roleMaterialMap: Record<string, SceneElement['material']> = {
        ic: 'metal',
        sensor: 'metal',
        connector: 'metal',
        button: 'plastic',
        led: 'emissive',
        battery: 'plastic',
        speaker: 'metal',
        antenna: 'metal',
        coil: 'metal',
        capacitor: 'metal',
        resistor: 'metal',
        mount: 'plastic',
    };

    const roleColorMap: Record<string, string> = {
        ic: '#1A1A1A',
        sensor: '#2A2A2A',
        connector: '#B7BCC2',
        battery: '#3A3A3A',
        led: '#00FF00',
        speaker: '#4A4A4A',
        antenna: '#C0C0C0',
    };

    const shellTop: SceneElement = enclosure.shape === 'round'
        ? {
            type: 'cylinder',
            position: [0, topY, 0],
            rotation: [0, 0, 0],
            dimensions: [enclosure.width / 2, enclosure.topHeight, 0],
            color: enclosure.colorTop,
            material: enclosure.material,
            name: 'shell-top',
            layer: 'shell',
        }
        : {
            type: 'rounded-box',
            position: [0, topY, 0],
            rotation: [0, 0, 0],
            dimensions: [enclosure.width, enclosure.topHeight, enclosure.depth],
            radius: enclosure.cornerRadius,
            smoothness: 10,
            color: enclosure.colorTop,
            material: enclosure.material,
            name: 'shell-top',
            layer: 'shell',
        };

    const shellBottom: SceneElement = enclosure.shape === 'round'
        ? {
            type: 'cylinder',
            position: [0, bottomY, 0],
            rotation: [0, 0, 0],
            dimensions: [enclosure.width / 2 * 0.96, enclosure.bottomHeight, 0],
            color: enclosure.colorBottom,
            material: enclosure.material,
            name: 'shell-bottom',
            layer: 'shell',
        }
        : {
            type: 'rounded-box',
            position: [0, bottomY, 0],
            rotation: [0, 0, 0],
            dimensions: [enclosure.width * 0.96, enclosure.bottomHeight, enclosure.depth * 0.96],
            radius: clamp(enclosure.cornerRadius * 0.9, 2, enclosure.cornerRadius),
            smoothness: 10,
            color: enclosure.colorBottom,
            material: enclosure.material,
            name: 'shell-bottom',
            layer: 'shell',
        };

    const board: SceneElement = pcb.shape === 'round'
        ? {
            type: 'cylinder',
            position: [0, pcb.offsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [pcb.width / 2, boardThickness, 0],
            color: pcb.color,
            material: 'plastic',
            name: 'pcb-board',
            layer: 'pcb',
            group: 'main-pcb',
        }
        : {
            type: 'rounded-box',
            position: [0, pcb.offsetY, 0],
            rotation: [0, 0, 0],
            dimensions: [pcb.width, boardThickness, pcb.depth],
            radius: clamp(Math.min(pcb.width, pcb.depth) * 0.08, 3, 8),
            smoothness: 8,
            color: pcb.color,
            material: 'plastic',
            name: 'pcb-board',
            layer: 'pcb',
            group: 'main-pcb',
        };

    const boardMask: SceneElement = pcb.shape === 'round'
        ? {
            type: 'cylinder',
            position: [0, boardTopY + 0.2, 0],
            rotation: [0, 0, 0],
            dimensions: [pcb.width / 2 - 1, 0.6, 0],
            color: DEFAULT_COLORS.pcbMask,
            material: 'plastic',
            name: 'pcb-mask',
            layer: 'pcb',
            group: 'main-pcb',
        }
        : {
            type: 'rounded-box',
            position: [0, boardTopY + 0.2, 0],
            rotation: [0, 0, 0],
            dimensions: [pcb.width - 2, 0.6, pcb.depth - 2],
            radius: clamp(Math.min(pcb.width, pcb.depth) * 0.07, 2, 6),
            smoothness: 8,
            color: DEFAULT_COLORS.pcbMask,
            material: 'plastic',
            name: 'pcb-mask',
            layer: 'pcb',
            group: 'main-pcb',
        };

    const components: SceneElement[] = [];
    spec.components.forEach((component, idx) => {
        const [x, y, z] = component.position;
        const heightOffset = boardTopY + component.size[1] / 2 + 0.4 + y;
        const resolvedMaterial = component.material || roleMaterialMap[component.role] || 'plastic';
        const resolvedColor = component.color || roleColorMap[component.role] || DEFAULT_COLORS.dark;

        if (component.role === 'led') {
            // LEDs as emissive half-spheres
            components.push({
                id: `component-${idx + 1}`,
                type: 'half-sphere',
                position: [x, heightOffset, z],
                rotation: component.rotation,
                dimensions: [Math.max(1, component.size[0] / 2), 0, 0],
                color: resolvedColor,
                material: 'emissive',
                emissiveColor: resolvedColor,
                emissiveIntensity: 2.5,
                name: component.name,
                layer: 'internal',
                group: 'main-pcb',
            });
        } else {
            // Standard component
            components.push({
                id: `component-${idx + 1}`,
                type: 'rounded-box',
                position: [x, heightOffset, z],
                rotation: component.rotation,
                dimensions: [component.size[0], component.size[1], component.size[2]],
                radius: 1.2,
                smoothness: 8,
                color: resolvedColor,
                material: resolvedMaterial,
                name: component.name,
                layer: 'internal',
                group: 'main-pcb',
            });

            // Auto-generate solder pads for IC chips
            if (component.role === 'ic') {
                const padSize = Math.min(component.size[0], component.size[2]) * 0.15;
                const padHeight = 0.3;
                const padY = boardTopY + padHeight / 2 + 0.1;
                const padOffsets: [number, number][] = [
                    [-component.size[0] * 0.3, -component.size[2] * 0.3],
                    [component.size[0] * 0.3, -component.size[2] * 0.3],
                    [-component.size[0] * 0.3, component.size[2] * 0.3],
                    [component.size[0] * 0.3, component.size[2] * 0.3],
                ];
                padOffsets.forEach((offset, padIdx) => {
                    components.push({
                        id: `solder-${idx + 1}-${padIdx + 1}`,
                        type: 'cylinder',
                        position: [x + offset[0], padY, z + offset[1]],
                        dimensions: [padSize, padHeight, 0],
                        color: '#C0C0C0',
                        material: 'metal',
                        name: `${component.name || 'ic'}-pad-${padIdx + 1}`,
                        layer: 'internal',
                        group: 'main-pcb',
                    });
                });
            }
        }
    });

    const portElements: SceneElement[] = spec.ports.map((port) => ({
        ...mapPortToScene(port, spec),
        layer: 'detail' as const,
    }));

    return [shellTop, board, boardMask, ...components, ...portElements, shellBottom];
}

export function assemblySpecToOpenScad(spec: AssemblySpec, description?: string): string {
    const { enclosure, pcb, ports } = spec;
    const width = enclosure.width;
    const depth = enclosure.depth;
    const height = enclosure.height;
    const wall = enclosure.wall;
    const cornerRadius = enclosure.cornerRadius;
    const topHeight = enclosure.topHeight;
    const bottomHeight = enclosure.bottomHeight;
    const gap = enclosure.gap;
    const pcbThickness = pcb.thickness;

    const topZ = pcbThickness / 2 + gap + topHeight / 2;
    const bottomZ = -(pcbThickness / 2 + gap + bottomHeight / 2);

    const cutouts = ports.map((port, idx) => {
        const [w, h, d] = port.size;
        const [offsetA, offsetB] = port.offset;
        let pos: Vec3 = [0, 0, 0];

        switch (port.side) {
            case 'front':
                pos = [offsetA, depth / 2, offsetB];
                break;
            case 'back':
                pos = [offsetA, -depth / 2, offsetB];
                break;
            case 'left':
                pos = [-width / 2, offsetA, offsetB];
                break;
            case 'right':
                pos = [width / 2, offsetA, offsetB];
                break;
            case 'top':
                pos = [offsetA, offsetB, height / 2];
                break;
            case 'bottom':
                pos = [offsetA, offsetB, -height / 2];
                break;
        }

        return {
            id: `cutout_${idx + 1}`,
            w,
            h,
            d,
            pos,
            rotate: port.side === 'left' || port.side === 'right'
                ? [0, 0, 90]
                : port.side === 'top' || port.side === 'bottom'
                    ? [90, 0, 0]
                    : [0, 0, 0],
        };
    });

    const cutoutLines = cutouts.map((cutout) => {
        const [rx, ry, rz] = cutout.rotate;
        const [px, py, pz] = cutout.pos;
        return `    translate([${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)}])
        rotate([${rx}, ${ry}, ${rz}])
        cube([${cutout.w.toFixed(2)}, ${cutout.d.toFixed(2)}, ${cutout.h.toFixed(2)}], center=true);`;
    }).join('\n');

    const roundedModule = enclosure.shape === 'round'
        ? `module shell_cylinder(r, h, wall) {
  difference() {
    cylinder(r=r, h=h, center=true);
    translate([0, 0, wall])
      cylinder(r=max(1, r-wall), h=h-wall, center=true);
  }
}`
        : `module rounded_rect(w, d, r) {
  offset(r=r) square([w-2*r, d-2*r], center=true);
}

module rounded_box(w, d, h, r) {
  linear_extrude(height=h, center=true)
    rounded_rect(w, d, r);
}

module shell_box(w, d, h, wall, r) {
  difference() {
    rounded_box(w, d, h, r);
    translate([0, 0, wall])
      rounded_box(w-2*wall, d-2*wall, h-wall, max(0, r-wall));
  }
}`;

    const topShell = enclosure.shape === 'round'
        ? `translate([0, 0, ${topZ.toFixed(2)}]) shell_cylinder(${(width / 2).toFixed(2)}, ${topHeight.toFixed(2)}, ${wall.toFixed(2)});`
        : `translate([0, 0, ${topZ.toFixed(2)}]) shell_box(${width.toFixed(2)}, ${depth.toFixed(2)}, ${topHeight.toFixed(2)}, ${wall.toFixed(2)}, ${cornerRadius.toFixed(2)});`;

    const bottomShell = enclosure.shape === 'round'
        ? `translate([0, 0, ${bottomZ.toFixed(2)}]) shell_cylinder(${(width / 2 * 0.96).toFixed(2)}, ${bottomHeight.toFixed(2)}, ${wall.toFixed(2)});`
        : `translate([0, 0, ${bottomZ.toFixed(2)}]) shell_box(${(width * 0.96).toFixed(2)}, ${(depth * 0.96).toFixed(2)}, ${bottomHeight.toFixed(2)}, ${wall.toFixed(2)}, ${(cornerRadius * 0.9).toFixed(2)});`;

    const pcbShape = pcb.shape === 'round'
        ? `translate([0, 0, ${pcb.offsetY.toFixed(2)}]) cylinder(r=${(pcb.width / 2).toFixed(2)}, h=${pcbThickness.toFixed(2)}, center=true);`
        : `translate([0, 0, ${pcb.offsetY.toFixed(2)}]) rounded_box(${pcb.width.toFixed(2)}, ${pcb.depth.toFixed(2)}, ${pcbThickness.toFixed(2)}, ${Math.max(2, Math.min(pcb.width, pcb.depth) * 0.08).toFixed(2)});`;

    const title = description?.trim() ? description.trim() : `${enclosure.shape} enclosure`;

    return `// Project: ${title}
$fn = 64;

${roundedModule}

module enclosure_parts() {
  ${topShell}
  ${bottomShell}
}

module cutouts() {
${cutoutLines || '  // none'}
}

// Enclosure with cutouts
union() {
  difference() {
    enclosure_parts();
    cutouts();
  }
  // PCB reference (non-print)
  ${pcbShape}
}
`;
}
