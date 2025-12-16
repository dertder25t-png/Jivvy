"use client";

import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { cn } from "@/lib/utils";

interface InfiniteCanvasProps {
    className?: string;
    projectId?: string;
    userId?: string;
    blurAmount?: number;
}

export function InfiniteCanvas({
    className,
    projectId = "new",
    userId,
    blurAmount = 0
}: InfiniteCanvasProps) {
    return (
        <div className={cn("w-full h-full relative overflow-hidden", className)}>
            <div
                className="w-full h-full transition-all duration-300"
                style={{ filter: `blur(${blurAmount}px)` }}
            >
                <ExcalidrawCanvas projectId={projectId} />
            </div>

            {/* Overlay for blur effect interactions if needed */}
            {blurAmount > 0 && (
                <div className="absolute inset-0 z-50 bg-transparent" />
            )}
        </div>
    );
}
