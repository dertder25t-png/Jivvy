"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    Play,
    LayoutGrid,
    Library,
    Layers,
    Brain,
    BookOpen,
    PenTool,
    ChevronDown,
    ListTodo,
    Activity,
    Plus
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Updated Data Model with Tasks and Stats
type Asset = {
    id: string;
    title: string;
    type: "deck" | "note" | "paper" | "pdf";
};

type Task = {
    id: string;
    title: string;
    completed: boolean;
};

type ProjectStats = {
    progress: number; // 0-100
    tasksDue: number;
    totalTasks: number;
};

type Project = {
    id: string;
    title: string;
    category: string;
    assets: Asset[];
    recentFile: string; // URL or ID to resume
    stats: ProjectStats;
    tasks: Task[];
    color: string;
    textColor: string;
};

const PROJECTS: Project[] = [
    {
        id: "1",
        title: "Adv. Calculus II",
        category: "Calculus",
        color: "bg-lime-400",
        textColor: "text-zinc-950",
        recentFile: "/project/1",
        stats: { progress: 65, tasksDue: 2, totalTasks: 5 },
        tasks: [
            { id: "t1", title: "Review Chapter 4", completed: false },
            { id: "t2", title: "Practice Problems set B", completed: false },
            { id: "t3", title: "Submit Midterm Prep", completed: true },
        ],
        assets: [
            { id: "a1", title: "Derivatives & Integrals", type: "deck" },
            { id: "a2", title: "Midterm Review", type: "note" },
        ]
    },
    {
        id: "2",
        title: "Modernism History",
        category: "Design History",
        color: "bg-violet-500",
        textColor: "text-white",
        recentFile: "/project/2",
        stats: { progress: 30, tasksDue: 1, totalTasks: 4 },
        tasks: [
            { id: "t4", title: "Read Bauhaus Manifesto", completed: false },
            { id: "t5", title: "Draft Essay Outline", completed: true },
        ],
        assets: [
            { id: "b1", title: "Bauhaus Principles", type: "note" },
            { id: "b2", title: "Modernism vs Post-Modernism", type: "paper" },
        ]
    },
    {
        id: "3",
        title: "Econ Impact of AI",
        category: "Macro-Econ",
        color: "bg-amber-400",
        textColor: "text-zinc-950",
        recentFile: "/project/3",
        stats: { progress: 80, tasksDue: 0, totalTasks: 3 },
        tasks: [
            { id: "t6", title: "Final Polish", completed: true },
            { id: "t7", title: "Submit to Canvas", completed: true },
        ],
        assets: [
            { id: "c1", title: "Draft v2", type: "paper" },
            { id: "c2", title: "Research Notes", type: "pdf" },
        ]
    },
    {
        id: "4",
        title: "Brutalist UI",
        category: "Studio",
        color: "bg-rose-500",
        textColor: "text-white",
        recentFile: "/project/4",
        stats: { progress: 15, tasksDue: 3, totalTasks: 6 },
        tasks: [
            { id: "t8", title: "Moodboard", completed: true },
            { id: "t9", title: "Wireframes", completed: false },
            { id: "t10", title: "High-fi mocks", completed: false },
        ],
        assets: [
            { id: "d1", title: "Concepts", type: "deck" },
            { id: "d2", title: "Sketches", type: "pdf" },
        ]
    },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; accent: string }> = {
    Calculus: { bg: "bg-lime-400", text: "text-zinc-950", accent: "bg-black/10" },
    "Design History": {
        bg: "bg-violet-500",
        text: "text-white",
        accent: "bg-white/20",
    },
    "Macro-Econ": {
        bg: "bg-amber-400",
        text: "text-zinc-950",
        accent: "bg-black/10",
    },
    Studio: { bg: "bg-rose-500", text: "text-white", accent: "bg-white/20" },
};

const DashboardView = () => {
    const [scrolled, setScrolled] = useState(false);
    const [filterType, setFilterType] = useState("all");
    const [viewMode, setViewMode] = useState("grid");
    const [activeProjectId, setActiveProjectId] = useState(PROJECTS[0].id);

    const activeProject = PROJECTS.find(p => p.id === activeProjectId) || PROJECTS[0];

    const contentRef = useRef<HTMLDivElement>(null);

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


    const handleViewChange = (mode: string) => {
        if (document.startViewTransition) {
            document.startViewTransition(() => setViewMode(mode));
        } else {
            setViewMode(mode);
        }
    };

    const filteredProjects = filterType === 'all'
        ? PROJECTS
        : PROJECTS.filter(p => p.assets.some(a => a.type === filterType) || p.category.toLowerCase().includes(filterType.toLowerCase()));

    const groupedProjects = filteredProjects.reduce((acc: Record<string, Project[]>, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    const handleProjectClick = (id: string) => {
        setActiveProjectId(id);
        // Optional: Close drawer if we were fully mobile, but here we just update context
        // Ideally we scroll back up if scrolled down to see the change?
        if (scrolled && contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };


    return (
        <div className="max-w-[1600px] mx-auto h-full flex flex-col relative bg-background">

            {/* --- HERO SECTION (Active Project Hub) --- */}
            <div
                className={cn(
                    "px-4 md:px-8 absolute inset-0 z-10 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
                    scrolled
                        ? "opacity-0 -translate-y-20 scale-95 pointer-events-none blur-sm"
                        : "opacity-100 translate-y-0 h-[60vh] pt-6"
                )}
            >
                <div className="h-full grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 grid-rows-[repeat(auto-fit,minmax(0,1fr))] md:grid-rows-6">

                    {/* Main Hero Card (Active Project) */}
                    <TiltCard
                        className={cn(
                            "col-span-1 md:col-span-2 lg:col-span-3 row-span-2 md:row-span-4 flex flex-col justify-between p-6 md:p-8 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden transition-colors duration-500",
                            activeProject.color,
                            activeProject.textColor
                        )}
                        delay={0}
                    >
                        <div className="flex justify-between items-start z-10 relative">
                            <div className="bg-black/10 p-4 rounded-3xl backdrop-blur-md">
                                <Link href={activeProject.recentFile}>
                                    <Play
                                        size={32}
                                        className={cn("fill-current ml-1", activeProject.textColor === 'text-white' ? 'text-white' : 'text-black')}
                                    />
                                </Link>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="bg-black/10 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                    Active Project
                                </span>
                            </div>
                        </div>

                        <div className="z-10 relative mt-8">
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[0.9] tracking-tight mb-3">
                                {activeProject.title}
                            </h2>
                            <div className="flex items-center gap-4 opacity-80 font-medium text-sm md:text-lg">
                                <span className="flex items-center gap-2"><Layers size={18} /> {activeProject.assets.length} Assets</span>
                                <span className="w-1.5 h-1.5 bg-current rounded-full opacity-50" />
                                <span>{activeProject.category}</span>
                            </div>
                        </div>

                        {/* Decorative blob based on color */}
                        <div className="absolute -right-20 -bottom-20 w-[300px] h-[300px] bg-white/20 rounded-full blur-[80px] pointer-events-none mix-blend-overlay animate-blob" />
                    </TiltCard>

                    {/* Project Progress Widget */}
                    <TiltCard
                        className="col-span-1 md:col-span-2 lg:col-span-1 row-span-2 md:row-span-4 bg-surface border border-zinc-800 p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden"
                        delay={100}
                        noTilt
                    >
                        <div className="flex justify-between items-start z-10">
                            <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-white">
                                <Activity size={20} />
                            </div>
                            <span className="text-xs font-bold text-zinc-500 uppercase">Progress</span>
                        </div>

                        <div className="space-y-2 z-10 my-4">
                            <div className="text-4xl font-bold text-white">{activeProject.stats.progress}%</div>
                            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", activeProject.color)}
                                    style={{ width: `${activeProject.stats.progress}%` }}
                                />
                            </div>
                            <div className="text-xs text-zinc-400 mt-2">
                                {activeProject.stats.tasksDue} tasks remaining
                            </div>
                        </div>
                    </TiltCard>

                    {/* Tasks Widget */}
                    <TiltCard className="hidden md:flex col-span-1 md:col-span-2 lg:col-span-2 row-span-3 bg-surface border border-zinc-800 p-6 rounded-3xl flex-col" delay={150} noTilt>
                        <div className="flex justify-between items-center text-zinc-400 mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><ListTodo size={16} /> Up Next in {activeProject.title}</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-20", activeProject.textColor === 'text-white' ? 'bg-white text-white' : 'bg-black text-lime-400')}>
                                {activeProject.tasks.filter(t => !t.completed).length} Due
                            </span>
                        </div>
                        <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                            {activeProject.tasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-zinc-800/50 rounded-xl cursor-pointer group transition-colors border border-transparent hover:border-zinc-800">
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                        task.completed ? "bg-zinc-700 border-zinc-700" : "border-zinc-600 group-hover:border-zinc-400"
                                    )}>
                                        {task.completed && <div className="w-2.5 h-2.5 bg-zinc-400 rounded-full" />}
                                    </div>
                                    <span className={cn("text-sm font-medium transition-all", task.completed ? "text-zinc-500 line-through" : "text-zinc-300 group-hover:text-white")}>
                                        {task.title}
                                    </span>
                                </div>
                            ))}
                            {activeProject.tasks.length === 0 && (
                                <div className="text-zinc-500 text-sm italic">No active tasks.</div>
                            )}
                        </div>
                    </TiltCard>

                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-zinc-500 flex flex-col items-center gap-1 pointer-events-none opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Projects</span>
                    <ChevronDown size={14} />
                </div>
            </div>

            {/* --- CONTENT DRAWER (Project Switcher) --- */}
            <div
                ref={contentRef}
                className={cn(
                    "flex-1 overflow-y-auto no-scrollbar relative z-20 pt-[60vh] transition-all duration-700",
                    scrolled ? "pt-0" : ""
                )}
            >
                 {/* Sticky Filter Bar */}
                 <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-zinc-800 py-4 px-4 md:px-8 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                         {['All', 'Decks', 'Notes', 'Papers', 'Studio'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterType(f.toLowerCase() === 'all' ? 'all' : f.toLowerCase().startsWith('studio') ? 'sketch' : f.toLowerCase().startsWith('deck') ? 'deck' : f.toLowerCase().startsWith('note') ? 'note' : 'paper')}
                                className={cn("px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                                    (filterType === 'all' && f === 'All') || (filterType === 'sketch' && f === 'Studio') || (filterType === 'deck' && f === 'Decks') || (filterType === 'note' && f === 'Notes') || (filterType === 'paper' && f === 'Papers')
                                        ? 'bg-lime-400 text-zinc-950 shadow-[0_0_15px_rgba(163,230,53,0.3)] scale-105'
                                        : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 border border-zinc-800'
                                )}
                            >{f}</button>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center bg-zinc-900 p-1 rounded-full border border-zinc-800 shrink-0 ml-4">
                        <button onClick={() => handleViewChange('grid')} className={cn("p-2 rounded-full transition-all duration-300", viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white')}><LayoutGrid size={16} /></button>
                        <button onClick={() => handleViewChange('class')} className={cn("p-2 rounded-full transition-all duration-300", viewMode === 'class' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white')}><Library size={16} /></button>
                    </div>
                 </div>

                {/* Projects Grid */}
                <div className="px-4 md:px-8 pb-32 min-h-screen">
                    {viewMode === 'grid' ? (
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

                            {filteredProjects.map((item: Project, i: number) => (
                                <div key={item.id} onClick={() => handleProjectClick(item.id)}>
                                    <TiltCard
                                        delay={i * 50}
                                        noTilt // Standardizing on less motion for lists, but allowing hover effects
                                        className={cn(
                                            item.color,
                                            "p-6 h-64 flex flex-col justify-between group border-2 border-transparent hover:border-white/20 rounded-3xl shadow-lg transition-all hover:-translate-y-1 cursor-pointer",
                                            item.textColor,
                                            activeProjectId === item.id ? "ring-4 ring-white/20 scale-[1.02]" : "opacity-90 hover:opacity-100"
                                        )}
                                    >
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="bg-black/10 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md group-hover:rotate-12 transition-transform duration-300">
                                                {/* Heuristic icon selection based on first asset or category */}
                                                {item.category === 'Calculus' ? <Brain size={24} /> :
                                                 item.category === 'Studio' ? <PenTool size={24} /> :
                                                 <BookOpen size={24} />}
                                            </div>
                                            <div className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wide">
                                                {item.category}
                                            </div>
                                        </div>
                                        <div className="relative z-10">
                                            <h3 className="text-2xl font-bold leading-tight mb-3 group-hover:scale-105 transition-transform origin-left line-clamp-2">
                                                {item.title}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                 {item.assets.map(a => (
                                                     <span key={a.id} className="text-xs font-bold uppercase bg-black/10 px-2 py-0.5 rounded border border-black/5">
                                                         {a.type}
                                                     </span>
                                                 ))}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-70">
                                                <Layers size={14} />
                                                <span className="text-xs font-medium">{item.assets.length} items • {item.stats.progress}% Done</span>
                                            </div>
                                        </div>
                                    </TiltCard>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-12">
                             {Object.entries(groupedProjects).map(([category, items]) => (
                                <div key={category} className="space-y-4">
                                     <h3 className="text-2xl font-bold text-white px-2 flex items-center gap-3">
                                         <div className={cn("w-3 h-8 rounded-full", CATEGORY_STYLES[category]?.bg || "bg-zinc-700")} />
                                         {category}
                                     </h3>
                                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                         {items.map((item: Project) => (
                                             <div key={item.id} onClick={() => handleProjectClick(item.id)}>
                                                  <TiltCard
                                                    noTilt
                                                    className={cn(
                                                        "bg-surface border border-zinc-800 p-6 rounded-3xl hover:bg-zinc-800 transition-colors group h-full flex flex-col justify-between cursor-pointer",
                                                        activeProjectId === item.id ? "border-lime-400" : ""
                                                    )}
                                                  >
                                                      <div className="flex items-start justify-between mb-4">
                                                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-black", item.color)}>
                                                                {item.category === 'Calculus' ? <Brain size={20} /> :
                                                                 item.category === 'Studio' ? <PenTool size={20} /> :
                                                                 <BookOpen size={20} />}
                                                           </div>
                                                           <span className="text-xs text-zinc-500 font-medium">{item.stats.progress}% Done</span>
                                                      </div>
                                                      <div>
                                                          <h4 className="text-xl font-bold text-white mb-2 group-hover:text-lime-400 transition-colors">{item.title}</h4>
                                                          <div className="text-sm text-zinc-400">
                                                              {item.assets.length} Assets
                                                          </div>
                                                      </div>
                                                  </TiltCard>
                                             </div>
                                         ))}
                                     </div>
                                </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export { DashboardView };
