import type OpenAI from 'openai';
import {
    ASSEMBLY_INSTRUCTIONS_PROMPT,
    BOM_GENERATION_PROMPT,
    FIRMWARE_GENERATION_PROMPT,
    OPENSCAD_GENERATION_PROMPT,
    OPENSCAD_OBJECT_PROMPT,
    SCENE_GENERATION_PROMPT,
    SCENE_OBJECT_PROMPT,
    SYSTEM_PROMPT,
    fillPromptTemplate,
} from '@/lib/prompts';
import { beautifyScene, computeSceneBounds, fallbackScene, normalizeSceneColors, parseSceneElements } from '@/lib/scene';
import { fallbackOpenSCAD } from '@/lib/openscad';
import { infer3DKind } from '@/lib/projectKind';
import type {
    AgentPlan,
    AgentTask,
    AgentOutputType,
    ProjectOutputs,
    RequestedOutput,
} from '@/types';

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

function buildContextStrings(ctx: AgentExecutionContext) {
    const components = ctx.analysis?.identifiedComponents?.join(', ') || 'Not specified';
    const features = ctx.analysis?.suggestedFeatures?.join(', ') || 'Not specified';
    return { components, features };
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export async function executeAgentTask(
    task: AgentTask,
    ctx: AgentExecutionContext,
    openai: OpenAI,
    shared: { sceneElements?: ReturnType<typeof fallbackScene> }
): Promise<AgentExecutionResult> {
    const { components, features } = buildContextStrings(ctx);
    const description = ctx.description || ctx.analysis?.summary || 'Hardware project';

    const current = ctx.outputs?.[task.outputType];

    const updateOrRegenerate = task.action === 'regenerate' || !isNonEmptyString(current)
        ? 'regenerate'
        : 'update';

    if (task.outputType === 'scene-json') {
        const kind3d = infer3DKind(description, ctx.analysis);
        const template = kind3d === 'object' ? SCENE_OBJECT_PROMPT : SCENE_GENERATION_PROMPT;
        const prompt = [
            fillPromptTemplate(template, { description, components, features }),
            '',
            `User instruction: ${task.instruction}`,
            '',
            'Important: Use a white/grey palette for the main enclosure/body (avoid near-black plastics).',
        ].join('\n');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            const scene = normalizeSceneColors(beautifyScene(fallbackScene(description), description));
            shared.sceneElements = scene;
            return {
                outputType: 'scene-json',
                content: JSON.stringify(scene, null, 2),
                summary: 'Generated a 3D scene (fallback)',
                sceneElements: scene,
            };
        }

        const parsed = parseSceneElements(content);
        const scene = normalizeSceneColors(beautifyScene(parsed ?? fallbackScene(description), description));
        shared.sceneElements = scene;
        return {
            outputType: 'scene-json',
            content: JSON.stringify(scene, null, 2),
            summary: 'Generated a 3D scene',
            sceneElements: scene,
        };
    }

    if (task.outputType === 'openscad') {
        const kind3d = infer3DKind(description, ctx.analysis);
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
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 4000,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from AI');
            }

            return {
                outputType: 'openscad',
                content,
                summary: updateOrRegenerate === 'update' ? 'Updated OpenSCAD model' : 'Generated OpenSCAD model',
            };
        } catch (err) {
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
    }

    if (task.outputType === 'bom') {
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
            'Output ONLY the updated BOM in Markdown (no extra commentary).'
        ].filter(Boolean).join('\n');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content;
        return {
            outputType: 'bom',
            content: content || (isNonEmptyString(current) ? current : ''),
            summary: updateOrRegenerate === 'update' ? 'Updated BOM' : 'Generated BOM',
        };
    }

    if (task.outputType === 'assembly') {
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

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content;
        return {
            outputType: 'assembly',
            content: content || (isNonEmptyString(current) ? current : ''),
            summary: updateOrRegenerate === 'update' ? 'Updated assembly instructions' : 'Generated assembly instructions',
        };
    }

    if (task.outputType === 'firmware') {
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

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        return {
            outputType: 'firmware',
            content: content || (isNonEmptyString(current) ? current : ''),
            summary: updateOrRegenerate === 'update' ? 'Updated firmware' : 'Generated firmware',
        };
    }

    if (task.outputType === 'schematic') {
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

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2500,
        });

        const content = response.choices[0]?.message?.content;
        return {
            outputType: 'schematic',
            content: content || (isNonEmptyString(current) ? current : ''),
            summary: updateOrRegenerate === 'update' ? 'Updated schematic' : 'Generated schematic',
        };
    }

    // Should be unreachable due to validation, but keep a safe default.
    return {
        outputType: task.outputType,
        content: isNonEmptyString(current) ? current : '',
        summary: `No agent implemented for ${task.outputType}`,
    };
}
