import React, { useRef, useEffect, memo } from 'react';
import { Block, db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Check, GripVertical } from 'lucide-react';

interface TaskBlockProps {
    block: Block;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
    projectColor?: string;
}

/**
 * Task block component with checkbox.
 * Memoized to prevent unnecessary re-renders in block lists.
 * Follows AGENT_CONTEXT invisible UI pattern: drag handle only visible on hover.
 */
const TaskBlockComponent: React.FC<TaskBlockProps> = ({ block, onUpdate, onKeyDown, autoFocus, onDelete, projectColor }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isCompleted = block.metadata?.status === 'done';

    // Todoist-style Priority Colors (P1=Red, P2=Orange, P3=Blue, P4=Grey)
    const priority = block.metadata?.priority || 4;
    const priorityColors = {
        1: 'border-red-500 bg-red-50 text-red-600',
        2: 'border-orange-500 bg-orange-50 text-orange-600',
        3: 'border-blue-500 bg-blue-50 text-blue-600',
        4: 'border-zinc-400 dark:border-zinc-500 hover:border-zinc-600 dark:hover:border-zinc-400'
    };

    const isCustomProjectColor = !isCompleted && priority === 4 && projectColor;


    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [autoFocus]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [block.content]);

    const toggleCheck = async () => {
        const newStatus = isCompleted ? 'todo' : 'done';
        onUpdate(block.id, { metadata: { ...block.metadata, status: newStatus } });
        await db.blocks.update(block.id, { metadata: { ...block.metadata, status: newStatus } });
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(block.id, { content: e.target.value });
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const el = textareaRef.current;
        if (!el) return;

        e.preventDefault();

        const clipboard = e.clipboardData;
        let text = clipboard?.getData('text/plain') ?? '';
        if (!text) {
            const html = clipboard?.getData('text/html') ?? '';
            if (html) {
                try {
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    text = doc.body?.textContent ?? '';
                } catch {
                    text = '';
                }
            }
        }

        if (!text) return;

        text = text.replace(/\r\n?/g, '\n').replace(/\u00A0/g, '');
        const MAX_PASTE_CHARS = 20000;
        if (text.length > MAX_PASTE_CHARS) text = text.slice(0, MAX_PASTE_CHARS);

        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        onUpdate(block.id, { content: next });

        const nextPos = start + text.length;
        queueMicrotask(() => {
            try {
                el.setSelectionRange(nextPos, nextPos);
            } catch {
                // Ignore
            }
        });
    };


    return (
        <div className="group flex items-start py-2 relative -ml-6 pl-6">
            {/* Drag Handle */}
            <div className="absolute left-[-4px] top-2.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 transition-opacity">
                <GripVertical size={14} />
            </div>

            <div className="flex items-center mt-1 mr-3 group/taskactions">
                <button
                    onClick={toggleCheck}
                    style={{
                        borderColor: isCustomProjectColor ? projectColor : undefined,
                        backgroundColor: isCustomProjectColor && !isCompleted ? `${projectColor}20` : undefined
                    }}
                    className={cn(
                        "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200",
                        isCompleted
                            ? "bg-zinc-400 border-zinc-400 text-white"
                            : isCustomProjectColor
                                ? "bg-transparent"
                                : cn("bg-transparent", (priorityColors as any)[priority] || priorityColors[4])
                    )}
                >
                    <Check
                        size={12}
                        strokeWidth={3}
                        className={cn("transition-opacity duration-200", isCompleted ? "opacity-100" : "opacity-0 group-hover/taskactions:opacity-50")}
                        style={{ color: isCustomProjectColor ? projectColor : undefined }}
                    />
                </button>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <textarea
                    ref={textareaRef}
                    value={block.content}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    onKeyDown={(e) => onKeyDown(e, block)}
                    rows={1}
                    placeholder="Task name"
                    className={cn(
                        "w-full bg-transparent resize-none border-none outline-none text-[15px] leading-relaxed p-0 placeholder:text-zinc-400",
                        isCompleted ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-100"
                    )}
                />

                {/* Metadata Row (Date, Project, etc) */}
                <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 h-4">
                    {block.metadata?.due_date && (
                        <span className="flex items-center gap-1 text-green-600 bg-green-500/10 px-1 rounded">
                            {/* Mock date formatted */}
                            📅 {new Date(block.metadata.due_date as number).toLocaleDateString()}
                        </span>
                    )}
                    {/* Show project name if we are in a collective view (Inbox/Today) */}
                    {/* For now, just a placeholder or conditional */}
                </div>
            </div>
        </div>
    );
};

// Memoize to prevent re-renders when other blocks in the list change
export const TaskBlock = memo(TaskBlockComponent, (prevProps, nextProps) => {
    return (
        prevProps.block.id === nextProps.block.id &&
        prevProps.block.content === nextProps.block.content &&
        prevProps.block.metadata?.status === nextProps.block.metadata?.status &&
        prevProps.autoFocus === nextProps.autoFocus
    );
});
