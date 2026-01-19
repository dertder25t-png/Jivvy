'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Calendar, Flag, Hash, ArrowUp, X, ChevronDown, Plus, Check, Inbox, CornerDownRight, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface TaskToolbarProps {
    visible: boolean;
    metadata: {
        date: Date | null;
        priority: string | null;
        project: string | null;
    };
    onUpdate?: (key: string, value: any) => void;
}

export function TaskToolbar({ visible, metadata, onUpdate }: TaskToolbarProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);

    const [priorityOpen, setPriorityOpen] = useState(false);
    const [projectOpen, setProjectOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const projects = useLiveQuery(() => db.projects.toArray()) || [];

    // Animation Effect
    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!shouldRender) return null;

    const priorities = [
        { id: 'p1', label: 'Priority 1', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: Flag },
        { id: 'p2', label: 'Priority 2', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: Flag },
        { id: 'p3', label: 'Priority 3', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Flag },
        { id: 'p4', label: 'No Priority', color: 'text-zinc-400', bg: 'bg-zinc-50 dark:bg-zinc-900/20', icon: Flag }
    ];

    const currentPriority = priorities.find(p => p.id === metadata.priority?.toLowerCase()) || priorities[3];

    const handleAddProject = async () => {
        if (!newProjectName.trim()) return;
        const id = uuidv4();
        await db.projects.add({
            id,
            title: newProjectName.trim(),
            created_at: Date.now(),
            updated_at: Date.now(),
            sync_status: 'dirty',
            is_archived: false
        });
        onUpdate?.('project', newProjectName.trim());
        setNewProjectName('');
        setProjectOpen(false);
    };

    return (
        <div
            className={cn(
                "absolute z-50 left-0 transition-opacity duration-300 ease-out",
                isVisible ? "opacity-100 translate-y-2" : "opacity-0 translate-y-4"
            )}
            style={{ top: '100%' }}
        >
            <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 text-sm">

                {/* Date Picker */}
                <div className="relative group">
                    <div
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors",
                            metadata.date
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                        )}
                        onClick={() => dateInputRef.current?.showPicker()}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                            {metadata.date ? format(metadata.date, 'MMM d') : 'Today'}
                        </span>

                        {/* Hidden Native Date Input */}
                        <input
                            ref={dateInputRef}
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={(e) => {
                                const date = e.target.valueAsDate;
                                // Adjust for timezone offset if needed, but standard date input usually handles local->UTC
                                // Simple fix: use the date string to create a generic date
                                // Note: e.target.value is 'YYYY-MM-DD'
                                if (date) {
                                    // Set to noon to avoid timezone rollover issues for simple date tracking
                                    const d = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0);
                                    onUpdate?.('date', d);
                                } else {
                                    onUpdate?.('date', null);
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

                {/* Priority Selector */}
                <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                                metadata.priority && metadata.priority !== 'p4'
                                    ? `${currentPriority.bg} ${currentPriority.color}`
                                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                            )}
                        >
                            <Flag className={cn("w-3.5 h-3.5", metadata.priority && metadata.priority !== 'p4' && "fill-current")} />
                            <span className="text-xs font-medium">
                                {metadata.priority ? currentPriority.label : 'Priority'}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-48 p-1">
                        <div className="flex flex-col gap-0.5">
                            {priorities.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        const newVal = p.id === 'p4' ? null : p.id;
                                        onUpdate?.('priority', newVal);
                                        const colorMap: Record<string, string> = {
                                            'p1': '#ef4444',
                                            'p2': '#f97316',
                                            'p3': '#3b82f6'
                                        };
                                        onUpdate?.('color', newVal ? colorMap[newVal] : null);
                                        setPriorityOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                                        metadata.priority === p.id ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Flag className={cn("w-4 h-4", p.color, (metadata.priority === p.id || (p.id === 'p4' && !metadata.priority)) && "fill-current")} />
                                    <span className={cn("flex-1 text-left", p.color)}>{p.label}</span>
                                    {(metadata.priority === p.id || (p.id === 'p4' && !metadata.priority)) && <Check className="w-3.5 h-3.5 ml-auto text-zinc-500" />}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

                {/* Project Selector */}
                <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                    <PopoverTrigger asChild>
                        <div
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors",
                                metadata.project
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                            )}
                        >
                            <Hash className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium truncate max-w-[100px]">
                                {metadata.project || 'Project'}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2">
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                <button
                                    onClick={() => {
                                        onUpdate?.('project', null);
                                        setProjectOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left",
                                        !metadata.project && "bg-zinc-100 dark:bg-zinc-800"
                                    )}
                                >
                                    <Inbox className="w-3.5 h-3.5 text-zinc-400" />
                                    <span className="flex-1">Inbox</span>
                                    {!metadata.project && <Check className="w-3.5 h-3.5 text-zinc-500" />}
                                </button>
                                {projects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            onUpdate?.('project', p.title);
                                            setProjectOpen(false);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left",
                                            metadata.project === p.title && "bg-zinc-100 dark:bg-zinc-800"
                                        )}
                                    >
                                        <Hash className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="flex-1 truncate">{p.title}</span>
                                        {metadata.project === p.title && <Check className="w-3.5 h-3.5 text-zinc-500" />}
                                    </button>
                                ))}
                            </div>
                            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    placeholder="Add project..."
                                    className="flex-1 bg-transparent border-none outline-none text-xs px-1"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddProject();
                                    }}
                                />
                                <button
                                    onClick={handleAddProject}
                                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded col-span-1"
                                >
                                    <Plus className="w-3.5 h-3.5 text-zinc-500" />
                                </button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

                {/* Actions */}
                <div className="flex items-center gap-0.5 px-1">
                    <button
                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                        onClick={() => onUpdate?.('add-subtask', true)}
                        title="Add Subtask"
                    >
                        <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
