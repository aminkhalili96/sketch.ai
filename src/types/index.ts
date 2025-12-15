// Types for Sketch.AI application

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface AnalysisResult {
    identifiedComponents: string[];
    suggestedFeatures: string[];
    complexityScore: number;
    complexity: 'simple' | 'moderate' | 'complex';
    questions: string[];
    summary: string;
}

export interface ProjectOutputs {
    bom?: string;
    assembly?: string;
    firmware?: string;
    schematic?: string;
    openscad?: string;
    'scene-json'?: string;
}

export interface ProjectMetadata {
    estimatedCost: number;
    complexity: 'simple' | 'moderate' | 'complex';
    buildTime: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    sketchUrl?: string;
    sketchBase64?: string;
    analysis?: AnalysisResult;
    outputs: ProjectOutputs;
    metadata?: ProjectMetadata;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

// API Types
export interface AnalyzeRequest {
    image: string; // Base64 encoded image
    description?: string;
}

export interface AnalyzeResponse {
    success: boolean;
    analysis?: AnalysisResult;
    error?: string;
}

export interface GenerateRequest {
    projectDescription: string;
    analysisContext?: AnalysisResult;
    outputTypes: ('bom' | 'assembly' | 'firmware' | 'schematic' | 'openscad' | 'scene-json')[];
}

export interface GenerateResponse {
    success: boolean;
    outputs?: ProjectOutputs;
    metadata?: ProjectMetadata;
    error?: string;
}

export interface ChatRequest {
    message: string;
    history: Message[];
    projectContext?: {
        description: string;
        analysis?: AnalysisResult;
        outputs?: ProjectOutputs;
    };
}

export interface ChatResponse {
    success: boolean;
    reply?: string;
    updatedOutputs?: Partial<ProjectOutputs>;
    suggestedActions?: string[];
    error?: string;
}

// Agents API Types (confirm-before-apply)
export type RequestedOutput = 'bom' | 'assembly' | 'firmware' | 'schematic' | '3d-model';
export type AgentOutputType = keyof ProjectOutputs;
export type AgentName =
    | 'ProjectManagerAgent'
    | 'BOMAgent'
    | 'AssemblyAgent'
    | 'FirmwareAgent'
    | 'SchematicAgent'
    | 'SceneJsonAgent'
    | 'OpenSCADAgent';

export interface AgentTask {
    id: string;
    agent: AgentName;
    outputType: AgentOutputType;
    action: 'update' | 'regenerate';
    instruction: string;
    dependsOn?: string[];
}

export interface AgentPlan {
    version: number;
    requestedOutputs: RequestedOutput[];
    summary?: string;
    questions?: string[];
    tasks: AgentTask[];
}

export interface AgentsPlanRequest {
    message: string;
    requestedOutputs: RequestedOutput[];
    projectContext?: {
        description: string;
        analysis?: AnalysisResult;
        outputs?: ProjectOutputs;
        metadata?: ProjectMetadata;
    };
}

export interface AgentsPlanResponse {
    success: boolean;
    plan?: AgentPlan;
    error?: string;
}

export interface AgentsExecuteRequest {
    plan: AgentPlan;
    projectContext?: AgentsPlanRequest['projectContext'];
}

export interface AgentsExecuteResponse {
    success: boolean;
    updatedOutputs?: Partial<ProjectOutputs>;
    summaries?: Record<string, string>;
    error?: string;
}

export interface ExportRequest {
    projectName: string;
    outputs: ProjectOutputs;
    metadata?: ProjectMetadata;
}

export interface ExportResponse {
    success: boolean;
    blob?: Blob;
    error?: string;
}
