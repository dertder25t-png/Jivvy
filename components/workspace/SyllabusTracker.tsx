"use client";

import React, { useState, useRef } from "react";
import {
    Calendar,
    ChevronRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    Circle,
    Plus,
    X,
    Upload,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MilestoneItem {
    id: string;
    title: string;
    type: "task" | "deliverable" | "deadline" | "milestone";
    date: Date;
    completed: boolean;
    notes?: string;
    pdfUrl?: string; // Optional PDF attachment
}

interface ProjectTimelineProps {
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

// Mock milestones data - in real app, fetch from database
const MOCK_MILESTONES: MilestoneItem[] = [
    {
        id: "1",
        title: "Initial Concept Review",
        type: "task",
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        completed: true,
    },
    {
        id: "2",
        title: "Research & Moodboard",
        type: "task",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completed: true,
    },
    {
        id: "3",
        title: "First Draft Design",
        type: "task",
        date: new Date(), // Today
        completed: false,
        notes: "Current task"
    },
    {
        id: "4",
        title: "Client Presentation",
        type: "deliverable",
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        completed: false,
    },
    {
        id: "5",
        title: "Final Delivery",
        type: "deadline",
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        completed: false,
    },
    {
        id: "6",
        title: "Project Complete",
        type: "milestone",
        date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        completed: false,
    },
];

export function SyllabusTracker({ className }: ProjectTimelineProps) {
    const [items, setItems] = useState<MilestoneItem[]>(MOCK_MILESTONES);
    const [collapsed, setCollapsed] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Cheap client-side date extraction using regex (no AI needed)
    const extractDatesFromText = (text: string): { title: string; date: Date; type: MilestoneItem["type"] }[] => {
        const results: { title: string; date: Date; type: MilestoneItem["type"] }[] = [];

        // Common date patterns
        const datePatterns = [
            // MM/DD/YYYY or MM-DD-YYYY
            /(\b\w+[:\s]+[^.]*?)(?:\s+(?:due|deadline|by|on|at)\s+)?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/gi,
            // Month DD, YYYY
            /(\b\w+[:\s]+[^.]*?)(?:\s+(?:due|deadline|by|on|at)\s+)?(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi,
            // Due: with date
            /(?:due|deadline|submit)(?:\s*[:]\s*)([^,.\n]+),?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/gi,
        ];

        for (const pattern of datePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                try {
                    const title = match[1]?.trim().slice(0, 50) || "Extracted Item";
                    const dateStr = match[2] || match[0];
                    const parsedDate = new Date(dateStr);

                    if (!isNaN(parsedDate.getTime())) {
                        // Determine type based on keywords
                        const lowerText = match[0].toLowerCase();
                        let type: MilestoneItem["type"] = "task";
                        if (lowerText.includes("deadline") || lowerText.includes("due")) type = "deadline";
                        else if (lowerText.includes("deliver") || lowerText.includes("submit")) type = "deliverable";
                        else if (lowerText.includes("milestone") || lowerText.includes("phase")) type = "milestone";

                        results.push({ title, date: parsedDate, type });
                    }
                } catch {
                    // Skip invalid dates
                }
            }
        }

        return results.slice(0, 10); // Limit to 10 items
    };

    // Handle PDF upload
    const handlePdfUpload = async (file: File) => {
        if (!file.type.includes('pdf')) return;

        setIsUploading(true);
        try {
            // Use PDF.js for text extraction (simpler than AI)
            const text = await extractTextFromPdf(file);
            const extractedDates = extractDatesFromText(text);

            if (extractedDates.length > 0) {
                const newItems: MilestoneItem[] = extractedDates.map((item, index) => ({
                    id: `extracted-${Date.now()}-${index}`,
                    ...item,
                    completed: false,
                }));
                setItems(prev => [...prev, ...newItems]);
            } else {
                alert("No dates found in PDF. Try adding milestones manually.");
            }
        } catch (error) {
            console.error("PDF extraction error:", error);
            alert("Could not extract dates from PDF.");
        }
        setIsUploading(false);
    };

    // Simple PDF text extraction (basic approach)
    const extractTextFromPdf = async (file: File): Promise<string> => {
        // For now, use a simple approach - read as text
        // In production, you'd use pdf.js or similar
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Try to extract readable text from PDF binary
                const text = e.target?.result as string || "";
                // Extract printable ASCII from PDF
                const readable = text.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
                resolve(readable);
            };
            reader.onerror = () => resolve("");
            reader.readAsText(file);
        });
    };

    // Find current item (today or nearest future incomplete)
    const currentItemIndex = items.findIndex(item => {
        const days = daysUntil(item.date);
        return days >= 0 && !item.completed;
    });

    const getTypeStyles = (type: MilestoneItem["type"], isUpcoming: boolean) => {
        switch (type) {
            case "deadline":
                return {
                    bg: "bg-rose-500/10",
                    border: "border-rose-500/30",
                    text: "text-rose-400",
                    glow: isUpcoming ? "shadow-[0_0_20px_rgba(244,63,94,0.3)]" : ""
                };
            case "deliverable":
                return {
                    bg: "bg-amber-500/10",
                    border: "border-amber-500/30",
                    text: "text-amber-400",
                    glow: isUpcoming ? "shadow-[0_0_15px_rgba(245,158,11,0.2)]" : ""
                };
            case "milestone":
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
                        Milestones
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePdfUpload(file);
                        }}
                    />
                    {/* Upload PDF button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                        title="Upload PDF to extract dates"
                    >
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    </button>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors"
                        title="Add milestone"
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
                                            : item.type === "deadline"
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
                                            item.type === "deadline" && "bg-rose-500/20 text-rose-400",
                                            item.type === "deliverable" && "bg-amber-500/20 text-amber-400",
                                            item.type === "milestone" && "bg-violet-500/20 text-violet-400",
                                            item.type === "task" && "bg-zinc-700 text-zinc-400"
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
                                    {!isPast && !isToday && (item.type === "deadline" || item.type === "deliverable") && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 mt-2 text-xs",
                                            item.type === "deadline" ? "text-rose-400" : "text-amber-400"
                                        )}>
                                            <Clock size={12} />
                                            <span className="font-medium">
                                                {days === 1 ? "Tomorrow" : `In ${days} days`}
                                            </span>
                                            {days <= 3 && item.type === "deadline" && (
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
                            {items.filter(i => !i.completed && i.type === "deliverable" && daysUntil(i.date) <= 7).length}
                        </div>
                        <div className="text-[10px] uppercase text-zinc-500 font-medium">Due This Week</div>
                    </div>
                    <div className="text-center p-2 bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl font-bold text-rose-400">
                            {(() => {
                                const nextDeadline = items.find(i => i.type === "deadline" && !i.completed && daysUntil(i.date) >= 0);
                                return nextDeadline ? daysUntil(nextDeadline.date) : "—";
                            })()}
                        </div>
                        <div className="text-[10px] uppercase text-zinc-500 font-medium">Days to Deadline</div>
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
                                <option value="task">Task</option>
                                <option value="deliverable">Deliverable</option>
                                <option value="deadline">Deadline</option>
                                <option value="milestone">Milestone</option>
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
