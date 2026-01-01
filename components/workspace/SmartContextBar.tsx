"use client";

import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useState } from "react";
import {
    SquareStack,
    PenTool,
    ChevronRight,
    Search,
    Wand2,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { AppError, createAppError, toAppError } from "@/lib/errors";
// This component acts as a unified hub for all context-aware actions
// It replaces the individual floating menus to reduce clutter

interface SmartContextBarProps {
    editor: Editor;
    projectId?: string;
    isFlashcardMode: boolean;
}

type ActiveMode = "main" | "ref" | "tone" | "flash" | null;

export function SmartContextBar({ editor, projectId, isFlashcardMode }: SmartContextBarProps) {
    const [activeMode, setActiveMode] = useState<ActiveMode>("main");

    // If flashcard mode is explicitly toggled on via the main UI button, we defer to the specific Flashcard UI behavior
    // logic in Notebook.tsx might need adjustment, but for now we hide this generic bar if global Flashcard Mode is ON
    if (isFlashcardMode) {
        return null;
    }

    const reset = () => {
        setActiveMode("main");
    };

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => {
                return !editor.view.state.selection.empty && !isFlashcardMode;
            }}
        >
            <div className="flex flex-col animate-in fade-in zoom-in-95 duration-150">

                {/* Main Bar */}
                {activeMode === "main" && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 flex items-center gap-1 overflow-hidden">

                        {/* Ref Hunter Trigger */}
                        <button
                            onClick={() => setActiveMode("ref")}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                            title="Find References"
                        >
                            <Search size={14} className="text-blue-400" />
                            <span className="hidden sm:inline">Refs</span>
                        </button>

                        <div className="w-px h-4 bg-zinc-800" />

                        {/* Tone Tuner Trigger */}
                        <button
                            onClick={() => setActiveMode("tone")}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                            title="Rewrite Tone"
                        >
                            <Wand2 size={14} className="text-violet-400" />
                            <span className="hidden sm:inline">Rewrite</span>
                        </button>

                        <div className="w-px h-4 bg-zinc-800" />

                        {/* Flashcard Trigger */}
                        <button
                            onClick={() => setActiveMode("flash")}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                            title="Create Flashcard"
                        >
                            <SquareStack size={14} className="text-lime-400" />
                            <span className="hidden sm:inline">Card</span>
                        </button>
                    </div>
                )}

                {/* Sub-Menus (We render custom versions or wrap existing components) */}
                {/* Since existing components are strictly BubbleMenus themselves, we need to adapt them or wrap them.
                    However, Tiptap BubbleMenu inside BubbleMenu is tricky.

                    Better strategy: The existing components (RefHunterMenu, etc.) have logic tied to them.
                    We can conditionally render the CONTENT of those menus here if we refactor them,
                    OR we can just overlay the specific UI here.

                    Given the request to "design a better system", I will refactor the internal logic of the menus to be generic content components
                    that can be placed here, OR just implement the UI here and call the same actions.

                    For simplicity and robustness in this turn, I will render specific sub-views here that call the shared actions.
                */}

                {activeMode === "ref" && (
                    <RefHunterView editor={editor} onBack={reset} />
                )}

                {activeMode === "tone" && (
                    <ToneTunerView editor={editor} onBack={reset} />
                )}

                {activeMode === "flash" && (
                    <FlashcardView editor={editor} projectId={projectId} onBack={reset} />
                )}

            </div>
        </BubbleMenu>
    );
}

// --- Sub-Components (Refactored logic from individual menus) ---

import { generateSearchQueries, rewriteText } from "@/utils/local-ai-actions";
import { createFlashcard } from "@/app/flashcards/actions";

function RefHunterView({ editor, onBack }: { editor: Editor, onBack: () => void }) {
    const [loading, setLoading] = useState(false);
    const [queries, setQueries] = useState<string[]>([]);
    const [error, setError] = useState<AppError | null>(null);

    const handleFindRefs = async () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        if (!text) return;

        setLoading(true);
        try {
            const result = await generateSearchQueries(text);
            if (result.error) setError(result.error);
            else setQueries(result.queries);
        } catch (e) {
            setError(toAppError(e, { code: 'REF_HUNTER_FAILED', message: 'Failed to search', retryable: true }));
        } finally {
            setLoading(false);
        }
    };

    // Auto-trigger search when entering this mode? Optional. Let's make it manual for now or auto.
    // Let's do auto for smoother UX.
    useState(() => { handleFindRefs(); });

    const openSearch = (query: string, platform: string) => {
        const encoded = encodeURIComponent(query);
        let url = "";
        switch(platform) {
            case 'behance': url = `https://www.behance.net/search/projects?search=${encoded}`; break;
            case 'pinterest': url = `https://www.pinterest.com/search/pins/?q=${encoded}`; break;
            case 'dribbble': url = `https://dribbble.com/search/${encoded}`; break;
            case 'artstation': url = `https://www.artstation.com/search?q=${encoded}`; break;
            default: url = `https://google.com/search?q=${encoded}`;
        }
        window.open(url, "_blank");
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 w-72">
            <div className="flex justify-between items-center mb-3">
                <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-1 text-xs">
                    <ChevronRight size={12} className="rotate-180" /> Back
                </button>
                <span className="text-xs uppercase font-bold text-blue-400">Ref Hunter</span>
            </div>

            {loading && <div className="text-zinc-400 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Generating ideas...</div>}

            {error && <ErrorNotice error={error} className="mt-1" />}

            {!loading && !error && queries.length > 0 && (
                <div className="space-y-2">
                    {queries.map((q, i) => (
                        <div key={i} className="bg-zinc-800/50 p-2 rounded-lg">
                            <p className="text-xs text-zinc-300 mb-2 font-medium">{q}</p>
                            <div className="flex flex-wrap gap-1">
                                <PlatformButton label="Behance" onClick={() => openSearch(q, 'behance')} color="bg-blue-500/10 text-blue-500" />
                                <PlatformButton label="Pinterest" onClick={() => openSearch(q, 'pinterest')} color="bg-red-500/10 text-red-500" />
                                <PlatformButton label="Dribbble" onClick={() => openSearch(q, 'dribbble')} color="bg-pink-500/10 text-pink-500" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PlatformButton({ label, onClick, color }: { label: string, onClick: () => void, color: string }) {
    return (
        <button onClick={onClick} className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-colors hover:bg-opacity-20", color)}>
            {label}
        </button>
    )
}

function ToneTunerView({ editor, onBack }: { editor: Editor, onBack: () => void }) {
    const [loading, setLoading] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customSample, setCustomSample] = useState("");
    const [error, setError] = useState<AppError | null>(null);

    const handleRewrite = async (tone: string) => {
        if (tone === "custom") {
            setShowCustomInput(true);
            return;
        }

        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        if (!text) return;

        setLoading(true);
        try {
            const result = await rewriteText(text, tone);
            if (result.rewrittenText) {
                editor.chain().focus().insertContent(result.rewrittenText).run();
                onBack();
            } else if (result.error) {
                setError(result.error);
            }
        } catch (e) {
             setError(toAppError(e, { code: 'TONE_TUNER_FAILED', message: 'Failed to rewrite', retryable: true }));
        } finally {
            setLoading(false);
        }
    };

    const handleCustomRewrite = async () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");

        if (customSample.length < 50) {
            setError(createAppError('SAMPLE_TOO_SHORT', 'Sample too short (min 50 chars)', { retryable: false }));
            return;
        }
        if (!text) return;

        setLoading(true);
        try {
            const result = await rewriteText(text, "custom", customSample);
            if (result.rewrittenText) {
                editor.chain().focus().insertContent(result.rewrittenText).run();
                onBack();
            } else if (result.error) {
                setError(result.error);
            }
        } catch (e) {
            setError(toAppError(e, { code: 'TONE_TUNER_FAILED', message: 'Failed to rewrite', retryable: true }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 w-56">
             <div className="flex justify-between items-center mb-2 px-1">
                <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-1 text-xs">
                    <ChevronRight size={12} className="rotate-180" /> Back
                </button>
                <span className="text-xs uppercase font-bold text-violet-400">Tone</span>
            </div>

            {loading ? (
                <div className="p-2 text-xs text-zinc-400 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Rewriting...
                </div>
            ) : showCustomInput ? (
                <div className="flex flex-col gap-2 p-1">
                    <p className="text-xs text-zinc-400">Paste style sample (min 50 chars):</p>
                    <textarea
                        value={customSample}
                        onChange={(e) => setCustomSample(e.target.value)}
                        placeholder="Paste sample text..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-white focus:outline-none focus:border-violet-400 resize-none h-20"
                        autoFocus
                    />
                    {error && <ErrorNotice error={error} className="mt-1" />}
                    <div className="flex justify-between items-center mt-1">
                         <span className={cn("text-xs", customSample.length < 50 ? "text-red-400" : "text-zinc-500")}>
                            {customSample.length}/50
                        </span>
                        <button
                            onClick={handleCustomRewrite}
                            disabled={customSample.length < 50}
                            className="bg-violet-500 text-white text-xs font-bold px-2 py-1 rounded hover:bg-violet-600 disabled:opacity-50"
                        >
                            Match Tone
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-1">
                    {['Academic', 'Professional', 'Casual', 'Creative'].map(t => (
                        <button key={t} onClick={() => handleRewrite(t.toLowerCase())} className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors">
                            {t}
                        </button>
                    ))}
                    <div className="h-px bg-zinc-800 my-1" />
                    <button onClick={() => setShowCustomInput(true)} className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2">
                        <PenTool size={10} /> Custom Tone...
                    </button>
                </div>
            )}

              {error && !showCustomInput && !loading && (
                  <div className="px-2 py-1 border-t border-zinc-800 mt-1">
                    <ErrorNotice error={error} />
                  </div>
              )}
        </div>
    )
}

function FlashcardView({ editor, projectId, onBack }: { editor: Editor, projectId?: string, onBack: () => void }) {
    const [back, setBack] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!projectId) return;
        const { from, to } = editor.state.selection;
        const front = editor.state.doc.textBetween(from, to, " ");

        setLoading(true);
        const res = await createFlashcard(projectId, front, back, `node-${Date.now()}`);
        if (res.success) {
            editor.chain().focus().setHighlight({ color: "lime" }).run();
            onBack();
        }
        setLoading(false);
    };

    return (
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 w-64">
             <div className="flex justify-between items-center mb-3">
                <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-1 text-xs">
                    <ChevronRight size={12} className="rotate-180" /> Back
                </button>
                <span className="text-xs uppercase font-bold text-lime-400">New Card</span>
            </div>
            <div className="space-y-2">
                <div className="text-xs text-zinc-500 italic line-clamp-2 border-l-2 border-lime-400/20 pl-2">
                    &quot;{editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")}&quot;
                </div>
                <textarea
                    value={back}
                    onChange={e => setBack(e.target.value)}
                    placeholder="Back of card..."
                    className="w-full bg-zinc-800 rounded p-2 text-xs text-white focus:outline-none resize-none h-16"
                    autoFocus
                />
                <button onClick={handleSave} disabled={loading || !back} className="w-full bg-lime-400 text-black text-xs font-bold py-1.5 rounded hover:bg-lime-500 transition-colors">
                    {loading ? "Saving..." : "Create Card"}
                </button>
            </div>
        </div>
    )
}
