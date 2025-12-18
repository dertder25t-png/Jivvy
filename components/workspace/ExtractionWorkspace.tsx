
"use client";

import { useProjectStore } from "@/lib/store";
import { PDFViewer } from "./PDFViewer";
import { AICommandCenter } from "./AICommandCenter";
import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Upload, Loader2, Cloud, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractionWorkspaceProps {
    pdfUrl: string | null;
    onPdfUploaded?: (url: string) => void;
}

export function ExtractionWorkspace({ pdfUrl: initialPdfUrl, onPdfUploaded }: ExtractionWorkspaceProps) {
    const { setPdfPage } = useProjectStore();
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
    const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [, setHighlightPage] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Use either local or initial PDF URL
    const activePdfUrl = localPdfUrl || initialPdfUrl;

    // Load PDF buffer when URL changes
    useEffect(() => {
        if (activePdfUrl) {
            setLoading(true);
            setLoadError(null);

            fetch(activePdfUrl)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
                    }
                    return res.arrayBuffer();
                })
                .then(buf => {
                    if (!buf || buf.byteLength === 0) {
                        throw new Error('PDF file is empty');
                    }
                    setPdfBuffer(buf);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load PDF buffer:", err);
                    setLoadError(err instanceof Error ? err.message : 'Failed to load PDF');
                    setLoading(false);
                    setPdfBuffer(null);
                });
        } else {
            // Clear buffer when no URL
            setPdfBuffer(null);
            setLoadError(null);
        }
    }, [activePdfUrl]);

    // Clean up blob URL on unmount
    useEffect(() => {
        return () => {
            if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(localPdfUrl);
            }
        };
    }, [localPdfUrl]);

    // Handle local file - keeps file on device, no cloud upload
    const handleLocalFile = useCallback((file: File) => {
        // Validate file type
        if (!file.type.includes('pdf')) {
            setLoadError('Please select a valid PDF file');
            return;
        }

        setLoading(true);
        setLoadError(null);
        setFileName(file.name);

        // Create a local blob URL - stays on device, no network request
        const blobUrl = URL.createObjectURL(file);
        setLocalPdfUrl(blobUrl);

        // Also read as ArrayBuffer for the extraction tools
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
                if (e.target.result.byteLength === 0) {
                    setLoadError('PDF file is empty');
                    setLoading(false);
                    return;
                }
                setPdfBuffer(e.target.result);
            }
            setLoading(false);
        };
        reader.onerror = (e) => {
            console.error("Failed to read file:", e);
            setLoadError('Failed to read PDF file');
            setLoading(false);
        };
        reader.readAsArrayBuffer(file);

        // Notify parent if needed (but don't upload anywhere)
        if (onPdfUploaded) {
            onPdfUploaded(blobUrl);
        }
    }, [onPdfUploaded]);

    // Handle drag and drop events
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleLocalFile(file);
        }
    }, [handleLocalFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    }, []);

    // Clear local file
    const handleClearFile = useCallback(() => {
        if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(localPdfUrl);
        }
        setLocalPdfUrl(null);
        setPdfBuffer(null);
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [localPdfUrl]);

    return (
        <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-950 overflow-hidden">
            {/* PDF Viewer - stacked on mobile, side-by-side on desktop */}
            <div className="w-full lg:w-1/2 h-[45%] lg:h-full p-2 lg:p-4 border-b lg:border-b-0 lg:border-r border-white/5 min-h-0">
                {activePdfUrl ? (
                    <div className="h-full w-full relative">
                        {/* File info bar */}
                        {fileName && (
                            <div className="absolute top-0 left-0 right-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-white/5 px-4 py-2 flex items-center justify-between rounded-t-3xl">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={14} className="text-lime-400" />
                                    <span className="text-zinc-300 truncate max-w-[200px]">{fileName}</span>
                                    <span className="text-zinc-600 text-xs">(Local)</span>
                                </div>
                                <button
                                    onClick={handleClearFile}
                                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
                                    title="Remove file"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <PDFViewer url={activePdfUrl} className={cn("h-full w-full", fileName && "pt-10")} />
                    </div>
                ) : (
                    <div
                        className={cn(
                            "h-full w-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer group relative",
                            dragOver
                                ? "border-lime-400 bg-lime-400/10 scale-[1.02] shadow-[0_0_30px_rgba(163,230,53,0.2)]"
                                : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50"
                        )}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDragEnter={handleDragEnter}
                        onClick={() => !loading && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLocalFile(file);
                            }}
                        />

                        {loading ? (
                            <>
                                <div className="w-20 h-20 rounded-3xl bg-lime-400/20 flex items-center justify-center mb-6 animate-pulse">
                                    <Loader2 className="text-lime-400 animate-spin" size={32} />
                                </div>
                                <p className="text-lime-400 text-lg font-medium">Loading PDF...</p>
                                <p className="text-zinc-500 text-sm mt-2">Please wait</p>
                            </>
                        ) : (
                            <>
                                <div className={cn(
                                    "w-24 h-24 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300",
                                    dragOver
                                        ? "bg-lime-400/30 scale-125 rotate-6"
                                        : "bg-zinc-800/80 group-hover:bg-zinc-700/80 group-hover:scale-105"
                                )}>
                                    {dragOver ? (
                                        <Cloud className="text-lime-400 animate-bounce" size={40} />
                                    ) : (
                                        <FileText className="text-zinc-400 group-hover:text-lime-400 transition-colors" size={40} />
                                    )}
                                </div>

                                <p className={cn(
                                    "text-xl font-bold transition-colors",
                                    dragOver ? "text-lime-400" : "text-zinc-200"
                                )}>
                                    {dragOver ? "Drop it here!" : "Drop PDF here"}
                                </p>

                                <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">
                                    or click to browse from your device
                                </p>

                                <div className="mt-8 flex items-center gap-2 px-5 py-3 bg-zinc-800/60 rounded-full text-sm text-zinc-400 border border-zinc-700/50">
                                    <Upload size={16} className="text-lime-400" />
                                    <span>Files stay on your device</span>
                                </div>
                            </>
                        )}

                        {/* Animated border effect when dragging */}
                        {dragOver && (
                            <div className="absolute inset-0 rounded-3xl pointer-events-none">
                                <div className="absolute inset-0 rounded-3xl animate-pulse border-2 border-lime-400/50" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* AI Command Center - stacked on mobile, side-by-side on desktop */}
            <div className="w-full lg:w-1/2 h-[55%] lg:h-full flex flex-col overflow-hidden pb-20 lg:pb-0">
                {loadError && (
                    <div className="m-4 mb-0 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between flex-shrink-0">
                        <span>{loadError}</span>
                        <button
                            onClick={() => setLoadError(null)}
                            className="text-red-400 hover:text-red-300"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                <div className="flex-1 min-h-0 p-2 lg:p-4 h-full">
                    {/* Changed: Passing activePdfUrl to handle empty state in ResearchTools */}
                    <AICommandCenter
                        pdfBuffer={pdfBuffer}
                        onJumpToPage={(page) => {
                            setPdfPage(page);
                            setHighlightPage(page);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
