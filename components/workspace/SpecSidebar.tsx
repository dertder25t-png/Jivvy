"use client";

import { cn } from "@/lib/utils";
import { Check, Wand2, ChevronRight, Loader2, Sparkles, Plus, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { generateSpecSheet, type SpecItem } from "@/utils/local-ai-actions";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { AppError, createAppError, safeLogError, toAppError } from "@/lib/errors";

interface SpecSidebarProps {
    className?: string;
    pdfUrl?: string;
    onUpdate?: (specs: SpecItem[]) => void;
    specs?: SpecItem[];
}

const DEFAULT_SPECS: SpecItem[] = [
    { id: '1', label: "A3 Format (Portrait)", checked: true },
    { id: '2', label: "CMYK Color Mode", checked: false },
    { id: '3', label: "Include 3mm Bleed", checked: false },
    { id: '4', label: "Vector Logo (.ai/.eps)", checked: false },
    { id: '5', label: "Min 300dpi for Images", checked: false },
];

export function SpecSidebar({ className, pdfUrl, onUpdate }: SpecSidebarProps) {
    const [specs, setSpecs] = useState<SpecItem[]>(DEFAULT_SPECS);
    const [collapsed, setCollapsed] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState<AppError | null>(null);
    const [extracted, setExtracted] = useState(false);
    const [isAddingSpec, setIsAddingSpec] = useState(false);
    const [newSpecLabel, setNewSpecLabel] = useState("");

    const toggleSpec = (id: string) => {
        const newSpecs = specs.map(s => s.id === id ? { ...s, checked: !s.checked } : s);
        setSpecs(newSpecs);
        onUpdate?.(newSpecs);
    };

    const addManualSpec = () => {
        if (!newSpecLabel.trim()) return;
        const newSpec: SpecItem = {
            id: `manual-${Date.now()}`,
            label: newSpecLabel.trim(),
            checked: false,
        };
        const newSpecs = [...specs, newSpec];
        setSpecs(newSpecs);
        onUpdate?.(newSpecs);
        setNewSpecLabel("");
        setIsAddingSpec(false);
    };

    const deleteSpec = (id: string) => {
        const newSpecs = specs.filter(s => s.id !== id);
        setSpecs(newSpecs);
        onUpdate?.(newSpecs);
    };

    const handleExtractSpecs = async () => {
        if (!pdfUrl) {
            setError(createAppError('NO_PDF', 'Upload a PDF to extract specs', { retryable: false }));
            return;
        }

        setExtracting(true);
        setError(null);

        try {
            const result = await generateSpecSheet(pdfUrl);

            if (result.error) {
                setError(result.error);
            } else if (result.specs.length > 0) {
                setSpecs(result.specs);
                setExtracted(true);
                onUpdate?.(result.specs);
            } else {
                setError(createAppError('NO_SPECS_FOUND', 'No specs found in PDF', { retryable: false }));
            }
        } catch (err) {
            setError(toAppError(err, { code: 'SPEC_EXTRACT_FAILED', message: 'Failed to extract specs', retryable: true }));
            safeLogError('SpecSidebar.extract', err);
        }

        setExtracting(false);
    };

    return (
        <div className={cn(
            "h-full bg-surface border-l border-lime-500/20 transition-all duration-300 flex flex-col",
            collapsed ? "w-12" : "w-80",
            className
        )}>
            {/* Collapsed State */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="h-full w-full flex items-center justify-center hover:bg-zinc-900 transition-colors group"
                >
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-lime-400 rotate-180" />
                </button>
            )}

            {!collapsed && (
                <>
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Spec Sheet</h2>
                                {extracted && (
                                    <Sparkles size={12} className="text-lime-400" />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-lime-400/10 text-lime-400 px-2 py-0.5 rounded-full font-bold">
                                    {specs.filter(s => s.checked).length} / {specs.length}
                                </span>
                                <button
                                    onClick={() => setCollapsed(true)}
                                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        <button
                            className={cn(
                                "w-full flex items-center justify-center p-3 rounded-xl bg-lime-400 hover:bg-lime-500 text-zinc-900 transition-colors shadow-sm",
                                extracting && "opacity-70 cursor-not-allowed"
                            )}
                            onClick={handleExtractSpecs}
                            disabled={extracting}
                        >
                            <span className="text-xs font-bold flex items-center gap-2">
                                {extracting ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Analyzing PDF...
                                    </>
                                ) : (
                                    "Auto-Extract Specs"
                                )}
                            </span>
                            {!extracting && <Wand2 size={14} className="group-hover:animate-pulse" />}
                        </button>

                        {error && (
                            <ErrorNotice error={error} className="mt-2" />
                        )}

                        {extracted && !error && (
                            <p className="text-xs text-lime-400/70 mt-2 flex items-center gap-1">
                                <Check size={10} />
                                AI extracted {specs.length} specs
                            </p>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                        {specs.map(spec => (
                            <div
                                key={spec.id}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all group select-none",
                                    spec.checked
                                        ? "bg-lime-900/10 border-lime-500/30"
                                        : "bg-zinc-900/50 border-white/5 hover:border-white/10"
                                )}
                            >
                                <div
                                    onClick={() => toggleSpec(spec.id)}
                                    className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                        spec.checked
                                            ? "bg-lime-400 border-lime-400"
                                            : "border-zinc-600 group-hover:border-zinc-500"
                                    )}>
                                    {spec.checked && <Check size={12} className="text-black stroke-[3]" />}
                                </div>
                                <div className="flex-1 min-w-0" onClick={() => toggleSpec(spec.id)}>
                                    <span className={cn(
                                        "text-xs md:text-sm font-medium transition-colors leading-tight block truncate",
                                        spec.checked ? "text-white" : "text-zinc-400 group-hover:text-zinc-300"
                                    )}>
                                        {spec.label}
                                    </span>
                                    {spec.category && (
                                        <span className="text-xs text-zinc-600 uppercase tracking-wider block mt-0.5">
                                            {spec.category}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteSpec(spec.id); }}
                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}

                        {/* Add Spec Form */}
                        {isAddingSpec ? (
                            <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                <input
                                    type="text"
                                    value={newSpecLabel}
                                    onChange={(e) => setNewSpecLabel(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addManualSpec()}
                                    placeholder="Add requirement..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={addManualSpec}
                                    className="p-1.5 rounded-lg bg-lime-400/20 text-lime-400 hover:bg-lime-400/30 transition-colors"
                                >
                                    <Check size={12} />
                                </button>
                                <button
                                    onClick={() => { setIsAddingSpec(false); setNewSpecLabel(""); }}
                                    className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddingSpec(true)}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-lime-500/50 text-zinc-500 hover:text-lime-400 transition-colors"
                            >
                                <Plus size={14} />
                                <span className="text-xs font-medium">Add Requirement</span>
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
