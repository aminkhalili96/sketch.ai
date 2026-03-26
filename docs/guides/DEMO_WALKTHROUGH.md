# Demo Walkthrough Map

Use this guide to keep the interview walkthrough short and focused. The goal is to show how user input becomes structured outputs.

## Suggested Order

1) Project overview
- `README.md` — one-minute explanation of the product, stack, and how to run it.

2) App entry and layout
- `src/app/page.tsx` — top-level page composition and main layout flow.
- `src/app/layout.tsx` — global layout, fonts, and app shell.

3) User input and state
- `src/frontend/components/SketchUploader.tsx` — image upload, demo preset selection, and analysis trigger.
- `src/frontend/components/ChatInterface.tsx` — text input flow and how the project brief is stored.
- `src/frontend/state/projectStore.ts` — single source of truth for project state and outputs.

4) API and backend pipeline
- `src/app/api/generate/route.ts` — request validation and orchestration handoff.
- `src/backend/agents/orchestrator.ts` — multi-step pipeline that produces outputs.
- `src/backend/agents/assemblyPlanner.ts` — enclosure assembly spec planner.
- `src/backend/pipeline/assemblySpec.ts` — deterministic enclosure scene/OpenSCAD generation.

5) Shared domain logic
- `src/shared/domain/projectDescription.ts` — how description and analysis are combined.
- `src/shared/domain/scene.ts` — scene schema and helper logic for 3D models.

6) Output presentation
- `src/frontend/components/OutputTabs.tsx` — how outputs are rendered and exported.
- `src/frontend/components/PresentationView.tsx` — the product overview scene for demo.
- `/api/render-3d` — on-demand CAD + photoreal render pipeline.

## Optional Depth (Only If Asked)
- `docs/architecture/PRODUCTION_ARCHITECTURE.md` — system design and production readiness.
- `docs/product/PRODUCT_BRIEF.md` — product motivation and constraints.
- `docs/architecture/DEPLOYMENT.md` — CI/CD and deployment story.

## One-Line Story You Can Use
User input and sketches flow through a single project store, the backend pipeline produces structured outputs, and the frontend renders those outputs in a presentation-friendly view.
