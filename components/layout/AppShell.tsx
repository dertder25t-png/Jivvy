"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar"; // Import the new Sidebar
import { ContextPanel } from "./ContextPanel";
import { PDFContextPanel } from "@/components/pdf/PDFContextPanel";
import { useProjectStore } from "@/lib/store";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const {
        contextPanelOpen,
        setContextPanelOpen
    } = useProjectStore();

    return (
        <div className="flex h-screen w-screen bg-surface dark:bg-background overflow-hidden font-geist">

            {/* SIDEBAR (Left) - Using the new separate component */}
            <Sidebar isOpen={isSidebarOpen} />

            {/* MAIN STAGE (Center) */}
            <main className="flex-1 flex flex-col h-full relative z-0 overflow-hidden bg-surface transition-all duration-300">

                {/* Toggle Sidebar Button (Mobile/Desktop) */}
                <div className="absolute top-4 left-4 z-40">
                    {!isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-100 rounded-md">
                            <Menu className="w-5 h-5 text-text-secondary" />
                        </button>
                    )}
                    {isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-1 text-text-secondary hover:bg-zinc-100 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-2"
                            title="Close Sidebar"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto pt-16 px-6 pb-20 min-h-full">
                        {children}
                    </div>
                </div>

            </main>

            {/* CONTEXT PANEL (Right) */}
            <ContextPanel isOpen={contextPanelOpen} onClose={() => setContextPanelOpen(false)}>
                <PDFContextPanel />
            </ContextPanel>

            {/* Toggle Context Panel (Debug/Dev for now) - kept from original */}
            <div className="absolute top-4 right-4 z-40">
                <button
                    onClick={() => setContextPanelOpen(!contextPanelOpen)}
                    className="p-2 text-text-secondary hover:bg-zinc-100 rounded-md"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

        </div>
    );
}
