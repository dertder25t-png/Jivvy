import React, { useRef, useEffect } from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { GripVertical, Circle } from 'lucide-react';

type BlockVariant = 'heading1' | 'heading2' | 'bullet' | undefined;

interface TextBlockProps {
    block: Block;
    variant?: BlockVariant;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, variant, onUpdate, onKeyDown, autoFocus, onDelete }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
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

    // Variant-specific styles
    const getVariantStyles = () => {
        switch (variant) {
            case 'heading1':
                return 'text-3xl font-bold tracking-tight';
            case 'heading2':
                return 'text-xl font-semibold tracking-tight';
            case 'bullet':
                return 'text-base';
            default:
                return 'text-base leading-relaxed';
        }
    };

    const getPlaceholder = () => {
        switch (variant) {
            case 'heading1':
                return 'Heading 1';
            case 'heading2':
                return 'Heading 2';
            case 'bullet':
                return 'List item';
            default:
                return "Type '/' for commands...";
        }
    };

    return (
        <div className="group flex items-start -ml-8 py-1 relative">
            {/* Drag Handle (Hidden by default, visible on hover) */}
            <div className="absolute left-[-24px] top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-all">
                <GripVertical size={14} />
            </div>

            {/* Bullet indicator for bullet variant */}
            {variant === 'bullet' && (
                <div className="flex items-center justify-center w-6 h-6 mr-1 mt-0.5">
                    <Circle size={6} className="fill-zinc-400 text-zinc-400" />
                </div>
            )}

            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={handleChange}
                onKeyDown={(e) => onKeyDown(e, block)}
                rows={1}
                placeholder={getPlaceholder()}
                className={cn(
                    "flex-1 bg-transparent resize-none border-none outline-none p-0 placeholder:text-zinc-300 text-text-primary",
                    getVariantStyles()
                )}
            />
        </div>
    );
};
