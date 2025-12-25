"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

export function ContextPanel({ isOpen, onClose, children }: ContextPanelProps) {
    return (
        <div
            className={cn(
                "fixed inset-y-0 right-0 z-50 w-80 bg-surface border-l border-border shadow-lg transform transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-secondary">Context</h2>
                <button
                    onClick={onClose}
                    className="p-1 text-text-secondary hover:text-text-primary hover:bg-background rounded-md transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20">
                {children}
            </div>
        </div>
    );
}
