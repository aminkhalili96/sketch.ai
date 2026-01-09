import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError, isOfflineMode } from '@/lib/openai';
import { agentPlanSchema, agentsPlanRequestSchema } from '@/lib/validators';
import { normalizePlanForRequest } from '@/lib/agents/registry';
import type { AgentsPlanResponse, AgentPlan } from '@/types';

function formatExistingOutputs(outputs: Record<string, unknown> | undefined): string {
    if (!outputs) return 'No outputs generated yet';
    const available = Object.entries(outputs)
        .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([k]) => k);
    return available.length > 0 ? available.join(', ') : 'No outputs generated yet';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validationResult = agentsPlanRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json<AgentsPlanResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            );
        }

        const { message, requestedOutputs, projectContext, model } = validationResult.data;

        const llmClient = getLLMClient();

        const description = projectContext?.description || 'No project description provided';
        const analysis = projectContext?.analysis
            ? JSON.stringify(projectContext.analysis, null, 2)
            : 'No analysis available';
        const existingOutputs = formatExistingOutputs(projectContext?.outputs as Record<string, unknown> | undefined);

        const plannerPrompt = `You are ProjectManagerAgent. Create a structured execution plan (no work yet) to update ONLY the explicitly requested outputs.

User instruction:
${message}

Explicitly requested outputs (do NOT add others):
${requestedOutputs.join(', ')}

Current project context:
- Description: ${description}
- Analysis: ${analysis}
- Existing outputs: ${existingOutputs}

Return ONLY valid JSON matching this schema:
{
  "version": 1,
  "requestedOutputs": ["bom" | "assembly" | "firmware" | "schematic" | "3d-model"],
  "summary": "short human summary",
  "questions": ["optional clarifying question"],
  "tasks": [
    {
      "id": "t1",
      "agent": "BOMAgent" | "AssemblyAgent" | "FirmwareAgent" | "SchematicAgent" | "SceneJsonAgent" | "OpenSCADAgent",
      "outputType": "bom" | "assembly" | "firmware" | "schematic" | "scene-json" | "openscad",
      "action": "update" | "regenerate",
      "instruction": "task-specific instruction",
      "dependsOn": ["tX"]
    }
  ]
}

Rules:
- Include tasks ONLY for the explicitly requested outputs.
- If requestedOutputs includes "3d-model", you MUST include two tasks:
  1) SceneJsonAgent for outputType "scene-json"
  2) OpenSCADAgent for outputType "openscad" that dependsOn the scene task.
- Prefer action="update" when a current output exists; otherwise use "regenerate".
- Keep instructions specific and scoped to the selected outputs.`;

        let rawPlan: unknown = null;

        try {
            const response = await llmClient.chat.completions.create({
                model: getModelName('text', model),
                messages: [
                    { role: 'user', content: plannerPrompt },
                ],
                max_tokens: 1200,
                ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
            });

            const content = response.choices[0]?.message?.content;
            if (content) {
                rawPlan = JSON.parse(content);
            }
        } catch {
            // Fall back to a deterministic plan.
        }

        const fallbackPlan: AgentPlan = {
            version: 1,
            requestedOutputs,
            summary: `Proposed updates: ${requestedOutputs.join(', ')}`,
            tasks: [],
        };

        const validated = agentPlanSchema.safeParse(rawPlan);
        const normalized = normalizePlanForRequest(
            validated.success ? (validated.data as AgentPlan) : fallbackPlan,
            requestedOutputs,
            message
        );

        if (!normalized.summary) {
            normalized.summary = `Proposed updates: ${requestedOutputs.join(', ')}`;
        }

        return NextResponse.json<AgentsPlanResponse>({
            success: true,
            plan: normalized,
        });
    } catch (error) {
        console.error('Agents plan error:', error);

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return NextResponse.json<AgentsPlanResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            );
        }

        return NextResponse.json<AgentsPlanResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
