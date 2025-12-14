"use client";

import React, { useState } from "react";
import { LayoutGrid, Brain, Mic, Palette, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MobileNav = () => {
    const [activeTab, setActiveTab] = useState("dashboard");

    return (
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 z-50 pointer-events-none">
            <div className="bg-background/90 backdrop-blur-xl border border-zinc-800 rounded-full p-2 flex justify-between items-center shadow-2xl relative pointer-events-auto">
                <button
                    onClick={() => setActiveTab("dashboard")}
                    className={cn(
                        "p-3 rounded-full transition-colors",
                        activeTab === "dashboard"
                            ? "bg-zinc-800 text-lime-400"
                            : "text-zinc-500"
                    )}
                >
                    <LayoutGrid size={24} />
                </button>
                <button
                    onClick={() => setActiveTab("decks")}
                    className={cn(
                        "p-3 rounded-full transition-colors",
                        activeTab === "decks" ? "bg-zinc-800 text-lime-400" : "text-zinc-500"
                    )}
                >
                    <Brain size={24} />
                </button>

                <div className="relative -top-8 mx-2">
                    <button
                        onClick={() => console.log("New Upload")} // Placeholder
                        className="w-16 h-16 bg-gradient-to-tr from-lime-400 to-lime-300 rounded-2xl flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(163,230,53,0.5)] transform transition-transform active:scale-90 border-[6px] border-background animate-float hover:scale-105"
                    >
                        <Plus size={32} className="text-black" />
                    </button>
                </div>

                <button
                    onClick={() => setActiveTab("capture")}
                    className={cn(
                        "p-3 rounded-full transition-colors",
                        activeTab === "capture"
                            ? "bg-zinc-800 text-lime-400"
                            : "text-zinc-500"
                    )}
                >
                    <Mic size={24} />
                </button>
                <button
                    onClick={() => setActiveTab("studio")}
                    className={cn(
                        "p-3 rounded-full transition-colors",
                        activeTab === "studio"
                            ? "bg-zinc-800 text-lime-400"
                            : "text-zinc-500"
                    )}
                >
                    <Palette size={24} />
                </button>
            </div>
        </nav>
    );
};

export { MobileNav };
