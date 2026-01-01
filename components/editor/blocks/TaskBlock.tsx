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
}

/**
 * Task block component with checkbox.
 * Memoized to prevent unnecessary re-renders in block lists.
 * Follows AGENT_CONTEXT invisible UI pattern: drag handle only visible on hover.
 */
const TaskBlockComponent: React.FC<TaskBlockProps> = ({ block, onUpdate, onKeyDown, autoFocus, onDelete }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isCompleted = block.metadata?.status === 'done';

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to end
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [autoFocus]);

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [block.content]);

    const toggleCheck = async () => {
        const newStatus = isCompleted ? 'todo' : 'done';
        // Optimistic UI update via props
        onUpdate(block.id, {
            metadata: { ...block.metadata, status: newStatus }
        });

        // Direct DB sync for "Active Dashboard" requirement
        await db.blocks.update(block.id, {
            metadata: { ...block.metadata, status: newStatus }
        });
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
        <div className="group flex items-start py-1 relative">
            {/* Drag Handle (Hidden by default, visible on hover) - Invisible UI pattern */}
            <div className="absolute left-[-24px] top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-opacity">
                <GripVertical size={14} />
            </div>

            <div className="flex items-center mt-1 mr-2 gap-1 group/taskactions">
                <button
                    onClick={toggleCheck}
                    className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isCompleted
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-transparent border-zinc-300 dark:border-zinc-600 hover:border-primary opacity-60 hover:opacity-100"
                    )}
                    aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                >
                    {isCompleted && <Check size={12} strokeWidth={3} />}
                </button>
            </div>

            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={handleChange}
                onPaste={handlePaste}
                onKeyDown={(e) => onKeyDown(e, block)}
                rows={1}
                placeholder="To-do..."
                className={cn(
                    "flex-1 bg-transparent resize-none border-none outline-none text-base leading-relaxed px-2 py-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-600",
                    isCompleted ? "text-text-secondary line-through decoration-zinc-300 dark:decoration-zinc-600" : "text-text-primary"
                )}
            />
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
