'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

// Simple Context to share state between Trigger and Content
const PopoverContext = React.createContext<{ open: boolean; onOpenChange: (o: boolean) => void }>({
    open: false,
    onOpenChange: () => { },
});

export function InternalPopover({ open, onOpenChange, children }: PopoverProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onOpenChange(false);
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open, onOpenChange]);

    return <div ref={ref} className="relative inline-block">{children}</div>;
}

export function Popover({ open, onOpenChange, children }: PopoverProps) {
    return (
        <PopoverContext.Provider value={{ open, onOpenChange }}>
            <InternalPopover open={open} onOpenChange={onOpenChange}>
                {children}
            </InternalPopover>
        </PopoverContext.Provider>
    );
}

export function PopoverTrigger({ asChild, children, ...props }: any) {
    const { onOpenChange, open } = React.useContext(PopoverContext);

    // Clone element to attach onClick
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: React.MouseEvent) => {
                // @ts-ignore
                children.props.onClick?.(e);
                onOpenChange(!open);
            },
            ...props
        });
    }

    return (
        <button onClick={() => onOpenChange(!open)} {...props}>
            {children}
        </button>
    );
}

export function PopoverContent({ align = 'center', sideOffset = 4, className, children }: any) {
    const { open } = React.useContext(PopoverContext);
    if (!open) return null;

    return (
        <div
            className={cn(
                "absolute z-50 min-w-[8rem] rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
                align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2',
                "mt-2",
                className
            )}
            style={{ marginTop: sideOffset }}
        >
            {children}
        </div>
    );
}
