"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MobileNav = () => {
    const pathname = usePathname();

    // Don't show on project pages (they have their own tool switcher)
    const isProjectPage = pathname.startsWith('/project/') && pathname !== '/project/new';
    if (isProjectPage) return null;

    return (
        <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-50 pointer-events-none">
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full p-1.5 flex justify-around items-center shadow-2xl relative pointer-events-auto max-w-sm mx-auto">
                {/* Dashboard */}
                <Link
                    href="/"
                    className={cn(
                        "flex flex-col items-center gap-1 p-2.5 rounded-full transition-colors",
                        pathname === "/"
                            ? "text-lime-400"
                            : "text-zinc-500 hover:text-white active:bg-zinc-800/50"
                    )}
                >
                    <LayoutGrid size={20} />
                    <span className="text-[9px] font-medium">Home</span>
                </Link>

                {/* New Project - Center Button */}
                <div className="relative -top-5 mx-2">
                    <Link
                        href="/project/new"
                        className="w-14 h-14 bg-gradient-to-tr from-lime-400 to-lime-300 rounded-2xl flex items-center justify-center shadow-[0_8px_16px_-4px_rgba(163,230,53,0.5)] transform transition-transform active:scale-90 border-4 border-zinc-900 hover:scale-105"
                    >
                        <Plus size={24} className="text-black" />
                    </Link>
                </div>

                {/* Calendar/Tasks */}
                <Link
                    href="/calendar"
                    className={cn(
                        "flex flex-col items-center gap-1 p-2.5 rounded-full transition-colors",
                        pathname === "/calendar"
                            ? "text-lime-400"
                            : "text-zinc-500 hover:text-white active:bg-zinc-800/50"
                    )}
                >
                    <CalendarDays size={20} />
                    <span className="text-[9px] font-medium">Tasks</span>
                </Link>
            </div>
        </nav>
    );
};

export { MobileNav };
