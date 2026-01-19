import React from 'react';
import { cn } from "@/lib/utils";
import { Folder, Zap, PlayCircle, Clock } from 'lucide-react';

interface DeckCardProps {
    title: string;
    count: number;
    subTitle?: string;
    lastReviewed?: number;
    type: 'project' | 'lecture';
    onClick: () => void;
    onStudy?: (e: React.MouseEvent) => void;
}

export function DeckCard({ title, count, subTitle, lastReviewed, type, onClick, onStudy }: DeckCardProps) {
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col justify-between p-4 h-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-lg hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all cursor-pointer"
        >
            {/* Top Section */}
            <div>
                <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                        "p-2 rounded-lg",
                        type === 'project'
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                    )}>
                        {type === 'project' ? <Folder className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    {count > 0 && (
                        <div className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-zinc-500">
                            {count} cards
                        </div>
                    )}
                </div>

                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight mb-1">
                    {title}
                </h3>
                {subTitle && (
                    <p className="text-xs text-zinc-500 line-clamp-1">{subTitle}</p>
                )}
            </div>

            {/* Bottom/Action Section */}
            <div className="mt-auto pt-4 border-t border-zinc-50 dark:border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Clock className="w-3 h-3" />
                    <span>{lastReviewed ? new Date(lastReviewed).toLocaleDateString() : 'Never'}</span>
                </div>

                <button
                    onClick={onStudy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-full hover:bg-primary/90"
                >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Study Now
                </button>
            </div>

            {/* Empty State Overlay */}
            {count === 0 && (
                <div className="absolute inset-0 bg-white/50 dark:bg-zinc-950/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <span className="text-sm font-medium text-zinc-500">Empty Deck</span>
                </div>
            )}
        </div>
    );
}
