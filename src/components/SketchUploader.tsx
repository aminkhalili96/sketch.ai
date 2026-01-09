'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import NextImage from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector } from '@/components/ModelSelector';
import { useProjectStore } from '@/stores/projectStore';
import { demoSketches, type DemoSketch } from '@/lib/demoGallery';

interface SketchUploaderProps {
    onAnalyze?: () => void;
}

export function SketchUploader({ onAnalyze }: SketchUploaderProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    const {
        currentProject,
        setSketch,
        updateDescription,
        setAnalysis,
        replaceOutputs,
        setMetadata,
        clearOutputSnapshots,
        setAnalyzing,
        isAnalyzing,
        setError,
        selectedModel
    } = useProjectStore();

    useEffect(() => {
        setPreview(currentProject?.sketchBase64 ?? null);
        setDescription(currentProject?.description ?? '');
    }, [currentProject?.description, currentProject?.sketchBase64]);

    const resetGeneratedData = useCallback(() => {
        setAnalysis(null);
        replaceOutputs({});
        setMetadata(null);
        clearOutputSnapshots();
    }, [clearOutputSnapshots, replaceOutputs, setAnalysis, setMetadata]);


    // Helper to resize image using Canvas
    const resizeImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    // Compress slightly to JPEG 0.8 to reduce payload further
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Strict type check
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            setError('Unsupported image format. Please use JPEG, PNG, WebP, or GIF.');
            return;
        }

        resetGeneratedData();
        try {
            // Resize if > 1MB roughly check or just always resize for safety
            // Always resizing ensures consistent format for AI
            const resizedBase64 = await resizeImage(file);
            setPreview(resizedBase64);
            setSketch(resizedBase64);
        } catch (error) {
            console.error("Image resize failed", error);
            setError('Failed to process image. Please try another file.');
        }
    }, [resetGeneratedData, setSketch, setError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif']
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10MB
        onDropRejected: (fileRejections) => {
            const error = fileRejections[0]?.errors[0];
            if (error?.code === 'file-invalid-type') {
                setError('Unsupported file type. Please upload a JPG, PNG, GIF or WebP image.');
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
        updateDescription(description);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: preview,
                    description: description || undefined,
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
        setDescription('');
        updateDescription('');
        setSketch(null);
        resetGeneratedData();
    };

    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value;
        setDescription(value);
        updateDescription(value);
    };

    const loadDemoSketch = async (demo: DemoSketch) => {
        resetGeneratedData();
        try {
            const response = await fetch(demo.imageUrl);
            if (!response.ok) {
                throw new Error('Demo image fetch failed');
            }
            const svgText = await response.text();
            const base64 = window.btoa(svgText);
            const dataUrl = `data:image/svg+xml;base64,${base64}`;

            setPreview(dataUrl);
            setSketch(dataUrl);
            setDescription(demo.prompt);
            updateDescription(demo.prompt);
        } catch (error) {
            console.error('Failed to load demo sketch', error);
            setError('Failed to load demo sketch');
        }
    };

    return (
        <Card className="p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm">
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
                                {demoSketches.map((demo) => (
                                    <button
                                        key={demo.id}
                                        type="button"
                                        onClick={() => loadDemoSketch(demo)}
                                        className="w-full flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/80 hover:bg-white transition-colors p-2 text-left"
                                    >
                                        <div className="h-12 w-12 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                                            <img
                                                src={demo.imageUrl}
                                                alt={demo.title}
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
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-neutral-500 hover:text-neutral-700 shadow-sm transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <Textarea
                            placeholder="Describe your hardware idea (optional)"
                            value={description}
                            onChange={handleDescriptionChange}
                            className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 resize-none rounded-xl"
                            rows={2}
                        />

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
