'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import NextImage from 'next/image';
import { Card } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { ModelSelector } from '@/frontend/components/ModelSelector';
import { useProjectStore } from '@/frontend/state/projectStore';
import { demoSketches, type DemoSketch } from '@/frontend/lib/demoGallery';
import { getDemoPreset } from '@/frontend/lib/demoPresets';

const MAX_IMAGE_DIM = 1024;
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const scaleToMax = (width: number, height: number, maxSize = MAX_IMAGE_DIM) => {
    let targetWidth = width;
    let targetHeight = height;

    if (targetWidth > targetHeight) {
        if (targetWidth > maxSize) {
            targetHeight *= maxSize / targetWidth;
            targetWidth = maxSize;
        }
    } else if (targetHeight > maxSize) {
        targetWidth *= maxSize / targetHeight;
        targetHeight = maxSize;
    }

    return {
        width: Math.max(1, Math.round(targetWidth)),
        height: Math.max(1, Math.round(targetHeight)),
    };
};

const parseSvgDimensions = (svgText: string) => {
    const fallback = { width: 512, height: 512 };
    try {
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) return fallback;

        const widthAttr = svg.getAttribute('width');
        const heightAttr = svg.getAttribute('height');
        const width = widthAttr ? Number.parseFloat(widthAttr) : NaN;
        const height = heightAttr ? Number.parseFloat(heightAttr) : NaN;
        if (Number.isFinite(width) && Number.isFinite(height)) {
            return { width, height };
        }

        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(/[\s,]+/g).map((value) => Number.parseFloat(value));
            if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
                return { width: parts[2], height: parts[3] };
            }
        }
    } catch {
        return fallback;
    }

    return fallback;
};

const decodeSvgDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?(?:;base64)?,(.*)$/i);
    if (!match) return null;
    const payload = match[1] ?? '';
    const isBase64 = dataUrl.includes(';base64,');
    try {
        return isBase64 ? window.atob(payload) : decodeURIComponent(payload);
    } catch {
        return null;
    }
};

const rasterizeSvg = (svgText: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const { width, height } = parseSvgDimensions(svgText);
        const hasWidth = /<svg[^>]*\bwidth=/i.test(svgText);
        const hasHeight = /<svg[^>]*\bheight=/i.test(svgText);
        const sizeAttrs = `${!hasWidth ? ` width="${Math.round(width)}"` : ''}${!hasHeight ? ` height="${Math.round(height)}"` : ''}`;
        const sizedSvg = sizeAttrs
            ? svgText.replace('<svg', `<svg${sizeAttrs}`)
            : svgText;
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sizedSvg)}`;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scaled = scaleToMax(width, height);
            canvas.width = scaled.width;
            canvas.height = scaled.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, scaled.width, scaled.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(err);
        img.src = svgUrl;
    });
};

const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaled = scaleToMax(img.width, img.height);
                canvas.width = scaled.width;
                canvas.height = scaled.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, scaled.width, scaled.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

interface SketchUploaderProps {
    onAnalyze?: () => void;
}

export function SketchUploader({ onAnalyze }: SketchUploaderProps) {
    const [preview, setPreview] = useState<string | null>(null);

    const {
        currentProject,
        setSketch,
        updateDescription,
        updateProjectName,
        setAnalysis,
        replaceOutputs,
        setMetadata,
        clearOutputSnapshots,
        setAnalyzing,
        isAnalyzing,
        setError,
        setDemoPreset,
        selectedModel
    } = useProjectStore();

    useEffect(() => {
        setPreview(currentProject?.sketchBase64 ?? null);
    }, [currentProject?.description, currentProject?.sketchBase64]);

    const resetGeneratedData = useCallback(() => {
        setAnalysis(null);
        replaceOutputs({});
        setMetadata(null);
        clearOutputSnapshots();
    }, [clearOutputSnapshots, replaceOutputs, setAnalysis, setMetadata]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Strict type check
        if (!VALID_IMAGE_TYPES.includes(file.type)) {
            setError('Unsupported image format. Please use JPEG, PNG, SVG, WebP, or GIF.');
            return;
        }

        setDemoPreset(null);
        resetGeneratedData();
        try {
            if (file.type === 'image/svg+xml') {
                const svgText = await file.text();
                const rasterized = await rasterizeSvg(svgText);
                setPreview(rasterized);
                setSketch(rasterized);
            } else {
                // Always resizing ensures consistent format for AI
                const resizedBase64 = await resizeImage(file);
                setPreview(resizedBase64);
                setSketch(resizedBase64);
            }
        } catch (error) {
            console.error("Image resize failed", error);
            setError('Failed to process image. Please try another file.');
        }
    }, [resetGeneratedData, setSketch, setError, setDemoPreset]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif'],
            'image/svg+xml': ['.svg']
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10MB
        onDropRejected: (fileRejections) => {
            const error = fileRejections[0]?.errors[0];
            if (error?.code === 'file-invalid-type') {
                setError('Unsupported file type. Please upload a JPG, PNG, SVG, GIF, or WebP image.');
            } else if (error?.code === 'file-too-large') {
                setError('File is too large. Maximum size is 10MB.');
            } else {
                setError('Could not accept this file.');
            }
        }
    });

    const handleAnalyze = async () => {
        if (!preview) return;

        setAnalyzing(true);
        setError(null);

        try {
            let imagePayload = preview;
            if (preview.startsWith('data:image/svg+xml')) {
                const svgText = decodeSvgDataUrl(preview);
                if (svgText) {
                    const rasterized = await rasterizeSvg(svgText);
                    imagePayload = rasterized;
                    setPreview(rasterized);
                    setSketch(rasterized);
                }
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imagePayload,
                    description: currentProject?.description || undefined,
                    model: selectedModel,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            setAnalysis(data.analysis);
            onAnalyze?.();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleClear = () => {
        setPreview(null);
        updateDescription('');
        setSketch(null);
        setDemoPreset(null);
        resetGeneratedData();
    };

    const loadDemoSketch = async (demo: DemoSketch) => {
        resetGeneratedData();
        const preset = demo.presetId ? getDemoPreset(demo.presetId) : null;
        // Apply demo identity and preset scene immediately so rendering never falls back
        // to generic placeholder geometry while the preview image is still loading.
        setDemoPreset(demo.presetId ?? null);
        updateDescription(demo.prompt);
        updateProjectName(demo.title);
        if (preset?.outputs) {
            replaceOutputs(preset.outputs);
        }
        try {
            const response = await fetch(demo.imageUrl);
            if (!response.ok) {
                throw new Error('Demo image fetch failed');
            }
            const svgText = await response.text();
            const dataUrl = await rasterizeSvg(svgText);

            setPreview(dataUrl);
            setSketch(dataUrl);
        } catch (error) {
            console.error('Failed to load demo sketch', error);
            setError('Failed to load demo sketch');
        }
    };

    return (
        <Card className="p-6 bg-background border border-neutral-200 rounded-2xl shadow-sm">
            <h2 className="text-lg font-medium text-neutral-900 mb-4">
                Upload Sketch
            </h2>

            <AnimatePresence mode="wait">
                {!preview ? (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div
                            {...getRootProps()}
                            className={`
                rounded-xl border-2 border-dashed p-8
                transition-all duration-200 cursor-pointer
                ${isDragActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50'
                                }
              `}
                        >
                            <input {...getInputProps()} />

                            <div className="flex flex-col items-center justify-center text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-neutral-700">
                                        {isDragActive ? 'Drop here' : 'Drop your sketch here'}
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        or click to browse
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <p className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
                                Try a demo sketch
                            </p>
                            <div className="space-y-2">
                                {demoSketches.filter((d) => !d.hidden).map((demo) => (
                                    <button
                                        key={demo.id}
                                        type="button"
                                        onClick={() => loadDemoSketch(demo)}
                                        className="w-full flex items-center gap-3 rounded-xl border border-neutral-200 bg-background/80 hover:bg-background transition-colors p-2 text-left"
                                    >
                                        <div className="h-12 w-12 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                                            <NextImage
                                                src={demo.imageUrl}
                                                alt={demo.title}
                                                width={40}
                                                height={40}
                                                className="h-10 w-10 object-contain"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-neutral-800">{demo.title}</p>
                                            <p className="text-xs text-neutral-500">{demo.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="relative h-40 rounded-xl overflow-hidden bg-neutral-50 border border-neutral-200">
                            <NextImage
                                src={preview}
                                alt="Uploaded sketch"
                                fill
                                sizes="(max-width: 768px) 100vw, 640px"
                                className="object-contain"
                                unoptimized
                            />
                            <button
                                onClick={handleClear}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 hover:bg-background flex items-center justify-center text-neutral-500 hover:text-neutral-700 shadow-sm transition-colors"
                                aria-label="Clear uploaded sketch"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                            Use the chat to describe your product and refine the brief.
                        </div>

                        {currentProject?.description && (
                            <div className="rounded-xl border border-neutral-200 bg-background px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Project Brief</p>
                                <p className="text-sm text-neutral-800 mt-1">{currentProject.description}</p>
                            </div>
                        )}

                        <ModelSelector compact />

                        {currentProject?.analysis && (
                            <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                                <p className="text-sm text-green-700 font-medium">Analysis complete</p>
                                <p className="text-xs text-green-600 mt-1">{currentProject.analysis.summary}</p>
                            </div>
                        )}

                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-11"
                        >
                            {isAnalyzing ? 'Analyzing...' : currentProject?.analysis ? 'Re-analyze' : 'Analyze with AI'}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
