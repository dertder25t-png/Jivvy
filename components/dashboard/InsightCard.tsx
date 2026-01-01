'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, type AnalyticsConcept, type Block } from '@/lib/db';
import { superLearnEffectiveScore, SUPERLEARN_WEAK_THRESHOLD, SUPERLEARN_STRONG_THRESHOLD } from '@/utils/analytics/super-learn-scoring';
import { Lightbulb, ChevronRight, BookOpen, Brain, AlertCircle, TrendingUp, ChevronDown, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface InsightData {
    type: 'weak_concepts' | 'strong_concepts' | 'review_needed' | 'good_progress' | 'no_data';
    title: string;
    message: string;
    actionLabel?: string;
    actionTarget?: string; // block ID or project ID to navigate to
    concepts?: ConceptWithProvenance[];
    severity: 'info' | 'warning' | 'success';
}

export interface ConceptWithProvenance {
    concept: string;
    score: number;
    effectiveScore: number;
    sources: Array<{
        lectureId: string;
        blockId: string;
        excerpt: string;
    }>;
}

export interface InsightExplainabilityProps {
    insight: InsightData;
    onClose: () => void;
    onNavigateToBlock?: (blockId: string) => void;
}

// ============================================================================
// INSIGHT GENERATION
// ============================================================================

async function generateInsight(projectId: string): Promise<InsightData> {
    try {
        const concepts = await db.analytics_concepts
            .where('project_id')
            .equals(projectId)
            .toArray();

        if (!concepts || concepts.length === 0) {
            return {
                type: 'no_data',
                title: 'Get Started',
                message: 'Add lecture notes to unlock personalized study insights.',
                severity: 'info',
            };
        }

        const now = Date.now();
        const withScores = concepts.map(c => ({
            ...c,
            effectiveScore: superLearnEffectiveScore(c.score ?? 0, c.last_seen_at ?? c.updated_at ?? now, now),
        }));

        // Find weak concepts
        const weakConcepts = withScores
            .filter(c => c.effectiveScore < SUPERLEARN_WEAK_THRESHOLD)
            .sort((a, b) => a.effectiveScore - b.effectiveScore);

        // Find strong concepts
        const strongConcepts = withScores
            .filter(c => c.effectiveScore >= SUPERLEARN_STRONG_THRESHOLD)
            .sort((a, b) => b.effectiveScore - a.effectiveScore);

        // Generate insight based on the data
        if (weakConcepts.length >= 3) {
            const topWeak = weakConcepts.slice(0, 5).map(c => ({
                concept: c.concept,
                score: c.score,
                effectiveScore: c.effectiveScore,
                sources: (c.sources || []).map(s => ({
                    lectureId: s.lecture_id,
                    blockId: s.block_id,
                    excerpt: s.excerpt,
                })),
            }));

            return {
                type: 'weak_concepts',
                title: 'Focus Areas',
                message: `You have ${weakConcepts.length} concepts that need review. Start with "${weakConcepts[0].concept}" for the biggest impact.`,
                actionLabel: 'Start Review',
                actionTarget: weakConcepts[0].sources?.[0]?.block_id,
                concepts: topWeak,
                severity: 'warning',
            };
        }

        if (strongConcepts.length > concepts.length / 2) {
            return {
                type: 'good_progress',
                title: 'Great Progress!',
                message: `You've mastered ${strongConcepts.length} of ${concepts.length} concepts. Keep it up!`,
                concepts: strongConcepts.slice(0, 3).map(c => ({
                    concept: c.concept,
                    score: c.score,
                    effectiveScore: c.effectiveScore,
                    sources: (c.sources || []).map(s => ({
                        lectureId: s.lecture_id,
                        blockId: s.block_id,
                        excerpt: s.excerpt,
                    })),
                })),
                severity: 'success',
            };
        }

        if (weakConcepts.length > 0) {
            return {
                type: 'review_needed',
                title: 'Review Time',
                message: `"${weakConcepts[0].concept}" could use some attention. A quick review session would help.`,
                actionLabel: 'Review Now',
                actionTarget: weakConcepts[0].sources?.[0]?.block_id,
                concepts: weakConcepts.slice(0, 3).map(c => ({
                    concept: c.concept,
                    score: c.score,
                    effectiveScore: c.effectiveScore,
                    sources: (c.sources || []).map(s => ({
                        lectureId: s.lecture_id,
                        blockId: s.block_id,
                        excerpt: s.excerpt,
                    })),
                })),
                severity: 'info',
            };
        }

        return {
            type: 'strong_concepts',
            title: 'Well Prepared',
            message: 'Your knowledge is solid across all tracked concepts.',
            concepts: strongConcepts.slice(0, 3).map(c => ({
                concept: c.concept,
                score: c.score,
                effectiveScore: c.effectiveScore,
                sources: (c.sources || []).map(s => ({
                    lectureId: s.lecture_id,
                    blockId: s.block_id,
                    excerpt: s.excerpt,
                })),
            })),
            severity: 'success',
        };
    } catch (error) {
        console.error('[InsightCard] Failed to generate insight:', error);
        return {
            type: 'no_data',
            title: 'Unable to Load',
            message: 'Could not load study insights. Try refreshing.',
            severity: 'info',
        };
    }
}

// ============================================================================
// INSIGHT EXPLAINABILITY MODAL
// ============================================================================

export function InsightExplainability({ insight, onClose, onNavigateToBlock }: InsightExplainabilityProps) {
    const [expandedConcept, setExpandedConcept] = useState<string | null>(null);

    if (!insight.concepts || insight.concepts.length === 0) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-text-primary">Why this insight?</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    <p className="text-sm text-text-secondary mb-4">
                        This insight is based on your performance with these concepts:
                    </p>

                    <div className="space-y-3">
                        {insight.concepts.map((concept, idx) => (
                            <div
                                key={concept.concept}
                                className="border border-border rounded-xl overflow-hidden"
                            >
                                {/* Concept Header */}
                                <button
                                    onClick={() => setExpandedConcept(
                                        expandedConcept === concept.concept ? null : concept.concept
                                    )}
                                    className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-text-secondary">
                                            #{idx + 1}
                                        </span>
                                        <span className="font-medium text-text-primary">
                                            {concept.concept}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ScoreBadge score={concept.effectiveScore} />
                                        <ChevronDown
                                            className={cn(
                                                "w-4 h-4 text-text-secondary transition-transform",
                                                expandedConcept === concept.concept && "rotate-180"
                                            )}
                                        />
                                    </div>
                                </button>

                                {/* Expanded Sources */}
                                {expandedConcept === concept.concept && (
                                    <div className="border-t border-border bg-zinc-50 dark:bg-zinc-800/30 p-3">
                                        <p className="text-xs text-text-secondary mb-2 font-medium">
                                            Source Material:
                                        </p>
                                        {concept.sources.length > 0 ? (
                                            <div className="space-y-2">
                                                {concept.sources.slice(0, 3).map((source, sIdx) => (
                                                    <div
                                                        key={`${source.blockId}-${sIdx}`}
                                                        className="flex items-start gap-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-border/50"
                                                    >
                                                        <BookOpen className="w-3.5 h-3.5 text-text-secondary mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-text-primary line-clamp-2">
                                                                "{source.excerpt}"
                                                            </p>
                                                            {onNavigateToBlock && (
                                                                <button
                                                                    onClick={() => onNavigateToBlock(source.blockId)}
                                                                    className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    Go to source
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-text-secondary italic">
                                                No source excerpts available
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Score Legend */}
                    <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                        <p className="text-xs font-medium text-text-secondary mb-2">Score Guide:</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-text-secondary">Needs review (&lt;40%)</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-text-secondary">Developing (40-80%)</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-text-secondary">Mastered (&gt;80%)</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// SCORE BADGE COMPONENT
// ============================================================================

function ScoreBadge({ score }: { score: number }) {
    const percentage = Math.round(score * 100);
    const color = score < SUPERLEARN_WEAK_THRESHOLD
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : score >= SUPERLEARN_STRONG_THRESHOLD
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

    return (
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", color)}>
            {percentage}%
        </span>
    );
}

// ============================================================================
// MAIN INSIGHT CARD COMPONENT
// ============================================================================

export interface InsightCardProps {
    projectId: string;
    onNavigateToBlock?: (blockId: string) => void;
    className?: string;
}

export function InsightCard({ projectId, onNavigateToBlock, className }: InsightCardProps) {
    const [insight, setInsight] = useState<InsightData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showExplain, setShowExplain] = useState(false);

    const loadInsight = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        const data = await generateInsight(projectId);
        setInsight(data);
        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        loadInsight();
    }, [loadInsight]);

    if (loading) {
        return (
            <div className={cn("p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-border animate-pulse", className)}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                    <div className="flex-1">
                        <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
                        <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!insight) return null;

    const iconMap = {
        weak_concepts: <AlertCircle className="w-5 h-5" />,
        strong_concepts: <TrendingUp className="w-5 h-5" />,
        review_needed: <BookOpen className="w-5 h-5" />,
        good_progress: <TrendingUp className="w-5 h-5" />,
        no_data: <Lightbulb className="w-5 h-5" />,
    };

    const bgMap = {
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
        success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    };

    const iconColorMap = {
        info: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50',
        warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
        success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50',
    };

    return (
        <>
            <div className={cn(
                "p-4 rounded-2xl border transition-all",
                bgMap[insight.severity],
                className
            )}>
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        iconColorMap[insight.severity]
                    )}>
                        {iconMap[insight.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary text-sm">
                            {insight.title}
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                            {insight.message}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3">
                            {insight.actionLabel && insight.actionTarget && onNavigateToBlock && (
                                <button
                                    onClick={() => onNavigateToBlock(insight.actionTarget!)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                                >
                                    {insight.actionLabel}
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {insight.concepts && insight.concepts.length > 0 && (
                                <button
                                    onClick={() => setShowExplain(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-border rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors"
                                >
                                    <Brain className="w-3.5 h-3.5" />
                                    Why this insight?
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Explainability Modal */}
            {showExplain && insight && (
                <InsightExplainability
                    insight={insight}
                    onClose={() => setShowExplain(false)}
                    onNavigateToBlock={onNavigateToBlock}
                />
            )}
        </>
    );
}

// ============================================================================
// SIMPLE ONE-SENTENCE INSIGHT (For Dashboard)
// ============================================================================

export interface OneSentenceInsightProps {
    projectId?: string;
    className?: string;
}

export function OneSentenceInsight({ projectId, className }: OneSentenceInsightProps) {
    const [message, setMessage] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // If no project specified, get insights across all projects
                if (!projectId) {
                    const allConcepts = await db.analytics_concepts.toArray();
                    if (allConcepts.length === 0) {
                        setMessage('Add lecture notes to unlock study insights.');
                        return;
                    }

                    const now = Date.now();
                    const weakCount = allConcepts.filter(c => {
                        const effective = superLearnEffectiveScore(c.score ?? 0, c.last_seen_at ?? c.updated_at ?? now, now);
                        return effective < SUPERLEARN_WEAK_THRESHOLD;
                    }).length;

                    if (weakCount > 0) {
                        setMessage(`${weakCount} concept${weakCount > 1 ? 's' : ''} need${weakCount === 1 ? 's' : ''} your attention.`);
                    } else {
                        setMessage('Great work! All concepts are on track.');
                    }
                } else {
                    const insight = await generateInsight(projectId);
                    setMessage(insight.message);
                }
            } catch (error) {
                console.error('[OneSentenceInsight] Error:', error);
                setMessage('Unable to load insights.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [projectId]);

    if (loading) {
        return (
            <div className={cn("h-5 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse", className)} />
        );
    }

    return (
        <p className={cn("text-sm text-text-secondary", className)}>
            <Lightbulb className="w-4 h-4 inline-block mr-1.5 text-amber-500" />
            {message}
        </p>
    );
}

export default InsightCard;
