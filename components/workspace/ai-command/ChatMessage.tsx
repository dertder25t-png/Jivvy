'use client';

import { Loader2, ExternalLink, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { DataVisualizer } from '../DataVisualizer';
import type { Message, ThinkingStep } from './types';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    message: Message;
    onJumpToPage: (page: number) => void;
    onEscalate?: (messageId: string, query: string) => void;
    onDismissLowConfidence?: (messageId: string) => void;
    previousUserMessage?: string;
}

export function ChatMessage({
    message,
    onJumpToPage,
    onEscalate,
    onDismissLowConfidence,
    previousUserMessage
}: ChatMessageProps) {
    const [showThinkingSteps, setShowThinkingSteps] = useState(false);
    const isUser = message.role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border",
                    isUser
                        ? "bg-primary/10 text-text-primary border-primary/20 rounded-br-md"
                        : "bg-surface-hover text-text-primary border-border rounded-bl-md"
                )}
            >
                {/* Loading State */}
                {message.isLoading ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-sm">Thinking...</span>
                        </div>

                        {/* Thinking Steps (for thorough mode) */}
                        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {message.thinkingSteps.map(step => (
                                    <ThinkingStepIndicator key={step.id} step={step} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Message Content */}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                        {/* Thinking Steps Toggle (completed) */}
                        {message.thinkingSteps && message.thinkingSteps.length > 0 && !message.isLoading && (
                            <button
                                onClick={() => setShowThinkingSteps(!showThinkingSteps)}
                                className="mt-2 flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                            >
                                {showThinkingSteps ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                {showThinkingSteps ? 'Hide' : 'Show'} reasoning steps
                            </button>
                        )}

                        {showThinkingSteps && message.thinkingSteps && (
                            <div className="mt-2 pl-2 border-l-2 border-border space-y-1">
                                {message.thinkingSteps.map(step => (
                                    <ThinkingStepIndicator key={step.id} step={step} compact />
                                ))}
                            </div>
                        )}

                        {/* Low Confidence Actions */}
                        {message.isLowConfidence && onEscalate && onDismissLowConfidence && (
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => {
                                        if (previousUserMessage) {
                                            onEscalate(message.id, previousUserMessage);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded-md transition-colors flex items-center gap-1"
                                >
                                    <Sparkles size={12} />
                                    Keep Searching
                                </button>
                                <button
                                    onClick={() => onDismissLowConfidence(message.id)}
                                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-secondary text-xs rounded-md transition-colors border border-border"
                                >
                                    Stop
                                </button>
                            </div>
                        )}

                        {/* Chart Visualization */}
                        {message.chartData && (
                            <div className="mt-3">
                                <DataVisualizer
                                    data={message.chartData}
                                    onViewSource={onJumpToPage}
                                />
                            </div>
                        )}

                        {/* Source Pages */}
                        {message.sourcePages && message.sourcePages.length > 0 && !message.chartData && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-xs text-zinc-500">Sources:</span>
                                {message.sourcePages.map(page => (
                                    <button
                                        key={page}
                                        onClick={() => onJumpToPage(page)}
                                        className="text-xs px-1.5 py-0.5 bg-lime-500/20 text-lime-300 rounded hover:bg-lime-500/30 transition-colors flex items-center gap-0.5"
                                    >
                                        p.{page}
                                        <ExternalLink size={8} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Sub-component for thinking step indicators
function ThinkingStepIndicator({ step, compact = false }: { step: ThinkingStep; compact?: boolean }) {
    const statusColors = {
        pending: 'text-zinc-500',
        active: 'text-lime-400',
        complete: 'text-green-500',
        error: 'text-red-400'
    };

    const statusIcons = {
        pending: '○',
        active: '◉',
        complete: '✓',
        error: '✗'
    };

    return (
        <div className={cn(
            "flex items-center gap-2",
            compact ? "text-[10px]" : "text-xs",
            statusColors[step.status]
        )}>
            <span className="font-mono">{statusIcons[step.status]}</span>
            <span className={step.status === 'active' ? 'animate-pulse' : ''}>
                {step.label}
            </span>
            {step.detail && (
                <span className="text-zinc-500 truncate">— {step.detail}</span>
            )}
        </div>
    );
}
