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

export const BOM_GENERATION_PROMPT = `Generate a complete Bill of Materials for this hardware project.

Project Description: {description}
Identified Components: {components}
Additional Requirements: {requirements}

Create a detailed Markdown table with these columns:
| Item | Part Number | Description | Qty | Unit Price (USD) | Supplier | Purchase Link | Notes |

Include:
- All electronic components (ICs, resistors, capacitors, connectors)
- Mechanical parts (enclosure, fasteners, standoffs)
- Power components (battery, charging circuit, regulators)
- Optional enhancements (clearly marked as optional)

Provide:
- At least one alternative for expensive components
- Total estimated cost at the bottom
- Notes about lead times for specialty components
- Links to datasheets for key ICs`;

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

CRITICAL: This is an ORGANIC OBJECT (toy, plush, character, animal), NOT an electronics enclosure.
You MUST use SPHERES and CAPSULES to build the shape. Do NOT use boxes for organic shapes.

For a teddy bear or plush toy, YOU MUST CREATE ALL THESE ELEMENTS:
1. BODY: Large CAPSULE (radius ~35mm, length ~80mm) - main torso, color #8B4513
2. HEAD: SPHERE (radius ~45mm) above body - color #A0522D
3. LEFT EAR: Small SPHERE (radius ~15mm) on top-left of head - color #8B4513
4. RIGHT EAR: Small SPHERE (radius ~15mm) on top-right of head - color #8B4513
5. MUZZLE: SPHERE (radius ~18mm) on front of head - cream color #F5DEB3
6. LEFT EYE: Tiny SPHERE (radius ~6mm) on front of head, left side - black #1A1A1A
7. RIGHT EYE: Tiny SPHERE (radius ~6mm) on front of head, right side - black #1A1A1A
8. NOSE: Tiny SPHERE (radius ~5mm) on muzzle - dark #2D2D2D
9. LEFT ARM: CAPSULE (radius ~12mm, length ~50mm) angled from body - color #A0522D
10. RIGHT ARM: CAPSULE (radius ~12mm, length ~50mm) angled from body - color #A0522D
11. LEFT LEG: CAPSULE (radius ~15mm, length ~55mm) below body - color #8B4513
12. RIGHT LEG: CAPSULE (radius ~15mm, length ~55mm) below body - color #8B4513

Return JSON with elements array containing ALL 12 body parts:
{
  "elements": [
    {"type": "capsule", "position": [0, 0, 0], "dimensions": [35, 80, 0], "color": "#8B4513", "material": "plastic", "name": "body"},
    {"type": "sphere", "position": [0, 75, 0], "dimensions": [45, 0, 0], "color": "#A0522D", "material": "plastic", "name": "head"},
    {"type": "sphere", "position": [-25, 105, 0], "dimensions": [15, 0, 0], "color": "#8B4513", "material": "plastic", "name": "ear-left"},
    {"type": "sphere", "position": [25, 105, 0], "dimensions": [15, 0, 0], "color": "#8B4513", "material": "plastic", "name": "ear-right"},
    {"type": "sphere", "position": [0, 70, 30], "dimensions": [18, 0, 0], "color": "#F5DEB3", "material": "plastic", "name": "muzzle"},
    {"type": "sphere", "position": [-15, 80, 38], "dimensions": [6, 0, 0], "color": "#1A1A1A", "material": "plastic", "name": "eye-left"},
    {"type": "sphere", "position": [15, 80, 38], "dimensions": [6, 0, 0], "color": "#1A1A1A", "material": "plastic", "name": "eye-right"},
    {"type": "sphere", "position": [0, 68, 42], "dimensions": [5, 0, 0], "color": "#2D2D2D", "material": "plastic", "name": "nose"},
    {"type": "capsule", "position": [-50, 15, 0], "rotation": [0, 0, -0.4], "dimensions": [12, 50, 0], "color": "#A0522D", "material": "plastic", "name": "arm-left"},
    {"type": "capsule", "position": [50, 15, 0], "rotation": [0, 0, 0.4], "dimensions": [12, 50, 0], "color": "#A0522D", "material": "plastic", "name": "arm-right"},
    {"type": "capsule", "position": [-18, -55, 0], "dimensions": [15, 55, 0], "color": "#8B4513", "material": "plastic", "name": "leg-left"},
    {"type": "capsule", "position": [18, -55, 0], "dimensions": [15, 55, 0], "color": "#8B4513", "material": "plastic", "name": "leg-right"}
  ]
}

Rules:
- YOU MUST INCLUDE ALL 12 ELEMENTS (body, head, 2 ears, muzzle, 2 eyes, nose, 2 arms, 2 legs)
- Use ONLY sphere and capsule types
- NEVER use "box" or "rounded-box" for stuffed animals
- Use brown colors (#8B4513, #A0522D) for body/limbs, cream (#F5DEB3) for muzzle, black (#1A1A1A) for eyes
- Center the body around [0, 0, 0]
- Use millimeters scale (typical plush toy: 150-200mm tall)
- Include at least: body, head, 2 ears, muzzle, 2 arms, 2 legs (9+ elements)
- Output ONLY valid JSON (no markdown, no code fences, no comments).`;




// Helper function to fill in template variables
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
