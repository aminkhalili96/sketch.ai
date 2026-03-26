import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { agentsRouteRequestSchema, agentsRouteResponseSchema } from '@/shared/schemas/validators';
import type { AgentsRouteResponse, RequestedOutput } from '@/shared/types';
import { createApiContext } from '@/backend/infra/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/backend/infra/rateLimit';

function formatExistingOutputs(outputs: Record<string, unknown> | undefined): string {
    if (!outputs) return 'No outputs generated yet';
    const available = Object.entries(outputs)
        .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([k]) => k);
    return available.length > 0 ? available.join(', ') : 'No outputs generated yet';
}

const OUTPUT_HINTS: Array<{ output: RequestedOutput; patterns: RegExp[] }> = [
    { output: '3d-model', patterns: [/3d\b/i, /model\b/i, /render/i, /enclosure/i, /housing/i, /case\b/i, /visual/i] },
    { output: 'bom', patterns: [/bom/i, /bill of materials/i, /components?/i, /parts?/i, /list of parts/i] },
    { output: 'assembly', patterns: [/assembly/i, /build steps?/i, /instructions/i, /how to build/i] },
    { output: 'firmware', patterns: [/firmware/i, /code\b/i, /embedded/i, /microcontroller/i, /software/i] },
    { output: 'schematic', patterns: [/schematic/i, /circuit/i, /diagram/i, /wiring/i] },
    { output: 'safety', patterns: [/safety/i, /compliance/i, /risk/i, /hazard/i] },
    { output: 'sustainability', patterns: [/sustainability/i, /environment/i, /eco/i, /energy/i, /green/i] },
    { output: 'cost-optimization', patterns: [/cost/i, /budget/i, /pricing/i, /price/i, /optimi[sz]e cost/i] },
    { output: 'dfm', patterns: [/dfm/i, /manufactur/i, /toleran/i, /fabricat/i] },
    { output: 'marketing', patterns: [/marketing/i, /positioning/i, /pitch/i, /copy/i] },
    { output: 'patent-risk', patterns: [/patent/i, /\bip\b/i, /intellectual property/i] },
];

function heuristicRoute(message: string) {
    const lower = message.toLowerCase();
    const outputs = new Set<RequestedOutput>();

    if (/\b(all outputs|everything|all of it|full package)\b/i.test(lower)) {
        outputs.add('3d-model');
        outputs.add('bom');
        outputs.add('assembly');
        outputs.add('firmware');
        outputs.add('schematic');
    }

    for (const hint of OUTPUT_HINTS) {
        if (hint.patterns.some((pattern) => pattern.test(lower))) {
            outputs.add(hint.output);
        }
    }

    const list = Array.from(outputs);
    const mode: 'chat' | 'plan' = list.length > 0 ? 'plan' : 'chat';
    return {
        mode,
        requestedOutputs: list,
        confidence: list.length > 0 ? 0.5 : 0.4,
        reason: list.length > 0 ? 'Matched known output keywords.' : 'No output keywords detected.',
    };
}

export async function POST(request: NextRequest) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.ai);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    try {
        const body = await request.json();
        const validationResult = agentsRouteRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return ctx.finalize(NextResponse.json<AgentsRouteResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            ));
        }

        const { message, projectContext, model } = validationResult.data;

        const description = projectContext?.description || 'No project description provided';
        const analysis = projectContext?.analysis
            ? JSON.stringify(projectContext.analysis, null, 2)
            : 'No analysis available';
        const existingOutputs = formatExistingOutputs(projectContext?.outputs as Record<string, unknown> | undefined);

        const routerPrompt = `You are RouterAgent. Decide whether the user wants to MODIFY outputs or simply chat.

Return ONLY valid JSON with this shape:
{
  "mode": "chat" | "plan",
  "requestedOutputs": ["bom" | "assembly" | "firmware" | "schematic" | "3d-model" | "safety" | "sustainability" | "cost-optimization" | "dfm" | "marketing" | "patent-risk"],
  "confidence": 0 to 1,
  "reason": "short explanation"
}

Rules:
- Use mode="plan" only if the user intends to generate/update outputs.
- If mode="plan", include 1-4 outputs that best match the intent.
- If the user asks a question (no change requested), use mode="chat" and omit requestedOutputs.
- Cost/price -> cost-optimization; components/parts -> bom; build steps -> assembly; circuit/diagram -> schematic; code/firmware -> firmware; design/shape/3d -> 3d-model.

User instruction:
${message}

Project context:
- Description: ${description}
- Analysis: ${analysis}
- Existing outputs: ${existingOutputs}`;

        const llmClient = getLLMClient();
        const modelName = getModelName('text', model);

        let routeResult: AgentsRouteResponse | null = null;

        try {
            const response = await llmClient.chat.completions.create({
                model: modelName,
                messages: [{ role: 'user', content: routerPrompt }],
                max_tokens: 400,
                ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
            });

            const content = response.choices?.[0]?.message?.content;
            if (content) {
                const parsed = JSON.parse(content);
                const validated = agentsRouteResponseSchema.safeParse(parsed);
                if (validated.success) {
                    routeResult = { success: true, ...validated.data };
                }
            }

            recordChatUsage(response, modelName, { requestId: ctx.requestId, source: 'agents:route' });
        } catch {
            recordChatError(modelName, { requestId: ctx.requestId, source: 'agents:route' });
        }

        const fallback = heuristicRoute(message);
        const selected = routeResult ?? fallback;
        const outputs = selected.requestedOutputs ?? [];
        const normalizedOutputs = Array.from(new Set(outputs));

        if (selected.mode === 'plan' && normalizedOutputs.length === 0) {
            return ctx.finalize(NextResponse.json<AgentsRouteResponse>({
                success: true,
                mode: 'chat',
                confidence: selected.confidence ?? fallback.confidence,
                reason: selected.reason ?? fallback.reason,
            }));
        }

        return ctx.finalize(NextResponse.json<AgentsRouteResponse>({
            success: true,
            mode: selected.mode,
            requestedOutputs: normalizedOutputs.length > 0 ? normalizedOutputs : undefined,
            confidence: selected.confidence,
            reason: selected.reason,
        }));
    } catch (error) {
        console.error('Agents route error:', error);
        ctx.logError(error as Error);
        recordChatError(getModelName('text'), { requestId: ctx.requestId, source: 'agents:route' }, error as Error);

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return ctx.finalize(NextResponse.json<AgentsRouteResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            ));
        }

        return ctx.finalize(NextResponse.json<AgentsRouteResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        ));
    }
}
