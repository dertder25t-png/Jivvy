"use client";

import React, { useState, useRef } from "react";
import { Calendar, Hash, ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { db, Block } from "@/lib/db";
import { Link } from "lucide-react"; // Import issue, see below.

interface SmartTaskInputProps {
    onTaskAdded?: () => void;
}

export function SmartTaskInput({ onTaskAdded }: SmartTaskInputProps) {
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Simple parser regex
    const dateRegex = /\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
    const tagRegex = /#\w+/gi;

    const parsedDate = input.match(dateRegex)?.[0];
    const parsedTags = input.match(tagRegex);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isSaving) return;

        setIsSaving(true);
        console.log("Processing task:", input);

        try {
            // 1. Parse Date
            let scheduledDate: number | null = null;
            if (parsedDate) {
                const lower = parsedDate.toLowerCase();
                const now = new Date();

                if (lower === 'today') {
                    scheduledDate = now.getTime();
                } else if (lower === 'tomorrow') {
                    scheduledDate = now.getTime() + 24 * 60 * 60 * 1000;
                }
                // (Other dates ignored for basic impl as per spec)
            }

            // 2. Parse Project (First tag)
            // Ideally we find the project ID by name. For now store as metadata.
            const projectTag = parsedTags?.[0];

            // 3. Create Task Object
            const newTask: Block = {
                id: crypto.randomUUID(),
                parent_id: null, // Root level / Inbox
                content: input.replace(tagRegex, '').trim(), // Remove tags from content? Maybe keep them. User didn't specify. I'll keep them in content or remove? Prompt: "extract that word as a Project Tag...". Usually means relation. I will just store in metadata for now.
                type: 'task',
                order: Date.now(),
                metadata: {
                    status: 'todo',
                    created_at: Date.now(),
                    scheduled_date: scheduledDate,
                    project_tag: projectTag,
                    original_text: input
                }
            };

            console.log("Parsed Task:", newTask);

            // 4. Save to Dexie
            await db.blocks.add(newTask);

            // 5. Success
            setInput("");
            setShowToast(true);
            onTaskAdded?.();
            setTimeout(() => setShowToast(false), 3000);

        } catch (error) {
            console.error("Failed to add task:", error);
            alert("Failed to save task. See console.");
        } finally {
            setIsSaving(false);
        }
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
                    disabled={isSaving}
                    autoFocus
                    placeholder="Buy milk tomorrow #Personal"
                    className="w-full bg-transparent px-3 py-3 text-sm placeholder:text-text-secondary/50 focus:outline-none disabled:opacity-50"
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

                {/* Action Bar */}
                <div className={cn(
                    "flex items-center justify-between px-2 pb-2 transition-all duration-200 overflow-hidden",
                    isFocused || input ? "h-10 opacity-100" : "h-0 opacity-0 pb-0"
                )}>
                    <div className="flex items-center gap-1">
                        {/* Placeholder buttons */}
                    </div>

                    <button
                        onClick={() => handleSubmit()}
                        disabled={!input.trim() || isSaving}
                        className={cn(
                            "p-1.5 rounded-md transition-colors flex items-center gap-2 text-xs font-medium",
                            input.trim()
                                ? "bg-primary text-white hover:bg-primary/90"
                                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                        )}
                    >
                        <span>Add task</span>
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" />}
                    </button>
                </div>
            </div>



            {/* Toast Notification */}
            {showToast && (
                <div className="absolute bottom-full mb-2 left-0 right-0 flex justify-center z-50 pointer-events-none">
                    <div className="bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                        <span>Task added to Inbox</span>
                    </div>
                </div>
            )}
        </div>
    );
}
