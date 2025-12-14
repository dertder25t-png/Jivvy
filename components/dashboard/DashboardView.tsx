"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    Play,
    LayoutGrid,
    Layers,
    BookOpen,
    ChevronDown,
    Plus,
    Loader2,
    FolderOpen,
    Sparkles
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserProjects, type Project } from "@/app/project/actions";

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

    // Handle scroll for hero animation
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
                    <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="text-lime-400" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Welcome to Jivvy</h2>
                    <p className="text-zinc-400 mb-6">Sign in to access your projects and start creating.</p>
                    <Link href="/login">
                        <button className="px-6 py-3 bg-lime-400 text-black font-bold rounded-full hover:bg-lime-300 transition-colors shadow-[0_0_20px_rgba(163,230,53,0.3)]">
                            Sign In
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    // Empty State - No Projects
    if (projects.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <div className="text-center max-w-md p-8">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-lime-400/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="text-lime-400" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Create Your First Project</h2>
                    <p className="text-zinc-400 mb-8">Start organizing your work with Jivvy. Upload a PDF design brief or just start with a blank canvas.</p>
                    <Link href="/project/new">
                        <button className="px-8 py-4 bg-lime-400 text-black font-bold rounded-full hover:bg-lime-300 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] flex items-center gap-3 mx-auto hover:scale-105">
                            <Plus size={20} />
                            New Project
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto h-full flex flex-col relative bg-background">

            {/* --- HERO SECTION (Active Project Hub) --- */}
            <div
                className={cn(
                    "px-4 md:px-8 absolute inset-0 z-10 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
                    scrolled
                        ? "opacity-0 -translate-y-20 scale-95 pointer-events-none blur-sm"
                        : "opacity-100 translate-y-0 h-[50vh] pt-6"
                )}
            >
                <div className="h-full grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">

                    {/* Main Hero Card (Active Project) */}
                    {activeProject && (
                        <TiltCard
                            className={cn(
                                "col-span-1 md:col-span-2 lg:col-span-4 row-span-2 flex flex-col justify-between p-6 md:p-8 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden transition-colors duration-500",
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
                                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[0.9] tracking-tight mb-3">
                                    {activeProject.title}
                                </h2>
                                <div className="flex items-center gap-4 opacity-80 font-medium text-sm md:text-lg">
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

                    {/* Quick Stats Card */}
                    <TiltCard
                        className="hidden md:flex col-span-1 md:col-span-2 lg:col-span-2 row-span-2 bg-surface border border-zinc-800 p-6 rounded-3xl flex-col justify-between relative overflow-hidden"
                        delay={100}
                        noTilt
                    >
                        <div className="flex justify-between items-start z-10">
                            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-white">
                                <FolderOpen size={24} />
                            </div>
                            <span className="text-xs font-bold text-zinc-500 uppercase">Your Library</span>
                        </div>

                        <div className="space-y-2 z-10 my-4">
                            <div className="text-5xl font-bold text-white">{projects.length}</div>
                            <div className="text-sm text-zinc-400">
                                {projects.length === 1 ? 'Project' : 'Projects'}
                            </div>
                        </div>

                        <Link href="/project/new">
                            <button className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                                <Plus size={18} />
                                New Project
                            </button>
                        </Link>
                    </TiltCard>

                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-zinc-500 flex flex-col items-center gap-1 pointer-events-none opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest">All Projects</span>
                    <ChevronDown size={14} />
                </div>
            </div>

            {/* --- CONTENT DRAWER (Project List) --- */}
            <div
                ref={contentRef}
                className={cn(
                    "flex-1 overflow-y-auto no-scrollbar relative z-20 pt-[50vh] transition-all duration-700",
                    scrolled ? "pt-0" : ""
                )}
            >
                {/* Sticky Header */}
                <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-zinc-800 py-4 px-4 md:px-8 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LayoutGrid size={18} className="text-lime-400" />
                        <span className="font-bold text-white">All Projects</span>
                        <span className="text-zinc-500 text-sm">({projects.length})</span>
                    </div>
                </div>

                {/* Projects Grid */}
                <div className="px-4 md:px-8 pb-32 min-h-screen">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                        {/* Create Project Card */}
                        <Link href="/project/new">
                            <div className="h-64 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/50 transition-all cursor-pointer group">
                                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus size={32} />
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
                                                "p-6 h-64 flex flex-col justify-between group border-2 border-transparent hover:border-white/20 rounded-3xl shadow-lg transition-all hover:-translate-y-1 cursor-pointer",
                                                color.text,
                                                activeProjectIndex === index ? "ring-4 ring-white/20 scale-[1.02]" : "opacity-90 hover:opacity-100"
                                            )}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="bg-black/10 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md group-hover:rotate-12 transition-transform duration-300">
                                                    <BookOpen size={24} />
                                                </div>
                                                <div className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wide">
                                                    {project.category || 'General'}
                                                </div>
                                            </div>
                                            <div className="relative z-10">
                                                <h3 className="text-2xl font-bold leading-tight mb-3 group-hover:scale-105 transition-transform origin-left line-clamp-2">
                                                    {project.title}
                                                </h3>
                                                <div className="flex items-center gap-2 opacity-70">
                                                    <Layers size={14} />
                                                    <span className="text-xs font-medium">
                                                        Updated {formatRelativeTime(project.updated_at || project.created_at)}
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
    );
};

export { DashboardView };
