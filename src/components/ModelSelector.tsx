'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/projectStore';
import {
    DEFAULT_OPENAI_TEXT_MODEL,
    MODEL_CATALOG,
    getModelDescription,
} from '@/lib/modelCatalog';

type ModelSelectorProps = {
    label?: string;
    compact?: boolean;
    className?: string;
};

export function ModelSelector({ label = 'Model', compact = false, className }: ModelSelectorProps) {
    const { selectedModel, setSelectedModel } = useProjectStore();
    const current = selectedModel || DEFAULT_OPENAI_TEXT_MODEL;

    const description = useMemo(() => getModelDescription(current), [current]);

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
                {MODEL_CATALOG.map((group) => (
                    <optgroup key={group.title} label={group.title}>
                        {group.options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
            {!compact && description ? (
                <p className="text-[11px] text-neutral-400">{description}</p>
            ) : null}
        </div>
    );
}
