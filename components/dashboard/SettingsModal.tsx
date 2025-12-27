"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Cpu, Lock, Zap, Sparkles, Brain, Download, Trash2, Check, Loader2, AlertTriangle, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getPreferredMode,
    setPreferredMode,
    getKeepBothCached,
    setKeepBothCached,
    isModelCached,
    preloadModel,
    clearModelCache,
    checkStorageSpace,
    MODEL_CONFIGS,
    type AIMode
} from "@/utils/local-llm";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const [grammarEnabled, setGrammarEnabled] = useState(false);
    const [mounted, setMounted] = useState(false);

    // AI Model states
    const [preferredMode, setPreferredModeState] = useState<AIMode>('quick');
    const [keepBoth, setKeepBoth] = useState(false);
    const [quickCached, setQuickCached] = useState(false);
    const [thoroughCached, setThoroughCached] = useState(false);
    const [downloadingModel, setDownloadingModel] = useState<AIMode | null>(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [storageInfo, setStorageInfo] = useState<{ freeSpaceFormatted: string; warning: string | null } | null>(null);

    useEffect(() => {
        setMounted(true);
        
        // Load grammar setting
        const stored = localStorage.getItem('jivvy-grammar-enabled');
        if (stored === 'true') {
            setGrammarEnabled(true);
        }

        // Load AI model settings
        setPreferredModeState(getPreferredMode());
        setKeepBoth(getKeepBothCached());

        // Check model cache status
        const checkCacheStatus = async () => {
            const quickStatus = await isModelCached('quick');
            const thoroughStatus = await isModelCached('thorough');
            setQuickCached(quickStatus);
            setThoroughCached(thoroughStatus);
        };
        checkCacheStatus();

        // Check storage
        checkStorageSpace().then(result => {
            setStorageInfo({
                freeSpaceFormatted: result.freeSpaceFormatted,
                warning: result.warning
            });
        });

        // Listen for download progress
        const handleProgress = (event: CustomEvent) => {
            const { modelId, status, progress } = event.detail;
            if (status === 'downloading') {
                setDownloadingModel(modelId);
                setDownloadProgress(progress);
            } else if (status === 'complete' || status === 'error') {
                setDownloadingModel(null);
                setDownloadProgress(0);
                checkCacheStatus();
            }
        };

        window.addEventListener('llm-download-progress', handleProgress as EventListener);
        return () => {
            window.removeEventListener('llm-download-progress', handleProgress as EventListener);
        };
    }, []);

    const toggleGrammar = () => {
        const newValue = !grammarEnabled;
        setGrammarEnabled(newValue);
        localStorage.setItem('jivvy-grammar-enabled', String(newValue));
        window.dispatchEvent(new CustomEvent('jivvy-settings-changed', {
            detail: { grammarEnabled: newValue }
        }));
    };

    const handleModeChange = (mode: AIMode) => {
        setPreferredModeState(mode);
        setPreferredMode(mode);
    };

    const handleKeepBothChange = () => {
        const newValue = !keepBoth;
        setKeepBoth(newValue);
        setKeepBothCached(newValue);
    };

    const handleDownloadModel = async (mode: AIMode) => {
        setDownloadingModel(mode);
        setDownloadProgress(0);
        await preloadModel(mode, (p) => {
            if (p.progress !== undefined) {
                setDownloadProgress(p.progress);
            }
        });
        setDownloadingModel(null);
        
        // Refresh cache status
        const quickStatus = await isModelCached('quick');
        const thoroughStatus = await isModelCached('thorough');
        setQuickCached(quickStatus);
        setThoroughCached(thoroughStatus);
    };

    const handleDeleteModel = async (mode: AIMode) => {
        await clearModelCache(mode);
        
        // Refresh cache status
        const quickStatus = await isModelCached('quick');
        const thoroughStatus = await isModelCached('thorough');
        setQuickCached(quickStatus);
        setThoroughCached(thoroughStatus);
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

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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

                    {/* AI Models Section */}
                    <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Brain size={16} className="text-violet-400" />
                            <h3 className="font-medium text-white">AI Models</h3>
                        </div>

                        {/* Storage Info */}
                        {storageInfo && (
                            <div className={cn(
                                "flex items-center gap-2 text-xs mb-4 p-2 rounded-lg",
                                storageInfo.warning ? "bg-amber-500/10 text-amber-400" : "bg-zinc-700/50 text-zinc-400"
                            )}>
                                {storageInfo.warning ? (
                                    <AlertTriangle size={12} />
                                ) : (
                                    <HardDrive size={12} />
                                )}
                                <span>{storageInfo.warning || `${storageInfo.freeSpaceFormatted} available`}</span>
                            </div>
                        )}

                        {/* Quick Model */}
                        <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/30 mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-lime-400" />
                                    <span className="text-sm font-medium text-white">Quick</span>
                                    {quickCached && (
                                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                                            <Check size={10} /> Downloaded
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-zinc-500">{MODEL_CONFIGS.quick.estimatedSizeMB}MB</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mb-2">
                                Fast responses for simple lookups and quick questions.
                            </p>
                            <div className="flex items-center gap-2">
                                {!quickCached ? (
                                    <button
                                        onClick={() => handleDownloadModel('quick')}
                                        disabled={downloadingModel !== null}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-lime-500/20 text-lime-300 rounded hover:bg-lime-500/30 disabled:opacity-50 transition-colors"
                                    >
                                        {downloadingModel === 'quick' ? (
                                            <>
                                                <Loader2 size={10} className="animate-spin" />
                                                {Math.round(downloadProgress)}%
                                            </>
                                        ) : (
                                            <>
                                                <Download size={10} /> Download
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleDeleteModel('quick')}
                                        disabled={downloadingModel !== null}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                                    >
                                        <Trash2 size={10} /> Delete
                                    </button>
                                )}
                                <button
                                    onClick={() => handleModeChange('quick')}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
                                        preferredMode === 'quick'
                                            ? "bg-lime-500/30 text-lime-300"
                                            : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                                    )}
                                >
                                    {preferredMode === 'quick' ? <Check size={10} /> : null}
                                    {preferredMode === 'quick' ? 'Default' : 'Set Default'}
                                </button>
                            </div>
                        </div>

                        {/* Think More Model */}
                        <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/30 mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Brain size={14} className="text-violet-400" />
                                    <span className="text-sm font-medium text-white">Think More</span>
                                    {thoroughCached && (
                                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                                            <Check size={10} /> Downloaded
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-zinc-500">{MODEL_CONFIGS.thorough.estimatedSizeMB}MB</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mb-2">
                                Deep analysis with multi-step reasoning for complex questions.
                            </p>
                            <div className="flex items-center gap-2">
                                {!thoroughCached ? (
                                    <button
                                        onClick={() => handleDownloadModel('thorough')}
                                        disabled={downloadingModel !== null}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-violet-500/20 text-violet-300 rounded hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
                                    >
                                        {downloadingModel === 'thorough' ? (
                                            <>
                                                <Loader2 size={10} className="animate-spin" />
                                                {Math.round(downloadProgress)}%
                                            </>
                                        ) : (
                                            <>
                                                <Download size={10} /> Download
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleDeleteModel('thorough')}
                                        disabled={downloadingModel !== null}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                                    >
                                        <Trash2 size={10} /> Delete
                                    </button>
                                )}
                                <button
                                    onClick={() => handleModeChange('thorough')}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
                                        preferredMode === 'thorough'
                                            ? "bg-violet-500/30 text-violet-300"
                                            : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                                    )}
                                >
                                    {preferredMode === 'thorough' ? <Check size={10} /> : null}
                                    {preferredMode === 'thorough' ? 'Default' : 'Set Default'}
                                </button>
                            </div>
                        </div>

                        {/* Keep Both Toggle */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
                            <div>
                                <p className="text-xs text-zinc-300">Keep both models cached</p>
                                <p className="text-[10px] text-zinc-500">Faster switching, uses more storage</p>
                            </div>
                            <button
                                onClick={handleKeepBothChange}
                                className={cn(
                                    "w-10 h-5 rounded-full relative transition-colors duration-300 flex-shrink-0",
                                    keepBoth ? "bg-violet-500" : "bg-zinc-700"
                                )}
                            >
                                <span className={cn(
                                    "absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm",
                                    keepBoth ? "translate-x-5" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                    </div>

                    {/* Grammar Check Section */}

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
