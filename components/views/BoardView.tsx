'use client';

import React from 'react';
import { Block, db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface BoardViewProps {
    tasks: Block[];
}

const COLUMNS = [
    { id: 'todo', label: 'To Do', color: 'bg-zinc-100 dark:bg-zinc-800/50' },
    { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'done', label: 'Done', color: 'bg-green-50 dark:bg-green-900/20' }
] as const;

export function BoardView({ tasks }: BoardViewProps) {
    const handleStatusChange = async (taskId: string, newStatus: string) => {
        await db.blocks.update(taskId, {
            metadata: { ...tasks.find(t => t.id === taskId)?.metadata, status: newStatus },
            updated_at: Date.now()
        });
    };

    const getTasksForColumn = (status: string) => { // 'todo' is default
        return tasks.filter(task => {
            const s = task.metadata?.status || 'todo';
            return s === status;
        });
    };

    return (
        <div className="h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory md:snap-none">
            <div className="h-full flex gap-4 px-4 min-w-[300px] md:min-w-0">
                {COLUMNS.map(column => {
                    const columnTasks = getTasksForColumn(column.id);

                    return (
                        <div
                            key={column.id}
                            className={cn(
                                "flex-shrink-0 w-[85vw] md:w-1/3 h-full flex flex-col snap-center rounded-xl border border-zinc-200 dark:border-zinc-800",
                                "bg-zinc-50 dark:bg-zinc-900", // Tray styling
                                "shadow-sm"
                            )}
                        >
                            {/* Column Header */}
                            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-800/50 rounded-t-xl">
                                <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                                    {column.label}
                                </span>
                                <span className="text-xs font-mono text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                                    {columnTasks.length}
                                </span>
                            </div>

                            {/* Cards Container */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {columnTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "p-4 bg-white dark:bg-zinc-800 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-700",
                                            "hover:shadow-md transition-shadow cursor-pointer relative group",
                                            "flex flex-col gap-2",
                                            "border-l-4", // Index card feel
                                            column.id === 'done' ? "border-l-green-500 opacity-75" :
                                                column.id === 'in_progress' ? "border-l-blue-500" : "border-l-zinc-300 dark:border-l-zinc-600"
                                        )}
                                        onClick={() => {
                                            // Handle click to edit/open details? Or just basic toggle on mobile?
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={cn(
                                                "text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug break-words",
                                                column.id === 'done' && "line-through text-zinc-500"
                                            )}>
                                                {task.content}
                                            </p>

                                            {/* Quick Actions */}
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity md:flex hidden flex-shrink-0">
                                                {column.id !== 'done' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStatusChange(task.id, 'done');
                                                        }}
                                                        className="text-zinc-400 hover:text-green-500"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Footer */}
                                        {(task.metadata?.due_date) && (
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 border-t border-dashed border-zinc-100 dark:border-zinc-700 pt-2">
                                                {task.metadata.due_date && (
                                                    <span className={cn(
                                                        "flex items-center gap-1",
                                                        task.metadata.due_date < Date.now() && column.id !== 'done' ? "text-red-500" : ""
                                                    )}>
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(task.metadata.due_date), 'MMM d')}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Mobile Action: Swipe logic is complex to implement in pure React quickly without libraries, 
                                            so we rely on simple tap or move buttons for now if needed, or Drag and Drop later. 
                                            For this 'Tactile' feel, let's add a small 'Move' menu or just rely on changing status via details or simple buttons.
                                            Actually, let's just make the whole card clickable for now, and maybe a simple status cycler?
                                        */}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
