'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { GripVertical } from 'lucide-react';

import { db, Block, BlockType, Project } from '@/lib/db';
import { cn } from '@/lib/utils';
import { SlashMenu, SlashMenuOption } from '@/components/editor/SlashMenu';

import { TextBlock } from '@/components/editor/blocks/TextBlock';
import { TaskBlock } from '@/components/editor/blocks/TaskBlock';
import { ImageBlock } from '@/components/editor/blocks/ImageBlock';
import { PDFHighlightBlock } from '@/components/editor/blocks/PDFHighlightBlock';
import { PageBreakBlock } from '@/components/editor/blocks/PageBreakBlock';
import { LectureContainerBlock } from '@/components/editor/blocks/LectureContainerBlock';

import {
    CitationStyle,
    exportBibliography,
    formatTurabianFootnote,
    type Citation,
} from '@/utils/citation-formatter';
import { createAppError, safeJsonStringify, safeLogError, type AppError, toAppError } from '@/lib/errors';
import { tidyMarkdown } from '@/utils/tidy-markdown';

type DocTemplate = CitationStyle; // keep templates in sync with citation styles for now

type BlockVariant = 'heading1' | 'heading2' | 'bullet' | undefined;

type PdfHighlightCitationMetadata = {
    title?: string;
    author?: string;
    year?: string | number;
    url?: string;
    publisher?: string;
    journal?: string;
    volume?: string;
    issue?: string;
    doi?: string;
    page?: number | string;
    source_name?: string;
};

const PAGE_WIDTH_PX = 816; // 8.5in @ 96dpi
const PAGE_HEIGHT_PX = 1056; // 11in @ 96dpi
const PAGE_PADDING_PX = 96; // 1in @ 96dpi

function BlockShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative group/jivvyblock">
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 rounded-md',
                    'ring-1 ring-inset ring-transparent',
                    'group-hover/jivvyblock:ring-border/40',
                    'group-focus-within/jivvyblock:ring-2 group-focus-within/jivvyblock:ring-primary/30'
                )}
            />

            {/* Hover-only handle (visual affordance; not required for keyboard editing) */}
            <div
                aria-hidden
                className={cn(
                    'absolute left-[-28px] top-2 p-1 rounded',
                    'text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    'transition-all duration-150',
                    'opacity-0 group-hover/jivvyblock:opacity-100'
                )}
            >
                <GripVertical size={16} />
            </div>

            {children}
        </div>
    );
}

function getVariant(block: Block): BlockVariant {
    return block.metadata?.variant as BlockVariant;
}

function isHeadingVariant(variant: BlockVariant): boolean {
    return variant === 'heading1' || variant === 'heading2';
}

function isTopLevelForProject(block: Block, projectId: string) {
    return block.parent_id === projectId;
}

function normalizeTemplate(value: string | undefined): DocTemplate {
    if (value === 'APA' || value === 'MLA' || value === 'Chicago' || value === 'Turabian') return value;
    return 'APA';
}

function citationFromPdfHighlight(block: Block): Citation {
    const meta = (block.metadata || {}) as PdfHighlightCitationMetadata;
    return {
        id: block.id,
        title: meta.title || meta.source_name || 'PDF Source',
        author: meta.author || meta.source_name || 'Unknown',
        type: 'pdf',
        url: meta.url,
        page: meta.page !== undefined ? String(meta.page) : undefined,
        year: meta.year !== undefined ? String(meta.year) : undefined,
        publisher: meta.publisher,
        journal: meta.journal,
        volume: meta.volume,
        issue: meta.issue,
        doi: meta.doi,
    };
}

function uniqueCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const c of citations) {
        const key = `${c.author}::${c.title}::${c.year ?? ''}::${c.url ?? ''}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
    }
    return out;
}

export function DocView({ projectId }: { projectId: string }) {
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
    const allBlocks = useLiveQuery(() => db.blocks.toArray(), []);

    const [localTemplate, setLocalTemplate] = useState<DocTemplate>('APA');

    // Editor state
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    // Cursor/selection stability across re-pagination:
    // Re-pagination can move blocks between page containers, which may remount the focused textarea and lose selection.
    // While the editor is focused, we coalesce pagination requests and apply them once focus leaves.
    const docRootRef = useRef<HTMLDivElement | null>(null);
    const isEditorFocusedRef = useRef(false);
    const paginationPendingWhileEditingRef = useRef(false);

    // Intelligent Tidying (trust-based)
    const TIDY_DEBOUNCE_MS = 30_000;
    const TIDY_TIMEOUT_MS = 20_000;
    const tidyWorkerRef = useRef<Worker | null>(null);
    const tidyPendingRequestIdRef = useRef<string | null>(null);

    const [tidyStatus, setTidyStatus] = useState<'idle' | 'pending' | 'ready' | 'error' | 'applied'>('idle');
    const [tidyError, setTidyError] = useState<AppError | null>(null);
    const [tidySnapshot, setTidySnapshot] = useState<{ blockId: string; originalText: string; correctedText: string } | null>(null);
    const [lastEdited, setLastEdited] = useState<{ blockId: string; text: string } | null>(null);

    useEffect(() => {
        tidyWorkerRef.current = new Worker(new URL('../../workers/grammar.worker.ts', import.meta.url), { type: 'module' });
        return () => {
            try { tidyWorkerRef.current?.terminate(); } catch { /* ignore */ }
            tidyWorkerRef.current = null;
        };
    }, []);

    const dismissTidy = useCallback(() => {
        setTidyStatus('idle');
        setTidyError(null);
        setTidySnapshot(null);
        tidyPendingRequestIdRef.current = null;
    }, []);

    const lectureContainers = useMemo(() => {
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

    // Slash menu state
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
    const [slashFilterText, setSlashFilterText] = useState('');
    const [activeSlashBlockId, setActiveSlashBlockId] = useState<string | null>(null);

    // On-screen refs (for slash menu positioning)
    const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    // Hidden measurer refs (top-level blocks only, for pagination heights)
    const measureRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Keep template synced with project metadata
    useEffect(() => {
        const template = normalizeTemplate((project as Project | undefined)?.metadata?.docTemplate);
        setLocalTemplate(template);
    }, [project]);

    // Build relevant blocks (project subtree)
    const projectBlocks = useMemo(() => {
        if (!allBlocks) return [];

        const relevant: Block[] = [];
        const childrenMap = new Map<string, Block[]>();

        for (const b of allBlocks) {
            const pid = b.parent_id || 'root';
            const arr = childrenMap.get(pid);
            if (arr) arr.push(b);
            else childrenMap.set(pid, [b]);
        }

        const collect = (pid: string) => {
            const kids = childrenMap.get(pid);
            if (!kids) return;
            kids.sort((a, b) => a.order - b.order);
            for (const k of kids) {
                relevant.push(k);
                collect(k.id);
            }
        };

        collect(projectId);
        return relevant;
    }, [allBlocks, projectId]);

    useEffect(() => {
        setBlocks(projectBlocks);
    }, [projectBlocks]);

    const blockById = useMemo(() => {
        const map = new Map<string, Block>();
        for (const b of blocks) map.set(b.id, b);
        return map;
    }, [blocks]);

    const childrenByParent = useMemo(() => {
        const map = new Map<string, Block[]>();
        for (const b of blocks) {
            if (!b.parent_id) continue;
            const arr = map.get(b.parent_id);
            if (arr) arr.push(b);
            else map.set(b.parent_id, [b]);
        }
        for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
        return map;
    }, [blocks]);

    const topLevelBlocks = useMemo(() => {
        const list = blocks.filter(b => isTopLevelForProject(b, projectId));
        return list.sort((a, b) => a.order - b.order);
    }, [blocks, projectId]);

    const handleUpdateBlock = useCallback(async (id: string, updates: Partial<Block>) => {
        setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
        await db.blocks.update(id, updates);
        await db.projects.update(projectId, { updated_at: Date.now() });
    }, [projectId]);

    const runTidyForBlock = useCallback(async (blockId: string, rawText: string) => {
        const worker = tidyWorkerRef.current;
        const block = blockById.get(blockId);
        if (!worker || !block) return;
        if (block.type !== 'text' && block.type !== 'quiz') return;

        if ((rawText || '').trim().length < 20) {
            dismissTidy();
            return;
        }

        if ((block.content || '') !== rawText) return;

        const requestId = uuidv4();
        tidyPendingRequestIdRef.current = requestId;

        setTidyStatus('pending');
        setTidyError(null);

        const originalText = rawText;
        const structured = tidyMarkdown(rawText);
        const textForWorker = structured || rawText;

        await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(() => {
                if (tidyPendingRequestIdRef.current !== requestId) {
                    resolve();
                    return;
                }

                tidyPendingRequestIdRef.current = null;
                setTidyStatus('error');
                setTidyError(createAppError('WORKER_TIMEOUT', 'Tidying timed out', { retryable: true }));

                try {
                    tidyWorkerRef.current?.terminate();
                } catch { /* ignore */ }

                tidyWorkerRef.current = new Worker(new URL('../../workers/grammar.worker.ts', import.meta.url), { type: 'module' });
                resolve();
            }, TIDY_TIMEOUT_MS);

            const onMessage = (event: MessageEvent) => {
                const data = event.data;
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'progress') return;

                window.clearTimeout(timeout);
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);

                if (tidyPendingRequestIdRef.current === requestId) tidyPendingRequestIdRef.current = null;

                if (data.type === 'result') {
                    const latest = blockById.get(blockId);
                    if (!latest) {
                        resolve();
                        return;
                    }
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
                    safeLogError('DocView.tidy', err);
                    setTidyError(err);
                    setTidyStatus('error');
                    resolve();
                }
            };

            const onError = (error: unknown) => {
                window.clearTimeout(timeout);
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError as any);

                if (tidyPendingRequestIdRef.current === requestId) tidyPendingRequestIdRef.current = null;
                const err = toAppError(error, {
                    code: 'WORKER_GRAMMAR_FAILED',
                    message: 'Tidying failed',
                    retryable: true,
                });
                safeLogError('DocView.tidy', err);
                setTidyError(err);
                setTidyStatus('error');
                resolve();
            };

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError as any);
            worker.postMessage({ type: 'check', text: textForWorker, requestId });
        });
    }, [blockById, dismissTidy]);

    useEffect(() => {
        if (!lastEdited) return;
        const handle = window.setTimeout(() => {
            runTidyForBlock(lastEdited.blockId, lastEdited.text);
        }, TIDY_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [lastEdited, runTidyForBlock]);

    const handleJumpToLecture = useCallback((lectureId: string) => {
        if (!lectureId) return;
        const el = blockRefs.current.get(lectureId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setFocusedBlockId(lectureId);
    }, []);

    const handleContentChange = useCallback((blockId: string, content: string) => {
        const block = blockById.get(blockId);
        if (!block) return;

        if (block.type === 'text' || block.type === 'quiz') {
            if (tidySnapshot?.blockId === blockId) dismissTidy();
            setLastEdited({ blockId, text: content });
        }

        // Slash menu trigger: "/" at start
        if (content === '/') {
            const el = blockRefs.current.get(blockId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setSlashMenuPosition({ x: rect.left, y: rect.bottom + 4 });
                setSlashMenuOpen(true);
                setActiveSlashBlockId(blockId);
                setSlashFilterText('');
            }
        } else if (content.startsWith('/') && slashMenuOpen && activeSlashBlockId === blockId) {
            setSlashFilterText(content.slice(1));
        } else if (!content.startsWith('/') && slashMenuOpen) {
            setSlashMenuOpen(false);
            setSlashFilterText('');
        }

        handleUpdateBlock(blockId, { content });
    }, [activeSlashBlockId, blockById, dismissTidy, handleUpdateBlock, slashMenuOpen, tidySnapshot?.blockId]);

    const createSiblingBlockAfter = useCallback(async (currentBlock: Block) => {
        setSlashMenuOpen(false);
        setSlashFilterText('');

        const newBlock: Block = {
            id: uuidv4(),
            parent_id: currentBlock.parent_id,
            content: '',
            type: 'text',
            order: currentBlock.order + 1,
        };

        const siblings = blocks.filter(
            b => b.parent_id === currentBlock.parent_id && b.order > currentBlock.order
        );

        await db.transaction('rw', db.blocks, async () => {
            await Promise.all(siblings.map(b => db.blocks.update(b.id, { order: b.order + 1 })));
            await db.blocks.add(newBlock);
        });

        const updatedPeers = siblings.map(b => ({ ...b, order: b.order + 1 }));
        const others = blocks.filter(b => !siblings.find(s => s.id === b.id));
        setBlocks([...others, ...updatedPeers, newBlock].sort((a, b) => a.order - b.order));
        setFocusedBlockId(newBlock.id);
        await db.projects.update(projectId, { updated_at: Date.now() });
    }, [blocks, projectId]);

    const handleDeleteBlock = useCallback(async (block: Block) => {
        if (blocks.length <= 1) return;

        const siblings = blocks
            .filter(b => b.parent_id === block.parent_id)
            .sort((a, b) => a.order - b.order);
        const idx = siblings.findIndex(b => b.id === block.id);
        const prev = idx > 0 ? siblings[idx - 1] : undefined;

        await db.blocks.delete(block.id);
        setBlocks(prevBlocks => prevBlocks.filter(b => b.id !== block.id));
        if (prev) setFocusedBlockId(prev.id);

        if (activeSlashBlockId === block.id) {
            setSlashMenuOpen(false);
            setSlashFilterText('');
        }

        await db.projects.update(projectId, { updated_at: Date.now() });
    }, [activeSlashBlockId, blocks, projectId]);

    const handleIndent = useCallback(async (block: Block) => {
        const siblings = blocks
            .filter(b => b.parent_id === block.parent_id)
            .sort((a, b) => a.order - b.order);
        const idx = siblings.findIndex(b => b.id === block.id);
        if (idx <= 0) return;

        const prev = siblings[idx - 1];
        await handleUpdateBlock(block.id, { parent_id: prev.id });
    }, [blocks, handleUpdateBlock]);

    const handleOutdent = useCallback(async (block: Block) => {
        if (!block.parent_id) return;
        const parent = blockById.get(block.parent_id);
        const newParentId = parent ? parent.parent_id : null;
        await handleUpdateBlock(block.id, { parent_id: newParentId });
    }, [blockById, handleUpdateBlock]);

    const handleSlashSelect = useCallback(async (option: SlashMenuOption) => {
        if (!activeSlashBlockId) return;

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

                await handleUpdateBlock(activeSlashBlockId, {
                    content: '',
                    type: newType,
                    metadata: {},
                    properties: {
                        ...(blockById.get(activeSlashBlockId)?.properties || {}),
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

        await handleUpdateBlock(activeSlashBlockId, {
            content: '',
            type: newType,
            metadata: newMetadata,
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
        if (slashMenuOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!e.shiftKey) {
                await createSiblingBlockAfter(block);
            }
        } else if (e.key === 'Backspace' && block.content === '' && block.type !== 'page_break') {
            e.preventDefault();
            await handleDeleteBlock(block);
        } else if (e.key === 'ArrowUp' && !slashMenuOpen) {
            // Let the browser handle caret movement inside textareas.
        } else if (e.key === 'ArrowDown' && !slashMenuOpen) {
            // Let the browser handle caret movement inside textareas.
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) await handleOutdent(block);
            else await handleIndent(block);
        }
    }, [createSiblingBlockAfter, handleDeleteBlock, handleIndent, handleOutdent, slashMenuOpen]);

    const renderBlock = useCallback((block: Block) => {
        const variant = getVariant(block);

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
    }, [focusedBlockId, handleContentChange, handleDeleteBlock, handleKeyDown, handleUpdateBlock]);

    const renderTreeInternal = useCallback((parentId: string | null, depth: number, collectRefs: boolean) => {
        if (parentId) {
            const parent = blockById.get(parentId);
            if (parent?.type === 'lecture_container' && (parent.metadata as any)?.collapsed) {
                return null;
            }
        }

        const children = (parentId ? childrenByParent.get(parentId) : undefined) || [];
        if (children.length === 0) return null;

        return (
            <div className={cn('flex flex-col', depth > 0 && 'ml-6 border-l border-zinc-100 dark:border-zinc-800')}>
                {children.map(child => (
                    <div
                        key={child.id}
                        ref={(el) => {
                            if (collectRefs && el) blockRefs.current.set(child.id, el);
                        }}
                        className="relative"
                        data-block-id={child.id}
                    >
                        <BlockShell>
                            {renderBlock(child)}
                            {renderTreeInternal(child.id, depth + 1, collectRefs)}
                        </BlockShell>
                    </div>
                ))}
            </div>
        );
    }, [childrenByParent, renderBlock]);

    const renderTree = useCallback((parentId: string | null, depth = 0) => {
        return renderTreeInternal(parentId, depth, true);
    }, [renderTreeInternal]);

    const renderTreeForMeasure = useCallback((parentId: string | null, depth = 0) => {
        return renderTreeInternal(parentId, depth, false);
    }, [renderTreeInternal]);

    // --- Pagination ---
    const [pages, setPages] = useState<string[][]>([]); // array of top-level block ids per page
    const [autoPaginationEnabled, setAutoPaginationEnabled] = useState(true);
    const [paginationError, setPaginationError] = useState<AppError | null>(null);
    const [exportError, setExportError] = useState<AppError | null>(null);

    const contentHeightPx = PAGE_HEIGHT_PX - PAGE_PADDING_PX * 2;

    const computePagesSimple = useCallback((items: Block[]) => {
        const nextPages: string[][] = [];
        let current: string[] = [];

        for (const b of items) {
            if (b.type === 'page_break') {
                if (current.length) nextPages.push(current);
                current = [];
                continue;
            }
            current.push(b.id);
        }
        if (current.length) nextPages.push(current);
        return nextPages;
    }, []);

    const computePagination = useCallback(() => {
        if (!autoPaginationEnabled) {
            setPages(computePagesSimple(topLevelBlocks));
            return;
        }

        try {
            const heights = new Map<string, number>();
            for (const b of topLevelBlocks) {
                const el = measureRefs.current.get(b.id);
                heights.set(b.id, el ? el.offsetHeight : 0);
            }

            const nextPages: string[][] = [];
            let current: string[] = [];
            let y = 0;

            for (let i = 0; i < topLevelBlocks.length; i++) {
                const b = topLevelBlocks[i];
                if (b.type === 'page_break') {
                    if (current.length) nextPages.push(current);
                    current = [];
                    y = 0;
                    continue;
                }

                const h = heights.get(b.id) ?? 0;

                // Predictable page-break behavior for headings:
                // If a heading would be the last thing on a page and the next block won't fit,
                // move the heading to the next page (keep headings with their following content).
                const variant = getVariant(b);
                if (isHeadingVariant(variant) && current.length > 0) {
                    let nextNonBreakHeight: number | null = null;
                    for (let j = i + 1; j < topLevelBlocks.length; j++) {
                        const next = topLevelBlocks[j];
                        if (next.type === 'page_break') continue;
                        nextNonBreakHeight = heights.get(next.id) ?? 0;
                        break;
                    }

                    const remaining = contentHeightPx - y;
                    if (nextNonBreakHeight !== null) {
                        // Only apply keep-with-next if the next block is a reasonable size.
                        // If it's huge (bigger than a page), don't force a blank gap.
                        const keepWithNextHeight =
                            nextNonBreakHeight > 0 && nextNonBreakHeight <= contentHeightPx
                                ? nextNonBreakHeight
                                : 0;
                        if (remaining < h + keepWithNextHeight) {
                            nextPages.push(current);
                            current = [];
                            y = 0;
                        }
                    }
                }

                if (current.length > 0 && y + h > contentHeightPx) {
                    nextPages.push(current);
                    current = [b.id];
                    y = h;
                } else {
                    current.push(b.id);
                    y += h;
                }
            }

            if (current.length) nextPages.push(current);
            setPages(nextPages.filter(p => p.length > 0));
            setPaginationError(null);
        } catch (e) {
            const err = toAppError(e, {
                code: 'DOC_PAGINATION_FAILED',
                message: 'Auto-pagination failed',
                retryable: true,
                detail: {
                    topLevelCount: topLevelBlocks.length,
                    template: localTemplate,
                    note: 'No document text included.',
                },
            });
            setPaginationError(err);
            safeLogError('doc.pagination', err);
            // Keep the view usable by falling back to non-measured pagination.
            setPages(computePagesSimple(topLevelBlocks));
        }
    }, [autoPaginationEnabled, computePagesSimple, contentHeightPx, localTemplate, topLevelBlocks]);

    // Large document performance: debounce measured pagination so we don't re-measure on every keystroke.
    const paginationTimerRef = useRef<number | null>(null);
    const paginationRafRef = useRef<number | null>(null);

    const cancelScheduledPagination = useCallback(() => {
        if (paginationTimerRef.current !== null) {
            window.clearTimeout(paginationTimerRef.current);
            paginationTimerRef.current = null;
        }
        if (paginationRafRef.current !== null) {
            window.cancelAnimationFrame(paginationRafRef.current);
            paginationRafRef.current = null;
        }
    }, []);

    const schedulePagination = useCallback(() => {
        if (!autoPaginationEnabled) return;

        // Keep cursor stable: don't repaginate while the editor is focused.
        if (isEditorFocusedRef.current) {
            paginationPendingWhileEditingRef.current = true;
            return;
        }

        cancelScheduledPagination();

        // 250ms is long enough to avoid "between keystrokes" pagination churn,
        // but short enough to keep page breaks feeling responsive.
        paginationTimerRef.current = window.setTimeout(() => {
            paginationRafRef.current = window.requestAnimationFrame(() => {
                computePagination();
            });
        }, 250);
    }, [autoPaginationEnabled, cancelScheduledPagination, computePagination]);

    const handleEditorFocusCapture = useCallback((e: React.FocusEvent) => {
        isEditorFocusedRef.current = true;

        const target = e.target as HTMLElement | null;
        const holder = target?.closest?.('[data-block-id]') as HTMLElement | null;
        const id = holder?.dataset?.blockId;
        if (id) setFocusedBlockId(id);
    }, []);

    const handleEditorBlurCapture = useCallback(() => {
        // Defer so `document.activeElement` reflects the next focused element.
        window.setTimeout(() => {
            const root = docRootRef.current;
            const active = document.activeElement;
            const stillInside = !!(root && active && root.contains(active));

            if (!stillInside) {
                isEditorFocusedRef.current = false;
                setFocusedBlockId(null);

                if (paginationPendingWhileEditingRef.current) {
                    paginationPendingWhileEditingRef.current = false;
                    schedulePagination();
                }
            }
        }, 0);
    }, [schedulePagination]);

    useLayoutEffect(() => {
        if (topLevelBlocks.length === 0) {
            setPages([]);
            return;
        }

        if (!autoPaginationEnabled) {
            setPages(computePagesSimple(topLevelBlocks));
            return;
        }

        schedulePagination();
        return () => cancelScheduledPagination();
    }, [autoPaginationEnabled, computePagesSimple, computePagination, topLevelBlocks, blocks, localTemplate]);

    // Keep pagination updated on container resizes.
    useEffect(() => {
        if (!autoPaginationEnabled) return;
        const ro = new ResizeObserver(() => schedulePagination());
        for (const b of topLevelBlocks) {
            const el = measureRefs.current.get(b.id);
            if (el) ro.observe(el);
        }
        return () => ro.disconnect();
    }, [autoPaginationEnabled, schedulePagination, topLevelBlocks]);

    // --- Footnotes per page (Turabian) ---
    const pageFootnotes = useMemo(() => {
        if (localTemplate !== 'Turabian') return [] as Array<Array<{ n: number; text: string }>>;

        const allCitationsInOrder: Citation[] = [];
        const footnotesByPage: Array<Array<{ n: number; text: string }>> = [];

        let nextN = 1;
        for (const pageIds of pages) {
            const pageCitations: Citation[] = [];
            for (const id of pageIds) {
                const block = blockById.get(id);
                if (!block) continue;

                // DFS over the subtree to pick up citations in reading order
                const stack: Block[] = [block];
                while (stack.length) {
                    const current = stack.shift()!;
                    if (current.type === 'pdf_highlight') {
                        const c = citationFromPdfHighlight(current);
                        pageCitations.push(c);
                        allCitationsInOrder.push(c);
                    }
                    const kids = childrenByParent.get(current.id);
                    if (kids && kids.length) {
                        stack.unshift(...kids);
                    }
                }
            }

            const notesForPage = pageCitations.map(c => {
                const n = nextN++;
                return { n, text: formatTurabianFootnote(c) };
            });
            footnotesByPage.push(notesForPage);
        }

        return footnotesByPage;
    }, [blockById, childrenByParent, localTemplate, pages]);

    const citationsForBibliography = useMemo(() => {
        const citations: Citation[] = [];
        for (const b of blocks) {
            if (b.type !== 'pdf_highlight') continue;
            citations.push(citationFromPdfHighlight(b));
        }
        return uniqueCitations(citations);
    }, [blocks]);

    const handleTemplateChange = useCallback(async (template: DocTemplate) => {
        setLocalTemplate(template);
        await db.projects.update(projectId, {
            metadata: {
                ...(project?.metadata || {}),
                docTemplate: template,
            },
            updated_at: Date.now(),
        });
    }, [project?.metadata, projectId]);

    const insertReferences = useCallback(async () => {
        const existingTopLevel = topLevelBlocks;
        const maxOrder = existingTopLevel.length ? Math.max(...existingTopLevel.map(b => b.order)) : -1;

        const refsHeading: Block = {
            id: uuidv4(),
            parent_id: projectId,
            content: 'References',
            type: 'text',
            order: maxOrder + 2,
            metadata: { variant: 'heading1' },
        };

        const bibliographyText = exportBibliography(citationsForBibliography, localTemplate);
        const lines = bibliographyText
            .split('\n')
            .map(l => l.trimEnd())
            .filter(l => l.length > 0)
            .slice(2); // drop header lines

        const refBlocks: Block[] = lines.map((line, idx) => ({
            id: uuidv4(),
            parent_id: projectId,
            content: line,
            type: 'text',
            order: maxOrder + 3 + idx,
        }));

        const pageBreak: Block = {
            id: uuidv4(),
            parent_id: projectId,
            content: '',
            type: 'page_break',
            order: maxOrder + 1,
        };

        await db.transaction('rw', db.blocks, async () => {
            await db.blocks.add(pageBreak);
            await db.blocks.add(refsHeading);
            await db.blocks.bulkAdd(refBlocks);
        });

        await db.projects.update(projectId, { updated_at: Date.now() });
    }, [citationsForBibliography, localTemplate, projectId, topLevelBlocks]);

    const handleExportPdf = useCallback(() => {
        setExportError(null);

        if (topLevelBlocks.length === 0 || pages.length === 0) {
            setExportError(
                createAppError('NO_PAGES', 'Nothing to export yet', {
                    retryable: false,
                    detail: {
                        topLevelCount: topLevelBlocks.length,
                        pageCount: pages.length,
                        note: 'No document text included.',
                    },
                })
            );
            return;
        }

        try {
            window.print();
        } catch (e) {
            const err = toAppError(e, {
                code: 'PRINT_FAILED',
                message: 'Export failed',
                retryable: true,
                detail: { note: 'window.print threw an error.' },
            });
            setExportError(err);
            safeLogError('doc.export', err);
        }
    }, [pages.length, topLevelBlocks.length]);

    const copyDebugDetails = useCallback(async (error: AppError) => {
        try {
            const text = safeJsonStringify(error);
            await navigator.clipboard.writeText(text);
        } catch {
            // Ignore; clipboard permission errors are common.
        }
    }, []);

    const templatePageTextStyle: React.CSSProperties = useMemo(() => {
        // Academic templates: default to Times + double spacing.
        const base: React.CSSProperties = {
            fontFamily: 'Times New Roman, Times, serif',
        };

        switch (localTemplate) {
            case 'MLA':
                return { ...base, lineHeight: 2 };
            case 'APA':
                return { ...base, lineHeight: 2 };
            case 'Chicago':
                return { ...base, lineHeight: 2 };
            case 'Turabian':
                return { ...base, lineHeight: 2 };
            default:
                return base;
        }
    }, [localTemplate]);

    // If there are no blocks yet, create the first one on click.
    const handleEmptyClick = useCallback(async () => {
        if (topLevelBlocks.length > 0) return;
        await db.blocks.add({
            id: uuidv4(),
            parent_id: projectId,
            content: '',
            type: 'text',
            order: 0,
        });
        await db.projects.update(projectId, { updated_at: Date.now() });
    }, [projectId, topLevelBlocks.length]);

    return (
        <div className="jivvy-docview min-h-[calc(100vh-3rem)] bg-zinc-100 dark:bg-zinc-950">
            {/* Top bar */}
            <div className="jivvy-doc-toolbar sticky top-0 z-30 border-b border-zinc-200/70 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/80 backdrop-blur-sm">
                <div className="mx-auto max-w-[980px] px-6 h-12 flex items-center gap-3">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        Doc Mode
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {lectureContainers.length > 0 && (
                            <>
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
                            </>
                        )}

                        <label className="text-xs text-zinc-500">Template</label>
                        <select
                            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-sm text-zinc-700 dark:text-zinc-200"
                            value={localTemplate}
                            onChange={(e) => handleTemplateChange(e.target.value as DocTemplate)}
                        >
                            <option value="APA">APA</option>
                            <option value="MLA">MLA</option>
                            <option value="Chicago">Chicago</option>
                            <option value="Turabian">Turabian</option>
                        </select>

                        <button
                            type="button"
                            onClick={insertReferences}
                            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            Insert References
                        </button>

                        <button
                            type="button"
                            onClick={handleExportPdf}
                            className="h-8 rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
                        >
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>

            {(paginationError || exportError) && (
                <div className="mx-auto max-w-[980px] px-6 pt-3">
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 flex items-start justify-between gap-3">
                        <div className="text-xs text-zinc-700 dark:text-zinc-200">
                            <div className="font-medium">
                                {paginationError
                                    ? 'Doc pagination error'
                                    : 'Doc export error'}
                            </div>
                            <div className="text-zinc-500 dark:text-zinc-400">
                                {(paginationError ?? exportError)?.message}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {paginationError && autoPaginationEnabled && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAutoPaginationEnabled(false);
                                        setPaginationError(null);
                                        setPages(computePagesSimple(topLevelBlocks));
                                    }}
                                    className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    Disable auto-pagination
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => copyDebugDetails((paginationError ?? exportError) as AppError)}
                                className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                                Debug details
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setPaginationError(null);
                                    setExportError(null);
                                }}
                                className="h-8 rounded-md px-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Trust-based tidying banner (Phase 3) */}
            {tidyStatus !== 'idle' && (
                <div className="mx-auto max-w-[980px] px-6 pt-3">
                    <div className={cn(
                        'rounded-md border px-3 py-2 text-xs flex flex-col gap-2',
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
                                            type="button"
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
                                            type="button"
                                            onClick={dismissTidy}
                                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            Dismiss
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const latest = blockById.get(tidySnapshot.blockId);
                                                if (latest) runTidyForBlock(latest.id, latest.content || '');
                                            }}
                                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            Re-run
                                        </button>
                                    </>
                                )}

                                {tidyStatus === 'applied' && tidySnapshot && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await handleUpdateBlock(tidySnapshot.blockId, { content: tidySnapshot.originalText });
                                                setFocusedBlockId(tidySnapshot.blockId);
                                                dismissTidy();
                                            }}
                                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            Undo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={dismissTidy}
                                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            Dismiss
                                        </button>
                                    </>
                                )}

                                {tidyStatus === 'error' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const targetId = tidySnapshot?.blockId ?? focusedBlockId;
                                                if (!targetId) return;
                                                const latest = blockById.get(targetId);
                                                if (latest) runTidyForBlock(latest.id, latest.content || '');
                                            }}
                                            className="px-2 py-1 rounded-md bg-red-500/20 text-red-700 dark:text-red-200 hover:bg-red-500/30"
                                        >
                                            Retry
                                        </button>
                                        <button
                                            type="button"
                                            onClick={dismissTidy}
                                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            Dismiss
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {(tidyStatus === 'ready' || tidyStatus === 'applied') && tidySnapshot && (
                            <div className="text-[11px] text-zinc-600 dark:text-zinc-300/90">
                                <div className="truncate">Original: {tidySnapshot.originalText}</div>
                                <div className="truncate">Suggested: {tidySnapshot.correctedText}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden measurer - same width + template styles */}
            <div className="fixed left-[-99999px] top-0 w-[816px] pointer-events-none opacity-0" aria-hidden>
                <div style={templatePageTextStyle}>
                    {topLevelBlocks.map(b => (
                        <div
                            key={b.id}
                            ref={(el) => {
                                if (el) measureRefs.current.set(b.id, el);
                            }}
                        >
                            <div className="px-8 py-6">
                                <BlockShell>
                                    {renderBlock(b)}
                                    {renderTreeForMeasure(b.id, 1)}
                                </BlockShell>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pages */}
            <div
                className="mx-auto max-w-[980px] px-6 py-10"
                onClick={handleEmptyClick}
                ref={docRootRef}
                onFocusCapture={handleEditorFocusCapture}
                onBlurCapture={handleEditorBlurCapture}
            >
                {pages.length === 0 ? (
                    <div className="text-sm text-zinc-500">Click to start writing…</div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {pages.map((pageIds, pageIndex) => (
                            <div
                                key={pageIndex}
                                className="jivvy-doc-page bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                                style={{ width: PAGE_WIDTH_PX, minHeight: PAGE_HEIGHT_PX }}
                            >
                                <div
                                    className="page-container"
                                    style={{ padding: PAGE_PADDING_PX, ...templatePageTextStyle }}
                                >
                                    {pageIds.map(id => {
                                        const block = blockById.get(id);
                                        if (!block) return null;
                                        return (
                                            <div
                                                key={id}
                                                className="relative"
                                                ref={(el) => {
                                                    if (el) blockRefs.current.set(id, el);
                                                }}
                                                data-block-id={id}
                                            >
                                                <BlockShell>
                                                    {renderBlock(block)}
                                                    {renderTree(block.id, 1)}
                                                </BlockShell>
                                            </div>
                                        );
                                    })}
                                </div>

                                {localTemplate === 'Turabian' && pageFootnotes[pageIndex]?.length ? (
                                    <div className="px-10 pb-6 -mt-2">
                                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 mb-2" />
                                        <div className="space-y-1">
                                            {pageFootnotes[pageIndex].map(note => (
                                                <div key={note.n} className="text-[12px] text-zinc-700 dark:text-zinc-200">
                                                    <span className="align-top mr-1">{note.n}.</span>
                                                    <span>{note.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Slash Command Menu */}
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
