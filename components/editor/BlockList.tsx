import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Block, db, BlockType } from '@/lib/db';
import { TextBlock } from './blocks/TextBlock';
import { TaskBlock } from './blocks/TaskBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { PDFHighlightBlock } from './blocks/PDFHighlightBlock';
import { PageBreakBlock } from './blocks/PageBreakBlock';
import { LectureContainerBlock } from './blocks/LectureContainerBlock';
import { SlashMenu, SlashMenuOption } from './SlashMenu';
import { SortableBlockWrapper } from './SortableBlockWrapper';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { createAppError, safeLogError, toAppError, type AppError } from '@/lib/errors';
import { tidyMarkdown } from '@/utils/tidy-markdown';

// @dnd-kit imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useSearchParams } from 'next/navigation';

interface BlockListProps {
    projectId: string;
    initialBlocks: Block[];
}

export function BlockList({ projectId, initialBlocks }: BlockListProps) {
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');

    // Intelligent Tidying (trust-based)
    const TIDY_DEBOUNCE_MS = 30_000;
    const TIDY_TIMEOUT_MS = 20_000;

    const workerRef = useRef<Worker | null>(null);
    const pendingRequestIdRef = useRef<string | null>(null);

    const [tidyStatus, setTidyStatus] = useState<'idle' | 'pending' | 'ready' | 'error' | 'applied'>('idle');
    const [tidyError, setTidyError] = useState<AppError | null>(null);
    const [tidySnapshot, setTidySnapshot] = useState<{ blockId: string; originalText: string; correctedText: string } | null>(null);
    const [lastEdited, setLastEdited] = useState<{ blockId: string; text: string } | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/grammar.worker.ts', import.meta.url), { type: 'module' });
        return () => {
            try { workerRef.current?.terminate(); } catch { /* ignore */ }
            workerRef.current = null;
        };
    }, []);

    const dismissTidy = useCallback(() => {
        setTidyStatus('idle');
        setTidyError(null);
        setTidySnapshot(null);
        pendingRequestIdRef.current = null;
    }, []);

    const runTidyForBlock = useCallback(async (blockId: string, rawText: string) => {
        const worker = workerRef.current;
        const block = blocks.find(b => b.id === blockId);
        if (!worker || !block) return;
        if (block.type !== 'text') return;

        // Avoid noisy suggestions on tiny content.
        if ((rawText || '').trim().length < 20) {
            dismissTidy();
            return;
        }

        // Only run if content hasn't changed since the debounce captured it.
        if ((block.content || '') !== rawText) return;

        const requestId = uuidv4();
        pendingRequestIdRef.current = requestId;

        setTidyStatus('pending');
        setTidyError(null);

        const originalText = rawText;
        const structured = tidyMarkdown(rawText);
        const textForWorker = structured || rawText;

        await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(() => {
                if (pendingRequestIdRef.current !== requestId) {
                    resolve();
                    return;
                }

                pendingRequestIdRef.current = null;
                setTidyStatus('error');
                setTidyError(createAppError('WORKER_TIMEOUT', 'Tidying timed out', { retryable: true }));

                try {
                    workerRef.current?.terminate();
                } catch { /* ignore */ }

                workerRef.current = new Worker(new URL('../../workers/grammar.worker.ts', import.meta.url), { type: 'module' });
                resolve();
            }, TIDY_TIMEOUT_MS);

            const onMessage = (event: MessageEvent) => {
                const data = event.data;
                if (!data || data.requestId !== requestId) return;

                if (data.type === 'progress') return;

                window.clearTimeout(timeout);
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);

                if (pendingRequestIdRef.current === requestId) pendingRequestIdRef.current = null;

                if (data.type === 'result') {
                    const latest = blocks.find(b => b.id === blockId);
                    if (!latest) {
                        resolve();
                        return;
                    }

                    // Ignore if user changed content since we queued the request.
                    if ((latest.content || '') !== originalText) {
                        resolve();
                        return;
                    }

                    const corrected = (data.corrected ?? data.text ?? '') as string;
                    const suggestedText = String(corrected || textForWorker);

                    if (suggestedText && suggestedText !== latest.content) {
                        setTidySnapshot({ blockId, originalText: latest.content || '', correctedText: suggestedText });
                        setTidyStatus('ready');
                    } else {
                        dismissTidy();
                    }

                    resolve();
                    return;
                }

                if (data.type === 'error') {
                    const err = data.error ? (data.error as AppError) : toAppError(new Error('Tidying failed'), {
                        code: 'WORKER_GRAMMAR_FAILED',
                        message: 'Tidying failed',
                        retryable: true,
                    });
                    setTidyError(err);
                    setTidyStatus('error');
                    resolve();
                }
            };

            const onError = (error: unknown) => {
                window.clearTimeout(timeout);
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError as any);

                if (pendingRequestIdRef.current === requestId) pendingRequestIdRef.current = null;
                const err = toAppError(error, {
                    code: 'WORKER_GRAMMAR_FAILED',
                    message: 'Tidying failed',
                    retryable: true,
                });
                safeLogError('BlockList.tidy', err);
                setTidyError(err);
                setTidyStatus('error');
                resolve();
            };

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError as any);
            worker.postMessage({ type: 'check', text: textForWorker, requestId });
        });
    }, [blocks, dismissTidy]);

    useEffect(() => {
        if (!lastEdited) return;
        const handle = window.setTimeout(() => {
            runTidyForBlock(lastEdited.blockId, lastEdited.text);
        }, TIDY_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [lastEdited, runTidyForBlock]);

    const lectureContainers = React.useMemo(() => {
        const lectures = blocks.filter(b => b.type === 'lecture_container');
        return lectures.sort((a, b) => {
            const an = typeof a.properties?.lecture_number === 'number' ? a.properties.lecture_number : Number.POSITIVE_INFINITY;
            const bn = typeof b.properties?.lecture_number === 'number' ? b.properties.lecture_number : Number.POSITIVE_INFINITY;
            if (an !== bn) return an - bn;
            return a.order - b.order;
        });
    }, [blocks]);

    const [jumpLectureId, setJumpLectureId] = useState<string>('');

    useEffect(() => {
        if (!jumpLectureId) return;
        if (!lectureContainers.some(l => l.id === jumpLectureId)) setJumpLectureId('');
    }, [jumpLectureId, lectureContainers]);

    const handleJumpToLecture = useCallback((lectureId: string) => {
        if (!lectureId) return;
        const el = blockRefs.current.get(lectureId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setFocusedBlockId(lectureId);
    }, []);

    // Slash menu state
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
    const [slashFilterText, setSlashFilterText] = useState('');
    const [activeSlashBlockId, setActiveSlashBlockId] = useState<string | null>(null);

    // Track block element refs for positioning
    const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useEffect(() => {
        if (!focusId) return;
        const el = blockRefs.current.get(focusId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusedBlockId(focusId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusId, blocks.length]);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const sorted = [...initialBlocks].sort((a, b) => a.order - b.order);
        setBlocks(sorted);
    }, [initialBlocks]);

    const handleUpdateBlock = useCallback(async (id: string, updates: Partial<Block>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
        await db.blocks.update(id, updates);
    }, []);

    const handleCreateBlock = useCallback(async (currentBlock: Block) => {
        // Close slash menu if open
        setSlashMenuOpen(false);
        setSlashFilterText('');

        const newBlock: Block = {
            id: uuidv4(),
            parent_id: currentBlock.parent_id,
            content: '',
            type: 'text',
            order: currentBlock.order + 1,
        };

        const siblings = blocks.filter(b => b.parent_id === currentBlock.parent_id && b.order > currentBlock.order);
        await Promise.all(siblings.map(b => db.blocks.update(b.id, { order: b.order + 1 })));
        await db.blocks.add(newBlock);

        const updatedPeers = siblings.map(b => ({ ...b, order: b.order + 1 }));
        const others = blocks.filter(b => !siblings.find(s => s.id === b.id));

        setBlocks([...others, ...updatedPeers, newBlock].sort((a, b) => a.order - b.order));
        setFocusedBlockId(newBlock.id);
    }, [blocks]);

    const handleDeleteBlock = useCallback(async (block: Block) => {
        if (blocks.length <= 1) return;

        const currentIndex = blocks.findIndex(b => b.id === block.id);
        const prevBlock = blocks[currentIndex - 1];

        await db.blocks.delete(block.id);
        setBlocks(prev => prev.filter(b => b.id !== block.id));

        if (prevBlock) setFocusedBlockId(prevBlock.id);

        // Close slash menu if the deleted block had it open
        if (activeSlashBlockId === block.id) {
            setSlashMenuOpen(false);
            setSlashFilterText('');
        }
    }, [blocks, activeSlashBlockId]);

    const handleIndent = useCallback(async (block: Block) => {
        const currentIndex = blocks.findIndex(b => b.id === block.id);
        if (currentIndex <= 0) return;

        const prevBlock = blocks[currentIndex - 1];
        await handleUpdateBlock(block.id, { parent_id: prevBlock.id });
    }, [blocks, handleUpdateBlock]);

    const handleOutdent = useCallback(async (block: Block) => {
        if (!block.parent_id) return;

        const parent = blocks.find(b => b.id === block.parent_id);
        const newParentId = parent ? parent.parent_id : null;

        await handleUpdateBlock(block.id, { parent_id: newParentId });
    }, [blocks, handleUpdateBlock]);

    const handlePasteRows = useCallback(async (parentId: string, rows: string[]) => {
        if (rows.length === 0) return;

        const siblings = blocks.filter(b => b.parent_id === parentId);
        const lastOrder = siblings.reduce((max, b) => Math.max(max, b.order), -1);

        const newBlocks: Block[] = rows.map((row, idx) => {
            let content = row;
            let variant = undefined;
            let type: BlockType = 'text';
            let metadata: Record<string, any> = {};

            // Simple markdown detection for pasted content
            const trimmed = row.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                content = trimmed.substring(2);
                variant = 'bullet';
                metadata = { variant: 'bullet' };
            } else if (trimmed.startsWith('[] ') || trimmed.startsWith('[ ] ')) {
                content = trimmed.substring(trimmed.indexOf(']') + 1).trim();
                type = 'task';
                metadata = { status: 'todo' };
            }

            return {
                id: uuidv4(),
                parent_id: parentId,
                content,
                type,
                order: lastOrder + 1 + idx,
                metadata
            };
        });

        await db.blocks.bulkAdd(newBlocks);
        setBlocks(prev => [...prev, ...newBlocks]);
    }, [blocks]);

    // Slash menu trigger - detect "/" being typed
    const handleContentChange = useCallback((blockId: string, content: string) => {
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        if (block.type === 'text') {
            // Any new typing invalidates an existing suggestion for this block.
            if (tidySnapshot?.blockId === blockId) dismissTidy();
            setLastEdited({ blockId, text: content });

            // Markdown triggers
            if (content === '* ' || content === '- ') {
                handleUpdateBlock(blockId, { 
                    content: '', 
                    metadata: { ...block.metadata, variant: 'bullet' } 
                });
                return;
            }
            if (content === '[] ' || content === '[ ] ') {
                handleUpdateBlock(blockId, {
                    content: '',
                    type: 'task',
                    metadata: { ...block.metadata, status: 'todo' }
                });
                return;
            }
            if (content === '# ') {
                handleUpdateBlock(blockId, {
                    content: '',
                    metadata: { ...block.metadata, variant: 'heading1' }
                });
                return;
            }
            if (content === '## ') {
                handleUpdateBlock(blockId, {
                    content: '',
                    metadata: { ...block.metadata, variant: 'heading2' }
                });
                return;
            }
        }

        // Check if user just typed "/" at the start
        if (content === '/') {
            const blockEl = blockRefs.current.get(blockId);
            if (blockEl) {
                const rect = blockEl.getBoundingClientRect();
                setSlashMenuPosition({
                    x: rect.left,
                    y: rect.bottom + 4
                });
                setSlashMenuOpen(true);
                setActiveSlashBlockId(blockId);
                setSlashFilterText('');
            }
        } else if (content.startsWith('/') && slashMenuOpen && activeSlashBlockId === blockId) {
            // Update filter text (everything after "/")
            setSlashFilterText(content.slice(1));
        } else if (!content.startsWith('/') && slashMenuOpen) {
            // Close menu if "/" is removed
            setSlashMenuOpen(false);
            setSlashFilterText('');
        }

        // Update block content
        handleUpdateBlock(blockId, { content });
    }, [activeSlashBlockId, blocks, dismissTidy, handleUpdateBlock, slashMenuOpen, tidySnapshot?.blockId]);

    // Handle slash menu selection
    const handleSlashSelect = useCallback(async (option: SlashMenuOption) => {
        if (!activeSlashBlockId) return;

        // Map the option type to actual block type
        let newType: BlockType = 'text';
        let newMetadata: Record<string, any> = {};

        switch (option.type) {
            case 'task':
                newType = 'task';
                break;
            case 'image':
                newType = 'image';
                break;
            case 'pdf_highlight':
                newType = 'pdf_highlight';
                newMetadata = { quote: '', source_name: 'Unknown' };
                break;
            case 'page_break':
                newType = 'page_break';
                break;
            case 'lecture_container': {
                newType = 'lecture_container';
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const maxLecture = blocks
                    .filter(b => b.type === 'lecture_container')
                    .map(b => b.properties?.lecture_number)
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
                    .reduce((acc, n) => Math.max(acc, n), 0);

                const nextLecture = maxLecture + 1;
                newMetadata = { ...newMetadata, variant: undefined };

                await handleUpdateBlock(activeSlashBlockId, {
                    content: '',
                    type: newType,
                    metadata: newMetadata,
                    properties: {
                        ...(blocks.find(b => b.id === activeSlashBlockId)?.properties || {}),
                        lecture_number: nextLecture,
                        lecture_date: today.getTime(),
                        audio_transcription_id: null,
                        summary: '',
                    },
                });

                setSlashMenuOpen(false);
                setSlashFilterText('');
                setFocusedBlockId(activeSlashBlockId);
                return;
            }
            case 'heading1':
                newType = 'text';
                newMetadata = { variant: 'heading1' };
                break;
            case 'heading2':
                newType = 'text';
                newMetadata = { variant: 'heading2' };
                break;
            case 'bullet':
                newType = 'text';
                newMetadata = { variant: 'bullet' };
                break;
            default:
                newType = 'text';
        }

        // Clear the slash command text and update block type
        await handleUpdateBlock(activeSlashBlockId, {
            content: '',
            type: newType,
            metadata: newMetadata
        });

        setSlashMenuOpen(false);
        setSlashFilterText('');
        setFocusedBlockId(activeSlashBlockId);
    }, [activeSlashBlockId, handleUpdateBlock]);

    const handleSlashClose = useCallback(() => {
        setSlashMenuOpen(false);
        setSlashFilterText('');
    }, []);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent, block: Block) => {
        // If slash menu is open, let it handle arrow keys and enter
        if (slashMenuOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
            // Don't prevent default here - SlashMenu handles this via window event
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!e.shiftKey) {
                await handleCreateBlock(block);
            }
        } else if (e.key === 'Backspace' && block.content === '') {
            e.preventDefault();
            await handleDeleteBlock(block);
        } else if (e.key === 'ArrowUp' && !slashMenuOpen) {
            e.preventDefault();
            const index = blocks.findIndex(b => b.id === block.id);
            if (index > 0) setFocusedBlockId(blocks[index - 1].id);
        } else if (e.key === 'ArrowDown' && !slashMenuOpen) {
            e.preventDefault();
            const index = blocks.findIndex(b => b.id === block.id);
            if (index < blocks.length - 1) setFocusedBlockId(blocks[index + 1].id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                await handleOutdent(block);
            } else {
                await handleIndent(block);
            }
        }
    }, [blocks, slashMenuOpen, handleCreateBlock, handleDeleteBlock, handleIndent, handleOutdent]);

    const blockMap = React.useMemo(() => {
        const map = new Map<string | null, Block[]>();
        for (const b of blocks) {
            const pid = b.parent_id ?? null;
            const arr = map.get(pid);
            if (arr) arr.push(b);
            else map.set(pid, [b]);
        }
        for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
        return map;
    }, [blocks]);

    const getBlockVariant = (block: Block): 'heading1' | 'heading2' | 'bullet' | undefined => {
        return block.metadata?.variant as 'heading1' | 'heading2' | 'bullet' | undefined;
    };

    const getBlockIds = (parentId: string | null): string[] => {
        const children = blockMap.get(parentId) || [];
        return children.map(b => b.id);
    };

    const renderBlock = (block: Block) => {
        const variant = getBlockVariant(block);

        if (block.type === 'page_break') {
            return (
                <PageBreakBlock
                    block={block}
                    onKeyDown={handleKeyDown}
                    autoFocus={block.id === focusedBlockId}
                    onDelete={() => handleDeleteBlock(block)}
                />
            );
        }

        if (block.type === 'image') {
            return (
                <ImageBlock
                    block={block}
                    onUpdate={(id, updates) => {
                        if ('content' in updates) handleContentChange(id, updates.content || '');
                        else handleUpdateBlock(id, updates);
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus={block.id === focusedBlockId}
                    onDelete={() => handleDeleteBlock(block)}
                />
            );
        }

        if (block.type === 'pdf_highlight') {
            return (
                <PDFHighlightBlock
                    block={block}
                    onUpdate={(id, updates) => handleUpdateBlock(id, updates)}
                    onKeyDown={handleKeyDown}
                    autoFocus={block.id === focusedBlockId}
                    onDelete={() => handleDeleteBlock(block)}
                />
            );
        }

        if (block.type === 'task') {
            return (
                <TaskBlock
                    block={block}
                    onUpdate={(id, updates) => {
                        if ('content' in updates) handleContentChange(id, updates.content || '');
                        else handleUpdateBlock(id, updates);
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus={block.id === focusedBlockId}
                    onDelete={() => handleDeleteBlock(block)}
                />
            );
        }

        if (block.type === 'lecture_container') {
            return (
                <LectureContainerBlock
                    block={block}
                    onUpdate={(id, updates) => {
                        if ('content' in updates) handleContentChange(id, updates.content || '');
                        else handleUpdateBlock(id, updates);
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus={block.id === focusedBlockId}
                    onDelete={() => handleDeleteBlock(block)}
                    onPasteRows={(rows) => handlePasteRows(block.id, rows)}
                />
            );
        }

        return (
            <TextBlock
                block={block}
                variant={variant}
                onUpdate={(id, updates) => {
                    if ('content' in updates) handleContentChange(id, updates.content || '');
                    else handleUpdateBlock(id, updates);
                }}
                onKeyDown={handleKeyDown}
                autoFocus={block.id === focusedBlockId}
                onDelete={() => handleDeleteBlock(block)}
            />
        );
    };

    // Reorder within the same parent only (tree-safe)
    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeBlock = blocks.find(b => b.id === active.id);
        const overBlock = blocks.find(b => b.id === over.id);
        if (!activeBlock || !overBlock) return;

        if ((activeBlock.parent_id ?? null) !== (overBlock.parent_id ?? null)) return;
        const parentId = activeBlock.parent_id ?? null;

        const siblings = (blockMap.get(parentId) || []).slice();
        const oldIndex = siblings.findIndex(b => b.id === activeBlock.id);
        const newIndex = siblings.findIndex(b => b.id === overBlock.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const nextSiblings = siblings.slice();
        const [moved] = nextSiblings.splice(oldIndex, 1);
        nextSiblings.splice(newIndex, 0, moved);

        const updates = nextSiblings.map((b, idx) => ({ id: b.id, order: idx }));

        // Optimistic state update
        setBlocks(prev => prev.map(b => {
            const u = updates.find(x => x.id === b.id);
            return u ? { ...b, order: u.order } : b;
        }));

        try {
            await Promise.all(updates.map(u => db.blocks.update(u.id, { order: u.order })));
        } catch (error) {
            console.error('Failed to persist block order:', error);
        }
    }, [blocks, blockMap]);

    const renderTree = (parentId: string | null, depth: number = 0) => {
        if (parentId) {
            const parent = blocks.find(b => b.id === parentId);
            if (parent?.type === 'lecture_container' && (parent.metadata as any)?.collapsed) {
                return null;
            }
        }

        const children = blockMap.get(parentId) || [];
        if (children.length === 0) return null;

        const blockIds = getBlockIds(parentId);
        return (
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                <div className={cn('flex flex-col', depth > 0 && 'ml-6 border-l border-zinc-100 dark:border-zinc-800')}>
                    {children.map(child => (
                        <div
                            key={child.id}
                            className="relative"
                            ref={(el) => {
                                if (el) blockRefs.current.set(child.id, el);
                            }}
                        >
                            <SortableBlockWrapper id={child.id}>
                                {renderBlock(child)}
                            </SortableBlockWrapper>
                            {renderTree(child.id, depth + 1)}
                        </div>
                    ))}
                </div>
            </SortableContext>
        );
    };

    return (
        <div className="w-full pb-32 relative pl-8">
            {tidyStatus !== 'idle' && (
                <div className={cn(
                    'mx-2 mb-2 rounded-md border px-3 py-2 text-xs',
                    tidyStatus === 'error'
                        ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
                        : tidyStatus === 'ready'
                            ? 'border-lime-500/30 bg-lime-500/10 text-lime-800 dark:text-lime-200'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200'
                )}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            {tidyStatus === 'pending' && <span>Checking for tidying suggestions…</span>}
                            {tidyStatus === 'ready' && <span>Tidying suggestion ready (not applied).</span>}
                            {tidyStatus === 'applied' && <span>Tidying applied.</span>}
                            {tidyStatus === 'error' && (
                                <span>
                                    Tidying failed{tidyError?.message ? `: ${tidyError.message}` : ''}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {tidyStatus === 'ready' && tidySnapshot && (
                                <>
                                    <button
                                        onClick={async () => {
                                            await handleUpdateBlock(tidySnapshot.blockId, { content: tidySnapshot.correctedText });
                                            setFocusedBlockId(tidySnapshot.blockId);
                                            setTidyStatus('applied');
                                        }}
                                        className="px-2 py-1 rounded-md bg-lime-500/20 text-lime-800 dark:text-lime-200 hover:bg-lime-500/30"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={dismissTidy}
                                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => {
                                            const latest = blocks.find(b => b.id === tidySnapshot.blockId);
                                            if (latest) runTidyForBlock(latest.id, latest.content || '');
                                        }}
                                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Re-run
                                    </button>
                                </>
                            )}

                            {tidyStatus === 'applied' && tidySnapshot && (
                                <>
                                    <button
                                        onClick={async () => {
                                            await handleUpdateBlock(tidySnapshot.blockId, { content: tidySnapshot.originalText });
                                            setFocusedBlockId(tidySnapshot.blockId);
                                            dismissTidy();
                                        }}
                                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Undo
                                    </button>
                                    <button
                                        onClick={dismissTidy}
                                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Dismiss
                                    </button>
                                </>
                            )}

                            {tidyStatus === 'error' && (
                                <>
                                    <button
                                        onClick={() => {
                                            if (tidySnapshot?.blockId) {
                                                const latest = blocks.find(b => b.id === tidySnapshot.blockId);
                                                if (latest) runTidyForBlock(latest.id, latest.content || '');
                                            } else if (focusedBlockId) {
                                                const latest = blocks.find(b => b.id === focusedBlockId);
                                                if (latest) runTidyForBlock(latest.id, latest.content || '');
                                            }
                                        }}
                                        className="px-2 py-1 rounded-md bg-red-500/20 text-red-700 dark:text-red-200 hover:bg-red-500/30"
                                    >
                                        Retry
                                    </button>
                                    <button
                                        onClick={dismissTidy}
                                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Dismiss
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {(tidyStatus === 'ready' || tidyStatus === 'applied') && tidySnapshot && (
                        <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-300/90">
                            <div className="truncate">Original: {tidySnapshot.originalText}</div>
                            <div className="truncate">Suggested: {tidySnapshot.correctedText}</div>
                        </div>
                    )}
                </div>
            )}

            {lectureContainers.length > 0 && (
                <div className="flex items-center justify-end gap-2 mb-2 pr-2">
                    <label className="text-xs text-zinc-500">Jump</label>
                    <select
                        className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-sm text-zinc-700 dark:text-zinc-200"
                        value={jumpLectureId}
                        onChange={(e) => {
                            const id = e.target.value;
                            setJumpLectureId(id);
                            handleJumpToLecture(id);
                        }}
                    >
                        <option value="">Select…</option>
                        {lectureContainers.map(l => {
                            const n = typeof l.properties?.lecture_number === 'number' ? l.properties.lecture_number : undefined;
                            const title = (l.content || '').trim();
                            const label = `${n ? `Lecture ${n}` : 'Lecture'}${title ? ` — ${title}` : ''}`;
                            return (
                                <option key={l.id} value={l.id}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                {renderTree(projectId)}
            </DndContext>

            <SlashMenu
                isOpen={slashMenuOpen}
                filterText={slashFilterText}
                position={slashMenuPosition}
                onSelect={handleSlashSelect}
                onClose={handleSlashClose}
            />
        </div>
    );

}
