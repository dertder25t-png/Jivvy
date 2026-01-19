'use client';

import React, { useState } from 'react';
import { db, Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { format, isToday as isTodayFn, isTomorrow } from 'date-fns';
import { CheckCircle2, Circle, Calendar } from 'lucide-react';

interface ListViewProps {
    tasks: Block[];
    view: 'inbox' | 'today' | 'upcoming';
}

export function ListView({ tasks, view }: ListViewProps) {
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

    // Grouping Logic reused from TaskDashboard
    const taskGroups = React.useMemo(() => {
        const groups: { title: string; tasks: Block[] }[] = [];

        if (view === 'inbox') {
            const projectMap = new Map<string, Block[]>();
            tasks.forEach(task => {
                const projectId = task.parent_id || 'inbox';
                if (!projectMap.has(projectId)) projectMap.set(projectId, []);
                projectMap.get(projectId)!.push(task);
            });
            projectMap.forEach((tasks, projectId) => {
                groups.push({
                    title: projectId === 'inbox' ? 'Inbox' : `Project ${projectId.slice(0, 8)}`,
                    tasks
                });
            });
        } else {
            const dateMap = new Map<string, Block[]>();
            tasks.forEach(task => {
                const dueDate = task.metadata?.due_date;
                if (!dueDate) return;
                const dateStr = format(new Date(dueDate), 'yyyy-MM-dd');
                if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
                dateMap.get(dateStr)!.push(task);
            });
            Array.from(dateMap.keys()).sort().forEach(dateStr => {
                const date = new Date(dateStr);
                let title = format(date, 'EEE, MMM d');
                if (isTodayFn(date)) title = `Today • ${format(date, 'MMM d')}`;
                else if (isTomorrow(date)) title = `Tomorrow • ${format(date, 'MMM d')}`;

                groups.push({ title, tasks: dateMap.get(dateStr)! });
            });
        }
        return groups;
    }, [tasks, view]);

    // Handlers
    const handleToggleTask = async (task: Block) => {
        const newStatus = task.metadata?.status === 'done' ? 'todo' : 'done';
        await db.blocks.update(task.id, {
            metadata: { ...task.metadata, status: newStatus },
            updated_at: Date.now()
        });
    };

    const handleUpdateTask = async (taskId: string, content: string) => {
        await db.blocks.update(taskId, { content, updated_at: Date.now() });
    };

    const handleDeleteTask = async (taskId: string) => {
        await db.blocks.delete(taskId);
    };

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                <p>No tasks found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {taskGroups.map((group, idx) => (
                <div key={idx}>
                    <h3 className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">{group.title}</h3>
                    <div className="space-y-1">
                        {group.tasks.map(task => {
                            const isCompleted = task.metadata?.status === 'done';
                            const isEditing = focusedTaskId === task.id;

                            return (
                                <div key={task.id} className={cn(
                                    "group flex items-start gap-3 p-3 rounded-lg transition-all",
                                    "hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                                    isCompleted && "opacity-60"
                                )}>
                                    <button onClick={() => handleToggleTask(task)} className="mt-0.5 flex-shrink-0">
                                        {isCompleted ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-zinc-300 hover:text-zinc-500" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="w-full bg-transparent border-none outline-none text-sm"
                                                value={task.content}
                                                onChange={(e) => handleUpdateTask(task.id, e.target.value)}
                                                onBlur={() => setFocusedTaskId(null)}
                                                onKeyDown={(e) => e.key === 'Enter' && setFocusedTaskId(null)}
                                            />
                                        ) : (
                                            <div onClick={() => setFocusedTaskId(task.id)} className={cn("text-sm cursor-pointer", isCompleted && "line-through text-zinc-400")}>
                                                {task.content}
                                            </div>
                                        )}
                                        {task.metadata?.due_date && view === 'inbox' && (
                                            <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(task.metadata.due_date), 'MMM d')}
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs">
                                        Delete
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
