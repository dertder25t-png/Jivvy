'use client';

import React from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { FileText, ExternalLink } from 'lucide-react';
import { useStore } from '@/lib/store';

interface PDFHighlightBlockProps {
    block: Block;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
}

interface PDFHighlightMetadata {
    source_id?: string;
    page?: number;
    rect?: number[]; // [x, y, w, h]
    quote?: string;
    source_name?: string;
}

export const PDFHighlightBlock: React.FC<PDFHighlightBlockProps> = ({
    block,
    onUpdate,
    onKeyDown,
    autoFocus,
    onDelete
}) => {
    const { setContextPanelOpen, setPdfPage } = useStore();

    const metadata = block.metadata as PDFHighlightMetadata | undefined;
    const quote = metadata?.quote || block.content || 'No quote available';
    const page = metadata?.page;
    const sourceName = metadata?.source_name || 'PDF Document';

    const handleClick = () => {
        // Open context panel and scroll to the cited location
        setContextPanelOpen(true);

        if (page !== undefined) {
            setPdfPage(page);
        }

        // TODO: Implement rect scrolling once PDF viewer supports it
        console.log('[PDFHighlightBlock] Navigate to page:', page, 'rect:', metadata?.rect);
    };

    const handleKeyDownCapture = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            onDelete?.();
        }
        onKeyDown(e, block);
    };

    return (
        <div
            className={cn(
                "group relative py-3 px-4 my-2 cursor-pointer transition-all duration-200",
                "border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
                "hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
                "rounded-r-lg"
            )}
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDownCapture}
        >
            {/* Quote Text */}
            <blockquote className="text-sm italic text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">
                "{quote}"
            </blockquote>

            {/* Source Citation */}
            <div className="flex items-center gap-2 text-xs text-zinc-400">
                <FileText size={12} className="text-blue-500" />
                <span className="font-medium">{sourceName}</span>
                {page !== undefined && (
                    <>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span>Page {page}</span>
                    </>
                )}
                <ExternalLink
                    size={10}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500"
                />
            </div>

            {/* Hover indicator */}
            <div className="absolute inset-0 pointer-events-none rounded-r-lg ring-1 ring-inset ring-blue-500/0 group-hover:ring-blue-500/20 transition-all" />
        </div>
    );
};
