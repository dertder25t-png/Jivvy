import React, { useRef, useEffect } from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface TextBlockProps {
    block: Block;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onUpdate, onKeyDown, autoFocus, onDelete }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(block.id, { content: e.target.value });
    };

    if (block.type === 'image') return <div>Image placeholder</div>;

    return (
        <div className="group flex items-start -ml-8 py-1 relative">
            {/* Drag Handle (Hidden by default, visible on hover) */}
            <div className="absolute left-[-24px] top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-all">
                <GripVertical size={14} />
            </div>

            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={handleChange}
                onKeyDown={(e) => onKeyDown(e, block)}
                rows={1}
                placeholder="Type '/' for commands..."
                className="flex-1 bg-transparent resize-none border-none outline-none text-base leading-relaxed p-0 placeholder:text-zinc-300 text-text-primary"
            />
        </div>
    );
};
