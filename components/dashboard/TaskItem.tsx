import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Block, db } from '@/lib/db';
import { TaskToolbar } from './TaskToolbar';
import { parseTaskNaturalLanguage, TaskMetadata } from '@/lib/smart-parser';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

interface TaskItemProps {
    node: Block & { children: any[]; depth: number };
    updateBlock: (id: string, changes: Partial<Block>) => Promise<void>;
    onKeyDown: (e: React.KeyboardEvent, task: Block) => void;
    onFocus: (id: string) => void;
    isFocused: boolean;
    renderChildren: (node: any) => React.ReactNode;
}

export function TaskItem({ node, updateBlock, onKeyDown, onFocus, isFocused, renderChildren }: TaskItemProps) {
    const [content, setContent] = useState(node.content);
    // Initialize liveMetadata from node.metadata to persist manual changes across re-renders
    const [liveMetadata, setLiveMetadata] = useState<TaskMetadata>({
        date: node.metadata?.due_date ? new Date(node.metadata.due_date) : null,
        priority: node.metadata?.priority || null,
        project: node.metadata?.project || null,
        tags: node.metadata?.tags || []
    });

    const [isDescriptionOpen, setIsDescriptionOpen] = useState(!!node.metadata?.description);

    // We use a ref to track if we are currently handling a local change
    // to avoid jitter from async prop updates
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync content from props only if we're not actively typing
    useEffect(() => {
        if (!isTypingRef.current && node.content !== content) {
            setContent(node.content);
        }
        // Also sync metadata if it changes externally (e.g. from toolbar)
        if (!isTypingRef.current) {
            setLiveMetadata({
                date: node.metadata?.due_date ? new Date(node.metadata.due_date) : null,
                priority: node.metadata?.priority || null,
                project: node.metadata?.project || null,
                tags: node.metadata?.tags || []
            });
        }
    }, [node.content, node.metadata]);

    // Update local state and propagate to DB
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.target.value;
        setContent(newText);

        isTypingRef.current = true;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Debounce the "isTyping" reset slightly to cover the DB roundtrip
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
        }, 1000);

        // Immediate update to DB (optimistic in UI via local state)
        updateBlock(node.id, { content: newText });

        const result = parseTaskNaturalLanguage(newText);

        // Merge strategy:
        // 1. Text-based metadata (parsed) takes precedence if found.
        // 2. If text-parser returns null for a field, we KEEP the existing manually set value.
        // 3. This allows "Type then click" (manual overrides text) AND "Click then type" (manual persists if no conflict).

        setLiveMetadata(prev => {
            // Check if parser found something NEW or explicit.
            // If parser returns null, it means "nothing found in text", so keep 'prev'.
            return {
                date: result.metadata.date || prev.date,
                priority: result.metadata.priority || prev.priority,
                project: result.metadata.project || prev.project,
                tags: result.metadata.tags.length > 0 ? result.metadata.tags : prev.tags
            };
        });
    }, [node.id, updateBlock]);

    // Handle focus
    useEffect(() => {
        if (isFocused && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isFocused]);

    const isDone = node.metadata?.status === 'done';
    const color = liveMetadata.priority ?
        (liveMetadata.priority === 'p1' ? '#ef4444' :
            liveMetadata.priority === 'p2' ? '#f97316' :
                liveMetadata.priority === 'p3' ? '#3b82f6' : node.metadata?.color || '#a1a1aa')
        : node.metadata?.color || '#a1a1aa';

    const toggleComplete = async () => {
        const newStatus = isDone ? 'todo' : 'done';
        await updateBlock(node.id, { metadata: { ...node.metadata, status: newStatus } });
    };

    const handleDescriptionChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        await updateBlock(node.id, { metadata: { ...node.metadata, description: e.target.value } });
    };

    return (
        <div className="relative group">
            <div className={cn("flex items-start gap-3 py-1.5 pl-2")}>

                {/* Description Toggle */}
                <div className="relative pt-1.5 flex-shrink-0 -ml-5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !isDescriptionOpen && "-rotate-90")} />
                    </button>
                </div>

                {/* Checkbox */}
                <div className="relative pt-1.5 flex-shrink-0">
                    <button
                        onClick={toggleComplete}
                        className={cn(
                            "flex items-center justify-center w-4 h-4 rounded-full transition-all duration-200 ring-offset-2",
                            isDone
                                ? "bg-zinc-400 text-white"
                                : "hover:ring-2 ring-zinc-200 dark:ring-zinc-700"
                        )}
                        style={!isDone ? { backgroundColor: color } : undefined}
                    >
                        {isDone && <Check className="w-3 h-3" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 border-b border-transparent focus-within:border-zinc-100 dark:focus-within:border-zinc-800 transition-colors">
                    <input
                        ref={inputRef}
                        value={content}
                        onChange={handleChange}
                        onKeyDown={(e) => onKeyDown(e, node)}
                        onFocus={() => {
                            onFocus(node.id);
                            // Do not reset metadata on focus
                        }}
                        className={cn(
                            "w-full bg-transparent border-none outline-none text-[15px] font-normal text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 leading-relaxed font-sans",
                            isDone && "line-through text-zinc-400 opacity-60"
                        )}
                        placeholder="Type a task..."
                        autoComplete="off"
                    />

                    {/* Description - Shown if open */}
                    {isDescriptionOpen && (
                        <div className="mt-1.5 w-full">
                            <textarea
                                value={node.metadata?.description || ''}
                                onChange={handleDescriptionChange}
                                placeholder="Add notes, details, or context..."
                                className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-sm px-2 py-1.5 border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 outline-none text-sm text-zinc-600 dark:text-zinc-400 min-h-[4em] leading-relaxed resize-y block transition-colors"
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            {isFocused && (
                <TaskToolbar
                    visible={true} // Simplified visibility logic
                    metadata={liveMetadata}
                    onUpdate={async (key, val) => {
                        if (key === 'add-subtask') {
                            // Create subtask
                            const newId = crypto.randomUUID();
                            const subtask: Block = {
                                id: newId,
                                parent_id: node.id,
                                type: 'task',
                                content: '',
                                order: Date.now(),
                                metadata: { status: 'todo' },
                                updated_at: Date.now(),
                                sync_status: 'dirty'
                            };
                            await db.blocks.add(subtask);
                            return;
                        }

                        // if (key === 'add-description') { ... } // Removed from toolbar as per request, handled by Chevron

                        const newMetadata = { ...node.metadata, [key === 'date' ? 'due_date' : key]: val };
                        if (key === 'date') {
                            newMetadata.due_date = val ? (val as Date).getTime() : undefined;
                        }
                        await updateBlock(node.id, { metadata: newMetadata });

                        setLiveMetadata(prev => ({
                            ...prev,
                            [key]: val
                        }));
                    }}
                />
            )}

            {/* Children */}
            {node.children.length > 0 && (
                <div className="ml-6 border-l border-zinc-100 dark:border-zinc-800 pl-2">
                    {node.children.map(renderChildren)}
                </div>
            )}
        </div>
    );
}
