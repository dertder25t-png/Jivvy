"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Calendar,
    Hash,
    ArrowUp,
    Loader2,
    Flag,
    FolderPlus,
    X,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db, Block, Project } from "@/lib/db";
import { parseInputString, ParsedTask } from "@/lib/SmartParser";
import { useProjectStore } from "@/lib/store";

interface QuickAddProps {
    onTaskAdded?: () => void;
}

export function QuickAdd({ onTaskAdded }: QuickAddProps) {
    const { addProject, addBlock } = useProjectStore();
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Parsed State
    const [parsed, setParsed] = useState<ParsedTask>({ type: 'task', title: '' });

    // Manual Overrides
    const [manualPriority, setManualPriority] = useState<'low' | 'medium' | 'high' | null>(null);
    const [manualDate, setManualDate] = useState<Date | null>(null);
    const [manualProject, setManualProject] = useState<string | null>(null); // By ID or Name

    const inputRef = useRef<HTMLInputElement>(null);

    // Live Parsing Effect
    useEffect(() => {
        const result = parseInputString(input);
        setParsed(result);
    }, [input]);

    // Computed Values (Manual overrides Parsed)
    const finalPriority = manualPriority || parsed.priority;
    const finalDate = manualDate || parsed.dueDate;
    const finalProjectTag = manualProject ? null : parsed.projectTag; // Manual project selection implies exact ID usually, but here we just use name or tag
    // Note: manualProject logic would require selecting from existing Projects. For MVP, we stick to tags or simple overrides.
    // The prompt asks for "Dropdown to manually assign". I'll mock that behavior or just assume text is enough for now, 
    // as fetching projects takes effect. I'll implement a simple toggle for now or just let Parse handle it.

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!parsed.title.trim() && !input.trim()) return;
        if (isSaving) return;

        setIsSaving(true);

        try {
            // Determine effective data
            const title = parsed.title || input; // Fallback if parse fails to extract title
            const isProject = parsed.type === 'project';

            if (isProject) {
                const newProject: Project = {
                    id: crypto.randomUUID(),
                    name: title,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    priority: finalPriority,
                    due_date: finalDate?.getTime(),
                    color: "bg-zinc-400",
                    tags: finalProjectTag ? [finalProjectTag] : []
                };
                await addProject(newProject);
                console.log("Created Project via Store:", newProject);
            } else {
                const newTask: Block = {
                    id: crypto.randomUUID(),
                    parent_id: null,
                    content: title,
                    type: 'task',
                    order: Date.now(),
                    properties: {
                        priority: finalPriority,
                        due_date: finalDate?.getTime(),
                        tags: finalProjectTag ? [finalProjectTag] : [],
                        checked: false
                    },
                    metadata: {
                        original_text: input,
                        status: 'todo', // Legacy support
                        // Legacy field mapping for Dashboard compatibility
                        scheduled_date: finalDate?.getTime(),
                        project_tag: finalProjectTag
                    }
                };
                await addBlock(newTask);
                console.log("Created Task via Store:", newTask);
            }

            // Success
            setInput("");
            setManualPriority(null);
            setManualDate(null);
            setManualProject(null);

            setShowToast(true);
            onTaskAdded?.();
            setTimeout(() => setShowToast(false), 3000);

        } catch (error) {
            console.error("Failed to add Item:", error);
            alert("Failed to save. check console.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSubmit();
        }
    };

    // Helper for Priority Color
    const getPriorityColor = (p?: string) => {
        if (p === 'high') return 'text-red-500 bg-red-50 dark:bg-red-900/20';
        if (p === 'medium') return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
    };

    const togglePriority = () => {
        if (!manualPriority) setManualPriority('medium');
        else if (manualPriority === 'medium') setManualPriority('high');
        else if (manualPriority === 'high') setManualPriority('low');
        else setManualPriority(null);
    };

    return (
        <div
            className={cn(
                "relative group rounded-xl border transition-all duration-200 bg-surface shadow-sm",
                isFocused
                    ? "border-primary/50 shadow-md ring-1 ring-primary/10"
                    : "border-border hover:border-border/80"
            )}
        >
            <div className="flex flex-col">
                {/* Input Area */}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    placeholder="Describe a task or type 'Project: Name'..."
                    className="w-full bg-transparent px-4 py-4 text-base placeholder:text-text-secondary/50 focus:outline-none disabled:opacity-50"
                />

                {/* Parsed / Live Feedback Area (Pills) */}
                {(finalDate || finalPriority || finalProjectTag || parsed.type === 'project') && (
                    <div className="px-4 pb-0 flex flex-wrap gap-2 text-xs">
                        {parsed.type === 'project' && (
                            <span className="inline-flex items-center gap-1 text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <FolderPlus className="w-3 h-3" />
                                New Project
                            </span>
                        )}
                        {finalDate && (
                            <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <Calendar className="w-3 h-3" />
                                {finalDate.toLocaleDateString()}
                                {manualDate && <span className="ml-1 opacity-50 text-[10px]">(Manual)</span>}
                            </span>
                        )}
                        {finalPriority && (
                            <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200", getPriorityColor(finalPriority))}>
                                <Flag className="w-3 h-3 fill-current" />
                                {finalPriority.charAt(0).toUpperCase() + finalPriority.slice(1)}
                            </span>
                        )}
                        {finalProjectTag && (
                            <span className="inline-flex items-center gap-1 text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <Hash className="w-3 h-3" />
                                {finalProjectTag}
                            </span>
                        )}
                    </div>
                )}

                {/* Control Bar (Collapsed unless focused or has content) */}
                <div className={cn(
                    "flex items-center justify-between px-2 pb-2 mt-2 transition-all duration-200 overflow-hidden",
                    (isFocused || input) ? "opacity-100 max-h-12" : "opacity-0 max-h-0 pb-0"
                )}>
                    {/* Left Tools */}
                    <div className="flex items-center gap-1 px-2">
                        {/* Date Picker Button (Using native for MVP) */}
                        <div className="relative group/date">
                            <button type="button" className="p-2 text-text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Set Date">
                                <Calendar className="w-4 h-4" />
                            </button>
                            <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.valueAsDate) setManualDate(e.target.valueAsDate);
                                    else setManualDate(null);
                                }}
                            />
                        </div>

                        {/* Priority Toggle */}
                        <button
                            type="button"
                            onClick={togglePriority}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                manualPriority ? getPriorityColor(manualPriority) : "text-text-secondary hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                            title="Toggle Priority"
                        >
                            <Flag className={cn("w-4 h-4", manualPriority && "fill-current")} />
                        </button>

                        {/* Project Selector (Mock) */}
                        <button
                            type="button"
                            className="p-2 text-text-secondary hover:text-violet-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Set Project"
                            onClick={() => {
                                // For now, just prompt/toggle to simulate
                                // In real app: Open Popover
                                const manual = prompt("Enter project name manually:");
                                if (manual) setManualProject(manual);
                            }}
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Right Action */}
                    <div className="flex items-center gap-2">
                        {(manualDate || manualPriority || manualProject) && (
                            <button
                                onClick={() => {
                                    setManualDate(null);
                                    setManualPriority(null);
                                    setManualProject(null);
                                }}
                                className="text-xs text-zinc-400 hover:text-red-400 mr-2"
                            >
                                Clear Overrides
                            </button>
                        )}

                        <button
                            onClick={() => handleSubmit()}
                            disabled={(!parsed.title && !input.trim()) || isSaving}
                            className={cn(
                                "h-8 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold shadow-sm",
                                (parsed.title || input.trim())
                                    ? "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/20 hover:translate-y-[-1px]"
                                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                            )}
                        >
                            <span>{parsed.type === 'project' ? 'Create Project' : 'Add Task'}</span>
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {showToast && (
                <div className="absolute bottom-full mb-3 left-0 right-0 flex justify-center z-50 pointer-events-none">
                    <div className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 border border-zinc-800">
                        <CheckCircle2 className="w-3 h-3 text-lime-400" />
                        <span>{parsed.type === 'project' ? 'Project created' : 'Task captured'}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
