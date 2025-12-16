"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Cpu, Lock, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
// import { useSettingsStore } from "@/lib/store/settings";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const [grammarEnabled, setGrammarEnabled] = useState(false);
    // const { drawerPosition, setDrawerPosition } = useSettingsStore(); // Removed for auto responsive layout

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('jivvy-grammar-enabled');
        if (stored === 'true') {
            setGrammarEnabled(true);
        }
    }, []);

    const toggleGrammar = () => {
        const newValue = !grammarEnabled;
        setGrammarEnabled(newValue);
        localStorage.setItem('jivvy-grammar-enabled', String(newValue));
        window.dispatchEvent(new CustomEvent('jivvy-settings-changed', {
            detail: { grammarEnabled: newValue }
        }));
    };

    if (!open || !mounted) return null;

    // Use portal to ensure it's centered on screen regardless of parent transforms
    return createPortal(
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

                <div className="space-y-4">
                    {/* Plan Section */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles size={48} />
                        </div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div>
                                <h3 className="font-medium text-white flex items-center gap-2">
                                    <Zap size={16} className="text-amber-400" />
                                    Current Plan
                                </h3>
                                <p className="text-xs text-zinc-400 mt-1">You are on the <span className="text-white font-medium">Free Tier</span></p>
                            </div>
                            <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-bold text-zinc-300">
                                FREE
                            </span>
                        </div>

                        <button className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-lime-500 hover:from-lime-300 hover:to-lime-400 text-black font-bold rounded-lg transition-all shadow-lg shadow-lime-400/10 flex items-center justify-center gap-2 group-hover:scale-[1.02]">
                            <Sparkles size={16} className="fill-black/20" />
                            Upgrade to Pro
                        </button>
                    </div>

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
        </div>,
        document.body
    );
}
