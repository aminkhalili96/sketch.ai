'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/frontend/lib/utils';
import { useProjectStore } from '@/frontend/state/projectStore';
import {
    DEFAULT_OPENAI_TEXT_MODEL,
    MODEL_CATALOG,
    getModelDescription,
    type ModelOption,
} from '@/shared/ai/modelCatalog';

type ModelSelectorProps = {
    label?: string;
    compact?: boolean;
    className?: string;
};

type OfflineModelsPayload = {
    success?: boolean;
    models?: string[];
};

const STATIC_OFFLINE_MODEL_IDS = new Set(
    MODEL_CATALOG.flatMap((group) =>
        group.options.filter((option) => option.isOfflineOnly).map((option) => option.id)
    )
);

const OFFLINE_MODEL_PREFERENCE = [/qwen3(?!-vl)/i, /deepseek/i, /coder/i, /qwen/i, /llama/i, /mistral/i];
const PROVIDER_ORDER = ['OpenAI', 'DeepSeek', 'Google', 'Qwen', 'Meta', 'Anthropic', 'Mistral', 'LLaVA', 'Malaya AI', 'Microsoft', 'Other'] as const;

function toInstalledOfflineOptions(models: string[]): ModelOption[] {
    const unique = Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
    return unique.map((id) => ({
        id,
        label: id,
        description: 'Installed in local Ollama runtime.',
        isOfflineOnly: true,
    }));
}

function pickPreferredOfflineModel(installedModels: string[]): string {
    for (const pattern of OFFLINE_MODEL_PREFERENCE) {
        const match = installedModels.find((model) => pattern.test(model));
        if (match) return match;
    }
    return installedModels[0] ?? 'qwen3:32b';
}

function inferProvider(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.startsWith('gpt-') || lower.includes('openai')) return 'OpenAI';
    if (lower.includes('deepseek')) return 'DeepSeek';
    if (lower.includes('gemma')) return 'Google';
    if (lower.includes('qwen')) return 'Qwen';
    if (lower.includes('llama') || lower.includes('meta-llama')) return 'Meta';
    if (lower.includes('claude') || lower.includes('anthropic')) return 'Anthropic';
    if (lower.includes('mistral')) return 'Mistral';
    if (lower.includes('llava') || lower.includes('bakllava')) return 'LLaVA';
    if (lower.includes('malaya')) return 'Malaya AI';
    if (lower.includes('phi')) return 'Microsoft';
    return 'Other';
}

function providerRank(provider: string): number {
    const index = PROVIDER_ORDER.indexOf(provider as (typeof PROVIDER_ORDER)[number]);
    return index === -1 ? PROVIDER_ORDER.length : index;
}

export function ModelSelector({ label = 'Model', compact = false, className }: ModelSelectorProps) {
    const { selectedModel, setSelectedModel } = useProjectStore();
    const current = selectedModel || DEFAULT_OPENAI_TEXT_MODEL;
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [installedOfflineOptions, setInstalledOfflineOptions] = useState<ModelOption[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function refreshModelState() {
            try {
                const healthRes = await fetch('/api/health');
                const healthData = await healthRes.json();
                const offline = healthData.offlineMode === true;

                if (cancelled) return;
                setIsOfflineMode(offline);

                if (offline) {
                    const offlineRes = await fetch('/api/models/offline');
                    let installedModels: string[] = [];
                    if (offlineRes.ok) {
                        const payload = await offlineRes.json() as OfflineModelsPayload;
                        installedModels = Array.isArray(payload.models) ? payload.models : [];
                    }

                    if (cancelled) return;
                    const installedOptions = toInstalledOfflineOptions(installedModels);
                    setInstalledOfflineOptions(installedOptions);

                    const offlineIds = new Set<string>(STATIC_OFFLINE_MODEL_IDS);
                    for (const option of installedOptions) {
                        offlineIds.add(option.id);
                    }

                    if (!offlineIds.has(current)) {
                        setSelectedModel(pickPreferredOfflineModel(installedModels));
                    }
                    return;
                }

                setInstalledOfflineOptions([]);

                const looksLikeOfflineCustomModel = current.includes(':');
                const shouldResetToOnlineDefault =
                    STATIC_OFFLINE_MODEL_IDS.has(current) || looksLikeOfflineCustomModel;

                if (shouldResetToOnlineDefault && current !== DEFAULT_OPENAI_TEXT_MODEL) {
                    setSelectedModel(DEFAULT_OPENAI_TEXT_MODEL);
                }
            } catch {
                if (cancelled) return;
                setIsOfflineMode(false);
                setInstalledOfflineOptions([]);
            }
        }

        refreshModelState();
        return () => {
            cancelled = true;
        };
    }, [current, setSelectedModel]);

    const providerGroups = useMemo(() => {
        const allOptions = new Map<string, ModelOption>();
        for (const option of MODEL_CATALOG.flatMap((group) => group.options)) {
            allOptions.set(option.id, option);
        }
        for (const option of installedOfflineOptions) {
            if (!allOptions.has(option.id)) {
                allOptions.set(option.id, option);
            }
        }

        const grouped = new Map<string, ModelOption[]>();
        for (const option of allOptions.values()) {
            const provider = inferProvider(option.id);
            const bucket = grouped.get(provider) ?? [];
            bucket.push(option);
            grouped.set(provider, bucket);
        }

        return Array.from(grouped.entries())
            .map(([provider, options]) => ({
                provider,
                options: options
                    .slice()
                    .sort((a, b) => a.label.localeCompare(b.label)),
            }))
            .sort((a, b) => {
                const rankDiff = providerRank(a.provider) - providerRank(b.provider);
                if (rankDiff !== 0) return rankDiff;
                return a.provider.localeCompare(b.provider);
            });
    }, [installedOfflineOptions]);

    const description = useMemo(() => {
        const known = getModelDescription(current);
        if (known) return known;
        if (installedOfflineOptions.some((option) => option.id === current)) {
            return 'Installed local open-source model.';
        }
        return undefined;
    }, [current, installedOfflineOptions]);

    return (
        <div className={cn('space-y-1', className)}>
            {label ? (
                <label className="text-xs font-medium text-neutral-500">{label}</label>
            ) : null}
            <select
                value={current}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none"
                aria-label={label || 'Model selector'}
            >
                {providerGroups.map((group) => (
                    <optgroup key={group.provider} label={group.provider}>
                        {group.options.map((option) => {
                            const isDisabled = option.isOfflineOnly ? !isOfflineMode : isOfflineMode;
                            return (
                                <option
                                    key={option.id}
                                    value={option.id}
                                    disabled={isDisabled}
                                >
                                    {isDisabled ? `⊘ ${option.label} ${isOfflineMode ? '(online only)' : '(offline only)'}` : option.label}
                                </option>
                            );
                        })}
                    </optgroup>
                ))}
            </select>
            {!compact && description ? (
                <p className="text-[11px] text-neutral-400">{description}</p>
            ) : null}
            {!compact && isOfflineMode && (
                <p className="text-[11px] text-green-600">● Offline mode active</p>
            )}
        </div>
    );
}
