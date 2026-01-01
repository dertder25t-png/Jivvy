"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, Plus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation bar.
 * Uses Focus Blue (blue-600) as accent per AGENT_CONTEXT color palette.
 * Calm aesthetic: no fancy gradients or scale transforms.
 */
const MobileNav = () => {
    const pathname = usePathname();

    // Don't show on project pages (they have their own tool switcher)
    const isProjectPage = pathname.startsWith('/project/') && pathname !== '/project/new';
    if (isProjectPage) return null;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
            <div className="bg-surface dark:bg-surface-dark border-t border-border px-2 py-1 flex justify-around items-center">
                {/* Inbox */}
                <Link
                    href="/inbox"
                    className={cn(
                        "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[64px]",
                        pathname === "/inbox" || pathname === "/"
                            ? "text-primary"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <Inbox size={20} />
                    <span className="text-[10px] font-medium">Inbox</span>
                </Link>

                {/* Today */}
                <Link
                    href="/today"
                    className={cn(
                        "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[64px]",
                        pathname === "/today"
                            ? "text-primary"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <LayoutGrid size={20} />
                    <span className="text-[10px] font-medium">Today</span>
                </Link>

                {/* New - Center Button */}
                <Link
                    href="/project/new"
                    className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-xl shadow-sm"
                    aria-label="Create new project"
                >
                    <Plus size={22} />
                </Link>

                {/* Upcoming */}
                <Link
                    href="/upcoming"
                    className={cn(
                        "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[64px]",
                        pathname === "/upcoming"
                            ? "text-primary"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <CalendarDays size={20} />
                    <span className="text-[10px] font-medium">Upcoming</span>
                </Link>

                {/* Calendar */}
                <Link
                    href="/calendar"
                    className={cn(
                        "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[64px]",
                        pathname === "/calendar"
                            ? "text-primary"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <CalendarDays size={20} />
                    <span className="text-[10px] font-medium">Calendar</span>
                </Link>
            </div>
        </nav>
    );
};

export { MobileNav };
