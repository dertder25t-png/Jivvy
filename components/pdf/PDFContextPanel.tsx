"use client";

import React from "react";
import { useProjectStore } from "@/lib/store";
import { SourceDrawer } from "@/components/workspace/SourceDrawer";

/**
 * PDFContextPanel
 * 
 * The main container for the right-side context panel.
 * Connects the global project state (active project, PDF URL) to the SourceDrawer/Tool Suite.
 */
export function PDFContextPanel() {
    const { activeProjectId, activePdfUrl } = useProjectStore();

    // If no project is active, we might want to show a placeholder or still allow generic tools
    // SourceDrawer handles undefined projectId reasonably well (disables cloud features)

    return (
        <div className="h-full w-full flex flex-col bg-surface">
            <SourceDrawer
                className="flex-1 w-full border-0"
                projectId={activeProjectId || undefined}
                pdfUrl={activePdfUrl || undefined}
                orientation="vertical" // Force vertical layout in the side panel
            />
        </div>
    );
}
