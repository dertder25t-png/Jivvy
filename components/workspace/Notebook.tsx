"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Bold, Italic, List, ListOrdered, Heading2, Save, Loader2, SquareStack } from "lucide-react";
import { FlashcardMenu } from "./FlashcardMenu";
import { SmartContextBar } from "./SmartContextBar";
import Highlight from "@tiptap/extension-highlight";
import DOMPurify from "isomorphic-dompurify";

interface NotebookProps {
    className?: string;
    projectId?: string;
    initialContent?: string;
    onSave?: (content: string) => Promise<void>;
}

export function Notebook({ className, projectId, initialContent = "", onSave }: NotebookProps) {
    // Sanitize initial content to prevent XSS
    const sanitizedInitialContent = useMemo(() => {
        return DOMPurify.sanitize(initialContent);
    }, [initialContent]);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isFlashcardMode, setIsFlashcardMode] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: sanitizedInitialContent || "<p>Start taking notes...</p>",
        immediatelyRender: false, // Fix for SSR hydration mismatch
        editorProps: {
            attributes: {
                class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
            },
        },
    });

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
        <div className={cn("flex flex-col h-full bg-zinc-900/50 rounded-2xl border border-white/5 overflow-hidden", className)}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-zinc-900/80">
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
                <div className="w-px h-4 bg-zinc-700 mx-1" />
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

                {/* Flashcard Mode Toggle */}
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
                    {isFlashcardMode ? "Flashcard Mode" : "Cards"}
                </button>

                {/* Save button */}
                {onSave && (
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? "Saving..." : "Save"}
                    </button>
                )}

                {lastSaved && (
                    <span className="text-[10px] text-zinc-600 px-2">
                        Saved {lastSaved.toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto">
                <EditorContent editor={editor} className="h-full" />

                {/* Unified Context Bar (Replaces RefHunter & ToneTuner) */}
                <SmartContextBar editor={editor} projectId={projectId} isFlashcardMode={isFlashcardMode} />

                {/* Specific Flashcard Menu (Only active in Flashcard Mode) */}
                <FlashcardMenu editor={editor} projectId={projectId} isFlashcardMode={isFlashcardMode} />
            </div>

            {/* Tiptap prose styles */}
            <style jsx global>{`
                .ProseMirror {
                    min-height: 100%;
                    padding: 1rem;
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
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}
