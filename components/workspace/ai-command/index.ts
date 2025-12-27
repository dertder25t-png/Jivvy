/**
 * AI Command Center Module
 * 
 * Exports:
 * - AICommandCenter: Main component
 * - ModeToggle: Quick/Think More toggle
 * - ChapterDropdown: PDF chapter selection
 * - ChatMessage: Message rendering component
 * - MultiStageSearch utilities
 * - Types
 */

export { AICommandCenter } from './AICommandCenter';
export { ModeToggle } from './ModeToggle';
export { ChapterDropdown } from './ChapterDropdown';
export { ChatMessage } from './ChatMessage';

export {
    runMultiStageSearch,
    decomposeQuestion,
    gatherExpandedContext,
    buildEvidenceChains,
    detectCrossReferences
} from './MultiStageSearch';

export type {
    Message,
    ThinkingStep,
    AIMode,
    ToolMode,
    AIModelConfig,
    OutlineItem,
    ChapterSelection,
    FlatChapter,
    MultiStageSearchOptions,
    SubQuestion,
    EvidenceChain,
    CrossReference,
    ModelCacheStatus,
    StorageEstimate,
    ProgressCallback,
    DownloadProgress
} from './types';

export { AI_MODELS } from './types';
