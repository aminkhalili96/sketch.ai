import { sceneElementSchema } from '@/shared/schemas/validators';
import { z } from 'zod';

type SceneElement = z.infer<typeof sceneElementSchema>;

// Colors extracted from the image
const COLORS = {
    WHITE_SHELL: '#E8E8E8',
    DARK_GRAY_MECHANICAL: '#333333',
    SILVER_METAL: '#A0A0A0',
    YELLOW_ACCENT: '#F59E0B',
    BLUE_THRUSTER: '#3B82F6',
    BLACK_JOINT: '#1A1A1A',
    GLASS_CANOPY: '#111827',
    SENSOR_EYE: '#0EA5E9',
};

// Helper to create a basic element
function el(
    type: SceneElement['type'],
    pos: [number, number, number],
    dim: [number, number, number],
    color: string,
    opts: Partial<SceneElement> = {}
): SceneElement {
    return {
        type,
        position: pos,
        dimensions: dim,
        color,
        rotation: [0, 0, 0],
        material: 'plastic',
        ...opts,
    } as SceneElement;
}

// ------------------------------------------------------------------
// COMPONENT BUILDERS
// ------------------------------------------------------------------

function createThruster(offsetX: number, offsetY: number, offsetZ: number): SceneElement[] {
    const parts: SceneElement[] = [];

    // Thruster mount (dark gray box)
    parts.push(el('box', [offsetX, offsetY, offsetZ], [4, 6, 8], COLORS.DARK_GRAY_MECHANICAL, {
        material: 'metal', name: 'thruster-mount'
    }));

    // Main nozzle body
    parts.push(el('cylinder', [offsetX, offsetY, offsetZ - 6], [2.5, 6, 0], COLORS.SILVER_METAL, {
        rotation: [Math.PI / 2, 0, 0], material: 'metal', name: 'thruster-nozzle'
    }));

    // Inner glow (emissive cone inside)
    parts.push(el('cone', [offsetX, offsetY, offsetZ - 7], [1.5, 4, 0], COLORS.BLUE_THRUSTER, {
        rotation: [-Math.PI / 2, 0, 0],
        material: 'emissive',
        emissiveColor: COLORS.BLUE_THRUSTER,
        emissiveIntensity: 3,
        name: 'thruster-glow'
    }));

    // Flame trail (translucent cone)
    parts.push(el('cone', [offsetX, offsetY, offsetZ - 14], [2, 12, 0], '#60A5FA', {
        rotation: [-Math.PI / 2, 0, 0],
        material: 'emissive',
        opacity: 0.6,
        emissiveIntensity: 1,
        name: 'thruster-flame'
    }));

    return parts;
}

function createLeg(side: 'left' | 'right'): SceneElement[] {
    const isLeft = side === 'left';
    const xMult = isLeft ? -1 : 1; // Left is negative X

    const parts: SceneElement[] = [];

    // Hip Joint (Sphere + Torus mechanism)
    const hipPos: [number, number, number] = [18 * xMult, 5, 0];

    parts.push(el('sphere', hipPos, [6, 0, 0], COLORS.DARK_GRAY_MECHANICAL, {
        material: 'metal', name: `leg-${side}-hip`
    }));

    // Torus ring around hip
    parts.push(el('torus', hipPos, [7, 1.5, 0], COLORS.YELLOW_ACCENT, {
        rotation: [0, Math.PI / 2, 0],
        material: 'metal',
        name: `leg-${side}-hip-ring`
    }));

    // Thigh (Upper Leg) - Angled backwards slightly
    // Starting from hip, going down and back
    const thighCenter: [number, number, number] = [
        hipPos[0] + (3 * xMult),
        hipPos[1] - 8,
        hipPos[2] + 4
    ];

    // Thigh capsule
    parts.push(el('capsule', thighCenter, [3, 16, 0], COLORS.SILVER_METAL, {
        rotation: [-0.5, 0, 0.2 * xMult],
        material: 'metal',
        name: `leg-${side}-thigh`
    }));

    // Knee Joint
    const kneePos: [number, number, number] = [
        thighCenter[0] + (2 * xMult),
        thighCenter[1] - 10,
        thighCenter[2] + 6
    ];

    parts.push(el('cylinder', kneePos, [4, 6, 0], COLORS.YELLOW_ACCENT, {
        rotation: [0, 0, Math.PI / 2], // Horizontal joint
        material: 'plastic',
        name: `leg-${side}-knee`
    }));

    // Shin (Lower Leg) - Angled forward significantly (chicken leg)
    const shinCenter: [number, number, number] = [
        kneePos[0],
        kneePos[1] - 12,
        kneePos[2] - 4
    ];

    // Main shin strut
    parts.push(el('rounded-box', shinCenter, [4, 20, 4], COLORS.YELLOW_ACCENT, {
        rotation: [0.6, 0, 0], // Tilted forward
        radius: 1,
        name: `leg-${side}-shin-main`
    }));

    // Hydraulic piston details on shin
    parts.push(el('cylinder', [shinCenter[0], shinCenter[1] + 2, shinCenter[2] - 3], [1, 12, 0], COLORS.SILVER_METAL, {
        rotation: [0.6, 0, 0],
        material: 'metal',
        name: `leg-${side}-piston`
    }));

    // Ankle
    const anklePos: [number, number, number] = [
        shinCenter[0],
        shinCenter[1] - 12,
        shinCenter[2] - 10
    ];

    parts.push(el('sphere', anklePos, [3.5, 0, 0], COLORS.DARK_GRAY_MECHANICAL, {
        material: 'metal',
        name: `leg-${side}-ankle`
    }));

    // Foot / Claw
    // Front toe (Long)
    parts.push(el('cone', [anklePos[0], anklePos[1] - 4, anklePos[2] + 4], [2, 10, 0], COLORS.YELLOW_ACCENT, {
        rotation: [Math.PI / 3, 0, 0], // Pointing down/forward
        name: `leg-${side}-toe-front`
    }));

    // Back toe (Short support)
    parts.push(el('cone', [anklePos[0], anklePos[1] - 4, anklePos[2] - 4], [1.5, 6, 0], COLORS.DARK_GRAY_MECHANICAL, {
        rotation: [-Math.PI / 4, 0, 0], // Pointing back
        name: `leg-${side}-toe-back`
    }));

    return parts;
}

function createBody(): SceneElement[] {
    const parts: SceneElement[] = [];

    // Main central hull (rounded box)
    const bodyCenter: [number, number, number] = [0, 15, 0];
    parts.push(el('rounded-box', bodyCenter, [26, 24, 30], COLORS.WHITE_SHELL, {
        radius: 8,
        smoothness: 12,
        name: 'body-core'
    }));

    // Top shell (Upper cowling) - White with yellow trim
    parts.push(el('rounded-box', [0, 26, 2], [24, 8, 26], COLORS.WHITE_SHELL, {
        radius: 4,
        name: 'body-top-cowl'
    }));

    // Yellow stripe on top
    parts.push(el('rounded-box', [0, 25, 12], [28, 4, 12], COLORS.YELLOW_ACCENT, {
        radius: 2,
        name: 'body-top-accent'
    }));

    // Cockpit Window (Front dark glass area)
    // Complex shape approximated by a large dark sphere protruding from front
    parts.push(el('sphere', [0, 16, 14], [11, 0, 0], COLORS.GLASS_CANOPY, {
        material: 'glass',
        opacity: 0.9,
        rotation: [0.2, 0, 0],
        name: 'cockpit-glass'
    }));

    // Cockpit Frame (Silver rim around glass)
    parts.push(el('torus', [0, 16, 13], [11.5, 1.5, 0], COLORS.SILVER_METAL, {
        rotation: [0, 0, 0], // Facing Z roughly
        name: 'cockpit-frame'
    }));

    // Front/Face armor plate (Lower jaw)
    parts.push(el('rounded-box', [0, 8, 16], [18, 10, 6], COLORS.WHITE_SHELL, {
        radius: 3,
        rotation: [-0.3, 0, 0],
        name: 'face-plate'
    }));

    // "Eye" Sensor - vertical slit on face plate
    parts.push(el('capsule', [0, 8, 19.5], [1, 6, 0], COLORS.SENSOR_EYE, {
        rotation: [0, 0, Math.PI / 2],
        material: 'emissive',
        emissiveIntensity: 2,
        name: 'sensor-eye'
    }));

    // Side intakes / armor panels
    [-1, 1].forEach(side => {
        parts.push(el('rounded-box', [14 * side, 16, 5], [6, 14, 18], COLORS.DARK_GRAY_MECHANICAL, {
            radius: 2,
            name: `side-panel-${side}`
        }));

        // Vent detail
        parts.push(el('plane', [17.1 * side, 16, 5], [1, 0, 10], '#000000', {
            rotation: [0, 0, Math.PI / 2],
            name: `side-vent-${side}`
        }));
    });

    // Antennae (Two long thin ones on top)
    [-1, 1].forEach(side => {
        // Base
        parts.push(el('sphere', [6 * side, 29, -5], [2, 0, 0], COLORS.DARK_GRAY_MECHANICAL, {
            name: `antenna-base-${side}`
        }));
        // Shaft (tilted back)
        parts.push(el('cylinder', [6 * side, 40, -10], [0.3, 24, 0], COLORS.SILVER_METAL, {
            rotation: [-0.4, 0, 0.1 * side],
            name: `antenna-shaft-${side}`
        }));
    });

    // Back engine block
    parts.push(el('rounded-box', [0, 16, -16], [20, 18, 8], COLORS.DARK_GRAY_MECHANICAL, {
        radius: 2,
        name: 'engine-block'
    }));

    return parts;
}


// ------------------------------------------------------------------
// MAIN ASSEMBLY
// ------------------------------------------------------------------
export function getDetailedRobotScene(): SceneElement[] {
    const scene: SceneElement[] = [];

    // 1. Body
    scene.push(...createBody());

    // 2. Legs
    scene.push(...createLeg('left'));
    scene.push(...createLeg('right'));

    // 3. Thrusters (Array of 3 on each side at the back)
    // Left side thrusters
    scene.push(...createThruster(-8, 12, -20));
    // Right side thrusters
    scene.push(...createThruster(8, 12, -20));

    // 4. Extra Greebling (Pipes, wires)
    // Flex pipes connecting back to hips
    [-1, 1].forEach(side => {
        // Simple pipe approximation using torus segments would be complex, 
        // just using a small bent cylinder (rotated capsule)
        const bendPos: [number, number, number] = [10 * side, 8, -5];
        scene.push(el('torus', bendPos, [6, 1, 0], COLORS.SILVER_METAL, {
            rotation: [0, Math.PI / 2, 0],
            name: `hip-pipe-${side}`
        }));
    });

    return scene;
}
