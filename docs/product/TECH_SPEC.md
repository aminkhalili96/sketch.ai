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
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ OpenAI API   │  │  Supabase    │  │ Vercel Blob  │              │
│  │ GPT-4/Vision │  │  (Database)  │  │ (Storage)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | UI components |
| Zustand | 4.x | State management |
| React Dropzone | 14.x | File upload |
| React Markdown | 9.x | Render AI outputs |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 14.x | Backend API |
| OpenAI SDK | 4.x | AI integration |
| Zod | 3.x | Schema validation |

### Database & Storage
| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL database, auth |
| Vercel Blob | File storage for uploads |

### DevOps
| Technology | Purpose |
|------------|---------|
| Vercel | Hosting & deployment |
| GitHub Actions | CI/CD |
| ESLint + Prettier | Code quality |

---

## 3. Project Structure

```
sketch.ai/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   ├── projects/
│   │   ├── page.tsx             # Projects list
│   │   └── [id]/
│   │       └── page.tsx         # Single project view
│   └── api/
│       ├── analyze/
│       │   └── route.ts         # Image analysis endpoint
│       ├── generate/
│       │   └── route.ts         # Text generation endpoint
│       ├── chat/
│       │   └── route.ts         # Conversational endpoint
│       └── export/
│           └── route.ts         # Export to ZIP
│
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── SketchUploader.tsx       # Drag & drop upload
│   ├── ChatInterface.tsx        # Chat UI
│   ├── OutputTabs.tsx           # BOM/Assembly/Firmware tabs
│   ├── OutputViewer.tsx         # Markdown renderer
│   └── ProjectCard.tsx          # Project thumbnail
│
├── lib/
│   ├── openai.ts                # OpenAI client setup
│   ├── prompts.ts               # AI prompt templates
│   ├── validators.ts            # Zod schemas
│   └── utils.ts                 # Helper functions
│
├── stores/
│   └── projectStore.ts          # Zustand store
│
├── types/
│   └── index.ts                 # TypeScript types
│
├── docs/                        # Project documentation
│   ├── PRD.md
│   ├── TECH_SPEC.md
│   └── IMPLEMENTATION_PLAN.md
│
├── public/
│   └── images/
│
├── .env.local                   # Environment variables
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 4. API Endpoints

### POST `/api/analyze`
Analyzes uploaded sketch using GPT-4 Vision.

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
| **Edge Functions** | Deploy API routes to Vercel Edge |

---

## 9. Environment Variables

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Storage
BLOB_READ_WRITE_TOKEN=...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Feature Flags
ENABLE_VOICE_INPUT=false
ENABLE_3D_GENERATION=false
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
