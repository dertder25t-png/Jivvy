"use client";

import React from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "vaul";

interface ResponsiveDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger?: React.ReactNode;
    children: React.ReactNode;
    title?: string;
    className?: string;
    side?: "right" | "bottom"; // Desktop side (always bottom on mobile)
}

export function ResponsiveDrawer({
    open,
    onOpenChange,
    trigger,
    children,
    title,
    className,
    side = "right"
}: ResponsiveDrawerProps) {

    // Mobile: Use Vaul Drawer (Bottom Sheet)
    // Desktop: Use Fixed Side Panel

    return (
        <>
            {/* Trigger */}
            {trigger && (
                <div onClick={() => onOpenChange(true)}>{trigger}</div>
            )}

            {/* MOBILE: Bottom Sheet (Vaul) */}
            <div className="lg:hidden">
                <Drawer.Root open={open} onOpenChange={onOpenChange}>
                    <Drawer.Portal>
                        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
                        <Drawer.Content className={cn("bg-zinc-900 flex flex-col rounded-t-[10px] h-[85vh] fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800", className)}>
                            <div className="bg-zinc-900 rounded-t-[10px] flex-1 flex flex-col h-full">
                                <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-4" />
                                <div className="flex justify-between items-center px-4 mb-2">
                                    {title && <Drawer.Title className="font-bold text-white text-lg">{title}</Drawer.Title>}
                                    <button onClick={() => onOpenChange(false)} className="bg-zinc-800 p-2 rounded-full">
                                        <X size={20} className="text-zinc-400" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 pb-safe">
                                    {children}
                                </div>
                            </div>
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.Root>
            </div>

            {/* DESKTOP: Side Panel */}
            <div className={cn(
                "hidden lg:block fixed z-40 bg-background border-l border-zinc-800 transition-transform duration-300 shadow-2xl",
                side === "right" ? "top-0 right-0 bottom-0 w-[400px]" : "bottom-0 left-0 right-0 h-[400px] border-t border-zinc-800",
                open ? "translate-x-0" : "translate-x-full", // For right side
                // Add logic for bottom side if needed
                className
            )}>
                {/* If open, show panel */}
                {open && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <h3 className="font-bold text-white">{title}</h3>
                            <button onClick={() => onOpenChange(false)} className="hover:bg-zinc-800 p-2 rounded-lg transition-colors">
                                <ChevronRight size={20} className="text-zinc-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
