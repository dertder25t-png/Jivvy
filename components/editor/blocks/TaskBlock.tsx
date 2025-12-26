import React, { useRef, useEffect } from 'react';
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

export const TaskBlock: React.FC<TaskBlockProps> = ({ block, onUpdate, onKeyDown, autoFocus, onDelete }) => {
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

    return (
        <div className="group flex items-start -ml-8 py-1 relative">
            {/* Drag Handle (Hidden by default, visible on hover) */}
            <div className="absolute left-[-24px] top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-all">
                <GripVertical size={14} />
            </div>

            <div className="flex items-center mt-1 mr-2 gap-1 group/taskactions">
                <button
                    onClick={toggleCheck}
                    className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isCompleted
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-transparent border-zinc-300 hover:border-blue-400 opacity-60 hover:opacity-100"
                    )}
                >
                    {isCompleted && <Check size={12} strokeWidth={3} />}
                </button>
            </div>

            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={handleChange}
                onKeyDown={(e) => onKeyDown(e, block)}
                rows={1}
                placeholder="To-do..."
                className={cn(
                    "flex-1 bg-transparent resize-none border-none outline-none text-base leading-relaxed p-0 placeholder:text-zinc-300",
                    isCompleted ? "text-zinc-400 line-through decoration-zinc-300" : "text-text-primary"
                )}
            />
        </div>
    );
};
