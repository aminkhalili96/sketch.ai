import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Project, Message, AnalysisResult, ProjectOutputs, ProjectMetadata } from '@/types';

interface ProjectState {
    // Current project
    currentProject: Project | null;

    // Output undo history (in-memory)
    outputSnapshots: Array<{
        outputs: ProjectOutputs;
        metadata?: ProjectMetadata;
        timestamp: number;
        note?: string;
    }>;

    // UI States
    isAnalyzing: boolean;
    isGenerating: boolean;
    isChatting: boolean;
    isExporting: boolean;

    // Error state
    error: string | null;

    // Actions
    createProject: (name: string, description: string) => void;
    setSketch: (base64: string | null) => void;
    setAnalysis: (analysis: AnalysisResult | null) => void;
    setOutputs: (outputs: ProjectOutputs) => void;
    replaceOutputs: (outputs: ProjectOutputs) => void;
    setMetadata: (metadata: ProjectMetadata | null) => void;
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    updateDescription: (description: string) => void;
    pushOutputsSnapshot: (note?: string) => void;
    undoLastSnapshot: () => void;
    clearOutputSnapshots: () => void;

    // Loading states
    setAnalyzing: (loading: boolean) => void;
    setGenerating: (loading: boolean) => void;
    setChatting: (loading: boolean) => void;
    setExporting: (loading: boolean) => void;

    // Error handling
    setError: (error: string | null) => void;
    clearError: () => void;

    // Reset
    resetProject: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const createMemoryStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (name: string) => store.get(name) ?? null,
        setItem: (name: string, value: string) => {
            store.set(name, value);
        },
        removeItem: (name: string) => {
            store.delete(name);
        },
    };
};
const storage =
    typeof window !== 'undefined'
        ? createJSONStorage(() => window.localStorage)
        : createJSONStorage(createMemoryStorage);

const initialProject: Project = {
    id: generateId(),
    name: 'New Hardware Project',
    description: '',
    outputs: {},
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            currentProject: null,
            outputSnapshots: [],
            isAnalyzing: false,
            isGenerating: false,
            isChatting: false,
            isExporting: false,
            error: null,

            createProject: (name, description) => {
                set({
                    currentProject: {
                        ...initialProject,
                        id: generateId(),
                        name,
                        description,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    outputSnapshots: [],
                    isAnalyzing: false,
                    isGenerating: false,
                    isChatting: false,
                    isExporting: false,
                    error: null,
                });
            },

            setSketch: (base64) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            sketchBase64: base64 ?? undefined,
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            setAnalysis: (analysis) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            analysis: analysis ?? undefined,
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            setOutputs: (outputs) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            outputs: { ...project.outputs, ...outputs },
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            replaceOutputs: (outputs) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            outputs,
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            setMetadata: (metadata) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            metadata: metadata ?? undefined,
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            addMessage: (message) => {
                const project = get().currentProject;
                if (project) {
                    const newMessage: Message = {
                        id: generateId(),
                        ...message,
                        timestamp: new Date(),
                    };
                    set({
                        currentProject: {
                            ...project,
                            messages: [...project.messages, newMessage],
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            updateDescription: (description) => {
                const project = get().currentProject;
                if (project) {
                    set({
                        currentProject: {
                            ...project,
                            description,
                            updatedAt: new Date(),
                        },
                    });
                }
            },

            pushOutputsSnapshot: (note) => {
                const project = get().currentProject;
                if (!project) return;
                set((state) => ({
                    outputSnapshots: [
                        ...state.outputSnapshots.slice(-19),
                        {
                            outputs: project.outputs,
                            metadata: project.metadata,
                            timestamp: Date.now(),
                            note,
                        },
                    ],
                }));
            },

            undoLastSnapshot: () => {
                const project = get().currentProject;
                if (!project) return;
                const snapshots = get().outputSnapshots;
                if (snapshots.length === 0) return;
                const last = snapshots[snapshots.length - 1];
                set((state) => ({
                    outputSnapshots: state.outputSnapshots.slice(0, -1),
                    currentProject: {
                        ...project,
                        outputs: last.outputs,
                        metadata: last.metadata,
                        updatedAt: new Date(),
                    },
                }));
            },

            clearOutputSnapshots: () => set({ outputSnapshots: [] }),

            setAnalyzing: (loading) => set({ isAnalyzing: loading }),
            setGenerating: (loading) => set({ isGenerating: loading }),
            setChatting: (loading) => set({ isChatting: loading }),
            setExporting: (loading) => set({ isExporting: loading }),

            setError: (error) => set({ error }),
            clearError: () => set({ error: null }),

            resetProject: () => {
                set({
                    currentProject: {
                        ...initialProject,
                        id: generateId(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    outputSnapshots: [],
                    isAnalyzing: false,
                    isGenerating: false,
                    isChatting: false,
                    isExporting: false,
                    error: null,
                });
            },
        }),
        {
            name: 'sketch-ai-project',
            storage,
            partialize: (state) => ({
                currentProject: state.currentProject,
            }),
        }
    )
);
