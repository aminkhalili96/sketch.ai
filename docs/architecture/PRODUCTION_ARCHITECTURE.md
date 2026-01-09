# Production-Grade Architecture

> A comprehensive guide to the production-grade features of sketch.ai for interview discussions.

## Table of Contents
1. [Multi-Agent System](#multi-agent-system)
2. [Health Checks](#health-checks)
3. [Rate Limiting](#rate-limiting)
4. [Token Tracking](#token-tracking)
5. [Structured Logging](#structured-logging)
6. [Metrics Collection](#metrics-collection)
7. [Security](#security)
8. [Interview Talking Points](#interview-talking-points)

---

## Multi-Agent System

sketch.ai uses **18 specialized AI agents** working together:

### Core 3D Generation Loop
```
┌─────────────┐    ┌──────────────────┐    ┌────────┐    ┌─────────┐
│   Vision    │───▶│ Structure Planner│───▶│ Critic │───▶│ Refiner │
│   Agent     │    │                  │    │        │    │         │
└─────────────┘    └──────────────────┘    └────────┘    └─────────┘
                                                │              │
                                                └──────────────┘
                                                   (loop until
                                                    acceptable)
```

### Visual Polish Loop
After structural correctness, a second loop ensures visual quality:

```
┌────────────────┐    ┌─────────────────┐
│ Visual Critic  │───▶│ Visual Refiner  │
│ (score 1-10)   │    │ (fixes issues)  │
└────────────────┘    └─────────────────┘
         │                    │
         └────────────────────┘
            (loop until score >= 8)
```

### Export Agents
| Agent | Output | Purpose |
|-------|--------|---------|
| BOMAgent | Bill of Materials | Parts list with costs |
| AssemblyAgent | Instructions | Step-by-step build guide |
| FirmwareAgent | Arduino code | Microcontroller firmware |
| SchematicAgent | Circuit diagram | Electrical connections |
| OpenSCADAgent | 3D model code | Printable STL source |
| SafetyAgent | Safety report | Hazard analysis |
| SustainabilityAgent | Eco report | Carbon footprint |
| CostOptimizerAgent | Cost analysis | Cheaper alternatives |
| DFMAgent | DFM report | Manufacturing feasibility |
| MarketingAgent | Marketing copy | Product naming/pitch |
| PatentRiskAgent | IP analysis | Patent risk assessment |

---

## Health Checks

**File:** `src/app/api/health/route.ts`

Kubernetes-compatible health endpoint for liveness and readiness probes.

### Endpoints
```bash
# Basic health check (liveness)
GET /api/health

# Deep check with OpenAI connectivity (readiness)
GET /api/health?deep=true
```

### Response Format
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "memory": "ok",
    "openai": "ok"
  },
  "details": {
    "memory": {
      "heapUsed": "45MB",
      "heapTotal": "128MB"
    }
  }
}
```

### Interview Discussion Points
- **Why health checks matter:** Kubernetes uses them to restart unhealthy pods
- **Liveness vs Readiness:** Liveness = is it running? Readiness = can it serve traffic?
- **Deep checks:** Test external dependencies (OpenAI API) with timeout

---

## Rate Limiting

**File:** `src/lib/rateLimit.ts`

Protects against abuse and controls API costs.

### Implementation
- **Algorithm:** Sliding window counter
- **Storage:** In-memory Map (upgradeable to Redis)
- **Limits:**
  - General endpoints: 100 requests/minute
  - AI endpoints: 10 requests/minute
  - Analyze endpoint: 5 requests/minute

### Response on Rate Limit
```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45
}
```

### Headers
```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Reset: 1704067200
```

### Interview Discussion Points
- **Why rate limit?** OpenAI costs $5-15 per 1M tokens
- **Sliding window vs fixed window:** Sliding prevents burst at window boundaries
- **Redis upgrade path:** For distributed systems, share state across pods

---

## Token Tracking

**File:** `src/lib/tokenTracker.ts`

Monitor OpenAI API costs in real-time.

### Pricing Reference
| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|-----------------|
| gpt-4o | $5 | $15 |
| gpt-4-turbo | $10 | $30 |
| gpt-5.2 | $15 | $45 |

### Features
- Per-request cost calculation
- Daily/monthly summaries
- Budget warnings
- Model-specific tracking

### Usage
```typescript
import { trackTokenUsage, getTodayUsage } from '@/lib/tokenTracker';

// After API call
trackTokenUsage('gpt-4o', inputTokens, outputTokens, requestId);

// Get summary
const today = getTodayUsage();
console.log(`Today's cost: $${today.totalCostUsd.toFixed(2)}`);
```

### Interview Discussion Points
- **Cost awareness:** Essential for any production AI app
- **Budget alerts:** Prevent runaway costs
- **Optimization:** Track which agents use most tokens

---

## Structured Logging

**File:** `src/lib/logger.ts`

Production logging with levels, request IDs, and JSON format.

### Log Levels
```
DEBUG → INFO → WARN → ERROR
```

### Log Format (JSON)
```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Agent execution complete",
  "context": {
    "requestId": "req_abc123",
    "agent": "VisionAnalyzer",
    "duration": 1234
  }
}
```

### Request Tracing
```typescript
import { logger, generateRequestId } from '@/lib/logger';

const requestId = generateRequestId();
const log = logger.forRequest(requestId);

log.info('Starting analysis');
log.info('Vision complete', { score: 8.5 });
log.error('Failed', {}, error);
```

### Interview Discussion Points
- **Why structured?** Log aggregation (ELK, CloudWatch) needs parseable format
- **Request IDs:** Enable distributed tracing across microservices
- **Log levels:** Filter noise in production (only WARN+ERROR)

---

## Metrics Collection

**File:** `src/lib/metrics.ts`

Track performance metrics for monitoring dashboards.

### Metric Types
| Type | Use Case | Example |
|------|----------|---------|
| Counter | Count events | `http_requests_total` |
| Histogram | Measure distributions | `request_duration_ms` |
| Gauge | Current state | `active_connections` |

### Key Metrics
- `http_requests_total{method, path, status}`
- `http_request_duration_ms{method, path}`
- `agent_executions_total{agent, status}`
- `agent_execution_duration_ms{agent}`
- `openai_tokens_total{model, type}`
- `errors_total{type, source}`

### Prometheus Export
```bash
GET /api/metrics

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/analyze",status="200"} 42
```

### Interview Discussion Points
- **Percentiles (p50, p95, p99):** Better than averages for latency
- **Prometheus/Grafana:** Industry standard observability stack
- **SLOs:** Define targets (e.g., p99 latency < 5s)

---

## Security

**File:** `src/middleware.ts`

Security hardening for production.

### Features
1. **Rate Limiting** - Prevent abuse
2. **API Key Auth** - Restrict access (optional)
3. **Request Logging** - Audit trail
4. **Security Headers:**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`

### CORS Configuration
```typescript
response.headers.set('Access-Control-Allow-Origin', '*');
response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
```

### Interview Discussion Points
- **Defense in depth:** Multiple layers of protection
- **Security headers:** Prevent common attacks (XSS, clickjacking)
- **API keys:** Control who can access expensive AI endpoints

---

## Interview Talking Points

### When Asked "Is This Production-Ready?"

✅ **Yes, and here's why:**

1. **Observability:** Structured logging, metrics, health checks
2. **Security:** Rate limiting, auth support, security headers
3. **Cost Control:** Token tracking, budget warnings
4. **Scalability:** Stateless design, Redis-upgradeable rate limiting
5. **Testing:** Unit tests for core functionality
6. **DevOps:** Dockerfile, Kubernetes configs, CI/CD

### When Asked "What Would You Add Next?"

1. **Redis** - Distributed rate limiting across pods
2. **Sentry** - Error tracking and alerting
3. **OpenTelemetry** - Distributed tracing
4. **Database** - Persist usage data and user projects
5. **Authentication** - OAuth/JWT for user accounts
6. **CDN** - Cache static assets globally

### When Asked "How Do You Handle Costs?"

1. **Token tracking** per request and daily summaries
2. **Rate limiting** to prevent abuse
3. **Budget warnings** when approaching limits
4. **Model selection** - Use cheaper models where appropriate
5. **Caching** (future) - Don't re-generate identical requests

### When Asked "How Do You Debug Production Issues?"

1. **Request IDs** - Trace a request through all logs
2. **Structured logs** - Search in log aggregator
3. **Metrics** - Identify patterns (error spikes, latency)
4. **Health checks** - Know immediately if service is down
