'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, BookOpen, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pdfWorker } from '@/utils/pdf-extraction';
import type { OutlineItem, FlatChapter, ChapterSelection } from './types';

interface ChapterDropdownProps {
    value: ChapterSelection[];
    onChange: (selection: ChapterSelection[]) => void;
    disabled?: boolean;
}

export function ChapterDropdown({ value, onChange, disabled }: ChapterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch outline on mount
    useEffect(() => {
        const fetchOutline = () => {
            const pdfOutline = pdfWorker.getOutline();
            setOutline(pdfOutline || []);
        };

        fetchOutline();

        // Also listen for outline ready event
        const handleOutlineReady = () => fetchOutline();
        pdfWorker.on('OUTLINE_READY', handleOutlineReady);

        return () => {
            pdfWorker.off('OUTLINE_READY', handleOutlineReady);
        };
    }, []);

    // Flatten outline for display
    const flatChapters = useMemo((): FlatChapter[] => {
        const result: FlatChapter[] = [];

        const traverse = (items: OutlineItem[], depth: number = 0) => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const nextItem = items[i + 1];
                result.push({
                    title: item.title,
                    page: item.page,
                    depth,
                    endPage: nextItem?.page ? nextItem.page - 1 : undefined
                });
                if (item.items && item.items.length > 0) {
                    traverse(item.items, depth + 1);
                }
            }
        };

        traverse(outline);
        return result;
    }, [outline]);

    // Filter chapters based on search
    const filteredChapters = useMemo(() => {
        if (!searchQuery.trim()) return flatChapters;
        return flatChapters.filter(c => 
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [flatChapters, searchQuery]);

    const hasOutline = flatChapters.length > 0;

    // Handle chapter toggle
    const toggleChapter = (chapter: FlatChapter) => {
        const isSelected = value.some(c => c.title === chapter.title && c.startPage === chapter.page);
        
        // Find index to identify descendants
        const index = flatChapters.findIndex(c => c.title === chapter.title && c.page === chapter.page);
        
        const targetChapters: FlatChapter[] = [chapter];
        
        if (index !== -1) {
            // Identify descendants (items immediately following with greater depth)
            for (let i = index + 1; i < flatChapters.length; i++) {
                if (flatChapters[i].depth <= chapter.depth) break;
                targetChapters.push(flatChapters[i]);
            }
        }

        // Use composite key for reliable matching (Title + Page)
        const targetKeys = new Set(targetChapters.map(c => `${c.title}|${c.page}`));

        if (isSelected) {
            // Deselect parent and all descendants
            onChange(value.filter(c => !targetKeys.has(`${c.title}|${c.startPage}`)));
        } else {
            // Select parent and all descendants
            // Avoid duplicates
            const currentKeys = new Set(value.map(c => `${c.title}|${c.startPage}`));
            const newSelections = targetChapters
                .filter(c => !currentKeys.has(`${c.title}|${c.page}`))
                .map(c => ({
                    title: c.title,
                    startPage: c.page,
                    endPage: c.endPage ?? null
                }));
            
            onChange([...value, ...newSelections]);
        }
    };

    // Display text
    const displayText = value.length === 0 
        ? 'All Pages' 
        : value.length === 1 
            ? value[0].title 
            : `${value.length} Chapters Selected`;

    return (
        <div className="relative flex-1 max-w-md">
            {/* Main Dropdown Button */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-1.5",
                    "bg-surface hover:bg-surface-hover text-text-primary rounded-lg",
                    "border border-border text-xs transition-colors shadow-sm",
                    disabled && "opacity-50 cursor-not-allowed",
                    isOpen && "border-primary ring-1 ring-primary/20"
                )}
            >
                <div className="flex items-center gap-2 truncate">
                    <BookOpen size={12} className="text-text-secondary flex-shrink-0" />
                    <span className="truncate font-medium">{displayText}</span>
                </div>
                <ChevronDown
                    size={12}
                    className={cn(
                        "text-text-secondary transition-transform flex-shrink-0",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-border">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Search chapters..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface-hover border border-border rounded-md pl-7 pr-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Chapter List */}
                    <div className="max-h-60 overflow-y-auto p-1">
                        <button
                            onClick={() => { onChange([]); setIsOpen(false); }}
                            className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors",
                                value.length === 0 ? "bg-primary/10 text-primary font-medium" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                            )}
                        >
                            <div className={cn("w-3 h-3 rounded border flex items-center justify-center", value.length === 0 ? "border-primary bg-primary" : "border-border")}>
                                {value.length === 0 && <Check size={8} className="text-white" />}
                            </div>
                            All Pages
                        </button>

                        {hasOutline ? (
                            filteredChapters.map((chapter, idx) => {
                                const isSelected = value.some(c => c.title === chapter.title && c.startPage === chapter.page);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => toggleChapter(chapter)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors",
                                            isSelected ? "bg-primary/5 text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                                        )}
                                        style={{ paddingLeft: `${(chapter.depth * 12) + 8}px` }}
                                    >
                                        <div className={cn("w-3 h-3 rounded border flex items-center justify-center flex-shrink-0", isSelected ? "border-primary bg-primary" : "border-border")}>
                                            {isSelected && <Check size={8} className="text-white" />}
                                        </div>
                                        <span className="truncate flex-1">{chapter.title}</span>
                                        <span className="text-[10px] opacity-50 flex-shrink-0">p.{chapter.page}</span>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-text-secondary italic">
                                No chapters found in this PDF.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

