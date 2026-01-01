"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

/**
 * Sliding Context Panel (Right) per AGENT_CONTEXT layout architecture.
 * - Full screen overlay on mobile
 * - 320px fixed panel on desktop
 * - Follows Calm aesthetic with subtle borders
 */
export function ContextPanel({ isOpen, onClose, children }: ContextPanelProps) {
    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/20 z-40"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            
            <div
                className={cn(
                    "fixed inset-y-0 right-0 z-50",
                    "w-full sm:w-96 md:w-80",
                    "bg-surface dark:bg-surface-dark border-l border-border",
                    "shadow-lg transform transition-transform duration-200 ease-out",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">Context</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        aria-label="Close context panel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto h-full pb-20">
                    {children}
                </div>
            </div>
        </>
    );
}
