# Multi-Agent System

## Overview

Sketch.ai uses a 5-agent pipeline for 3D generation. Each agent has a specialized role and communicates through structured data.

## Agents

### 1. Vision Analyzer Agent

**File:** `src/lib/agents/visionAnalyzer.ts`

**Purpose:** Extracts object structure directly from sketch image using GPT-4 Vision.

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

**File:** `src/lib/agents/structurePlanner.ts`

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

### 3. Critic Agent

**File:** `src/lib/agents/critic.ts`

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

### 4. Refiner Agent

**File:** `src/lib/agents/refiner.ts`

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

### 5. Orchestrator

**File:** `src/lib/agents/orchestrator.ts`

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
2. Run Structure Planner
3. Loop: Critic → Refiner (up to maxIterations)
4. Return final scene

**Context handling:**
- The description is a merged string that includes the analysis summary plus any user notes (e.g., color-only inputs).
- Fallbacks prefer the last valid scene when parsing fails.

---

## Adding a New Agent

1. Create file in `src/lib/agents/`
2. Define input/output types
3. Create prompt template
4. Implement main function with LLM call
5. Add fallback for LLM failures
6. Export from `src/lib/agents/index.ts`
7. Integrate into orchestrator

## Tuning Tips

- **Vision confidence**: Low confidence triggers more refinement
- **Critique score threshold**: Lower = more permissive
- **Max iterations**: More iterations = better quality, slower
- **Short notes**: Keep user notes as add-ons ("User notes: brown") instead of replacing the object description
