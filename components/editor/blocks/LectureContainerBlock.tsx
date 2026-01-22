import React, { useEffect, useMemo, useRef } from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

interface LectureContainerBlockProps {
    block: Block;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
    onPasteRows?: (rows: string[]) => void;
    onRichPaste?: (e: React.ClipboardEvent) => void;
}

function startOfToday(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export const LectureContainerBlock: React.FC<LectureContainerBlockProps> = ({
    block,
    onUpdate,
    onKeyDown,
    autoFocus,
    onPasteRows,
    onRichPaste
}) => {
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

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboard = e.clipboardData;
        const html = clipboard.getData('text/html');

        // Rich Text (HTML) paste - delegate to global handler for proper parsing
        if (html && onRichPaste) {
            e.preventDefault(); // CRITICAL: Stop browser from inserting plain text
            onRichPaste(e);
            return;
        }

        const text = clipboard.getData('text/plain');

        if (text.includes('\n') && onPasteRows) {
            e.preventDefault();
            const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);

            let linesToProcess = lines;

            // If title is empty, use first line as title
            if (!block.content.trim() && lines.length > 0) {
                const firstLine = lines[0];
                onUpdate(block.id, { content: firstLine });
                linesToProcess = lines.slice(1);
            }

            if (linesToProcess.length > 0) {
                onPasteRows(linesToProcess);
            }
        }
    };

    const lectureNumber = block.metadata?.lecture_number;
    const lectureDate = block.metadata?.lecture_date ?? startOfToday();
    const isCollapsed = Boolean((block.metadata as any)?.collapsed);

    const dateLabel = useMemo(() => {
        try {
            return new Date(lectureDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return 'Today';
        }
    }, [lectureDate]);

    return (
        <div className="group flex items-start py-2 relative">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <button
                        type="button"
                        aria-label={isCollapsed ? 'Expand lecture' : 'Collapse lecture'}
                        onClick={() => {
                            const nextMeta = { ...(block.metadata || {}), collapsed: !isCollapsed };
                            onUpdate(block.id, { metadata: nextMeta });
                        }}
                        className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                        {typeof lectureNumber === 'number' ? `Lecture ${lectureNumber}` : 'Lecture'}
                        <span className="mx-2 text-zinc-500">•</span>
                        {dateLabel}
                    </div>
                </div>

                <textarea
                    ref={textareaRef}
                    value={block.content}
                    onChange={(e) => onUpdate(block.id, { content: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, block)}
                    onPaste={handlePaste}
                    rows={1}
                    placeholder="Lecture title (e.g. Introduction to Psychology)... Press Enter to add notes"
                    className={cn(
                        'w-full bg-transparent resize-none border-none outline-none px-2 py-1',
                        'text-xl font-semibold tracking-tight',
                        'placeholder:text-zinc-300 text-text-primary'
                    )}
                />
            </div>

            {/* Visual indicator for drag handle (invisible UI pattern) */}
            <div className="absolute left-[-24px] top-6 p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-grab text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-opacity">
                <GripVertical size={14} />
            </div>
        </div>
    );
};
