'use client';

const PIPELINE_STEPS = [
    { id: 'vision', label: 'Vision Analysis', keywords: ['vision', 'analyzing', 'sketch'] },
    { id: 'structure', label: 'Structure Planning', keywords: ['structure', 'planning', 'plan'] },
    { id: 'critique', label: 'Critique', keywords: ['critic', 'critique', 'evaluat'] },
    { id: 'refine', label: 'Refinement', keywords: ['refin', 'improv'] },
    { id: 'visual', label: 'Visual Polish', keywords: ['visual', 'polish', 'appeal'] },
] as const;

interface PipelineProgressProps {
    generationLogs: string[];
    pipelineTrace: string[];
    isGenerating: boolean;
}

export function PipelineProgress({ generationLogs, pipelineTrace, isGenerating }: PipelineProgressProps) {
    if (generationLogs.length === 0 && pipelineTrace.length === 0) {
        return null;
    }

    return (
        <>
            {generationLogs.length > 0 && (
                <PipelineSteps generationLogs={generationLogs} isGenerating={isGenerating} />
            )}
            {pipelineTrace.length > 0 && (
                <PipelineTraceView pipelineTrace={pipelineTrace} />
            )}
        </>
    );
}

function PipelineSteps({ generationLogs, isGenerating }: { generationLogs: string[]; isGenerating: boolean }) {
    const logsLower = generationLogs.map(l => l.toLowerCase());
    const completedSteps = PIPELINE_STEPS.map(step =>
        logsLower.some(log => step.keywords.some(kw => log.includes(kw)))
    );
    const activeStepIdx = isGenerating ? completedSteps.lastIndexOf(true) : -1;

    return (
        <div
            className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-background p-3"
            aria-live="polite"
            aria-label="Pipeline progress"
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-neutral-800">Pipeline Progress</span>
                <span className={`text-xs ${isGenerating ? 'text-amber-600' : 'text-green-600'}`}>
                    {isGenerating ? 'In progress' : 'Complete'}
                </span>
            </div>
            <div className="flex items-center gap-1" role="list" aria-label="Pipeline steps">
                {PIPELINE_STEPS.map((step, idx) => {
                    const done = completedSteps[idx];
                    const active = idx === activeStepIdx && isGenerating;
                    return (
                        <div key={step.id} className="flex items-center flex-1 min-w-0" role="listitem">
                            <div className="flex flex-col items-center flex-1 min-w-0">
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${done
                                        ? active
                                            ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                                            : 'bg-green-100 text-green-700'
                                        : 'bg-neutral-100 text-neutral-400'
                                    }`}
                                >
                                    {done && !active ? '\u2713' : idx + 1}
                                </div>
                                <span className={`text-[10px] mt-1 truncate max-w-full text-center ${done ? 'text-neutral-700 font-medium' : 'text-neutral-400'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                            {idx < PIPELINE_STEPS.length - 1 && (
                                <div className={`h-px flex-1 min-w-2 mt-[-12px] ${completedSteps[idx + 1] ? 'bg-green-300' : 'bg-neutral-200'
                                }`} />
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Collapsible log details */}
            <details className="mt-3">
                <summary className="text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-600">
                    Show log details ({generationLogs.length})
                </summary>
                <div className="mt-1 space-y-0.5 text-[10px] text-neutral-500 max-h-24 overflow-y-auto">
                    {generationLogs.map((log, idx) => (
                        <div key={`${log}-${idx}`} className="flex items-start gap-1.5">
                            <span className="mt-1 h-1 w-1 rounded-full bg-neutral-300 shrink-0" />
                            <span>{log}</span>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}

function PipelineTraceView({ pipelineTrace }: { pipelineTrace: string[] }) {
    return (
        <div className="mx-4 mt-4 rounded-xl border border-neutral-200 bg-background p-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800">Pipeline Trace</span>
                <span className="text-xs text-neutral-400">{pipelineTrace.length} steps</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-neutral-600">
                {pipelineTrace.map((step, idx) => (
                    <div key={`${step}-${idx}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-300" />
                        <span>{step}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
