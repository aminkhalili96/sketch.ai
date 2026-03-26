export type ModelOption = {
    id: string;
    label: string;
    description: string;
    /** If true, this model only works in offline mode (local Ollama) */
    isOfflineOnly?: boolean;
};

export type ModelGroup = {
    title: string;
    options: ModelOption[];
};

export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.2';
export const DEFAULT_OPENAI_VISION_MODEL = 'gpt-4o';

export const MODEL_CATALOG: ModelGroup[] = [
    {
        title: 'Flagship Intelligence (Reasoning & Code)',
        options: [
            {
                id: 'gpt-5.2-pro',
                label: 'gpt-5.2-pro',
                description: 'State of the art for reasoning and precision.'
            },
            {
                id: 'gpt-5.2',
                label: 'gpt-5.2',
                description: 'Recommended flagship for complex agentic tasks and coding.'
            },
            {
                id: 'gpt-5.1',
                label: 'gpt-5.1',
                description: 'Previous stable flagship.'
            },
            {
                id: 'gpt-5',
                label: 'gpt-5',
                description: 'Configurable reasoning effort model.'
            }
        ]
    },
    {
        title: 'Efficiency & Speed',
        options: [
            {
                id: 'gpt-4.5-turbo',
                label: 'gpt-4.5-turbo',
                description: 'Faster model with large context.'
            },
            {
                id: 'gpt-5-mini',
                label: 'gpt-5-mini',
                description: 'High intelligence with lower cost and latency.'
            },
            {
                id: 'gpt-5-nano',
                label: 'gpt-5-nano',
                description: 'Lower cost and latency for quick tasks.'
            },
            {
                id: 'gpt-4.1-mini',
                label: 'gpt-4.1-mini',
                description: 'Ultra-lightweight option.'
            },
            {
                id: 'gpt-4.1-nano',
                label: 'gpt-4.1-nano',
                description: 'Ultra-lightweight option for fast responses.'
            },
            {
                id: 'gpt-4o-mini',
                label: 'gpt-4o-mini',
                description: 'Legacy efficient model.'
            }
        ]
    },
    {
        title: 'Open Source (Local/Offline)',
        options: [
            {
                id: 'qwen3:32b',
                label: 'Qwen3 32B',
                description: 'Best quality: superior reasoning and structured JSON for 3D models.',
                isOfflineOnly: true
            },
            {
                id: 'qwen3:14b',
                label: 'Qwen3 14B',
                description: 'Strong reasoning with faster inference. Great balance of quality and speed.',
                isOfflineOnly: true
            },
            {
                id: 'qwen3:8b',
                label: 'Qwen3 8B',
                description: 'Fast and capable. Ideal for quick iteration and testing.',
                isOfflineOnly: true
            },
            {
                id: 'gemma3:27b',
                label: 'Gemma 3 27B',
                description: 'Google DeepMind flagship open model. Strong reasoning and instruction following.',
                isOfflineOnly: true
            },
            {
                id: 'qwen3-vl:8b',
                label: 'Qwen3-VL 8B',
                description: 'Best for 3D: advanced spatial understanding & visual coding.',
                isOfflineOnly: true
            },
            {
                id: 'deepseek-coder-v2:16b',
                label: 'DeepSeek-Coder-V2 16B',
                description: 'Best for JSON/code generation with strong reasoning.',
                isOfflineOnly: true
            },
            {
                id: 'qwen2.5-coder:14b',
                label: 'Qwen2.5-Coder 14B',
                description: 'Fast coding model for text/JSON generation.',
                isOfflineOnly: true
            },
            {
                id: 'qwen2.5:14b',
                label: 'Qwen2.5 14B',
                description: 'General-purpose model with strong multilingual support.',
                isOfflineOnly: true
            },
            {
                id: 'qwen2.5:7b',
                label: 'Qwen2.5 7B',
                description: 'Lightweight general-purpose model. Fast responses.',
                isOfflineOnly: true
            },
            {
                id: 'glm4:9b',
                label: 'GLM-4 9B',
                description: 'Z.ai GLM-4 model with strong Chinese/English bilingual support.',
                isOfflineOnly: true
            },
            {
                id: 'codegeex4:9b',
                label: 'CodeGeeX4 9B',
                description: 'Z.ai code generation model optimized for programming tasks.',
                isOfflineOnly: true
            },
            {
                id: 'gpt-oss:20b',
                label: 'GPT-OSS 20B',
                description: 'Community open-source GPT variant. Large context reasoning.',
                isOfflineOnly: true
            },
            {
                id: 'llava:7b',
                label: 'LLaVA 7B',
                description: 'Vision-language model for image understanding tasks.',
                isOfflineOnly: true
            },
            {
                id: 'malaya-ai:latest',
                label: 'Malaya AI',
                description: 'Custom Malay/Manglish language model.',
                isOfflineOnly: true
            }
        ]
    }
];

const INTERNAL_MODEL_IDS = ['gpt-4o'];
export const MODEL_IDS = new Set<string>([
    ...MODEL_CATALOG.flatMap((group) => group.options.map((option) => option.id)),
    ...INTERNAL_MODEL_IDS,
]);

export const MODEL_LOOKUP = new Map(
    MODEL_CATALOG.flatMap((group) => group.options.map((option) => [option.id, option] as const))
);

const GENERIC_MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]{2,120}$/;

export function normalizeModelId(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (MODEL_IDS.has(trimmed)) return trimmed;
    // Allow well-formed custom/local model ids (e.g., Ollama tags like "qwen3-vl:8b").
    return GENERIC_MODEL_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function getModelDescription(modelId: string): string | undefined {
    return MODEL_LOOKUP.get(modelId)?.description;
}

export function isVisionCapableModel(modelId: string): boolean {
    const trimmed = modelId.trim();
    const capableModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.5-turbo',
        'gpt-5.2',
        'gpt-5.2-pro',
        'gpt-5.1',
        'gpt-5',
        'gpt-4-turbo',
        // Common local vision-capable families
        'qwen3-vl:8b',
        'qwen2.5-vl:7b',
        'llava',
        'llava:7b',
        'llava:13b',
        'bakllava',
        'moondream',
        'phi-3-vision',
    ];
    if (capableModels.includes(trimmed)) return true;
    // Use word boundary for "vl" to avoid false positives on names that merely contain the substring
    return /(\bvl\b|vision|llava|bakllava|moondream)/i.test(trimmed);
}
