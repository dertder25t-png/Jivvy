"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, FileText, ExternalLink, RotateCw, ChevronLeft, ChevronRight, Quote, MessageSquare, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store";
import { db, Block } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// Import react-pdf styles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PDFViewerProps {
    url: string;
    className?: string;
    projectId?: string;
    onAskAI?: (text: string) => void;
}

interface SelectionInfo {
    text: string;
    x: number;
    y: number;
    page: number;
    rect: number[];
}

export function PDFViewer({ url, className, projectId, onAskAI }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [scale, setScale] = useState(1.0);
    const [selection, setSelection] = useState<SelectionInfo | null>(null);

    const { pdfPage, setPdfPage, activeProjectId } = useProjectStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Handle document load success
    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setLoading(false);
        setError(false);
    };

    const onDocumentLoadError = () => {
        setLoading(false);
        setError(true);
        console.error('[PDFViewer] Failed to load PDF');
    };

    // Handle page navigation
    const goToPrevPage = () => {
        if (pdfPage > 1) setPdfPage(pdfPage - 1);
    };

    const goToNextPage = () => {
        if (pdfPage < numPages) setPdfPage(pdfPage + 1);
    };

    // Handle zoom
    const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

    // Handle text selection
    const handleMouseUp = useCallback(() => {
        const selectionObj = window.getSelection();
        const selectedText = selectionObj?.toString().trim();

        if (selectedText && selectedText.length > 0) {
            const range = selectionObj?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();

            if (rect && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();

                setSelection({
                    text: selectedText,
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top - 10,
                    page: pdfPage,
                    rect: [rect.left, rect.top, rect.width, rect.height]
                });
            }
        }
    }, [pdfPage]);

    // Close tooltip when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                setSelection(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle "Cite" action - create PDFHighlightBlock
    const handleCite = async () => {
        if (!selection) return;

        const targetProjectId = projectId || activeProjectId;
        if (!targetProjectId) {
            console.error('[PDFViewer] No project ID available for citation');
            return;
        }

        // Get the current max order
        const existingBlocks = await db.blocks.where('parent_id').equals(targetProjectId).toArray();
        const maxOrder = existingBlocks.reduce((max, b) => Math.max(max, b.order), -1);

        const newBlock: Block = {
            id: uuidv4(),
            parent_id: targetProjectId,
            content: selection.text,
            type: 'pdf_highlight',
            order: maxOrder + 1,
            metadata: {
                source_id: url,
                page: selection.page,
                rect: selection.rect,
                quote: selection.text,
                source_name: 'PDF Document'
            }
        };

        await db.blocks.add(newBlock);
        console.log('[PDFViewer] Created citation block:', newBlock.id);

        setSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    // Handle "Ask AI" action
    const handleAskAI = () => {
        if (!selection) return;

        onAskAI?.(selection.text);
        setSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    // Open in new tab
    const handleOpenExternal = () => {
        window.open(url, '_blank');
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex flex-col h-full bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5 relative",
                className
            )}
        >
            {/* Controls */}
            <div className="flex items-center justify-between p-2 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 z-10">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <FileText size={14} className="text-blue-500" />
                    <span>PDF Viewer</span>
                    {numPages > 0 && (
                        <span className="text-zinc-500">
                            ({pdfPage} / {numPages})
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* Zoom controls */}
                    <button
                        onClick={zoomOut}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                        title="Zoom out"
                    >
                        <ZoomOut size={14} />
                    </button>
                    <span className="text-xs text-zinc-500 min-w-[3rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                        title="Zoom in"
                    >
                        <ZoomIn size={14} />
                    </button>

                    <div className="w-px h-4 bg-zinc-700 mx-1" />

                    {/* Page navigation */}
                    <button
                        onClick={goToPrevPage}
                        disabled={pdfPage <= 1}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous page"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={goToNextPage}
                        disabled={pdfPage >= numPages}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next page"
                    >
                        <ChevronRight size={14} />
                    </button>

                    <div className="w-px h-4 bg-zinc-700 mx-1" />

                    <button
                        onClick={handleOpenExternal}
                        title="Open in new tab"
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                    >
                        <ExternalLink size={14} />
                    </button>
                </div>
            </div>

            {/* Document Viewer */}
            <div
                className="flex-1 overflow-auto relative bg-zinc-800"
                onMouseUp={handleMouseUp}
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <span className="text-sm text-zinc-400">Loading PDF...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 z-10">
                        <FileText size={48} className="text-zinc-600 mb-4" />
                        <span className="text-sm text-red-400 mb-2">Failed to load PDF</span>
                        <button
                            onClick={handleOpenExternal}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs text-zinc-300 transition-colors"
                        >
                            <ExternalLink size={12} />
                            Open Externally
                        </button>
                    </div>
                )}

                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={null}
                    className="flex flex-col items-center py-4"
                >
                    <Page
                        pageNumber={pdfPage}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-xl"
                    />
                </Document>

                {/* Selection Tooltip */}
                {selection && (
                    <div
                        ref={tooltipRef}
                        className="absolute z-50 flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
                        style={{
                            left: selection.x,
                            top: selection.y,
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        <button
                            onClick={handleCite}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-blue-600 hover:text-white rounded transition-colors"
                            title="Add citation to notes"
                        >
                            <Quote size={12} />
                            Cite
                        </button>
                        <div className="w-px h-4 bg-zinc-700" />
                        <button
                            onClick={handleAskAI}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-purple-600 hover:text-white rounded transition-colors"
                            title="Ask AI about this"
                        >
                            <MessageSquare size={12} />
                            Ask AI
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
