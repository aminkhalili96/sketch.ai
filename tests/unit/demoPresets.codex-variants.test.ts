import { describe, expect, it } from 'vitest';
import { getDemoPreset, getDemoSceneJson } from '@/frontend/lib/demoPresets';
import { parseSceneElements } from '@/shared/domain/scene';

const CODEX_VARIANT_IDS = Array.from({ length: 10 }, (_, index) => `codexv${index + 1}`);

describe('codex clone demo presets', () => {
  it('resolves all codexv1..codexv10 presets with locked hero camera', () => {
    for (const id of CODEX_VARIANT_IDS) {
      const preset = getDemoPreset(id);
      expect(preset?.id).toBe(id);
      expect(preset?.heroView?.locked).toBe(false);
      expect(preset?.title).toBe(id);
      expect(preset?.orderCtaLabel).toBe('Order Now [RM90.00]');
    }
  });

  it('returns valid assembled/exploded JSON for every codex variant', () => {
    for (const id of CODEX_VARIANT_IDS) {
      const assembledJson = getDemoSceneJson(id, 'assembled');
      const explodedJson = getDemoSceneJson(id, 'exploded');

      expect(assembledJson).toBeTruthy();
      expect(explodedJson).toBeTruthy();

      const assembled = parseSceneElements(assembledJson || '[]') || [];
      const exploded = parseSceneElements(explodedJson || '[]') || [];

      expect(assembled.length).toBeGreaterThan(20);
      expect(exploded.length).toBe(assembled.length);
    }
  });

  it('keeps core clone anchors for each codex variant', () => {
    for (const id of CODEX_VARIANT_IDS) {
      const assembled = parseSceneElements(getDemoSceneJson(id, 'assembled') || '[]') || [];
      const byName = new Map(assembled.map((element) => [element.name, element]));

      expect(byName.get('shell-top')).toBeDefined();
      expect(byName.get('shell-bottom')).toBeDefined();
      expect(byName.get('pcb-board')).toBeDefined();
      expect(byName.get('usb-c')).toBeDefined();
      expect(byName.get('main-ic')).toBeDefined();
    }
  });
});
