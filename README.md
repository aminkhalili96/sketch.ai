# Sketch.ai

> Transform hardware sketches into manufacturable 3D designs with AI

🔗 **[Live Demo](https://bit.ly/sketch_ai)** | **[Try it now →](https://sketch-ai-6kexzh25rq-uc.a.run.app)**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)


## ✨ Features

- **Sketch-to-3D**: Upload a sketch, get a production-ready 3D model
- **18-Agent AI System**: Specialized agents for every aspect of product development
- **Vision Analysis**: GPT-5.2 Vision extracts parts directly from images
- **Self-Correction**: Critic + Refiner agents fix errors automatically
- **Visual Polish Loop**: Automatically refines 3D model appearance until professional
- **Full Engineering Suite**: BOM, Assembly, Firmware, Schematic, OpenSCAD
- **Quality Assurance**: Safety, DFM, Sustainability analysis
- **Business Intelligence**: Cost Optimization, Marketing, Patent Risk

## 🤖 Multi-Agent System (18 Agents)

| Category | Agents |
|----------|--------|
| **Core Loop** | Vision Analyzer, Structure Planner, Critic, Refiner |
| **Visual Polish** | Visual Critic, Visual Refiner |
| **Engineering** | BOM, Assembly, Firmware, Schematic, Scene, OpenSCAD |
| **Quality & Safety** | Safety Compliance, DFM Analysis, Sustainability |
| **Business** | Cost Optimizer, Marketing, Patent Risk |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

```
[Sketch] → Vision Agent → Structure Planner → Critic → Refiner → [3D Model]
                                    ↓
     [Safety] [DFM] [Sustainability] [Cost] [Marketing] [Patent]
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## 📁 Project Structure

```
src/
├── app/                 # Next.js app router
│   └── api/            # API routes
│       ├── analyze/    # Sketch analysis
│       ├── generate/   # Output generation
│       ├── health/     # Health check endpoint
│       └── agents/     # Agent endpoints
├── components/         # React components
├── lib/
│   ├── agents/         # Multi-agent system (18 agents)
│   ├── logger.ts       # Structured logging
│   ├── rateLimit.ts    # Rate limiting
│   ├── tokenTracker.ts # OpenAI cost tracking
│   ├── metrics.ts      # Performance metrics
│   └── prompts.ts      # LLM prompts
├── middleware.ts       # Security & rate limiting
├── stores/             # Zustand stores
└── types/              # TypeScript types
```

## 📖 Documentation

| Category | Document | Description |
|----------|----------|-------------|
| **Architecture** | [Production Guide](docs/architecture/PRODUCTION_ARCHITECTURE.md) | **Interview & Production Guide** |
| | [System Architecture](docs/architecture/ARCHITECTURE.md) | System design & data flow |
| | [Deployment](docs/architecture/DEPLOYMENT.md) | CI/CD pipeline & cloud setup |
| | [Agents](docs/architecture/AGENTS.md) | 18-Agent system breakdown |
| **Product** | [Product Brief](docs/product/PRODUCT_BRIEF.md) | High-level problem & solution |
| | [Tech Spec](docs/product/TECH_SPEC.md) | Detailed technical specifications |
| **Guides** | [Prompts](docs/guides/PROMPTS.md) | LLM prompt engineering guide |
| | [Evaluation](docs/guides/EVALUATION.md) | Testing & accuracy metrics |
| **Reference** | [API Reference](docs/API.md) | REST API endpoints |

> 🔒 **Private Notes**: Personal interview notes are stored in `docs/private/` (git-ignored).

## 🛡️ Production Features

- **Health Checks**: `/api/health` for Kubernetes probes
- **Rate Limiting**: Protect API from abuse (100/min general, 10/min AI)
- **Token Tracking**: Monitor OpenAI costs in real-time
- **Structured Logging**: JSON logs with request IDs
- **Metrics**: Prometheus-compatible performance tracking
- **Security Headers**: XSS protection, CORS, content security

## 🧪 Testing

```bash
npm test        # Run tests
npm run lint    # Lint code
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **AI**: OpenAI GPT-5.2, GPT-4 Vision
- **3D**: Three.js, React Three Fiber
- **Validation**: Zod

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.
