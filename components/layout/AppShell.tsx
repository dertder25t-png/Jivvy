"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ContextPanel } from "./ContextPanel";
import { PDFContextPanel } from "@/components/pdf/PDFContextPanel";
import { MobileHeader } from "./MobileHeader";
import { MobileNav } from "./MobileNav";
import { useProjectStore } from "@/lib/store";
import { useSync } from "@/lib/useSync";
import { Menu, PanelRight, X, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AppShell - Main layout wrapper following AGENT_CONTEXT architecture:
 * - Persistent Sidebar (Left) - hidden on mobile, collapsible on desktop
 * - Centered Workspace (Main) - responsive padding
 * - Sliding Context Panel (Right) - overlay on mobile
 * 
 * Responsive breakpoints:
 * - Mobile: < 768px (md) - Mobile header + bottom nav, no sidebar
 * - Tablet: 768px - 1024px (lg) - Collapsible sidebar
 * - Desktop: > 1024px - Full sidebar + context panel
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    // Responsive sidebar state - default closed on mobile
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const {
        contextPanelOpen,
        setContextPanelOpen
    } = useProjectStore();

    // Cloud-to-local sync on mount
    const { status: syncStatus, isOnline } = useSync({ enabled: true });

    // Handle responsive sidebar default state
    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        setIsSidebarOpen(mediaQuery.matches);
        
        const handler = (e: MediaQueryListEvent) => setIsSidebarOpen(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // Close sidebar when clicking overlay on mobile
    const handleOverlayClick = () => {
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-surface dark:bg-surface-dark overflow-hidden">
            {/* Mobile Header - visible only on mobile */}
            <MobileHeader />

            {/* Sidebar Overlay (mobile only) */}
            {isSidebarOpen && (
                <div 
                    className="lg:hidden fixed inset-0 bg-black/20 z-30"
                    onClick={handleOverlayClick}
                    aria-hidden="true"
                />
            )}

            {/* SIDEBAR (Left) */}
            <div className={cn(
                "fixed lg:relative inset-y-0 left-0 z-40 lg:z-0",
                "transform transition-transform duration-200 ease-out",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0"
            )}>
                <Sidebar isOpen={isSidebarOpen} />
            </div>

            {/* MAIN STAGE (Center) */}
            <main className="flex-1 flex flex-col h-full relative z-0 overflow-hidden bg-surface dark:bg-surface-dark">

                {/* Desktop Toggle Sidebar Button */}
                <div className="hidden lg:block absolute top-4 left-4 z-20">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                {/* Mobile Toggle Sidebar (hamburger in content area) */}
                <div className="lg:hidden absolute top-16 left-4 z-20">
                    <button 
                        onClick={() => setIsSidebarOpen(true)} 
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Container - responsive padding */}
                <div className="flex-1 overflow-y-auto">
                    <div className={cn(
                        "max-w-4xl mx-auto min-h-full",
                        "pt-20 lg:pt-16", // Account for mobile header
                        "px-4 sm:px-6 lg:px-8",
                        "pb-24 lg:pb-8" // Account for mobile nav
                    )}>
                        {children}
                    </div>
                </div>

            </main>

            {/* CONTEXT PANEL (Right) - slides in from right */}
            <ContextPanel isOpen={contextPanelOpen} onClose={() => setContextPanelOpen(false)}>
                <PDFContextPanel />
            </ContextPanel>

            {/* Sync Status Indicator + Toggle Context Panel Button */}
            <div className="hidden md:flex items-center gap-2 absolute top-4 right-4 z-20">
                {/* Sync Status */}
                <div className={cn(
                    "p-2 rounded-md text-xs flex items-center gap-1.5",
                    syncStatus === 'syncing' && "text-blue-500",
                    syncStatus === 'synced' && "text-green-500",
                    syncStatus === 'error' && "text-red-500",
                    syncStatus === 'offline' && "text-yellow-500",
                    syncStatus === 'idle' && "text-text-secondary"
                )}>
                    {syncStatus === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {syncStatus === 'synced' && <Cloud className="w-3 h-3" />}
                    {syncStatus === 'offline' && <CloudOff className="w-3 h-3" />}
                    {!isOnline && <span className="text-[10px]">Offline</span>}
                </div>

                <button
                    onClick={() => setContextPanelOpen(!contextPanelOpen)}
                    className={cn(
                        "p-2 rounded-md transition-colors",
                        contextPanelOpen 
                            ? "text-primary bg-primary/10" 
                            : "text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                    aria-label={contextPanelOpen ? "Close context panel" : "Open context panel"}
                >
                    <PanelRight className="w-5 h-5" />
                </button>
            </div>

            {/* Mobile Navigation - fixed bottom nav */}
            <MobileNav />
        </div>
    );
}
