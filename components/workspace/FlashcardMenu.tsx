"use client";

import { BubbleMenu, Editor } from "@tiptap/react";
import { useState } from "react";
import { Zap, SquareStack, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createFlashcard } from "@/app/flashcards/actions";

interface FlashcardMenuProps {
    editor: Editor;
    projectId?: string;
    isFlashcardMode: boolean;
}

export function FlashcardMenu({ editor, projectId, isFlashcardMode }: FlashcardMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [backContent, setBackContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [selectedColor, setSelectedColor] = useState("bg-lime-400/30");

    if (!isFlashcardMode || !projectId) {
        return null;
    }

    const handleCreateCard = async () => {
        const { from, to } = editor.state.selection;
        const frontText = editor.state.doc.textBetween(from, to, " ");

        if (!frontText || !backContent) return;

        setIsSaving(true);

        // 1. Create flashcard in DB
        const result = await createFlashcard(projectId, frontText, backContent, `node-${Date.now()}`);

        if (result.success) {
            // 2. Highlight text in editor
            editor.chain().focus().setHighlight({ color: selectedColor.replace("bg-", "").replace("/30", "") }).run();
            setIsOpen(false);
            setBackContent("");
        } else {
            console.error("Failed to create card:", result.error);
        }

        setIsSaving(false);
    };

    const colors = [
        { name: "Lime", class: "bg-lime-400/30", text: "text-lime-400" },
        { name: "Violet", class: "bg-violet-500/30", text: "text-violet-400" },
        { name: "Cyan", class: "bg-cyan-400/30", text: "text-cyan-400" },
        { name: "Rose", class: "bg-rose-500/30", text: "text-rose-400" },
    ];

    return (
        <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            shouldShow={({ editor }) => {
                return !editor.view.state.selection.empty && isFlashcardMode;
            }}
        >
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 flex flex-col gap-1 w-64 overflow-hidden">
                {!isOpen ? (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-lg text-sm font-medium text-white transition-colors w-full"
                    >
                        <SquareStack size={14} className="text-lime-400" />
                        Make Flashcard
                    </button>
                ) : (
                    <div className="p-2 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">New Card</span>
                            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Front</label>
                            <div className="text-xs text-white bg-zinc-800 p-2 rounded border border-zinc-700 line-clamp-2 italic opacity-80">
                                "{editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")}"
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Back</label>
                            <textarea
                                value={backContent}
                                onChange={(e) => setBackContent(e.target.value)}
                                placeholder="Enter answer..."
                                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-lime-400 resize-none h-20"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2">
                            {colors.map((c) => (
                                <button
                                    key={c.name}
                                    onClick={() => setSelectedColor(c.class)}
                                    className={cn(
                                        "w-6 h-6 rounded-full border-2 transition-all",
                                        c.class,
                                        selectedColor === c.class ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100"
                                    )}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleCreateCard}
                            disabled={!backContent || isSaving}
                            className="w-full bg-lime-400 text-black font-bold text-xs py-2 rounded-lg hover:bg-lime-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Save Card
                        </button>
                    </div>
                )}
            </div>
        </BubbleMenu>
    );
}
