'use client';

export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'iso';
export type EnvironmentPreset = 'studio' | 'warehouse' | 'sunset' | 'park' | 'night';
export type ExplosionMode = 'assembled' | 'exploded' | 'xray';

interface SceneToolbarProps {
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    onSetView: (preset: ViewPreset) => void;
    envPreset: EnvironmentPreset;
    onSetEnvPreset: (preset: EnvironmentPreset) => void;
    darkBg: boolean;
    onToggleDarkBg: () => void;
    onScreenshot: () => void;
    onExportGltf: () => void;
    explosionMode: ExplosionMode;
    onSetExplosionMode: (mode: ExplosionMode) => void;
}

const VIEW_BUTTONS: { key: ViewPreset; label: string }[] = [
    { key: 'front', label: 'Front' },
    { key: 'back', label: 'Back' },
    { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' },
    { key: 'top', label: 'Top' },
    { key: 'iso', label: 'Iso' },
];

const ENV_OPTIONS: { key: EnvironmentPreset; label: string }[] = [
    { key: 'studio', label: 'Studio' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'sunset', label: 'Sunset' },
    { key: 'park', label: 'Park' },
    { key: 'night', label: 'Night' },
];

const EXPLOSION_BUTTONS: { key: ExplosionMode; label: string }[] = [
    { key: 'assembled', label: 'Assembled' },
    { key: 'exploded', label: 'Exploded' },
    { key: 'xray', label: 'X-Ray' },
];

export function SceneToolbar({
    autoRotate,
    onToggleAutoRotate,
    onSetView,
    envPreset,
    onSetEnvPreset,
    darkBg,
    onToggleDarkBg,
    onScreenshot,
    onExportGltf,
    explosionMode,
    onSetExplosionMode,
}: SceneToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* View Presets */}
            <div className="flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
                {VIEW_BUTTONS.map((btn) => (
                    <button
                        key={btn.key}
                        onClick={() => onSetView(btn.key)}
                        className="px-2 py-1 rounded-md hover:bg-background hover:shadow-sm text-neutral-600 hover:text-neutral-900 transition-all"
                        title={`${btn.label} view`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-neutral-200" />

            {/* Auto Rotate */}
            <button
                onClick={onToggleAutoRotate}
                className={`px-2.5 py-1 rounded-lg transition-all ${autoRotate
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-background hover:shadow-sm'
                    }`}
                title="Toggle auto-rotate"
            >
                Rotate
            </button>

            {/* Environment */}
            <select
                value={envPreset}
                onChange={(e) => onSetEnvPreset(e.target.value as EnvironmentPreset)}
                className="px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600 border-none text-xs cursor-pointer hover:bg-background hover:shadow-sm transition-all"
                aria-label="Select lighting environment"
            >
                {ENV_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                        {opt.label}
                    </option>
                ))}
            </select>

            {/* Dark/Light */}
            <button
                onClick={onToggleDarkBg}
                className={`px-2.5 py-1 rounded-lg transition-all ${darkBg
                    ? 'bg-neutral-800 text-neutral-200 shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-background hover:shadow-sm'
                    }`}
                title="Toggle dark background"
            >
                {darkBg ? 'Light' : 'Dark'}
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-neutral-200" />

            {/* Explosion Mode */}
            <div className="flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
                {EXPLOSION_BUTTONS.map((btn) => (
                    <button
                        key={btn.key}
                        onClick={() => onSetExplosionMode(btn.key)}
                        className={`px-2 py-1 rounded-md transition-all ${explosionMode === btn.key
                                ? 'bg-background shadow-sm text-neutral-900 font-medium'
                                : 'text-neutral-600 hover:bg-background hover:shadow-sm'
                            }`}
                        title={`${btn.label} view`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-neutral-200" />

            {/* Export */}
            <button
                onClick={onScreenshot}
                className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-background hover:shadow-sm transition-all"
                title="Save screenshot (PNG)"
            >
                Screenshot
            </button>
            <button
                onClick={onExportGltf}
                className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-background hover:shadow-sm transition-all"
                title="Export 3D model (glTF)"
            >
                Export glTF
            </button>
        </div>
    );
}
