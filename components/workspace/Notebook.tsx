"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Bold, Italic, List, ListOrdered, Heading2, Save, Loader2, SquareStack, FileText, PenLine } from "lucide-react";
import { FlashcardMenu } from "./FlashcardMenu";
import { SmartContextBar } from "./SmartContextBar";
import Highlight from "@tiptap/extension-highlight";
import DOMPurify from "isomorphic-dompurify";
import { GrammarChecker } from "@/components/editor/extensions/GrammarChecker";
import type { AppError } from "@/lib/errors";

interface NotebookProps {
    className?: string;
    projectId?: string;
    initialContent?: string;
    onSave?: (content: string) => Promise<void>;
    mode?: "paper" | "notes";
}

export function Notebook({ className, projectId, initialContent = "", onSave, mode = "notes" }: NotebookProps) {
    // Sanitize initial content to prevent XSS
    const sanitizedInitialContent = useMemo(() => {
        return DOMPurify.sanitize(initialContent);
    }, [initialContent]);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isFlashcardMode, setIsFlashcardMode] = useState(false);
    const [grammarEnabled, setGrammarEnabled] = useState(false);

    const [tidyStatus, setTidyStatus] = useState<'idle' | 'pending' | 'ready' | 'error'>('idle');
    const [tidyError, setTidyError] = useState<AppError | null>(null);
    const [tidySnapshot, setTidySnapshot] = useState<{ originalText: string; correctedText: string } | null>(null);

    useEffect(() => {
        const checkGrammarSetting = () => {
            const stored = localStorage.getItem('jivvy-grammar-enabled');
            setGrammarEnabled(stored === 'true');
        };

        checkGrammarSetting();

        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.grammarEnabled !== undefined) {
                setGrammarEnabled(e.detail.grammarEnabled);
            } else {
                checkGrammarSetting();
            }
        };

        window.addEventListener('jivvy-settings-changed', handleSettingsChange as EventListener);
        return () => window.removeEventListener('jivvy-settings-changed', handleSettingsChange as EventListener);
    }, []);

    // Listen for trust-based tidying state from GrammarChecker
    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            const detail = ce.detail as { status?: string; suggestion?: any; error?: AppError | null } | undefined;
            if (!detail?.status) return;

            if (detail.status === 'pending' || detail.status === 'ready' || detail.status === 'error' || detail.status === 'idle') {
                setTidyStatus(detail.status);
            }

            setTidyError(detail.error ?? null);

            if (detail.suggestion?.originalText && detail.suggestion?.correctedText) {
                setTidySnapshot({
                    originalText: String(detail.suggestion.originalText),
                    correctedText: String(detail.suggestion.correctedText),
                });
            } else if (detail.status === 'idle') {
                setTidySnapshot(null);
            }
        };

        window.addEventListener('jivvy:tidy-state', handler as EventListener);
        return () => window.removeEventListener('jivvy:tidy-state', handler as EventListener);
    }, []);

    const placeholderText = mode === "paper" ? "Start writing your paper..." : "Start taking lecture notes...";

    const editor = useEditor({
        extensions: [
            StarterKit,
            Highlight.configure({
                multicolor: true,
            }),
            GrammarChecker.configure({
                enabled: grammarEnabled,
            }),
        ],
        content: sanitizedInitialContent || `<p></p>`,
        immediatelyRender: false, // Fix for SSR hydration mismatch
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] p-6",
                    mode === "paper" ? "prose-headings:font-serif prose-p:font-serif prose-lg max-w-3xl mx-auto" : "prose-zinc"
                ),
            },
        },
    });

    // Update extension when state changes
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            // Use the command to toggle instead of recreating the editor
            editor.commands.setGrammarEnabled(grammarEnabled);
        }
    }, [grammarEnabled, editor]);

    // Listen for chart data insertion from DataVisualizer
    useEffect(() => {
        const handleInsertToNotebook = (e: CustomEvent<{ html: string }>) => {
            if (editor && e.detail?.html) {
                // Insert the HTML at the end of the document
                editor.chain()
                    .focus('end')
                    .insertContent(`<p></p>`) // Add spacing
                    .insertContent(e.detail.html)
                    .insertContent(`<p></p>`)
                    .run();

                console.log('[Notebook] Inserted chart data from AI Command Center');
            }
        };

        window.addEventListener('jivvy:insert-to-notebook', handleInsertToNotebook as EventListener);
        return () => window.removeEventListener('jivvy:insert-to-notebook', handleInsertToNotebook as EventListener);
    }, [editor]);

    // Auto-save every 30 seconds
    useEffect(() => {
        if (!editor || !onSave) return;

        const interval = setInterval(async () => {
            const content = editor.getHTML();
            if (content && content !== "<p></p>") {
                setSaving(true);
                await onSave(content);
                setLastSaved(new Date());
                setSaving(false);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [editor, onSave]);

    const handleManualSave = useCallback(async () => {
        if (!editor || !onSave) return;
        setSaving(true);
        await onSave(editor.getHTML());
        setLastSaved(new Date());
        setSaving(false);
    }, [editor, onSave]);

    if (!editor) {
        return (
            <div className={cn("flex items-center justify-center h-full", className)}>
                <Loader2 className="animate-spin text-lime-400" />
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col h-full bg-zinc-900/50 rounded-2xl border overflow-hidden",
            mode === "paper" ? "border-violet-500/20" : "border-white/5",
            className
        )}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-zinc-900/80 flex-wrap">
                {/* Mode Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-xs font-medium text-zinc-400 mr-2">
                    {mode === "paper" ? <FileText size={14} className="text-violet-400" /> : <PenLine size={14} className="text-lime-400" />}
                    {mode === "paper" ? "Paper" : "Notes"}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1 hidden sm:block" />

                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        editor.isActive("bold") ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        editor.isActive("italic") ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    <Italic size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        editor.isActive("heading") ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    <Heading2 size={16} />
                </button>
                <div className="w-px h-4 bg-zinc-700 mx-1 hidden sm:block" />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        editor.isActive("bulletList") ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        editor.isActive("orderedList") ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    <ListOrdered size={16} />
                </button>

                <div className="flex-1" />

                {/* Flashcard Mode Toggle - Only in Notes mode */}
                {mode === 'notes' && (
                    <button
                        onClick={() => setIsFlashcardMode(!isFlashcardMode)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors mr-2",
                            isFlashcardMode
                                ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                        )}
                    >
                        <SquareStack size={14} />
                        <span className="hidden sm:inline">{isFlashcardMode ? "Flashcard Mode" : "Cards"}</span>
                    </button>
                )}

                {/* Save button */}
                {onSave && (
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
                    </button>
                )}

                {lastSaved && (
                    <span className="text-xs text-zinc-600 px-2 hidden sm:inline">
                        Saved {lastSaved.toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Trust-based tidying banner (Phase 3) */}
            {grammarEnabled && tidyStatus !== 'idle' && (
                <div className={cn(
                    "mx-3 mt-3 rounded-lg border px-3 py-2 text-xs",
                    tidyStatus === 'error'
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : tidyStatus === 'ready'
                            ? "border-lime-500/30 bg-lime-500/10 text-lime-200"
                            : "border-white/10 bg-zinc-900/40 text-zinc-300"
                )}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            {tidyStatus === 'pending' && (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={14} />
                                    Checking for tidying suggestions…
                                </span>
                            )}
                            {tidyStatus === 'ready' && (
                                <span>
                                    Tidying suggestion ready (not applied).
                                </span>
                            )}
                            {tidyStatus === 'error' && (
                                <span>
                                    Tidying failed{tidyError?.message ? `: ${tidyError.message}` : ''}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {tidyStatus === 'ready' && (
                                <>
                                    <button
                                        onClick={() => editor.commands.applyGrammarSuggestions()}
                                        className="px-2 py-1 rounded-md bg-lime-400/20 text-lime-300 hover:bg-lime-400/30"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() => editor.commands.dismissGrammarSuggestions()}
                                        className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => editor.commands.rerunGrammarCheck()}
                                        className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                                    >
                                        Re-run
                                    </button>
                                </>
                            )}
                            {tidyStatus === 'error' && (
                                <>
                                    <button
                                        onClick={() => editor.commands.rerunGrammarCheck()}
                                        className="px-2 py-1 rounded-md bg-red-500/20 text-red-200 hover:bg-red-500/30"
                                    >
                                        Retry
                                    </button>
                                    <button
                                        onClick={() => editor.commands.dismissGrammarSuggestions()}
                                        className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                                    >
                                        Dismiss
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Snapshot kept before apply (for safety/debug) */}
                    {tidyStatus === 'ready' && tidySnapshot && (
                        <div className="mt-2 text-[11px] text-zinc-300/90">
                            <div className="truncate">Original: {tidySnapshot.originalText}</div>
                            <div className="truncate">Suggested: {tidySnapshot.correctedText}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Editor Content */}
            <div className={cn("flex-1 overflow-auto pb-20 lg:pb-0", mode === "paper" && "flex justify-center bg-[#1a1a1d]")}>
                <EditorContent editor={editor} className={cn("h-full", mode === "paper" && "w-full max-w-4xl bg-[#1e1e20] shadow-2xl min-h-screen my-4 rounded-xl")} />

                {/* Unified Context Bar (Replaces RefHunter & ToneTuner) */}
                <SmartContextBar editor={editor} projectId={projectId} isFlashcardMode={isFlashcardMode} />

                {/* Specific Flashcard Menu (Only active in Flashcard Mode) */}
                <FlashcardMenu editor={editor} projectId={projectId} isFlashcardMode={isFlashcardMode} />
            </div>

            {/* Tiptap prose styles */}
            <style jsx global>{`
                .ProseMirror {
                    min-height: 100%;
                    padding: ${mode === "paper" ? "3rem" : "1rem"};
                    color: #e4e4e7;
                }
                
                .ProseMirror p {
                    margin-bottom: 0.5rem;
                }
                
                .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
                    color: white;
                    font-weight: 700;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                }
                
                .ProseMirror h2 {
                    font-size: 1.25rem;
                }
                
                .ProseMirror ul, .ProseMirror ol {
                    padding-left: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .ProseMirror li {
                    margin-bottom: 0.25rem;
                }
                
                .ProseMirror strong {
                    color: #a3e635;
                    font-weight: 700;
                }
                
                .ProseMirror em {
                    color: #8b5cf6;
                }
                
                .ProseMirror mark {
                    background-color: transparent;
                    color: inherit;
                    border-radius: 0.125rem;
                    padding: 0 0.125rem;
                }

                .ProseMirror:focus {
                    outline: none;
                }
                
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #52525b;
                    content: "${placeholderText}";
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}
