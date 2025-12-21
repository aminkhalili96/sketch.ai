import { describe, expect, it } from 'vitest';
import { beautifyScene, fallbackScene, parseSceneElements } from '@/lib/scene';
import { infer3DKind } from '@/lib/projectKind';

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
                name: 'body'
            }
        ]);
        const parsed = parseSceneElements(input);
        expect(parsed).not.toBeNull();
        expect(parsed?.[0].type).toBe('rounded-box');
    });
});
