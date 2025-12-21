import { NextRequest } from 'next/server';
import { getOpenAIClient, handleOpenAIError } from '@/lib/openai';
import { searchComponentPrice } from '@/lib/tavily';
import {
    SYSTEM_PROMPT,
    BOM_GENERATION_PROMPT,
    ASSEMBLY_INSTRUCTIONS_PROMPT,
    FIRMWARE_GENERATION_PROMPT,
    OPENSCAD_GENERATION_PROMPT,
    OPENSCAD_OBJECT_PROMPT,
    fillPromptTemplate,
} from '@/lib/prompts';
import { generateRequestSchema } from '@/lib/validators';
import type { ProjectOutputs, ProjectMetadata } from '@/types';
import { computeSceneBounds, normalizeSceneColors, fallbackScene, sanitizeSceneElements } from '@/lib/scene';
import { fallbackOpenSCAD } from '@/lib/openscad';
import { orchestrate3DGeneration } from '@/lib/agents';
import { buildProjectDescription } from '@/lib/projectDescription';
import { infer3DKind } from '@/lib/projectKind';
import { normalizeBomMarkdown } from '@/lib/bom';

export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (payload: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };

            try {
                const body = await request.json();

                const validationResult = generateRequestSchema.safeParse(body);
                if (!validationResult.success) {
                    send({ type: 'error', error: validationResult.error.message });
                    controller.close();
                    return;
                }

                const { projectDescription, analysisContext, outputTypes, sketchImage } = validationResult.data;
                const mergedDescription =
                    buildProjectDescription(projectDescription, analysisContext?.summary) || projectDescription;
                const uniqueOutputTypes = Array.from(new Set(outputTypes));

                const openai = getOpenAIClient();
                const outputs: ProjectOutputs = {};

                const components = analysisContext?.identifiedComponents.join(', ') || 'Not specified';
                const features = analysisContext?.suggestedFeatures.join(', ') || 'Not specified';

                let sceneElements: Array<{
                    type: string;
                    position: [number, number, number];
                    rotation?: [number, number, number];
                    dimensions: [number, number, number];
                    color?: string;
                    material?: string;
                    name?: string;
                    radius?: number;
                    smoothness?: number;
                }> | null = null;

                send({ type: 'status', message: 'Starting generation...' });

                if (uniqueOutputTypes.includes('scene-json')) {
                    send({ type: 'status', outputType: 'scene-json', message: 'Generating 3D scene...' });

                    try {
                        const result = await orchestrate3DGeneration(
                            sketchImage,
                            mergedDescription,
                            { maxIterations: 2, minAcceptableScore: 7 }
                        );

                        const kind3d = infer3DKind(mergedDescription, analysisContext);
                        const sanitized = sanitizeSceneElements(result.scene, { kind: kind3d });
                        const baseScene = sanitized.length > 0 ? sanitized : fallbackScene(mergedDescription);
                        sceneElements = normalizeSceneColors(baseScene);

                        outputs['scene-json'] = JSON.stringify(sceneElements, null, 2);
                        send({ type: 'output', outputType: 'scene-json', content: outputs['scene-json'] });
                    } catch (err) {
                        console.error('Agent pipeline failed:', err);
                        sceneElements = fallbackScene(mergedDescription);
                        outputs['scene-json'] = JSON.stringify(sceneElements, null, 2);
                        send({
                            type: 'status',
                            outputType: 'scene-json',
                            message: '3D pipeline failed, using fallback scene.',
                        });
                        send({ type: 'output', outputType: 'scene-json', content: outputs['scene-json'] });
                    }
                }

                const non3dOutputTypes = uniqueOutputTypes.filter((t) => t !== 'openscad' && t !== 'scene-json');

                await Promise.allSettled(non3dOutputTypes.map(async (outputType) => {
                    let prompt: string;

                    switch (outputType) {
                        case 'bom': {
                            send({ type: 'status', outputType: 'bom', message: 'Generating BOM...' });
                            const componentList = components.split(',').map(c => c.trim());
                            let pricingContext = '';

                            try {
                                const prices = await Promise.all(
                                    componentList.slice(0, 5).map(async (comp) => {
                                        const price = await searchComponentPrice(comp);
                                        return `${comp}: ${price}`;
                                    })
                                );
                                pricingContext = prices.join('\n');
                            } catch (e) {
                                console.error('Pricing search failed', e);
                            }

                            prompt = fillPromptTemplate(BOM_GENERATION_PROMPT, {
                                description: mergedDescription,
                                components,
                                requirements: features,
                                pricingContext: pricingContext ? `Real-time pricing data:\n${pricingContext}` : ''
                            });
                            break;
                        }
                        case 'assembly':
                            send({ type: 'status', outputType: 'assembly', message: 'Generating assembly guide...' });
                            prompt = fillPromptTemplate(ASSEMBLY_INSTRUCTIONS_PROMPT, {
                                description: mergedDescription,
                                bom: 'See Components List',
                            });
                            break;
                        case 'firmware':
                            send({ type: 'status', outputType: 'firmware', message: 'Generating firmware...' });
                            prompt = fillPromptTemplate(FIRMWARE_GENERATION_PROMPT, {
                                description: mergedDescription,
                                mcu: 'Arduino-compatible (ESP32 recommended)',
                                components,
                                features,
                            });
                            break;
                        case 'schematic':
                            send({ type: 'status', outputType: 'schematic', message: 'Generating schematic...' });
                            prompt = `Generate a text-based schematic description for: ${mergedDescription}
           
Components: ${components}

Describe the circuit connections in detail, including:
1. Power distribution
2. Signal connections
3. Component pinouts
4. Recommended PCB layout tips`;
                            break;
                        default:
                            return;
                    }

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
                        if (content) {
                            outputs[outputType] = outputType === 'bom' ? normalizeBomMarkdown(content) : content;
                            send({ type: 'output', outputType, content: outputs[outputType] });
                        } else {
                            send({ type: 'status', outputType, message: `No content generated for ${outputType}.` });
                        }
                    } catch (err) {
                        console.error(`Failed to generate ${outputType}:`, err);
                        send({
                            type: 'status',
                            outputType,
                            message: `Failed to generate ${outputType}.`,
                        });
                    }
                }));

                if (uniqueOutputTypes.includes('openscad')) {
                    send({ type: 'status', outputType: 'openscad', message: 'Generating OpenSCAD model...' });
                    const bounds = sceneElements ? computeSceneBounds(sceneElements as Parameters<typeof computeSceneBounds>[0]) : null;
                    const kind3d = infer3DKind(mergedDescription, analysisContext);
                    const dimsHint = bounds
                        ? `Derived from 3D scene bounds: ~${Math.ceil(bounds.width)}x${Math.ceil(bounds.depth)}x${Math.ceil(bounds.height)}mm (W x D x H).`
                        : kind3d === 'object'
                            ? 'Default to a hand-sized object (e.g. ~200mm tall for a small plush/toy).'
                            : 'Auto-size based on components (typical: 80x50x30mm).';

                    const template = kind3d === 'object' ? OPENSCAD_OBJECT_PROMPT : OPENSCAD_GENERATION_PROMPT;
                    const prompt = fillPromptTemplate(template, {
                        description: mergedDescription,
                        components,
                        features,
                        dimensions: dimsHint,
                    });

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
                        outputs.openscad = content || fallbackOpenSCAD(mergedDescription, bounds);
                        send({ type: 'output', outputType: 'openscad', content: outputs.openscad });
                    } catch (err) {
                        console.error('Failed to generate openscad:', err);
                        outputs.openscad = fallbackOpenSCAD(mergedDescription, bounds);
                        send({
                            type: 'status',
                            outputType: 'openscad',
                            message: 'OpenSCAD generation failed, using fallback.',
                        });
                        send({ type: 'output', outputType: 'openscad', content: outputs.openscad });
                    }
                }

                const metadata: ProjectMetadata = {
                    estimatedCost: analysisContext?.complexityScore
                        ? analysisContext.complexityScore * 15 + 20
                        : 50,
                    complexity: analysisContext?.complexity || 'moderate',
                    buildTime: analysisContext?.complexityScore
                        ? `${Math.ceil(analysisContext.complexityScore / 2)} hours`
                        : '2-4 hours',
                };

                send({ type: 'metadata', metadata });
                send({ type: 'done' });
                controller.close();
            } catch (error) {
                let message = 'An unexpected error occurred';
                try {
                    await handleOpenAIError(error);
                } catch (handledError) {
                    message = (handledError as Error).message;
                }
                send({ type: 'error', error: message });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
