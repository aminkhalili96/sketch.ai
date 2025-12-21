'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/projectStore';
import type { AgentPlan, RequestedOutput, AnalysisResult, ProjectOutputs } from '@/types';

export function ChatInterface() {
    const [input, setInput] = useState('');
    const [requestedOutputs, setRequestedOutputs] = useState<RequestedOutput[]>([]);
    const [pendingPlan, setPendingPlan] = useState<AgentPlan | null>(null);
    const [streamingReply, setStreamingReply] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        currentProject,
        addMessage,
        isChatting,
        setChatting,
        setError,
        pushOutputsSnapshot,
        undoLastSnapshot,
        outputSnapshots,
        replaceOutputs,
    } = useProjectStore();
    const canUndo = outputSnapshots.length > 0;

    const messages = currentProject?.messages ?? [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, streamingReply]);

    const toggleRequestedOutput = (output: RequestedOutput) => {
        setRequestedOutputs((prev) => (
            prev.includes(output)
                ? prev.filter((o) => o !== output)
                : [...prev, output]
        ));
    };

    const streamChatResponse = async (payload: {
        message: string;
        history: typeof messages;
        projectContext?: {
            description: string;
            analysis?: AnalysisResult;
            outputs?: ProjectOutputs;
        };
    }) => {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok || !response.body) {
            return false;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullReply = '';

        setStreamingReply('');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                try {
                    const event = JSON.parse(trimmed) as { type: string; text?: string; error?: string };

                    if (event.type === 'delta' && event.text) {
                        fullReply += event.text;
                        setStreamingReply(fullReply);
                    } else if (event.type === 'error') {
                        throw new Error(event.error || 'Streaming failed');
                    } else if (event.type === 'done') {
                        break;
                    }
                } catch (parseError) {
                    // Skip invalid JSON lines (might be partial data)
                    console.warn('Failed to parse stream line:', trimmed, parseError);
                    continue;
                }
            }
        }

        if (fullReply.trim()) {
            addMessage({ role: 'assistant', content: fullReply });
        }

        setStreamingReply('');
        return true;
    };

    const handleSend = async () => {
        if (!input.trim() || isChatting) return;

        const userMessage = input.trim();
        setInput('');

        // New instruction supersedes any pending plan.
        if (pendingPlan) {
            setPendingPlan(null);
        }

        addMessage({ role: 'user', content: userMessage });

        setChatting(true);
        setError(null);

        try {
            const agentMode = requestedOutputs.length > 0;
            if (agentMode) {
                const response = await fetch('/api/agents/plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage,
                        requestedOutputs: orderedRequestedOutputs,
                        projectContext: {
                            description: currentProject?.description || '',
                            analysis: currentProject?.analysis,
                            outputs: currentProject?.outputs,
                            metadata: currentProject?.metadata,
                        },
                    }),
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Request failed');
                }

                setPendingPlan(data.plan);
                addMessage({
                    role: 'assistant',
                    content: `I drafted a plan to update: ${requestedOutputs.join(', ')}.\nReview and confirm below to apply changes.`,
                });
            } else {
                const payload = {
                    message: userMessage,
                    history: messages,
                    projectContext: {
                        description: currentProject?.description || '',
                        analysis: currentProject?.analysis,
                        outputs: currentProject?.outputs,
                    },
                };

                const streamed = await streamChatResponse(payload);
                if (!streamed) {
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    const data = await response.json();

                    if (!data.success) {
                        throw new Error(data.error || 'Request failed');
                    }

                    addMessage({ role: 'assistant', content: data.reply });
                }
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Request failed');
            addMessage({
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
            });
            setStreamingReply('');
        } finally {
            setChatting(false);
        }
    };

    const handleConfirmPlan = async () => {
        if (!pendingPlan || isChatting) return;

        setChatting(true);
        setError(null);

        try {
            const response = await fetch('/api/agents/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: pendingPlan,
                    projectContext: {
                        description: currentProject?.description || '',
                        analysis: currentProject?.analysis,
                        outputs: currentProject?.outputs,
                        metadata: currentProject?.metadata,
                    },
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Execution failed');
            }

            if (data.updatedOutputs) {
                pushOutputsSnapshot('Agent changes');
                replaceOutputs({ ...currentProject?.outputs, ...data.updatedOutputs });
            }

            const updatedKeys = Object.keys(data.updatedOutputs || {});
            const lines = updatedKeys.length
                ? updatedKeys.map((k: string) => `- ${k}: ${data.summaries?.[k] || 'Updated'}`).join('\n')
                : '- No changes applied';

            addMessage({
                role: 'assistant',
                content: `Applied changes:\n${lines}`,
            });

            setPendingPlan(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Execution failed';
            setError(message);
            addMessage({
                role: 'assistant',
                content: `Sorry, I could not apply that plan.\n\nError: ${message}`,
            });
        } finally {
            setChatting(false);
        }
    };

    const handleCancelPlan = () => {
        setPendingPlan(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const suggestedPrompts = [
        "What components do I need?",
        "Estimated cost?",
        "Suggest improvements",
    ];

    const outputOptions: Array<{ id: RequestedOutput; label: string }> = [
        { id: '3d-model', label: '3D Model' },
        { id: 'bom', label: 'BOM' },
        { id: 'assembly', label: 'Assembly' },
        { id: 'firmware', label: 'Firmware' },
        { id: 'schematic', label: 'Schematic' },
    ];
    const orderedRequestedOutputs = requestedOutputs
        .slice()
        .sort(
            (a, b) =>
                outputOptions.findIndex((o) => o.id === a) -
                outputOptions.findIndex((o) => o.id === b)
        );

    return (
        <Card className="flex flex-col h-full bg-white border border-neutral-200 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-neutral-100">
                <h2 className="text-lg font-medium text-neutral-900">
                    Design Assistant
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <p className="text-sm text-neutral-400 mb-4">
                            Ask about your design
                        </p>

                        <div className="flex flex-wrap gap-2 justify-center">
                            {suggestedPrompts.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(prompt)}
                                    className="px-3 py-1.5 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((message, index) => (
                            <motion.div
                                key={message.id || index}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${message.role === 'user'
                                            ? 'bg-neutral-900 text-white'
                                            : 'bg-neutral-100 text-neutral-800'
                                        }`}
                                >
                                    {message.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-neutral">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm">{message.content}</p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {streamingReply && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-neutral-100 text-neutral-800">
                            <div className="prose prose-sm max-w-none prose-neutral">
                                <ReactMarkdown>{streamingReply}</ReactMarkdown>
                                <span className="inline-block ml-1 animate-pulse text-neutral-400">▍</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {isChatting && !streamingReply && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 text-neutral-400 text-sm"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {pendingPlan && (
                <div className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium text-neutral-900">Proposed changes</div>
                            {pendingPlan.summary && (
                                <div className="text-xs text-neutral-600 mt-0.5">{pendingPlan.summary}</div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelPlan}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                    </div>

                    <div className="mt-2 text-xs text-neutral-700 space-y-1">
                        {pendingPlan.tasks.map((t) => (
                            <div key={t.id} className="flex justify-between gap-3">
                                <span className="font-mono">{t.outputType}</span>
                                <span className="text-neutral-500">{t.agent}</span>
                            </div>
                        ))}
                    </div>

                    {!!pendingPlan.questions?.length && (
                        <div className="mt-2 text-xs text-amber-700">
                            <div className="font-medium">Questions</div>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                {pendingPlan.questions.map((q, i) => (
                                    <li key={i}>{q}</li>
                                ))}
                            </ul>
                            <div className="mt-1 text-amber-700/80">
                                Answer these in chat to generate a new plan.
                            </div>
                        </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                        <Button
                            onClick={handleConfirmPlan}
                            disabled={isChatting || !!pendingPlan.questions?.length}
                            className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl"
                        >
                            Confirm & Apply
                        </Button>
                        {canUndo && (
                            <Button
                                variant="outline"
                                onClick={undoLastSnapshot}
                                disabled={isChatting}
                                className="rounded-xl border-neutral-200"
                            >
                                Undo
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-neutral-100">
                <div className="flex flex-wrap gap-2 mb-3">
                    {outputOptions.map((opt) => {
                        const selected = requestedOutputs.includes(opt.id);
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => toggleRequestedOutput(opt.id)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selected
                                        ? 'bg-neutral-900 text-white border-neutral-900'
                                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                    }`}
                                aria-pressed={selected}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-neutral-400">
                        Select outputs to modify (confirmation required).
                    </p>
                    {canUndo && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={undoLastSnapshot}
                            disabled={isChatting}
                            className="rounded-lg border-neutral-200"
                        >
                            Undo last change
                        </Button>
                    )}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        disabled={isChatting}
                        className="flex-1 bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isChatting}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-4"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Button>
                </div>
            </div>
        </Card>
    );
}
