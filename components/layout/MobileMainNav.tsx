"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Search, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileMainNav() {
    const pathname = usePathname();

    const navItems = [
        { icon: LayoutGrid, label: "Home", href: "/" },
        { icon: CalendarDays, label: "Calendar", href: "/calendar" },
        { icon: Search, label: "Search", href: "/search" },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-xl border-t border-white/10 z-50 px-6 pb-safe">
            <div className="flex items-center justify-between h-full max-w-md mx-auto relative">

                {/* Nav Items Left */}
                {navItems.slice(0, 2).map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href} className="flex-1 flex justify-center">
                            <div className="flex flex-col items-center gap-1">
                                <item.icon
                                    size={20}
                                    className={cn(
                                        "transition-colors",
                                        isActive ? "text-lime-400" : "text-zinc-500"
                                    )}
                                />
                                <span className={cn(
                                    "text-[10px] font-medium transition-colors",
                                    isActive ? "text-lime-400" : "text-zinc-600"
                                )}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}

                {/* Floating Action Button (Center) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                    <Link href="/project/new">
                        <div className="w-14 h-14 bg-lime-400 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(163,230,53,0.4)] border-4 border-zinc-950 hover:scale-105 active:scale-95 transition-transform">
                            <Plus size={24} className="text-black stroke-[3]" />
                        </div>
                    </Link>
                </div>

                {/* Spacer for FAB */}
                <div className="w-12 h-full opacity-0 pointer-events-none" />

                {/* Nav Items Right (Currently just Search, could add Profile/Library) */}
                {navItems.slice(2).map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href} className="flex-1 flex justify-center">
                            <div className="flex flex-col items-center gap-1">
                                <item.icon
                                    size={20}
                                    className={cn(
                                        "transition-colors",
                                        isActive ? "text-lime-400" : "text-zinc-500"
                                    )}
                                />
                                <span className={cn(
                                    "text-[10px] font-medium transition-colors",
                                    isActive ? "text-lime-400" : "text-zinc-600"
                                )}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}

            </div>
        </div>
    );
}
