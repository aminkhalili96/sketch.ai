import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError, recordChatError } from '@/lib/openai';
import { agentsExecuteRequestSchema } from '@/lib/validators';
import { executeAgentTask, expandRequestedOutputs } from '@/lib/agents/registry';
import { fallbackScene, normalizeSceneColors, parseSceneElements } from '@/lib/scene';
import { buildProjectDescription } from '@/lib/projectDescription';
import type { AgentsExecuteResponse, ProjectOutputs } from '@/types';
import { createApiContext } from '@/lib/apiContext';
import { RATE_LIMIT_CONFIGS } from '@/lib/rateLimit';
import { trackAgentExecution } from '@/lib/metrics';

export async function POST(request: NextRequest) {
    const ctx = createApiContext(request, RATE_LIMIT_CONFIGS.ai);
    if (ctx.rateLimitResponse) {
        return ctx.finalize(ctx.rateLimitResponse);
    }

    try {
        const body = await request.json();

        const validationResult = agentsExecuteRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            ));
        }

        const { plan, projectContext, model } = validationResult.data;

        const llmClient = getLLMClient();

        const previousOutputs = projectContext?.outputs ?? {};
        const allowedOutputs = new Set(expandRequestedOutputs(plan.requestedOutputs));
        const tasks = plan.tasks.filter((t) => allowedOutputs.has(t.outputType));
        if (tasks.length === 0) {
            return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                { success: false, error: 'Plan contains no executable tasks for the requested outputs' },
                { status: 400 }
            ));
        }

        const shared: Parameters<typeof executeAgentTask>[3] = {};
        const existingScene = projectContext?.outputs?.['scene-json'];
        if (existingScene) {
            const parsed = parseSceneElements(existingScene);
            if (parsed) {
                shared.sceneElements = normalizeSceneColors(parsed);
            }
        }

        const agentCtx = {
            description: projectContext?.description || '',
            analysis: projectContext?.analysis,
            outputs: projectContext?.outputs,
            requestId: ctx.requestId, // Pass requestId if needed
        };

        // Validate ids and dependencies up-front to avoid deadlocks.
        const idSet = new Set<string>();
        for (const t of tasks) {
            if (idSet.has(t.id)) {
                return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                    { success: false, error: 'Plan contains duplicate task ids. Please regenerate the plan.' },
                    { status: 400 }
                ));
            }
            idSet.add(t.id);
        }
        const taskById = new Map(tasks.map((t) => [t.id, t]));
        for (const t of tasks) {
            for (const dep of t.dependsOn ?? []) {
                if (dep === t.id) {
                    return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                        { success: false, error: 'Plan contains a self-dependent task. Please regenerate the plan.' },
                        { status: 400 }
                    ));
                }
                if (!taskById.has(dep)) {
                    return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                        { success: false, error: `Plan contains an unknown dependency: ${dep}. Please regenerate the plan.` },
                        { status: 400 }
                    ));
                }
            }
        }

        const safeExecute = async (taskId: string) => {
            const task = taskById.get(taskId);
            if (!task) {
                return {
                    outputType: 'bom' as const,
                    content: '',
                    summary: `Unknown task id: ${taskId}`,
                };
            }

            const start = Date.now();
            try {
                const result = await executeAgentTask(task, agentCtx, llmClient, shared, { model });
                trackAgentExecution(task.agent, true, Date.now() - start);
                agentCtx.outputs = { ...(agentCtx.outputs ?? {}), [result.outputType]: result.content };
                return result;
            } catch (err) {
                trackAgentExecution(task.agent, false, Date.now() - start);
                recordChatError(getModelName('text', model), { requestId: ctx.requestId, source: `agents:execute:${task.outputType}`, agent: task.agent }, err as Error);
                const message = err instanceof Error ? err.message : 'Unknown error';
                const existing = (agentCtx.outputs as Record<string, string>)?.[task.outputType];
                const existingText = typeof existing === 'string' ? existing : '';

                if (task.outputType === 'scene-json') {
                    const description =
                        buildProjectDescription(agentCtx.description, agentCtx.analysis?.summary) ||
                        agentCtx.description ||
                        agentCtx.analysis?.summary ||
                        'Hardware project';
                    const scene = normalizeSceneColors(fallbackScene(description));
                    shared.sceneElements = scene;
                    agentCtx.outputs = { ...(agentCtx.outputs ?? {}), 'scene-json': JSON.stringify(scene, null, 2) };
                    return {
                        outputType: 'scene-json' as const,
                        content: JSON.stringify(scene, null, 2),
                        summary: `Generated fallback 3D scene (error: ${message})`,
                        sceneElements: scene,
                    };
                }

                return {
                    outputType: task.outputType,
                    content: existingText,
                    summary: `Failed to update (${message})`,
                };
            }
        };

        // Execute tasks in dependency-aware batches (parallel where possible).
        const remaining = new Set(tasks.map((t) => t.id));
        const completed = new Set<string>();
        const results: Array<Awaited<ReturnType<typeof executeAgentTask>>> = [];

        while (remaining.size > 0) {
            const ready: string[] = [];
            for (const id of remaining) {
                const t = taskById.get(id);
                if (!t) continue;
                const deps = t.dependsOn ?? [];
                if (deps.every((d) => completed.has(d))) {
                    ready.push(id);
                }
            }

            if (ready.length === 0) {
                return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                    { success: false, error: 'Plan contains cyclic dependencies. Please regenerate the plan.' },
                    { status: 400 }
                ));
            }

            const batch = await Promise.allSettled(ready.map((id) => safeExecute(id)));
            for (let i = 0; i < ready.length; i++) {
                const id = ready[i];
                const settled = batch[i];
                if (settled.status === 'fulfilled') {
                    results.push(settled.value);
                }
                completed.add(id);
                remaining.delete(id);
            }
        }

        const updatedOutputs: Partial<ProjectOutputs> = {};
        const summaries: Record<string, string> = {};

        for (const res of results) {
            if (!allowedOutputs.has(res.outputType)) continue;
            if (typeof res.content === 'string' && res.content.trim().length > 0) {
                updatedOutputs[res.outputType] = res.content;
                const before = (previousOutputs as ProjectOutputs)[res.outputType];
                const beforeText = typeof before === 'string' ? before : '';
                const beforeLines = beforeText ? beforeText.split('\n').length : 0;
                const afterLines = res.content.split('\n').length;
                const delta = beforeText
                    ? ` (${beforeLines}→${afterLines} lines)`
                    : ` (${afterLines} lines)`;
                summaries[res.outputType] = `${res.summary}${delta}`;
            }
        }

        return ctx.finalize(NextResponse.json<AgentsExecuteResponse>({
            success: true,
            updatedOutputs,
            summaries: Object.keys(summaries).length > 0 ? summaries : undefined,
        }));
    } catch (error) {
        console.error('Agents execute error:', error);
        ctx.logError(error as Error);

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            ));
        }

        return ctx.finalize(NextResponse.json<AgentsExecuteResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        ));
    }
}
