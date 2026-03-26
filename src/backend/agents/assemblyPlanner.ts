import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { SYSTEM_PROMPT, ASSEMBLY_SPEC_PROMPT, ASSEMBLY_SPEC_REFINE_PROMPT, fillPromptTemplate } from '@/backend/ai/prompts';
import type { VisionAnalysis } from './visionAnalyzer';
import { buildFallbackAssemblySpec, parseAssemblySpec, type AssemblySpec } from '@/backend/pipeline/assemblySpec';
import { buildProjectDescription } from '@/shared/domain/projectDescription';
import type { AnalysisResult } from '@/shared/types';

function stripCodeFences(text: string): string {
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

export async function planAssemblySpec(
    visionAnalysis: VisionAnalysis | null,
    description: string,
    preferredModel?: string,
    context?: { analysis?: Partial<AnalysisResult>; instruction?: string }
): Promise<AssemblySpec> {
    const llmClient = getLLMClient();
    const modelName = getModelName('text', preferredModel);
    const mergedDescription = buildProjectDescription(description, visionAnalysis?.objectName) || description;
    const instruction = context?.instruction ? `User request: ${context.instruction}` : 'None';

    const prompt = fillPromptTemplate(ASSEMBLY_SPEC_PROMPT, {
        description: mergedDescription,
        vision: JSON.stringify(visionAnalysis ?? {}, null, 2),
        analysis: JSON.stringify(context?.analysis ?? {}, null, 2),
        instruction,
    });

    try {
        const response = await llmClient.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2200,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
        });

        recordChatUsage(response, modelName, { source: 'agent:assembly-spec' });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = parseAssemblySpec(stripCodeFences(content));
            if (parsed) return parsed;
        }

        return buildFallbackAssemblySpec(mergedDescription, context?.analysis);
    } catch (error) {
        recordChatError(modelName, { source: 'agent:assembly-spec' }, error as Error);
        return buildFallbackAssemblySpec(mergedDescription, context?.analysis);
    }
}

export async function refineAssemblySpec(
    current: AssemblySpec,
    critique: unknown,
    description: string,
    preferredModel?: string
): Promise<AssemblySpec> {
    const llmClient = getLLMClient();
    const modelName = getModelName('text', preferredModel);

    const prompt = fillPromptTemplate(ASSEMBLY_SPEC_REFINE_PROMPT, {
        description,
        spec: JSON.stringify(current, null, 2),
        critique: JSON.stringify(critique, null, 2),
    });

    try {
        const response = await llmClient.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2000,
            stream: false as const,
            ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } }),
        });

        recordChatUsage(response, modelName, { source: 'agent:assembly-spec-refine' });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = parseAssemblySpec(stripCodeFences(content));
            if (parsed) return parsed;
        }
        return current;
    } catch (error) {
        recordChatError(modelName, { source: 'agent:assembly-spec-refine' }, error as Error);
        return current;
    }
}
