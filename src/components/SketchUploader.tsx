'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore } from '@/stores/projectStore';

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
        setAnalyzing,
        isAnalyzing,
        setError
    } = useProjectStore();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setPreview(base64);
            setSketch(base64);
        };
        reader.readAsDataURL(file);
    }, [setSketch]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024,
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
                    </motion.div>
                ) : (
                    <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="relative rounded-xl overflow-hidden bg-neutral-50 border border-neutral-200">
                            <img
                                src={preview}
                                alt="Uploaded sketch"
                                className="w-full h-40 object-contain"
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
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 resize-none rounded-xl"
                            rows={2}
                        />

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
