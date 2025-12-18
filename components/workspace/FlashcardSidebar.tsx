"use client";

import React, { useState } from "react";
import {
    SquareStack,
    ChevronLeft,
    ChevronRight,
    Shuffle,
    CheckCircle2,
    XCircle,
    Sparkles,
    Plus,
    Library
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
            case "lime": return "border-lime-500/30 bg-lime-500/5 hover:border-lime-500/50";
            case "violet": return "border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50";
            case "amber": return "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50";
            case "rose": return "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50";
            default: return "border-zinc-700 bg-zinc-800/30 hover:border-zinc-500";
        }
    };

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className="h-full w-12 flex items-center justify-center bg-zinc-950/50 backdrop-blur border-r border-zinc-800 hover:bg-zinc-900 transition-colors group"
            >
                <ChevronRight size={18} className="text-zinc-500 group-hover:text-lime-400" />
            </button>
        );
    }

    return (
        <div className={cn(
            "w-80 h-full flex flex-col bg-zinc-950/80 backdrop-blur border-r border-zinc-800",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-lime-400/10 rounded-lg">
                        <Library size={16} className="text-lime-400" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                            Flashcards
                        </span>
                        <span className="text-[10px] text-zinc-600 font-medium">{cards.length} items</span>
                    </div>
                </div>
                <button
                    onClick={() => setCollapsed(true)}
                    className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all active:scale-95"
                >
                    <ChevronLeft size={16} />
                </button>
            </div>

            {isReviewing ? (
                /* Review Mode */
                <div className="flex-1 flex flex-col p-5 animate-in fade-in slide-in-from-right-4">
                    {/* Progress */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-xs font-medium text-zinc-500">
                            Card {currentCardIndex + 1} <span className="text-zinc-700">/</span> {cards.length}
                        </span>
                        <div className="flex items-center gap-3 text-xs font-bold">
                            <span className="text-lime-400 flex items-center gap-1"><CheckCircle2 size={12}/> {stats.correct}</span>
                            <span className="text-rose-400 flex items-center gap-1"><XCircle size={12}/> {stats.incorrect}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-zinc-900 rounded-full mb-6 overflow-hidden border border-zinc-800">
                        <div
                            className="h-full bg-lime-400 transition-all duration-300 ease-out"
                            style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
                        />
                    </div>

                    {/* Card */}
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center p-8 rounded-3xl border cursor-pointer transition-all duration-300 shadow-xl",
                            getCardColor(currentCard?.color),
                            "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <div className="text-center space-y-4">
                            <span className={cn(
                                "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                isFlipped ? "bg-zinc-800 text-zinc-400" : "bg-lime-400/10 text-lime-400"
                            )}>
                                {isFlipped ? "Back" : "Front"}
                            </span>
                            <p className={cn(
                                "text-white font-medium leading-relaxed transition-all",
                                isFlipped ? "text-sm text-zinc-300" : "text-lg"
                            )}>
                                {isFlipped ? currentCard?.back : currentCard?.front}
                            </p>
                            <p className="text-xs text-zinc-500 pt-4 opacity-50">
                                {isFlipped ? "Tap to flip back" : "Tap to reveal answer"}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    {isFlipped && (
                        <div className="flex items-center gap-3 mt-6 animate-in slide-in-from-bottom-2 fade-in">
                            <button
                                onClick={() => handleNextCard(false)}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl transition-all active:scale-95 font-medium text-sm"
                            >
                                <XCircle size={18} />
                                Missed
                            </button>
                            <button
                                onClick={() => handleNextCard(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border border-lime-400/20 rounded-2xl transition-all active:scale-95 font-medium text-sm"
                            >
                                <CheckCircle2 size={18} />
                                Got it
                            </button>
                        </div>
                    )}

                    {/* Exit Review */}
                    <button
                        onClick={() => {
                            setIsReviewing(false);
                            resetReview();
                        }}
                        className="mt-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                        End Review Session
                    </button>
                </div>
            ) : (
                /* Card List Mode */
                <>
                    {/* Actions */}
                    <div className="p-4 border-b border-zinc-800/50 flex items-center gap-2">
                        <button
                            onClick={() => setIsReviewing(true)}
                            disabled={cards.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-lime-400 hover:bg-lime-500 text-zinc-950 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(163,230,53,0.2)]"
                        >
                            <Sparkles size={16} />
                            Start Review
                        </button>
                        <button
                            onClick={shuffleCards}
                            disabled={cards.length === 0}
                            className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                            title="Shuffle Deck"
                        >
                            <Shuffle size={16} />
                        </button>
                    </div>

                    {/* Cards List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50 border-2 border-dashed border-zinc-800 rounded-3xl mx-2">
                                <div className="p-4 bg-zinc-900 rounded-full">
                                    <SquareStack className="text-zinc-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-zinc-300 text-sm font-medium">No cards yet</p>
                                    <p className="text-zinc-500 text-xs mt-1 px-8">
                                        Highlight text in your notes and select "Create Card"
                                    </p>
                                </div>
                            </div>
                        ) : (
                            cards.map((card) => (
                                <div
                                    key={card.id}
                                    className={cn(
                                        "p-4 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer group shadow-sm",
                                        getCardColor(card.color)
                                    )}
                                >
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <p className="text-sm text-white font-medium line-clamp-2 leading-relaxed">
                                            {card.front}
                                        </p>
                                        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                                            card.color === 'lime' ? 'bg-lime-400' :
                                            card.color === 'violet' ? 'bg-violet-400' : 'bg-zinc-600'
                                        )} />
                                    </div>
                                    <div className="h-px bg-white/5 my-2 group-hover:bg-white/10 transition-colors" />
                                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                        {card.back}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {cards.length > 0 && (
                        <div className="p-3 border-t border-zinc-800 bg-zinc-950/50 backdrop-blur text-center">
                            <button className="text-xs font-bold text-zinc-500 hover:text-lime-400 transition-colors uppercase tracking-wider flex items-center justify-center gap-1 w-full py-2">
                                <Plus size={12} /> Add New Card manually
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
