'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Send, Loader2, MessageSquare, BarChart3,
    Cpu, AlertCircle, Sparkles, Wrench, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pdfWorker } from '@/utils/pdf-extraction';
import { SmartSearchEngine, smartSearch } from '@/utils/smart-search';
// ModeToggle removed
import { ChapterDropdown } from './ChapterDropdown';
import { ChatMessage } from './ChatMessage';
import { runMultiStageSearch } from './MultiStageSearch';
import { getPreferredMode, ensureModelLoaded, checkStorageSpace } from '@/utils/local-llm';
import type { ChartData } from '@/utils/local-llm';
import type { Message, ThinkingStep, ToolMode, ChapterSelection } from './types';
import { useProjectStore } from '@/lib/store';

interface AICommandCenterProps {
    pdfBuffer: ArrayBuffer | null;
    onJumpToPage: (page: number) => void;
    initialMessages?: Message[];
    onMessagesChange?: (messages: Message[]) => void;
}

export function AICommandCenter({ pdfBuffer, onJumpToPage, initialMessages = [], onMessagesChange }: AICommandCenterProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');
    const [toolMode, setToolMode] = useState<ToolMode>('chat');
    const [showToolMenu, setShowToolMenu] = useState(false);
    const [chapterSelection, setChapterSelection] = useState<ChapterSelection[]>([]);
    const [workerStatus, setWorkerStatus] = useState({ message: '', percent: 0 });
    const [storageWarning, setStorageWarning] = useState<string | null>(null);
    const [modelLoading, setModelLoading] = useState(false);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [focusRequired, setFocusRequired] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const onMessagesChangeRef = useRef<AICommandCenterProps['onMessagesChange']>(onMessagesChange);

    const setPdfHighlightRanges = useProjectStore(s => s.setPdfHighlightRanges);

    // Increased timeout to accommodate NLI model loading (first run can be slow)
    const TIME_BUDGET_MS = 60000;

    const extractQuizLetter = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const trimmed = String(raw).trim();
        // Match standalone A-H even inside strings like "Answer: A" or "**A**".
        const m = trimmed.match(/(?:^|\b)([A-H])(?:\b|$)/i);
        return m?.[1]?.toUpperCase() ?? null;
    };

    const formatQuizAnswerContent = (
        quiz: ReturnType<typeof SmartSearchEngine.detectQuizQuestion>,
        rawAnswer: string,
        explanation?: string
    ) => {
        const letter = extractQuizLetter(rawAnswer);
        if (!quiz.isQuiz || !letter) {
            return rawAnswer || explanation || '';
        }
        const selected = quiz.options.find(o => o.letter.toUpperCase() === letter);
        const label = selected ? `${letter} — ${selected.text}` : letter;
        const expl = explanation ?? '';
        return expl ? `**Answer: ${label}**\n\n${expl}` : `**Answer: ${label}**`;
    };

    class TimeoutError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'TimeoutError';
        }
    }

    const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new TimeoutError(`Timed out after ${ms}ms`)), ms);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
        }
    };

    // Initialize Worker Listeners and Index
    useEffect(() => {
        if (!pdfBuffer) return;

        // Initialize the PDF index
        pdfWorker.initIndex(pdfBuffer);

        // Get total pages from worker
        const checkPages = async () => {
            const outline = pdfWorker.getOutline();
            // The outline may not be ready immediately, so we wait for the INDEX_READY event
            const handler = (data: { message: string }) => {
                if (data.message.includes('Index built for')) {
                    const match = data.message.match(/(\d+) pages/);
                    if (match) {
                        const pages = parseInt(match[1], 10);
                        setTotalPages(pages);
                        setFocusRequired(pages > 75);
                    }
                }
            };
            pdfWorker.on('info', handler as any);
            
            return () => {
                pdfWorker.off('info', handler as any);
            };
        };
        checkPages();

        // Listen for progress
        const onProgress = (data: { message: string, percent: number }) => {
            setWorkerStatus({ message: data.message, percent: data.percent });
            if (data.percent === 100) {
                setTimeout(() => setWorkerStatus(prev => ({ ...prev, message: 'Ready' })), 2000);
            }
        };

        const onInfo = (data: { message: string }) => {
            setWorkerStatus(prev => ({ ...prev, message: data.message }));
        };

        pdfWorker.on('progress', onProgress);
        pdfWorker.on('info', onInfo);

        return () => {
            pdfWorker.off('progress', onProgress);
            pdfWorker.off('info', onInfo);
        };
    }, [pdfBuffer]);

    // Check storage on mount
    useEffect(() => {
        checkStorageSpace().then(result => {
            if (result.warning) {
                setStorageWarning(result.warning);
            }
        });

        // Cleanup on unmount
        return () => {
            import('@/utils/local-llm').then(({ unloadCurrentModel }) => {
                unloadCurrentModel();
            });
        };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Notify parent of message changes
    useEffect(() => {
        onMessagesChangeRef.current = onMessagesChange;
    }, [onMessagesChange]);

    const lastNotifiedMessagesRef = useRef<Message[] | null>(null);
    useEffect(() => {
        if (!onMessagesChangeRef.current) return;
        // Avoid redundant notify calls if React replays effects.
        if (lastNotifiedMessagesRef.current === messages) return;
        lastNotifiedMessagesRef.current = messages;
        onMessagesChangeRef.current(messages);
    }, [messages]);

    // Drive PDF highlighting from chapter selection
    useEffect(() => {
        if (chapterSelection.length === 0) {
            setPdfHighlightRanges([]);
            return;
        }

        setPdfHighlightRanges(
            chapterSelection.map(c => ({
                startPage: c.startPage,
                endPage: c.endPage ?? null
            }))
        );
    }, [chapterSelection, setPdfHighlightRanges]);

    /**
     * Convert chapter selection to page filter
     */
    const getPageFilter = useCallback((): Set<number> | undefined => {
        if (chapterSelection.length === 0) return undefined;

        const pages = new Set<number>();
        
        for (const chapter of chapterSelection) {
            const endPage = chapter.endPage ?? chapter.startPage + 30;
            for (let i = chapter.startPage; i <= endPage; i++) {
                pages.add(i);
            }
        }
        
        return pages;
    }, [chapterSelection]);

    /**
     * Update thinking steps for a message
     */
    const updateThinkingSteps = useCallback((messageId: string, steps: ThinkingStep[]) => {
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, thinkingSteps: steps } : m
        ));
    }, []);

    /**
     * Scout Phase: Find relevant pages
     */
    const scoutPages = useCallback(async (query: string): Promise<{ pages: number[]; context: string }> => {
        if (!pdfBuffer) return { pages: [], context: '' };

        setStatus('Searching document...');

        const candidates = await pdfWorker.searchCandidates(query);

        if (candidates.length === 0) {
            return { pages: [], context: '' };
        }

        const pages = candidates.map(c => c.page);
        const context = candidates.map(c => `[Page ${c.page}]\n${c.text}`).join('\n\n');

        return { pages, context };
    }, [pdfBuffer]);

    /**
     * Analyst Phase: Generate answer or chart
     */
    const analyzeContent = async (
        query: string,
        context: string,
        pages: number[],
        mode: ToolMode
    ): Promise<{ answer: string; chartData?: ChartData | null }> => {
        if (mode === 'analyze') {
            setStatus('Analyzing data patterns...');
            const { analyzeDataset } = await import('@/utils/local-llm');
            const chartData = await analyzeDataset(context, query, pages, (p) => setStatus(p.status));

            if (chartData) {
                return {
                    answer: `📊 Found ${chartData.labels.length} data points. ${chartData.summary}`,
                    chartData
                };
            }
            return { answer: 'No numerical data found in the selected pages. Try asking a question instead.', chartData: null };
        } else {
            setStatus('Generating answer...');
            const { answerQuestionLocal } = await import('@/utils/local-llm');
            const answer = await answerQuestionLocal(
                query,
                context.slice(0, 5000),
                (p) => setStatus(p.status)
            );
            return { answer, chartData: null };
        }
    };

    /**
     * Handle escalation (Keep Searching)
     */
    const handleEscalate = async (messageId: string, query: string) => {
        setIsProcessing(true);
        setStatus('Deep searching...');

        try {
            const filterPages = getPageFilter();
            const quiz = SmartSearchEngine.detectQuizQuestion(query);
            const options = quiz.isQuiz ? quiz.options.map(o => o.text) : [];

            const result = await smartSearch.escalateSearch(query, options, filterPages);

            let answerContent = result.answer;
            if (!answerContent) {
                answerContent = result.explanation;
            } else if (quiz.isQuiz) {
                answerContent = formatQuizAnswerContent(quiz, result.answer, result.explanation);
            }

            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? {
                            ...m,
                            content: answerContent,
                            sourcePages: result.pages ?? (result.page ? [result.page] : []),
                            isLowConfidence: false
                        }
                        : m
                )
            );
        } catch (error) {
        // Enforce focus selection for large PDFs
        if (focusRequired && chapterSelection.length === 0) {
            setMessages(prev => [...prev, {
                id: `system-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ This PDF has ${totalPages} pages. Please select a chapter focus (above) to narrow the search scope. This will significantly improve search speed and accuracy.`,
                timestamp: new Date(),
            }]);
            return;
        }

            console.error('Escalation failed', error);
        } finally {
            setIsProcessing(false);
            setStatus('');
        }
    };

    /**
     * Dismiss low confidence flag
     */
    const handleDismissLowConfidence = (messageId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, isLowConfidence: false } : m
        ));
    };

    /**
     * Main submit handler
     */
    const handleSubmit = useCallback(async () => {
        if (!input.trim() || !pdfBuffer || isProcessing) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        const loadingMessageId = `assistant-${Date.now()}`;
        // Force 'thorough' mode (Single Chat Type)
        const aiMode = 'thorough';

        const loadingMessage: Message = {
            id: loadingMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
            thinkingSteps: aiMode === 'thorough' ? [
                { id: '1', label: 'Analyzing question...', status: 'pending' }
            ] : undefined
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setInput('');
        setIsProcessing(true);

        try {
            if (toolMode === 'chat') {
                const filterPages = getPageFilter();
                const quiz = SmartSearchEngine.detectQuizQuestion(userMessage.content);

                // Context Awareness: If follow-up, include previous context
                let searchContent = userMessage.content;
                if (messages.length > 0 && !quiz.isQuiz) {
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                        // If current query is short (< 50 chars) or has pronouns, append context
                        const isShort = searchContent.length < 50;
                        const hasPronouns = /\b(it|that|this|he|she|they|them)\b/i.test(searchContent);
                        if (isShort || hasPronouns) {
                             searchContent = `${searchContent} (Context: ${lastUserMsg.content})`;
                        }
                    }
                }

                // Use Multi-Stage Search (with Fast Solver optimization)
                console.log('[AICommandCenter] Starting multi-stage search...');
                const thinkingSteps: ThinkingStep[] = [];

                let result;
                try {
                    result = await withTimeout(
                        runMultiStageSearch(
                            quiz.isQuiz ? quiz.question : searchContent,
                            quiz.isQuiz ? quiz.options.map(o => o.text) : [],
                            filterPages,
                            (step) => {
                                // Update thinking steps in real-time
                                const existingIdx = thinkingSteps.findIndex(s => s.label === step.label);
                                if (existingIdx >= 0) {
                                    thinkingSteps[existingIdx] = {
                                        ...thinkingSteps[existingIdx],
                                        status: step.status === 'active' ? 'active' : 'complete',
                                        detail: step.detail
                                    };
                                } else {
                                    thinkingSteps.push({
                                        id: String(thinkingSteps.length + 1),
                                        label: step.label,
                                        status: step.status === 'active' ? 'active' : 'complete',
                                        detail: step.detail
                                    });
                                }
                                updateThinkingSteps(loadingMessageId, [...thinkingSteps]);
                            }
                        ),
                        TIME_BUDGET_MS
                    );
                } catch (err) {
                    if (err instanceof TimeoutError) {
                        console.log('[AICommandCenter] Timeout - using fallback search');
                        const fallback = quiz.isQuiz
                            ? await smartSearch.search(quiz.question, quiz.options.map(o => o.text), filterPages, true)
                            : await smartSearch.search(searchContent, [], filterPages, true);

                        const fallbackAnswer = fallback.answer || fallback.explanation || '';
                        const fallbackSteps = [
                            ...thinkingSteps,
                            {
                                id: String(thinkingSteps.length + 1),
                                label: 'Time limit reached',
                                status: 'complete' as const,
                                detail: 'Returned best-effort answer within 20s'
                            }
                        ];

                        const answerContent = quiz.isQuiz
                            ? formatQuizAnswerContent(quiz, fallback.answer || '', fallback.explanation)
                            : fallbackAnswer;

                        setMessages(prev =>
                            prev.map(m =>
                                m.id === loadingMessageId
                                    ? {
                                        ...m,
                                        content: answerContent,
                                        sourcePages: fallback.pages ?? (fallback.page ? [fallback.page] : []),
                                        isLoading: false,
                                        thinkingSteps: fallbackSteps,
                                        isLowConfidence: (fallback.confidence ?? 0) < 0.4
                                    }
                                    : m
                            )
                        );
                        return;
                    }
                    throw err;
                }

                console.log('[AICommandCenter] Search complete, formatting response...');
                let answerContent = result.answer;
                if (!answerContent) {
                    answerContent = result.explanation;
                } else if (quiz.isQuiz) {
                    answerContent = formatQuizAnswerContent(quiz, result.answer, result.explanation);
                }

                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? {
                                ...m,
                                content: answerContent,
                                sourcePages: result.pages,
                                isLoading: false,
                                thinkingSteps: result.thinkingSteps.map((s, i) => ({
                                    id: String(i + 1),
                                    label: s.label,
                                    status: s.status,
                                    detail: s.detail
                                })),
                                isLowConfidence: result.confidence < 0.4
                            }
                            : m
                    )
                );
            } else if (toolMode === 'analyze') {
                // ANALYZE MODE
                const { pages, context } = await scoutPages(userMessage.content);

                if (context.length === 0 && pages.length === 0) {
                    throw new Error('Could not find relevant content in the document');
                }

                const { answer, chartData } = await analyzeContent(userMessage.content, context, pages, toolMode);

                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? { ...m, content: answer, sourcePages: pages, chartData, isLoading: false }
                            : m
                    )
                );
            }
        } catch (error) {
            console.error('[AICommandCenter] Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';

            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMessageId
                        ? { ...m, content: `❌ ${errorMessage}`, isLoading: false }
                        : m
                )
            );
        } finally {
            setIsProcessing(false);
            setModelLoading(false);
            setStatus('');
        }
    }, [
        input, 
        pdfBuffer, 
        isProcessing, 
        toolMode, 
        scoutPages, 
        getPageFilter, 
        updateThinkingSteps, 
        messages, 
        focusRequired, 
        chapterSelection.length, 
        totalPages
    ]);

    return (
        <div className="flex flex-col h-full bg-surface rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/30">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium text-text-primary">AI Command Center</span>
                    <span className="text-xs text-text-secondary">
                        {toolMode === 'chat' ? 'Q&A Mode' : 'Analyze Mode'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "text-xs whitespace-nowrap flex items-center gap-1",
                        focusRequired ? "text-amber-500 font-medium" : "text-text-secondary"
                    )}>
                        <BookOpen size={12} />
                        <span>Focus{focusRequired ? ':' : ''}</span>
                        {focusRequired && <span className="text-[10px]">(Required for {totalPages}+ pages)</span>}
                    </div>
                    <span className="text-xs text-text-secondary">Local LLM</span>
                </div>
            </div>

            {/* Mode Toggle & Chapter Selection */}
            {pdfBuffer && (
                <div className="px-4 py-2 border-b border-border bg-surface space-y-2">
                    {/* Chapter/Subject Focus */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary whitespace-nowrap flex items-center gap-1">
                            <BookOpen size={12} />
                            Focus:
                        </span>
                        <ChapterDropdown
                            value={chapterSelection}
                            onChange={setChapterSelection}
                            disabled={isProcessing}
                        />
                        {workerStatus.message && (
                            <div className="text-[10px] text-primary animate-pulse whitespace-nowrap overflow-hidden max-w-[100px] text-right">
                                {workerStatus.message}
                            </div>
                        )}
                    </div>

                    {/* Storage Warning */}
                    {storageWarning && (
                        <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                            <AlertCircle size={10} />
                            {storageWarning}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-surface">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles size={24} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-base font-medium text-text-primary mb-1">AI-Powered Research</h3>
                            <p className="text-xs text-text-secondary max-w-[200px]">
                                Ask questions about your PDF. Use <strong>Quick ⚡</strong> for fast lookups or <strong>Think More 🧠</strong> for deep analysis.
                            </p>
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-surface-hover rounded text-text-secondary border border-border">What is CHT?</span>
                            <span className="px-2 py-1 bg-surface-hover rounded text-text-secondary border border-border">Compare X vs Y</span>
                        </div>
                    </div>
                )}

                {messages.map((message, idx) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        onJumpToPage={onJumpToPage}
                        onEscalate={handleEscalate}
                        onDismissLowConfidence={handleDismissLowConfidence}
                        previousUserMessage={
                            message.role === 'assistant' && idx > 0
                                ? messages[idx - 1]?.content
                                : undefined
                        }
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-border p-3 bg-surface">
                {!pdfBuffer && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-amber-500/10 rounded-lg text-amber-600 text-xs">
                        <AlertCircle size={12} />
                        <span>Upload a PDF to start chatting</span>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {/* Tool Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowToolMenu(!showToolMenu)}
                            className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary transition-colors"
                        >
                            <Wrench size={16} className={toolMode === 'analyze' ? 'text-purple-500' : 'text-text-secondary'} />
                        </button>

                        {showToolMenu && (
                            <div className="absolute bottom-full left-0 mb-2 bg-surface border border-border rounded-xl overflow-hidden shadow-lg z-10 min-w-[160px] animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 text-[10px] font-medium text-text-secondary uppercase tracking-wider border-b border-border">
                                    Select Mode
                                </div>
                                <button
                                    onClick={() => { setToolMode('chat'); setShowToolMenu(false); }}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm w-full hover:bg-surface-hover transition-colors ${toolMode === 'chat' ? 'text-primary bg-primary/5' : 'text-text-primary'}`}
                                >
                                    <MessageSquare size={16} />
                                    Q&A Chat
                                </button>
                                <button
                                    onClick={() => { setToolMode('analyze'); setShowToolMenu(false); }}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm w-full hover:bg-surface-hover transition-colors ${toolMode === 'analyze' ? 'text-purple-500 bg-purple-500/5' : 'text-text-primary'}`}
                                >
                                    <BarChart3 size={16} />
                                    Data Analyze
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Input Field */}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                        placeholder={toolMode === 'analyze' ? 'Describe data to extract...' : 'Ask about your document...'}
                        className="flex-1 bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                        disabled={!pdfBuffer || isProcessing}
                    />

                    {/* Send Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!pdfBuffer || isProcessing || !input.trim()}
                        className="p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>

                {/* Status indicator */}
                {status && (
                    <div className="mt-2 text-[10px] text-text-secondary text-center animate-pulse">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
