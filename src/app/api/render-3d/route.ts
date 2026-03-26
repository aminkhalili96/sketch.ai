import { NextRequest, NextResponse } from 'next/server';
import { createApiContext } from '@/backend/infra/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/backend/infra/rateLimit';
import { render3dRequestSchema } from '@/shared/schemas/validators';
import { buildProjectDescription } from '@/shared/domain/projectDescription';
import { infer3DKind } from '@/shared/domain/projectKind';
import { parseAssemblySpec, type AssemblySpec } from '@/backend/pipeline/assemblySpec';
import { planAssemblySpec } from '@/backend/agents/assemblyPlanner';
import { generateCadRender } from '@/backend/pipeline/cadRender';

type RenderResponse = {
    success: boolean;
    renderPngBase64?: string;
    cadStepBase64?: string;
    cadStlBase64?: string;
    assemblySpec?: string;
    error?: string;
};

export async function POST(request: NextRequest) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.ai);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    try {
        const body = await request.json();
        const validationResult = render3dRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return ctx.finalize(NextResponse.json<RenderResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            ));
        }

        const { projectDescription, analysisContext, assemblySpec, renderMode, model } = validationResult.data;
        const mergedDescription =
            buildProjectDescription(projectDescription, analysisContext?.summary) || projectDescription;

        const kind = infer3DKind(mergedDescription, analysisContext);
        if (kind !== 'enclosure') {
            return ctx.finalize(NextResponse.json<RenderResponse>(
                { success: false, error: 'Photoreal render is currently supported for enclosures only.' },
                { status: 422 }
            ));
        }

        let spec: AssemblySpec | null = null;
        if (assemblySpec) {
            spec = parseAssemblySpec(assemblySpec);
            if (!spec) {
                return ctx.finalize(NextResponse.json<RenderResponse>(
                    { success: false, error: 'Invalid assembly spec provided.' },
                    { status: 400 }
                ));
            }
        }

        if (!spec) {
            spec = await planAssemblySpec(
                null,
                mergedDescription,
                model,
                { analysis: analysisContext ?? undefined }
            );
        }

        const renderResult = await generateCadRender(spec, { mode: renderMode ?? 'exploded' });

        return ctx.finalize(NextResponse.json<RenderResponse>({
            success: true,
            renderPngBase64: renderResult.renderPngBase64,
            cadStepBase64: renderResult.cadStepBase64,
            cadStlBase64: renderResult.cadStlBase64,
            assemblySpec: JSON.stringify(spec, null, 2),
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Render failed';
        ctx.logError(error as Error);
        return ctx.finalize(NextResponse.json<RenderResponse>(
            { success: false, error: message },
            { status: 500 }
        ));
    }
}
