'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Brain, Check, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIMode, DownloadProgress } from './types';
import { AI_MODELS } from './types';
import {
    getPreferredMode,
    setPreferredMode,
    isModelCached
} from '@/utils/local-llm';

interface ModeToggleProps {
    disabled?: boolean;
    onModeChange?: (mode: AIMode) => void;
}

export function ModeToggle({ disabled, onModeChange }: ModeToggleProps) {
    const [mode, setMode] = useState<AIMode>('quick');
    const [quickCached, setQuickCached] = useState(false);
    const [thoroughCached, setThoroughCached] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

    // Load saved preference and cache status on mount
    useEffect(() => {
        const savedMode = getPreferredMode();
        setMode(savedMode);

        // Check cache status for both models
        const checkCache = async () => {
            const quickStatus = await isModelCached('quick');
            const thoroughStatus = await isModelCached('thorough');
            setQuickCached(quickStatus);
            setThoroughCached(thoroughStatus);
        };
        checkCache();

        // Listen for download progress updates
        const handleProgress = (event: CustomEvent<DownloadProgress>) => {
            setDownloadProgress(event.detail);
            if (event.detail.status === 'complete') {
                checkCache();
                setTimeout(() => setDownloadProgress(null), 2000);
            }
        };

        window.addEventListener('llm-download-progress', handleProgress as EventListener);
        return () => {
            window.removeEventListener('llm-download-progress', handleProgress as EventListener);
        };
    }, []);

    const handleModeChange = useCallback((newMode: AIMode) => {
        setMode(newMode);
        setPreferredMode(newMode);
        onModeChange?.(newMode);
    }, [onModeChange]);

    const isDownloading = downloadProgress?.status === 'downloading';
    const downloadingModel = downloadProgress?.modelId;

    return (
        <div className="flex items-center gap-1 p-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            {/* Quick Mode Button */}
            <button
                onClick={() => handleModeChange('quick')}
                disabled={disabled || isDownloading}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    mode === 'quick'
                        ? "bg-lime-500/20 text-lime-300 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50",
                    (disabled || isDownloading) && "opacity-50 cursor-not-allowed"
                )}
                title={`${AI_MODELS.quick.description} (${AI_MODELS.quick.estimatedSize})`}
            >
                {downloadingModel === 'quick' ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <Zap size={12} className={mode === 'quick' ? "fill-lime-400/30" : ""} />
                )}
                Quick
                {quickCached && mode !== 'quick' && (
                    <Check size={10} className="text-green-500" />
                )}
            </button>

            {/* Think More Button */}
            <button
                onClick={() => handleModeChange('thorough')}
                disabled={disabled || isDownloading}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    mode === 'thorough'
                        ? "bg-violet-500/20 text-violet-300 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50",
                    (disabled || isDownloading) && "opacity-50 cursor-not-allowed"
                )}
                title={`${AI_MODELS.thorough.description} (${AI_MODELS.thorough.estimatedSize})`}
            >
                {downloadingModel === 'thorough' ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <Brain size={12} className={mode === 'thorough' ? "fill-violet-400/30" : ""} />
                )}
                Think More
                {thoroughCached && mode !== 'thorough' && (
                    <Check size={10} className="text-green-500" />
                )}
                {!thoroughCached && mode !== 'thorough' && (
                    <Download size={10} className="text-zinc-500" />
                )}
            </button>

            {/* Download Progress Indicator */}
            {isDownloading && downloadProgress && (
                <div className="ml-2 flex items-center gap-2 text-[10px] text-zinc-400">
                    <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-lime-500 transition-all duration-300"
                            style={{ width: `${downloadProgress.progress}%` }}
                        />
                    </div>
                    <span>{Math.round(downloadProgress.progress)}%</span>
                </div>
            )}
        </div>
    );
}
