"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AICommandCenter } from "@/components/workspace/AICommandCenter";
import { Upload, FileText, X, Plus, Trash2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfWorker } from "@/utils/pdf-extraction";
import type { Message } from "@/components/workspace/ai-command/types";

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    updatedAt: number;
}

export default function AIChatPage() {
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Session Management
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // Initialize PDF Worker when buffer changes
    useEffect(() => {
        if (pdfBuffer) {
            pdfWorker.initIndex(pdfBuffer);
        }
    }, [pdfBuffer]);

    // Load sessions from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('jivvy-chat-sessions');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSessions(parsed);
                if (parsed.length > 0) {
                    setCurrentSessionId(parsed[0].id);
                } else {
                    createNewSession();
                }
            } catch (e) {
                console.error('Failed to load sessions', e);
                createNewSession();
            }
        } else {
            createNewSession();
        }
    }, []);

    // Save sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('jivvy-chat-sessions', JSON.stringify(sessions));
        }
    }, [sessions]);

    const createNewSession = () => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            updatedAt: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
    };

    const deleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        if (currentSessionId === id) {
            setCurrentSessionId(newSessions[0]?.id || null);
            if (newSessions.length === 0) {
                // Don't auto-create here to avoid loop, just let UI handle empty state or create one
                const newSession: ChatSession = {
                    id: crypto.randomUUID(),
                    title: 'New Chat',
                    messages: [],
                    updatedAt: Date.now()
                };
                setSessions([newSession]);
                setCurrentSessionId(newSession.id);
            }
        }
    };

    const updateSessionMessages = useCallback((messages: Message[]) => {
        if (!currentSessionId) return;

        setSessions(prev => prev.map(session => {
            if (session.id !== currentSessionId) return session;
            // Avoid feedback loops / redundant renders when nothing changed.
            if (session.messages === messages) return session;

            // Generate title from first user message if it's "New Chat"
            let title = session.title;
            if (session.title === 'New Chat' && messages.length > 0) {
                const firstUserMsg = messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
                }
            }

            return { ...session, messages, title, updatedAt: Date.now() };
        }));
    }, [currentSessionId]);

    const handleFile = useCallback((file: File) => {
        if (!file.type.includes('pdf')) {
            setError('Please select a valid PDF file');
            return;
        }

        setLoading(true);
        setError(null);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
                if (e.target.result.byteLength === 0) {
                    setError('PDF file is empty');
                    setLoading(false);
                    return;
                }
                setPdfBuffer(e.target.result);
                setLoading(false);
            }
        };
        reader.onerror = () => {
            setError('Failed to read file');
            setLoading(false);
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile]);

    const clearPdf = () => {
        setPdfBuffer(null);
        setFileName(null);
        setError(null);
    };

    const currentSession = sessions.find(s => s.id === currentSessionId);

    return (
        <AppShell>
            <div className="h-full max-w-5xl mx-auto w-full p-4">
                {/* Main Content */}
                <div className="flex flex-col h-full">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">AI Chat Room</h1>
                            <p className="text-text-secondary text-sm">Chat with your PDF documents using local AI.</p>
                        </div>
                        <div className="flex items-center gap-2">
                             {/* History Dropdown */}
                             <div className="relative group">
                                <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors text-sm font-medium text-text-secondary">
                                    <History size={16} />
                                    History
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-50">
                                    <div className="p-2 border-b border-border bg-surface-hover/30 text-xs font-medium text-text-secondary">
                                        Recent Chats
                                    </div>
                                    <div className="max-h-80 overflow-y-auto p-1">
                                        {sessions.map(session => (
                                            <div
                                                key={session.id}
                                                onClick={() => setCurrentSessionId(session.id)}
                                                className={cn(
                                                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all mb-0.5",
                                                    currentSessionId === session.id
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                                                )}
                                            >
                                                <span className="truncate flex-1 mr-2">{session.title}</span>
                                                <button
                                                    onClick={(e) => deleteSession(e, session.id)}
                                                    className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded transition-all opacity-50 hover:opacity-100"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        {sessions.length === 0 && (
                                            <div className="p-4 text-center text-xs text-text-secondary">
                                                No history yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                             </div>

                             <button
                                onClick={createNewSession}
                                className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                            >
                                <Plus size={16} />
                                New Chat
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                            <span className="flex items-center gap-2">
                                <X size={16} />
                                {error}
                            </span>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {!pdfBuffer ? (
                        <div
                            className={cn(
                                "flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer bg-surface hover:bg-surface-hover/50",
                                dragOver ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/50"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFile(file);
                                }}
                            />
                            {loading ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <FileText className="w-6 h-6 text-primary/50" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-text-primary font-medium">Processing PDF...</p>
                                        <p className="text-text-secondary text-sm mt-1">This happens locally on your device</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                                    <div className="w-20 h-20 rounded-2xl bg-surface-hover flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform duration-300">
                                        <Upload className="w-10 h-10 text-text-secondary group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-text-primary mb-2">Upload a PDF to start chatting</h3>
                                        <p className="text-text-secondary">Drag & drop your document here, or click to browse files.</p>
                                    </div>
                                    <div className="mt-4 px-4 py-2 bg-surface-hover rounded-lg text-xs text-text-secondary border border-border">
                                        Supported formats: PDF (Text-based)
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-text-primary truncate max-w-[300px]">{fileName}</p>
                                        <p className="text-xs text-text-secondary">Ready to chat</p>
                                    </div>
                                </div>
                                <button
                                    onClick={clearPdf}
                                    className="text-xs font-medium text-text-secondary hover:text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
                                >
                                    <X size={14} />
                                    Change PDF
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden p-0 bg-surface">
                                {currentSession && (
                                    <AICommandCenter
                                        key={currentSession.id} // Force re-mount on session change
                                        pdfBuffer={pdfBuffer}
                                        onJumpToPage={() => {}}
                                        initialMessages={currentSession.messages}
                                        onMessagesChange={updateSessionMessages}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
