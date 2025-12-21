# Architecture

## Overview

Sketch.ai uses a **multi-agent AI pipeline** to transform hardware sketches into accurate 3D models.

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
│  │ /analyze │  │/generate │  │  /chat   │  │ /export | /build  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Pipeline                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐  ┌─────────┐    │
│  │   Vision    │→ │  Structure   │→ │ Critic │→ │ Refiner │    │
│  │  Analyzer   │  │   Planner    │  │        │  │         │    │
│  └─────────────┘  └──────────────┘  └────────┘  └─────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌──────────────────────┐  ┌───────────────────────────────────┐│
│  │  OpenAI GPT-4o       │  │  Tavily (Pricing Search)         ││
│  │  GPT-4 Vision        │  │                                   ││
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
│  - GPT-4 Vision analyzes image      │
│  - Extracts: object type, parts,    │
│    colors, dimensions               │
│  - Output: VisionAnalysis           │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│       2. Structure Planner          │
│  - Creates 3D element plan          │
│  - Positions & dimensions           │
│  - Material assignments             │
│  - Output: StructurePlan            │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│          3. Critic                  │
│  - Validates scene vs input         │
│  - Checks: type match, parts,       │
│    colors, proportions              │
│  - Output: CritiqueResult           │
└─────────────────────────────────────┘
     │ (if issues found)
     ▼
┌─────────────────────────────────────┐
│          4. Refiner                 │
│  - Fixes identified issues          │
│  - Adds missing parts               │
│  - Corrects type mismatches         │
│  - Output: RefinementResult         │
└─────────────────────────────────────┘
     │
     ▼
[Final 3D Scene JSON]
```

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
│  + localStorage persistence         │
└─────────────────────────────────────┘
```

## Key Design Decisions

1. **Multi-Agent Over Single Prompt** - Specialized agents produce better results than one complex prompt
2. **Vision-First** - Analyze image directly rather than relying on text descriptions
3. **Self-Correction** - Critic + Refiner loop catches and fixes errors
4. **Graceful Fallbacks** - Each agent has fallback behavior if LLM fails
