"use client";

import React, { useState, useEffect } from "react";
import { X, Play, RefreshCw, ChevronLeft, ChevronRight, Check, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { db, Flashcard, Block } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

interface StudySessionProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function StudySession({ projectId, isOpen, onClose }: StudySessionProps) {
    const [mode, setMode] = useState<'setup' | 'study'>('setup');
    const [selectedLectureId, setSelectedLectureId] = useState<string>('all');
    const [studySet, setStudySet] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [finished, setFinished] = useState(false);
    const [stats, setStats] = useState({ correct: 0, total: 0 });

    // Fetch all cards for project
    const allCards = useLiveQuery(
        () => db.flashcards.where('project_id').equals(projectId).toArray(),
        [projectId]
    );

    // Fetch potential lectures (blocks that contain children or are marked as lecture containers)
    // For now, we'll just fetch top-level blocks as "Lectures"
    const lectures = useLiveQuery(
        () => db.blocks
            .where('parent_id')
            .equals(projectId)
            .filter(b => b.type === 'lecture_container' || b.content.length > 50) // Heuristic for now
            .toArray(),
        [projectId]
    );

    useEffect(() => {
        if (!isOpen) {
            setMode('setup');
            setFinished(false);
            setStats({ correct: 0, total: 0 });
            setCurrentIndex(0);
            setIsFlipped(false);
        }
    }, [isOpen]);

    const startStudy = () => {
        if (!allCards) return;
        
        let filtered = allCards;
        if (selectedLectureId !== 'all') {
            // Filter by source_block_id 
            filtered = allCards.filter(c => c.source_block_id === selectedLectureId);
        }

        if (filtered.length === 0) {
            alert("No flashcards found for this selection. Try generating some Cards first!");
            return;
        }

        // Shuffle
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        setStudySet(shuffled);
        setStats({ correct: 0, total: shuffled.length });
        setMode('study');
        setCurrentIndex(0);
        setIsFlipped(false);
        setFinished(false);
    };

    const handleRate = async (correct: boolean) => {
        const card = studySet[currentIndex];
        if (!card) return; // Safety check
        
        // Update stats
        if (correct) {
            setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
        }

        // Update DB
        const newReviewCount = (card.review_count || 0) + 1;
        await db.flashcards.update(card.id, {
            review_count: newReviewCount,
            last_reviewed_at: Date.now()
        });

        // Next card
        if (currentIndex < studySet.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
        } else {
            setFinished(true);
        }
    };

    // Helper to get count
    const getSelectionCount = () => {
        if (!allCards) return 0;
        if (selectedLectureId === 'all') return allCards.length;
        return allCards.filter(c => c.source_block_id === selectedLectureId).length;
    };
    
    const selectionCount = getSelectionCount();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        Study Session
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'setup' ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                                    What do you want to study?
                                </label>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setSelectedLectureId('all')}
                                        className={cn(
                                            "w-full text-left p-4 rounded-lg border flex items-center gap-3 transition-all",
                                            selectedLectureId === 'all'
                                                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                        )}
                                    >
                                        <Layers className="w-5 h-5 text-purple-500" />
                                        <div>
                                            <div className="font-medium">All Lectures Combined</div>
                                            <div className="text-xs text-zinc-500">
                                                Review everything in this project ({allCards?.length || 0} cards)
                                            </div>
                                        </div>
                                    </button>

                                    {lectures?.map(lecture => (
                                        <button
                                            key={lecture.id}
                                            onClick={() => setSelectedLectureId(lecture.id)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-lg border flex items-center gap-3 transition-all",
                                                selectedLectureId === lecture.id
                                                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                            )}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-mono">
                                                L
                                            </div>
                                            <div>
                                                <div className="font-medium truncate pr-4">{lecture.content.slice(0, 50) || "Untitled Lecture"}...</div>
                                                <div className="text-xs text-zinc-500">
                                                    {allCards ? allCards.filter(c => c.source_block_id === lecture.id).length : 0} cards
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : finished ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Session Complete!</h3>
                            <p className="text-zinc-500 mb-6">
                                You reviewed {stats.total} cards.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMode('setup')}
                                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Back to Menu
                                </button>
                                <button
                                    onClick={startStudy}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Review Again
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full max-w-lg mx-auto">
                            <div className="flex items-center justify-between mb-4 text-sm text-zinc-400">
                                <span>Card {currentIndex + 1} of {studySet.length}</span>
                                <span>{Math.round((currentIndex / studySet.length) * 100)}% Complete</span>
                            </div>
                            
                            {/* Card Flip Area */}
                            <div 
                                className="flex-1 perspective-1000 min-h-[300px] cursor-pointer"
                                onClick={() => setIsFlipped(!isFlipped)}
                            >
                                <div className={cn(
                                    "relative w-full h-full text-center transition-transform duration-500 transform-style-3d",
                                    isFlipped ? "rotate-y-180" : ""
                                )}>
                                    {/* Front */}
                                    <div className="absolute inset-0 backface-hidden bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-8 shadow-sm group hover:border-blue-200 transition-colors">
                                        <div className="text-xs uppercase tracking-wider text-zinc-400 mb-4 font-semibold">Question</div>
                                        <div className="text-xl font-medium text-zinc-800 dark:text-zinc-100">
                                            {studySet[currentIndex]?.front}
                                        </div>
                                        <div className="absolute bottom-4 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Click to flip
                                        </div>
                                    </div>

                                    {/* Back */}
                                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-2xl flex flex-col items-center justify-center p-8 shadow-sm">
                                        <div className="text-xs uppercase tracking-wider text-blue-400 mb-4 font-semibold">Answer</div>
                                        <div className="text-lg text-zinc-700 dark:text-zinc-200">
                                            {studySet[currentIndex]?.back}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            {isFlipped && (
                                <div className="mt-8 grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRate(false); }}
                                        className="p-3 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors"
                                    >
                                        Needs Practice
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRate(true); }}
                                        className="p-3 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-colors"
                                    >
                                        Got it!
                                    </button>
                                </div>
                            )}
                            {!isFlipped && (
                                <div className="mt-8 flex justify-center">
                                    <button 
                                        onClick={() => setIsFlipped(true)}
                                        className="px-6 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-full text-sm font-medium hover:scale-105 transition-transform"
                                    >
                                        Show Answer
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {mode === 'setup' && (
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
                        <button
                            onClick={startStudy}
                            disabled={selectionCount === 0}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Start Session ({selectionCount})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Add some CSS utility classes if needed, but Tailwind should handle it.
// Rotations:
// .rotate-y-180 { transform: rotateY(180deg); }
// .perspective-1000 { perspective: 1000px; }
// .transform-style-3d { transform-style: preserve-3d; }
// .backface-hidden { backface-visibility: hidden; }
