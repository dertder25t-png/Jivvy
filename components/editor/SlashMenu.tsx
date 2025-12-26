'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Type, CheckSquare, Heading1, Heading2, List } from 'lucide-react';

export type SlashMenuOption = {
    label: string;
    type: 'text' | 'task' | 'heading1' | 'heading2' | 'bullet';
    icon: React.ElementType;
    description: string;
};

const SLASH_MENU_OPTIONS: SlashMenuOption[] = [
    { label: 'Text', type: 'text', icon: Type, description: 'Plain text block' },
    { label: 'Task', type: 'task', icon: CheckSquare, description: 'To-do with checkbox' },
    { label: 'Heading 1', type: 'heading1', icon: Heading1, description: 'Large heading' },
    { label: 'Heading 2', type: 'heading2', icon: Heading2, description: 'Medium heading' },
    { label: 'Bullet List', type: 'bullet', icon: List, description: 'Bulleted list item' },
];

interface SlashMenuProps {
    isOpen: boolean;
    filterText: string;
    position: { x: number; y: number };
    onSelect: (option: SlashMenuOption) => void;
    onClose: () => void;
}

export function SlashMenu({ isOpen, filterText, position, onSelect, onClose }: SlashMenuProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    // Filter options based on typed text after "/"
    const filteredOptions = SLASH_MENU_OPTIONS.filter(opt =>
        opt.label.toLowerCase().includes(filterText.toLowerCase()) ||
        opt.type.toLowerCase().includes(filterText.toLowerCase())
    );

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filterText]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : filteredOptions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (filteredOptions[selectedIndex]) {
                    onSelect(filteredOptions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                onClose();
                break;
        }
    }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown, true);
            return () => window.removeEventListener('keydown', handleKeyDown, true);
        }
    }, [isOpen, handleKeyDown]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose]);

    if (!isOpen || filteredOptions.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Block Types
                </span>
            </div>

            {/* Options */}
            <div className="py-1 max-h-[280px] overflow-y-auto">
                {filteredOptions.map((option, index) => {
                    const Icon = option.icon;
                    return (
                        <button
                            key={option.type}
                            onClick={() => onSelect(option)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                index === selectedIndex
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md",
                                index === selectedIndex
                                    ? "bg-primary/20"
                                    : "bg-zinc-100 dark:bg-zinc-800"
                            )}>
                                <Icon size={16} className={index === selectedIndex ? "text-primary" : "text-zinc-500"} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{option.label}</span>
                                <span className="text-xs text-zinc-400">{option.description}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">↑↓</kbd>
                <span className="text-[10px] text-zinc-400">Navigate</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 ml-2">↵</kbd>
                <span className="text-[10px] text-zinc-400">Select</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 ml-2">Esc</kbd>
                <span className="text-[10px] text-zinc-400">Close</span>
            </div>
        </div>
    );
}

export { SLASH_MENU_OPTIONS };
