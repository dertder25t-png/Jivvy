"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { GummyButton } from "@/components/ui/GummyButton";
import { useProjectStore } from "@/lib/store";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    url: string;
    className?: string;
}

export function PDFViewer({ url, className }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    // Use local state for immediate feedback but sync with global store
    const { pdfPage, setPdfPage } = useProjectStore();
    const [pageNumber, setPageNumber] = useState<number>(1);

    const [scale, setScale] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    // Sync local state with global store
    useEffect(() => {
        setPageNumber(pdfPage);
    }, [pdfPage]);

    // Update global store when local page changes (via controls)
    const handlePageChange = (newPage: number) => {
        setPageNumber(newPage);
        setPdfPage(newPage);
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setLoading(false);
    }

    return (
        <div className={cn("flex flex-col h-full bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 relative", className)}>
            {/* Controls */}
            <div className="flex items-center justify-between p-2 md:p-4 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 z-10">
                <div className="flex items-center gap-2">
                    <GummyButton size="sm" variant="ghost" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                        <ZoomOut size={16} />
                    </GummyButton>
                    <span className="text-xs font-mono text-zinc-400 w-12 text-center">{Math.round(scale * 100)}%</span>
                    <GummyButton size="sm" variant="ghost" onClick={() => setScale(s => Math.min(2.5, s + 0.1))}>
                        <ZoomIn size={16} />
                    </GummyButton>
                </div>

                <div className="flex items-center gap-2">
                    <GummyButton size="sm" variant="ghost" onClick={() => handlePageChange(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1}>
                        &lt;
                    </GummyButton>
                    <span className="text-xs font-mono text-zinc-400 w-20 text-center">
                        Page {pageNumber} of {numPages || "--"}
                    </span>
                    <GummyButton size="sm" variant="ghost" onClick={() => handlePageChange(Math.min(numPages, pageNumber + 1))} disabled={pageNumber >= numPages}>
                        &gt;
                    </GummyButton>
                </div>

                <GummyButton size="sm" variant="ghost" onClick={() => setRotation(r => (r + 90) % 360)}>
                    <RotateCw size={16} />
                </GummyButton>
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-auto flex justify-center p-4 md:p-8 no-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-lime-400" />
                    </div>
                )}

                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="shadow-2xl"
                    loading={
                        <div className="flex items-center justify-center p-12 text-zinc-500 text-sm">
                            Loading PDF...
                        </div>
                    }
                    error={
                        <div className="flex items-center justify-center p-12 text-red-400 text-sm">
                            Failed to load PDF.
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        rotate={rotation}
                        className="rounded-lg overflow-hidden shadow-lg border border-white/10"
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                    />
                </Document>
            </div>
        </div>
    );
}
