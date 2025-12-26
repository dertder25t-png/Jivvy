"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, Upload, Loader2, X, MessageSquare, BookOpen, Send, Sparkles, AlertCircle, Quote, Plus, ChevronDown, ExternalLink, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store";
import { PDFViewer } from "./PDFViewer";
import { answerQuestionLocal, initLocalLLM, isModelLoaded } from "@/utils/local-llm";
import { searchPagesForTerms, extractSpecificPages } from "@/utils/pdf-extraction";
import { smartSearch, extractKeywordsFast, detectQuizQuestion, answerQuizQuestion } from "@/utils/smart-search";
import { db, Block } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    cited?: boolean;
    sourcePages?: number[];
    method?: 'quiz' | 'direct' | 'ai'; // Track how answer was generated
}

interface PDFSession {
    id: string;
    fileName: string;
    url: string;
    buffer: ArrayBuffer; // Store buffer for page-level search
    text: string;
    messages: ChatMessage[];
}

export function PDFLookupPanel() {
    const { activeProjectId } = useProjectStore();
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Multi-PDF session management
    const [sessions, setSessions] = useState<PDFSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'document' | 'chat'>('document');

    // AI Chat state
    const [inputValue, setInputValue] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [modelStatus, setModelStatus] = useState<string>('');

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Get active session
    const activeSession = sessions.find(s => s.id === activeSessionId);

    // Handle local file selection
    const handleLocalFile = useCallback(async (file: File) => {
        if (!file.type.includes('pdf')) {
            console.error('Please select a valid PDF file');
            return;
        }

        setLoading(true);

        const blobUrl = URL.createObjectURL(file);
        const arrayBuffer = await file.arrayBuffer();
        let fullText = '';

        // Extract text from PDF for basic fallback
        try {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

            const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                fullText += `[Page ${i}]\n${pageText}\n\n`;
            }

            console.log('[PDFLookupPanel] Extracted PDF text:', fullText.length, 'chars');
        } catch (e) {
            console.warn('[PDFLookupPanel] Failed to extract PDF text:', e);
        }

        // Create new session with buffer
        const newSession: PDFSession = {
            id: uuidv4(),
            fileName: file.name,
            url: blobUrl,
            buffer: arrayBuffer,
            text: fullText,
            messages: []
        };

        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        setLoading(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleLocalFile(file);
        }
    }, [handleLocalFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    }, []);

    const handleRemoveSession = useCallback((sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session?.url.startsWith('blob:')) {
            URL.revokeObjectURL(session.url);
        }

        setSessions(prev => prev.filter(s => s.id !== sessionId));

        if (activeSessionId === sessionId) {
            const remaining = sessions.filter(s => s.id !== sessionId);
            setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
        }
    }, [sessions, activeSessionId]);

    // Handle "Ask AI" from PDF selection
    const handleAskAI = useCallback((selectedText: string) => {
        setActiveTab('chat');
        setInputValue(`What does this mean: "${selectedText}"`);
    }, []);

    // Cite AI response - create PDFHighlightBlock
    const handleCiteResponse = useCallback(async (message: ChatMessage) => {
        if (!activeProjectId || !activeSession) return;

        // Get the current max order
        const existingBlocks = await db.blocks.where('parent_id').equals(activeProjectId).toArray();
        const maxOrder = existingBlocks.reduce((max, b) => Math.max(max, b.order), -1);

        const newBlock: Block = {
            id: uuidv4(),
            parent_id: activeProjectId,
            content: message.content,
            type: 'pdf_highlight',
            order: maxOrder + 1,
            metadata: {
                source_id: activeSession.url,
                quote: message.content,
                source_name: `AI Analysis: ${activeSession.fileName}`,
                ai_generated: true
            }
        };

        await db.blocks.add(newBlock);

        // Mark message as cited
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                return {
                    ...s,
                    messages: s.messages.map(m =>
                        m.id === message.id ? { ...m, cited: true } : m
                    )
                };
            }
            return s;
        }));

        console.log('[PDFLookupPanel] Created citation from AI response:', newBlock.id);
    }, [activeProjectId, activeSession, activeSessionId]);

    // Send message - CODE-FIRST, AI-LIGHT approach
    // 1. Quiz detection (pure code)
    // 2. Direct answer extraction (pure code)
    // 3. Fast keyword search (pure code)
    // 4. AI only as last resort
    const handleSendMessage = useCallback(async () => {
        if (!inputValue.trim() || isAiLoading || !activeSession) return;

        const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: Date.now()
        };

        // Update session messages
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                return { ...s, messages: [...s.messages, userMessage] };
            }
            return s;
        }));

        setInputValue('');
        setIsAiLoading(true);
        setAiError(null);

        try {
            // ======================================
            // PHASE 1: TRY SMART CODE-BASED SEARCH
            // ======================================
            setModelStatus('Analyzing question...');

            // First try pure code methods (no AI needed)
            const smartResult = await smartSearch(
                userMessage.content,
                activeSession.text || '',
                setModelStatus
            );

            // If smart search found an answer (quiz or direct), use it immediately
            if (smartResult.method !== 'ai' && smartResult.answer) {
                console.log('[PDFLookupPanel] Smart answer found via:', smartResult.method);

                const aiMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: smartResult.answer,
                    timestamp: Date.now(),
                    method: smartResult.method
                };

                setSessions(prev => prev.map(s => {
                    if (s.id === activeSessionId) {
                        return { ...s, messages: [...s.messages, aiMessage] };
                    }
                    return s;
                }));

                setModelStatus('');
                return; // Done! No AI needed
            }

            // ======================================
            // PHASE 2: FAST KEYWORD SEARCH (CODE)
            // ======================================
            setModelStatus('Searching document...');

            // Use fast code-based keyword extraction (no AI)
            const keywords = extractKeywordsFast(userMessage.content);
            console.log('[PDFLookupPanel] Fast keywords:', keywords);

            let context = '';
            let sourcePages: number[] = [];

            // Search pages for these keywords (only if buffer exists)
            if (activeSession.buffer && keywords.length > 0) {
                const searchResults = await searchPagesForTerms(
                    activeSession.buffer.slice(0),
                    keywords,
                    { maxResults: 5 }
                );

                if (searchResults.length > 0) {
                    sourcePages = searchResults.map(r => r.page);
                    setModelStatus(`Reading pages: ${sourcePages.join(', ')}...`);

                    const pageData = await extractSpecificPages(
                        activeSession.buffer.slice(0),
                        sourcePages
                    );

                    context = pageData
                        .map(p => `[Page ${p.page}]\n${p.content}`)
                        .join('\n\n');

                    console.log('[PDFLookupPanel] Context from', sourcePages.length, 'pages');
                }
            }

            // Fallback: use cached text
            if (!context) {
                context = activeSession.text?.slice(0, 3000) || 'No document content available.';
            }

            // ======================================
            // PHASE 3: AI AS LAST RESORT
            // ======================================
            // Only load AI model if we couldn't answer with code
            if (!isModelLoaded()) {
                setModelStatus('Loading AI model...');
                await initLocalLLM((progress) => {
                    setModelStatus(progress.status);
                });
            }

            setModelStatus('Generating answer...');
            const answer = await answerQuestionLocal(
                userMessage.content,
                context.slice(0, 5000),
                (progress) => setModelStatus(progress.status)
            );

            const aiMessage: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: answer,
                timestamp: Date.now(),
                sourcePages: sourcePages.length > 0 ? sourcePages : undefined,
                method: 'ai'
            };

            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: [...s.messages, aiMessage] };
                }
                return s;
            }));

            setModelStatus('');
        } catch (error) {
            console.error('[AI Chat] Error:', error);
            setAiError(error instanceof Error ? error.message : 'Failed to get response');
            setModelStatus('');
        } finally {
            setIsAiLoading(false);
        }
    }, [inputValue, isAiLoading, activeSession, activeSessionId]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [activeSession?.messages]);

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Render chat tab content
    const renderChatTab = () => {
        const messages = activeSession?.messages || [];
        const pdfText = activeSession?.text || '';

        return (
            <div className="flex flex-col h-full">
                {/* Messages */}
                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Sparkles className="text-purple-500 mb-3" size={32} />
                            <p className="text-sm font-medium text-zinc-300 mb-1">
                                Ask questions about your PDF
                            </p>
                            <p className="text-xs text-zinc-500 max-w-[200px]">
                                The AI will analyze the document and answer based on its contents.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex",
                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                <div className="flex flex-col gap-1 max-w-[85%]">
                                    <div
                                        className={cn(
                                            "rounded-xl px-3 py-2 text-sm",
                                            msg.role === 'user'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-zinc-800 text-zinc-200'
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                    {/* Source pages for AI responses */}
                                    {msg.role === 'assistant' && msg.sourcePages && msg.sourcePages.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-xs text-zinc-500">Sources:</span>
                                            {msg.sourcePages.map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => {
                                                        // Navigate to page in PDF viewer
                                                        const { setPdfPage } = useProjectStore.getState();
                                                        setPdfPage(page);
                                                        setActiveTab('document');
                                                    }}
                                                    className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors flex items-center gap-0.5"
                                                >
                                                    p.{page}
                                                    <ExternalLink size={8} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Cite button for AI responses */}
                                    {msg.role === 'assistant' && (
                                        <button
                                            onClick={() => handleCiteResponse(msg)}
                                            disabled={msg.cited}
                                            className={cn(
                                                "flex items-center gap-1 self-start px-2 py-1 text-xs rounded transition-colors",
                                                msg.cited
                                                    ? "text-green-500 cursor-default"
                                                    : "text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"
                                            )}
                                        >
                                            <Quote size={10} />
                                            {msg.cited ? 'Cited' : 'Cite to notes'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Loading indicator */}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-400 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={14} />
                                <span>{modelStatus || 'Thinking...'}</span>
                            </div>
                        </div>
                    )}

                    {/* Error display */}
                    {aiError && (
                        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                            <AlertCircle size={14} />
                            {aiError}
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={pdfText ? "Ask about this document..." : "Load a PDF first..."}
                            disabled={isAiLoading || !pdfText}
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isAiLoading || !inputValue.trim() || !pdfText}
                            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:opacity-50 rounded-lg text-white transition-colors"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Session switcher dropdown
    const renderSessionSwitcher = () => (
        <div className="relative">
            <button
                onClick={() => setShowSessionPicker(!showSessionPicker)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors max-w-[150px]"
            >
                <FileText size={12} className="text-blue-500 flex-shrink-0" />
                <span className="truncate">{activeSession?.fileName || 'Select PDF'}</span>
                <ChevronDown size={12} className="flex-shrink-0" />
            </button>

            {showSessionPicker && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-zinc-700">
                        <p className="text-xs text-zinc-500 font-medium">PDF Sessions</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 hover:bg-zinc-800 cursor-pointer",
                                    session.id === activeSessionId && "bg-blue-600/20"
                                )}
                            >
                                <button
                                    onClick={() => {
                                        setActiveSessionId(session.id);
                                        setShowSessionPicker(false);
                                    }}
                                    className="flex items-center gap-2 flex-1 text-left"
                                >
                                    <FileText size={14} className="text-blue-500" />
                                    <span className="text-sm text-zinc-200 truncate">{session.fileName}</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSession(session.id);
                                    }}
                                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            fileInputRef.current?.click();
                            setShowSessionPicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-zinc-800 border-t border-zinc-700"
                    >
                        <Plus size={14} />
                        Add another PDF
                    </button>
                </div>
            )}
        </div>
    );

    if (activeSession) {
        return (
            <div className="flex flex-col h-full">
                {/* Hidden file input for adding more PDFs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLocalFile(file);
                        e.target.value = '';
                    }}
                />

                {/* Header with session switcher and tabs */}
                <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        {/* Session switcher */}
                        {sessions.length > 0 && renderSessionSwitcher()}

                        {/* Tabs */}
                        <div className="flex items-center gap-1 ml-2">
                            <button
                                onClick={() => setActiveTab('document')}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                    activeTab === 'document'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                )}
                            >
                                <BookOpen size={14} />
                                View
                            </button>
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                    activeTab === 'chat'
                                        ? 'bg-purple-600 text-white'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                )}
                            >
                                <MessageSquare size={14} />
                                Lookup
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'document' ? (
                        <div className="h-full p-2">
                            <PDFViewer
                                url={activeSession.url}
                                className="h-full"
                                projectId={activeProjectId || undefined}
                                onAskAI={handleAskAI}
                            />
                        </div>
                    ) : (
                        renderChatTab()
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-white/5">
                <FileText size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-zinc-200">PDF Lookup</span>
            </div>

            {/* Upload area */}
            <div
                className={cn(
                    "flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all duration-200 m-4",
                    dragOver
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLocalFile(file);
                    }}
                />

                <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-200",
                    dragOver ? "scale-110 bg-blue-500/20" : "bg-zinc-800"
                )}>
                    {loading ? (
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                    ) : (
                        <Upload className={cn("transition-colors", dragOver ? "text-blue-500" : "text-zinc-500")} size={24} />
                    )}
                </div>

                <p className="text-sm font-medium text-zinc-300 text-center mb-1">
                    {loading ? "Processing..." : "Drop PDF for Lookup"}
                </p>
                <p className="text-xs text-zinc-500 text-center">
                    Drag & drop or click to upload
                </p>
            </div>
        </div>
    );
}

// Re-export with alias for backward compatibility
export { PDFLookupPanel as PDFContextPanel };
