import React, { useRef, useEffect, memo } from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { GripVertical, Circle, ChevronDown } from 'lucide-react';

type BlockVariant = 'heading1' | 'heading2' | 'bullet' | 'main_point' | undefined;

interface TextBlockProps {
    block: Block;
    variant?: BlockVariant;
    hasChildren?: boolean;
    isCollapsed?: boolean;
    isProcessingFlashcards?: boolean; // Indicates AI is generating flashcards from this section
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
    onPasteRows?: (rows: string[]) => void;
}

/**
 * Text block component with variant support (headings, bullets).
 * Memoized to prevent unnecessary re-renders in block lists.
 * Follows AGENT_CONTEXT invisible UI pattern: drag handle only visible on hover.
 */
const TextBlockComponent: React.FC<TextBlockProps> = ({ block, variant, hasChildren, isCollapsed, isProcessingFlashcards, onUpdate, onKeyDown, autoFocus, onDelete, onPasteRows }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [autoFocus]);
    
    // ... existing useEffect ...

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
    
    // ... existing handlePaste ...

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

        // Check if we should split into multiple blocks
        if (onPasteRows && text.includes('\n')) {
             const prefix = el.value.slice(0, start);
             const suffix = el.value.slice(end);
             
             const lines = text.split('\n');
             // If we have actual multiple lines
             if (lines.length > 1) {
                 // Update current block to prefix + first line part
                 onUpdate(block.id, { content: prefix + lines[0] });
                 
                 // Remaining lines need to be processed
                 const remainingLines = lines.slice(1);
                 
                 // Append existing suffix to the last line
                 remainingLines[remainingLines.length - 1] += suffix;
                 
                 onPasteRows(remainingLines);
                 return;
             }
        }

        const next = el.value.slice(0, start) + text + el.value.slice(end);
        onUpdate(block.id, { content: next });
        
        // Restore caret after React updates.
        const nextPos = start + text.length;
        queueMicrotask(() => {
            try {
                if (textareaRef.current) textareaRef.current.setSelectionRange(nextPos, nextPos);
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
            case 'main_point':
                return 'text-lg font-bold text-text-primary tracking-tight'; // Bold main point
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
            case 'main_point':
                return 'Main point';
            default:
                return "Type '/' for commands...";
        }
    };

    return (
        <div className={cn(
            "group flex items-start py-1 relative",
            // Subtle processing indicator: pulsing left border when generating flashcards
            isProcessingFlashcards && "border-l-2 border-lime-400/60 animate-pulse"
        )}>
            {/* Collapse Toggle (Visible if has children) */}
            {hasChildren && (
                <button
                    type="button"
                    contentEditable={false}
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(block.id, { metadata: { ...block.metadata, collapsed: !isCollapsed } });
                    }}
                    className="absolute left-[-22px] top-[7px] w-4 h-4 flex items-center justify-center rounded-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
                >
                     <ChevronDown size={12} className={cn("transition-transform duration-200", isCollapsed ? "-rotate-90" : "")} />
                </button>
            )}

            {/* Processing indicator icon */}
            {isProcessingFlashcards && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-lime-400/70 text-[10px] animate-pulse">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>AI</span>
                </div>
            )}

            {/* Drag Handle */}
            <div className={cn(
                "absolute top-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-opacity",
                hasChildren ? "left-[-42px]" : "left-[-24px]"
            )}>
                <GripVertical size={14} />
            </div>

            {/* Bullet indicator for bullet or main_point variant */}
            {(variant === 'bullet' || variant === 'main_point') && (
                <div className="flex items-center justify-center w-6 h-6 mr-1 mt-0.5">
                    <Circle 
                        size={variant === 'main_point' ? 8 : 6} 
                        className={cn(
                            variant === 'main_point' ? "fill-zinc-800 text-zinc-800 dark:fill-zinc-200 dark:text-zinc-200" : "fill-zinc-400 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500"
                        )} 
                    />
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
        prevProps.autoFocus === nextProps.autoFocus &&
        prevProps.hasChildren === nextProps.hasChildren &&
        prevProps.isCollapsed === nextProps.isCollapsed &&
        prevProps.isProcessingFlashcards === nextProps.isProcessingFlashcards
    );
});
