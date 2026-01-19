'use client';

import React, { useRef, useState, useEffect } from 'react';
import { LayoutList, Kanban, Calendar, SlidersHorizontal, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function DisplayMenu() {
    const {
        viewLayout, setViewLayout,
        viewGrouping, setViewGrouping,
        viewSorting, setViewSorting,
        showCompletedTasks, setShowCompletedTasks
    } = useStore();

    const [open, setOpen] = useState(false);

    const views = [
        { id: 'list', icon: LayoutList, label: 'List' },
        { id: 'board', icon: Kanban, label: 'Board' },
        { id: 'calendar', icon: Calendar, label: 'Calendar' }
    ] as const;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                        "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800",
                        "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100",
                        "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 shadow-sm",
                        open && "ring-2 ring-zinc-200 dark:ring-zinc-700"
                    )}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Display</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] p-2" sideOffset={8}>

                {/* Layout Section */}
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Layout</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        {views.map(view => {
                            const isActive = viewLayout === view.id;
                            const Icon = view.icon;
                            return (
                                <button
                                    key={view.id}
                                    onClick={() => setViewLayout(view.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                                        isActive
                                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
                                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {view.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Show Completed */}
                <div className="flex items-center justify-between px-2 py-1.5 mb-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md cursor-pointer" onClick={() => setShowCompletedTasks(!showCompletedTasks)}>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Completed tasks</span>
                    <div className={cn(
                        "w-9 h-5 rounded-full relative transition-colors duration-200",
                        showCompletedTasks ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
                    )}>
                        <div className={cn(
                            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                            showCompletedTasks && "translate-x-4"
                        )} />
                    </div>
                </div>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

                {/* Grouping */}
                <div className="space-y-1">
                    <div className="px-2 text-xs font-medium text-zinc-500 mb-1">Grouping</div>
                    <SectionSelect
                        value={viewGrouping}
                        onChange={setViewGrouping}
                        options={[
                            { value: 'none', label: 'None' },
                            { value: 'project', label: 'Project' },
                            { value: 'date', label: 'Date' }
                        ]}
                    />
                </div>

                {/* Sorting */}
                <div className="space-y-1 mt-3">
                    <div className="px-2 text-xs font-medium text-zinc-500 mb-1">Sorting</div>
                    <SectionSelect
                        value={viewSorting}
                        onChange={setViewSorting}
                        options={[
                            { value: 'smart', label: 'Smart' },
                            { value: 'date', label: 'Date' },
                            { value: 'priority', label: 'Priority' },
                            { value: 'alpha', label: 'A-Z' }
                        ]}
                    />
                </div>

            </PopoverContent>
        </Popover>
    );
}

function SectionSelect({ value, onChange, options }: { value: string, onChange: (v: any) => void, options: { value: string, label: string }[] }) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 text-left outline-none cursor-pointer"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </div>

            {/* Custom UI overlay could be built here instead of native select for full fidelity, 
                but native select is accessible and simpler for this interaction pattern. 
                For high fidelity per design, we can use a nested popover or dropdown menu structure.
                Given the screenshot shows a dropdown feel, let's keep it simple with native select styled effectively,
                or build a custom list if needed. Native select is fine for MVP "Settings" style dropdowns.
            */}
        </div>
    );
}
