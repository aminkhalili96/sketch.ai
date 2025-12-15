# LLM Prompts Guide

## Overview

All LLM prompts are centralized in `src/lib/prompts.ts` for easy tuning and maintenance.

## Prompt Categories

### System Prompt

```typescript
SYSTEM_PROMPT
```

Defines the AI assistant persona - "Sketch.AI, an expert hardware design assistant."

**Key traits:**
- Electronics & circuit design expertise
- Microcontroller programming knowledge
- 3D modeling understanding
- Component sourcing abilities

---

### Analysis Prompts

#### Vision Analysis Prompt

**Used by:** Vision Analyzer Agent

**Purpose:** Extract structured info from sketch image.

**Key instructions:**
- Identify object type (enclosure/organic/mechanical/abstract)
- List all visible parts with shapes
- Suggest appropriate colors
- Estimate dimensions in mm

---

### Generation Prompts

#### Scene Generation Prompt

**Used by:** Structure Planner (for enclosures)

**Key instructions:**
- Generate JSON with elements array
- Use rounded-box as default
- Include: body, lid, mounting holes, ports
- Use production-quality aesthetics
- White/grey palette for neutral style

#### OpenSCAD Generation Prompt

**Used by:** Generate API (openscad output)

**Key instructions:**
- Generate valid OpenSCAD code
- Include modules for each component
- Use parameterized dimensions
- Add comments

---

### BOM & Assembly Prompts

#### BOM Generation Prompt

**Template variables:** `{description}`, `{components}`, `{requirements}`

**Output format:** Markdown table with columns:
- Item, Part Number, Description, Qty, Unit Price, Supplier, Purchase Link, Notes

#### Assembly Instructions Prompt

**Output format:** Step-by-step markdown with:
- Required tools
- Safety precautions
- Numbered assembly steps
- Testing procedures

---

### Agent Prompts

#### Critic Prompt

**Purpose:** Validate scene against vision analysis.

**Scoring (0-10):**
- 9-10: Perfect match
- 7-8: Good, minor issues
- 5-6: Partial match
- 3-4: Poor match
- 0-2: Wrong type entirely

#### Refiner Prompt

**Purpose:** Fix issues in scene.

**Critical rules:**
- Enclosure = boxes only
- Organic = spheres/capsules
- Mechanical = cylinders/boxes

---

## Prompt Engineering Tips

### For Better 3D Output

1. **Be explicit about shapes**: "Use ONLY sphere and capsule for organic shapes"
2. **Show examples**: Include JSON example in prompt
3. **Use constraints**: "NEVER use box for stuffed animals"
4. **Specify counts**: "Include at least 12 elements"

### For Consistent Formatting

1. Request `response_format: { type: 'json_object' }`
2. Include "Output ONLY valid JSON" in prompt
3. Provide example structure

### For Better Color Handling

1. Specify exact hex codes: "#8B4513 (saddle brown)"
2. Give color palette: "Use warm brown tones"
3. Assign colors to parts: "Eyes should be #1A1A1A"

---

## Modifying Prompts

1. Edit `src/lib/prompts.ts`
2. Test with `npm test`
3. Manual test with various sketches
4. Update this documentation
