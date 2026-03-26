# Multi-Agent System

## Overview

Sketch.ai uses a core 3D pipeline (vision, assembly spec/structure planning, critique, refinement, visual polish) plus output agents for non-3D deliverables.

## Agents

### 1. Vision Analyzer Agent

**File:** `src/backend/agents/visionAnalyzer.ts`

**Purpose:** Extracts object structure directly from sketch image using a vision-capable model (default: gpt-4o).

**Input:**
- Sketch image (base64)

**Output:** `VisionAnalysis`
```typescript
{
  objectType: 'enclosure' | 'organic' | 'mechanical' | 'abstract';
  objectName: string;
  mainParts: Array<{
    name: string;
    shape: 'box' | 'cylinder' | 'sphere' | 'capsule' | 'rounded-box';
    relativeSize: 'large' | 'medium' | 'small' | 'tiny';
    color?: string;
  }>;
  suggestedColors: string[];
  overallDimensions: { width: number; height: number; depth: number };
  confidence: number;
}
```

---

### 2. Structure Planner Agent

**File:** `src/backend/agents/structurePlanner.ts`

**Purpose:** Creates detailed 3D structure with positions and dimensions.

**Input:**
- VisionAnalysis
- Project description

**Output:** `StructurePlan`
```typescript
{
  elements: Array<{
    id: string;
    name: string;
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule';
    position: [number, number, number];
    rotation: [number, number, number];
    dimensions: [number, number, number];
    color: string;
    material: 'plastic' | 'metal' | 'glass' | 'rubber';
  }>;
  reasoning: string;
}
```

---

### 3. Assembly Spec Planner (Enclosures)

**File:** `src/backend/agents/assemblyPlanner.ts`

**Purpose:** Builds a structured enclosure + PCB specification used for deterministic scene JSON and OpenSCAD output.

**Output:** `AssemblySpec`
```typescript
{
  version: 1;
  units: 'mm';
  kind: 'enclosure' | 'object';
  enclosure: { shape: 'rect' | 'round'; width: number; depth: number; height: number; ... };
  pcb: { shape: 'rect' | 'round'; width: number; depth: number; thickness: number; ... };
  ports: Array<{ type: string; side: string; size: [number, number, number]; offset: [number, number]; ... }>;
  components: Array<{ role: string; size: [number, number, number]; position: [number, number, number]; ... }>;
  view: { explodedGap: number };
}
```

---

### 4. Critic Agent

**File:** `src/backend/agents/critic.ts`

**Purpose:** Validates generated scene against original input.

**Checks:**
- Object type match (enclosure should have boxes, organic should have spheres)
- All parts present
- No extraneous parts
- Correct colors
- Reasonable proportions

**Output:** `CritiqueResult`
```typescript
{
  score: number;           // 0-10
  isAcceptable: boolean;   // score >= 7
  matchesInput: boolean;   // type is correct
  issues: Array<{
    severity: 'critical' | 'major' | 'minor';
    description: string;
    suggestedFix?: string;
  }>;
  missingParts: string[];
  extraneousParts: string[];
  colorIssues: string[];
  proportionIssues: string[];
  summary: string;
}
```

---

### 5. Refiner Agent

**File:** `src/backend/agents/refiner.ts`

**Purpose:** Fixes issues identified by the Critic.

**Actions:**
- Add missing parts
- Remove extraneous parts
- Correct colors
- Fix type mismatches (e.g., replace spheres with boxes for enclosures)

**Output:** `RefinementResult`
```typescript
{
  elements: StructurePlan['elements'];
  changes: string[];
  success: boolean;
}
```

---

### 6. Visual Critic Agent

**File:** `src/backend/agents/visualCritic.ts`

**Purpose:** Evaluates visual appeal after structural correctness and identifies improvements.

**Output:** `VisualCritiqueResult`

---

### 7. Visual Refiner Agent

**File:** `src/backend/agents/visualRefiner.ts`

**Purpose:** Applies visual improvements based on the visual critique.

**Output:** `VisualRefinementResult`

---

### 8. Orchestrator

**File:** `src/backend/agents/orchestrator.ts`

**Purpose:** Coordinates all agents and manages the pipeline.

**Configuration:**
```typescript
{
  maxIterations: number;      // Default: 2
  minAcceptableScore: number; // Default: 7
  skipVision: boolean;        // Skip vision if no image
  existingVisionAnalysis?: VisionAnalysis;
}
```

**Pipeline:**
1. Run Vision Analyzer (or infer from description)
2. If enclosure: build Assembly Spec → convert to scene JSON
3. Else: run Structure Planner
4. Loop: Critic → Refiner (up to maxIterations)
5. Run Visual Critic → Visual Refiner loop (optional)
6. Return final scene

**Context handling:**
- The description is a merged string that includes the analysis summary plus any user notes (e.g., color-only inputs).
- Fallbacks prefer the last valid scene when parsing fails.

---

## Adding a New Agent

1. Create file in `src/backend/agents/`
2. Define input/output types
3. Create prompt template
4. Implement main function with LLM call
5. Add fallback for LLM failures
6. Export from `src/backend/agents/index.ts`
7. Integrate into orchestrator

---

## Output Agents

These agents generate non-3D outputs and are routed through `src/backend/agents/registry.ts` using prompts from `src/backend/ai/prompts.ts`.

- BOMAgent
- AssemblyAgent
- FirmwareAgent
- SchematicAgent
- SceneJsonAgent
- OpenSCADAgent
- SafetyAgent
- SustainabilityAgent
- CostOptimizerAgent
- DFMAgent
- MarketingAgent
- PatentRiskAgent

## Tuning Tips

- **Vision confidence**: Low confidence triggers more refinement
- **Critique score threshold**: Lower = more permissive
- **Max iterations**: More iterations = better quality, slower
- **Short notes**: Keep user notes as add-ons ("User notes: brown") instead of replacing the object description
