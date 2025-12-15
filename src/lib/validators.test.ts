import { describe, it, expect } from 'vitest';
import { analyzeRequestSchema, generateRequestSchema, chatRequestSchema } from './validators';

describe('validators', () => {
    describe('analyzeRequestSchema', () => {
        it('should validate valid request', () => {
            const data = { image: 'base64string' };
            const result = analyzeRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should fail if image is missing', () => {
            const data = {};
            const result = analyzeRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('generateRequestSchema', () => {
        it('should validate valid request', () => {
            const data = {
                projectDescription: 'A cool robot',
                outputTypes: ['bom', 'openscad']
            };
            const result = generateRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept partial analysisContext from clients', () => {
            const data = {
                projectDescription: 'A cool robot',
                analysisContext: { summary: 'Looks like a robot sketch' },
                outputTypes: ['openscad']
            };
            const result = generateRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.analysisContext?.identifiedComponents).toEqual([]);
                expect(result.data.analysisContext?.suggestedFeatures).toEqual([]);
                expect(result.data.analysisContext?.complexityScore).toBe(5);
                expect(result.data.analysisContext?.complexity).toBe('moderate');
                expect(result.data.analysisContext?.questions).toEqual([]);
            }
        });

        it('should fail if outputTypes is empty', () => {
            const data = {
                projectDescription: 'A cool robot',
                outputTypes: []
            };
            const result = generateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should fail if outputType is invalid', () => {
            const data = {
                projectDescription: 'A cool robot',
                outputTypes: ['invalid-type']
            };
            const result = generateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('chatRequestSchema', () => {
        it('should validate valid request', () => {
            const data = {
                message: 'Hello',
                history: []
            };
            const result = chatRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });
});
