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
} from "lucide-react";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { cn } from "@/lib/utils";

// Helper Component for Top Nav Button
interface TopNavButtonProps {
    icon: React.ElementType;
    active: boolean;
    label: string;
    href: string;
}

const TopNavButton = ({ icon: Icon, active, label, href }: TopNavButtonProps) => (
    <Link
        href={href}
        className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
            active
                ? "bg-zinc-800 text-white shadow-lg shadow-lime-400/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
        )}
    >
        <Icon
            size={18}
            strokeWidth={2.5}
            className={active ? "text-lime-400" : ""}
        />
        <span
            className={cn(
                "text-sm font-bold",
                active ? "opacity-100" : "hidden md:block"
            )}
        >
            {label}
        </span>
        {active && (
            <div className="absolute inset-0 rounded-full ring-1 ring-lime-400/20" />
        )}
    </Link>
);

const Header = () => {
    const pathname = usePathname();
    const [searchFocused, setSearchFocused] = useState(false);
    const heroName = "Alex"; // Placeholder

    // Determine active tab based on current route
    const activeTab = useMemo(() => {
        if (pathname.startsWith("/project")) return "studio";
        if (pathname.startsWith("/decks")) return "decks";
        if (pathname.startsWith("/capture")) return "capture";
        return "dashboard";
    }, [pathname]);

    return (
        <header className="h-20 flex items-center justify-between px-6 md:px-12 border-b border-white/5 bg-[#121212]/80 backdrop-blur-xl z-50 fixed top-0 w-full transition-transform duration-500">
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

                {/* Desktop Nav */}
                <nav className="hidden lg:flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-full border border-white/5">
                    <TopNavButton
                        icon={LayoutGrid}
                        active={activeTab === "dashboard"}
                        label="Dashboard"
                        href="/"
                    />
                    <TopNavButton
                        icon={Brain}
                        active={activeTab === "decks"}
                        label="Decks"
                        href="/decks"
                    />
                    <TopNavButton
                        icon={Mic}
                        active={activeTab === "capture"}
                        label="Capture"
                        href="/capture"
                    />
                    <TopNavButton
                        icon={Palette}
                        active={activeTab === "studio"}
                        label="Studio"
                        href="/project/new"
                    />
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
                        placeholder="Search notes..."
                        className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm"
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                </div>
                <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors relative">
                    <Bell size={18} className="text-zinc-400" />
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                </button>
                <button
                    onClick={() => console.log("New Upload")} // Placeholder
                    className="bg-lime-400 hover:bg-lime-300 text-black px-4 md:px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_20px_rgba(163,230,53,0.3)]"
                >
                    <Plus size={18} /> <span className="hidden md:inline">New</span>
                </button>
            </div>
        </header>
    );
};

export { Header };
