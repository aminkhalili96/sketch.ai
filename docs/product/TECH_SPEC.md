# Sketch.ai - Technical Specification

> **Version**: 1.0  
> **Last Updated**: December 2024

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Upload UI   │  │  Chat UI     │  │  Output UI   │              │
│  │  (Dropzone)  │  │  (Messages)  │  │  (Tabs)      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                              │                                      │
│                    ┌─────────▼─────────┐                           │
│                    │   Zustand Store   │                           │
│                    │  (Global State)   │                           │
│                    └─────────┬─────────┘                           │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ API Calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER (Next.js API Routes)                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ /api/analyze │  │ /api/generate│  │ /api/export  │              │
│  │   (Vision)   │  │   (Chat)     │  │   (Files)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └────────────┬────┴────────────────┘                       │
│                      ▼                                              │
│              ┌───────────────┐                                      │
│              │  AI Service   │                                      │
│              │  (OpenAI)     │                                      │
│              └───────────────┘                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                               │
│  │ OpenAI API   │  │ Tavily API   │                               │
│  │ GPT-5.2/4o   │  │ (Pricing)    │                               │
│  └──────────────┘  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | latest | UI components |
| Zustand | 5.x | State management |
| React Dropzone | 14.x | File upload |
| React Markdown | 10.x | Render AI outputs |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 16.x | Backend API |
| OpenAI SDK | 6.x | AI integration |
| Zod | 4.x | Schema validation |

### Database & Storage
| Technology | Purpose |
|------------|---------|
| None (default) | No external database configured in this repo |
| Optional | Add Postgres or object storage if persistence is required |

### DevOps
| Technology | Purpose |
|------------|---------|
| Docker + Cloud Run | Containerized deployment (reference) |
| GitHub Actions | CI/CD |
| ESLint | Code quality |

---

## 3. Project Structure

```
sketch.ai/
├── src/
│   ├── app/                     # Next.js App Router + API routes
│   ├── frontend/                # Client UI + state
│   ├── backend/                 # Server-side logic
│   ├── shared/                  # Cross-cutting types and domain logic
│   └── middleware.ts            # Security and request middleware
│
├── docs/                        # Project documentation
├── public/
│   └── demo/                    # Demo assets
├── tests/                       # Unit and API tests
│
├── .env                         # Environment variables
├── next.config.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

---

## 4. API Endpoints

### POST `/api/analyze`
Analyzes uploaded sketch using a vision-capable model (default: gpt-4o).

**Request:**
```typescript
{
  image: string;        // Base64 encoded image
  description?: string; // Optional text context
}
```

**Response:**
```typescript
{
  analysis: {
    identified_components: string[];
    suggested_features: string[];
    complexity_score: number;
    questions: string[];  // Clarifying questions for user
  }
}
```

---

### POST `/api/generate`
Generates full project outputs.

**Request:**
```typescript
{
  projectDescription: string;
  analysisContext?: object;  // From /api/analyze
  outputTypes: ('bom' | 'assembly' | 'firmware' | 'schematic')[];
}
```

**Response:**
```typescript
{
  outputs: {
    bom?: string;          // Markdown table
    assembly?: string;     // Markdown instructions
    firmware?: string;     // Arduino code
    schematic?: string;    // Text description
  };
  metadata: {
    estimatedCost: number;
    complexity: 'simple' | 'moderate' | 'complex';
    buildTime: string;
  }
}
```

---

### POST `/api/chat`
Conversational refinement of project.

**Request:**
```typescript
{
  projectId: string;
  message: string;
  history: Message[];
}
```

**Response:**
```typescript
{
  reply: string;
  updatedOutputs?: object;  // If AI modified any outputs
  suggestedActions?: string[];
}
```

---

### POST `/api/export`
Exports project as downloadable ZIP.

**Request:**
```typescript
{
  projectId: string;
  formats: ('markdown' | 'pdf' | 'zip')[];
}
```

**Response:**
```typescript
{
  downloadUrl: string;
  expiresAt: string;
}
```

---

## 5. Data Models

### Project
```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  sketchUrl?: string;
  analysis?: AnalysisResult;
  outputs: {
    bom?: string;
    assembly?: string;
    firmware?: string;
    schematic?: string;
  };
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Message
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

### AnalysisResult
```typescript
interface AnalysisResult {
  identifiedComponents: string[];
  suggestedFeatures: string[];
  complexityScore: number;
  questions: string[];
}
```

---

## 6. AI Prompt Engineering

### System Prompt (Base)
```
You are Sketch.ai, an expert hardware design assistant. You help users 
transform their hardware ideas into complete, manufacturable specifications.

You have expertise in:
- Electronics and circuit design
- Microcontroller programming (Arduino, ESP32, STM32)
- 3D modeling and enclosure design
- Component selection and sourcing
- Manufacturing processes

Always provide:
- Specific part numbers when possible
- Cost-conscious alternatives
- Safety considerations
- Clear, beginner-friendly explanations
```

### Vision Analysis Prompt
```
Analyze this hardware sketch and identify:
1. Main components visible (sensors, MCUs, connectors, etc.)
2. Intended functionality (what is this supposed to do?)
3. Complexity assessment (simple/moderate/complex)
4. Missing information (what should I ask the user?)
5. Suggested improvements or alternatives

Be specific about component types. If you see a sensor, try to identify 
what kind. If you see a microcontroller, suggest which family would work best.
```

### BOM Generation Prompt
```
Generate a complete Bill of Materials for this project:

Project: {description}
Requirements: {requirements}

Format as a Markdown table with columns:
| Item | Part Number | Description | Qty | Unit Price | Supplier | Link |

Include:
- All electronic components (ICs, passives, connectors)
- Mechanical parts (enclosure, fasteners)
- Tools required (if not commonly owned)
- Optional enhancements

Provide alternatives for expensive components.
Calculate total estimated cost.
```

---

## 7. Security Considerations

### API Security
- [ ] Rate limiting on all endpoints
- [ ] Input validation with Zod
- [ ] Sanitize AI outputs before rendering
- [ ] CORS configuration

### Authentication
- [ ] NextAuth.js or Clerk for user auth
- [ ] Session-based access control
- [ ] API key management for OpenAI

### Data Privacy
- [ ] User uploads stored securely
- [ ] Option to delete project data
- [ ] No PII in AI prompts

---

## 8. Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| **Streaming** | Use OpenAI streaming for real-time output |
| **Caching** | Cache common component data |
| **Lazy Loading** | Load output tabs on demand |
| **Image Optimization** | Compress uploads before sending to Vision API |
| **Edge Runtime** | Optional edge deployment on supported platforms |

---

## 9. Environment Variables

```env
# Core
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_ORG_ID=org_...

# Model overrides
OPENAI_TEXT_MODEL=gpt-5.2
OPENAI_VISION_MODEL=gpt-4o

# Offline mode (optional)
USE_OFFLINE_MODEL=false
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_TEXT_MODEL=qwen2.5:7b
OLLAMA_VISION_MODEL=llava:7b

# Tavily (optional)
TAVILY_API_KEY=tvly_...

# API access (optional)
API_KEYS=key1,key2

# Logging (optional)
LOG_LEVEL=info
LOG_FORMAT=json

# Tooling (optional)
OPENSCAD_PATH=openscad
```

---

## 10. Testing Strategy

### Unit Tests
- API route handlers
- Prompt template generation
- Utility functions

### Integration Tests
- OpenAI API integration
- Database operations
- File upload flow

### E2E Tests (Playwright)
- Full user journey: upload → generate → export
- Error handling flows
- Responsive design

---

*Document Status: Draft - Ready for Review*
