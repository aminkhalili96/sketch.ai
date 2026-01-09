import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError } from '@/lib/openai';
import { SCHEMATIC_SVG_PROMPT, SYSTEM_PROMPT, fillPromptTemplate } from '@/lib/prompts';
import { schematicDiagramRequestSchema } from '@/lib/validators';
import { buildFallbackSchematicSvg } from '@/lib/schematicSvg';
import type { AnalysisResult } from '@/types';

function extractSvg(content: string): string | null {
    const match = content.match(/<svg[\s\S]*<\/svg>/i);
    return match ? match[0].trim() : null;
}

function describeComponents(analysis?: AnalysisResult): string {
    if (!analysis?.identifiedComponents?.length) return 'Not specified';
    return analysis.identifiedComponents.join(', ');
}

function describeFeatures(analysis?: AnalysisResult): string {
    if (!analysis?.suggestedFeatures?.length) return 'Not specified';
    return analysis.suggestedFeatures.join(', ');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = schematicDiagramRequestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: validation.error.message },
                { status: 400 }
            );
        }

        const { description, analysis, model } = validation.data;
        const components = describeComponents(analysis);
        const features = describeFeatures(analysis);

        const prompt = fillPromptTemplate(SCHEMATIC_SVG_PROMPT, {
            description,
            components,
            features,
        });

        const llmClient = getLLMClient();
        const response = await llmClient.chat.completions.create({
            model: getModelName('text', model),
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 1500,
            stream: false as const,
        });

        const content = response.choices?.[0]?.message?.content;
        const svg = content ? extractSvg(content) : null;

        if (!svg) {
            return NextResponse.json({
                success: true,
                svg: buildFallbackSchematicSvg(description, analysis),
            });
        }

        return NextResponse.json({ success: true, svg });
    } catch (error) {
        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return NextResponse.json(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
