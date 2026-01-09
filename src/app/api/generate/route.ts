import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, getModelName, handleOpenAIError, isOfflineMode } from '@/lib/openai';
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
import type { GenerateResponse, ProjectOutputs, ProjectMetadata } from '@/types';
import { computeSceneBounds, normalizeSceneColors, fallbackScene, sanitizeSceneElements } from '@/lib/scene';
import { fallbackOpenSCAD } from '@/lib/openscad';
import { orchestrate3DGeneration } from '@/lib/agents';
import { buildProjectDescription } from '@/lib/projectDescription';
import { infer3DKind } from '@/lib/projectKind';
import { normalizeBomMarkdown } from '@/lib/bom';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request
        const validationResult = generateRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json<GenerateResponse>(
                { success: false, error: validationResult.error.message },
                { status: 400 }
            );
        }

        const { projectDescription, analysisContext, outputTypes, sketchImage, model } = validationResult.data;
        const mergedDescription =
            buildProjectDescription(projectDescription, analysisContext?.summary) || projectDescription;
        const uniqueOutputTypes = Array.from(new Set(outputTypes));

        const llmClient = getLLMClient();
        const outputs: ProjectOutputs = {};
        const allowPricingLookup = !isOfflineMode();

        // Build context from analysis
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
        let pipelineTrace: string[] | undefined;

        if (uniqueOutputTypes.includes('scene-json')) {
            console.log('Starting multi-agent 3D generation pipeline...');

            try {
                // Use the new multi-agent orchestrator
                const result = await orchestrate3DGeneration(
                    sketchImage, // Pass the sketch image for vision analysis
                    mergedDescription,
                    { maxIterations: 2, minAcceptableScore: 7, model }
                );

                console.log('Agent pipeline completed:', {
                    success: result.success,
                    iterations: result.iterations,
                    objectType: result.visionAnalysis.objectType,
                    elementCount: result.scene.length
                });

                // Log for debugging
                result.logs.forEach(log => console.log('[Agent]', log));
                pipelineTrace = result.logs;

                // Convert to scene elements format
                const kind3d = infer3DKind(mergedDescription, analysisContext);
                const sanitized = sanitizeSceneElements(result.scene, { kind: kind3d });
                const baseScene = sanitized.length > 0 ? sanitized : fallbackScene(mergedDescription);
                sceneElements = normalizeSceneColors(baseScene);

                outputs['scene-json'] = JSON.stringify(sceneElements, null, 2);
            } catch (err) {
                console.error('Agent pipeline failed:', err);
                // Use intelligent fallback that detects object type from description
                pipelineTrace = ['3D pipeline failed, using fallback scene.'];
                sceneElements = fallbackScene(mergedDescription);
                outputs['scene-json'] = JSON.stringify(sceneElements, null, 2);
            }
        }

        const non3dOutputTypes = uniqueOutputTypes.filter((t) => t !== 'openscad' && t !== 'scene-json');

        await Promise.allSettled(non3dOutputTypes.map(async (outputType) => {
            let prompt: string;

            switch (outputType) {
                case 'bom':
                    // Fetch real-time pricing
                    const componentList = components.split(',').map(c => c.trim());
                    let pricingContext = '';

                    if (allowPricingLookup) {
                        try {
                            const prices = await Promise.all(
                                componentList.slice(0, 5).map(async (comp) => { // Limit to 5 queries
                                    const price = await searchComponentPrice(comp);
                                    return `${comp}: ${price}`;
                                })
                            );
                            pricingContext = prices.join('\n');
                        } catch (e) {
                            console.error('Pricing search failed', e);
                        }
                    }

                    prompt = fillPromptTemplate(BOM_GENERATION_PROMPT, {
                        description: mergedDescription,
                        components,
                        requirements: features,
                        pricingContext: pricingContext ? `Real-time pricing data:\n${pricingContext}` : ''
                    });
                    break;

                case 'assembly':
                    prompt = fillPromptTemplate(ASSEMBLY_INSTRUCTIONS_PROMPT, {
                        description: mergedDescription,
                        // Note: In parallel mode, we don't have the bom yet, so we pass a placeholder or the components list
                        bom: 'See Components List',
                    });
                    break;

                case 'firmware':
                    prompt = fillPromptTemplate(FIRMWARE_GENERATION_PROMPT, {
                        description: mergedDescription,
                        mcu: 'Arduino-compatible (ESP32 recommended)',
                        components,
                        features,
                    });
                    break;

                case 'schematic':
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
                const response = await llmClient.chat.completions.create({
                    model: getModelName('text', model),
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: 4000,
                });

                const content = response.choices[0]?.message?.content;
                if (content) {
                    outputs[outputType] = outputType === 'bom' ? normalizeBomMarkdown(content) : content;
                }
            } catch (err) {
                console.error(`Failed to generate ${outputType}:`, err);
                // We don't throw here to allow other generations to succeed
            }
        }));

        if (uniqueOutputTypes.includes('openscad')) {
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
                const response = await llmClient.chat.completions.create({
                    model: getModelName('text', model),
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: 4000,
                });

                const content = response.choices[0]?.message?.content;
                if (content) {
                    outputs.openscad = content;
                } else {
                    outputs.openscad = fallbackOpenSCAD(mergedDescription, bounds);
                }
            } catch (err) {
                console.error('Failed to generate openscad:', err);
                outputs.openscad = fallbackOpenSCAD(mergedDescription, bounds);
            }
        }

        // Generate metadata based on analysis
        const metadata: ProjectMetadata = {
            estimatedCost: analysisContext?.complexityScore
                ? analysisContext.complexityScore * 15 + 20
                : 50,
            complexity: analysisContext?.complexity || 'moderate',
            buildTime: analysisContext?.complexityScore
                ? `${Math.ceil(analysisContext.complexityScore / 2)} hours`
                : '2-4 hours',
        };

        return NextResponse.json<GenerateResponse>({
            success: true,
            outputs,
            metadata,
            trace: pipelineTrace,
        });

    } catch (error) {
        console.error('Generate error:', error);

        try {
            await handleOpenAIError(error);
        } catch (handledError) {
            return NextResponse.json<GenerateResponse>(
                { success: false, error: (handledError as Error).message },
                { status: 500 }
            );
        }

        return NextResponse.json<GenerateResponse>(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
