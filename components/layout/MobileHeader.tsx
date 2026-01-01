"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Bell, Menu } from "lucide-react";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { getCurrentUser, type UserInfo } from "@/app/user/actions";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Mobile header following the "Calm" aesthetic.
 * Uses the established color palette: zinc backgrounds, blue-600 accents.
 * No scale transforms or flashy animations per AGENT_CONTEXT design rules.
 */
const MobileHeader = () => {
    const [user, setUser] = useState<UserInfo | null>(null);

    // Fetch user on mount (Logic copied from Header.tsx for consistency)
    useEffect(() => {
        async function fetchUser() {
            const { user: userData } = await getCurrentUser();
            setUser(userData);
        }
        fetchUser();

        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                const { user: userData } = await getCurrentUser();
                setUser(userData);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Get greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    // Get first name
    const firstName = useMemo(() => {
        if (!user?.name) return "";
        return user.name.split(" ")[0];
    }, [user]);

    return (
        <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-surface dark:bg-surface-dark z-50 fixed top-0 w-full">
            {/* Left: Avatar & Greeting */}
            <div className="flex items-center gap-3">
                <JivvyAvatar className="w-8 h-8" />
                <div className="flex flex-col">
                    <h1 className="font-semibold text-sm leading-none tracking-tight text-text-primary">
                        Jivvy
                    </h1>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                        {user ? `${greeting}, ${firstName}` : "Welcome"}
                    </p>
                </div>
            </div>

            {/* Right: Search & Notifications */}
            <div className="flex items-center gap-2">
                <button 
                    className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label="Search"
                >
                    <Search size={18} />
                </button>
                <button 
                    className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative"
                    aria-label="Notifications"
                >
                    <Bell size={18} />
                    {/* Notification dot - uses Alert Red per AGENT_CONTEXT */}
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>
            </div>
        </header>
    );
};

export { MobileHeader };
