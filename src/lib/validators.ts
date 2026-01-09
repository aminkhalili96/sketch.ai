import { z } from 'zod';

// Analyze endpoint validation
export const analyzeRequestSchema = z.object({
    image: z.string().min(1, 'Image is required'),
    description: z.string().optional(),
    model: z.string().optional(),
});

export const analysisResultSchema = z.object({
    identifiedComponents: z.preprocess((value) => {
        if (Array.isArray(value)) {
            return value
                .filter((v) => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/[,;\n]+/g)
                .map((v) => v.trim())
                .filter(Boolean);
        }
        return [];
    }, z.array(z.string())),
    suggestedFeatures: z.preprocess((value) => {
        if (Array.isArray(value)) {
            return value
                .filter((v) => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/[,;\n]+/g)
                .map((v) => v.trim())
                .filter(Boolean);
        }
        return [];
    }, z.array(z.string())),
    complexityScore: z.preprocess((value) => {
        const num =
            typeof value === 'number'
                ? value
                : typeof value === 'string'
                    ? Number(value)
                    : Number.NaN;
        if (!Number.isFinite(num)) return 5;
        return Math.min(10, Math.max(1, Math.round(num)));
    }, z.number().int().min(1).max(10)),
    complexity: z.preprocess((value) => {
        const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
        if (normalized === 'simple' || normalized === 'moderate' || normalized === 'complex') {
            return normalized;
        }
        return 'moderate';
    }, z.enum(['simple', 'moderate', 'complex'])),
    questions: z.preprocess((value) => {
        if (Array.isArray(value)) {
            return value
                .filter((v) => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/[,;\n]+/g)
                .map((v) => v.trim())
                .filter(Boolean);
        }
        return [];
    }, z.array(z.string())),
    summary: z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string()),
});

// Scene Schema for 3D generation
const safeNumberSchema = z.preprocess((value) => {
    const num =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? Number(value)
                : Number.NaN;
    return Number.isFinite(num) ? num : 0;
}, z.number());

const vec3Schema = z.preprocess((value) => {
    if (Array.isArray(value)) {
        const arr = value.slice(0, 3);
        while (arr.length < 3) arr.push(0);
        return arr;
    }
    return [0, 0, 0];
}, z.tuple([safeNumberSchema, safeNumberSchema, safeNumberSchema]));

const typeNormalization = z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    const lower = val.toLowerCase().replace(/_/g, '-');
    if (lower === 'cube' || lower === 'rect') return 'box';
    if (lower === 'tube' || lower === 'pipe') return 'cylinder';
    if (lower === 'ball') return 'sphere';
    return lower;
}, z.enum(['box', 'rounded-box', 'cylinder', 'sphere', 'capsule']));

export const sceneElementSchema = z.object({
    type: typeNormalization,
    position: vec3Schema,
    rotation: vec3Schema.optional(),
    dimensions: vec3Schema,
    color: z.string().optional().default('#808080'),
    material: z.enum(['plastic', 'metal', 'glass', 'rubber']).optional(),
    name: z.string().optional(),
    // Rounded box hints - use safeNumberSchema to coerce strings
    radius: safeNumberSchema.optional(),
    smoothness: safeNumberSchema.optional(),
});

export const sceneSchema = z.array(sceneElementSchema);

// Generate endpoint validation
export const generateRequestSchema = z.object({
    projectDescription: z.string().min(1, 'Project description is required'),
    analysisContext: analysisResultSchema.optional(),
    outputTypes: z.array(
        z.enum(['bom', 'assembly', 'firmware', 'schematic', 'openscad', 'scene-json'])
    ).min(1, 'At least one output type is required'),
    sketchImage: z.string().optional(), // Base64 image for vision-to-3D pipeline
    model: z.string().optional(),
});

// Chat endpoint validation
export const messageSchema = z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.coerce.date(),
});

export const chatRequestSchema = z.object({
    message: z.string().min(1, 'Message is required'),
    history: z.array(messageSchema),
    projectContext: z.object({
        description: z.string(),
        analysis: analysisResultSchema.optional(),
        outputs: z.object({
            bom: z.string().optional(),
            assembly: z.string().optional(),
            firmware: z.string().optional(),
            schematic: z.string().optional(),
            openscad: z.string().optional(),
            'scene-json': z.string().optional(),
        }).optional(),
    }).optional(),
    model: z.string().optional(),
});

// Export endpoint validation
export const exportRequestSchema = z.object({
    projectName: z.string().min(1, 'Project name is required'),
    outputs: z.object({
        bom: z.string().optional(),
        assembly: z.string().optional(),
        firmware: z.string().optional(),
        schematic: z.string().optional(),
        openscad: z.string().optional(),
        'scene-json': z.string().optional(),
    }),
    metadata: z.object({
        estimatedCost: z.number(),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        buildTime: z.string(),
    }).optional(),
});

export const buildGuideRequestSchema = exportRequestSchema.pick({
    projectName: true,
    outputs: true,
    metadata: true,
});

export const schematicDiagramRequestSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    analysis: analysisResultSchema.optional(),
    model: z.string().optional(),
});

// Agents (multi-step, confirm-before-apply)
export const requestedOutputSchema = z.enum([
    'bom',
    'assembly',
    'firmware',
    'schematic',
    '3d-model',
]);

export const agentOutputTypeSchema = z.enum([
    'bom',
    'assembly',
    'firmware',
    'schematic',
    'openscad',
    'scene-json',
]);

export const agentNameSchema = z.enum([
    'ProjectManagerAgent',
    'BOMAgent',
    'AssemblyAgent',
    'FirmwareAgent',
    'SchematicAgent',
    'SceneJsonAgent',
    'OpenSCADAgent',
]);

export const agentTaskSchema = z.object({
    id: z.string().min(1),
    agent: agentNameSchema,
    outputType: agentOutputTypeSchema,
    action: z.enum(['update', 'regenerate']),
    instruction: z.string().min(1),
    dependsOn: z.array(z.string()).optional(),
});

export const agentPlanSchema = z.object({
    version: z.number().int().min(1),
    requestedOutputs: z.array(requestedOutputSchema).min(1),
    summary: z.string().optional(),
    questions: z.array(z.string()).optional(),
    tasks: z.array(agentTaskSchema).min(1),
});

export const agentsProjectContextSchema = z.object({
    description: z.string(),
    analysis: analysisResultSchema.optional(),
    outputs: z.object({
        bom: z.string().optional(),
        assembly: z.string().optional(),
        firmware: z.string().optional(),
        schematic: z.string().optional(),
        openscad: z.string().optional(),
        'scene-json': z.string().optional(),
    }).optional(),
    metadata: z.object({
        estimatedCost: z.number(),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        buildTime: z.string(),
    }).optional(),
});

export const agentsPlanRequestSchema = z.object({
    message: z.string().min(1, 'Message is required'),
    requestedOutputs: z.array(requestedOutputSchema).min(1, 'Select at least one output to modify'),
    projectContext: agentsProjectContextSchema.optional(),
    model: z.string().optional(),
});

export const agentsExecuteRequestSchema = z.object({
    plan: agentPlanSchema,
    projectContext: agentsProjectContextSchema.optional(),
    model: z.string().optional(),
});

// Type exports from schemas
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type BuildGuideRequest = z.infer<typeof buildGuideRequestSchema>;
export type SchematicDiagramRequest = z.infer<typeof schematicDiagramRequestSchema>;
export type AgentsPlanRequest = z.infer<typeof agentsPlanRequestSchema>;
export type AgentsExecuteRequest = z.infer<typeof agentsExecuteRequestSchema>;
export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type AgentTask = z.infer<typeof agentTaskSchema>;
