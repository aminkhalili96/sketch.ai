# Architecture

## Overview

Sketch.ai uses a **multi-agent AI pipeline** to transform hardware sketches into accurate 3D models. For electronics enclosures, it first builds a structured assembly specification (enclosure + PCB + components) and then converts that spec into scene JSON and OpenSCAD deterministically.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Upload  │  │ Analysis │  │  Output  │  │  3D Renderer     │ │
│  │  Panel   │  │  Display │  │  Tabs    │  │  (React Three)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ /analyze │  │/generate │  │  /chat   │  │ /export | /build-guide │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Pipeline                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────┐  ┌─────────┐│
│  │   Vision    │→ │ Structure Planner│→ │ Critic │→ │ Refiner ││
│  │  Analyzer   │  └──────────────────┘  └────────┘  └─────────┘│
│  └─────────────┘                                                │
│         │                                                       │
│         └── Enclosure path: Assembly Spec → Scene JSON/OpenSCAD  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌──────────────────────┐  ┌───────────────────────────────────┐│
│  │  OpenAI GPT-5.2 (text)│  │  Tavily (Pricing Search)         ││
│  │  OpenAI GPT-4o (vision)│ │                                   ││
│  └──────────────────────┘  └───────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Agent Pipeline

### Data Flow

```
[Sketch Image]
     │
     ▼
┌─────────────────────────────────────┐
│        1. Vision Analyzer           │
│  - Vision-capable model analyzes image (default: gpt-4o) │
│  - Extracts: object type, parts,    │
│    colors, dimensions               │
│  - Output: VisionAnalysis           │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│    2. Assembly Spec (Enclosures)    │
│  - Generates enclosure + PCB spec   │
│  - Defines ports + components       │
│  - Output: AssemblySpec             │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│       3. Structure Planner          │
│  - Used for non-enclosure objects   │
│  - Creates 3D element plan          │
│  - Output: StructurePlan            │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│          4. Critic                  │
│  - Validates scene vs input         │
│  - Checks: type match, parts,       │
│    colors, proportions              │
│  - Output: CritiqueResult           │
└─────────────────────────────────────┘
     │ (if issues found)
     ▼
┌─────────────────────────────────────┐
│          5. Refiner                 │
│  - Fixes identified issues          │
│  - Adds missing parts               │
│  - Corrects type mismatches         │
│  - Output: RefinementResult         │
└─────────────────────────────────────┘
     │
     ▼
[Final 3D Scene JSON]
```

### CAD + Photoreal Render

For high-quality renders, the system can generate CAD geometry (CadQuery) and pass the resulting parts to Blender (Cycles) for photoreal output. This pipeline runs on-demand via `/api/render-3d` and produces:
- `render.png` (photoreal image)
- `model.step` (CAD assembly)
- `model.stl` (mesh assembly)

### Context Merging

For 3D generation and fallback logic, the system merges the sketch analysis summary with any user notes:

```
Teddy bear sketch
User notes: brown
```

This merged description is used for inference, prompts, and fallbacks to prevent short notes (like color-only inputs) from overriding the object type.

### Object Type Classification

| Type | Shapes Used | Example |
|------|-------------|---------|
| `enclosure` | box, rounded-box, cylinder | PCB, device case |
| `organic` | sphere, capsule | Toy, plush, character |
| `mechanical` | cylinder, box | Gear, bracket |
| `abstract` | mixed | Art, decoration |

## State Management

```
┌─────────────────────────────────────┐
│          Zustand Store              │
│  ┌─────────────────────────────────┐│
│  │ currentProject                  ││
│  │  ├── id, name, description      ││
│  │  ├── sketchBase64               ││
│  │  ├── analysis                   ││
│  │  ├── outputs                    ││
│  │  └── messages                   ││
│  └─────────────────────────────────┘│
│  + sessionStorage persistence       │
└─────────────────────────────────────┘
```

## Key Design Decisions

1. **Multi-Agent Over Single Prompt** - Specialized agents produce better results than one complex prompt
2. **Vision-First** - Analyze image directly rather than relying on text descriptions
3. **Self-Correction** - Critic + Refiner loop catches and fixes errors
4. **Graceful Fallbacks** - Each agent has fallback behavior if LLM fails
