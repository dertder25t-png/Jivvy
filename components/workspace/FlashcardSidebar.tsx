"use client";

import React, { useState } from "react";
import {
    SquareStack,
    ChevronLeft,
    ChevronRight,
    Shuffle,
    CheckCircle2,
    XCircle,
    Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Flashcard {
    id: string;
    front: string;
    back: string;
    color?: string;
}

interface FlashcardSidebarProps {
    className?: string;
    projectId?: string;
}

// Mock flashcards - in real app, fetch from database
const MOCK_FLASHCARDS: Flashcard[] = [
    {
        id: "1",
        front: "What is the rule of thirds?",
        back: "A compositional guideline that divides an image into 9 equal parts using 2 horizontal and 2 vertical lines.",
        color: "lime"
    },
    {
        id: "2",
        front: "Define kerning",
        back: "The adjustment of space between individual letter pairs in typography.",
        color: "violet"
    },
    {
        id: "3",
        front: "What is a complementary color scheme?",
        back: "Colors that are opposite each other on the color wheel (e.g., blue and orange).",
        color: "amber"
    },
];

export function FlashcardSidebar({ className }: FlashcardSidebarProps) {
    const [cards, setCards] = useState<Flashcard[]>(MOCK_FLASHCARDS);
    const [collapsed, setCollapsed] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [stats, setStats] = useState({ correct: 0, incorrect: 0 });

    const currentCard = cards[currentCardIndex];

    const handleNextCard = (correct: boolean) => {
        setStats(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            incorrect: prev.incorrect + (correct ? 0 : 1)
        }));
        setIsFlipped(false);

        if (currentCardIndex < cards.length - 1) {
            setTimeout(() => setCurrentCardIndex(prev => prev + 1), 200);
        } else {
            // End of deck
            setIsReviewing(false);
            setCurrentCardIndex(0);
        }
    };

    const shuffleCards = () => {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setCurrentCardIndex(0);
        setStats({ correct: 0, incorrect: 0 });
    };

    const resetReview = () => {
        setCurrentCardIndex(0);
        setStats({ correct: 0, incorrect: 0 });
        setIsFlipped(false);
    };

    const getCardColor = (color?: string) => {
        switch (color) {
            case "lime": return "border-lime-500/30 bg-lime-500/5";
            case "violet": return "border-violet-500/30 bg-violet-500/5";
            case "amber": return "border-amber-500/30 bg-amber-500/5";
            case "rose": return "border-rose-500/30 bg-rose-500/5";
            default: return "border-zinc-700 bg-zinc-800/50";
        }
    };

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className="h-full w-10 flex items-center justify-center bg-background border-r border-zinc-800 hover:bg-zinc-900 transition-colors group"
            >
                <ChevronRight size={16} className="text-zinc-500 group-hover:text-lime-400" />
            </button>
        );
    }

    return (
        <div className={cn(
            "w-80 h-full flex flex-col bg-background border-r border-lime-500/20",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <SquareStack size={16} className="text-lime-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        Flashcards
                    </span>
                    <span className="text-xs text-zinc-600">({cards.length})</span>
                </div>
                <button
                    onClick={() => setCollapsed(true)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
            </div>

            {isReviewing ? (
                /* Review Mode */
                <div className="flex-1 flex flex-col p-4">
                    {/* Progress */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-zinc-500">
                            {currentCardIndex + 1} / {cards.length}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-lime-400">{stats.correct} ✓</span>
                            <span className="text-rose-400">{stats.incorrect} ✗</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
                        <div
                            className="h-full bg-lime-400 transition-all duration-300"
                            style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
                        />
                    </div>

                    {/* Card */}
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className={cn(
                            "flex-1 flex items-center justify-center p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300",
                            getCardColor(currentCard?.color),
                            "hover:scale-[1.02]"
                        )}
                    >
                        <div className="text-center">
                            <p className="text-white font-medium">
                                {isFlipped ? currentCard?.back : currentCard?.front}
                            </p>
                            <p className="text-xs text-zinc-500 mt-4">
                                {isFlipped ? "Answer" : "Click to flip"}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    {isFlipped && (
                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={() => handleNextCard(false)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-colors"
                            >
                                <XCircle size={18} />
                                Missed
                            </button>
                            <button
                                onClick={() => handleNextCard(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-xl transition-colors"
                            >
                                <CheckCircle2 size={18} />
                                Got it!
                            </button>
                        </div>
                    )}

                    {/* Exit Review */}
                    <button
                        onClick={() => {
                            setIsReviewing(false);
                            resetReview();
                        }}
                        className="mt-3 text-xs text-zinc-500 hover:text-white transition-colors"
                    >
                        Exit Review
                    </button>
                </div>
            ) : (
                /* Card List Mode */
                <>
                    {/* Actions */}
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                        <button
                            onClick={() => setIsReviewing(true)}
                            disabled={cards.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-lime-400 hover:bg-lime-300 text-black rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Sparkles size={16} />
                            Start Review
                        </button>
                        <button
                            onClick={shuffleCards}
                            disabled={cards.length === 0}
                            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-colors disabled:opacity-50"
                        >
                            <Shuffle size={16} />
                        </button>
                    </div>

                    {/* Cards List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cards.length === 0 ? (
                            <div className="text-center py-8">
                                <SquareStack className="mx-auto text-zinc-700 mb-3" size={32} />
                                <p className="text-zinc-500 text-sm">No flashcards yet</p>
                                <p className="text-zinc-600 text-xs mt-1">
                                    Highlight text and click &quot;Make Card&quot; in your notes
                                </p>
                            </div>
                        ) : (
                            cards.map((card) => (
                                <div
                                    key={card.id}
                                    className={cn(
                                        "p-3 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer",
                                        getCardColor(card.color)
                                    )}
                                >
                                    <p className="text-sm text-white font-medium line-clamp-2">
                                        {card.front}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                                        {card.back}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Stats */}
                    {cards.length > 0 && (
                        <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
                            <div className="text-center">
                                <p className="text-xs text-zinc-500">
                                    {cards.length} cards in deck
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
