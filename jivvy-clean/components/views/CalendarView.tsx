'use client';

import React, { useState } from 'react';
import { Block } from '@/lib/db';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    isToday,
    startOfDay,
    endOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
    tasks: Block[];
}

type CalendarMode = 'month' | 'week' | 'day';

export function CalendarView({ tasks }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<CalendarMode>('month');

    const navigate = (direction: 'prev' | 'next') => {
        if (viewMode === 'month') {
            setCurrentDate(d => direction === 'next' ? addMonths(d, 1) : subMonths(d, 1));
        } else if (viewMode === 'week') {
            setCurrentDate(d => direction === 'next' ? addWeeks(d, 1) : subWeeks(d, 1));
        } else {
            setCurrentDate(d => direction === 'next' ? addDays(d, 1) : subDays(d, 1));
        }
    };

    const goToToday = () => setCurrentDate(new Date());

    const getDaysForGrid = () => {
        if (viewMode === 'month') {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const startDate = startOfWeek(monthStart);
            const endDate = endOfWeek(monthEnd);
            return eachDayOfInterval({ start: startDate, end: endDate });
        } else if (viewMode === 'week') {
            const startDate = startOfWeek(currentDate);
            const endDate = endOfWeek(currentDate);
            return eachDayOfInterval({ start: startDate, end: endDate });
        } else {
            return [currentDate];
        }
    };

    const days = getDaysForGrid();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Header Title logic
    const getHeaderTitle = () => {
        if (viewMode === 'month') return format(currentDate, "MMMM yyyy");
        if (viewMode === 'week') {
            const start = startOfWeek(currentDate);
            const end = endOfWeek(currentDate);
            if (isSameMonth(start, end)) return format(start, "MMMM yyyy");
            return `${format(start, "MMM")} - ${format(end, "MMM yyyy")}`;
        }
        return format(currentDate, "EEEE, MMMM do, yyyy");
    };

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-zinc-950 rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 gap-3 sm:gap-0">

                {/* Left: Navigation & Title */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigate('prev')}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => navigate('next')}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={goToToday}
                            className="text-xs px-2 py-1 ml-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 transition-colors font-medium"
                        >
                            Today
                        </button>
                    </div>
                    <h2 className="text-sm sm:text-lg font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                        {getHeaderTitle()}
                    </h2>
                </div>

                {/* Right: View Toggles */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                    {(['month', 'week', 'day'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={cn(
                                "px-3 py-1 rounded-md text-xs font-medium capitalize transition-all",
                                viewMode === mode
                                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Days Header (Only for Month/Week) */}
            {viewMode !== 'day' && (
                <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                            {day}
                        </div>
                    ))}
                </div>
            )}

            {/* Calendar Grid */}
            <div className={cn(
                "flex-1 bg-zinc-200 dark:bg-zinc-800 gap-[1px]",
                viewMode === 'day' ? "flex flex-col bg-white dark:bg-zinc-950" : "grid grid-cols-7",
                viewMode === 'month' ? "grid-rows-5 lg:grid-rows-6 auto-rows-fr" : "",
                viewMode === 'week' ? "auto-rows-fr" : ""
            )}>
                {days.map((day, i) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const dayTasks = tasks.filter(task =>
                        task.due_date && isSameDay(new Date(task.due_date), day)
                    );

                    // Day View Rendering
                    if (viewMode === 'day') {
                        return (
                            <div key={day.toString()} className="flex-1 p-6 overflow-y-auto">
                                <div className="max-w-2xl mx-auto">
                                    <div className="mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Tasks for Today</h3>
                                        <p className="text-zinc-500 text-sm mt-1">{dayTasks.length} tasks scheduled</p>
                                    </div>

                                    {dayTasks.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                            <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
                                            <p>No tasks scheduled for this day.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {dayTasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm hover:border-blue-400 dark:hover:border-blue-700 transition-colors"
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors",
                                                        task.is_complete
                                                            ? "bg-blue-500 border-blue-500"
                                                            : "border-zinc-300 dark:border-zinc-600 hover:border-blue-400"
                                                    )}>
                                                        {task.is_complete && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm",
                                                        task.is_complete && "text-zinc-400 line-through"
                                                    )}>
                                                        {task.content || "Untitled Task"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    // Month/Week Grid Rendering
                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "bg-white dark:bg-zinc-900 p-2 flex flex-col transition-colors group relative",
                                viewMode === 'month' && !isCurrentMonth && "bg-zinc-50/50 dark:bg-zinc-950 text-zinc-400",
                                isToday(day) && "bg-blue-50/30 dark:bg-blue-900/10",
                                viewMode === 'week' && "min-h-[300px]"
                            )}
                        >
                            {/* Date Number */}
                            <div className={cn(
                                "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                isToday(day)
                                    ? "bg-blue-600 text-white"
                                    : "text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800"
                            )}>
                                {format(day, "d")}
                            </div>

                            {/* Tasks List */}
                            <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                {dayTasks.slice(0, viewMode === 'week' ? 10 : 3).map(task => (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer transition-colors",
                                            task.is_complete
                                                ? "bg-zinc-100 text-zinc-400 border-zinc-200 line-through dark:bg-zinc-800 dark:border-zinc-700"
                                                : "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:border-blue-700"
                                        )}
                                        title={task.content}
                                    >
                                        {task.content || "Untitled Task"}
                                    </div>
                                ))}
                                {dayTasks.length > (viewMode === 'week' ? 10 : 3) && (
                                    <div className="text-[10px] text-zinc-400 pl-1 font-medium">
                                        + {dayTasks.length - (viewMode === 'week' ? 10 : 3)} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
