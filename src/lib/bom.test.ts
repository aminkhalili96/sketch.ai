import { describe, it, expect } from 'vitest';
import { extractBomTable, parseBomTable } from './bom';

describe('bom helpers', () => {
    it('extracts the first markdown table from mixed content', () => {
        const input = [
            'Intro text',
            '',
            '| Item | Qty |',
            '| --- | --- |',
            '| MCU | 1 |',
            '',
            'Footer',
        ].join('\n');
        expect(extractBomTable(input)).toBe([
            '| Item | Qty |',
            '| --- | --- |',
            '| MCU | 1 |',
        ].join('\n'));
    });

    it('parses headers and rows with pipe trimming', () => {
        const table = [
            '| Item | Qty |',
            '| --- | --- |',
            '| MCU | 1 |',
            '| Sensor | 2 |',
        ].join('\n');
        const parsed = parseBomTable(table);
        expect(parsed?.headers).toEqual(['Item', 'Qty']);
        expect(parsed?.rows).toEqual([
            ['MCU', '1'],
            ['Sensor', '2'],
        ]);
    });
});
