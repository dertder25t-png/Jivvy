'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/lib/store';
import { db, Block } from '@/lib/db';
import { SmartTaskInput } from '@/components/SmartTaskInput';
import { QuickAdd } from '@/components/QuickAdd';
import { Loader2, Circle, Inbox, Calendar, Trash } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dashboard = () => {
    const { dashboardView, deleteBlock } = useProjectStore();
    const [tasks, setTasks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            let result: Block[] = [];

            // Dexie filtering
            // Note: For large datasets, we should use indexes. For now, filter in memory.
            const allTasks = await db.blocks.where('type').equals('task').toArray();

            if (dashboardView === 'inbox') {
                // Inbox: todo status + no scheduled date
                result = allTasks.filter(b =>
                    (b.metadata?.status === 'todo' || !b.metadata?.status) &&
                    !b.metadata?.scheduled_date
                );
            } else if (dashboardView === 'today') {
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

                result = allTasks.filter(b => {
                    const date = b.metadata?.scheduled_date;
                    return (b.metadata?.status === 'todo' || !b.metadata?.status) && date && date >= startOfDay && date < endOfDay;
                });
            } else if (dashboardView === 'upcoming') {
                const now = new Date();
                const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

                result = allTasks.filter(b => {
                    const date = b.metadata?.scheduled_date;
                    return (b.metadata?.status === 'todo' || !b.metadata?.status) && date && date >= startOfTomorrow;
                });
            }
            // Sort by order (recently created first)
            result.sort((a, b) => (b.order || 0) - (a.order || 0));
            setTasks(result);
        } catch (e) {
            console.error("Failed to fetch tasks", e);
        } finally {
            setLoading(false);
        }
    }, [dashboardView]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const toggleTask = async (id: string, currentStatus: string) => {
        // Optimistic Removal
        setTasks(prev => prev.filter(t => t.id !== id));

        try {
            const newStatus = currentStatus === 'done' ? 'todo' : 'done';
            // We use a safe wrapper or direct dexie
            await db.blocks.update(id, {
                'metadata.status': newStatus,
                'metadata.updated_at': Date.now()
            });
            // Don't refetch, as we wanted it removed from view
        } catch (e) {
            console.error("Failed to toggle task", e);
            fetchTasks(); // Revert on error
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (confirm("Delete this task permanently?")) {
            setTasks(prev => prev.filter(t => t.id !== id));
            try {
                await deleteBlock(id);
            } catch (e) {
                console.error("Failed to delete task", e);
                fetchTasks();
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-text-primary capitalize tracking-tight">{dashboardView}</h1>
                <p className="text-text-secondary text-sm mt-1">
                    {dashboardView === 'inbox' && "Capture your thoughts and tasks."}
                    {dashboardView === 'today' && "Focus on what matters today."}
                    {dashboardView === 'upcoming' && "Plan ahead for the future."}
                </p>
            </header>

            <div className="flex-1 overflow-y-auto mb-6">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-zinc-400" /></div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-text-secondary">
                        <Inbox className="w-8 h-8 opacity-20 mb-2" />
                        <p className="text-sm">No tasks in {dashboardView}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tasks.map(task => (
                            <div key={task.id} className="group flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 border border-border/50 hover:border-primary/20 rounded-xl transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <button
                                    onClick={() => toggleTask(task.id, task.metadata?.status || 'todo')}
                                    className="mt-0.5 text-zinc-400 hover:text-primary transition-colors"
                                    title="Complete Task"
                                >
                                    <Circle size={20} className="stroke-[1.5]" />
                                </button>
                                <div className="flex-1">
                                    <p className="text-sm text-text-primary font-medium">{task.content}</p>
                                    <div className="flex gap-2 mt-1.5">
                                        {task.metadata?.project_tag && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-text-secondary font-medium border border-border">
                                                {task.metadata.project_tag}
                                            </span>
                                        )}
                                        {task.metadata?.scheduled_date && (
                                            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                                                <Calendar size={10} />
                                                {new Date(task.metadata.scheduled_date).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 transition-all"
                                    title="Delete Task"
                                >
                                    <Trash size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Add */}
            <div className="pt-4 border-t border-border mt-auto sticky bottom-0 bg-surface">
                <QuickAdd onTaskAdded={fetchTasks} />
            </div>
        </div>
    )
}
