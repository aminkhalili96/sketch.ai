/**
 * @vitest-environment node
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the openai module
const mockCreate = vi.fn();
vi.mock('@/backend/ai/openai', () => ({
    getLLMClient: vi.fn(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    })),
    getModelName: vi.fn(() => 'test-model'),
    isOfflineMode: vi.fn(() => false),
    recordChatUsage: vi.fn(),
    recordChatError: vi.fn(),
    recordTokenUsage: vi.fn(),
}));

// Mock prompt templates
vi.mock('@/backend/ai/prompts', () => ({
    SYSTEM_PROMPT: 'test-system-prompt',
    BOM_GENERATION_PROMPT: 'Generate BOM for {{description}}',
    ASSEMBLY_INSTRUCTIONS_PROMPT: 'Generate assembly for {{description}}',
    FIRMWARE_GENERATION_PROMPT: 'Generate firmware for {{description}}',
    OPENSCAD_GENERATION_PROMPT: 'Generate OpenSCAD for {{description}}',
    OPENSCAD_OBJECT_PROMPT: 'Generate OpenSCAD object for {{description}}',
    SCENE_GENERATION_PROMPT: 'Generate scene for {{description}}',
    SCENE_OBJECT_PROMPT: 'Generate scene object for {{description}}',
    SAFETY_REVIEW_PROMPT: 'Safety review for {{description}}',
    SUSTAINABILITY_ANALYSIS_PROMPT: 'Sustainability for {{description}}',
    COST_OPTIMIZATION_PROMPT: 'Cost optimization for {{description}}',
    DFM_ANALYSIS_PROMPT: 'DFM for {{description}}',
    MARKETING_GENERATION_PROMPT: 'Marketing for {{description}}',
    PATENT_RISK_PROMPT: 'Patent risk for {{description}}',
    CHAT_REFINEMENT_PROMPT: 'Chat refinement',
    fillPromptTemplate: vi.fn((template: string) => template),
    stripCodeFences: vi.fn((text: string) => text),
}));

import {
    expandRequestedOutputs,
    normalizePlanForRequest,
    executeAgentTask,
} from '@/backend/agents/registry';
import type { AgentTask, AgentPlan, RequestedOutput } from '@/types';

describe('expandRequestedOutputs', () => {
    it('expands 3d-model to scene-json and openscad', () => {
        const result = expandRequestedOutputs(['3d-model']);
        expect(result).toContain('scene-json');
        expect(result).toContain('openscad');
        expect(result).not.toContain('3d-model');
    });

    it('passes through non-3d-model outputs unchanged', () => {
        const result = expandRequestedOutputs(['bom', 'assembly', 'firmware']);
        expect(result).toEqual(['bom', 'assembly', 'firmware']);
    });

    it('deduplicates when 3d-model is combined with scene-json', () => {
        const result = expandRequestedOutputs(['3d-model', 'scene-json']);
        const sceneJsonCount = result.filter((o) => o === 'scene-json').length;
        expect(sceneJsonCount).toBe(1);
    });

    it('handles empty array', () => {
        const result = expandRequestedOutputs([]);
        expect(result).toEqual([]);
    });

    it('handles all output types together', () => {
        const all: RequestedOutput[] = [
            'bom', 'assembly', 'firmware', 'schematic', '3d-model',
            'safety', 'sustainability', 'cost-optimization', 'dfm',
            'marketing', 'patent-risk',
        ];
        const result = expandRequestedOutputs(all);
        expect(result).toContain('scene-json');
        expect(result).toContain('openscad');
        expect(result).toContain('bom');
        expect(result).not.toContain('3d-model');
    });
});

describe('normalizePlanForRequest', () => {
    const basePlan: AgentPlan = {
        version: 1,
        requestedOutputs: ['bom', 'assembly'],
        summary: 'Test plan',
        tasks: [
            {
                id: 'orig-1',
                agent: 'BOMAgent',
                outputType: 'bom',
                action: 'update',
                instruction: 'Generate BOM',
            },
            {
                id: 'orig-2',
                agent: 'AssemblyAgent',
                outputType: 'assembly',
                action: 'update',
                instruction: 'Generate assembly',
            },
        ],
    };

    it('preserves task ordering based on requestedOutputs', () => {
        const result = normalizePlanForRequest(basePlan, ['bom', 'assembly'], 'test message');
        expect(result.tasks.length).toBe(2);
        expect(result.tasks[0].outputType).toBe('bom');
        expect(result.tasks[1].outputType).toBe('assembly');
    });

    it('generates sequential IDs for tasks', () => {
        const result = normalizePlanForRequest(basePlan, ['bom', 'assembly'], 'test message');
        expect(result.tasks[0].id).toBe('t1');
        expect(result.tasks[1].id).toBe('t2');
    });

    it('creates scene-json and openscad tasks for 3d-model', () => {
        const plan: AgentPlan = {
            version: 1,
            requestedOutputs: ['3d-model'],
            tasks: [
                {
                    id: 'x',
                    agent: 'SceneJsonAgent',
                    outputType: 'scene-json',
                    action: 'update',
                    instruction: 'Make scene',
                },
            ],
        };

        const result = normalizePlanForRequest(plan, ['3d-model'], 'build it');
        expect(result.tasks.length).toBe(2);
        expect(result.tasks[0].outputType).toBe('scene-json');
        expect(result.tasks[0].agent).toBe('SceneJsonAgent');
        expect(result.tasks[1].outputType).toBe('openscad');
        expect(result.tasks[1].agent).toBe('OpenSCADAgent');
        // OpenSCAD depends on scene-json
        expect(result.tasks[1].dependsOn).toContain(result.tasks[0].id);
    });

    it('sets assembly dependsOn bom when both requested', () => {
        const result = normalizePlanForRequest(basePlan, ['bom', 'assembly'], 'test');
        const bomTask = result.tasks.find((t) => t.outputType === 'bom');
        const assemblyTask = result.tasks.find((t) => t.outputType === 'assembly');
        expect(assemblyTask?.dependsOn).toContain(bomTask?.id);
    });

    it('preserves plan metadata (version, summary, questions)', () => {
        const result = normalizePlanForRequest(basePlan, ['bom'], 'test');
        expect(result.version).toBe(1);
        expect(result.summary).toBe('Test plan');
    });

    it('filters tasks to only requested outputs', () => {
        const result = normalizePlanForRequest(basePlan, ['bom'], 'test');
        expect(result.tasks.length).toBe(1);
        expect(result.tasks[0].outputType).toBe('bom');
    });
});

describe('executeAgentTask', () => {
    beforeEach(() => {
        mockCreate.mockReset();
    });

    const baseCtx = {
        description: 'A smart IoT sensor box',
        analysis: {
            identifiedComponents: ['ESP32', 'DHT22 sensor'],
            suggestedFeatures: ['WiFi', 'Temperature monitoring'],
            summary: 'IoT sensor device',
        },
        outputs: {},
    };

    it('generates BOM and returns formatted markdown', async () => {
        const bomMarkdown = '| Component | Qty | Price |\n|---|---|---|\n| ESP32 | 1 | $5.00 |';
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: bomMarkdown } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

        const task: AgentTask = {
            id: 't1',
            agent: 'BOMAgent',
            outputType: 'bom',
            action: 'regenerate',
            instruction: 'Generate a BOM',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('bom');
        expect(result.content).toContain('ESP32');
        expect(result.summary).toContain('BOM');
        expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('generates scene-json and returns valid JSON', async () => {
        const sceneJson = JSON.stringify([
            {
                type: 'rounded-box',
                position: [0, 0, 0],
                dimensions: [80, 22, 35],
                color: '#F5F5F5',
                material: 'plastic',
                name: 'enclosure-body',
            },
        ]);
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: sceneJson } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

        const task: AgentTask = {
            id: 't1',
            agent: 'SceneJsonAgent',
            outputType: 'scene-json',
            action: 'regenerate',
            instruction: 'Generate 3D scene',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('scene-json');
        // Result should be valid JSON
        const parsed = JSON.parse(result.content);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        expect(result.summary).toContain('scene');
    });

    it('generates openscad and returns code string', async () => {
        const openscadCode = '// OpenSCAD model\ncube([80, 22, 35]);';
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: openscadCode } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

        const task: AgentTask = {
            id: 't1',
            agent: 'OpenSCADAgent',
            outputType: 'openscad',
            action: 'regenerate',
            instruction: 'Generate OpenSCAD model',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('openscad');
        expect(result.content).toContain('cube');
        expect(result.summary).toContain('OpenSCAD');
    });

    it('returns fallback summary for unknown output types', async () => {
        const task: AgentTask = {
            id: 't1',
            agent: 'BOMAgent',
            // Force an unhandled output type by casting
            outputType: 'nonexistent-type' as AgentTask['outputType'],
            action: 'regenerate',
            instruction: 'Do something',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.summary).toContain('No agent implemented');
        expect(result.content).toBe('');
    });

    it('falls back to fallbackScene when scene-json LLM returns empty', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: null } }],
            usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        });

        const task: AgentTask = {
            id: 't1',
            agent: 'SceneJsonAgent',
            outputType: 'scene-json',
            action: 'regenerate',
            instruction: 'Generate 3D scene',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('scene-json');
        expect(result.summary).toContain('fallback');
        // Should still produce valid JSON
        const parsed = JSON.parse(result.content);
        expect(Array.isArray(parsed)).toBe(true);
    });

    it('falls back to fallbackOpenSCAD when openscad LLM throws', async () => {
        mockCreate.mockRejectedValue(new Error('API timeout'));

        const task: AgentTask = {
            id: 't1',
            agent: 'OpenSCADAgent',
            outputType: 'openscad',
            action: 'regenerate',
            instruction: 'Generate OpenSCAD model',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('openscad');
        expect(result.summary).toContain('fallback');
        // Should still contain some OpenSCAD code
        expect(result.content.length).toBeGreaterThan(0);
    });

    it('generates assembly instructions', async () => {
        const assemblyText = '## Step 1\nSolder the ESP32...';
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: assemblyText } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

        const task: AgentTask = {
            id: 't1',
            agent: 'AssemblyAgent',
            outputType: 'assembly',
            action: 'regenerate',
            instruction: 'Generate assembly instructions',
        };

        const shared = {};
        const result = await executeAgentTask(task, baseCtx, null, shared);

        expect(result.outputType).toBe('assembly');
        expect(result.content).toContain('ESP32');
        expect(result.summary).toContain('assembly');
    });
});
