'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { RoundedBox, Stage, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { beautifyScene, normalizeSceneColors, parseSceneElements } from '@/lib/scene';

interface SceneElement {
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule';
    position: [number, number, number];
    rotation?: [number, number, number];
    dimensions: [number, number, number];
    color: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber';
    radius?: number;
    smoothness?: number;
}

interface SceneRendererProps {
    sceneJson: string;
    exploded?: boolean;
    explodeAmount?: number;
}

function SceneObject({ element }: { element: SceneElement }) {
    const { type, position, rotation, dimensions, color, material, radius, smoothness } = element;

    const materialProps: THREE.MeshPhysicalMaterialParameters = { color };
    const normalizedMaterial = material ?? 'plastic';

    if (normalizedMaterial === 'metal') {
        materialProps.metalness = 1;
        materialProps.roughness = 0.22;
        materialProps.envMapIntensity = 1.2;
    } else if (normalizedMaterial === 'glass') {
        materialProps.transparent = true;
        materialProps.opacity = 0.35;
        materialProps.roughness = 0.08;
        materialProps.transmission = 0.9;
        materialProps.ior = 1.45;
        materialProps.thickness = 1;
        materialProps.envMapIntensity = 1;
    } else if (normalizedMaterial === 'rubber') {
        materialProps.roughness = 0.9;
        materialProps.metalness = 0;
    } else {
        // Plastic
        materialProps.roughness = 0.35;
        materialProps.metalness = 0;
        materialProps.clearcoat = 0.25;
        materialProps.clearcoatRoughness = 0.6;
        materialProps.envMapIntensity = 0.8;
    }

    // Geometry Setup
    let geometry;
    switch (type) {
        case 'box':
            geometry = <boxGeometry args={dimensions} />;
            break;
        case 'rounded-box': {
            const defaultRadius = Math.max(1, Math.min(dimensions[0], dimensions[2]) * 0.08);
            const r = Math.min(defaultRadius, Math.max(0, radius ?? defaultRadius));
            const s = Math.max(1, Math.min(16, Math.round(smoothness ?? 8)));
            return (
                <RoundedBox
                    args={dimensions}
                    radius={r}
                    smoothness={s}
                    position={position}
                    rotation={rotation ? [rotation[0], rotation[1], rotation[2]] : [0, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <meshPhysicalMaterial {...materialProps} />
                </RoundedBox>
            );
        }
        case 'cylinder':
            // dimensions: [radius, height, ignored] -> three: [radiusTop, radiusBottom, height, radialSegments]
            geometry = <cylinderGeometry args={[dimensions[0], dimensions[0], dimensions[1], 32]} />;
            break;
        case 'sphere':
            geometry = <sphereGeometry args={[dimensions[0], 32, 32]} />;
            break;
        case 'capsule':
            geometry = <capsuleGeometry args={[dimensions[0], dimensions[1], 4, 8]} />;
            break;
        default:
            return null;
    }

    return (
        <mesh
            position={position}
            rotation={rotation ? [rotation[0], rotation[1], rotation[2]] : [0, 0, 0]}
            castShadow
            receiveShadow
        >
            {geometry}
            <meshPhysicalMaterial {...materialProps} />
        </mesh>
    );
}

export function SceneRenderer({ sceneJson, exploded = false, explodeAmount = 0.35 }: SceneRendererProps) {
    const parsed = useMemo(() => parseSceneElements(sceneJson), [sceneJson]);
    const elements = useMemo(
        () => (parsed ? (normalizeSceneColors(beautifyScene(parsed)) as SceneElement[]) : []),
        [parsed]
    );

    const explodedElements = useMemo(() => {
        if (!exploded || elements.length === 0) return elements;

        const center = elements.reduce(
            (acc, el) => {
                acc[0] += el.position[0];
                acc[1] += el.position[1];
                acc[2] += el.position[2];
                return acc;
            },
            [0, 0, 0]
        );
        center[0] /= elements.length;
        center[1] /= elements.length;
        center[2] /= elements.length;

        const maxDimension = elements.reduce((acc, el) => {
            return Math.max(acc, el.dimensions[0], el.dimensions[1], el.dimensions[2]);
        }, 0);
        const explodeScale = Math.max(6, maxDimension * explodeAmount);

        return elements.map((el) => {
            const dir = new THREE.Vector3(
                el.position[0] - center[0],
                el.position[1] - center[1],
                el.position[2] - center[2]
            );

            if (dir.length() < 0.001) {
                dir.set(0, 1, 0);
            }

            dir.normalize().multiplyScalar(explodeScale);

            return {
                ...el,
                position: [el.position[0] + dir.x, el.position[1] + dir.y, el.position[2] + dir.z],
            };
        });
    }, [elements, exploded, explodeAmount]);

    if (!parsed) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500 p-4 text-center">
                <p className="font-semibold mb-2">Failed to render 3D scene. Invalid Format.</p>
                <pre className="text-xs bg-red-50 p-2 rounded max-w-full overflow-auto text-left w-full h-32 border border-red-100">
                    {sceneJson.slice(0, 500)}
                </pre>
            </div>
        );
    }

    return (
        <div className="w-full h-[420px] bg-gradient-to-br from-neutral-50 to-neutral-200 rounded-xl overflow-hidden relative border border-neutral-200">
            <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }}>
                <Stage
                    environment="studio"
                    preset="soft"
                    intensity={0.9}
                    adjustCamera
                    shadows={{
                        type: 'contact',
                        opacity: 0.35,
                        blur: 2.5,
                        far: 200,
                    }}
                >
                    {explodedElements.map((el, i) => (
                        <SceneObject key={i} element={el} />
                    ))}
                </Stage>
                <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
            </Canvas>

            <div className="absolute bottom-4 right-4 bg-white/70 text-neutral-800 text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none border border-neutral-200">
                Interactive 3D Preview
            </div>
        </div>
    );
}
