"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    Play,
    LayoutGrid,
    Layers,
    BookOpen,
    ChevronRight,
    Plus,
    Loader2
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserProjects, type Project } from "@/app/project/actions";
import { TimelineStream } from "@/components/dashboard/TimelineStream";

// Color palette for projects (will cycle through based on index)
const PROJECT_COLORS = [
    { bg: "bg-lime-400", text: "text-zinc-950" },
    { bg: "bg-violet-500", text: "text-white" },
    { bg: "bg-amber-400", text: "text-zinc-950" },
    { bg: "bg-rose-500", text: "text-white" },
    { bg: "bg-cyan-400", text: "text-zinc-950" },
    { bg: "bg-orange-500", text: "text-white" },
];

// Helper to get color based on index or category
function getProjectColor(index: number) {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

// Format relative time
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
    const [showProjects, setShowProjects] = useState(true);
    const [scrolled, setScrolled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);

    const contentRef = useRef<HTMLDivElement>(null);

    // Fetch projects on mount
    useEffect(() => {
        async function fetchProjects() {
            setLoading(true);
            const { projects: data, error: fetchError } = await getUserProjects();
            if (fetchError) {
                setError(fetchError);
            } else {
                setProjects(data);
            }
            setLoading(false);
        }
        fetchProjects();
    }, []);

    // Handle scroll for hero animation (desktop only)
    useEffect(() => {
        const handleScroll = () => {
            if (contentRef.current) {
                const scrollTop = contentRef.current.scrollTop;
                if (scrollTop > 50 && !scrolled) {
                    setScrolled(true);
                } else if (scrollTop <= 10 && scrolled) {
                    setScrolled(false);
                }
            }
        };

        const el = contentRef.current;
        if (el) {
            el.addEventListener("scroll", handleScroll);
        }
        return () => {
            if (el) el.removeEventListener("scroll", handleScroll);
        };
    }, [scrolled]);

    const activeProject = projects[activeProjectIndex] || null;
    const activeColor = activeProject ? getProjectColor(activeProjectIndex) : PROJECT_COLORS[0];

    // Loading State
    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-lime-400" size={40} />
                    <p className="text-zinc-500 text-sm">Loading your projects...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error === "Not authenticated") {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <div className="text-center max-w-md p-8">
                    <Link href="/login"><button className="px-6 py-3 bg-lime-400 text-black font-bold rounded-full">Sign In</button></Link>
                </div>
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
        <div className="h-full flex flex-col lg:flex-row relative bg-background overflow-hidden">

            {/* === MOBILE LAYOUT === */}
            <div className="lg:hidden h-full flex flex-col overflow-hidden">
                {/* Mobile Hero - Featured Project */}
                {activeProject && (
                    <div className="flex-shrink-0 p-4 pb-2">
                        <Link href={`/project/${activeProject.id}`}>
                            <div
                                className={cn(
                                    "p-5 rounded-3xl shadow-lg relative overflow-hidden",
                                    activeColor.bg,
                                    activeColor.text
                                )}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="bg-black/10 p-3 rounded-2xl backdrop-blur-md">
                                        <Play size={24} className="fill-current ml-0.5" />
                                    </div>
                                    <span className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                        {activeProject.category || 'Project'}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold leading-tight mb-2">
                                    {activeProject.title}
                                </h2>
                                <div className="flex items-center gap-3 opacity-80 text-sm">
                                    <span className="flex items-center gap-1.5">
                                        <Layers size={14} />
                                        {activeProject.pdf_url ? '1 PDF' : 'No files'}
                                    </span>
                                    <span className="w-1 h-1 bg-current rounded-full opacity-50" />
                                    <span>Updated {formatRelativeTime(activeProject.updated_at || activeProject.created_at)}</span>
                                </div>
                                {/* Decorative */}
                                <div className="absolute -right-10 -bottom-10 w-[150px] h-[150px] bg-white/20 rounded-full blur-[50px] pointer-events-none" />
                            </div>
                        </Link>
                    </div>
                )}

                {/* Mobile Projects Grid */}
                <div className="flex-1 overflow-y-auto px-4 pb-24">
                    {/* Section Header */}
                    <div className="flex items-center justify-between py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">All Projects</span>
                            <span className="text-zinc-500 text-xs">({projects.length})</span>
                        </div>
                        <Link href="/project/new">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs text-white transition-colors">
                                <Plus size={14} />
                                New
                            </button>
                        </Link>
                    </div>

                    {/* Projects */}
                    <div className="grid grid-cols-2 gap-3">
                        {projects.map((project, index) => {
                            const color = getProjectColor(index);
                            return (
                                <Link
                                    key={project.id}
                                    href={`/project/${project.id}`}
                                >
                                    <div
                                        className={cn(
                                            "p-4 rounded-2xl transition-all active:scale-95",
                                            color.bg,
                                            color.text
                                        )}
                                    >
                                        <div className="bg-black/10 w-8 h-8 rounded-xl flex items-center justify-center mb-3">
                                            <BookOpen size={14} />
                                        </div>
                                        <h3 className="font-bold text-sm leading-tight line-clamp-2 mb-1">
                                            {project.title}
                                        </h3>
                                        <span className="text-[10px] opacity-70">
                                            {formatRelativeTime(project.updated_at || project.created_at)}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* === DESKTOP LAYOUT === */}
            {/* Hero Section (Active Project Hub) - Desktop Only */}
            <div
                className={cn(
                    "hidden lg:block relative z-10 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
                    "lg:static lg:h-full lg:pt-8 lg:pl-8 lg:pr-4",
                    showProjects ? "lg:w-[60%]" : "lg:w-full lg:pr-8",
                    scrolled
                        ? "pointer-events-none lg:pointer-events-auto"
                        : "overflow-hidden"
                )}
            >
                <div className="h-full grid grid-cols-6 gap-6 relative">

                    {/* Main Hero Card (Active Project) */}
                    <div className={cn(
                        "col-span-4 h-full transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)]",
                        scrolled ? "lg:transform-none" : ""
                    )}>
                        {activeProject && (
                            <TiltCard
                                className={cn(
                                    "h-full flex flex-col justify-between p-8 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden transition-colors duration-500",
                                    activeColor.bg,
                                    activeColor.text
                                )}
                                delay={0}
                            >
                                <div className="flex justify-between items-start z-10 relative">
                                    <Link href={`/project/${activeProject.id}`}>
                                        <div className="bg-black/10 p-4 rounded-3xl backdrop-blur-md hover:bg-black/20 transition-colors cursor-pointer">
                                            <Play
                                                size={32}
                                                className={cn("fill-current ml-1", activeColor.text === 'text-white' ? 'text-white' : 'text-black')}
                                            />
                                        </div>
                                    </Link>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="bg-black/10 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                            {activeProject.category || 'Project'}
                                        </span>
                                    </div>
                                </div>

                                <div className="z-10 relative mt-8">
                                    <h2 className="text-5xl lg:text-6xl font-bold leading-[0.9] tracking-tight mb-3">
                                        {activeProject.title}
                                    </h2>
                                    <div className="flex items-center gap-4 opacity-80 font-medium text-lg">
                                        <span className="flex items-center gap-2">
                                            <Layers size={18} />
                                            {activeProject.pdf_url ? '1 PDF' : 'No files'}
                                        </span>
                                        <span className="w-1.5 h-1.5 bg-current rounded-full opacity-50" />
                                        <span>Updated {formatRelativeTime(activeProject.updated_at || activeProject.created_at)}</span>
                                    </div>
                                </div>

                                {/* Decorative blob */}
                                <div className="absolute -right-20 -bottom-20 w-[300px] h-[300px] bg-white/20 rounded-full blur-[80px] pointer-events-none mix-blend-overlay animate-blob" />
                            </TiltCard>
                        )}
                    </div>

                    {/* The Stream Widget (Calendar) */}
                    <div className={cn(
                        "col-span-2 h-full transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] delay-75 relative group",
                        scrolled ? "lg:transform-none" : ""
                    )}>
                        <TimelineStream className="h-full" compact hasCornerAction={!showProjects} />

                        {!showProjects && (
                            <button
                                onClick={() => setShowProjects(true)}
                                className="absolute top-0 right-0 w-16 h-16 bg-lime-400 rounded-bl-[32px] rounded-tr-[24px] shadow-lg flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all duration-300 z-50 group-hover:shadow-[0_0_30px_rgba(163,230,53,0.4)]"
                                title="Show Projects"
                            >
                                <div className="absolute top-4 right-4">
                                    <LayoutGrid size={24} />
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Drawer (Project List) - Desktop Only */}
            <div
                ref={contentRef}
                className={cn(
                    "hidden lg:flex flex-1 overflow-y-auto no-scrollbar relative z-20",
                    "lg:pt-0 lg:h-full transition-all duration-500 ease-in-out",
                    showProjects ? "lg:w-[40%] opacity-100" : "lg:w-0 opacity-0 overflow-hidden pointer-events-none lg:p-0"
                )}
            >
                <div className="bg-background min-h-0 relative shadow-none lg:h-full flex flex-col w-full">
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 py-3 px-6 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowProjects(false)}
                                className="flex p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Hide List"
                            >
                                <ChevronRight size={20} />
                            </button>
                            <span className="font-bold text-white whitespace-nowrap">All Projects</span>
                            <span className="text-zinc-500 text-sm">({projects.length})</span>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    <div className="px-6 pb-8 pt-4 flex-1 w-full">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                            {/* Create Project Card */}
                            <Link href="/project/new">
                                <div className="h-40 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/50 transition-all cursor-pointer group">
                                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus size={24} />
                                    </div>
                                    <span className="font-bold text-sm uppercase tracking-wider">Create Project</span>
                                </div>
                            </Link>

                            {/* Project Cards */}
                            {projects.map((project, index) => {
                                const color = getProjectColor(index);
                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => setActiveProjectIndex(index)}
                                    >
                                        <Link href={`/project/${project.id}`}>
                                            <TiltCard
                                                delay={index * 50}
                                                noTilt
                                                className={cn(
                                                    color.bg,
                                                    "p-5 h-40 flex flex-col justify-between group border-2 border-transparent hover:border-white/20 rounded-3xl shadow-lg transition-all hover:-translate-y-1 cursor-pointer",
                                                    color.text,
                                                    activeProjectIndex === index ? "ring-4 ring-white/20 scale-[1.02]" : "opacity-90 hover:opacity-100"
                                                )}
                                            >
                                                <div className="flex justify-between items-start relative z-10">
                                                    <div className="bg-black/10 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md group-hover:rotate-12 transition-transform duration-300">
                                                        <BookOpen size={18} />
                                                    </div>
                                                    <div className="bg-black/10 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md uppercase tracking-wide">
                                                        {project.category || 'General'}
                                                    </div>
                                                </div>
                                                <div className="relative z-10">
                                                    <h3 className="text-xl font-bold leading-tight mb-2 group-hover:scale-105 transition-transform origin-left line-clamp-1">
                                                        {project.title}
                                                    </h3>
                                                    <div className="flex items-center gap-2 opacity-70">
                                                        <Layers size={12} />
                                                        <span className="text-[10px] font-medium">
                                                            {formatRelativeTime(project.updated_at || project.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TiltCard>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export { DashboardView };
