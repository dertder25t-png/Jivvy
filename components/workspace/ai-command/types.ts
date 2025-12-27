/**
 * AI Command Center Types
 * Centralized type definitions for the AI command system
 */

import type { ChartData } from '@/utils/local-llm';

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sourcePages?: number[];
    chartData?: ChartData | null;
    timestamp: Date;
    isLoading?: boolean;
    isLowConfidence?: boolean;
    thinkingSteps?: ThinkingStep[];
}

export interface ThinkingStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    detail?: string;
}

// ============================================================================
// AI MODE TYPES
// ============================================================================

export type AIMode = 'quick' | 'thorough';
export type ToolMode = 'chat' | 'analyze';

export interface AIModelConfig {
    id: string;
    name: string;
    hfPath: string;
    maxContext: number;
    maxNewTokens: number;
    estimatedSize: string;
    description: string;
}

export const AI_MODELS: Record<AIMode, AIModelConfig> = {
    quick: {
        id: 'quick',
        name: 'Quick',
        hfPath: 'Xenova/Qwen1.5-0.5B-Chat',
        maxContext: 1200,
        maxNewTokens: 100,
        estimatedSize: '~500MB',
        description: 'Fast responses, good for simple lookups'
    },
    thorough: {
        id: 'thorough',
        name: 'Think More',
        hfPath: 'Xenova/Qwen2.5-1.5B-Instruct',
        maxContext: 15000,  // Increased from 8K to 15K for deep analysis
        maxNewTokens: 350,  // Increased for comprehensive answers
        estimatedSize: '~1.5GB',
        description: 'Deep analysis, multi-step reasoning with 15K context'
    }
};

// ============================================================================
// CHAPTER / OUTLINE TYPES
// ============================================================================

export interface OutlineItem {
    title: string;
    page: number;
    items: OutlineItem[];
}

export interface ChapterSelection {
    title: string;
    startPage: number;
    endPage: number | null;
}

export interface FlatChapter {
    title: string;
    page: number;
    depth: number;
    endPage?: number;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface MultiStageSearchOptions {
    mode: AIMode;
    filterPages?: Set<number>;
    options?: string[];
    forceAnswer?: boolean;
}

export interface SubQuestion {
    id: string;
    question: string;
    type: 'definition' | 'cause-effect' | 'location' | 'comparison' | 'procedure';
}

export interface EvidenceChain {
    optionLetter: string;
    optionText: string;
    evidenceType: 'explicit' | 'implied' | 'absent' | 'contradicted';
    score: number;
    sources: Array<{
        page: number;
        excerpt: string;
        confidence: number;
    }>;
}

export interface CrossReference {
    type: 'chapter' | 'figure' | 'table' | 'section';
    reference: string;
    page?: number;
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface ModelCacheStatus {
    modelId: string;
    cached: boolean;
    sizeBytes?: number;
    sizeFormatted?: string;
    lastAccessed?: Date;
}

export interface StorageEstimate {
    available: boolean;
    freeSpaceMB: number;
    freeSpaceFormatted: string;
    warning: string | null;
}

// ============================================================================
// PROGRESS TYPES
// ============================================================================

export interface ProgressCallback {
    (progress: { status: string; progress?: number }): void;
}

export interface DownloadProgress {
    modelId: string;
    status: 'idle' | 'downloading' | 'complete' | 'error';
    progress: number;
    error?: string;
}
