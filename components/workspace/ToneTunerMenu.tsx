"use client";

import { BubbleMenu, Editor } from "@tiptap/react";
import { useState } from "react";
import { Sparkles, Loader2, X, ChevronDown, Check, PenTool } from "lucide-react";
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
    { id: "custom", label: "Custom Tone...", color: "text-amber-400" }, // Added Custom
];

export function ToneTunerMenu({ editor, isFlashcardMode }: ToneTunerMenuProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Custom Tone State
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customSample, setCustomSample] = useState("");

    if (isFlashcardMode) {
        return null;
    }

    const handleRewrite = async (tone: string) => {
        if (tone === "custom") {
            setShowCustomInput(true);
            setIsOpen(false);
            return;
        }

        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");

        if (!text || text.trim().length === 0) return;

        setLoading(true);
        setError(null);
        setIsOpen(false);

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

    const handleCustomRewrite = async () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");

        // Minimum character check for sample text (50 chars)
        if (customSample.length < 50) {
            setError("Sample text too short (min 50 chars)");
            return;
        }

        if (!text || text.trim().length === 0) return;

        setLoading(true);
        setError(null);

        try {
            // Pass custom tone and sample text
            const result = await rewriteText(text, "custom", customSample);

            if (result.error) {
                setError(result.error);
            } else if (result.rewrittenText) {
                editor.chain().focus().insertContent(result.rewrittenText).run();
                // Close custom input on success
                setShowCustomInput(false);
                setCustomSample("");
            }
        } catch (err) {
            setError("Failed to rewrite text");
        } finally {
            setLoading(false);
        }
    };

    const resetState = () => {
        setIsOpen(false);
        setShowCustomInput(false);
        setError(null);
        setCustomSample("");
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
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 flex items-center overflow-hidden">

                    {/* Loading State */}
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
                    ) : showCustomInput ? (
                        // Custom Input Mode
                        <div className="flex flex-col p-2 w-[300px] gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                                    <PenTool size={10} /> Custom Tone Match
                                </span>
                                <button onClick={resetState} className="text-zinc-500 hover:text-white">
                                    <X size={12} />
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400">
                                Paste a sample of text (min 50 chars) to match its style.
                            </p>
                            <textarea
                                value={customSample}
                                onChange={(e) => setCustomSample(e.target.value)}
                                placeholder="Paste example text here..."
                                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none h-20"
                                autoFocus
                            />
                             <div className="flex justify-between items-center">
                                <span className={cn("text-[10px]", customSample.length < 50 ? "text-red-400" : "text-zinc-500")}>
                                    {customSample.length}/50 chars
                                </span>
                                <button
                                    onClick={handleCustomRewrite}
                                    disabled={customSample.length < 50}
                                    className="bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    <Check size={12} /> Match Tone
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Standard Menu
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
                                    <div className="absolute top-full mt-2 left-0 w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-100">
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
