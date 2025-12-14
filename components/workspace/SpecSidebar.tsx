"use client";

import { cn } from "@/lib/utils";
import { Check, Wand2, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { GummyButton } from "@/components/ui/GummyButton";
import { generateSpecSheet, type SpecItem } from "@/app/ai/actions";

interface SpecSidebarProps {
    className?: string;
    pdfUrl?: string;
    onSpecsChange?: (specs: SpecItem[]) => void;
}

const DEFAULT_SPECS: SpecItem[] = [
    { id: '1', label: "A3 Format (Portrait)", checked: true },
    { id: '2', label: "CMYK Color Mode", checked: false },
    { id: '3', label: "Include 3mm Bleed", checked: false },
    { id: '4', label: "Vector Logo (.ai/.eps)", checked: false },
    { id: '5', label: "Min 300dpi for Images", checked: false },
];

export function SpecSidebar({ className, pdfUrl, onSpecsChange }: SpecSidebarProps) {
    const [specs, setSpecs] = useState<SpecItem[]>(DEFAULT_SPECS);
    const [collapsed, setCollapsed] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extracted, setExtracted] = useState(false);

    const toggleSpec = (id: string) => {
        const newSpecs = specs.map(s => s.id === id ? { ...s, checked: !s.checked } : s);
        setSpecs(newSpecs);
        onSpecsChange?.(newSpecs);
    };

    const handleExtractSpecs = async () => {
        if (!pdfUrl) {
            setError("Upload a PDF to extract specs");
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
                onSpecsChange?.(result.specs);
            } else {
                setError("No specs found in PDF");
            }
        } catch (err) {
            setError("Failed to extract specs");
            console.error(err);
        }

        setExtracting(false);
    };

    return (
        <div className={cn(
            "h-full bg-[#18181b] border-l border-white/5 transition-all duration-300 flex flex-col relative",
            collapsed ? "w-12" : "w-80",
            className
        )}>
            {/* Toggle Handle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -left-3 top-6 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center z-20 hover:bg-zinc-700 transition-colors shadow-lg"
            >
                <ChevronRight size={14} className={cn("text-zinc-400 transition-transform", collapsed ? "rotate-180" : "")} />
            </button>

            {!collapsed && (
                <>
                    <div className="p-6 border-b border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Spec Sheet</h2>
                                {extracted && (
                                    <Sparkles size={12} className="text-lime-400" />
                                )}
                            </div>
                            <span className="text-xs bg-lime-400/10 text-lime-400 px-2 py-0.5 rounded-full font-bold">
                                {specs.filter(s => s.checked).length} / {specs.length}
                            </span>
                        </div>

                        <GummyButton
                            variant="solid"
                            className={cn(
                                "w-full justify-center group bg-lime-400 hover:bg-lime-300 text-black shadow-lg shadow-lime-400/10 border-none",
                                extracting && "pointer-events-none opacity-70"
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
                        </GummyButton>

                        {error && (
                            <p className="text-xs text-red-400 mt-2">{error}</p>
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
                                onClick={() => toggleSpec(spec.id)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all group select-none",
                                    spec.checked
                                        ? "bg-lime-900/10 border-lime-500/30"
                                        : "bg-zinc-900/50 border-white/5 hover:border-white/10"
                                )}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                    spec.checked
                                        ? "bg-lime-400 border-lime-400"
                                        : "border-zinc-600 group-hover:border-zinc-500"
                                )}>
                                    {spec.checked && <Check size={12} className="text-black stroke-[3]" />}
                                </div>
                                <div className="flex-1 min-w-0">
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
                            </div>
                        ))}
                    </div>
                </>
            )}

            {collapsed && (
                <div className="flex-1 flex flex-col items-center py-6 gap-4">
                    <span className="text-xs font-bold text-zinc-500 writing-vertical-rl rotate-180 tracking-widest uppercase">
                        Specifications
                    </span>
                    <div className="w-1 h-1 rounded-full bg-lime-400" />
                </div>
            )}
        </div>
    );
}
