"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    Play,
    Clock,
    LayoutGrid,
    Library,
    Layers,
    Brain,
    BookOpen,
    PenTool,
    ChevronDown,
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Updated Data Model
type Asset = {
    id: string;
    title: string;
    type: "deck" | "note" | "paper" | "pdf";
};

type Project = {
    id: string;
    title: string;
    category: string;
    assets: Asset[];
    lastActive: string; // ISO date string or human readable
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
        lastActive: "24m ago",
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
        lastActive: "2h ago",
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
        lastActive: "1d ago",
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
        lastActive: "3d ago",
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

    // Standard CSS sticky positioning removes the need for complex scroll listeners
    // But we still track 'scrolled' for the Hero animation logic if we want it to fold away
    // For now, let's keep the hero logic but triggered by scroll position check on the container

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


    return (
        <div className="max-w-[1600px] mx-auto h-full flex flex-col relative bg-[#121212]">

            {/* --- HERO SECTION (Active Project Hub) --- */}
            <div
                className={cn(
                    "px-4 md:px-8 absolute inset-0 z-10 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
                    scrolled
                        ? "opacity-0 -translate-y-20 scale-95 pointer-events-none blur-sm"
                        : "opacity-100 translate-y-0 h-[60vh] pt-6"
                )}
            >
                {/* Active Project Card */}
                <Link href="/project/1">
                    <TiltCard
                        className="w-full max-w-4xl mx-auto bg-lime-400 text-zinc-950 flex flex-col justify-between p-8 md:p-12 rounded-3xl shadow-[0_30px_60px_-15px_rgba(163,230,53,0.3)] h-full relative group"
                        delay={0}
                    >
                        <div className="flex justify-between items-start z-10 relative">
                            <div className="bg-black/10 p-4 rounded-3xl backdrop-blur-md">
                                <Play
                                    size={32}
                                    className="fill-black text-black ml-1"
                                />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="bg-black/10 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                    Resume Session
                                </span>
                            </div>
                        </div>

                        <div className="z-10 relative mt-8">
                            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[0.9] tracking-tight mb-4 group-hover:scale-[1.02] transition-transform origin-left">
                                Adv. Calculus II
                            </h2>
                            <div className="flex items-center gap-6 opacity-80 font-medium text-lg">
                                <span className="flex items-center gap-2"><Clock size={20} /> 24m remaining</span>
                                <span className="w-1.5 h-1.5 bg-black rounded-full" />
                                <span>Canvas • PDF Open</span>
                            </div>
                        </div>

                        <div className="absolute -right-32 -bottom-32 w-[500px] h-[500px] bg-lime-300 rounded-full blur-[100px] opacity-60 pointer-events-none mix-blend-screen animate-blob" />
                    </TiltCard>
                </Link>

                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce text-zinc-500 flex flex-col items-center gap-2 pointer-events-none opacity-50">
                    <span className="text-xs font-bold uppercase tracking-widest">Scroll for Projects</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* --- CONTENT DRAWER --- */}
            <div
                ref={contentRef}
                className={cn(
                    "flex-1 overflow-y-auto no-scrollbar relative z-20 pt-[60vh] transition-all duration-700",
                    scrolled ? "pt-0" : ""
                )}
            >
                 {/* Sticky Filter Bar */}
                 <div className="sticky top-0 z-30 bg-[#121212]/90 backdrop-blur-md border-b border-zinc-800 py-4 px-4 md:px-8 mb-6 flex items-center justify-between">
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
                            {filteredProjects.map((item: Project, i: number) => (
                                <Link href={`/project/${item.id}`} key={item.id}>
                                    <TiltCard
                                        delay={i * 50}
                                        noTilt // Standardizing on less motion for lists, but allowing hover effects
                                        className={cn(item.color, "p-6 h-64 flex flex-col justify-between group border-2 border-transparent hover:border-white/20 rounded-3xl shadow-lg transition-all hover:-translate-y-1", item.textColor)}
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
                                                <span className="text-xs font-medium">{item.assets.length} items • {item.lastActive}</span>
                                            </div>
                                        </div>
                                    </TiltCard>
                                </Link>
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
                                             <Link href={`/project/${item.id}`} key={item.id}>
                                                  <TiltCard
                                                    noTilt
                                                    className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:bg-zinc-800 transition-colors group h-full flex flex-col justify-between"
                                                  >
                                                      <div className="flex items-start justify-between mb-4">
                                                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-black", item.color)}>
                                                                {item.category === 'Calculus' ? <Brain size={20} /> :
                                                                 item.category === 'Studio' ? <PenTool size={20} /> :
                                                                 <BookOpen size={20} />}
                                                           </div>
                                                           <span className="text-xs text-zinc-500 font-medium">{item.lastActive}</span>
                                                      </div>
                                                      <div>
                                                          <h4 className="text-xl font-bold text-white mb-2 group-hover:text-lime-400 transition-colors">{item.title}</h4>
                                                          <div className="text-sm text-zinc-400">
                                                              {item.assets.length} Assets
                                                          </div>
                                                      </div>
                                                  </TiltCard>
                                             </Link>
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
