"use client";

import { useState } from "react";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { TimelineStream } from "@/components/dashboard/TimelineStream";
import { CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
    const [viewMode, setViewMode] = useState<'stream' | 'calendar'>('stream');

    return (
        <main className="flex-1 flex flex-col min-h-screen pt-16 lg:pt-20 bg-background">
            {/* Toggle Header */}
            <div className="px-4 lg:px-8 py-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <h1 className="text-lg lg:text-xl font-bold text-white">
                        {viewMode === 'stream' ? 'Tasks & Stream' : 'Calendar'}
                    </h1>

                    {/* View Toggle */}
                    <div className="flex bg-zinc-900 rounded-full p-1 border border-zinc-800">
                        <button
                            onClick={() => setViewMode('stream')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                viewMode === 'stream'
                                    ? "bg-lime-400 text-black"
                                    : "text-zinc-500 hover:text-white"
                            )}
                        >
                            <Clock size={14} />
                            <span className="hidden sm:inline">Stream</span>
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                viewMode === 'calendar'
                                    ? "bg-lime-400 text-black"
                                    : "text-zinc-500 hover:text-white"
                            )}
                        >
                            <CalendarDays size={14} />
                            <span className="hidden sm:inline">Calendar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* View Content */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'stream' ? (
                    <div className="h-full p-4 lg:p-8 max-w-4xl mx-auto">
                        <TimelineStream className="h-full" />
                    </div>
                ) : (
                    <CalendarView className="h-full" />
                )}
            </div>
        </main>
    );
}
