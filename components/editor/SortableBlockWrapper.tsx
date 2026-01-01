'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface SortableBlockWrapperProps {
    id: string;
    children: React.ReactNode;
}

export function SortableBlockWrapper({ id, children }: SortableBlockWrapperProps) {
    const [isHovered, setIsHovered] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group/sortable",
                isDragging && "shadow-lg rounded-lg bg-white dark:bg-zinc-900"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Invisible block shell (content-first controls) */}
            <div
                className={cn(
                    "pointer-events-none absolute inset-0 rounded-md",
                    "ring-1 ring-inset ring-transparent",
                    "group-hover/sortable:ring-border/40",
                    "group-focus-within/sortable:ring-2 group-focus-within/sortable:ring-primary/30",
                    isDragging && "ring-2 ring-primary/20"
                )}
            />

            {/* Drag Handle - appears on hover */}
            <div
                {...attributes}
                {...listeners}
                className={cn(
                    "absolute left-[-28px] top-2 p-1 rounded cursor-grab active:cursor-grabbing",
                    "text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    "transition-all duration-150",
                    isHovered || isDragging ? "opacity-100" : "opacity-0"
                )}
            >
                <GripVertical size={16} />
            </div>

            {/* Block Content */}
            {children}
        </div>
    );
}
