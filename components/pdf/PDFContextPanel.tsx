"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, Upload, Loader2, Cloud, CheckCircle, X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store";
import { PDFViewer } from "./PDFViewer";

export function PDFContextPanel() {
    const { activePdfUrl, setPdfUrl } = useProjectStore();
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isExpanded, setIsExpanded] = useState(false); // To possibly expand the panel if needed (future feature)

    // Handle local file selection
    const handleLocalFile = useCallback((file: File) => {
        if (!file.type.includes('pdf')) {
            // Error handling could be improved with a toast
            console.error('Please select a valid PDF file');
            return;
        }

        setLoading(true);
        setFileName(file.name);

        const blobUrl = URL.createObjectURL(file);
        setPdfUrl(blobUrl);
        setLoading(false);
    }, [setPdfUrl]);

    // Cleanup blob URL when it changes or unmount (though this might be tricky if store persists)
    // For now, we rely on the fact that revoking previous URL is good practice when replacing.
    // However, since we don't store the previous URL in a ref here easily without effects...
    // We'll leave strict cleanup for a more robust effect or store middleware.

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

    const handleClearFile = useCallback(() => {
        if (activePdfUrl && activePdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(activePdfUrl);
        }
        setPdfUrl(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [activePdfUrl, setPdfUrl]);

    if (activePdfUrl) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={16} className="text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-zinc-200 truncate">{fileName || "Document"}</span>
                    </div>
                    <button onClick={handleClearFile} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 p-2 overflow-hidden">
                    <PDFViewer url={activePdfUrl} className="h-full" />
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center h-full p-6 border-2 border-dashed rounded-xl transition-all duration-200 m-4",
                dragOver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
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

            <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-200",
                dragOver ? "scale-110 bg-blue-500/20" : "bg-zinc-800"
            )}>
                {loading ? (
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                ) : (
                    <Upload className={cn("transition-colors", dragOver ? "text-blue-500" : "text-zinc-500")} size={24} />
                )}
            </div>

            <p className="text-sm font-medium text-zinc-300 text-center mb-1">
                {loading ? "Processing..." : "Drop PDF to Reference"}
            </p>
            <p className="text-xs text-zinc-500 text-center">
                Drag & drop or click to upload
            </p>
        </div>
    );
}
