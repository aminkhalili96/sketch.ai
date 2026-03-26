import {
    ASSEMBLY_INSTRUCTIONS_PROMPT,
    BOM_GENERATION_PROMPT,
    FIRMWARE_GENERATION_PROMPT,
    OPENSCAD_GENERATION_PROMPT,
    OPENSCAD_OBJECT_PROMPT,
    SCENE_GENERATION_PROMPT,
    SCENE_OBJECT_PROMPT,
    SAFETY_REVIEW_PROMPT,
    SUSTAINABILITY_ANALYSIS_PROMPT,
    COST_OPTIMIZATION_PROMPT,
    DFM_ANALYSIS_PROMPT,
    MARKETING_GENERATION_PROMPT,
    PATENT_RISK_PROMPT,
    SYSTEM_PROMPT,
    fillPromptTemplate,
    stripCodeFences,
} from '@/backend/ai/prompts';
import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { beautifyScene, computeSceneBounds, fallbackScene, normalizeSceneColors, parseSceneElements } from '@/shared/domain/scene';
import { fallbackOpenSCAD } from '@/backend/pipeline/openscad';
import { infer3DKind } from '@/shared/domain/projectKind';
import { buildProjectDescription } from '@/shared/domain/projectDescription';
import { normalizeBomMarkdown } from '@/shared/domain/bom';
import type {
    AgentPlan,
    AgentTask,
    AgentOutputType,
    ProjectOutputs,
    RequestedOutput,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function expandRequestedOutputs(requestedOutputs: RequestedOutput[]): AgentOutputType[] {
    const set = new Set<AgentOutputType>();
    for (const out of requestedOutputs) {
        if (out === '3d-model') {
            set.add('scene-json');
            set.add('openscad');
            continue;
        }
        set.add(out);
    }
    // Always include safety if not explicitly requested? No, optional.
    return Array.from(set);
}

export function normalizePlanForRequest(plan: AgentPlan, requestedOutputs: RequestedOutput[], message: string): AgentPlan {
    const allowedOutputs = expandRequestedOutputs(requestedOutputs);
    const allowed = new Set<AgentOutputType>(allowedOutputs);

    const existingTaskByOutput = new Map<AgentOutputType, AgentTask>();
    for (const task of plan.tasks) {
        if (!allowed.has(task.outputType)) continue;
        if (!existingTaskByOutput.has(task.outputType)) {
            existingTaskByOutput.set(task.outputType, {
                ...task,
                instruction: task.instruction || message,
            });
        }
    }

    const tasks: AgentTask[] = [];
    let counter = 1;
    const nextId = () => `t${counter++}`;

    // Ensure stable ordering and the required 3D dependency.
    let bomTaskId: string | null = null;
    for (const out of requestedOutputs) {
        if (out === '3d-model') {
            const sceneTask = existingTaskByOutput.get('scene-json');
            const openscadTask = existingTaskByOutput.get('openscad');

            const sceneId = nextId();
            tasks.push({
                id: sceneId,
                agent: 'SceneJsonAgent',
                outputType: 'scene-json',
                action: sceneTask?.action ?? 'update',
                instruction: sceneTask?.instruction ?? message,
            });

            tasks.push({
                id: nextId(),
                agent: 'OpenSCADAgent',
                outputType: 'openscad',
                action: openscadTask?.action ?? 'update',
                instruction: openscadTask?.instruction ?? message,
                dependsOn: [sceneId],
            });
            continue;
        }

        const task = existingTaskByOutput.get(out);
        const action = task?.action ?? 'update';
        const instruction = task?.instruction ?? message;

        const agentByOutput: Record<Exclude<RequestedOutput, '3d-model'>, AgentTask['agent']> = {
            bom: 'BOMAgent',
            assembly: 'AssemblyAgent',
            firmware: 'FirmwareAgent',
            schematic: 'SchematicAgent',
            safety: 'SafetyAgent',
            sustainability: 'SustainabilityAgent',
            'cost-optimization': 'CostOptimizerAgent',
            dfm: 'DFMAgent',
            marketing: 'MarketingAgent',
            'patent-risk': 'PatentRiskAgent',
        };

        const id = nextId();
        const dependsOn =
            out === 'assembly' && bomTaskId
                ? [bomTaskId]
                : undefined;

        tasks.push({
            id,
            agent: agentByOutput[out],
            outputType: out,
            action,
            instruction,
            dependsOn,
        });

        if (out === 'bom') {
            bomTaskId = id;
        }
    }

    return {
        version: plan.version || 1,
        requestedOutputs,
        summary: plan.summary,
        questions: plan.questions,
        tasks,
    };
}

// ---------------------------------------------------------------------------
// Agent execution types
// ---------------------------------------------------------------------------

export type AgentExecutionContext = {
    description: string;
    analysis?: {
        identifiedComponents?: string[];
        suggestedFeatures?: string[];
        summary?: string;
    };
    outputs?: ProjectOutputs;
};

export type AgentExecutionResult = {
    outputType: AgentOutputType;
    content: string;
    summary: string;
    sceneElements?: ReturnType<typeof fallbackScene>;
};

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function buildContextStrings(ctx: AgentExecutionContext) {
    const components = ctx.analysis?.identifiedComponents?.join(', ') || 'Not specified';
    const features = ctx.analysis?.suggestedFeatures?.join(', ') || 'Not specified';
    return { components, features };
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Format existing project outputs for inclusion in prompts.
 */
export function formatExistingOutputs(outputs: ProjectOutputs | undefined): string {
    if (!outputs) return 'None generated yet.';
    const entries = Object.entries(outputs).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return 'None generated yet.';
    return entries.map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
}

// ---------------------------------------------------------------------------
// Handler type and shared options
// ---------------------------------------------------------------------------

type HandlerOptions = {
    model?: string;
    modelName: string;
    kind3d: string;
    description: string;
    components: string;
    features: string;
    updateOrRegenerate: 'update' | 'regenerate';
    current: string | undefined;
};

type AgentHandler = (
    task: AgentTask,
    ctx: AgentExecutionContext,
    shared: { sceneElements?: ReturnType<typeof fallbackScene> },
    options: HandlerOptions,
) => Promise<AgentExecutionResult>;

// ---------------------------------------------------------------------------
// Helper: simple prompt-to-LLM call used by most text agents
// ---------------------------------------------------------------------------

async function callLLM(
    prompt: string,
    modelName: string,
    agent: string,
    source: string,
    maxTokens: number = 2500,
    extraOpts?: Record<string, unknown>,
): Promise<string | null> {
    const response = await getLLMClient().chat.completions.create({
        model: modelName,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
        stream: false as const,
        ...extraOpts,
    });
    recordChatUsage(response, modelName, { agent, source });
    return response.choices[0]?.message?.content ?? null;
}

// ---------------------------------------------------------------------------
// Individual agent handlers
// ---------------------------------------------------------------------------

const handleSceneJson: AgentHandler = async (task, ctx, shared, opts) => {
    const { description, modelName, kind3d } = opts;

    const template = kind3d === 'object' ? SCENE_OBJECT_PROMPT : SCENE_GENERATION_PROMPT;
    const paletteHint = kind3d === 'enclosure'
        ? 'Important: Use a white/grey palette for the main enclosure/body (avoid near-black plastics).'
        : '';
    const prompt = [
        fillPromptTemplate(template, { description, components: opts.components, features: opts.features }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        paletteHint,
    ].filter(Boolean).join('\n');

    const response = await getLLMClient().chat.completions.create({
        model: modelName,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.4,
        stream: false as const,
        ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
    });
    recordChatUsage(response, modelName, { agent: task.agent, source: 'agent:scene-json' });

    const content = response.choices[0]?.message?.content
        ? stripCodeFences(response.choices[0].message.content)
        : null;
    if (!content) {
        const baseScene = shared.sceneElements ?? fallbackScene(description);
        const scene = normalizeSceneColors(beautifyScene(baseScene, description));
        shared.sceneElements = scene;
        return {
            outputType: 'scene-json',
            content: JSON.stringify(scene, null, 2),
            summary: 'Generated a 3D scene (fallback)',
            sceneElements: scene,
        };
    }

    const parsed = parseSceneElements(content);
    const baseScene = parsed ?? shared.sceneElements ?? fallbackScene(description);
    const scene = normalizeSceneColors(beautifyScene(baseScene, description));
    shared.sceneElements = scene;
    return {
        outputType: 'scene-json',
        content: JSON.stringify(scene, null, 2),
        summary: 'Generated a 3D scene',
        sceneElements: scene,
    };
};

const handleOpenscad: AgentHandler = async (task, ctx, shared, opts) => {
    const { description, modelName, kind3d, components, features, updateOrRegenerate, current } = opts;

    const sceneElements = shared.sceneElements;
    const bounds = sceneElements ? computeSceneBounds(sceneElements) : null;
    const dimsHint = bounds
        ? `Derived from 3D scene bounds: ~${Math.ceil(bounds.width)}x${Math.ceil(bounds.depth)}x${Math.ceil(bounds.height)}mm (W x D x H).`
        : kind3d === 'object'
            ? 'Default to a hand-sized object (e.g. ~200mm tall for a small plush/toy).'
            : 'Auto-size based on components (typical: 80x50x30mm).';

    const template = kind3d === 'object' ? OPENSCAD_OBJECT_PROMPT : OPENSCAD_GENERATION_PROMPT;
    const basePrompt = fillPromptTemplate(template, {
        description,
        components,
        features,
        dimensions: dimsHint,
    });

    const prompt = [
        basePrompt,
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing OpenSCAD (update this, keep it compiling):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    try {
        const content = await callLLM(prompt, modelName, task.agent, 'agent:openscad', 4000);
        if (!content) {
            throw new Error('No response from AI');
        }

        return {
            outputType: 'openscad',
            content,
            summary: updateOrRegenerate === 'update' ? 'Updated OpenSCAD model' : 'Generated OpenSCAD model',
        };
    } catch (err) {
        recordChatError(modelName, { agent: task.agent, source: 'agent:openscad' }, err as Error);
        const fallback = isNonEmptyString(current)
            ? current
            : fallbackOpenSCAD(description, bounds);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
            outputType: 'openscad',
            content: fallback,
            summary: `Used fallback OpenSCAD (error: ${message})`,
        };
    }
};

const handleBom: AgentHandler = async (task, _ctx, _shared, opts) => {
    const { description, modelName, components, features, updateOrRegenerate, current } = opts;

    const prompt = [
        fillPromptTemplate(BOM_GENERATION_PROMPT, {
            description,
            components,
            requirements: features,
            pricingContext: '',
        }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing BOM (update this, preserve table structure):\n\n${current}`
            : '',
        '',
        'Output ONLY the BOM table in Markdown (no extra commentary). Preserve the header and separator row exactly.'
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:bom', 3000);
    const fallbackBom = isNonEmptyString(current) ? normalizeBomMarkdown(current) : '';
    return {
        outputType: 'bom',
        content: content ? normalizeBomMarkdown(content) : fallbackBom,
        summary: updateOrRegenerate === 'update' ? 'Updated BOM' : 'Generated BOM',
    };
};

const handleAssembly: AgentHandler = async (task, ctx, _shared, opts) => {
    const { description, modelName, updateOrRegenerate, current } = opts;

    const bom = ctx.outputs?.bom || 'Not generated';
    const basePrompt = fillPromptTemplate(ASSEMBLY_INSTRUCTIONS_PROMPT, {
        description,
        bom,
    });

    const prompt = [
        basePrompt,
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing assembly instructions (update these):\n\n${current}`
            : '',
        '',
        'Output ONLY the updated assembly instructions in Markdown (no extra commentary).'
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:assembly', 3000);
    return {
        outputType: 'assembly',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated assembly instructions' : 'Generated assembly instructions',
    };
};

const handleFirmware: AgentHandler = async (task, _ctx, _shared, opts) => {
    const { description, modelName, components, features, updateOrRegenerate, current } = opts;

    const prompt = [
        fillPromptTemplate(FIRMWARE_GENERATION_PROMPT, {
            description,
            mcu: 'Arduino-compatible (ESP32 recommended)',
            components,
            features,
        }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing firmware (update this, keep it compiling):\n\n${current}`
            : '',
        '',
        'Output ONLY the firmware code (no markdown).'
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:firmware', 4000);
    return {
        outputType: 'firmware',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated firmware' : 'Generated firmware',
    };
};

const handleSchematic: AgentHandler = async (task, _ctx, _shared, opts) => {
    const { description, modelName, components, features, updateOrRegenerate, current } = opts;

    const prompt = [
        'Generate a text-based schematic description for this project.',
        '',
        `Project: ${description}`,
        `Components: ${components}`,
        `Features: ${features}`,
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing schematic description (update this):\n\n${current}`
            : '',
        '',
        'Output ONLY the schematic description in Markdown (no extra commentary).'
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:schematic');
    return {
        outputType: 'schematic',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated schematic' : 'Generated schematic',
    };
};

const handleSafety: AgentHandler = async (task, ctx, _shared, opts) => {
    const { description, modelName, updateOrRegenerate, current } = opts;
    const bom = ctx.outputs?.bom || 'Not generated';

    const prompt = [
        fillPromptTemplate(SAFETY_REVIEW_PROMPT, { description, bom }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing safety report (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:safety');
    return {
        outputType: 'safety',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated safety review' : 'Generated safety review',
    };
};

const handleSustainability: AgentHandler = async (task, ctx, _shared, opts) => {
    const { description, modelName, updateOrRegenerate, current } = opts;
    const bom = ctx.outputs?.bom || 'Not generated';
    const sceneJson = ctx.outputs?.['scene-json'] || '';
    const volumeEstimate = sceneJson ? 'Estimated from 3D model' : 'Unable to estimate (no 3D model)';

    const prompt = [
        fillPromptTemplate(SUSTAINABILITY_ANALYSIS_PROMPT, { description, bom, volumeEstimate }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing sustainability report (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:sustainability');
    return {
        outputType: 'sustainability',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated sustainability report' : 'Generated sustainability report',
    };
};

const handleCostOptimization: AgentHandler = async (task, ctx, _shared, opts) => {
    const { description, modelName, updateOrRegenerate, current } = opts;
    const bom = ctx.outputs?.bom || 'Not generated';

    const prompt = [
        fillPromptTemplate(COST_OPTIMIZATION_PROMPT, { description, bom }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing cost optimization report (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:cost-optimization');
    return {
        outputType: 'cost-optimization',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated cost optimization' : 'Generated cost optimization',
    };
};

const handleDfm: AgentHandler = async (task, ctx, _shared, opts) => {
    const { description, modelName, updateOrRegenerate, current } = opts;
    const sceneJson = ctx.outputs?.['scene-json'] || 'No 3D model available';

    const prompt = [
        fillPromptTemplate(DFM_ANALYSIS_PROMPT, { description, sceneDescription: sceneJson }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing DFM analysis (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:dfm');
    return {
        outputType: 'dfm',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated DFM analysis' : 'Generated DFM analysis',
    };
};

const handleMarketing: AgentHandler = async (task, _ctx, _shared, opts) => {
    const { description, modelName, features, updateOrRegenerate, current } = opts;

    const prompt = [
        fillPromptTemplate(MARKETING_GENERATION_PROMPT, { description, features }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing marketing brief (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:marketing');
    return {
        outputType: 'marketing',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated marketing brief' : 'Generated marketing brief',
    };
};

const handlePatentRisk: AgentHandler = async (task, _ctx, _shared, opts) => {
    const { description, modelName, components, features, updateOrRegenerate, current } = opts;

    const prompt = [
        fillPromptTemplate(PATENT_RISK_PROMPT, { description, components, features }),
        '',
        `User instruction: ${task.instruction}`,
        '',
        updateOrRegenerate === 'update' && isNonEmptyString(current)
            ? `Existing patent risk assessment (update this):\n\n${current}`
            : '',
    ].filter(Boolean).join('\n');

    const content = await callLLM(prompt, modelName, task.agent, 'agent:patent-risk');
    return {
        outputType: 'patent-risk',
        content: content || (isNonEmptyString(current) ? current : ''),
        summary: updateOrRegenerate === 'update' ? 'Updated patent risk assessment' : 'Generated patent risk assessment',
    };
};

// ---------------------------------------------------------------------------
// Dispatch map: output type -> handler
// ---------------------------------------------------------------------------

const AGENT_HANDLERS: Record<string, AgentHandler> = {
    'scene-json': handleSceneJson,
    'openscad': handleOpenscad,
    'bom': handleBom,
    'assembly': handleAssembly,
    'firmware': handleFirmware,
    'schematic': handleSchematic,
    'safety': handleSafety,
    'sustainability': handleSustainability,
    'cost-optimization': handleCostOptimization,
    'dfm': handleDfm,
    'marketing': handleMarketing,
    'patent-risk': handlePatentRisk,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function executeAgentTask(
    task: AgentTask,
    ctx: AgentExecutionContext,
    _openai: unknown, // Kept for backward compatibility but now unused
    shared: { sceneElements?: ReturnType<typeof fallbackScene> },
    options?: { model?: string }
): Promise<AgentExecutionResult> {
    const { components, features } = buildContextStrings(ctx);
    const description =
        buildProjectDescription(ctx.description, ctx.analysis?.summary) ||
        ctx.description ||
        ctx.analysis?.summary ||
        'Hardware project';
    const modelName = getModelName('text', options?.model);

    const current = ctx.outputs?.[task.outputType];
    const kind3d = infer3DKind(description, ctx.analysis);

    const updateOrRegenerate: 'update' | 'regenerate' =
        task.action === 'regenerate' || !isNonEmptyString(current)
            ? 'regenerate'
            : 'update';

    const handlerOptions: HandlerOptions = {
        model: options?.model,
        modelName,
        kind3d,
        description,
        components,
        features,
        updateOrRegenerate,
        current,
    };

    const handler = AGENT_HANDLERS[task.outputType];
    if (!handler) {
        // Should be unreachable due to validation, but keep a safe default.
        return {
            outputType: task.outputType,
            content: isNonEmptyString(current) ? current : '',
            summary: `No agent implemented for ${task.outputType}`,
        };
    }

    return handler(task, ctx, shared, handlerOptions);
}
