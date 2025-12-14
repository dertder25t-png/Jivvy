"use client";

import { useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";
import { Sparkles, Loader2, ExternalLink, X } from "lucide-react";
import { generateSearchQueries } from "@/app/ai/actions";
import { cn } from "@/lib/utils";

interface RefHunterMenuProps {
    editor: Editor;
}

export function RefHunterMenu({ editor }: RefHunterMenuProps) {
    const [loading, setLoading] = useState(false);
    const [queries, setQueries] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState("");
    const menuRef = useRef<HTMLDivElement>(null);

    // Track selection changes
    useEffect(() => {
        const updateMenu = () => {
            const { from, to } = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection && !showResults && !loading) {
                // Get selection coordinates
                const { view } = editor;
                const start = view.coordsAtPos(from);
                const end = view.coordsAtPos(to);
                const text = editor.state.doc.textBetween(from, to, " ");

                // Position above the selection
                setPosition({
                    top: start.top - 50,
                    left: (start.left + end.left) / 2 - 50,
                });
                setSelectedText(text);
                setIsVisible(true);
            } else if (!hasSelection && !showResults && !loading) {
                setIsVisible(false);
                resetState();
            }
        };

        // Listen to selection updates
        editor.on("selectionUpdate", updateMenu);

        return () => {
            editor.off("selectionUpdate", updateMenu);
        };
    }, [editor, showResults, loading]);

    const handleFindRefs = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("[RefHunter] Button clicked, selected text:", selectedText);

        if (!selectedText.trim()) {
            console.log("[RefHunter] No text, aborting");
            return;
        }

        setLoading(true);
        setError(null);
        console.log("[RefHunter] Starting AI query...");

        try {
            const result = await generateSearchQueries(selectedText);
            console.log("[RefHunter] AI Result:", result);

            if (result.error) {
                console.log("[RefHunter] Error from AI:", result.error);
                setError(result.error);
                setLoading(false);
            } else if (result.queries.length > 0) {
                console.log("[RefHunter] Got queries:", result.queries);
                setQueries(result.queries);
                setShowResults(true);
                setLoading(false);
            } else {
                console.log("[RefHunter] No queries returned");
                setError("No search queries generated");
                setLoading(false);
            }
        } catch (err) {
            console.error("[RefHunter] Exception:", err);
            setError("Failed to generate search queries");
            setLoading(false);
        }
    };

    const openSearch = (query: string, platform: "behance" | "pinterest") => {
        const encodedQuery = encodeURIComponent(query);
        const url = platform === "behance"
            ? `https://www.behance.net/search/projects?search=${encodedQuery}`
            : `https://www.pinterest.com/search/pins/?q=${encodedQuery}`;
        window.open(url, "_blank");
    };

    const resetState = () => {
        setQueries([]);
        setShowResults(false);
        setError(null);
        setSelectedText("");
    };

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsVisible(false);
        resetState();
    };

    if (!isVisible) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] animate-in fade-in zoom-in-95 duration-150"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
        >
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden">
                {/* Initial State - Find Refs Button */}
                {!showResults && !loading && !error && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleFindRefs}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-lime-400 hover:bg-zinc-800/50 transition-all active:scale-95"
                    >
                        <Sparkles size={14} className="text-lime-400" />
                        Find Refs
                    </button>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400">
                        <Loader2 size={14} className="animate-spin text-lime-400" />
                        Searching...
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="px-4 py-2.5 text-sm text-red-400 flex items-center gap-2">
                        {error}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleClose}
                            className="ml-2 hover:text-white"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}

                {/* Results State */}
                {showResults && queries.length > 0 && (
                    <div className="p-3 space-y-2 min-w-[280px]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                                Design References
                            </span>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleClose}
                                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>

                        {queries.map((query, index) => (
                            <div
                                key={index}
                                className="bg-zinc-800/50 rounded-xl p-2.5 hover:bg-zinc-800 transition-colors"
                            >
                                <p className="text-xs text-zinc-300 mb-2 line-clamp-1">
                                    {query}
                                </p>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => openSearch(query, "behance")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95",
                                            "bg-[#1769ff]/10 text-[#1769ff] hover:bg-[#1769ff]/20"
                                        )}
                                    >
                                        <ExternalLink size={10} />
                                        Behance
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openSearch(query, "pinterest")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95",
                                            "bg-[#e60023]/10 text-[#e60023] hover:bg-[#e60023]/20"
                                        )}
                                    >
                                        <ExternalLink size={10} />
                                        Pinterest
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
