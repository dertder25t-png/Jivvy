"use client";

import { BubbleMenu, Editor } from "@tiptap/react";
import { useState } from "react";
import { Sparkles, Loader2, X, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { rewriteText } from "@/app/ai/actions";

interface ToneTunerMenuProps {
    editor: Editor;
    isFlashcardMode: boolean;
}

const TONES = [
    { id: "academic", label: "Academic", color: "text-violet-400" },
    { id: "professional", label: "Professional", color: "text-blue-400" },
    { id: "casual", label: "Casual", color: "text-green-400" },
    { id: "creative", label: "Creative", color: "text-pink-400" },
];

export function ToneTunerMenu({ editor, isFlashcardMode }: ToneTunerMenuProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    if (isFlashcardMode) {
        return null;
    }

    const handleRewrite = async (tone: string) => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");

        if (!text || text.trim().length === 0) return;

        setLoading(true);
        setError(null);
        setIsOpen(false); // Close dropdown while loading

        try {
            const result = await rewriteText(text, tone);

            if (result.error) {
                setError(result.error);
            } else if (result.rewrittenText) {
                editor.chain().focus().insertContent(result.rewrittenText).run();
            }
        } catch (err) {
            setError("Failed to rewrite text");
        } finally {
            setLoading(false);
        }
    };

    return (
        <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: "bottom-start" }}
            shouldShow={({ editor }) => {
                return !editor.view.state.selection.empty && !isFlashcardMode;
            }}
        >
            <div className="flex gap-2 items-center">
                {/* Main Action Button */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 flex items-center overflow-hidden">
                    {loading ? (
                        <div className="px-3 py-1.5 flex items-center gap-2 text-sm text-zinc-400">
                            <Loader2 size={14} className="animate-spin text-lime-400" />
                            Rewriting...
                        </div>
                    ) : error ? (
                        <div className="px-3 py-1.5 flex items-center gap-2 text-sm text-red-400">
                            <span className="max-w-[150px] truncate">{error}</span>
                            <button onClick={() => setError(null)} className="hover:text-white"><X size={12} /></button>
                        </div>
                    ) : (
                        <div className="flex">
                            <button
                                onClick={() => handleRewrite("academic")}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-sm font-medium text-white transition-colors"
                            >
                                <Sparkles size={14} className="text-violet-400" />
                                Make Academic
                            </button>
                            <div className="w-px bg-zinc-800 my-1 mx-1" />
                            <div className="relative">
                                <button
                                    onClick={() => setIsOpen(!isOpen)}
                                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors h-full flex items-center"
                                >
                                    <ChevronDown size={14} />
                                </button>

                                {isOpen && (
                                    <div className="absolute top-full mt-2 left-0 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-100">
                                        {TONES.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleRewrite(t.id)}
                                                className="text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <span className={cn("w-2 h-2 rounded-full bg-current opacity-75", t.color)} />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BubbleMenu>
    );
}
