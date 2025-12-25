"use client";

import React, { useState } from "react";
import {
    Inbox,
    Calendar,
    CalendarDays,
    Trash2,
    Settings,
    Menu,
    ChevronRight,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextPanel } from "./ContextPanel";

// Mock data for projects (replace with Dexie later)
const MOCK_PROJECTS = [
    { id: "1", name: "Personal", color: "bg-red-500" },
    { id: "2", name: "Work", color: "bg-blue-500" },
    { id: "3", name: "Learning", color: "bg-green-500" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
    const [projectsExpanded, setProjectsExpanded] = useState(true);

    // Todoist-like Sidebar Item
    const SidebarItem = ({ icon: Icon, label, count, active }: any) => (
        <button
            className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-text-primary"
            )}
        >
            <Icon className="w-4 h-4" />
            <span className="flex-1 text-left">{label}</span>
            {count && <span className="text-xs opacity-60">{count}</span>}
        </button>
    );

    return (
        <div className="flex h-screen w-screen bg-surface dark:bg-background overflow-hidden">

            {/* SIDEBAR (Left) */}
            <aside
                className={cn(
                    "flex-shrink-0 bg-background dark:bg-surface-dark border-r-0 transform transition-all duration-300 ease-in-out flex flex-col",
                    isSidebarOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 overflow-hidden"
                )}
            >
                {/* User Header */}
                <div className="h-14 flex items-center px-4 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium">
                            U
                        </div>
                        <span className="text-sm font-medium text-text-primary">User Name</span>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="px-2 space-y-0.5">
                    <SidebarItem icon={Inbox} label="Inbox" count="4" />
                    <SidebarItem icon={Calendar} label="Today" count="2" active />
                    <SidebarItem icon={CalendarDays} label="Upcoming" />
                </div>

                {/* Projects Tree */}
                <div className="mt-6 px-2">
                    <div
                        className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary"
                        onClick={() => setProjectsExpanded(!projectsExpanded)}
                    >
                        <span>Projects</span>
                        {projectsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>

                    {projectsExpanded && (
                        <div className="mt-1 space-y-0.5">
                            {MOCK_PROJECTS.map((project) => (
                                <button
                                    key={project.id}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <span className={cn("w-2 h-2 rounded-full", project.color)} />
                                    <span>{project.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-auto p-4 border-t border-border/50">
                    <SidebarItem icon={Trash2} label="Trash" />
                    <SidebarItem icon={Settings} label="Settings" />
                </div>
            </aside>

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
                    <div className="max-w-3xl mx-auto pt-16 px-6 pb-20 min-h-full">
                        {/* Header */}
                        <header className="mb-8">
                            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Today</h1>
                            <p className="text-text-secondary text-sm mt-1">
                                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                            </p>
                        </header>

                        {children}
                    </div>
                </div>

            </main>

            {/* CONTEXT PANEL (Right) */}
            <ContextPanel isOpen={isContextPanelOpen} onClose={() => setIsContextPanelOpen(false)}>
                <div className="p-4">
                    <p className="text-sm text-text-secondary">Select a task to see details.</p>
                </div>
            </ContextPanel>

            {/* Toggle Context Panel (Debug/Dev for now) */}
            <div className="absolute top-4 right-4 z-40">
                <button
                    onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
                    className="p-2 text-text-secondary hover:bg-zinc-100 rounded-md"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

        </div>
    );
}
