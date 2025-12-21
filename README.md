# Sketch.ai

> Transform hardware sketches into manufacturable 3D designs with AI

🔗 **[Live Demo](https://bit.ly/sketch_ai)** | **[Try it now →](https://sketch-ai-6kexzh25rq-uc.a.run.app)**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)


## ✨ Features

- **Sketch-to-3D**: Upload a sketch, get a 3D model
- **Multi-Agent AI**: 5 specialized agents for accurate generation
- **Vision Analysis**: GPT-4 Vision extracts parts directly from images
- **Self-Correction**: Critic + Refiner agents fix errors automatically
- **Multiple Outputs**: BOM, Assembly, Firmware, Schematic, OpenSCAD

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
```

See [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) for details.

## 📁 Project Structure

```
src/
├── app/                 # Next.js app router
│   └── api/            # API routes
│       ├── analyze/    # Sketch analysis
│       ├── generate/   # Output generation
│       └── agents/     # Agent endpoints
├── components/         # React components
├── lib/
│   ├── agents/         # Multi-agent system
│   ├── prompts.ts      # LLM prompts
│   └── validators.ts   # Zod schemas
├── stores/             # Zustand stores
└── types/              # TypeScript types
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](doc/ARCHITECTURE.md) | System design & data flow |
| [API.md](doc/API.md) | REST API reference |
| [AGENTS.md](doc/AGENTS.md) | Multi-agent system guide |
| [PROMPTS.md](doc/PROMPTS.md) | LLM prompts documentation |
| [INTERVIEW.md](doc/INTERVIEW.md) | Challenges & solutions |

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
- **AI**: OpenAI GPT-4o, GPT-4 Vision
- **3D**: Three.js, React Three Fiber
- **Validation**: Zod

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.
