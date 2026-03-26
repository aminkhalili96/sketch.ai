// AI Prompt Templates for Sketch.AI

export const SYSTEM_PROMPT = `You are Sketch.AI, an expert hardware design assistant. You help users transform their hardware ideas into complete, manufacturable specifications.

You have deep expertise in:
- Electronics and circuit design
- Microcontroller programming (Arduino, ESP32, STM32, Raspberry Pi)
- 3D modeling and enclosure design
- Component selection and sourcing (DigiKey, Mouser, LCSC)
- Manufacturing processes (SMT assembly, 3D printing, CNC)
- IoT protocols (WiFi, Bluetooth, LoRa, Zigbee)
- Power management and battery design

Always provide:
- Specific part numbers when possible (with alternatives)
- Cost-conscious alternatives for expensive components
- Safety considerations and disclaimers
- Clear, beginner-friendly explanations
- Links to datasheets when mentioning specific ICs

Be encouraging and supportive of makers at all skill levels.`;

export const VISION_ANALYSIS_PROMPT = `Analyze this hardware sketch and provide a structured assessment:

1. **Identified Components**: List all visible components (sensors, MCUs, connectors, batteries, displays, etc.)
2. **Intended Functionality**: What is this device supposed to do?
3. **Complexity Assessment**: Rate as simple/moderate/complex (1-10 score)
4. **Missing Information**: What should I ask the user to clarify?
5. **Suggested Improvements**: What alternatives or enhancements would you recommend?

Be specific about component types. If you see a sensor, identify what kind. If you see a microcontroller, suggest which family would work best.

Respond in JSON format:
{
  "identifiedComponents": ["component1", "component2"],
  "suggestedFeatures": ["feature1", "feature2"],
  "complexityScore": 5,
  "complexity": "moderate",
  "questions": ["question1", "question2"],
  "summary": "Brief description of what this appears to be"
}`;

export const DESCRIPTION_ANALYSIS_PROMPT = `The image could not be analyzed. Use ONLY the user's text description to provide a structured assessment.

If the description is vague, keep the component list short and ask clarifying questions.

Respond in JSON format:
{
  "identifiedComponents": ["component1", "component2"],
  "suggestedFeatures": ["feature1", "feature2"],
  "complexityScore": 5,
  "complexity": "moderate",
  "questions": ["question1", "question2"],
  "summary": "Brief description of what this appears to be based on the description"
}`;

export const ASSEMBLY_SPEC_PROMPT = `Generate a JSON assembly specification for a production-style electronics enclosure.

Project Description:
{description}

Vision Analysis:
{vision}

Analysis Context:
{analysis}

User Request:
{instruction}

Output ONLY JSON using this schema:
{
  "version": 1,
  "units": "mm",
  "kind": "enclosure",
  "enclosure": {
    "shape": "rect" | "round",
    "width": 110,
    "depth": 78,
    "height": 28,
    "wall": 2,
    "cornerRadius": 8,
    "topHeight": 16,
    "bottomHeight": 10,
    "gap": 4,
    "material": "plastic",
    "colorTop": "#B9B2A8",
    "colorBottom": "#8F8983",
    "colorAccent": "#6F6A64"
  },
  "pcb": {
    "shape": "rect" | "round",
    "width": 90,
    "depth": 64,
    "thickness": 2,
    "offsetY": 0,
    "color": "#C9A571"
  },
  "ports": [
    {
      "type": "usb-c",
      "side": "front",
      "size": [12, 6, 16],
      "offset": [0, 0],
      "name": "usb-c"
    }
  ],
  "components": [
    {
      "name": "main-ic",
      "role": "ic",
      "size": [16, 3, 12],
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "color": "#403B35",
      "material": "plastic"
    }
  ],
  "view": { "explodedGap": 18 }
}

Rules:
- Use millimeters and realistic electronics proportions.
- Ensure the PCB fits inside the enclosure with the specified wall and gap.
- Components must sit on top of the PCB: use position [x, y, z] where y is vertical offset (0 = on board).
- Ports use "offset": [x, y] in millimeters relative to the side center (y = vertical).
- Use hex colors only (#RRGGBB).
- Include at least 6 components unless the description says otherwise.
- Prefer rounded edges (cornerRadius 6-12mm) for consumer products.
- If the enclosure is round, keep width ~= depth and use pcb.shape = "round".
- Output JSON only.`;

export const ASSEMBLY_SPEC_REFINE_PROMPT = `Refine the assembly specification using the critique feedback.

Project Description:
{description}

Current Spec (JSON):
{spec}

Critique Feedback (JSON):
{critique}

Update the spec to address the critique while preserving overall proportions.
Keep PCB and enclosure aligned, maintain realistic dimensions, and ensure colors remain valid hex values.

Output ONLY the full updated JSON spec (same schema as before).`;

export const BOM_GENERATION_PROMPT = `Generate a production-grade Bill of Materials (BOM) for this hardware project.

Project Description: {description}
Identified Components: {components}
Additional Requirements: {requirements}
Pricing Context: {pricingContext}

Output ONLY a Markdown table (no prose, no headings, no extra commentary).
The table MUST include this exact header and separator row:
| Item | MPN | Manufacturer | Description | Qty | Unit Price (USD) | Ext Price (USD) | Supplier | Supplier SKU | Link | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Rules:
- One part per row (no wrapped/multi-line rows).
- Use "-" for unknown fields.
- Ext Price = Qty * Unit Price (USD).
- Use a single Markdown link in the Link column: [Link](https://...)
- Add a final TOTAL row with Item="TOTAL" and the Ext Price sum.

Include:
- All electronic components (ICs, resistors, capacitors, connectors)
- Mechanical parts (enclosure, fasteners, standoffs)
- Power components (battery, charging circuit, regulators)
- Optional enhancements (mark in Notes)

Provide:
- At least one alternative for expensive components (as a separate row)
- Notes about lead times or substitutions in the Notes column`;

export const ASSEMBLY_INSTRUCTIONS_PROMPT = `Create comprehensive assembly instructions for this hardware project.

Project: {description}
Components (BOM): {bom}
Target Audience: Hobbyist/Maker with basic soldering skills

Structure the instructions as:

## Overview
Brief description and expected build time

## Tools Required
- Soldering equipment
- Multimeter
- Any specialized tools

## Safety Warnings
Important safety considerations

## Step-by-Step Assembly

### Step 1: PCB Preparation
[Details]

### Step 2: SMD Component Installation
[If applicable]

### Step 3: Through-Hole Components
[Details with tips]

### Step 4: Wiring and Connections
[Details]

### Step 5: Enclosure Assembly
[3D printing and mechanical assembly]

### Step 6: Testing
[How to verify the build works]

## Troubleshooting
Common issues and solutions

Include helpful tips, warnings about common mistakes, and testing checkpoints.`;

export const FIRMWARE_GENERATION_PROMPT = `Generate complete, well-documented firmware code for this hardware project.

Project: {description}
Microcontroller: {mcu}
Components: {components}
Features Required: {features}

Create Arduino-compatible code that includes:

1. **Header Comments**: Project name, description, pin assignments, author
2. **Library Includes**: All required libraries with install instructions
3. **Pin Definitions**: Clear #define statements for all pins
4. **Configuration**: Adjustable parameters at the top
5. **Setup Function**: Initialize all peripherals
6. **Main Loop**: Core functionality with comments
7. **Helper Functions**: Well-organized utility functions
8. **Error Handling**: Basic error detection and feedback

The code should:
- Compile without errors
- Include detailed comments explaining each section
- Follow Arduino style guidelines
- Be beginner-friendly with clear variable names
- Include power-saving techniques where applicable`;

export const CHAT_REFINEMENT_PROMPT = `You are helping refine a hardware design through conversation.

Current Project Context:
- Description: {description}
- Analysis: {analysis}
- Generated Outputs: {outputs}

User's Question/Request: {message}

Provide helpful, specific answers. If the user wants to modify the design:
1. Explain the implications of the change
2. Suggest how to update relevant sections (BOM, assembly, firmware)
3. Highlight any new components or modifications needed

If you need to update any outputs (BOM, assembly, firmware), indicate this clearly.
Be conversational but technically accurate.`;

export const OPENSCAD_GENERATION_PROMPT = `Generate OpenSCAD code for a 3D-printable enclosure based on this hardware project.

Project: {description}
Components: {components}
Features: {features}
Dimensions Hint: {dimensions}

Create parametric OpenSCAD code that:
1. **Enclosure Body**: A box with rounded corners to house the electronics
2. **Component Cutouts**: Holes for buttons, displays, connectors, LEDs
3. **Mounting Posts**: Internal posts for PCB mounting (M3 screw holes)
4. **Ventilation**: Optional ventilation slots if heat-generating components present
5. **Lid**: A snap-fit or screw-on lid
6. **Production Aesthetics**: Chamfers/fillets, consistent wall thickness, clean seams, no razor-sharp edges

Requirements:
- Use \`$fn=32\` for smooth curves
- All dimensions in millimeters
- Add 2mm wall thickness by default
- Include comments explaining each section
- Make key dimensions as variables at the top for easy customization
- The code MUST be valid OpenSCAD that compiles without errors

Output ONLY the OpenSCAD code, no explanations. Start with // Project: {description}`;

export const OPENSCAD_OBJECT_PROMPT = `Generate OpenSCAD code for a 3D-printable model of the described object (NOT an electronics enclosure).

Project: {description}
Style/Notes: {features}
Size Hint: {dimensions}

Goals:
1. Create a recognizable, smooth silhouette using simple primitives (sphere/cylinder) and hull() for organic blends.
2. Keep the model watertight (single solid union).
3. Use parametric variables at the top (overall size, proportions).
4. Center the model around the origin in X/Y, and rest it on the build plate (Z=0).
5. “Production-grade” look: rounded forms, consistent proportions, no extreme thin parts.

Requirements:
- Use \`$fn=64\` for smooth curves
- Units are millimeters
- The code MUST be valid OpenSCAD that compiles without errors

Output ONLY the OpenSCAD code, no explanations. Start with // Project: {description}`;

export const SCENE_GENERATION_PROMPT = `Generate a JSON object describing a 3D scene for this object.

Project: {description}
Components: {components}
Features: {features}

Return JSON with this shape:
{
  "elements": [
    {
      "type": "rounded-box",
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "dimensions": [10, 2, 10],
      "radius": 2,
      "smoothness": 8,
      "color": "#333333",
      "material": "plastic",
      "name": "base"
    }
  ]
}

Rules:
- Make this look like a **production-grade product render** (clean enclosure + lid, coherent proportions).
- Center the main enclosure around [0,0,0].
- Use millimeters (approximate scale).
- "dimensions" must be:
  - rounded-box: [width, height, depth] plus optional "radius" and "smoothness"
  - box: [width, height, depth]
  - cylinder: [radius, height, 0]
  - sphere: [radius, 0, 0]
  - capsule: [radius, length, 0]
- Prefer a **white/grey palette** for the enclosure (avoid near-black plastics).
- Avoid floating pieces: every element should be on/inside the enclosure unless it is a screw/button.
- Use minimal rotations (prefer [0,0,0] unless necessary).
- Use "material" ("plastic", "metal", "glass", "rubber") for rendering hints.
- Output ONLY valid JSON (no markdown, no code fences, no comments).`;

export const SCENE_OBJECT_PROMPT = `Generate a JSON object describing a 3D scene for the described object.

Project: {description}
Notes: {features}

CRITICAL: This is an ORGANIC / NON-ENCLOSURE object (toy, figurine, animal, character, sculpture, etc.), NOT an electronics enclosure.
You MUST build its shape primarily from SPHERES, CAPSULES, and CYLINDERS. Prefer sphere and capsule for rounded/organic forms. Avoid boxes for organic shapes.

Modeling guidelines:
- Decompose the object into its natural anatomical or structural parts (e.g. body, head, limbs, facial features, accessories).
- Use CAPSULE for elongated rounded parts (torso, limbs, tails).
- Use SPHERE for compact rounded parts (head, eyes, nose, ears, joints).
- Use CYLINDER only for truly cylindrical parts (wheels, pipes, horns).
- Aim for 8-15 elements for a detailed, recognizable silhouette.
- Choose colors that match the object's real-world appearance. Use distinct colors for different parts.
- Scale to millimeters (typical hand-sized object: 100-200mm tall).
- Center the main body around [0, 0, 0].
- Ensure no floating parts — every element should connect to or overlap with a neighbor.

Return JSON with this shape:
{
  "elements": [
    {"type": "capsule", "position": [0, 0, 0], "dimensions": [35, 80, 0], "color": "#8B4513", "material": "plastic", "name": "body"},
    {"type": "sphere", "position": [0, 75, 0], "dimensions": [45, 0, 0], "color": "#A0522D", "material": "plastic", "name": "head"}
  ]
}

Rules:
- "dimensions" must be:
  - sphere: [radius, 0, 0]
  - capsule: [radius, length, 0]
  - cylinder: [radius, height, 0]
- Use ONLY sphere, capsule, and cylinder types for organic objects. NEVER use "box" or "rounded-box".
- Include "name" for every element describing what body/structural part it represents.
- Use "material" ("plastic", "metal", "rubber", "glass") for rendering hints.
- Use minimal rotations (prefer [0,0,0] unless necessary to angle a limb or feature).
- Output ONLY valid JSON (no markdown, no code fences, no comments).`;

export const SCHEMATIC_SVG_PROMPT = `You are generating a clean electronics schematic as SVG.

Project: {description}
Components: {components}
Features: {features}

Requirements:
- Output ONLY valid SVG (no markdown, no code fences, no explanations).
- White background, black lines, minimal color accents (labels in #111).
- Use simple symbols: rectangles for ICs, zig-zag lines for resistors, parallel lines for capacitors.
- Show clear labels and net names.
- Keep aspect ratio ~700x420.

The SVG MUST start with: <svg ...> and end with </svg>.`;
export const SAFETY_REVIEW_PROMPT = `Perform a comprehensive safety review of this hardware design (ISO 12100 / IEC 62368 standards).

Project: {description}
BOM Components: {bom}

Analyze for the following hazards:
1. **Mechanical**: Sharp edges, pinch points, structural weakness (3D print orientation).
2. **Electrical**: Battery risks (LiPo/Li-Ion), exposed voltage, lack of fusing/protection.
3. **Thermal**: Heat dissipation issues, flammable materials (PLA vs ABS/PETG).
4. **Chemical/Material**: Toxic materials, food safety issues (if applicable), UV degradation.
5. **Child Safety**: Small parts (choking hazard <3y), battery accessibility (coin cells).

Output a STRUCTURED MARKDOWN report:

# Safety Compliance Report

## Passed Checks
- [List safe aspects]

## Warnings (Low/Medium Risk)
- [List potential issues with mitigation suggestions]

## Critical Failures (High Risk)
- [List immediate dangers that MUST be fixed]

## Recommended Actions
- [Bullet points for specific fixes]

If no critical errors are found, mark the Status as PASSED. If critical errors exist, mark as FAILED.`;



// ============================================================================
// SUSTAINABILITY ANALYSIS AGENT
// ============================================================================
export const SUSTAINABILITY_ANALYSIS_PROMPT = `You are an Environmental Impact Analyst specializing in product lifecycle assessment (ISO 14040/14044).

Project: {description}
BOM Components: {bom}
3D Model Volume Estimate: {volumeEstimate}

Perform a comprehensive sustainability analysis:

## 1. Material Impact Assessment
For each material in the BOM:
- Estimate embodied carbon (kg CO2e per kg material)
- Calculate total carbon footprint
- Rate recyclability (A-F)

Material Reference Data:
- PLA: ~2.5 kg CO2e/kg, biodegradable, grade A
- ABS: ~3.8 kg CO2e/kg, recyclable #7, grade C
- PETG: ~3.2 kg CO2e/kg, recyclable #1, grade B
- Aluminum: ~8.1 kg CO2e/kg, highly recyclable, grade A
- Steel: ~1.8 kg CO2e/kg, recyclable, grade A
- FR4 PCB: ~5.2 kg CO2e/kg, difficult to recycle, grade D
- Lithium battery: ~12 kg CO2e/kg, hazardous waste, grade F

## 2. Eco-Friendly Alternatives
Suggest lower-impact alternatives for high-carbon components.

## 3. End-of-Life Analysis
- Disassembly complexity (easy/moderate/difficult)
- Recyclable percentage
- Hazardous materials present

Output a STRUCTURED MARKDOWN report:

# Sustainability Report

## Overall Grade: [A-F]
**Total Carbon Footprint:** X.X kg CO2e

## Material Breakdown
| Material | Mass (g) | CO2e (kg) | Recyclability | Notes |
|----------|----------|-----------|---------------|-------|
| ... | ... | ... | ... | ... |

## Eco Alternatives
- [Suggestions to reduce impact]

## End-of-Life Recommendations
- [Recycling guidance]`;


// ============================================================================
// COST OPTIMIZATION AGENT
// ============================================================================
export const COST_OPTIMIZATION_PROMPT = `You are a Supply Chain Cost Engineer specializing in hardware BOM optimization.

Project: {description}
Current BOM: {bom}

Analyze the BOM and identify cost reduction opportunities:

## 1. Component-Level Analysis
For each expensive component (>$5):
- Find functionally equivalent alternatives
- Compare specs vs. cost tradeoff
- Identify bulk pricing breakpoints

## 2. Supplier Optimization
- Suggest alternative suppliers (LCSC, AliExpress, direct from manufacturer)
- Identify components that could be consolidated

## 3. Design-for-Cost Suggestions
- Components that could be eliminated with design changes
- Standard vs. custom part opportunities

Output a STRUCTURED MARKDOWN report:

# Cost Optimization Report

## Summary
**Current Estimated Cost:** [calculated from BOM]
**Optimized Estimated Cost:** [after applying suggestions]
**Potential Savings:** [amount] ([percentage]%)

## High-Impact Opportunities
| Current Part | Cost | Alternative | New Cost | Savings | Notes |
|--------------|------|-------------|----------|---------|-------|
| ... | ... | ... | ... | ... | ... |

## Bulk Pricing Opportunities
- [List MOQ breakpoints]

## Design Simplification Ideas
- [Suggestions to reduce part count]

## Quality Tradeoffs
- [Warnings about any quality compromises]`;


// ============================================================================
// DESIGN FOR MANUFACTURING (DFM) AGENT
// ============================================================================
export const DFM_ANALYSIS_PROMPT = `You are a Manufacturing Engineer specializing in Design for Manufacturing (DFM) and Design for Assembly (DFA).

Project: {description}
3D Model Description: {sceneDescription}
Target Manufacturing Methods: 3D Printing (FDM/SLA), Injection Molding, CNC

Analyze the design for manufacturability issues:

## 1. 3D Printing (FDM) Analysis
- Overhang angles (flag >45° without support)
- Wall thickness (minimum 1.2mm for FDM)
- Bridging distances (max 10mm without sag)
- Orientation recommendations

## 2. 3D Printing (SLA/Resin) Analysis
- Suction cups / hollow cavities (need drain holes)
- Minimum feature size (0.3mm)
- Support removal accessibility

## 3. Injection Molding Readiness
- Draft angles (minimum 1-2° for ejection)
- Uniform wall thickness (2-4mm ideal)
- Undercuts requiring side actions
- Gate location suggestions

## 4. Assembly Considerations
- Snap-fit feasibility
- Screw boss design
- Alignment features

Output a STRUCTURED MARKDOWN report:

# DFM Analysis Report

## Manufacturing Readiness Score: [1-10]

## 3D Printing (FDM)
### Good
- [Positive aspects]

### Warnings
- [Issues that will work but need attention]

### Critical Issues
- [Must fix before printing]

## Injection Molding Readiness
- Draft angles: [OK/NEEDS WORK]
- Wall uniformity: [OK/NEEDS WORK]
- Undercuts: [None/Fixable/Complex tooling required]

## Recommended Design Changes
| Issue | Location | Suggested Fix | Priority |
|-------|----------|---------------|----------|
| ... | ... | ... | High/Medium/Low |`;


// ============================================================================
// MARKETING & BRANDING AGENT
// ============================================================================
export const MARKETING_GENERATION_PROMPT = `You are a Product Marketing Specialist with expertise in hardware crowdfunding campaigns (Kickstarter, Indiegogo).

Project: {description}
Key Features: {features}
Target Audience: Makers, hobbyists, tech enthusiasts

Create compelling marketing content:

## 1. Product Naming
- Generate 3 creative product names
- Include tagline for each

## 2. Elevator Pitch
- 30-second description
- Hook + Problem + Solution + Call-to-action

## 3. Feature Highlights
- Transform technical specs into benefits
- Create "Why it matters" explanations

## 4. Crowdfunding Campaign Copy
- Headline
- Subheadline
- Key selling points (bullet format)
- Social proof suggestions

Output a STRUCTURED MARKDOWN report:

# Marketing Brief

## Product Name Options
1. **[Name 1]** — "[Tagline 1]"
2. **[Name 2]** — "[Tagline 2]"
3. **[Name 3]** — "[Tagline 3]"

## Elevator Pitch
> [30-second pitch in quotes]

## Feature -> Benefit Translation
| Technical Feature | Customer Benefit |
|-------------------|------------------|
| ... | ... |

## Crowdfunding Campaign Copy

### Headline
**[Attention-grabbing headline]**

### Subheadline
[Supporting statement]

### Key Selling Points
- [Point 1]
- [Point 2]
- [Point 3]

## Visual Suggestions
- [Ideas for product photos/renders]`;


// ============================================================================
// PATENT & IP RISK AGENT
// ============================================================================
export const PATENT_RISK_PROMPT = `You are an Intellectual Property Analyst specializing in hardware patents and prior art research.

Project: {description}
Key Components: {components}
Novel Features: {features}

Perform a preliminary IP risk assessment:

## 1. Novel Feature Identification
- List potentially patentable aspects
- Identify commodity/standard components (no IP concern)

## 2. Prior Art Keywords
- Generate search terms for patent databases (Google Patents, USPTO, Espacenet)
- Suggest classification codes (CPC/IPC)

## 3. Risk Assessment
- Flag features that are commonly patented in this domain
- Identify "patent thicket" areas to be cautious about

## 4. Freedom-to-Operate Considerations
- Known patent holders in this space
- Suggestions for design-arounds

**DISCLAIMER:** This is a preliminary heuristic analysis, NOT legal advice. Consult a patent attorney for actual FTO opinions.

Output a STRUCTURED MARKDOWN report:

# Patent & IP Risk Assessment

> **Disclaimer:** This is an AI-generated preliminary analysis, not legal advice.

## Risk Level: [LOW / MEDIUM / HIGH]

## Novel Features Identified
| Feature | Patentability | Risk Level | Notes |
|---------|---------------|------------|-------|
| ... | High/Medium/Low | Low/Medium/High | ... |

## Prior Art Search Keywords
- "[keyword 1]"
- "[keyword 2]"
- "[keyword 3]"

**Suggested Patent Classifications:**
- [CPC/IPC codes]

## Areas of Concern
- [Known patent-heavy areas]

## Design-Around Suggestions
- [Ways to reduce IP risk]

## Next Steps
1. Search Google Patents with keywords above
2. Review top 5-10 results for relevance
3. Consult IP attorney if pursuing commercial use`;



// Helper function to fill in template variables
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{${escaped}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Strip code-fence wrappers (```json ... ```, ```scad ... ```, etc.)
 * from LLM responses, returning the inner content.
 */
export function stripCodeFences(text: string): string {
    const match = text.match(/```(?:json|scad|openscad)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
}
