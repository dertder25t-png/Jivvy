import React, { useRef, useEffect, memo } from 'react';
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

/**
 * Text block component with variant support (headings, bullets).
 * Memoized to prevent unnecessary re-renders in block lists.
 * Follows AGENT_CONTEXT invisible UI pattern: drag handle only visible on hover.
 */
const TextBlockComponent: React.FC<TextBlockProps> = ({ block, variant, onUpdate, onKeyDown, autoFocus, onDelete }) => {
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

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const el = textareaRef.current;
        if (!el) return;

        // Sanitize paste and preserve paragraphs.
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

        // Normalize line endings and spaces; keep newlines to preserve paragraphs.
        text = text.replace(/\r\n?/g, '\n').replace(/\u00A0/g, '');
        // Hard cap to avoid accidental huge pastes.
        const MAX_PASTE_CHARS = 20000;
        if (text.length > MAX_PASTE_CHARS) text = text.slice(0, MAX_PASTE_CHARS);

        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        onUpdate(block.id, { content: next });

        // Restore caret after React updates.
        const nextPos = start + text.length;
        queueMicrotask(() => {
            try {
                el.setSelectionRange(nextPos, nextPos);
            } catch {
                // Ignore
            }
        });
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
        <div className="group flex items-start py-1 relative">
            {/* Drag Handle (Hidden by default, visible on hover) - Invisible UI pattern */}
            <div className="absolute left-[-24px] top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-opacity">
                <GripVertical size={14} />
            </div>

            {/* Bullet indicator for bullet variant */}
            {variant === 'bullet' && (
                <div className="flex items-center justify-center w-6 h-6 mr-1 mt-0.5">
                    <Circle size={6} className="fill-zinc-400 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
                </div>
            )}

            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={handleChange}
                onPaste={handlePaste}
                onKeyDown={(e) => onKeyDown(e, block)}
                rows={1}
                placeholder={getPlaceholder()}
                className={cn(
                    "flex-1 bg-transparent resize-none border-none outline-none px-2 py-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 text-text-primary",
                    getVariantStyles()
                )}
            />
        </div>
    );
};

// Memoize to prevent re-renders when other blocks in the list change
export const TextBlock = memo(TextBlockComponent, (prevProps, nextProps) => {
    return (
        prevProps.block.id === nextProps.block.id &&
        prevProps.block.content === nextProps.block.content &&
        prevProps.variant === nextProps.variant &&
        prevProps.autoFocus === nextProps.autoFocus
    );
});
