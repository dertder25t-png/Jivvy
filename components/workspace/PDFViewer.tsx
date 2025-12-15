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
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Handle iframe load
    const handleLoad = () => {
        setLoading(false);
        setError(false);
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
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
                        <GummyButton size="sm" onClick={handleOpenExternal}>
                            Open in New Tab
                        </GummyButton>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={url}
                    className="w-full h-full border-0 bg-zinc-800"
                    onLoad={handleLoad}
                    onError={handleError}
                    title="PDF Document"
                />
            </div>
        </div>
    );
}
