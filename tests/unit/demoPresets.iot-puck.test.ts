import { describe, expect, it } from 'vitest';
import { getDemoPreset, getDemoSceneJson } from '@/frontend/lib/demoPresets';
import { parseSceneElements } from '@/shared/domain/scene';

describe('iot puck device demo preset', () => {
  it('resolves preset metadata and hero lock configuration', () => {
    const preset = getDemoPreset('iot-puck-device');
    expect(preset).not.toBeNull();
    expect(preset?.id).toBe('iot-puck-device');
    expect(preset?.heroView?.locked).toBe(false);
    expect(preset?.orderCtaLabel).toBe('Order Now [RM90.00]');
  });

  it('parses assembled and exploded scene json variants', () => {
    const assembledJson = getDemoSceneJson('iot-puck-device', 'assembled');
    const explodedJson = getDemoSceneJson('iot-puck-device', 'exploded');

    expect(assembledJson).toBeTruthy();
    expect(explodedJson).toBeTruthy();

    const assembled = parseSceneElements(assembledJson || '[]');
    const exploded = parseSceneElements(explodedJson || '[]');

    expect(assembled).not.toBeNull();
    expect(exploded).not.toBeNull();
    expect(assembled?.length).toBe(exploded?.length);
  });

  it('contains required named detail elements including torus loop', () => {
    const assembledJson = getDemoSceneJson('iot-puck-device', 'assembled');
    const explodedJson = getDemoSceneJson('iot-puck-device', 'exploded');
    const assembled = parseSceneElements(assembledJson || '[]') || [];
    const exploded = parseSceneElements(explodedJson || '[]') || [];
    const assembledByName = new Map(assembled.map((item) => [item.name, item]));
    const byName = new Map(exploded.map((item) => [item.name, item]));

    expect(byName.get('shell-top')).toBeDefined();
    expect(byName.get('shell-bottom')).toBeDefined();
    expect(byName.get('pcb-board')).toBeDefined();
    expect(byName.get('usb-c')).toBeDefined();
    expect(byName.get('status-led')).toBeDefined();

    const loop = byName.get('lanyard-loop');
    expect(loop).toBeDefined();
    expect(loop?.type).toBe('torus');

    const shellTopAssembled = assembledByName.get('shell-top');
    const shellTopExploded = byName.get('shell-top');
    const pcbAssembled = assembledByName.get('pcb-board');
    const pcbExploded = byName.get('pcb-board');
    const shellBottomAssembled = assembledByName.get('shell-bottom');
    const shellBottomExploded = byName.get('shell-bottom');

    expect(shellTopAssembled).toBeDefined();
    expect(shellTopExploded).toBeDefined();
    expect(pcbAssembled).toBeDefined();
    expect(pcbExploded).toBeDefined();
    expect(shellBottomAssembled).toBeDefined();
    expect(shellBottomExploded).toBeDefined();

    expect((shellTopExploded?.position[1] ?? 0) - (shellTopAssembled?.position[1] ?? 0)).toBeCloseTo(32, 5);
    expect((pcbExploded?.position[1] ?? 0) - (pcbAssembled?.position[1] ?? 0)).toBeCloseTo(7, 5);
    expect((shellBottomExploded?.position[1] ?? 0) - (shellBottomAssembled?.position[1] ?? 0)).toBeCloseTo(-24, 5);
  });

  it('contains internal ribs in bottom shell', () => {
    const assembledJson = getDemoSceneJson('iot-puck-device', 'assembled');
    const assembled = parseSceneElements(assembledJson || '[]') || [];
    const byName = new Map(assembled.map((item) => [item.name, item]));

    expect(byName.get('shell-rib-1')).toBeDefined();
    expect(byName.get('shell-rib-2')).toBeDefined();
    expect(byName.get('shell-rib-center')).toBeDefined();
  });
});
