// Agent Orchestrator - Coordinates all agents for 3D generation
import { analyzeSketchVision, type VisionAnalysis } from './visionAnalyzer';
import { planStructure, type StructurePlan } from './structurePlanner';
import { critiqueScene, type CritiqueResult } from './critic';
import { refineScene, type RefinementResult } from './refiner';

export interface OrchestratorResult {
    success: boolean;
    scene: StructurePlan['elements'];
    visionAnalysis: VisionAnalysis;
    critique?: CritiqueResult;
    refinement?: RefinementResult;
    iterations: number;
    logs: string[];
}

export interface OrchestratorOptions {
    maxIterations?: number;
    minAcceptableScore?: number;
    skipVision?: boolean;
    existingVisionAnalysis?: VisionAnalysis;
}

/**
 * Main orchestration function - runs the full multi-agent pipeline
 */
export async function orchestrate3DGeneration(
    sketchImageBase64: string | undefined,
    description: string,
    options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
    const {
        maxIterations = 2,
        minAcceptableScore = 7,
        skipVision = false,
        existingVisionAnalysis
    } = options;

    const logs: string[] = [];
    let visionAnalysis: VisionAnalysis;

    // Step 1: Vision Analysis
    if (existingVisionAnalysis) {
        visionAnalysis = existingVisionAnalysis;
        logs.push('Using existing vision analysis');
    } else if (skipVision || !sketchImageBase64) {
        // Fallback to text-based analysis
        visionAnalysis = inferFromDescription(description);
        logs.push(`Vision skipped, inferred from description: ${visionAnalysis.objectType}`);
    } else {
        logs.push('Running vision analysis on sketch...');
        visionAnalysis = await analyzeSketchVision(sketchImageBase64);
        logs.push(`Vision analysis complete: ${visionAnalysis.objectType} - ${visionAnalysis.objectName}`);
        logs.push(`Identified ${visionAnalysis.mainParts.length} parts with confidence ${visionAnalysis.confidence}`);
    }

    // Step 2: Structure Planning
    logs.push('Planning 3D structure...');
    let structurePlan = await planStructure(visionAnalysis, description);
    logs.push(`Structure planned: ${structurePlan.elements.length} elements`);

    let currentScene = structurePlan.elements;
    let critique: CritiqueResult | undefined;
    let refinement: RefinementResult | undefined;
    let iteration = 0;

    // Step 3 & 4: Critique and Refine Loop
    while (iteration < maxIterations) {
        iteration++;
        logs.push(`--- Iteration ${iteration} ---`);

        // Critique
        logs.push('Critiquing scene...');
        critique = await critiqueScene(visionAnalysis, currentScene);
        logs.push(`Critique: score=${critique.score}, acceptable=${critique.isAcceptable}, matchesInput=${critique.matchesInput}`);

        if (critique.issues.length > 0) {
            logs.push(`Issues: ${critique.issues.map(i => i.description).join('; ')}`);
        }

        // Check if acceptable
        if (critique.isAcceptable && critique.score >= minAcceptableScore && critique.matchesInput) {
            logs.push('Scene is acceptable, stopping iterations');
            break;
        }

        // Refine
        logs.push('Refining scene...');
        refinement = await refineScene(visionAnalysis, currentScene, critique);

        if (refinement.success) {
            currentScene = refinement.elements;
            logs.push(`Refinement applied: ${refinement.changes.join(', ')}`);
        } else {
            logs.push('Refinement failed, keeping current scene');
            break;
        }
    }

    // Final validation
    const finalCritique = await critiqueScene(visionAnalysis, currentScene);
    logs.push(`Final score: ${finalCritique.score}`);

    return {
        success: finalCritique.matchesInput && finalCritique.score >= 5,
        scene: currentScene,
        visionAnalysis,
        critique: finalCritique,
        refinement,
        iterations: iteration,
        logs
    };
}

/**
 * Infer vision analysis from text description when no image is available
 */
function inferFromDescription(description: string): VisionAnalysis {
    const lower = description.toLowerCase();

    // Determine object type from keywords
    let objectType: VisionAnalysis['objectType'] = 'enclosure';

    if (/teddy|bear|plush|stuffed|toy|doll|character|animal|bunny|cat|dog/i.test(lower)) {
        objectType = 'organic';
    } else if (/gear|bracket|mount|shaft|lever|mechanism/i.test(lower)) {
        objectType = 'mechanical';
    } else if (/art|sculpture|abstract|decoration/i.test(lower)) {
        objectType = 'abstract';
    } else if (/pcb|board|circuit|chip|microcontroller|arduino|esp32|sensor|led|enclosure|case|housing/i.test(lower)) {
        objectType = 'enclosure';
    }

    // Generate appropriate parts based on type
    const mainParts: VisionAnalysis['mainParts'] = [];
    const suggestedColors: string[] = [];

    if (objectType === 'enclosure') {
        mainParts.push(
            { name: 'body', shape: 'rounded-box', relativeSize: 'large' },
            { name: 'lid', shape: 'rounded-box', relativeSize: 'medium' }
        );
        suggestedColors.push('#808080', '#606060', '#404040');
    } else if (objectType === 'organic') {
        mainParts.push(
            { name: 'body', shape: 'capsule', relativeSize: 'large' },
            { name: 'head', shape: 'sphere', relativeSize: 'medium' }
        );
        suggestedColors.push('#8B4513', '#A0522D', '#F5DEB3');
    } else if (objectType === 'mechanical') {
        mainParts.push(
            { name: 'body', shape: 'cylinder', relativeSize: 'large' }
        );
        suggestedColors.push('#C0C0C0', '#808080', '#404040');
    } else {
        mainParts.push(
            { name: 'body', shape: 'box', relativeSize: 'large' }
        );
        suggestedColors.push('#808080');
    }

    return {
        objectType,
        objectName: description.slice(0, 50),
        mainParts,
        suggestedColors,
        overallDimensions: { width: 50, height: 30, depth: 40 },
        confidence: 0.4 // Low confidence since inferred from text
    };
}

// Re-export types
export type { VisionAnalysis, StructurePlan, CritiqueResult, RefinementResult };
