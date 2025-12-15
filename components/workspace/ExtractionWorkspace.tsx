
"use client";

import { useProjectStore } from "@/lib/store";
import { PDFViewer } from "./PDFViewer";
import { ResearchTools } from "./ResearchTools";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

interface ExtractionWorkspaceProps {
    pdfUrl: string | null;
}

export function ExtractionWorkspace({ pdfUrl }: ExtractionWorkspaceProps) {
    const { setPdfPage } = useProjectStore();
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);

    useEffect(() => {
        if (pdfUrl) {
            fetch(pdfUrl)
                .then(res => res.arrayBuffer())
                .then(buf => setPdfBuffer(buf))
                .catch(err => console.error("Failed to load PDF buffer:", err));
        }
    }, [pdfUrl]);

    return (
        <div className="flex h-full w-full bg-zinc-950 overflow-hidden">
            {/* Left Pane: PDF Viewer (50%) */}
            <div className="w-1/2 h-full p-4 border-r border-white/5">
                {pdfUrl ? (
                    <PDFViewer url={pdfUrl} className="h-full w-full" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <FileText size={48} className="mb-4 text-zinc-700" />
                        <p>No PDF uploaded for this project.</p>
                    </div>
                )}
            </div>

            {/* Right Pane: Extraction Tools (50%) */}
            <div className="w-1/2 h-full bg-surface">
                {/* We reuse ResearchTools but styled/framed for full pane usage */}
                {/* Note: ResearchTools currently has a constrained height style or layout for sidebar.
                    We might need to adjust it or wrap it.
                    ResearchTools takes height from parent via 'h-full'.
                */}
                <div className="h-full w-full p-4">
                     <ResearchTools
                        pdfBuffer={pdfBuffer}
                        onJumpToPage={(page) => setPdfPage(page)}
                     />
                </div>
            </div>
        </div>
    );
}
