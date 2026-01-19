'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { X, Check, Zap, Sparkles, Edit2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export function RightSidebar() {
    const {
        contextPanelOpen,
        setContextPanelOpen,
        suggestedFlashcards,
        dismissSuggestion,
        currentProjectId,
        flashcardTab,
        setFlashcardTab,
        manualFlashcardData,
        setManualFlashcardData
    } = useStore();

    const [editingCard, setEditingCard] = useState<string | null>(null);
    const [editedFront, setEditedFront] = useState('');
    const [editedBack, setEditedBack] = useState('');

    if (!contextPanelOpen) return null;

    const handleAccept = async (id: string, front: string, back: string) => {
        if (!currentProjectId) return;
        await db.flashcards.add({
            id: uuidv4(),
            project_id: currentProjectId,
            front,
            back,
            next_review: Date.now(),
            updated_at: Date.now(),
            sync_status: 'dirty'
        });
        dismissSuggestion(id);
    };

    const handleEdit = (id: string, front: string, back: string) => {
        setEditingCard(id);
        setEditedFront(front);
        setEditedBack(back);
    };

    const handleSaveEdit = (id: string) => {
        // For now, we'll just update locally - user can save via the "Add Card" button
        // TODO: Add updateSuggestion to store to persist edits
        setEditingCard(null);
    };

    const handleCancelEdit = () => {
        setEditingCard(null);
        setEditedFront('');
        setEditedBack('');
    };

    const handleClickToLocate = (originalText: string) => {
        // Find all textareas in the editor
        const textareas = document.querySelectorAll('textarea');

        for (const textarea of Array.from(textareas)) {
            const content = textarea.value;
            if (content.includes(originalText)) {
                // Scroll to the element
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add highlight effect
                const parent = textarea.closest('.block-item');
                if (parent) {
                    parent.classList.add('highlight-flash');
                    setTimeout(() => {
                        parent.classList.remove('highlight-flash');
                    }, 2000);
                }

                // Focus the textarea
                textarea.focus();

                // Select the matching text if possible
                const startIndex = content.indexOf(originalText);
                if (startIndex !== -1) {
                    textarea.setSelectionRange(startIndex, startIndex + originalText.length);
                }

                break;
            }
        }
    };

    const handleManualSave = async () => {
        if (!currentProjectId || !manualFlashcardData.front || !manualFlashcardData.back) return;
        await db.flashcards.add({
            id: uuidv4(),
            project_id: currentProjectId,
            front: manualFlashcardData.front,
            back: manualFlashcardData.back,
            next_review: Date.now(),
            updated_at: Date.now(),
            sync_status: 'dirty'
        });
        setManualFlashcardData({ front: '', back: '' });
        // Optional confirmation toast
    };

    return (
        <div className="w-80 border-l border-border bg-surface-50 dark:bg-zinc-900 h-full flex flex-col shadow-xl z-20">
            <div className="h-12 border-b border-border flex items-center justify-between px-4">
                <span className="font-medium text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Context & AI (v2)
                </span>
                <button
                    onClick={() => setContextPanelOpen(false)}
                    className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1 rounded"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setFlashcardTab('suggestions')}
                    className={cn(
                        "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
                        flashcardTab === 'suggestions'
                            ? "border-amber-500 text-amber-600 dark:text-amber-500"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                >
                    Suggestions ({suggestedFlashcards.length})
                </button>
                <button
                    onClick={() => setFlashcardTab('manual')}
                    className={cn(
                        "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
                        flashcardTab === 'manual'
                            ? "border-amber-500 text-amber-600 dark:text-amber-500"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                >
                    Manual Creation
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {flashcardTab === 'manual' ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-500 uppercase">Front (Question/Term)</label>
                            <textarea
                                value={manualFlashcardData.front}
                                onChange={(e) => setManualFlashcardData({ ...manualFlashcardData, front: e.target.value })}
                                className="w-full text-sm p-2 rounded border border-border bg-white dark:bg-zinc-950 min-h-[80px] focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                placeholder="e.g. Mitochondria"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-500 uppercase">Back (Answer/Definition)</label>
                            <textarea
                                value={manualFlashcardData.back}
                                onChange={(e) => setManualFlashcardData({ ...manualFlashcardData, back: e.target.value })}
                                className="w-full text-sm p-2 rounded border border-border bg-white dark:bg-zinc-950 min-h-[80px] focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                placeholder="e.g. The powerhouse of the cell."
                            />
                        </div>
                        <button
                            onClick={handleManualSave}
                            disabled={!manualFlashcardData.front || !manualFlashcardData.back}
                            className="w-full py-2 bg-primary text-white rounded font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Save to Deck
                        </button>
                    </div>
                ) : (
                    suggestedFlashcards.length === 0 ? (
                        <div className="text-center text-zinc-500 text-sm mt-10">
                            <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            No suggestions yet.
                            <br /><span className="text-xs opacity-70">Type "Term: Definition" or click "Create Flashcard" via selection.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {suggestedFlashcards.map(card => (
                                <div key={card.id} className="bg-white dark:bg-zinc-950 border border-border rounded-lg p-3 shadow-sm animate-in fade-in slide-in-from-right-2">
                                    <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1 justify-between">
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-amber-500" />
                                            Detected Pattern ({card.type})
                                        </div>
                                        {card.originalText && (
                                            <button
                                                onClick={() => handleClickToLocate(card.originalText)}
                                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                                                title="Jump to source"
                                            >
                                                <MapPin className="w-3 h-3 text-blue-500" />
                                            </button>
                                        )}
                                    </div>

                                    {editingCard === card.id ? (
                                        <div className="space-y-2 mb-2">
                                            <textarea
                                                value={editedFront}
                                                onChange={(e) => setEditedFront(e.target.value)}
                                                className="w-full text-sm p-2 rounded border border-border bg-white dark:bg-zinc-950 min-h-[60px] focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                            />
                                            <textarea
                                                value={editedBack}
                                                onChange={(e) => setEditedBack(e.target.value)}
                                                className="w-full text-sm p-2 rounded border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 min-h-[60px] focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="text-xs px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleSaveEdit(card.id)}
                                                    className="text-xs px-2 py-1 bg-blue-500 text-white hover:bg-blue-600 rounded"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-2">
                                            <div className="text-sm font-medium">{card.front}</div>
                                            <div className="text-sm text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 mt-2 pt-2 whitespace-pre-wrap">
                                                {card.back}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 mt-2">
                                        {editingCard !== card.id && (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(card.id, card.front, card.back)}
                                                    className="text-xs px-2 py-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded flex items-center gap-1"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => dismissSuggestion(card.id)}
                                                    className="text-xs px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                                                >
                                                    Ignore
                                                </button>
                                                <button
                                                    onClick={() => handleAccept(card.id, card.front, card.back)}
                                                    className="text-xs px-2 py-1 bg-primary text-white hover:bg-primary/90 rounded flex items-center gap-1"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Add Card
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
