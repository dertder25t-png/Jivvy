"use client";

import React, { useState, useEffect } from "react";
import {
    Play,
    LayoutGrid,
    Layers,
    BookOpen,
    Plus,
    Loader2,
    Calendar,
    ArrowRight
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserProjects, type Project } from "@/app/project/actions";
import { TimelineStream } from "@/components/dashboard/TimelineStream";

// Color palette for projects
const PROJECT_COLORS = [
    { bg: "bg-lime-400", text: "text-zinc-950" },
    { bg: "bg-violet-500", text: "text-white" },
    { bg: "bg-amber-400", text: "text-zinc-950" },
    { bg: "bg-rose-500", text: "text-white" },
    { bg: "bg-cyan-400", text: "text-zinc-950" },
    { bg: "bg-orange-500", text: "text-white" },
];

function getProjectColor(index: number) {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

const DashboardView = () => {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProjects() {
            setLoading(true);
            const { projects: data, error: fetchError } = await getUserProjects();
            if (fetchError) setError(fetchError);
            else setProjects(data);
            setLoading(false);
        }
        fetchProjects();
    }, []);

    const activeProject = projects[0] || null; // Most recent project
    const activeColor = activeProject ? getProjectColor(0) : PROJECT_COLORS[0];
    const recentProjects = projects.slice(1, 5); // Next 4 projects

    // Loading State
    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-lime-400" size={40} />
            </div>
        );
    }

    // Error State
    if (error === "Not authenticated") {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <Link href="/login"><button className="px-6 py-3 bg-lime-400 text-black font-bold rounded-full">Sign In</button></Link>
            </div>
        );
    }

    // Empty State
    if (projects.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <div className="text-center max-w-md p-8">
                    <h2 className="text-2xl font-bold text-white mb-3">Create Your First Project</h2>
                    <Link href="/project/new"><button className="px-8 py-4 bg-lime-400 text-black font-bold rounded-full">New Project</button></Link>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
            {/* Header / Greeting */}
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <Link href="/project/new" className="md:hidden">
                    <button className="bg-lime-400 text-black p-2 rounded-full shadow-lg">
                        <Plus size={20} />
                    </button>
                </Link>
            </div>

            {/* ADAPTIVE GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-min max-w-7xl mx-auto">

                {/* --- ZONE 1: ACTIVE PROJECT CARD --- */}
                {/* Mobile: Full Width | Desktop: Col-span-8, Row-span-2 */}
                <div className="col-span-1 md:col-span-8 row-span-2 h-64 md:h-[400px]">
                    {activeProject && (
                        <Link href={`/project/${activeProject.id}`} className="h-full block">
                            <TiltCard
                                className={cn(
                                    "h-full w-full p-6 md:p-10 rounded-3xl relative overflow-hidden flex flex-col justify-between group transition-all hover:scale-[1.01]",
                                    activeColor.bg,
                                    activeColor.text
                                )}
                            >
                                <div className="flex justify-between items-start z-10">
                                    <div className="bg-black/10 p-3 rounded-2xl backdrop-blur-md">
                                        <Play size={24} className="fill-current" />
                                    </div>
                                    <span className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                        {activeProject.category || 'Active Project'}
                                    </span>
                                </div>

                                <div className="z-10 mt-auto">
                                    <h2 className="text-4xl md:text-6xl font-black leading-none mb-4 tracking-tight">
                                        {activeProject.title}
                                    </h2>
                                    <div className="flex items-center gap-4 opacity-80 text-sm md:text-base font-medium">
                                        <span className="flex items-center gap-2">
                                            <Layers size={16} />
                                            {activeProject.pdf_url ? 'PDF Attached' : 'Canvas Only'}
                                        </span>
                                        <span className="w-1 h-1 bg-current rounded-full opacity-50" />
                                        <span>Edited {formatRelativeTime(activeProject.updated_at || activeProject.created_at)}</span>
                                    </div>
                                </div>

                                {/* Animated Blob */}
                                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/20 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                            </TiltCard>
                        </Link>
                    )}
                </div>

                {/* --- ZONE 2: STATS / QUICK ACTIONS --- */}
                {/* Mobile: Stacked | Desktop: Col-span-4 */}
                <div className="col-span-1 md:col-span-4 grid grid-cols-2 gap-4 h-full">
                    {/* Create New Data Tile */}
                    <Link href="/project/new" className="col-span-1 h-32 md:h-auto">
                        <div className="h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:bg-zinc-800/80 transition-colors group cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-lime-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Plus size={20} className="text-lime-400" />
                            </div>
                            <span className="font-bold text-white text-sm">New Project</span>
                        </div>
                    </Link>

                    {/* Calendar Tile */}
                    <Link href="/calendar" className="col-span-1 h-32 md:h-auto">
                        <div className="h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:bg-zinc-800/80 transition-colors group cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Calendar size={20} className="text-amber-400" />
                            </div>
                            <span className="font-bold text-white text-sm">Schedule</span>
                        </div>
                    </Link>

                    {/* Timeline Stream Preview (Desktop Only) */}
                    <div className="hidden md:block col-span-2 flex-1 min-h-[140px] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden p-1">
                        <TimelineStream className="h-full w-full" compact hasCornerAction={false} />
                    </div>
                </div>


                {/* --- ZONE 3: RECENT PROJECTS --- */}
                <div className="col-span-1 md:col-span-12 mt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Recent Projects</h3>
                        <Link href="/library" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                            View all <ArrowRight size={12} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {recentProjects.map((project, index) => {
                            // Helper to cycle colors
                            const color = getProjectColor(index + 1);
                            return (
                                <Link key={project.id} href={`/project/${project.id}`}>
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-lime-400/30 hover:bg-zinc-800 transition-all group h-40 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-black font-bold", color.bg)}>
                                                <BookOpen size={16} />
                                            </div>
                                            <div className="bg-black/30 px-2 py-1 rounded-md text-[10px] text-zinc-400 font-mono">
                                                {project.category?.substring(0, 3).toUpperCase() || 'GEN'}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-white truncate group-hover:text-lime-400 transition-colors">
                                                {project.title}
                                            </h4>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                {formatRelativeTime(project.updated_at || project.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>

            </div>

            {/* Spacer for mobile bottom nav */}
            <div className="h-20 md:h-0" />
        </div>
    );
};

export { DashboardView };
