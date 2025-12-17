"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Bell } from "lucide-react";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { getCurrentUser, type UserInfo } from "@/app/user/actions";
import { createClient } from "@/utils/supabase/client";

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
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
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-white/5 bg-background/80 backdrop-blur-xl z-50 fixed top-0 w-full">
            {/* Left: Avatar & Greeting */}
            <div className="flex items-center gap-3">
                <JivvyAvatar className="w-10 h-10" />
                <div className="flex flex-col">
                    <h1 className="font-bold text-base leading-none tracking-tight text-white">
                        Jivvy
                    </h1>
                    <p className="text-[10px] text-zinc-500 font-medium">
                        {user ? `${greeting}, ${firstName}` : "Welcome to Jivvy"}
                    </p>
                </div>
            </div>

            {/* Right: Search & Bell */}
            <div className="flex items-center gap-3">
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 gap-2 w-32">
                    <Search size={14} className="text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-xs"
                    />
                </div>
                <button className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative active:scale-95 transition-transform">
                    <Bell size={16} className="text-zinc-400" />
                    <div className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                </button>
            </div>
        </header>
    );
};

export { MobileHeader };
