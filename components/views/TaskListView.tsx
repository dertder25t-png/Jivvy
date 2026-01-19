'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Block } from '@/lib/db';
import { format, isToday, isPast, isTomorrow, isThisWeek } from 'date-fns';
import { Calendar, Hash, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockList } from '@/components/editor/BlockList';

interface TaskListViewProps {
    view: 'inbox' | 'today' | 'upcoming';
}

export function TaskListView({ view }: TaskListViewProps) {
    const { blocks, projects } = useStore();

    // Group blocks logic
    const sections = useMemo(() => {
        if (view === 'inbox') {
            return [{ id: 'inbox', title: 'Inbox', blocks: blocks.filter(b => !b.metadata?.due_date) }]; // Or filtering by parent_id if using folder structure
            // Actually, usually Inbox is a specific project ID, so we might just reuse BlockList logic but visually styled different.
            // But if we want "Smart Views" (e.g. all tasks across all projects due today), we need a flat list.
        }

        // For now, let's assume 'Today' view aggregates all tasks from all projects (if we had them loaded)
        // Since we currently only load one project at a time in the store (currentProjectId), 
        // we might need to change the store to load ALL blocks for these smart views or use a live query here.
        // For this "Transplant" phase, let's stick to the Project-based view but stylized.

        return [];
    }, [blocks, view]);

    // Wait, the current store ONLY loads the current project's blocks. 
    // If we want a "Today" view that aggregates tasks from ALL projects, we need a different query.
    // Let's implement a specific LiveQuery here for the "Today" view.

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    {view === 'inbox' && <Inbox className="w-6 h-6 text-blue-500" />}
                    {view === 'today' && <Calendar className="w-6 h-6 text-green-500" />}
                    {view === 'upcoming' && <Calendar className="w-6 h-6 text-purple-500" />}

                    {view === 'inbox' ? 'Inbox' : view === 'today' ? 'Today' : 'Upcoming'}
                </h1>
                <div className="text-zinc-500 text-sm mt-1">
                    {view === 'today' && format(new Date(), 'EEE MMM d')}
                </div>
            </div>

            {/* If we are just routing to the Inbox Project, we can just use BlockList with a "list" variant prop. */}
            {/* But the user wants Todoist style. */}

            {/* Ideally, we wrap BlockList but pass a prop to render items as "Task Items" instead of "Document Blocks" */}
            <BlockList
                projectId="inbox" // For Inbox view
                variant="todoist"
            />
        </div>
    );
}
