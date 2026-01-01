'use client';

import React from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';

interface PageBreakBlockProps {
    block: Block;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
}

export const PageBreakBlock: React.FC<PageBreakBlockProps> = ({ block, onKeyDown, autoFocus, onDelete }) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            onDelete?.();
            return;
        }
        onKeyDown(e, block);
    };

    return (
        <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={cn(
                'group relative my-3 py-1 outline-none',
                autoFocus && 'ring-2 ring-blue-600/20 rounded-sm'
            )}
            aria-label="Page break"
        >
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-[11px] uppercase tracking-wide text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Page break
                </span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
        </div>
    );
};
