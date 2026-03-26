import { describe, expect, it } from 'vitest';
import {
    beautifyScene,
    computeSceneBounds,
    fallbackScene,
    normalizeSceneColors,
    parseSceneElements,
} from '@/shared/domain/scene';
import { infer3DKind } from '@/shared/domain/projectKind';

describe('3D scene helpers', () => {
    it('infers object kind for plush/teddy descriptions', () => {
        expect(infer3DKind('A small plush teddy bear toy')).toBe('object');
    });

    it('fallbackScene returns an organic placeholder for object projects', () => {
        const scene = fallbackScene('A small plush teddy bear toy');
        const names = scene.map((e) => e.name ?? '').join(' ');
        const types = new Set(scene.map((e) => e.type));

        expect(names.toLowerCase()).toContain('head');
        expect(types.has('sphere') || types.has('capsule')).toBe(true);
        expect(names.toLowerCase()).not.toContain('enclosure');
        expect(names.toLowerCase()).not.toContain('lid');
    });

    it('beautifyScene does not force an enclosure lid for organic scenes', () => {
        const teddy = fallbackScene('plush teddy bear');
        const beautified = beautifyScene(teddy);
        const names = beautified.map((e) => (e.name ?? '').toLowerCase());
        expect(names.some((n) => n.includes('lid'))).toBe(false);
    });

    it('beautifyScene adds a lid for enclosure-like scenes', () => {
        const enclosure = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                rotation: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                color: '#ffffff',
                material: 'plastic' as const,
                name: 'enclosure-body',
            },
        ];

        const beautified = beautifyScene(enclosure);
        const names = beautified.map((e) => (e.name ?? '').toLowerCase());
        expect(names.some((n) => n.includes('lid'))).toBe(true);
    });

    it('parseSceneElements coerces unsupported types', () => {
        const input = JSON.stringify([
            {
                type: 'oval',
                position: [0, 0, 0],
                dimensions: [40, 80, 40],
                color: '#8B4513',
                name: 'body',
            },
        ]);
        const parsed = parseSceneElements(input);
        expect(parsed).not.toBeNull();
        expect(parsed?.[0].type).toBe('rounded-box');
    });
});

describe('beautifyScene', () => {
    it('applies colors to elements without existing colors', () => {
        const elements = [
            {
                type: 'rounded-box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                material: 'plastic' as const,
                name: 'enclosure-body',
            },
        ];

        const beautified = beautifyScene(elements, 'hardware sensor box');
        expect(beautified.length).toBeGreaterThan(0);
        // Each element should have valid dimensions
        for (const el of beautified) {
            expect(el.dimensions[0]).toBeGreaterThanOrEqual(0);
            expect(el.dimensions[1]).toBeGreaterThanOrEqual(0);
            expect(el.dimensions[2]).toBeGreaterThanOrEqual(0);
        }
    });

    it('recenters elements around the largest body', () => {
        const elements = [
            {
                type: 'rounded-box' as const,
                position: [100, 200, 50] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                color: '#F5F5F5',
                material: 'plastic' as const,
                name: 'enclosure-body',
            },
            {
                type: 'cylinder' as const,
                position: [110, 210, 55] as [number, number, number],
                dimensions: [3, 5, 0] as [number, number, number],
                color: '#C0C0C0',
                material: 'metal' as const,
                name: 'screw-1',
            },
        ];

        const beautified = beautifyScene(elements, 'hardware project');
        // Largest element (body) should be recentered to origin
        const body = beautified.find((e) => e.name === 'enclosure-body');
        expect(body?.position).toEqual([0, 0, 0]);
    });

    it('converts box to rounded-box for enclosure main body', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                color: '#FFFFFF',
                material: 'plastic' as const,
                name: 'body',
            },
        ];

        const beautified = beautifyScene(elements, 'IoT sensor enclosure');
        const body = beautified.find((e) => e.name === 'body');
        expect(body?.type).toBe('rounded-box');
    });

    it('returns fallback scene when all elements have zero dimensions', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [0, 0, 0] as [number, number, number],
                color: '#FFFFFF',
                name: 'empty',
            },
        ];

        const beautified = beautifyScene(elements, 'hardware project');
        // Should fall back to default scene
        expect(beautified.length).toBeGreaterThan(0);
    });
});

describe('computeSceneBounds', () => {
    it('returns correct bounds for a single box', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                color: '#FFFFFF',
            },
        ];

        const bounds = computeSceneBounds(elements);
        expect(bounds).not.toBeNull();
        expect(bounds!.width).toBe(80);
        expect(bounds!.height).toBe(22);
        expect(bounds!.depth).toBe(35);
    });

    it('returns correct bounds for offset elements', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [10, 5, 0] as [number, number, number],
                dimensions: [20, 10, 30] as [number, number, number],
                color: '#FFFFFF',
            },
            {
                type: 'box' as const,
                position: [-10, -5, 0] as [number, number, number],
                dimensions: [20, 10, 30] as [number, number, number],
                color: '#FFFFFF',
            },
        ];

        const bounds = computeSceneBounds(elements);
        expect(bounds).not.toBeNull();
        // First box: x=[0,20], y=[0,10], z=[-15,15]
        // Second box: x=[-20,0], y=[-10,0], z=[-15,15]
        // Combined: x=[-20,20]=40, y=[-10,10]=20, z=[-15,15]=30
        expect(bounds!.width).toBe(40);
        expect(bounds!.height).toBe(20);
        expect(bounds!.depth).toBe(30);
    });

    it('returns null for empty elements array', () => {
        const bounds = computeSceneBounds([]);
        expect(bounds).toBeNull();
    });

    it('handles sphere bounds correctly', () => {
        const elements = [
            {
                type: 'sphere' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [10, 0, 0] as [number, number, number],
                color: '#FF0000',
            },
        ];

        const bounds = computeSceneBounds(elements);
        expect(bounds).not.toBeNull();
        // Sphere with radius 10: extends 10 in each direction
        expect(bounds!.width).toBe(20);
        expect(bounds!.height).toBe(20);
        expect(bounds!.depth).toBe(20);
    });

    it('handles cylinder bounds correctly', () => {
        const elements = [
            {
                type: 'cylinder' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [5, 20, 0] as [number, number, number],
                color: '#C0C0C0',
            },
        ];

        const bounds = computeSceneBounds(elements);
        expect(bounds).not.toBeNull();
        // Cylinder: radius=5, height=20 => width=10, height=20, depth=10
        expect(bounds!.width).toBe(10);
        expect(bounds!.height).toBe(20);
        expect(bounds!.depth).toBe(10);
    });

    it('handles capsule bounds correctly', () => {
        const elements = [
            {
                type: 'capsule' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [10, 40, 0] as [number, number, number],
                color: '#8B4513',
            },
        ];

        const bounds = computeSceneBounds(elements);
        expect(bounds).not.toBeNull();
        // Capsule: radius=10, length=40 => halfY = 40/2 + 10 = 30
        // width=20, height=60, depth=20
        expect(bounds!.width).toBe(20);
        expect(bounds!.height).toBe(60);
        expect(bounds!.depth).toBe(20);
    });
});

describe('fallbackScene', () => {
    it('returns enclosure scene for hardware descriptions', () => {
        const scene = fallbackScene('IoT sensor device with ESP32');
        const names = scene.map((e) => (e.name ?? '').toLowerCase());
        expect(names.some((n) => n.includes('enclosure') || n.includes('body'))).toBe(true);
    });

    it('returns toy scene for plush/toy descriptions', () => {
        const scene = fallbackScene('A cute plush teddy bear');
        const names = scene.map((e) => (e.name ?? '').toLowerCase());
        expect(names.some((n) => n.includes('head'))).toBe(true);
        expect(names.some((n) => n.includes('body'))).toBe(true);
    });

    it('returns valid structure with position and dimensions for enclosure', () => {
        const scene = fallbackScene('smart home hub device');
        expect(scene.length).toBeGreaterThan(0);
        for (const el of scene) {
            expect(el.position).toBeDefined();
            expect(el.position.length).toBe(3);
            expect(el.dimensions).toBeDefined();
            expect(el.dimensions.length).toBe(3);
            expect(el.type).toBeDefined();
        }
    });

    it('returns valid structure with position and dimensions for object', () => {
        const scene = fallbackScene('stuffed animal toy');
        expect(scene.length).toBeGreaterThan(0);
        for (const el of scene) {
            expect(el.position).toBeDefined();
            expect(el.position.length).toBe(3);
            expect(el.dimensions).toBeDefined();
            expect(el.dimensions.length).toBe(3);
            expect(el.type).toBeDefined();
        }
    });

    it('adapts enclosure size for "small" keyword', () => {
        const smallScene = fallbackScene('small sensor device');
        const defaultScene = fallbackScene('sensor device');
        const smallBody = smallScene.find((e) => e.name?.includes('body'));
        const defaultBody = defaultScene.find((e) => e.name?.includes('body'));
        // Small body should have smaller dimensions
        expect(smallBody!.dimensions[0]).toBeLessThan(defaultBody!.dimensions[0]);
    });

    it('adapts enclosure size for "large" keyword', () => {
        const largeScene = fallbackScene('large control panel device');
        const defaultScene = fallbackScene('control panel device');
        const largeBody = largeScene.find((e) => e.name?.includes('body'));
        const defaultBody = defaultScene.find((e) => e.name?.includes('body'));
        // Large body should have larger dimensions
        expect(largeBody!.dimensions[0]).toBeGreaterThan(defaultBody!.dimensions[0]);
    });
});

describe('normalizeSceneColors', () => {
    it('preserves valid LLM-generated colors', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                color: '#FF5733',
                material: 'plastic' as const,
                name: 'body',
            },
        ];

        const normalized = normalizeSceneColors(elements);
        expect(normalized[0].color).toBe('#FF5733');
    });

    it('applies default colors when element has no color', () => {
        const elements = [
            {
                type: 'box' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [80, 22, 35] as [number, number, number],
                material: 'metal' as const,
                name: 'body',
            },
        ];

        const normalized = normalizeSceneColors(elements);
        expect(normalized[0].color).toBeDefined();
        // Metal default color should be silver
        expect(normalized[0].color).toBe('#C0C0C0');
    });

    it('sets material to plastic by default', () => {
        const elements = [
            {
                type: 'sphere' as const,
                position: [0, 0, 0] as [number, number, number],
                dimensions: [10, 0, 0] as [number, number, number],
                color: '#FF0000',
                name: 'ball',
            },
        ];

        const normalized = normalizeSceneColors(elements);
        expect(normalized[0].material).toBe('plastic');
    });

    it('returns empty array for empty input', () => {
        const normalized = normalizeSceneColors([]);
        expect(normalized).toEqual([]);
    });
});
