'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Block } from '@/lib/db';
import { startOfDay, isToday } from 'date-fns';
import { useStore } from '@/lib/store';
import { DisplayMenu } from './DisplayMenu';
import { PaperView } from './PaperView';
import { BoardView } from '@/components/views/BoardView';
import { CalendarView } from '@/components/views/CalendarView';

interface TaskDashboardProps {
    view: 'inbox' | 'today' | 'upcoming';
}

export function TaskDashboard({ view: navigationView }: TaskDashboardProps) {
    const { viewLayout } = useStore();

    // Load all task blocks
    const allTasks = useLiveQuery(
        async () => {
            const tasks = await db.blocks
                .where('type')
                .equals('task')
                .toArray();
            return tasks.sort((a, b) => a.order - b.order);
        },
        [],
        []
    );

    // Filter tasks based on navigation view (Inbox/Today/Upcoming)
    // Filter tasks based on navigation view (Inbox/Today/Upcoming)
    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];

        const todayStart = startOfDay(new Date()).getTime();
        const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
        const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

        // 1. Identify primary matches
        const primaryMatches = allTasks.filter(task => {
            const dueDate = task.metadata?.due_date;

            switch (navigationView) {
                case 'inbox':
                    return !dueDate || task.parent_id === 'inbox';
                case 'today':
                    if (!dueDate) return false;
                    return dueDate >= todayStart && dueDate < tomorrowStart;
                case 'upcoming':
                    if (!dueDate) return false;
                    return dueDate >= tomorrowStart && dueDate < weekEnd;
                default:
                    return false;
            }
        });

        // 2. Build Hierarchy Helpers
        const childrenMap = new Map<string, Block[]>();
        allTasks.forEach(t => {
            if (t.parent_id) {
                if (!childrenMap.has(t.parent_id)) childrenMap.set(t.parent_id, []);
                childrenMap.get(t.parent_id)!.push(t);
            }
        });

        // 3. Collect Descendants
        const resultIds = new Set(primaryMatches.map(t => t.id));
        const queue = [...primaryMatches];

        while (queue.length > 0) {
            const task = queue.shift()!;
            const children = childrenMap.get(task.id);
            if (children) {
                children.forEach(child => {
                    if (!resultIds.has(child.id)) {
                        resultIds.add(child.id);
                        queue.push(child);
                    }
                });
            }
        }

        // Return final list preserving the sort order from allTasks
        return allTasks.filter(t => resultIds.has(t.id));
    }, [allTasks, navigationView]);

    const activeViewComponent = () => {
        switch (viewLayout) {
            case 'board': return <BoardView tasks={filteredTasks} />;
            case 'calendar': return <CalendarView tasks={filteredTasks} />;
            case 'list':
            default: return <PaperView tasks={filteredTasks} view={navigationView} />;
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 md:px-8 py-6 font-sans">
            {/* Header / Controls */}
            <div className="flex justify-between items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">
                        {navigationView}
                    </h1>
                </div>
                <div className="flex-shrink-0">
                    <DisplayMenu />
                </div>
            </div>

            {/* Main Content Area - Digital Paper Look */}
            <div className="flex-1 min-h-0 relative">
                <div className="h-full overflow-auto scrollbar-hide">
                    {activeViewComponent()}
                </div>
            </div>
        </div>
    );
}
