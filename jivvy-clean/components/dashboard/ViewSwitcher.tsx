'use client';

import React from 'react';
import { LayoutList, Kanban, Calendar } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ViewSwitcher() {
    const { viewLayout, setViewLayout } = useStore();

    const views = [
        { id: 'list', icon: LayoutList, label: 'List' },
        { id: 'board', icon: Kanban, label: 'Board' },
        { id: 'calendar', icon: Calendar, label: 'Calendar' }
    ] as const;

    return (
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {views.map((view) => {
                const isActive = viewLayout === view.id;
                const Icon = view.icon;

                return (
                    <button
                        key={view.id}
                        onClick={() => setViewLayout(view.id)}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-100",
                            "outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            // Mechanical feel implementation
                            isActive ? (
                                "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 translate-y-[1px]"
                            ) : (
                                "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                            )
                        )}
                        aria-pressed={isActive}
                    >
                        <Icon className="w-4 h-4" />
                        <span className={cn(
                            "hidden md:inline-block", // Compact on mobile
                            isActive && "inline-block" // Show label for active item even on mobile if space permits? User requirement: Mobile (hidden md:flex), Desktop: allow full labels.
                            // Actually user said: On Mobile (`hidden md:flex`), keep it compact. 
                            // Let's hide text mostly on mobile, but maybe show it for active? 
                            // User requirement: "On Mobile (`hidden md:flex`), keep it compact." -> implies icons only on mobile.
                        )}>
                            {view.label}
                        </span>
                        {/* Mobile-only label logic adjustment based on prompt interpretation:
                            Prompt says: "On Mobile (`hidden md:flex`), keep it compact. On Desktop, allow full labels."
                            Wait, `hidden md:flex` means hidden on mobile and flex on desktop. That might be referring to the label itself, or the component?
                            "Responsiveness: On Mobile (`hidden md:flex`), keep it compact."
                            Likely means: Label is hidden on mobile (`hidden`), shows on desktop (`md:block` or similar).
                        */}
                    </button>
                );
            })}
        </div>
    );
}
