# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Sketch.ai transforms hardware sketches into manufacturable 3D designs using a multi-agent AI system. Users upload a sketch (or pick a demo preset), and the app generates 3D models, BOMs, assembly instructions, firmware, schematics, and business analyses through 18 specialized AI agents.

## Commands

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run dev:3001     # Dev server on port 3001
npm run dev:clean    # Clear .next cache then start dev server
npm run build        # Production build (standalone output)
npm run lint         # ESLint (flat config, next/core-web-vitals + typescript)
npm test             # Vitest (watch mode)
npm run test:ci      # Vitest single run (CI)
npx vitest run tests/unit/bom.test.ts   # Run a single test file
npm run eval         # Evaluation harness (requires dev server running)
```

Requires Node >= 20.

## Architecture

### Layer Separation

The codebase enforces a strict 3-layer boundary via path aliases (`@/*` → `./src/*`):

- **`src/app/`** — Next.js App Router. Thin route handlers that delegate to backend. API routes live under `src/app/api/`.
- **`src/frontend/`** — Client-only code: React components, Zustand stores (`projectStore.ts`), UI helpers. All UI components use shadcn/ui (new-york style, aliases configured in `components.json`).
- **`src/backend/`** — Server-only code: AI agents, OpenAI/Ollama client, prompt templates, pipeline processors, infra (logging, rate limiting, metrics, token tracking).
- **`src/shared/`** — Cross-cutting code imported by both frontend and backend: TypeScript types (`types/index.ts`), Zod validators (`schemas/validators.ts`), domain helpers (scene parsing, BOM normalization, project kind inference), model catalog.
- **`tests/`** — Tests organized by type: `tests/unit/`, `tests/api/`, `tests/e2e/`.

ESLint enforces layer boundaries at build time: frontend cannot import from `@/backend/*` and backend cannot import from `@/frontend/*` (see `eslint.config.mjs`).

### Multi-Agent System

The core pipeline is in `src/backend/agents/`:

1. **Vision Analyzer** (`visionAnalyzer.ts`) — GPT-4o extracts components from uploaded sketch images
2. **Structure Planner** (`structurePlanner.ts`) — Plans 3D scene element layout
3. **Critic** (`critic.ts`) — Scores the generated scene, identifies issues
4. **Refiner** (`refiner.ts`) — Fixes issues found by critic (loops until score ≥ threshold)
5. **Visual Critic/Refiner** (`visualCritic.ts`, `visualRefiner.ts`) — Polish loop for visual appearance
6. **Assembly Planner** (`assemblyPlanner.ts`) — Generates assembly specs for enclosure-type projects
7. **Orchestrator** (`orchestrator.ts`) — Coordinates the vision→plan→critique→refine loop
8. **Registry** (`registry.ts`) — Maps agent names to output types; executes agent tasks by dispatching to the right prompt+LLM call. This is the largest file — handles BOM, Assembly, Firmware, Schematic, OpenSCAD, Safety, Sustainability, Cost, DFM, Marketing, and Patent Risk agents.

### Agent Execution Flow (confirm-before-apply)

The API supports a 3-step agent flow:
1. **Route** (`/api/agents/route`) — Heuristic + LLM classifier decides if user intent is "chat" or "plan" (which outputs to generate)
2. **Plan** (`/api/agents/plan`) — Builds an `AgentPlan` with ordered `AgentTask[]` including dependencies
3. **Execute** (`/api/agents/execute`) — Runs tasks respecting `dependsOn` ordering, returns updated outputs

The `RequestedOutput` type `'3d-model'` expands to both `scene-json` and `openscad` outputs (see `expandRequestedOutputs()` in `registry.ts`).

### 3D Kind Inference

`src/shared/domain/projectKind.ts` classifies projects as `'enclosure'` (hardware box with PCB) or `'object'` (toy/figurine) via keyword matching. This affects which scene generation prompt and OpenSCAD template is used. The `assemblySpec` pipeline is only used for enclosure-type projects.

### Dual-Mode AI Client

`src/backend/ai/openai.ts` supports two modes:
- **Online**: OpenAI API (GPT-5.2 text, GPT-4o vision) — requires `OPENAI_API_KEY`
- **Offline**: Ollama local models via OpenAI-compatible API — set `USE_OFFLINE_MODEL=true`

The `getLLMClient()` function returns a singleton OpenAI client. `getModelName(taskType, preferredModel?)` resolves the model ID. The client wrapper automatically converts `max_tokens` to `max_completion_tokens` for GPT-5.x and GPT-4.5 models (which require this parameter).

### State Management

Single Zustand store (`src/frontend/state/projectStore.ts`) with `persist` middleware (sessionStorage). Holds the current `Project` object with all outputs, analysis, messages, and UI loading states. Supports output undo via snapshot stack (max 20).

### Scene Format

The 3D viewer uses a custom JSON scene format (array of elements with `type`, `position`, `size`, `color`, `rotation`). Validated by Zod schemas in `src/shared/schemas/validators.ts`. Parsed/normalized by helpers in `src/shared/domain/scene.ts`. Rendered via React Three Fiber (`SceneRenderer.tsx`).

### Pipeline Processors

- `src/backend/pipeline/assemblySpec.ts` — Converts assembly specs to scene JSON and OpenSCAD
- `src/backend/pipeline/openscad.ts` — OpenSCAD code generation and fallbacks
- `src/backend/pipeline/schematicSvg.ts` — SVG schematic diagram generation
- `src/backend/pipeline/cadRender.ts` — CadQuery + Blender photoreal render pipeline (optional, requires external tools)

### API Route Pattern

All API routes follow a consistent pattern using `createApiContext()` from `src/backend/infra/apiContext.ts`:
1. Create context with rate limit config → get `requestId`, auto-tracks metrics
2. Check `ctx.rateLimitResponse` (return early if rate-limited)
3. Validate request body with Zod schema from `src/shared/schemas/validators.ts`
4. Wrap response in `ctx.finalize()` to attach request ID, rate limit headers, and log

## Key Conventions

- Path alias: `@/` maps to `./src/`
- shadcn/ui aliases: components at `@/frontend/components/ui`, utils at `@/frontend/lib/utils`
- All Zod validation schemas are centralized in `src/shared/schemas/validators.ts`
- Prompt templates use `fillPromptTemplate()` with `{{placeholder}}` syntax
- The model catalog (`src/shared/ai/modelCatalog.ts`) is the single source of truth for available models and their capabilities
- Pre-commit hook blocks `.env` files (except `.env.example`), `docs/INTERVIEW.md`, `docs/private/`, and staged files containing OpenAI API key patterns (`sk-...`)
- TypeScript strict mode with `noUncheckedIndexedAccess` enabled — indexed access returns `T | undefined`
- Tavily web search (`src/backend/services/tavily.ts`) provides real-time component pricing for BOMs (optional, requires `TAVILY_API_KEY`)

## Testing

- **Framework**: Vitest with jsdom environment, React Testing Library
- **Environment overrides**: API tests (`tests/api/`) and e2e tests (`tests/e2e/`) run in `node` environment (configured via `environmentMatchGlobs` in `vitest.config.ts`); unit tests use `jsdom`
- **Setup**: `vitest.setup.ts` provides in-memory localStorage/sessionStorage polyfill
- **Test location**: `tests/unit/` for unit tests, `tests/api/` for API route tests, `tests/e2e/` for integration
- API route tests mock `getLLMClient` and test request/response shapes — see `tests/api/generate/route.test.ts` for the standard mocking pattern

## Deployment

- Docker multi-stage build (`Dockerfile`) → standalone Next.js output
- Kubernetes manifests in `k8s/` (deployment + service)
- Health check endpoint: `/api/health`
