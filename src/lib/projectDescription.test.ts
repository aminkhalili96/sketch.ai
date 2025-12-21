import { describe, it, expect } from 'vitest';
import { buildProjectDescription } from './projectDescription';

describe('buildProjectDescription', () => {
    it('prefers summary when description is empty', () => {
        expect(buildProjectDescription('', 'Teddy bear sketch')).toBe('Teddy bear sketch');
    });

    it('returns description when summary is empty', () => {
        expect(buildProjectDescription('brown', '')).toBe('brown');
    });

    it('combines summary and user notes when both are present', () => {
        expect(buildProjectDescription('brown', 'Teddy bear sketch')).toBe(
            'Teddy bear sketch\nUser notes: brown'
        );
    });

    it('avoids duplicating summary text already in description', () => {
        expect(buildProjectDescription('teddy bear sketch, brown', 'Teddy bear sketch')).toBe(
            'teddy bear sketch, brown'
        );
    });
});
