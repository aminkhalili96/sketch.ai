# Interview: Challenges & Solutions

This document captures the key technical challenges faced during Sketch.ai development and the solutions we implemented. Useful for interviews and technical discussions.

---

## Challenge 1: 3D Model Type Mismatch

### Problem
When users uploaded a **microchip PCB** image, the system generated a **teddy bear** 3D model instead.

### Root Cause
- Hardcoded fallback scenes defaulted to teddy bear shapes
- Keyword-based object detection was too aggressive
- Prompts contained teddy bear examples that biased the LLM

### Solution: Multi-Agent Pipeline
Implemented a 5-agent system that analyzes the actual sketch image:

```
Vision Agent → Structure Planner → Critic → Refiner → 3D
```

**Key insight:** Let the AI **see** the image directly instead of relying on text descriptions.

### Result
- PCB images now correctly generate box/enclosure shapes
- Organic objects (toys) still get spheres/capsules
- Self-correction catches type mismatches

---

## Challenge 2: Missing Body Parts in 3D Models

### Problem
Generated teddy bear was missing eyes, ears, and nose - parts clearly visible in the sketch.

### Root Cause
- LLM prompt only showed 3-element example, so it generated minimal output
- No validation that all expected parts were present
- Fallback scene was incomplete

### Solution: Explicit Part Requirements + Critic
1. **Numbered part list**: Prompt explicitly requires "12 elements: body, head, 2 ears, 2 eyes, nose, muzzle, 2 arms, 2 legs"
2. **Full example JSON**: Show complete 12-element structure
3. **Critic Agent**: Validates all parts present, triggers refinement if missing

### Result
Complete models with all body parts, regardless of LLM variability.

---

## Challenge 3: Monochrome 3D Output

### Problem
All 3D models were white/grey regardless of the sketch showing colors (e.g., brown teddy bear).

### Root Cause
`normalizeSceneColors()` function was **forcing** white/grey palette, overwriting LLM-generated colors.

### Solution: Preserve LLM Colors
Modified the function to:
1. Preserve valid hex colors from LLM
2. Only apply defaults if color is missing/invalid
3. Default to warm brown instead of white for organic objects

```typescript
const hasValidColor = el.color && /^#[0-9A-Fa-f]{6}$/.test(el.color);
return hasValidColor ? el.color : defaultColor;
```

---

## Challenge 4: Chat Refinement Not Working

### Problem
Users asked the chatbot to "fix the 3D model" but nothing happened.

### Root Cause
Chat API (`/api/chat`) only provided text advice - it never triggered actual regeneration.

### Solution: Suggested Actions
Added detection for 3D-related requests:
- Keywords: "3d", "model", "shape", etc.
- Returns `suggestedActions: ["Regenerate 3D Model"]`
- UI shows actionable buttons

**Future enhancement:** Auto-trigger regeneration from chat.

---

## Challenge 5: LLM Generating Incorrect Geometry

### Problem
LLM used "box" primitives for organic shapes that should use spheres/capsules.

### Root Cause
- Generic prompts didn't enforce shape rules
- No validation after generation

### Solution: Critic + Refiner Loop
1. **Critic checks type match**: If vision says "organic" but scene has boxes → flag as critical issue
2. **Refiner fixes**: Emergency conversion of shapes
3. **Rules in prompts**: "Use ONLY sphere and capsule for organic shapes"

---

## Challenge 6: Slow Generation Time

### Problem
Sequential agent calls made 3D generation slow (~10+ seconds).

### Solution Considered (Not Yet Implemented)
- **Parallel BOM/Assembly/Firmware**: These don't depend on 3D
- **Cache vision analysis**: Reuse for same image
- **Streaming responses**: Show partial results

**Current status:** Acceptable for prototype, optimization planned.

---

## Challenge 7: OpenAI API Rate Limits

### Problem
Intermittent "No response from AI" errors during peak usage.

### Root Cause
OpenAI API rate limiting, especially with multiple agent calls.

### Solution
- Graceful fallbacks at each agent level
- Each agent returns reasonable defaults on failure
- Logged errors for debugging

**Future:** Implement retry with exponential backoff.

---

## Architecture Decisions Summary

| Decision | Alternatives Considered | Why Chosen |
|----------|------------------------|------------|
| Multi-agent | Single complex prompt | Better specialization, debugging |
| GPT-4 Vision | Text-only analysis | Accurate part extraction |
| Critic+Refiner | One-shot generation | Self-correction improves quality |
| JSON response format | Markdown/text parsing | Reliable structured output |
| Zod validation | Manual validation | Type safety, auto-parsing |

---

## Lessons Learned

1. **Don't hardcode defaults** - They will leak into wrong contexts
2. **Let AI see the input** - Vision beats text description
3. **Validate AI output** - LLMs are inconsistent
4. **Show complete examples** - Minimal examples = minimal output
5. **Self-correction works** - Critic+Refiner pattern is powerful
