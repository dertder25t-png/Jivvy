"use client";

import React, { useState } from "react";
import {
    Calendar,
    ChevronRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    Circle,
    Plus,
    Edit3,
    Trash2,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SyllabusItem {
    id: string;
    title: string;
    type: "lecture" | "assignment" | "exam" | "project";
    date: Date;
    completed: boolean;
    notes?: string;
}

interface SyllabusTrackerProps {
    className?: string;
    projectId?: string;
}

// Helper to calculate days until
function daysUntil(date: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Helper to format date
function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Mock syllabus data - in real app, fetch from database
const MOCK_SYLLABUS: SyllabusItem[] = [
    {
        id: "1",
        title: "Intro to Color Theory",
        type: "lecture",
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        completed: true,
    },
    {
        id: "2",
        title: "Typography Fundamentals",
        type: "lecture",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completed: true,
    },
    {
        id: "3",
        title: "Grid Systems & Layout",
        type: "lecture",
        date: new Date(), // Today
        completed: false,
        notes: "Current lecture"
    },
    {
        id: "4",
        title: "Logo Design Assignment",
        type: "assignment",
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        completed: false,
    },
    {
        id: "5",
        title: "Midterm Exam",
        type: "exam",
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        completed: false,
    },
    {
        id: "6",
        title: "Final Project Presentation",
        type: "project",
        date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        completed: false,
    },
];

export function SyllabusTracker({ className, projectId }: SyllabusTrackerProps) {
    const [items, setItems] = useState<SyllabusItem[]>(MOCK_SYLLABUS);
    const [collapsed, setCollapsed] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Find current item (today or nearest future incomplete)
    const currentItemIndex = items.findIndex(item => {
        const days = daysUntil(item.date);
        return days >= 0 && !item.completed;
    });

    const getTypeStyles = (type: SyllabusItem["type"], isUpcoming: boolean) => {
        switch (type) {
            case "exam":
                return {
                    bg: "bg-rose-500/10",
                    border: "border-rose-500/30",
                    text: "text-rose-400",
                    glow: isUpcoming ? "shadow-[0_0_20px_rgba(244,63,94,0.3)]" : ""
                };
            case "assignment":
                return {
                    bg: "bg-amber-500/10",
                    border: "border-amber-500/30",
                    text: "text-amber-400",
                    glow: isUpcoming ? "shadow-[0_0_15px_rgba(245,158,11,0.2)]" : ""
                };
            case "project":
                return {
                    bg: "bg-violet-500/10",
                    border: "border-violet-500/30",
                    text: "text-violet-400",
                    glow: ""
                };
            default:
                return {
                    bg: "bg-zinc-800",
                    border: "border-zinc-700",
                    text: "text-zinc-400",
                    glow: ""
                };
        }
    };

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className="h-full w-10 flex items-center justify-center bg-surface border-l border-zinc-800 hover:bg-zinc-900 transition-colors group"
            >
                <ChevronRight size={16} className="text-zinc-500 group-hover:text-amber-400 rotate-180" />
            </button>
        );
    }

    return (
        <div className={cn(
            "w-80 h-full flex flex-col bg-surface border-l border-amber-500/20",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        Syllabus
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto py-4">
                <div className="relative px-4">
                    {/* Vertical Line */}
                    <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-zinc-800" />

                    {items.map((item, index) => {
                        const days = daysUntil(item.date);
                        const isPast = days < 0;
                        const isToday = days === 0;
                        const isCurrent = index === currentItemIndex;
                        const isUpcoming = days > 0 && days <= 7;
                        const styles = getTypeStyles(item.type, isUpcoming);

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    "relative pl-8 pb-6 group",
                                    isPast && "opacity-50"
                                )}
                            >
                                {/* Timeline Node */}
                                <div className={cn(
                                    "absolute left-5 w-5 h-5 rounded-full flex items-center justify-center -translate-x-1/2 transition-all",
                                    item.completed
                                        ? "bg-lime-500/20 text-lime-400"
                                        : isCurrent
                                            ? "bg-amber-500 text-black ring-4 ring-amber-500/30"
                                            : item.type === "exam"
                                                ? "bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/30"
                                                : "bg-zinc-800 text-zinc-500"
                                )}>
                                    {item.completed ? (
                                        <CheckCircle2 size={12} />
                                    ) : isCurrent ? (
                                        <div className="w-2 h-2 bg-black rounded-full" />
                                    ) : (
                                        <Circle size={10} />
                                    )}
                                </div>

                                {/* Content Card */}
                                <div className={cn(
                                    "p-3 rounded-xl border transition-all",
                                    isCurrent
                                        ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                                        : styles.bg,
                                    !isCurrent && styles.border,
                                    styles.glow
                                )}>
                                    {/* Date & Type Badge */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={cn(
                                            "text-xs font-medium",
                                            isCurrent ? "text-amber-400" : styles.text
                                        )}>
                                            {formatDate(item.date)}
                                            {isToday && " • Today"}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                            item.type === "exam" && "bg-rose-500/20 text-rose-400",
                                            item.type === "assignment" && "bg-amber-500/20 text-amber-400",
                                            item.type === "project" && "bg-violet-500/20 text-violet-400",
                                            item.type === "lecture" && "bg-zinc-700 text-zinc-400"
                                        )}>
                                            {item.type}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h4 className={cn(
                                        "font-medium text-sm",
                                        isCurrent ? "text-white" : item.completed ? "text-zinc-500 line-through" : "text-zinc-300"
                                    )}>
                                        {item.title}
                                    </h4>

                                    {/* Countdown for upcoming important items */}
                                    {!isPast && !isToday && (item.type === "exam" || item.type === "assignment") && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 mt-2 text-xs",
                                            item.type === "exam" ? "text-rose-400" : "text-amber-400"
                                        )}>
                                            <Clock size={12} />
                                            <span className="font-medium">
                                                {days === 1 ? "Tomorrow" : `In ${days} days`}
                                            </span>
                                            {days <= 3 && item.type === "exam" && (
                                                <AlertCircle size={12} className="ml-1 animate-pulse" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl font-bold text-amber-400">
                            {items.filter(i => !i.completed && i.type === "assignment" && daysUntil(i.date) <= 7).length}
                        </div>
                        <div className="text-[10px] uppercase text-zinc-500 font-medium">Due This Week</div>
                    </div>
                    <div className="text-center p-2 bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl font-bold text-rose-400">
                            {(() => {
                                const nextExam = items.find(i => i.type === "exam" && !i.completed && daysUntil(i.date) >= 0);
                                return nextExam ? daysUntil(nextExam.date) : "—";
                            })()}
                        </div>
                        <div className="text-[10px] uppercase text-zinc-500 font-medium">Days to Exam</div>
                    </div>
                </div>
            </div>

            {/* Add Item Modal */}
            {isAdding && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-80 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white">Add Event</h3>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Event title"
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                            />
                            <select className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
                                <option value="lecture">Lecture</option>
                                <option value="assignment">Assignment</option>
                                <option value="exam">Exam</option>
                                <option value="project">Project</option>
                            </select>
                            <input
                                type="date"
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                            />
                            <button
                                onClick={() => setIsAdding(false)}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors"
                            >
                                Add Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
