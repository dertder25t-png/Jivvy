"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import the wrapper that contains the heavy Excalidraw + MainMenu static logic
const ExcalidrawWrapper = dynamic(
    () => import("./ExcalidrawWrapper"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-400">
                <Loader2 className="animate-spin mr-2" /> Loading Canvas...
            </div>
        ),
    }
);

interface ExcalidrawCanvasProps {
    projectId: string;
    initialData?: any;
    className?: string; // Kept for API compatibility, though wrapper covers size
}

export function ExcalidrawCanvas({ projectId, className }: ExcalidrawCanvasProps) {
    return (
        <div className={`w-full h-full relative ${className}`}>
            <ExcalidrawWrapper projectId={projectId} />
        </div>
    );
}
