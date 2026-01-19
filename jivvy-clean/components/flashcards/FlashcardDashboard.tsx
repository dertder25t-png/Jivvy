"use client";

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { DeckCard } from './DeckCard';
import { Folder, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

type ViewMode = 'projects' | 'lectures';

export function FlashcardDashboard() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('projects');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDeck, setSelectedDeck] = useState<{ id: string, title: string, type: 'project' | 'lecture' } | null>(null);

    // Fetch Data
    const projects = useLiveQuery(() => db.projects.toArray()) || [];
    const lectureBlocks = useLiveQuery(() => db.blocks.where('type').equals('lecture_container').toArray()) || [];
    const flashcards = useLiveQuery(() => db.flashcards.toArray()) || [];

    // Grouping Logic
    const decks = useMemo(() => {
        if (viewMode === 'projects') {
            return projects.map(project => {
                const projectCards = flashcards.filter(f => f.project_id === project.id);
                if (projectCards.length === 0) return null;

                // Find most recent review
                const lastReviewed = projectCards.reduce((latest, card) =>
                    Math.max(latest, card.updated_at || 0), 0
                );

                return {
                    id: project.id,
                    title: project.title,
                    count: projectCards.length,
                    type: 'project' as const,
                    lastReviewed: lastReviewed > 0 ? lastReviewed : undefined,
                    subTitle: `${projectCards.length} cards in project`
                };
            }).filter(Boolean);
        } else {
            return lectureBlocks.map(block => {
                // Find parent project for context
                const parentProject = projects.find(p => p.id === block.parent_id);

                // Cards linked to this lecture
                const lectureCards = flashcards.filter(f => f.lecture_id === block.id);
                if (lectureCards.length === 0) return null;

                const lastReviewed = lectureCards.reduce((latest, card) =>
                    Math.max(latest, card.updated_at || 0), 0
                );

                return {
                    id: block.id,
                    title: block.content || "Untitled Lecture",
                    count: lectureCards.length,
                    type: 'lecture' as const,
                    lastReviewed: lastReviewed > 0 ? lastReviewed : undefined,
                    subTitle: parentProject ? `In ${parentProject.title}` : 'Unknown Project'
                };
            }).filter(Boolean);
        }
    }, [viewMode, projects, lectureBlocks, flashcards]);

    // Filtering
    const filteredDecks = useMemo(() => {
        if (!decks) return [];
        return decks.filter(d =>
            d!.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [decks, searchQuery]);

    // Derived state for selected deck cards
    const selectedCards = useMemo(() => {
        if (!selectedDeck) return [];
        if (selectedDeck.type === 'project') {
            return flashcards.filter(f => f.project_id === selectedDeck.id);
        } else {
            return flashcards.filter(f => f.lecture_id === selectedDeck.id);
        }
    }, [selectedDeck, flashcards]);

    if (selectedDeck) {
        return (
            <div className="flex flex-col h-full bg-surface-50 dark:bg-zinc-950">
                <div className="p-8 pb-4">
                    <button
                        onClick={() => setSelectedDeck(null)}
                        className="mb-4 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Decks
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                {selectedDeck.type === 'project' ? <Folder className="w-6 h-6 text-blue-500" /> : <BookOpen className="w-6 h-6 text-amber-500" />}
                                {selectedDeck.title}
                            </h1>
                            <p className="text-sm text-zinc-500">{selectedCards.length} cards</p>
                        </div>
                        <button className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm">
                            Start Study Session
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedCards.map(card => (
                            <div key={card.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div className="font-medium mb-3 text-zinc-900 dark:text-zinc-100">{card.front}</div>
                                <div className="text-zinc-500 dark:text-zinc-400 text-sm border-t border-zinc-100 dark:border-zinc-800 pt-3">
                                    {card.back}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">Flashcard Decks</h1>
                        <p className="text-sm text-zinc-500">Manage and study your flashcards across all projects.</p>
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <button
                            onClick={() => setViewMode('projects')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'projects'
                                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <Folder className="w-4 h-4" />
                            Projects
                        </button>
                        <button
                            onClick={() => setViewMode('lectures')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'lectures'
                                    ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <BookOpen className="w-4 h-4" />
                            Lectures
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="max-w-md">
                    <input
                        type="text"
                        placeholder={`Search ${viewMode}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                    />
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
                {filteredDecks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                        <Layers className="w-12 h-12 mb-4 opacity-20" />
                        <p>No decks found. Try creating some flashcards first!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredDecks.map(deck => (
                            <DeckCard
                                key={deck!.id}
                                title={deck!.title}
                                count={deck!.count}
                                subTitle={deck!.subTitle}
                                lastReviewed={deck!.lastReviewed}
                                type={deck!.type}
                                onClick={() => setSelectedDeck({ id: deck!.id, title: deck!.title, type: deck!.type })}
                                onStudy={(e) => {
                                    e.stopPropagation();
                                    setSelectedDeck({ id: deck!.id, title: deck!.title, type: deck!.type });
                                    // In future this could jump straight to a study mode
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
