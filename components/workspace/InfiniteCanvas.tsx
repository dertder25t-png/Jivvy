"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const JivvyCanvas = dynamic(() => import("./DesignCanvas/JivvyCanvas"), { ssr: false });

interface InfiniteCanvasProps {
    className?: string;
    projectId?: string;
    blurAmount?: number;
}

export function InfiniteCanvas({
    className,
    blurAmount = 0
}: InfiniteCanvasProps) {
    return (
        <div className={cn("w-full h-full relative overflow-hidden", className)}>
            <div
                className="w-full h-full transition-all duration-300"
                style={{ filter: `blur(${blurAmount}px)` }}
            >
                <JivvyCanvas />
            </div>

            {/* Overlay for blur effect interactions if needed */}
            {blurAmount > 0 && (
                <div className="absolute inset-0 z-50 bg-transparent" />
            )}
        </div>
    );
}
