'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Hash, Flag, CornerDownLeft, X, ChevronDown, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, nextMonday } from 'date-fns';
import { db, Block } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLiveQuery } from 'dexie-react-hooks';

interface TypewriterInputProps {
    onTaskCreated?: () => void; // Callback to refresh or notify
}

type InputField = 'title' | 'date' | 'project' | 'priority';

export function TypewriterInput({ onTaskCreated }: TypewriterInputProps) {
    const [activeField, setActiveField] = useState<InputField>('title');
    const [title, setTitle] = useState('');
    const [date, setDate] = useState<Date | null>(null);
    const [project, setProject] = useState('Inbox');
    const [priority, setPriority] = useState<number>(4); // 1=High, 4=None
    const [priorityOpen, setPriorityOpen] = useState(false);
    const [projectOpen, setProjectOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const projects = useLiveQuery(() => db.projects.toArray()) || [];
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount or when active field changes to title?
    // Actually, we want to keep typing in the same input but "redirect" the value?
    // Or have separate inputs. "Pressing Tab cycles fields".
    // A single input that parses is "Smart Add".
    // "Cycles fields" implies focus moves.

    // Let's use a single input for the "Title" and then specialized inputs/popovers for others?
    // Or literally 4 visible fields.
    // "Looks like a terminal line".

    const cycleField = (direction: 'next' | 'prev') => {
        const fields: InputField[] = ['title', 'date', 'project', 'priority'];
        const currentIndex = fields.indexOf(activeField);
        let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        if (nextIndex >= fields.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = fields.length - 1;

        const nextField = fields[nextIndex];
        setActiveField(nextField);

        // Open popovers if needed
        if (nextField === 'priority') setPriorityOpen(true);
        else setPriorityOpen(false);

        if (nextField === 'project') setProjectOpen(true);
        else setProjectOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            cycleField(e.shiftKey ? 'prev' : 'next');
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            // If in title and it's empty, do nothing
            if (activeField === 'title' && !title.trim()) return;

            // If in other fields, maybe just confirm that field?
            // "Typewriter" usually means you type, and Enter executes the command (creates task).
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;

        const newTask: Block = {
            id: uuidv4(),
            parent_id: 'inbox', // Simplify for now
            content: title.trim(),
            type: 'task',
            order: Date.now(),
            metadata: {
                status: 'todo',
                due_date: date ? date.getTime() : undefined,
                priority: priority !== 4 ? `p${priority}` : undefined,
                project: project !== 'Inbox' ? project : undefined
            },
            updated_at: Date.now(),
            sync_status: 'dirty'
        };

        await db.blocks.add(newTask);

        // Reset
        setTitle('');
        setDate(null);
        setProject('Inbox');
        setPriority(4);
        setActiveField('title');
        onTaskCreated?.();
    };

    // Helper to render current badge value or placeholder
    const renderBadgeValue = (field: InputField) => {
        switch (field) {
            case 'date': return date ? format(date, 'MMM d') : 'No Date';
            case 'project': return project;
            case 'priority': return priority === 4 ? 'None' : `P${priority}`;
            default: return '';
        }
    };

    return (
        <div className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-lg p-2 shadow-2xl font-mono text-sm relative overflow-hidden group">
            {/* "Terminal" Header/Status Line */}
            <div className="flex items-center gap-4 px-2 pb-2 mb-2 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-widest select-none">
                <span className={cn(activeField === 'title' && "text-green-500 font-bold")}>1. INPUT</span>
                <span className={cn(activeField === 'date' && "text-blue-500 font-bold")}>2. WHEN</span>
                <span className={cn(activeField === 'project' && "text-purple-500 font-bold")}>3. WHERE</span>
                <span className={cn(activeField === 'priority' && "text-red-500 font-bold")}>4. LEVEL</span>
            </div>

            {/* Input Area */}
            <div className="flex flex-col gap-2">
                {/* Title Line */}
                <div className={cn("flex items-center gap-3 transition-opacity", activeField !== 'title' && "opacity-50")}>
                    <span className="text-green-500 font-bold animate-pulse">{'>'}</span>
                    <input
                        ref={activeField === 'title' ? inputRef : null}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown} // Tab handled here? No, inputs handle their own keys usually or need global capture.
                        // Actually, if we switch fields, we need to focus the active element.
                        // Implemented with a single event listener on container? Or distinct inputs?
                        // "Standard input replaced".
                        // Distinct inputs are easier for 'Tab' cycling if they are actual inputs.
                        // But users want to 'Type "tomorrow"'. 
                        placeholder="Task description..."
                        className="bg-transparent border-none outline-none text-zinc-100 flex-1 placeholder:text-zinc-700"
                        autoFocus
                    />
                </div>

                {/* Property Line (Visible always or just when active?) 
                    "Show 'badges' appearing as the user sets properties"
                    Let's show the properties row below the title.
                */}
                <div className="flex flex-wrap items-center gap-2 px-6">
                    {/* Date Badge */}
                    <div
                        className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded border transition-colors cursor-pointer",
                            activeField === 'date' ? "bg-blue-900/30 border-blue-500 text-blue-200" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        )}
                        onClick={() => setActiveField('date')}
                    >
                        <Calendar className="w-3 h-3" />
                        {activeField === 'date' ? (
                            <input
                                className="bg-transparent border-none outline-none w-20 text-xs"
                                placeholder="Today..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        // Simple parsing simulation
                                        const val = (e.target as HTMLInputElement).value.toLowerCase();
                                        if (val.includes('tom')) setDate(addDays(new Date(), 1));
                                        else if (val.includes('next')) setDate(nextMonday(new Date()));
                                        else setDate(new Date());
                                        e.preventDefault();
                                        cycleField('next');
                                    }
                                    handleKeyDown(e);
                                }}
                            />
                        ) : (
                            <span className="text-xs">{date ? format(date, 'MMM d') : 'Date'}</span>
                        )}
                        {date && <X className="w-3 h-3 hover:text-white" onClick={(e) => { e.stopPropagation(); setDate(null); }} />}
                    </div>

                    {/* Project Selector */}
                    <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                        <PopoverTrigger asChild>
                            <div
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1 rounded border transition-colors cursor-pointer",
                                    activeField === 'project' ? "bg-purple-900/30 border-purple-500 text-purple-200" : (project !== 'Inbox' ? "bg-purple-900/10 border-purple-500/30 text-purple-400" : "bg-zinc-800 border-zinc-700 text-zinc-500")
                                )}
                                onClick={() => setActiveField('project')}
                            >
                                <Hash className="w-3 h-3" />
                                <span className="text-xs">{project}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-56 p-2 bg-zinc-900 border-zinc-800 text-zinc-100">
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                    <button
                                        onClick={() => {
                                            setProject('Inbox');
                                            setProjectOpen(false);
                                            cycleField('next');
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors text-left",
                                            project === 'Inbox' && "bg-zinc-800"
                                        )}
                                    >
                                        <Hash className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className="flex-1">Inbox</span>
                                        {project === 'Inbox' && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                                    </button>
                                    {projects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setProject(p.title);
                                                setProjectOpen(false);
                                                cycleField('next');
                                            }}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors text-left",
                                                project === p.title && "bg-zinc-800"
                                            )}
                                        >
                                            <Hash className="w-3.5 h-3.5 text-zinc-500" />
                                            <span className="flex-1 truncate">{p.title}</span>
                                            {project === p.title && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-zinc-800" />
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="text"
                                        placeholder="New project..."
                                        className="flex-1 bg-transparent border-none outline-none text-xs px-1 text-zinc-100"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
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
                                                setProject(newProjectName.trim());
                                                setNewProjectName('');
                                                setProjectOpen(false);
                                                cycleField('next');
                                            }
                                        }}
                                    />
                                    <Plus className="w-3.5 h-3.5 text-zinc-500" />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Priority Selector */}
                    <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                        <PopoverTrigger asChild>
                            <div
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1 rounded border transition-colors cursor-pointer",
                                    activeField === 'priority' ? "bg-red-900/30 border-red-500 text-red-200" : (priority !== 4 ? "bg-red-900/10 border-red-500/30 text-red-400" : "bg-zinc-800 border-zinc-700 text-zinc-500")
                                )}
                                onClick={() => setActiveField('priority')}
                            >
                                <Flag className="w-3 h-3" />
                                <span className="text-xs">{priority === 4 ? 'None' : `P${priority}`}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-40 p-1 bg-zinc-900 border-zinc-800 text-zinc-100">
                            <div className="flex flex-col gap-0.5">
                                {[1, 2, 3, 4].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            setPriority(p);
                                            setPriorityOpen(false);
                                            // Since it's the last field, maybe don't cycle or cycle back to title?
                                            setActiveField('title');
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-zinc-800",
                                            priority === p && "bg-zinc-800"
                                        )}
                                    >
                                        <Flag className={cn("w-3.5 h-3.5", p === 1 ? "text-red-500" : p === 2 ? "text-orange-500" : p === 3 ? "text-blue-500" : "text-zinc-500", (priority === p) && "fill-current")} />
                                        <span className="flex-1 text-left">{p === 4 ? 'None' : `Priority ${p}`}</span>
                                        {priority === p && <Check className="w-3.5 h-3.5 ml-auto text-zinc-500" />}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <button
                        onClick={handleSubmit}
                        className="ml-auto text-zinc-500 hover:text-green-500 transition-colors"
                    >
                        <CornerDownLeft className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
