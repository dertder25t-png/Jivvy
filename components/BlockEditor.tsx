'use client';

import React, { useEffect } from 'react';
import { useProjectStore } from '@/lib/store';
import { cn } from "@/lib/utils";
import { ExternalLink } from 'lucide-react';
import { ErrorNotice } from '@/components/ui/ErrorNotice';

interface BlockEditorProps {
    projectId: string;
}

export function BlockEditor({ projectId }: BlockEditorProps) {
    const { blocks, loadBlocks, isLoading, error, addBlock, activePdfUrl, setContextPanelOpen, setPdfUrl } = useProjectStore();

    const [slashMenuOpen, setSlashMenuOpen] = React.useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = React.useState({ top: 0, left: 0 });
    const editorRef = React.useRef<HTMLDivElement>(null);
    const workerRef = React.useRef<Worker | null>(null);

    // Initialize Worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('@/workers/miner.worker.ts', import.meta.url));
        workerRef.current.onmessage = (e) => {
            const { status, result, error } = e.data;
            if (status === 'success') {
                // Add AI response as new block
                addBlock({
                    id: crypto.randomUUID(),
                    parent_id: projectId,
                    content: result,
                    type: 'text', // Markdown
                    metadata: { author: 'AI', created_at: Date.now() },
                    order: blocks.length
                });
            } else {
                console.error("AI Worker Error:", error);
            }
        };
        return () => workerRef.current?.terminate();
    }, [blocks.length, projectId, addBlock]);

    useEffect(() => {
        if (projectId) {
            loadBlocks(projectId);
        }
    }, [projectId, loadBlocks]);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text');
        if (!text) return;

        // Create a new block
        const newBlock = {
            id: crypto.randomUUID(),
            parent_id: projectId,
            content: text,
            type: 'pdf_highlight' as const,
            metadata: {
                source_url: activePdfUrl,
                created_at: Date.now()
            },
            order: blocks.length
        };

        await addBlock(newBlock);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[200px]">
                <div className="animate-pulse text-gray-500">Loading blocks...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 m-4 bg-red-50 text-red-600 border border-red-200 rounded-lg shadow-sm">
                <h3 className="font-semibold">Error loading content</h3>
                <ErrorNotice error={error} className="mt-2" />
            </div>
        );
    }



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === '/') {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSlashMenuPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                setSlashMenuOpen(true);
            }
        } else if (e.key === 'Escape') {
            setSlashMenuOpen(false);
        }
    };

    const runAICommand = (command: string) => {
        setSlashMenuOpen(false);
        // Gather context (last 3 blocks for simplicity)
        const context = blocks.slice(-3).map(b => b.content).join('\n');

        // Optimistic loading block? Maybe later.
        workerRef.current?.postMessage({
            type: 'job',
            command,
            content: context || "No context provided."
        });
    };

    return (
        <div
            className="max-w-4xl mx-auto p-8 min-h-screen bg-white relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onKeyDown={handleKeyDown}
            ref={editorRef}
            tabIndex={0} // Make accessible for keyboard events
        >
            <header className="mb-8 border-b pb-4">
                <h1 className="text-2xl font-bold text-gray-900">Project Workspace</h1>
            </header>

            {/* Slash Menu */}
            {slashMenuOpen && (
                <div
                    className="absolute z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
                >
                    <div className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        AI Commands
                    </div>
                    <button
                        onClick={() => runAICommand('summarize')}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                        📝 Summarize
                    </button>
                    <button
                        onClick={() => runAICommand('critique')}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                        🧐 Critique
                    </button>
                    <button
                        onClick={() => runAICommand('generate')}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                        ✨ Generate
                    </button>
                </div>
            )}

            <div className="space-y-4 min-h-[50vh]">
                {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                        <p>Page is empty</p>
                        <p className="text-sm mt-2">Type '/' to insert a block</p>
                        <p className="text-xs mt-1">Or drag text from the PDF panel</p>
                    </div>
                ) : (
                    blocks.map((block) => (
                        <div
                            key={block.id}
                            className="p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all group relative"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={cn(
                                    "text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded",
                                    block.type === 'pdf_highlight' ? "bg-yellow-100 text-yellow-700" : "bg-gray-50 text-gray-400"
                                )}>
                                    {block.type === 'pdf_highlight' ? 'Citation' : block.type}
                                </span>
                                <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100">
                                    ID: {block.id.slice(0, 8)}
                                </span>
                            </div>
                            <div className="prose prose-slate max-w-none">
                                {block.content || <span className="text-gray-300 italic">Empty block</span>}
                            </div>
                            {block.type === 'pdf_highlight' && block.metadata?.source_url && (
                                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (block.metadata?.source_url) {
                                                setPdfUrl(block.metadata.source_url);
                                                setContextPanelOpen(true);
                                            }
                                        }}
                                        className="text-xs text-blue-500 cursor-pointer hover:underline flex items-center gap-1"
                                    >
                                        <ExternalLink size={12} />
                                        Open Source PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-400">
                Block Editor Ready - Type '/' for AI or drag text here
            </div>
        </div>
    );
}
