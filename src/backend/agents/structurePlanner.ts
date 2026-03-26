// Structure Planner Agent - Plans 3D structure based on vision analysis
import { getLLMClient, getModelName, isOfflineMode, recordChatError, recordChatUsage } from '@/backend/ai/openai';
import { SYSTEM_PROMPT } from '@/backend/ai/prompts';
import { getDetailedRobotScene } from '@/shared/domain/samples/detailedRobot';
import type { VisionAnalysis } from './visionAnalyzer';

export interface StructurePlan {
  elements: Array<{
    id?: string;
    name?: string;
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule' | 'cone' | 'torus' | 'plane' | 'half-sphere';
    position: [number, number, number];
    rotation?: [number, number, number];
    dimensions: [number, number, number];
    color?: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber' | 'emissive' | 'flat';
    parent?: string;
    opacity?: number;
    emissiveColor?: string;
    emissiveIntensity?: number;
    layer?: 'shell' | 'internal' | 'pcb' | 'detail' | 'label';
    group?: string;
  }>;
  reasoning: string;
}

const STRUCTURE_PLANNER_PROMPT = `You are an expert 3D Structural Engineer building enterprise-grade product models.
Your goal is to build a DETAILED 3D model that EXACTLY matches the provided Structural Blueprint — including INTERNAL components visible in exploded/x-ray views.

Vision Analysis & Blueprint:
{visionAnalysis}

Project Description: {description}

## UNIVERSAL CONSTRUCTION PROTOCOL
Follow these phases recursively to build ANY object:

PHASE 1: THE SHELL (External)
- Identify the outer enclosure/housing.
- Place the main body at [0, 0, 0]. Tag with layer: "shell".
- Use realistic product colors (see COLOR RULES below).
- Add separate top/bottom shell halves for products that can be opened.

PHASE 2: ATTACHMENTS (Skeleton)
- Attach major external features to the shell: buttons, ports, grilles, displays.
- Tag with layer: "detail".
- Calculate positions based on shell dimensions.
- Ensure parts OVERLAP slightly to form a solid object.

PHASE 3: PCB & ELECTRONICS (Internal)
- Every electronic product MUST include internal components:
  - PCB board: plane shape, green (#2D5016), layer: "pcb", group: "main-pcb"
  - IC chips: small dark boxes (#1A1A1A) on PCB surface, material: "metal", layer: "internal"
  - Connectors (USB/barrel jack): cylinders at port locations, material: "metal", layer: "internal"
  - Battery: rounded-box, dark gray (#3A3A3A), layer: "internal", group: "power"
  - LEDs: half-sphere, material: "emissive", layer: "internal"
  - Sensors: small cylinders or spheres, layer: "internal"
- Non-electronic products: add internal structure (springs, gears, motors as cylinders/torus shapes).

PHASE 4: SURFACE DETAILS (Polish)
- Add surface labels as plane shapes, layer: "label"
- Add indicator LEDs as small emissive half-spheres
- Add screws/fasteners as tiny cylinders, material: "metal", layer: "detail"

## COLOR RULES BY PRODUCT CATEGORY
- Consumer electronics (speakers, webcams, IoT): White/silver shell (#F5F5F0/#E8E8E8), dark PCB (#2D5016), black chips (#1A1A1A), colored accent LED
- Toys/figurines: Bright playful colors from reference, matte plastic
- Industrial tools: Safety yellow (#FFD700) + gunmetal gray (#4A4A4A) + rubber grips (#2A2A2A)
- Medical devices: Clean white (#FFFFFF) + teal accent (#008080) + stainless metal
- General: Use colors from the vision analysis; default to light gray shell (#E0E0E0)

## ELEMENT SPEC
Primitive shapes: box, rounded-box, cylinder, sphere, capsule, cone, torus, plane, half-sphere.
  - cone: tapered shapes (antenna tips, nozzles) — dimensions: [radius, height, 0]
  - torus: rings, handles, bezels, gaskets — dimensions: [outerRadius, tubeRadius, 0]
  - plane: flat panels, screens, PCBs, labels — dimensions: [width, 0, depth]
  - half-sphere: domes, sensor covers, LEDs — dimensions: [radius, 0, 0]
Dimensions in millimeters.
Materials: plastic (default), metal, glass, rubber, emissive (LEDs/screens).
Optional properties: opacity (0-1), emissiveColor, emissiveIntensity.

## LAYER ANNOTATION (Required)
Every element MUST have a "layer" field:
  - "shell": outer housing/enclosure parts
  - "pcb": circuit boards
  - "internal": chips, batteries, connectors, motors inside
  - "detail": buttons, ports, screws, external features
  - "label": surface text, logos, labels

## GROUP ANNOTATION (Optional)
Use "group" to cluster related elements (e.g. "main-pcb", "power", "display-module").

Return JSON:
{
  "elements": [
    {
      "id": "shell-top",
      "name": "Top Housing",
      "type": "rounded-box",
      "position": [0, 12, 0],
      "dimensions": [80, 20, 50],
      "color": "#F5F5F0",
      "material": "plastic",
      "layer": "shell",
      "radius": 4,
      "smoothness": 10
    },
    {
      "id": "main-pcb",
      "name": "Main Circuit Board",
      "type": "plane",
      "position": [0, 0, 0],
      "dimensions": [70, 0, 42],
      "color": "#2D5016",
      "material": "plastic",
      "layer": "pcb",
      "group": "main-pcb"
    },
    {
      "id": "cpu-chip",
      "name": "Main Processor",
      "type": "box",
      "position": [10, 2, 5],
      "dimensions": [12, 2.5, 12],
      "color": "#1A1A1A",
      "material": "metal",
      "layer": "internal",
      "group": "main-pcb"
    },
    {
      "id": "power-led",
      "name": "Power Indicator",
      "type": "half-sphere",
      "position": [35, 22, 20],
      "dimensions": [2, 0, 0],
      "color": "#00FF00",
      "material": "emissive",
      "emissiveColor": "#00FF00",
      "emissiveIntensity": 2,
      "layer": "detail"
    }
  ],
  "reasoning": "Built top/bottom shell halves. Added PCB at center with processor chip and memory. USB connector at back port..."
}

Output ONLY valid JSON.`;

export async function planStructure(
  visionAnalysis: VisionAnalysis,
  description: string,
  preferredModel?: string
): Promise<StructurePlan> {
  // SPECIAL DIRECT TRIGGER: If the user asks for the "exact robot" or "sample robot", bypass AI and return the high-fidelity manual model.
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('exact robot') || lowerDesc.includes('reference robot') || lowerDesc.includes('sample robot') || lowerDesc.includes('high fidelity') || lowerDesc.includes('detailed robot')) {
    const manualScene = getDetailedRobotScene();
    return {
      elements: manualScene,
      reasoning: "Generated high-fidelity structure using manual 'High-Density Primitive' construction to ensure exact likeness."
    };
  }

  const llmClient = getLLMClient();
  const modelName = getModelName('text', preferredModel);

  const prompt = STRUCTURE_PLANNER_PROMPT
    .replace('{visionAnalysis}', JSON.stringify(visionAnalysis, null, 2))
    .replace('{description}', description);

  try {
    const response = await llmClient.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      stream: false as const,
      ...(isOfflineMode() ? {} : { response_format: { type: 'json_object' as const } })
    });
    recordChatUsage(response, modelName, { source: 'agent:structure-planner' });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from structure planner');
    }

    // Parse JSON (handle markdown code blocks for local models)
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    const plan = JSON.parse(jsonContent) as StructurePlan;

    // Validate elements
    if (!Array.isArray(plan.elements) || plan.elements.length === 0) {
      throw new Error('Invalid structure plan: no elements');
    }

    return {
      elements: plan.elements.map((el, idx) => ({
        id: el.id || `element-${idx}`,
        name: el.name || `part-${idx}`,
        type: el.type || 'box',
        position: el.position || [0, 0, 0],
        rotation: el.rotation || [0, 0, 0],
        dimensions: el.dimensions || [10, 10, 10],
        color: el.color || '#808080',
        material: el.material || 'plastic'
      })),
      reasoning: plan.reasoning || 'Structure planned based on vision analysis'
    };
  } catch (error) {
    recordChatError(modelName, { source: 'agent:structure-planner' }, error as Error);
    console.error('Structure planning failed:', error);

    // Generate fallback based on vision analysis
    const dims = visionAnalysis.overallDimensions;
    const color = visionAnalysis.suggestedColors[0] || '#808080';

    return {
      elements: [
        {
          id: 'body',
          name: 'main-body',
          type: visionAnalysis.objectType === 'organic' ? 'capsule' : 'rounded-box',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          dimensions: [dims.width, dims.height, dims.depth],
          color,
          material: 'plastic'
        }
      ],
      reasoning: 'Fallback structure due to planning error'
    };
  }
}
