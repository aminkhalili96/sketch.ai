export type ModelOption = {
    id: string;
    label: string;
    description: string;
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

export function normalizeModelId(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return MODEL_IDS.has(trimmed) ? trimmed : null;
}

export function getModelDescription(modelId: string): string | undefined {
    return MODEL_LOOKUP.get(modelId)?.description;
}

export function isVisionCapableModel(modelId: string): boolean {
    const capableModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.5-turbo',
        'gpt-5.2',
        'gpt-5.2-pro',
        'gpt-5.1',
        'gpt-5',
        'gpt-4-turbo'
    ];
    return capableModels.includes(modelId);
}

