"use client";

import React, { useEffect, useState } from "react";
import { X, Cpu, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const [grammarEnabled, setGrammarEnabled] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('jivvy-grammar-enabled');
        if (stored === 'true') {
            setGrammarEnabled(true);
        }
    }, []);

    const toggleGrammar = () => {
        const newValue = !grammarEnabled;
        setGrammarEnabled(newValue);
        localStorage.setItem('jivvy-grammar-enabled', String(newValue));
        // Force a page reload or event dispatch to notify components?
        // Since Notebook reads on mount/render, simpler to rely on state lift or context.
        // But for this task, I'll dispatch a custom event.
        window.dispatchEvent(new CustomEvent('jivvy-settings-changed', {
            detail: { grammarEnabled: newValue }
        }));
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-6 relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    Settings
                </h2>

                <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-white">AI Grammar Check</h3>
                                    <span className="text-[10px] font-bold bg-lime-400/10 text-lime-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                        Beta
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                                    Runs completely locally in your browser using WebAssembly.
                                    Privacy-focused: no text leaves your device.
                                </p>
                                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                    <span className="flex items-center gap-1">
                                        <Cpu size={12} /> Local Inference
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Lock size={12} /> Private
                                    </span>
                                    <span>~40MB Download</span>
                                </div>
                            </div>

                            <button
                                onClick={toggleGrammar}
                                className={cn(
                                    "w-12 h-6 rounded-full relative transition-colors duration-300 flex-shrink-0",
                                    grammarEnabled ? "bg-lime-400" : "bg-zinc-700"
                                )}
                            >
                                <span className={cn(
                                    "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm",
                                    grammarEnabled ? "translate-x-6" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
