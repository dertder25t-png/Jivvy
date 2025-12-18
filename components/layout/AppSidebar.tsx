"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutGrid,
    Library,
    Settings,
    PenTool,
    Plus,
    BookOpen,
    CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { GummyButton } from "@/components/ui/GummyButton";
import { useProjectStore } from "@/lib/store";

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    href: string;
    isActive: boolean;
    color?: string;
}

function SidebarItem({ icon: Icon, label, href, isActive, color }: SidebarItemProps) {
    return (
        <Link href={href} className="w-full">
            <div
                className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isActive
                        ? "bg-zinc-800 text-white font-medium shadow-lg"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50"
                )}
            >
                {isActive && (
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", color || "bg-lime-400")} />
                )}
                <Icon
                    size={20}
                    className={cn(
                        "transition-colors",
                        isActive ? color || "text-lime-400" : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                />
                <span>{label}</span>
            </div>
        </Link>
    );
}

export function AppSidebar() {
    const pathname = usePathname();
    const { activeProjectId } = useProjectStore();

    const isProjectActive = pathname.startsWith("/project/") && activeProjectId;

    const mainLinks = [
        { icon: LayoutGrid, label: "Dashboard", href: "/", color: "text-lime-400" },
        { icon: CalendarDays, label: "Calendar", href: "/calendar", color: "text-amber-400" },
        { icon: Library, label: "Library", href: "/library", color: "text-zinc-600" }, // Disabled look for now
    ];

    // Helper to check active mode from URL if possible, or just default to render links
    // Since this is a server/client component mix in Next.js app dir, we might not have searchParams easily here without useSearchParams hook.
    // However, for sidebar links, we just want to navigate. The active state styling is a nice-to-have.
    // We can use a simple check if the URL contains the mode param string.

    return (
        <aside className="hidden md:flex flex-col w-[240px] h-full bg-zinc-950/80 border-r border-white/5 backdrop-blur-xl relative z-40">
            {/* Brand Header */}
            <div className="h-20 flex items-center px-6 border-b border-white/5">
                <Link href="/" className="flex items-center gap-3">
                    <div className="scale-75 origin-left">
                        <JivvyAvatar />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white">Jivvy</span>
                </Link>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">

                {/* Main Section */}
                <div className="space-y-1">
                    <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3">Menu</p>
                    {mainLinks.map((link) => (
                        <SidebarItem
                            key={link.href}
                            {...link}
                            isActive={pathname === link.href}
                        />
                    ))}
                </div>

                {/* Workspace Section - Only visible when in a project */}
                {isProjectActive && (
                    <div className="space-y-1 animate-in slide-in-from-left-4 fade-in duration-300">
                        <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3">Workspace</p>
                        <SidebarItem
                            icon={PenTool}
                            label="Design Canvas"
                            href={`/project/${activeProjectId}?mode=canvas`}
                            isActive={false} // Complex to detect perfectly without hook here, letting page handle state
                            color="text-lime-400"
                        />
                        <SidebarItem
                            icon={BookOpen}
                            label="Paper Writing"
                            href={`/project/${activeProjectId}?mode=paper`}
                            isActive={false}
                            color="text-amber-400"
                        />
                        <SidebarItem
                            icon={LayoutGrid}
                            label="Lecture Notes"
                            href={`/project/${activeProjectId}?mode=notes`}
                            isActive={false}
                            color="text-violet-400"
                        />
                    </div>
                )}

            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-white/5 bg-zinc-950/50">
                <Link href="/project/new">
                    <GummyButton
                        className="w-full justify-center bg-lime-400 hover:bg-lime-300 text-black font-bold shadow-[0_0_20px_rgba(163,230,53,0.3)]"
                    >
                        <Plus size={18} className="mr-2" />
                        New Project
                    </GummyButton>
                </Link>

                <button className="flex items-center gap-3 px-4 py-3 mt-2 w-full text-zinc-500 hover:text-white transition-colors rounded-xl hover:bg-zinc-900/50">
                    <Settings size={18} />
                    <span className="text-sm font-medium">Settings</span>
                </button>
            </div>
        </aside>
    );
}
