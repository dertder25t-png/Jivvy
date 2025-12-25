"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar, Hash, ArrowUp, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function SmartTaskInput() {
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Simple parser regex
    const dateRegex = /\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
    const tagRegex = /#\w+/gi;

    const parsedDate = input.match(dateRegex)?.[0];
    const parsedTags = input.match(tagRegex);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        console.log("Creating task:", input);
        // Reset
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSubmit();
        }
    };

    return (
        <div
            className={cn(
                "relative group rounded-lg border transition-all duration-200 bg-surface",
                isFocused
                    ? "border-primary/50 shadow-sm ring-1 ring-primary/10"
                    : "border-border hover:border-border/80"
            )}
        >
            <div className="flex flex-col">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buy milk tomorrow #Personal"
                    className="w-full bg-transparent px-3 py-3 text-sm placeholder:text-text-secondary/50 focus:outline-none"
                />

                {/* Parsed Highlights (Visual Feedback) */}
                {(parsedDate || (parsedTags && parsedTags.length > 0)) && (
                    <div className="px-3 pb-2 flex gap-2 text-xs">
                        {parsedDate && (
                            <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                <Calendar className="w-3 h-3" />
                                {parsedDate}
                            </span>
                        )}
                        {parsedTags && parsedTags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 text-text-secondary bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                <Hash className="w-3 h-3" />
                                {tag.replace('#', '')}
                            </span>
                        ))}
                    </div>
                )}

                {/* Action Bar (Visible when focused or non-empty) */}
                <div className={cn(
                    "flex items-center justify-between px-2 pb-2 transition-all duration-200 overflow-hidden",
                    isFocused || input ? "h-10 opacity-100" : "h-0 opacity-0 pb-0"
                )}>
                    <div className="flex items-center gap-1">
                        <button type="button" className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title="Set Date">
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title="Set Project">
                            <Hash className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => handleSubmit()}
                        disabled={!input.trim()}
                        className={cn(
                            "p-1.5 rounded-md transition-colors flex items-center gap-2 text-xs font-medium",
                            input.trim()
                                ? "bg-primary text-white hover:bg-primary/90"
                                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                        )}
                    >
                        <span>Add task</span>
                        <ArrowUp className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
