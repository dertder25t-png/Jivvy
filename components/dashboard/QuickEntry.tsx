'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, Block } from '@/lib/db';
import { Calendar, Hash, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, nextMonday } from 'date-fns';

interface QuickEntryProps {
    className?: string;
    onTaskCreated?: () => void;
}

export function QuickEntry({ className, onTaskCreated }: QuickEntryProps) {
    const [inputValue, setInputValue] = useState('');
    const [dateBadge, setDateBadge] = useState<Date | null>(null);
    const [projectBadge, setProjectBadge] = useState<string | null>(null);

    // Simple parser to demonstrate "smart" features
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        // Very basic detection logic for demo
        // In a real app, this would be more robust utilizing the existing pattern-engine or similar.
        if (val.toLowerCase().includes('tomorrow')) {
            // Suggestion logic would go here, for now we manually set if they type strict commands or just leave it text
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!inputValue.trim()) return;

            // Basic parsing for demo purposes
            let finalDate = dateBadge;
            let content = inputValue;

            // "Smart" parsing simulation
            if (content.toLowerCase().includes(' tomorrow')) {
                finalDate = addDays(new Date(), 1);
                content = content.replace(/ tomorrow/i, '');
            } else if (content.toLowerCase().includes(' today')) {
                finalDate = new Date();
                content = content.replace(/ today/i, '');
            }

            const newTask: Block = {
                id: uuidv4(),
                parent_id: 'inbox',
                content: content.trim(),
                type: 'task',
                order: Date.now(),
                metadata: {
                    status: 'todo',
                    due_date: finalDate?.getTime(),
                    project_name: projectBadge || undefined
                },
                updated_at: Date.now(),
                sync_status: 'dirty'
            };

            await db.blocks.add(newTask);

            setInputValue('');
            setDateBadge(null);
            setProjectBadge(null);
            onTaskCreated?.();
        }
    };

    return (
        <div className={cn("relative group", className)}>
            <div className={cn(
                "flex items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 transition-all",
                "focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50"
            )}>
                {/* Visual Indicator */}
                <div className="w-1.5 h-6 rounded-full bg-zinc-300 dark:bg-zinc-700 group-focus-within:bg-blue-500 transition-colors" />

                {/* Main Input */}
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="What needs to be done?"
                    className="flex-1 bg-transparent border-none outline-none text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-medium"
                    autoFocus
                />

                {/* Right Side Badges/Actions */}
                <div className="flex items-center gap-2">
                    {/* Badge Container (Dynamic) */}
                    {(dateBadge || inputValue.length > 0) && (
                        <div className="flex items-center gap-1.5 pr-2 border-r border-zinc-200 dark:border-zinc-800">
                            {/* Simulated Badge Controls */}
                            <button
                                onClick={() => setDateBadge(new Date())}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                                    dateBadge
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                                )}
                            >
                                <Calendar className="w-3 h-3" />
                                {dateBadge ? format(dateBadge, 'MMM d') : 'Today'}
                            </button>
                            <button
                                onClick={() => setProjectBadge('Work')}
                                className={cn(
                                    "hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                                    projectBadge
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                                )}
                            >
                                <Hash className="w-3 h-3" />
                                {projectBadge || 'Project'}
                            </button>
                        </div>
                    )}

                    {/* Enter Hint */}
                    <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                        <CornerDownLeft className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}
