'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox, Stage } from '@react-three/drei';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import * as THREE from 'three';
import { beautifyScene, normalizeSceneColors, parseSceneElements } from '@/shared/domain/scene';
import { SceneToolbar, type ViewPreset, type EnvironmentPreset, type ExplosionMode } from './SceneToolbar';
import { SceneOverlay } from './SceneOverlay';

export interface SceneElement {
    type: 'box' | 'rounded-box' | 'cylinder' | 'sphere' | 'capsule' | 'cone' | 'torus' | 'plane' | 'half-sphere';
    position: [number, number, number];
    rotation?: [number, number, number];
    dimensions: [number, number, number];
    color: string;
    material?: 'plastic' | 'metal' | 'glass' | 'rubber' | 'emissive' | 'flat';
    radius?: number;
    smoothness?: number;
    name?: string;
    opacity?: number;
    emissiveColor?: string;
    emissiveIntensity?: number;
    layer?: 'shell' | 'internal' | 'pcb' | 'detail' | 'label';
    group?: string;
    parent?: string;
    texture?: string;
}

export interface SceneInitialView {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
}

interface SceneRendererProps {
    sceneJson: string;
    exploded?: boolean;
    explodeAmount?: number;
    mode?: 'default' | 'presentation';
    height?: number;
    showToolbar?: boolean;
    lockControls?: boolean;
    initialView?: SceneInitialView;
    forcedEnvironment?: EnvironmentPreset;
    forcedBackground?: string;
}

/* ------------------------------------------------------------------ */
/*  Animated Scene Object                                              */
/* ------------------------------------------------------------------ */

function SceneObject({
    element,
    targetPosition,
    isSelected,
    onSelect,
    interactive = true,
}: {
    element: SceneElement;
    targetPosition: [number, number, number];
    isSelected: boolean;
    onSelect: () => void;
    interactive?: boolean;
}) {
    const { type, rotation, dimensions, color, material, radius, smoothness, opacity, emissiveColor, emissiveIntensity } = element;

    const meshRef = useRef<THREE.Mesh>(null);
    const targetVec = useMemo(() => new THREE.Vector3(...targetPosition), [targetPosition]);

    // Handle optional texture manually to avoid Suspense/hook rule issues
    const [textureMap, setTextureMap] = useState<THREE.Texture | null>(null);
    useEffect(() => {
        if (element.texture) {
            new THREE.TextureLoader().load(element.texture, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace; // crucial for correct colors in standard material
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                tex.needsUpdate = true;
                setTextureMap(tex);
            });
        }
    }, [element.texture]);

    // Smooth position animation
    useFrame(() => {
        if (!meshRef.current) return;
        meshRef.current.position.lerp(targetVec, 0.08);
    });

    // Avoid compiling an untextured shader variant first; map changes require shader recompile.
    if (element.texture && !textureMap) {
        return null;
    }

    // Material
    const normalizedMaterial = material ?? 'plastic';
    const isFlat = normalizedMaterial === 'flat';

    // For 'flat' material, use MeshBasicMaterial (completely unlit, no env interaction)
    const materialProps: THREE.MeshPhysicalMaterialParameters = { color };
    if (textureMap) materialProps.map = textureMap;

    if (!isFlat) {
        if (normalizedMaterial === 'emissive') {
            materialProps.emissive = new THREE.Color(emissiveColor || color);
            materialProps.emissiveIntensity = emissiveIntensity ?? 2;
            materialProps.roughness = 0.25;
            materialProps.metalness = 0.1;
            materialProps.toneMapped = false;
            materialProps.clearcoat = 0.3;
        } else if (normalizedMaterial === 'metal') {
            materialProps.metalness = 0.45;
            materialProps.roughness = 0.40;
            materialProps.envMapIntensity = 0.45;
            materialProps.clearcoat = 0.15;
            materialProps.clearcoatRoughness = 0.3;
        } else if (normalizedMaterial === 'glass') {
            materialProps.transparent = true;
            materialProps.opacity = opacity ?? 0.3;
            materialProps.roughness = 0.05;
            materialProps.transmission = 0.92;
            materialProps.ior = 1.5;
            materialProps.thickness = 1.5;
            materialProps.envMapIntensity = 1.2;
            materialProps.clearcoat = 1;
            materialProps.clearcoatRoughness = 0.1;
        } else if (normalizedMaterial === 'rubber') {
            materialProps.roughness = 0.9;
            materialProps.metalness = 0;
        } else {
            // Plastic
            materialProps.roughness = 0.50;
            materialProps.metalness = 0;
            materialProps.clearcoat = 0.20;
            materialProps.clearcoatRoughness = 0.5;
            materialProps.envMapIntensity = 0.20;
        }
    }

    // Per-element opacity (non-glass)
    if (opacity !== undefined && opacity < 1 && normalizedMaterial !== 'glass') {
        materialProps.transparent = true;
        materialProps.opacity = opacity;
    }

    // Selection highlight
    if (isSelected) {
        materialProps.emissive = new THREE.Color('#4488ff');
        materialProps.emissiveIntensity = (materialProps.emissiveIntensity ?? 0) + 0.3;
    }

    const rot: [number, number, number] = rotation ? [rotation[0], rotation[1], rotation[2]] : [0, 0, 0];

    // Geometry factory
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
                    ref={meshRef as React.Ref<THREE.Mesh>}
                    args={dimensions}
                    radius={r}
                    smoothness={s}
                    position={targetPosition}
                    rotation={rot}
                    castShadow={!isFlat}
                    receiveShadow={!isFlat}
                    onClick={(e) => {
                        if (!interactive) return;
                        e.stopPropagation();
                        onSelect();
                    }}
                >
                    {isFlat ? (
                        <meshBasicMaterial
                            color={color}
                            toneMapped={false}
                            transparent={opacity !== undefined && opacity < 1}
                            opacity={opacity ?? 1}
                        />
                    ) : (
                        <meshPhysicalMaterial {...materialProps} />
                    )}
                </RoundedBox>
            );
        }
        case 'cylinder':
            geometry = <cylinderGeometry args={[dimensions[0], dimensions[0], dimensions[1], 32]} />;
            break;
        case 'sphere':
            geometry = <sphereGeometry args={[dimensions[0], 32, 32]} />;
            break;
        case 'capsule':
            geometry = <capsuleGeometry args={[dimensions[0], dimensions[1], 4, 8]} />;
            break;
        case 'cone':
            geometry = <coneGeometry args={[dimensions[0], dimensions[1], 32]} />;
            break;
        case 'torus':
            geometry = <torusGeometry args={[dimensions[0], dimensions[1], 16, 32]} />;
            break;
        case 'plane':
            geometry = <planeGeometry args={[dimensions[0], dimensions[2]]} />;
            break;
        case 'half-sphere':
            geometry = <sphereGeometry args={[dimensions[0], 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />;
            break;
        default:
            return null;
    }

    return (
        <mesh
            ref={meshRef}
            position={targetPosition}
            rotation={rot}
            castShadow={!isFlat}
            receiveShadow={!isFlat}
            onClick={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelect();
            }}
        >
            {geometry}
            {isFlat ? (
                <meshBasicMaterial
                    color={color}
                    map={textureMap ?? undefined}
                    toneMapped={false}
                    transparent={opacity !== undefined && opacity < 1}
                    opacity={opacity ?? 1}
                />
            ) : (
                <meshPhysicalMaterial {...materialProps} />
            )}
        </mesh>
    );
}

/* ------------------------------------------------------------------ */
/*  Camera Controller                                                  */
/* ------------------------------------------------------------------ */

const VIEW_POSITIONS: Record<ViewPreset, [number, number, number]> = {
    front: [0, 0, 120],
    back: [0, 0, -120],
    left: [-120, 0, 0],
    right: [120, 0, 0],
    top: [0, 120, 0],
    iso: [80, 60, 80],
};

function CameraController({
    viewPreset,
    autoRotate,
    onViewApplied,
    initialView,
    lockControls = false,
}: {
    viewPreset: ViewPreset | null;
    autoRotate: boolean;
    onViewApplied: () => void;
    initialView?: SceneInitialView;
    lockControls?: boolean;
}) {
    const { camera } = useThree();
    const controlsRef = useRef<unknown>(null);

    useEffect(() => {
        if (!initialView) return;
        camera.position.set(...initialView.position);
        camera.lookAt(...initialView.target);
        camera.updateProjectionMatrix();
        if (controlsRef.current) {
            (controlsRef.current as unknown as { target: THREE.Vector3 }).target.set(...initialView.target);
            (controlsRef.current as unknown as { update: () => void }).update();
        }
    }, [initialView, camera]);

    useEffect(() => {
        if (!viewPreset) return;
        const target = VIEW_POSITIONS[viewPreset];
        if (target) {
            camera.position.set(...target);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            if (controlsRef.current) {
                (controlsRef.current as unknown as { target: THREE.Vector3 }).target.set(0, 0, 0);
                (controlsRef.current as unknown as { update: () => void }).update();
            }
        }
        onViewApplied();
    }, [viewPreset, camera, onViewApplied]);

    return (
        <OrbitControls
            ref={controlsRef as React.Ref<never>}
            makeDefault
            enabled={!lockControls}
            enableRotate={!lockControls}
            enablePan={!lockControls}
            enableZoom={!lockControls}
            enableDamping={!lockControls}
            dampingFactor={0.12}
            autoRotate={autoRotate && !lockControls}
            autoRotateSpeed={1.5}
        />
    );
}

/* ------------------------------------------------------------------ */
/*  Screenshot helper                                                  */
/* ------------------------------------------------------------------ */

function ScreenshotHelper({ onCapture }: { onCapture: (ref: { capture: () => string | null }) => void }) {
    const { gl, scene, camera } = useThree();

    useEffect(() => {
        onCapture({
            capture: () => {
                gl.render(scene, camera);
                return gl.domElement.toDataURL('image/png');
            },
        });
    }, [gl, scene, camera, onCapture]);

    return null;
}

/* ------------------------------------------------------------------ */
/*  Main SceneRenderer                                                 */
/* ------------------------------------------------------------------ */

const ENV_MAP: Record<EnvironmentPreset, string> = {
    studio: 'studio',
    warehouse: 'warehouse',
    sunset: 'sunset',
    park: 'park',
    night: 'night',
};

const LAYER_MULTIPLIER: Record<string, number> = {
    shell: 2,       // shells fly out furthest
    detail: 1,      // ports/buttons separate moderately
    internal: 0.5,  // chips/battery stay close to PCB
    pcb: 0,         // PCB is the anchor layer
    label: 1.5,     // surface labels separate
};

export function SceneRenderer({
    sceneJson,
    exploded = false,
    explodeAmount = 0.35,
    mode = 'default',
    height,
    showToolbar = true,
    lockControls = false,
    initialView,
    forcedEnvironment,
    forcedBackground,
}: SceneRendererProps) {
    const parsed = useMemo(() => parseSceneElements(sceneJson), [sceneJson]);
    const elements = useMemo<SceneElement[]>(() => {
        if (!parsed) return [];
        if (mode === 'presentation') return parsed as SceneElement[];
        return normalizeSceneColors(beautifyScene(parsed)) as SceneElement[];
    }, [parsed, mode]);

    // Toolbar state
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [autoRotate, setAutoRotate] = useState(false);
    const [viewPreset, setViewPreset] = useState<ViewPreset | null>(null);
    const [envPreset, setEnvPreset] = useState<EnvironmentPreset>('studio');
    const [darkBg, setDarkBg] = useState(false);
    const screenshotRef = useRef<{ capture: () => string | null } | null>(null);

    const handleViewApplied = useCallback(() => setViewPreset(null), []);

    // Explosion mode state
    const [explosionMode, setExplosionMode] = useState<ExplosionMode>('assembled');

    const isExploded = exploded || explosionMode === 'exploded';
    const isXray = explosionMode === 'xray';

    // Compute exploded positions
    const explodedPositions = useMemo<[number, number, number][]>(() => {
        if (!isExploded || elements.length === 0) return elements.map((el) => el.position);

        const maxDimension = elements.reduce((acc, el) => Math.max(acc, el.dimensions[0], el.dimensions[1], el.dimensions[2]), 0);
        const baseExplodeScale = Math.max(6, maxDimension * explodeAmount);

        // Check if elements have layer annotations
        const hasLayers = elements.some((el) => el.layer);

        if (hasLayers) {
            // Layer-based smart explosion (Y-axis separation by layer)
            return elements.map((el) => {
                const layer = el.layer || 'detail';
                const multiplier = LAYER_MULTIPLIER[layer] ?? 1;

                // Shell direction: top goes up, bottom goes down
                let direction = 1;
                if (layer === 'shell' && el.name?.includes('bottom')) {
                    direction = -1;
                }

                return [
                    el.position[0],
                    el.position[1] + (direction * multiplier * baseExplodeScale),
                    el.position[2],
                ] as [number, number, number];
            });
        }

        // Fallback: radial explosion for legacy elements without layers
        const center = elements.reduce(
            (acc, el) => {
                acc[0] += el.position[0]; acc[1] += el.position[1]; acc[2] += el.position[2];
                return acc;
            },
            [0, 0, 0]
        );
        center[0] /= elements.length;
        center[1] /= elements.length;
        center[2] /= elements.length;

        return elements.map((el) => {
            const dir = new THREE.Vector3(
                el.position[0] - center[0],
                el.position[1] - center[1],
                el.position[2] - center[2]
            );
            if (dir.length() < 0.001) dir.set(0, 1, 0);
            dir.normalize().multiplyScalar(baseExplodeScale);
            return [el.position[0] + dir.x, el.position[1] + dir.y, el.position[2] + dir.z] as [number, number, number];
        });
    }, [elements, isExploded, explodeAmount]);

    const handleScreenshot = useCallback(() => {
        const dataUrl = screenshotRef.current?.capture();
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'scene-screenshot.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, []);

    const handleGltfExport = useCallback(async () => {
        // Dynamic import to avoid SSR issues
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        // Get the scene from Three.js renderer
        const threeScene = (canvas as unknown as { __r3f?: { store?: { getState: () => { scene: THREE.Scene } } } }).__r3f?.store?.getState()?.scene;
        if (!threeScene) return;

        exporter.parse(
            threeScene,
            (result) => {
                const output = JSON.stringify(result);
                const blob = new Blob([output], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.gltf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },
            (error) => {
                console.error('glTF export failed:', error);
            },
            { binary: false }
        );
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        if (lockControls) return;
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'r' || e.key === 'R') setViewPreset('iso');
            if (e.key === 'f' || e.key === 'F') setViewPreset('front');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lockControls]);

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

    if (elements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
                <p className="font-semibold mb-2">No scene elements to display.</p>
                <p className="text-xs text-neutral-400">The scene data was parsed but contains no renderable elements.</p>
            </div>
        );
    }

    const bgGradient = darkBg
        ? 'from-neutral-800 via-neutral-900 to-neutral-950'
        : mode === 'presentation'
            ? 'from-neutral-50 via-neutral-100 to-neutral-200'
            : 'from-neutral-50 to-neutral-200';
    const activeEnvironment = forcedEnvironment ?? envPreset;
    const useHeroLighting = lockControls && Boolean(forcedBackground);

    const stagePreset = mode === 'presentation' ? 'rembrandt' : 'soft';
    const stageIntensity = mode === 'presentation' ? 1.05 : 0.9;

    const selectedElement = selectedIndex !== null ? elements[selectedIndex] ?? null : null;

    return (
        <div className="space-y-2">
            {showToolbar && (
                <SceneToolbar
                    autoRotate={autoRotate}
                    onToggleAutoRotate={() => setAutoRotate((v) => !v)}
                    onSetView={setViewPreset}
                    envPreset={activeEnvironment}
                    onSetEnvPreset={setEnvPreset}
                    darkBg={darkBg}
                    onToggleDarkBg={() => setDarkBg((v) => !v)}
                    onScreenshot={handleScreenshot}
                    onExportGltf={handleGltfExport}
                    explosionMode={explosionMode}
                    onSetExplosionMode={setExplosionMode}
                />
            )}

            <div
                data-testid="scene-renderer-frame"
                className={`w-full rounded-xl overflow-hidden relative border border-neutral-200 ${forcedBackground ? '' : `bg-gradient-to-br ${bgGradient}`}`}
                style={{
                    height: height ? `${height}px` : '420px',
                    ...(forcedBackground ? { background: forcedBackground } : {}),
                }}
            >
                <Canvas
                    shadows
                    dpr={[1, 2]}
                    camera={{ fov: initialView?.fov ?? 45 }}
                    gl={{ preserveDrawingBuffer: true, antialias: true }}
                    onCreated={({ gl }) => {
                        gl.toneMapping = THREE.ACESFilmicToneMapping;
                        gl.toneMappingExposure = 0.82;
                    }}
                >
                    {useHeroLighting ? (
                        <>
                            <ambientLight intensity={0.24} />
                            <hemisphereLight args={['#f4eadf', '#8a8f96', 0.2]} />
                            <directionalLight
                                position={[128, 148, 92]}
                                intensity={1.18}
                                color="#fff0de"
                                castShadow
                                shadow-mapSize-width={2048}
                                shadow-mapSize-height={2048}
                                shadow-camera-near={5}
                                shadow-camera-far={500}
                                shadow-camera-left={-160}
                                shadow-camera-right={160}
                                shadow-camera-top={160}
                                shadow-camera-bottom={-160}
                            />
                            <directionalLight position={[-84, 78, 86]} intensity={0.28} color="#eef2f7" />
                            <directionalLight position={[0, 68, 170]} intensity={0.36} color="#f7f8fb" />
                            <directionalLight position={[-36, 52, -120]} intensity={0.1} color="#d6dde7" />
                            {elements.map((el, i) => {
                                const xrayElement = isXray && el.layer === 'shell'
                                    ? { ...el, opacity: 0.15 }
                                    : el;
                                return (
                                    <SceneObject
                                        key={i}
                                        element={xrayElement}
                                        targetPosition={explodedPositions[i] ?? el.position}
                                        isSelected={selectedIndex === i}
                                        onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)}
                                        interactive={!lockControls}
                                    />
                                );
                            })}
                        </>
                    ) : (
                        <Stage
                            environment={ENV_MAP[activeEnvironment] as 'studio'}
                            preset={stagePreset}
                            intensity={stageIntensity}
                            adjustCamera={viewPreset === null && !initialView}
                            shadows={{
                                type: 'contact',
                                opacity: mode === 'presentation' ? 0.45 : 0.35,
                                blur: 2.5,
                                far: 200,
                            }}
                        >
                            {elements.map((el, i) => {
                                // X-ray mode: make shell transparent
                                const xrayElement = isXray && el.layer === 'shell'
                                    ? { ...el, opacity: 0.15 }
                                    : el;
                                return (
                                    <SceneObject
                                        key={i}
                                        element={xrayElement}
                                        targetPosition={explodedPositions[i] ?? el.position}
                                        isSelected={selectedIndex === i}
                                        onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)}
                                        interactive={!lockControls}
                                    />
                                );
                            })}
                        </Stage>
                    )}
                    {/* Fill light from below for internal visibility when exploded/xray */}
                    {(isExploded || isXray) && (
                        <directionalLight position={[0, -50, 30]} intensity={0.4} color="#ffffff" />
                    )}
                    <CameraController
                        viewPreset={viewPreset}
                        autoRotate={autoRotate}
                        onViewApplied={handleViewApplied}
                        initialView={initialView}
                        lockControls={lockControls}
                    />
                    <ScreenshotHelper onCapture={(ref) => { screenshotRef.current = ref; }} />
                </Canvas>

                {!lockControls && (
                    <div className="absolute bottom-4 right-4 bg-background/70 text-neutral-800 text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none border border-neutral-200">
                        Interactive 3D Preview
                    </div>
                )}

                {selectedElement && !lockControls && (
                    <SceneOverlay
                        element={selectedElement}
                        onClose={() => setSelectedIndex(null)}
                    />
                )}
            </div>
        </div>
    );
}
