"use client";

import { useState, useRef } from "react";
import { Loader2, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { GummyButton } from "@/components/ui/GummyButton";

interface PDFViewerProps {
    url: string;
    className?: string;
}

export function PDFViewer({ url, className }: PDFViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Reset loading state when URL changes
    useState(() => {
        setLoading(true);
        setError(false);
    });

    // Handle iframe load
    const handleLoad = () => {
        setLoading(false);
        setError(false);
        setRetryCount(0); // Reset retry count on successful load
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
        console.error('[PDFViewer] Failed to load PDF iframe');
    };

    // Retry loading the PDF
    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setLoading(true);
        setError(false);
        // Force iframe reload by updating key
        if (iframeRef.current) {
            iframeRef.current.src = url;
        }
    };

    // Open in new tab for download/print
    const handleOpenExternal = () => {
        window.open(url, '_blank');
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 relative", className)}>
            {/* Controls */}
            <div className="flex items-center justify-between p-2 md:p-4 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 z-10">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <FileText size={14} className="text-lime-400" />
                    <span>PDF Viewer</span>
                </div>

                <GummyButton size="sm" variant="ghost" onClick={handleOpenExternal} title="Open in new tab">
                    <Download size={16} />
                </GummyButton>
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-lime-400" size={32} />
                            <span className="text-sm text-zinc-400">Loading PDF...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 z-10">
                        <FileText size={48} className="text-zinc-600 mb-4" />
                        <span className="text-sm text-red-400 mb-2">Failed to load PDF</span>
                        {retryCount < 3 && (
                            <p className="text-xs text-zinc-500 mb-3">
                                Attempt {retryCount + 1} failed. You can retry or open externally.
                            </p>
                        )}
                        <div className="flex gap-2">
                            {retryCount < 3 && (
                                <GummyButton size="sm" onClick={handleRetry} variant="ghost">
                                    Retry
                                </GummyButton>
                            )}
                            <GummyButton size="sm" onClick={handleOpenExternal}>
                                Open in New Tab
                            </GummyButton>
                        </div>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={url}
                    key={`pdf-iframe-${retryCount}`}
                    className="w-full h-full border-0 bg-zinc-800"
                    onLoad={handleLoad}
                    onError={handleError}
                    title="PDF Document"
                    aria-label="PDF Document Viewer"
                />
            </div>
        </div>
    );
}
