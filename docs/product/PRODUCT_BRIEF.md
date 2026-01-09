# Sketch.ai Product Brief (Recruiter Edition)

## Problem
Early hardware sketches are ambiguous. Translating a napkin drawing into a manufacturable spec requires expertise across mechanical, electronics, and firmware, which makes iteration slow and expensive.

## Who It's For
- Hardware hobbyists and makers
- Product engineers building MVP prototypes
- Industrial designers validating early form factors

## What Sketch.ai Delivers
Input: sketch + short notes  
Output: structured, first-draft engineering artifacts
- 3D scene (visual preview) + OpenSCAD source
- Bill of Materials (BOM)
- Assembly guide
- Firmware starter code
- Schematic description

## Why This Matters
The hardest part of hardware prototyping is getting to a coherent first draft. Sketch.ai reduces time-to-first-spec and provides a unified workflow with built-in self-correction.

## System Boundaries
**In scope:** first-draft specs, design iteration, and fast concept validation.  
**Out of scope:** CAD-precise geometry and production-ready PCB layouts.

## Success Metrics
- Time to first output (< 60s in fast mode)
- JSON validity rate (scene output)
- Object-kind accuracy (enclosure vs object)
- OpenSCAD compile success rate
- User iteration count to reach "acceptable"

## Reliability & Safety
- Schema validation with Zod
- Critic + Refiner loop for self-correction
- Graceful fallbacks when models refuse or fail
- Offline mode supported (Ollama) for demos and privacy

## Demo Narrative (60 seconds)
1. Upload a sketch
2. Show pipeline trace (vision → plan → critique → refine)
3. Inspect 3D preview and BOM
4. Refine via chat and re-generate
5. Export build guide / STL
