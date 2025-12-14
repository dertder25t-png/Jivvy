"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    Play,
    Clock,
    Music2,
    Activity,
    Calendar,
    ListTodo,
    Plus,
    ArrowDown,
    LayoutGrid,
    Library,
    Layers,
    MoreHorizontal,
    Brain,
    BookOpen,
    FileText,
    PenTool,
} from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";

// Mock Data
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
    Psychology: {
        bg: "bg-cyan-400",
        text: "text-zinc-950",
        accent: "bg-black/10",
    },
};

interface LibraryItem {
    id: number;
    title: string;
    type: string;
    category: string;
    count: string;
    color: string;
    textColor: string;
    icon: React.ReactElement;
}

const LIBRARY_ITEMS: LibraryItem[] = [
    {
        id: 1,
        title: "Adv. Calculus II",
        type: "deck",
        category: "Calculus",
        count: "24 items",
        color: "bg-lime-400",
        textColor: "text-zinc-900",
        icon: <Brain size={24} />,
    },
    {
        id: 2,
        title: "Modernism vs Post-Modernism",
        type: "note",
        category: "Design History",
        count: "12 pages",
        color: "bg-violet-500",
        textColor: "text-white",
        icon: <BookOpen size={24} />,
    },
    {
        id: 3,
        title: "The Economic Impact of AI",
        type: "paper",
        category: "Macro-Econ",
        count: "Draft v2",
        color: "bg-amber-400",
        textColor: "text-zinc-900",
        icon: <FileText size={24} />,
    },
    {
        id: 4,
        title: "BrutalistUI Concepts",
        type: "sketch",
        category: "Studio",
        count: "8 pngs",
        color: "bg-rose-500",
        textColor: "text-white",
        icon: <PenTool size={24} />,
    },
    {
        id: 5,
        title: "Derivatives & Integrals",
        type: "deck",
        category: "Calculus",
        count: "18 items",
        color: "bg-lime-300",
        textColor: "text-zinc-900",
        icon: <Brain size={24} />,
    },
    {
        id: 6,
        title: "Bauhaus Principles",
        type: "note",
        category: "Design History",
        count: "5 pages",
        color: "bg-violet-400",
        textColor: "text-white",
        icon: <BookOpen size={24} />,
    },
];

const DashboardView = () => {
    // State management lifted from Mock_UI's App component logic relevant to Dashboard
    const [scrolled, setScrolled] = useState(false);
    const [filterType, setFilterType] = useState("all");
    const [viewMode, setViewMode] = useState("grid");

    const contentRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef(0);

    // Enhanced Scroll & Touch Trigger Logic
    useEffect(() => {
        // 1. Mouse Wheel Logic
        const handleWheel = (e: WheelEvent) => {
            // Small threshold to prevent accidental triggers
            if (!scrolled && e.deltaY > 30) {
                setScrolled(true);
            }
            if (scrolled && contentRef.current && contentRef.current.scrollTop <= 0 && e.deltaY < -30) {
                setScrolled(false)
            }
        };

        // 2. Touch/Swipe Logic
        const handleTouchStart = (e: TouchEvent) => {
            touchStartY.current = e.touches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const touchEndY = e.changedTouches[0].clientY;
            const diff = touchStartY.current - touchEndY;
            const threshold = 60; // Slightly higher threshold

            // Swipe UP to open drawer
            if (diff > threshold && !scrolled) {
                setScrolled(true);
            }

            // Swipe DOWN to close drawer (only if at top)
            if (
                diff < -threshold &&
                scrolled &&
                contentRef.current &&
                contentRef.current.scrollTop <= 0
            ) {
                setScrolled(false);
            }
        };

        window.addEventListener("wheel", handleWheel);
        window.addEventListener("touchstart", handleTouchStart);
        window.addEventListener("touchend", handleTouchEnd);

        return () => {
            window.removeEventListener("wheel", handleWheel);
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [scrolled]);

    const handleViewChange = (mode: string) => {
        // View Transition API
        if (document.startViewTransition) {
            document.startViewTransition(() => setViewMode(mode));
        } else {
            setViewMode(mode);
        }
    };

    const filteredItems = filterType === 'all' ? LIBRARY_ITEMS : LIBRARY_ITEMS.filter(item => item.type === filterType);

    const groupedItems = filteredItems.reduce((acc: Record<string, LibraryItem[]>, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});


    return (
        <div className="max-w-[1600px] mx-auto h-full flex flex-col relative">
            {/* --- HERO SECTION (Widgets) --- */}
            <div
                className={cn(
                    "px-4 md:px-8 absolute inset-0 z-10 transition-all duration-1000 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
                    scrolled
                        ? "opacity-0 -translate-y-[100%] scale-95 pointer-events-none blur-sm"
                        : "opacity-100 translate-y-0 h-full overflow-hidden pt-6 pb-24 md:pb-32"
                )}
            >
                <div className="h-full grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 grid-rows-[repeat(auto-fit,minmax(0,1fr))] md:grid-rows-6">

                    {/* Main Hero Card */}
                    <TiltCard
                        className="col-span-1 md:col-span-2 lg:col-span-3 row-span-2 md:row-span-4 bg-lime-400 text-zinc-950 flex flex-col justify-between p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(163,230,53,0.3)]"
                        delay={0}
                    >
                        <div className="flex justify-between items-start z-10 relative">
                            <div className="bg-black/10 p-3 md:p-4 rounded-3xl backdrop-blur-md">
                                <Play
                                    size={28}
                                    className="fill-black text-black ml-1 md:w-10 md:h-10"
                                />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="bg-black/10 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold backdrop-blur-md uppercase tracking-wider">
                                    Resume Session
                                </span>
                            </div>
                        </div>
                        <div className="z-10 relative mt-2 md:mt-0">
                            {/* Improved Text Sizing and Leading */}
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.0] tracking-tight mb-2 md:mb-3">
                                Adv. Calculus II
                            </h2>
                            <div className="flex items-center gap-2 md:gap-3 opacity-70 font-medium text-sm md:text-lg">
                                <Clock size={18} className="md:w-6 md:h-6" />{" "}
                                <span>24m remaining • Chapter 4</span>
                            </div>
                        </div>
                        <div className="absolute -right-20 -bottom-20 md:-right-32 md:-bottom-32 w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-lime-300 rounded-full blur-[60px] md:blur-[100px] opacity-60 pointer-events-none mix-blend-screen animate-blob" />
                    </TiltCard>

                    {/* Music Player */}
                    <TiltCard
                        className="col-span-1 md:col-span-2 lg:col-span-1 row-span-2 md:row-span-4 bg-zinc-950 border border-zinc-800 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden"
                        delay={100}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent" />
                        <div className="flex justify-between items-start z-10">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
                                <Music2 size={20} className="md:w-6 md:h-6 animate-pulse" />
                            </div>
                            <Activity size={20} className="text-indigo-400 md:w-6 md:h-6" />
                        </div>

                        <div className="flex gap-1 md:gap-1.5 h-16 md:h-24 items-end justify-center opacity-80 my-2 z-10">
                            {[40, 70, 30, 80, 50, 90, 40, 60, 30, 80].map((h, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 md:w-2.5 bg-indigo-400 rounded-full"
                                    style={{
                                        height: `${h}%`,
                                        animation: `bounce-music 0.8s ease-in-out infinite`,
                                        animationDelay: `${i * 0.1}s`,
                                    }}
                                />
                            ))}
                        </div>

                        <div className="z-10">
                            <div className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase mb-1">
                                Now Playing
                            </div>
                            <div className="font-bold text-white text-lg md:text-xl truncate">
                                Lo-Fi Study Beats
                            </div>
                            <div className="text-zinc-400 text-xs">ChillHop Music</div>
                        </div>
                    </TiltCard>

                    {/* Calendar Widget */}
                    <TiltCard className="hidden md:flex col-span-1 md:col-span-2 lg:col-span-2 row-span-3 bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex-col justify-between" delay={50}>
                        <div className="flex justify-between items-center text-zinc-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Calendar size={16} /> Schedule</span>
                            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">Today</span>
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-4 items-center group p-3 rounded-2xl hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 text-violet-400 flex flex-col items-center justify-center font-bold border border-violet-500/20 shrink-0">
                                    <span className="text-[10px] uppercase opacity-70">Sep</span>
                                    <span className="text-lg leading-none">14</span>
                                </div>
                                <div>
                                    <div className="text-white font-bold text-base group-hover:text-violet-400 transition-colors">Design Crit</div>
                                    <div className="text-zinc-500 text-xs">2:00 PM • Studio A</div>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center group p-3 rounded-2xl hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex flex-col items-center justify-center font-bold border border-amber-500/20 shrink-0">
                                    <span className="text-[10px] uppercase opacity-70">Sep</span>
                                    <span className="text-lg leading-none">15</span>
                                </div>
                                <div>
                                    <div className="text-white font-bold text-base group-hover:text-amber-400 transition-colors">Econ Quiz</div>
                                    <div className="text-zinc-500 text-xs">4:30 PM • Online</div>
                                </div>
                            </div>
                        </div>
                    </TiltCard>

                    {/* Quick Tasks */}
                    <TiltCard className="hidden md:flex col-span-1 md:col-span-2 lg:col-span-2 row-span-3 bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex-col" delay={150}>
                        <div className="flex justify-between items-center text-zinc-400 mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><ListTodo size={16} /> Priorities</span>
                            <span className="text-lime-400 text-[10px] font-bold bg-lime-400/10 px-2 py-0.5 rounded-full">3 Left</span>
                        </div>
                        <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                            {['Read Ch. 4 for Econ', 'Upload Sketch drafts', 'Email Prof. Alberry'].map((task, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl cursor-pointer group transition-colors border border-transparent hover:border-zinc-700">
                                    <div className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-lime-400 group-hover:bg-lime-400/20 transition-all flex items-center justify-center shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white decoration-zinc-500 group-hover:line-through transition-all">{task}</span>
                                </div>
                            ))}
                        </div>
                        <button className="mt-2 w-full py-3 bg-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                            <Plus size={16} /> Add New Task
                        </button>
                    </TiltCard>

                </div>

                {/* Scroll Hint */}
                <div className="absolute bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-zinc-500 flex flex-col items-center gap-2 pointer-events-none opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Swipe / Scroll</span>
                    <ArrowDown size={16} />
                </div>
            </div>

            {/* --- CONTENT DRAWER (Slides Up) --- */}
            <div
                className={cn(
                    "fixed inset-0 z-30 transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] flex flex-col",
                    scrolled ? 'translate-y-20' : 'translate-y-[100dvh]'
                )}
            >
                {/* Sticky Header inside Drawer */}
                <div className="h-20 bg-[#121212] border-b border-zinc-800 flex items-center justify-between px-4 md:px-8 shrink-0 relative">

                    {/* Mobile Drag Handle */}
                    <div className="absolute -top-6 left-0 right-0 h-6 flex justify-center items-end pb-2" onClick={() => setScrolled(false)}>
                        <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full hover:bg-zinc-500 cursor-pointer transition-colors" />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                        {['All', 'Decks', 'Notes', 'Papers', 'Design'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterType(f.toLowerCase() === 'all' ? 'all' : f.toLowerCase().startsWith('design') ? 'sketch' : f.toLowerCase().startsWith('deck') ? 'deck' : f.toLowerCase().startsWith('note') ? 'note' : 'paper')}
                                className={cn("px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                                    (filterType === 'all' && f === 'All') || (filterType === 'sketch' && f === 'Design') || (filterType === 'deck' && f === 'Decks') || (filterType === 'note' && f === 'Notes') || (filterType === 'paper' && f === 'Papers')
                                        ? 'bg-lime-400 text-zinc-950 shadow-[0_0_15px_rgba(163,230,53,0.3)] scale-105'
                                        : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 border border-zinc-800'
                                )}
                            >{f}</button>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center bg-zinc-900 p-1.5 rounded-full border border-zinc-800 shrink-0 ml-2">
                        <button onClick={() => handleViewChange('grid')} className={cn("p-2 rounded-full transition-all duration-300", viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white')}><LayoutGrid size={16} /></button>
                        <button onClick={() => handleViewChange('class')} className={cn("p-2 rounded-full transition-all duration-300", viewMode === 'class' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white')}><Library size={16} /></button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div ref={contentRef} className="flex-1 overflow-y-auto no-scrollbar bg-[#121212] pb-64 px-4 md:px-8 pt-6">
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                            {filteredItems.map((item: LibraryItem, i: number) => (
                                // Inlined RenderItemCard logic for simplicity within component scope
                                <TiltCard
                                    key={item.id}
                                    delay={i * 50}
                                    className={cn(item.color, "p-5 h-52 flex flex-col justify-between group border-2 border-transparent hover:border-white/20 rounded-[2rem] shadow-lg", item.textColor)}
                                    style={{ viewTransitionName: `card-${item.id}` }}
                                >
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="bg-black/10 w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-md group-hover:rotate-12 transition-transform duration-300">
                                            {React.cloneElement(item.icon, { size: 20 })}
                                        </div>
                                        <div className="bg-black/10 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md uppercase tracking-wide">
                                            {item.type}
                                        </div>
                                    </div>
                                    <div className="relative z-10">
                                        <h3 className="text-lg font-bold leading-tight mb-2 group-hover:scale-105 transition-transform origin-left line-clamp-2">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center gap-2 opacity-80">
                                            <Layers size={14} />
                                            <span className="text-xs font-medium">{item.count}</span>
                                        </div>
                                        <div className="mt-1 text-[10px] opacity-60 font-bold uppercase tracking-wider">
                                            {item.category}
                                        </div>
                                    </div>
                                </TiltCard>
                            ))}
                        </div>
                    ) : (
                        <div className="flex gap-6 overflow-x-auto pb-12 no-scrollbar snap-x snap-mandatory pt-4">
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <div
                                    key={category}
                                    className="min-w-[300px] md:min-w-[360px] snap-center rounded-[2.5rem] p-2 flex flex-col gap-3 bg-zinc-900/30 border border-white/5 backdrop-blur-sm"
                                >
                                    <div className={cn("p-6 rounded-[2rem] shadow-lg sticky top-0 z-10", CATEGORY_STYLES[category]?.bg || 'bg-zinc-800', CATEGORY_STYLES[category]?.text || 'text-white')}>
                                        <h3 className="text-xl font-bold mb-1">{category}</h3>
                                        <div className="flex justify-between items-center opacity-80 mt-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Layers size={12} /> {items.length} Items</span>
                                            <MoreHorizontal size={16} />
                                        </div>
                                    </div>

                                    <div className="space-y-2 flex-1 px-2 pb-2">
                                        {items.map((item: LibraryItem) => (
                                            <div
                                                key={item.id}
                                                className="bg-zinc-950 p-4 rounded-[1.5rem] hover:bg-zinc-900 transition-colors border border-white/5 group cursor-pointer flex gap-4 items-center"
                                            >
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-black", item.color)}>
                                                    {React.cloneElement(item.icon, { size: 18 })}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm leading-tight group-hover:text-lime-400 transition-colors">{item.title}</h4>
                                                    <p className="text-[10px] text-zinc-500 mt-1 font-medium">{item.count}</p>
                                                </div>
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
