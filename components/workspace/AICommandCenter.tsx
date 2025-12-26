'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Send, Loader2, MessageSquare, BarChart3,
    ExternalLink, Cpu, AlertCircle, Sparkles, Wrench
} from 'lucide-react';
import { DataVisualizer } from './DataVisualizer';
import { searchPagesForTerms, extractSpecificPages, pdfWorker } from '@/utils/pdf-extraction';
import type { ChartData } from '@/utils/local-llm';

interface AICommandCenterProps {
    pdfBuffer: ArrayBuffer | null;
    onJumpToPage: (page: number) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sourcePages?: number[];
    chartData?: ChartData | null;
    timestamp: Date;
    isLoading?: boolean;
}

type ToolMode = 'chat' | 'analyze';

export function AICommandCenter({ pdfBuffer, onJumpToPage }: AICommandCenterProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [, setStatus] = useState('');
    const [toolMode, setToolMode] = useState<ToolMode>('chat');
    const [showToolMenu, setShowToolMenu] = useState(false);
    const [subjectFocus, setSubjectFocus] = useState('');
    const [workerStatus, setWorkerStatus] = useState({ message: '', percent: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize Worker and Listeners
    useEffect(() => {
        if (!pdfBuffer) return;

        // Init Worker
        pdfWorker.init(pdfBuffer, subjectFocus);

        // Listen for progress
        const onProgress = (data: { message: string, percent: number }) => {
            setWorkerStatus({ message: data.message, percent: data.percent });
            // Optional: Auto-clear status after completion? 
            if (data.percent === 100) {
                setTimeout(() => setWorkerStatus(prev => ({ ...prev, message: 'Ready' })), 2000);
            }
        };

        const onInfo = (data: { message: string }) => {
            // Transient info
            setWorkerStatus(prev => ({ ...prev, message: data.message }));
        };

        pdfWorker.on('progress', onProgress);
        pdfWorker.on('info', onInfo);

        return () => {
            pdfWorker.off('progress', onProgress);
            pdfWorker.off('info', onInfo);
        };
    }, [pdfBuffer, subjectFocus]); // Re-init if subject changes

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * Scout Phase: Find relevant pages using searchPagesForTerms
     */
    const scoutPages = useCallback(async (query: string): Promise<{ pages: number[]; context: string }> => {
        if (!pdfBuffer) return { pages: [], context: '' };

        setStatus('Searching document...');

        // Extract keywords from query
        const { extractKeywords } = await import('@/utils/local-llm');
        const keywords = await extractKeywords(query, (p) => setStatus(p.status));

        console.log('[AICommandCenter] Keywords:', keywords);

        // Search for pages with these terms
        const searchResults = await searchPagesForTerms(pdfBuffer.slice(0), keywords, { maxResults: 8 });

        if (searchResults.length === 0) {
            // Fallback: If no results, try broader search or just first pages
            setStatus('No direct matches, checking priority pages...');

            // If worker already indexed, we might just not have matches.
            // Return first 5 pages as context
            return { pages: [1, 2, 3, 4, 5], context: '' };
        }

        const pages = searchResults.map(r => r.page);

        // Extract content from found pages
        setStatus(`Reading pages: ${pages.join(', ')}...`);
        const pageData = await extractSpecificPages(pdfBuffer.slice(0), pages);
        const context = pageData.map(p => `[Page ${p.page}]\n${p.content}`).join('\n\n');

        return { pages, context };
    }, [pdfBuffer]);

    /**
     * Analyst Phase: Generate answer or chart from context
     */
    const analyzeContent = async (
        query: string,
        context: string,
        pages: number[],
        mode: ToolMode
    ): Promise<{ answer: string; chartData?: ChartData | null }> => {
        if (mode === 'analyze') {
            // Data visualization mode
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
            // Regular Q&A mode
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
     * Main handler: Scout -> Analyst pipeline
     */
    const handleSubmit = useCallback(async () => {
        if (!input.trim() || !pdfBuffer || isProcessing) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        const loadingMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setInput('');
        setIsProcessing(true);

        try {
            // Scout Phase
            const { pages, context } = await scoutPages(input);

            if (context.length === 0 && pages.length === 0) {
                throw new Error('Could not find relevant content in the document');
            }

            // Analyst Phase
            const { answer, chartData } = await analyzeContent(input, context, pages, toolMode);

            // Update the loading message with the result
            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMessage.id
                        ? { ...m, content: answer, sourcePages: pages, chartData, isLoading: false }
                        : m
                )
            );
        } catch (error) {
            console.error('[AICommandCenter] Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';

            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMessage.id
                        ? { ...m, content: `❌ ${errorMessage}`, isLoading: false }
                        : m
                )
            );
        } finally {
            setIsProcessing(false);
            setStatus('');
        }
    }, [input, pdfBuffer, isProcessing, toolMode, scoutPages]);

    return (
        <div className="flex flex-col h-full bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/80">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                    <span className="text-sm font-medium text-zinc-200">AI Command Center</span>
                    <span className="text-xs text-zinc-500">
                        {toolMode === 'chat' ? 'Q&A Mode' : 'Analyze Mode'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Cpu size={14} className="text-zinc-500" />
                    <span className="text-xs text-zinc-500">Local LLM</span>
                </div>
            </div>

            {/* Subject Focus Input */}
            {pdfBuffer && (
                <div className="px-4 py-2 border-b border-white/5 bg-zinc-900/50 flex items-center gap-2">
                    <span className="text-xs text-zinc-500 whitespace-nowrap">Subject Focus:</span>
                    <input
                        type="text"
                        value={subjectFocus}
                        onChange={(e) => setSubjectFocus(e.target.value)}
                        placeholder="e.g. Induction Systems"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-lime-500/50"
                    />
                    {workerStatus.message && (
                        <div className="text-[10px] text-lime-400 animate-pulse whitespace-nowrap overflow-hidden max-w-[150px] text-right">
                            {workerStatus.message}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-lime-500/20 to-lime-500/5 flex items-center justify-center">
                            <Sparkles size={24} className="text-lime-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-medium text-zinc-200 mb-1">AI-Powered Research</h3>
                            <p className="text-xs text-zinc-500 max-w-[200px]">
                                Ask questions about your PDF or use <strong>/analyze</strong> for data viz.
                            </p>
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">/analyze revenue</span>
                            <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">What is CHT?</span>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                ? 'bg-lime-500/20 text-lime-100 rounded-br-md'
                                : 'bg-zinc-800/80 text-zinc-200 rounded-bl-md'
                                }`}
                        >
                            {message.isLoading ? (
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span className="text-sm">Thinking...</span>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                    {/* Chart visualization */}
                                    {message.chartData && (
                                        <div className="mt-3">
                                            <DataVisualizer
                                                data={message.chartData}
                                                onViewSource={onJumpToPage}
                                            />
                                        </div>
                                    )}

                                    {/* Source pages */}
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
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - flex-shrink-0 ensures it's always visible */}
            <div className="flex-shrink-0 border-t border-white/5 p-3 bg-zinc-900/80">
                {!pdfBuffer && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-amber-500/10 rounded-lg text-amber-400 text-xs">
                        <AlertCircle size={12} />
                        <span>Upload a PDF to start chatting</span>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {/* Tool Selector */}
                    {/* Tool Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowToolMenu(!showToolMenu)}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
                        >
                            <Wrench size={16} className={toolMode === 'analyze' ? 'text-purple-400' : 'text-zinc-400'} />
                        </button>

                        {showToolMenu && (
                            <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-white/10 rounded-lg overflow-hidden shadow-xl z-10">
                                <button
                                    onClick={() => { setToolMode('chat'); setShowToolMenu(false); }}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-zinc-700 ${toolMode === 'chat' ? 'text-lime-400' : 'text-zinc-300'}`}
                                >
                                    <MessageSquare size={14} />
                                    Q&A Chat
                                </button>
                                <button
                                    onClick={() => { setToolMode('analyze'); setShowToolMenu(false); }}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-zinc-700 ${toolMode === 'analyze' ? 'text-purple-400' : 'text-zinc-300'}`}
                                >
                                    <BarChart3 size={14} />
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
                        className="flex-1 bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/20"
                        disabled={!pdfBuffer || isProcessing}
                    />

                    {/* Send Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!pdfBuffer || isProcessing || !input.trim()}
                        className="p-2.5 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div >
    );
}
