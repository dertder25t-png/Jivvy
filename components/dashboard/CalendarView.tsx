"use client";

import React, { useState, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Circle,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserTasks, type Task } from "@/app/tasks/actions";

interface CalendarViewProps {
    className?: string;
}

// Task color mapping
const TASK_COLORS: Record<string, string> = {
    lime: "bg-lime-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    cyan: "bg-cyan-400",
    zinc: "bg-zinc-400",
};

// Get days in a month
function getDaysInMonth(year: number, month: number): Date[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add padding for start of week (Sunday = 0)
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
        days.push(new Date(year, month, -i));
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push(new Date(year, month, i));
    }

    // Add padding for end of week
    const endPadding = 7 - (days.length % 7);
    if (endPadding < 7) {
        for (let i = 1; i <= endPadding; i++) {
            days.push(new Date(year, month + 1, i));
        }
    }

    return days;
}

// Get tasks for a specific date
function getTasksForDate(tasks: Task[], date: Date): Task[] {
    return tasks.filter(task => {
        const taskDate = new Date(task.due_date);
        return taskDate.getFullYear() === date.getFullYear() &&
            taskDate.getMonth() === date.getMonth() &&
            taskDate.getDate() === date.getDate();
    });
}

export function CalendarView({ className }: CalendarViewProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = getDaysInMonth(year, month);
    const today = new Date();

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

    const goToPrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    };

    const selectedDateTasks = selectedDate ? getTasksForDate(tasks, selectedDate) : [];

    return (
        <div className={cn("flex-1 flex flex-col lg:flex-row gap-6 p-6", className)}>
            {/* Calendar Grid */}
            <div className="flex-1 bg-surface border border-zinc-800 rounded-3xl p-6 flex flex-col">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-white">
                            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button
                            onClick={goToToday}
                            className="text-xs font-bold text-lime-400 hover:text-lime-300 transition-colors"
                        >
                            Today
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={goToPrevMonth}
                            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                            <ChevronLeft size={18} className="text-white" />
                        </button>
                        <button
                            onClick={goToNextMonth}
                            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                            <ChevronRight size={18} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-bold text-zinc-500 uppercase py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1 flex-1">
                    {days.map((date, index) => {
                        const isCurrentMonth = date.getMonth() === month;
                        const isToday = date.toDateString() === today.toDateString();
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        const dayTasks = getTasksForDate(tasks, date);
                        const hasTasks = dayTasks.length > 0;

                        return (
                            <button
                                key={index}
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                    "relative flex flex-col items-center justify-start p-2 rounded-xl transition-all min-h-[80px]",
                                    isCurrentMonth ? "bg-zinc-900/30" : "bg-transparent opacity-40",
                                    isToday && "ring-2 ring-lime-400/50",
                                    isSelected && "bg-lime-400/20 ring-2 ring-lime-400",
                                    "hover:bg-zinc-800/50"
                                )}
                            >
                                <span className={cn(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                    isToday && "bg-lime-400 text-black",
                                    !isToday && isCurrentMonth && "text-white",
                                    !isToday && !isCurrentMonth && "text-zinc-600"
                                )}>
                                    {date.getDate()}
                                </span>

                                {/* Task Dots */}
                                {hasTasks && (
                                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-full">
                                        {dayTasks.slice(0, 3).map((task, i) => (
                                            <div
                                                key={task.id}
                                                className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    TASK_COLORS[task.category_color] || "bg-zinc-400",
                                                    task.status === 'done' && "opacity-40"
                                                )}
                                            />
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <span className="text-[8px] text-zinc-500">+{dayTasks.length - 3}</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Date Tasks Panel */}
            <div className="w-full lg:w-80 bg-surface border border-zinc-800 rounded-3xl p-4 flex flex-col">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">
                    {selectedDate
                        ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                        : 'Select a date'
                    }
                </h3>

                {selectedDate && (
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {selectedDateTasks.length === 0 ? (
                            <p className="text-zinc-500 text-sm">No tasks for this day</p>
                        ) : (
                            selectedDateTasks.map(task => (
                                <div
                                    key={task.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                        `bg-${task.category_color}-500/10 border-${task.category_color}-500/30`
                                    )}
                                >
                                    {task.status === 'done' ? (
                                        <CheckCircle2 size={16} className="text-lime-400 shrink-0" />
                                    ) : (
                                        <Circle size={16} className="text-zinc-500 shrink-0" />
                                    )}
                                    <span className={cn(
                                        "text-sm",
                                        task.status === 'done' ? "text-zinc-500 line-through" : "text-white"
                                    )}>
                                        {task.title}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
