"use client";

import React, { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutGrid,
    Brain,
    Mic,
    Palette,
    Search,
    Bell,
    Plus,
    PenTool,
    FileText,
    StickyNote
} from "lucide-react";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { GummyButton } from "@/components/ui/GummyButton";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store";

const Header = () => {
    const pathname = usePathname();
    const [searchFocused, setSearchFocused] = useState(false);
    const heroName = "Alex"; // Placeholder

    const { activeProjectId, centerMode, setCenterMode } = useProjectStore();

    // Determine active tab based on current route
    const activeTab = useMemo(() => {
        if (pathname.startsWith("/project")) return "studio";
        if (pathname.startsWith("/decks")) return "decks";
        if (pathname.startsWith("/capture")) return "capture";
        return "dashboard";
    }, [pathname]);

    const isProjectView = pathname.startsWith("/project") && activeProjectId;

    return (
        <header className="h-20 flex items-center justify-between px-6 md:px-12 border-b border-white/5 bg-background/80 backdrop-blur-xl z-50 fixed top-0 w-full transition-transform duration-500">
            <div className="flex items-center gap-4 md:gap-8">
                <Link
                    href="/"
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <JivvyAvatar />
                    <div>
                        <h1 className="font-bold text-lg leading-none tracking-tight">
                            Jivvy
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium group-hover:text-lime-400 transition-colors">
                            Good evening, {heroName}
                        </p>
                    </div>
                </Link>

                {/* Desktop Nav - Show Global Nav or Project Nav */}
                <nav className="hidden lg:flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-full border border-white/5">
                    {isProjectView ? (
                        <>
                            <GummyButton
                                variant={centerMode === "canvas" ? "solid" : "ghost"}
                                size="sm"
                                onClick={() => setCenterMode("canvas")}
                                className={cn("rounded-full", centerMode === "canvas" ? "bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.3)]" : "text-zinc-500 hover:text-white")}
                            >
                                <PenTool size={16} className="mr-2" />
                                Canvas
                            </GummyButton>
                            <GummyButton
                                variant={centerMode === "paper" ? "solid" : "ghost"}
                                size="sm"
                                onClick={() => setCenterMode("paper")}
                                className={cn("rounded-full", centerMode === "paper" ? "bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]" : "text-zinc-500 hover:text-white")}
                            >
                                <FileText size={16} className="mr-2" />
                                Paper
                            </GummyButton>
                            <GummyButton
                                variant={centerMode === "notes" ? "solid" : "ghost"}
                                size="sm"
                                onClick={() => setCenterMode("notes")}
                                className={cn("rounded-full", centerMode === "notes" ? "bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "text-zinc-500 hover:text-white")}
                            >
                                <StickyNote size={16} className="mr-2" />
                                Notes
                            </GummyButton>
                        </>
                    ) : (
                        <>
                            <Link href="/">
                                <GummyButton
                                    variant={activeTab === "dashboard" ? "solid" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-full", activeTab === "dashboard" ? "bg-zinc-800 text-white shadow-lg shadow-lime-400/10" : "text-zinc-500 hover:text-white")}
                                >
                                    <LayoutGrid size={18} className={cn("mr-2", activeTab === "dashboard" ? "text-lime-400" : "")} />
                                    Dashboard
                                </GummyButton>
                            </Link>
                            <Link href="/decks">
                                <GummyButton
                                    variant={activeTab === "decks" ? "solid" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-full", activeTab === "decks" ? "bg-zinc-800 text-white shadow-lg shadow-lime-400/10" : "text-zinc-500 hover:text-white")}
                                >
                                    <Brain size={18} className={cn("mr-2", activeTab === "decks" ? "text-lime-400" : "")} />
                                    Decks
                                </GummyButton>
                            </Link>
                            <Link href="/capture">
                                <GummyButton
                                    variant={activeTab === "capture" ? "solid" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-full", activeTab === "capture" ? "bg-zinc-800 text-white shadow-lg shadow-lime-400/10" : "text-zinc-500 hover:text-white")}
                                >
                                    <Mic size={18} className={cn("mr-2", activeTab === "capture" ? "text-lime-400" : "")} />
                                    Capture
                                </GummyButton>
                            </Link>
                            <Link href="/project/new">
                                <GummyButton
                                    variant={activeTab === "studio" ? "solid" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-full", activeTab === "studio" ? "bg-zinc-800 text-white shadow-lg shadow-lime-400/10" : "text-zinc-500 hover:text-white")}
                                >
                                    <Palette size={18} className={cn("mr-2", activeTab === "studio" ? "text-lime-400" : "")} />
                                    Studio
                                </GummyButton>
                            </Link>
                        </>
                    )}
                </nav>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                <div
                    className={cn(
                        "hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 gap-3 w-64 transition-all duration-300",
                        searchFocused ? "ring-2 ring-lime-400/50 w-80" : "hover:border-zinc-700"
                    )}
                >
                    <Search size={18} className="text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm"
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                </div>
                <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors relative">
                    <Bell size={18} className="text-zinc-400" />
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                </button>
                <GummyButton
                    onClick={() => console.log("New Upload")} // Placeholder
                    className="bg-lime-400 hover:bg-lime-300 text-black rounded-full font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(163,230,53,0.3)]"
                >
                    <Plus size={18} /> <span className="hidden md:inline">New</span>
                </GummyButton>
            </div>
        </header>
    );
};

export { Header };
