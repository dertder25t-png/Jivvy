"use client";

import React, { useState, useEffect } from "react";
import {
    Circle,
    CheckCircle2,
    Plus,
    Clock,
    Calendar,
    X,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserTasks, createTask, updateTaskStatus, type Task } from "@/app/tasks/actions";

interface TimelineStreamProps {
    className?: string;
    compact?: boolean; // For widget mode vs full page
}

// Color palette matching project colors
const TASK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    lime: { bg: "bg-lime-500/10", border: "border-lime-500/30", text: "text-lime-400" },
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
    rose: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" },
    zinc: { bg: "bg-zinc-800", border: "border-zinc-700", text: "text-zinc-400" },
};

// Helper to group tasks by time period
function groupTasksByPeriod(tasks: Task[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const thisWeekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups: { label: string; tasks: Task[] }[] = [
        { label: "Today", tasks: [] },
        { label: "Tomorrow", tasks: [] },
        { label: "This Week", tasks: [] },
        { label: "Later", tasks: [] },
    ];

    tasks.forEach(task => {
        const dueDate = new Date(task.due_date);

        if (dueDate < tomorrow) {
            groups[0].tasks.push(task);
        } else if (dueDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
            groups[1].tasks.push(task);
        } else if (dueDate < thisWeekEnd) {
            groups[2].tasks.push(task);
        } else {
            groups[3].tasks.push(task);
        }
    });

    return groups.filter(g => g.tasks.length > 0);
}

// Format due date for display
function formatDueDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    if (date < tomorrow) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function TimelineStream({ className, compact = false }: TimelineStreamProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDate, setNewTaskDate] = useState("");
    const [newTaskColor, setNewTaskColor] = useState("zinc");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch tasks on mount
    useEffect(() => {
        async function fetchTasks() {
            const { tasks: data, error } = await getUserTasks();
            if (!error) {
                setTasks(data);
            }
            setLoading(false);
        }
        fetchTasks();
    }, []);

    const handleToggleTask = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';

        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: newStatus as 'todo' | 'done' } : t
        ));

        const { error } = await updateTaskStatus(taskId, newStatus as 'todo' | 'done');
        if (error) {
            // Revert on error
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: currentStatus as 'todo' | 'done' } : t
            ));
        }
    };

    const handleAddTask = async () => {
        if (!newTaskTitle.trim() || !newTaskDate) return;

        setIsSubmitting(true);
        const { task, error } = await createTask(
            newTaskTitle.trim(),
            new Date(newTaskDate),
            undefined,
            newTaskColor
        );

        if (!error && task) {
            setTasks(prev => [...prev, task].sort((a, b) =>
                new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            ));
            setNewTaskTitle("");
            setNewTaskDate("");
            setIsAddingTask(false);
        }
        setIsSubmitting(false);
    };

    const groupedTasks = groupTasksByPeriod(tasks.filter(t => t.status === 'todo'));
    const completedCount = tasks.filter(t => t.status === 'done').length;

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center h-full", className)}>
                <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className={cn(
            "h-full flex flex-col bg-surface border border-zinc-800 rounded-3xl overflow-hidden",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-lime-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        The Stream
                    </span>
                    <span className="text-xs text-zinc-600">
                        ({tasks.filter(t => t.status === 'todo').length})
                    </span>
                </div>
                <button
                    onClick={() => setIsAddingTask(true)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-lime-400 transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
                {groupedTasks.length === 0 && !isAddingTask ? (
                    <div className="text-center py-8">
                        <Clock className="mx-auto text-zinc-700 mb-3" size={32} />
                        <p className="text-zinc-500 text-sm">No tasks yet</p>
                        <button
                            onClick={() => setIsAddingTask(true)}
                            className="text-lime-400 text-xs mt-2 hover:underline"
                        >
                            Add your first task
                        </button>
                    </div>
                ) : (
                    groupedTasks.map((group) => (
                        <div key={group.label}>
                            {/* Period Label */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider",
                                    group.label === "Today" ? "text-lime-400" :
                                        group.label === "Tomorrow" ? "text-amber-400" :
                                            "text-zinc-500"
                                )}>
                                    {group.label}
                                </span>
                                <div className="flex-1 h-px bg-zinc-800" />
                            </div>

                            {/* Task Pills */}
                            <div className="space-y-2">
                                {group.tasks.map((task) => {
                                    const color = TASK_COLORS[task.category_color] || TASK_COLORS.zinc;
                                    return (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer",
                                                color.bg, color.border,
                                                "hover:scale-[1.01] active:scale-[0.99]"
                                            )}
                                            onClick={() => handleToggleTask(task.id, task.status)}
                                        >
                                            {/* Checkbox */}
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                                task.status === 'done'
                                                    ? "bg-lime-400 border-lime-400"
                                                    : `border-current ${color.text}`
                                            )}>
                                                {task.status === 'done' && (
                                                    <CheckCircle2 size={12} className="text-black" />
                                                )}
                                            </div>

                                            {/* Title */}
                                            <div className="flex-1 min-w-0">
                                                <span className={cn(
                                                    "text-sm font-medium truncate block",
                                                    task.status === 'done'
                                                        ? "text-zinc-500 line-through"
                                                        : "text-white"
                                                )}>
                                                    {task.title}
                                                </span>
                                            </div>

                                            {/* Due Time */}
                                            <span className={cn(
                                                "text-xs shrink-0",
                                                color.text
                                            )}>
                                                {formatDueDate(task.due_date)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}

                {/* Add Task Form */}
                {isAddingTask && (
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-3">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task title..."
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-lime-500"
                            autoFocus
                        />
                        <input
                            type="datetime-local"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-lime-500"
                        />
                        <div className="flex gap-2">
                            {Object.keys(TASK_COLORS).slice(0, 5).map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewTaskColor(color)}
                                    className={cn(
                                        "w-6 h-6 rounded-full border-2 transition-all",
                                        TASK_COLORS[color].text.replace('text-', 'bg-').replace('-400', '-500'),
                                        newTaskColor === color ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"
                                    )}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddTask}
                                disabled={isSubmitting || !newTaskTitle.trim() || !newTaskDate}
                                className="flex-1 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Add Task
                            </button>
                            <button
                                onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setNewTaskDate(""); }}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            {completedCount > 0 && (
                <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
                    <span className="text-xs text-zinc-500">
                        {completedCount} completed
                    </span>
                </div>
            )}
        </div>
    );
}
