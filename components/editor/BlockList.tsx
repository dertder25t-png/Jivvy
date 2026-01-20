'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Block, db, deleteBlockRecursively, BlockType, Flashcard } from '@/lib/db';
import { TextBlock } from './blocks/TextBlock';
import { TaskBlock } from './blocks/TaskBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { PDFHighlightBlock } from './blocks/PDFHighlightBlock';
import { PageBreakBlock } from './blocks/PageBreakBlock';
import { LectureContainerBlock } from './blocks/LectureContainerBlock';
import { SubpageBlock } from './blocks/SubpageBlock';
import { TextSelectionToolbar } from './TextSelectionToolbar';
import { SlashMenu, SlashMenuOption } from './SlashMenu';
import { SortableBlockWrapper } from './SortableBlockWrapper';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/lib/store';
import { useLiveQuery } from 'dexie-react-hooks';
import { SquareStack, Zap } from 'lucide-react';
import { parseHtmlToBlocks, ParsedBlockPreview } from '@/lib/html-parser';
// import { detectPatterns } from '@/lib/pattern-engine'; // Removed specific import, handled in worker

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
    variant?: 'document' | 'todoist'; // Added 'todoist' for list view
    projectColor?: string;
}

export function BlockList({ projectId, variant = 'document', projectColor }: BlockListProps) {
    const {
        blocks,
        setContextPanelOpen,
        setContextPanelView,
        loadProject,
        addBlock,
        updateBlock,
        deleteBlock,
        reorderBlocks,
        setBlocks,
        createBlock,
        isLoading,
        suggestedFlashcards,
        setFlashcardTab,
        setManualFlashcardData
    } = useStore();

    // Load project on mount/change
    useEffect(() => {
        if (projectId) {
            loadProject(projectId);
        }
    }, [projectId, loadProject]);

    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');

    // Web Worker for Flashcards
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Use relative path for Webpack bundling
        // This relies on Next.js/Webpack 5+ automatic worker handling
        workerRef.current = new Worker(new URL('../../workers/pattern-engine.worker.ts', import.meta.url));

        if (workerRef.current) {
            workerRef.current.onmessage = (e) => {
                const { patterns, blockId } = e.data;
                if (patterns && patterns.length > 0) {
                    patterns.forEach((pattern: any) => {
                        useStore.getState().addSuggestion({
                            id: uuidv4(),
                            blockId,
                            timestamp: Date.now(),
                            ...pattern
                        });
                        // Optional: open panel on high confidence?
                        // useStore.getState().setContextPanelOpen(true);
                    });
                }
            };

            return () => {
                workerRef.current?.terminate();
            };
        }
    }, []);

    // Flashcard count (Live Query)
    const flashcardCount = useLiveQuery(
        async () => {
            if (!projectId) return 0;
            return db.flashcards.where('project_id').equals(projectId).count();
        },
        [projectId],
        0
    );

    const lectureContainers = React.useMemo(() => {
        const lectures = blocks.filter(b => b.type === 'lecture_container');
        return lectures.sort((a, b) => {
            const an = typeof a.metadata?.lecture_number === 'number' ? a.metadata.lecture_number : Number.POSITIVE_INFINITY;
            const bn = typeof b.metadata?.lecture_number === 'number' ? b.metadata.lecture_number : Number.POSITIVE_INFINITY;
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

    // Lecture hint state
    const [showLectureHints, setShowLectureHints] = useState(false);
    const lectureHintTimeoutRef = useRef<number | null>(null);

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

    // Track if we're the source of updates to prevent cursor jumping
    const isLocalUpdateRef = useRef(false);
    const localUpdateTimeoutRef = useRef<number | null>(null);

    // Sync external changes only - skip if we just made a local update
    // MOVED TO STORE: Real-time syncing is handled by the store or manual refresh for now. 
    // This effect is disabled to prevent conflicts with store state.

    // Mark local updates and clear after a short delay
    const markLocalUpdate = useCallback(() => {
        isLocalUpdateRef.current = true;
        if (localUpdateTimeoutRef.current) {
            window.clearTimeout(localUpdateTimeoutRef.current);
        }
        localUpdateTimeoutRef.current = window.setTimeout(() => {
            isLocalUpdateRef.current = false;
        }, 500); // 500ms window for DB to propagate
    }, []);

    const handleUpdateBlock = useCallback(async (id: string, updates: Partial<Block>) => {
        markLocalUpdate();
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
        await db.blocks.update(id, updates);
    }, [markLocalUpdate]);

    const handleCreateBlock = useCallback(async (currentBlock: Block, typeOverride?: BlockType) => {
        // Close slash menu if open
        setSlashMenuOpen(false);
        setSlashFilterText('');
        markLocalUpdate();

        // Special handling for LectureContainer: Enter creates a child node inside it
        if (currentBlock.type === 'lecture_container') {
            // Find existing children to determine order
            const children = blocks.filter(b => b.parent_id === currentBlock.id);
            const maxOrder = children.reduce((max, b) => Math.max(max, b.order), -1);

            const newBlock: Block = {
                id: uuidv4(),
                parent_id: currentBlock.id,
                content: '',
                type: 'text',
                metadata: { variant: 'bullet' }, // Default to bullet for lecture notes as requested
                order: maxOrder + 1,
                updated_at: Date.now(),
                sync_status: 'dirty'
            };

            // Ensure not collapsed
            if ((currentBlock.metadata as any)?.collapsed) {
                await handleUpdateBlock(currentBlock.id, {
                    metadata: { ...currentBlock.metadata, collapsed: false }
                });
            }

            await db.blocks.add(newBlock);
            setBlocks(prev => [...prev, newBlock].sort((a, b) => a.order - b.order));
            setFocusedBlockId(newBlock.id);
            return;
        }

        // Determine new block type and metadata based on previous block
        let newType: BlockType = 'text';
        let newMetadata: Record<string, any> = {};

        if (currentBlock.type === 'task') {
            newType = 'task';
            newMetadata = { status: 'todo' };
        } else if (currentBlock.type === 'text') {
            const variant = currentBlock.metadata?.variant;
            if (variant === 'bullet' || variant === 'main_point') {
                newMetadata = { variant };
            }
            // Headings revert to normal text
        }

        const newBlock: Block = {
            id: uuidv4(),
            parent_id: currentBlock.parent_id,
            content: '',
            type: newType,
            order: currentBlock.order + 1,
            metadata: newMetadata,
            updated_at: Date.now(),
            sync_status: 'dirty'
        };

        const siblings = blocks.filter(b => b.parent_id === currentBlock.parent_id && b.order > currentBlock.order);
        await Promise.all(siblings.map(b => db.blocks.update(b.id, { order: b.order + 1 })));
        await db.blocks.add(newBlock);

        const updatedPeers = siblings.map(b => ({ ...b, order: b.order + 1 }));
        const others = blocks.filter(b => !siblings.find(s => s.id === b.id));

        setBlocks([...others, ...updatedPeers, newBlock].sort((a, b) => a.order - b.order));
        setFocusedBlockId(newBlock.id);
    }, [blocks, markLocalUpdate, handleUpdateBlock]);

    const handleDeleteBlock = useCallback(async (block: Block) => {
        if (blocks.length <= 1) {
            // Revert last block to empty text if user tries to delete it
            if (block.type !== 'text' || block.content.trim() !== '') {
                await handleUpdateBlock(block.id, { type: 'text', content: '', metadata: {} });
            }
            return;
        }
        markLocalUpdate();

        const currentIndex = blocks.findIndex(b => b.id === block.id);
        const prevBlock = blocks[currentIndex - 1];

        // Recursive delete to ensure no orphaned children (Shadow Realm fix)
        const deletedIds = await deleteBlockRecursively(block.id);
        const deletedSet = new Set(deletedIds);

        setBlocks(prev => prev.filter(b => !deletedSet.has(b.id)));

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
        markLocalUpdate();
    }, [blocks, handleUpdateBlock, markLocalUpdate]);

    const handleOutdent = useCallback(async (block: Block) => {
        if (!block.parent_id) return; // Already at root level

        const parent = blocks.find(b => b.id === block.parent_id);
        const newParentId = parent ? parent.parent_id : null;

        // Update to new parent (could be null for root level)  
        await handleUpdateBlock(block.id, { parent_id: newParentId ?? undefined });
        markLocalUpdate();
    }, [blocks, handleUpdateBlock, markLocalUpdate]);






    // Pattern Detection (Debounced via Worker)
    const runPatternDetection = useCallback((blockId: string, text: string) => {
        if (workerRef.current) {
            workerRef.current.postMessage({ text, blockId });
        }
    }, []);

    // Simple debounce wrapper
    const debouncedDetection = useRef<NodeJS.Timeout | null>(null);
    const triggerDetection = useCallback((blockId: string) => {
        if (debouncedDetection.current) clearTimeout(debouncedDetection.current);
        debouncedDetection.current = setTimeout(() => {
            // Get fresh blocks from store to avoid stale closure
            const currentBlocks = useStore.getState().blocks;

            // Helper to collect text from fresh blocks
            const collect = (id: string, depth: number): string[] => {
                const block = currentBlocks.find(b => b.id === id);
                if (!block) return [];

                const lines: string[] = [];
                const indent = '  '.repeat(depth);
                if (block.content?.trim()) {
                    lines.push(`${indent}${block.content.trim()}`);
                }

                // Find children
                const children = currentBlocks.filter(b => b.parent_id === id).sort((a, b) => a.order - b.order);
                children.forEach(child => {
                    lines.push(...collect(child.id, depth + 1));
                });
                return lines;
            };

            // Start collection from the requested block (or its parent if it's a child)
            // Ideally we want to scan the 'concept' level. 
            // If the user edits a child, we should probably scan the parent to capture the full context (e.g. "Term" -> "Definition")

            let targetId = blockId;
            const targetBlock = currentBlocks.find(b => b.id === blockId);

            if (targetBlock) {
                // 1. Find the Ultimate Parent (Lecture Container)
                // We want to pass the WHOLE lecture context to the AI, not just the bullet point.
                const findContainer = (b: Block): string | null => {
                    if (b.type === 'lecture_container') return b.id;
                    if (!b.parent_id) return null;
                    const p = currentBlocks.find(x => x.id === b.parent_id);
                    return p ? findContainer(p) : null;
                };

                const containerId = findContainer(targetBlock);

                // 2. If inside a lecture, scan the WHOLE lecture. 
                // This ensures "Lecture Title" is the root context for all cards.
                if (containerId) {
                    targetId = containerId;
                } else if (targetBlock.parent_id) {
                    // Fallback for non-lecture lists: scan immediate parent
                    const parent = currentBlocks.find(b => b.id === targetBlock.parent_id);
                    if (parent) targetId = parent.id;
                }
            }

            const fullText = collect(targetId, 0).join('\n');

            // Clear old suggestions for this block/section to ensure ephemeral updates
            // (e.g. if user deletes text, old suggestions should go away)
            useStore.getState().clearSuggestionsForBlock(targetId);

            runPatternDetection(targetId, fullText);
        }, 1000);
    }, [runPatternDetection]);

    const handlePasteRows = useCallback(async (parentId: string, rows: string[]) => {
        if (rows.length === 0) return;

        const siblings = blocks.filter(b => b.parent_id === parentId);
        const startOrder = siblings.reduce((max, b) => Math.max(max, b.order), -1) + 1;

        // Pre-process rows to determine properties and normalization
        const parsedRows = rows.map(originalRow => {
            // Calculate indentation
            const matchIndex = originalRow.search(/\S|$/);
            const indentStr = originalRow.slice(0, matchIndex);
            // Heuristic: 2 spaces or 1 tab = 1 level
            const spaces = indentStr.replace(/\t/g, '  ').length;
            const indentLevel = Math.floor(spaces / 2);

            let content = originalRow.slice(matchIndex);
            let variant: 'bullet' | 'heading1' | 'heading2' | 'main_point' | undefined;
            let type: BlockType = 'text';
            let metadata: Record<string, any> = {};

            // Markdown detection
            if (content.startsWith('*** ')) {
                // Special case
            }
            if (content.startsWith('* ')) {
                content = content.substring(2);
                variant = 'main_point';
                metadata = { variant: 'main_point' };
            } else if (content.startsWith('- ')) {
                content = content.substring(2);
                variant = 'bullet';
                metadata = { variant: 'bullet' };
            } else if (content.startsWith('[] ') || content.startsWith('[ ] ')) {
                content = content.substring(content.indexOf(']') + 1).trim();
                type = 'task';
                metadata = { status: 'todo' };
            } else if (content.startsWith('## ')) {
                content = content.substring(3);
                variant = 'heading2';
                metadata = { variant: 'heading2' };
            } else if (content.startsWith('# ')) {
                content = content.substring(2);
                variant = 'heading1';
                metadata = { variant: 'heading1' };
            }

            return {
                id: uuidv4(),
                indentLevel,
                content,
                type,
                metadata,
                variant
            };
        });

        // Normalize indentation
        const minIndent = Math.min(...parsedRows.map(r => r.indentLevel));
        const normalizedRows = parsedRows.map(r => ({ ...r, indentLevel: r.indentLevel - minIndent }));

        const newBlocks: Block[] = [];
        const stack = [{ level: -1, id: parentId }];
        const orderMap = new Map<string, number>();
        orderMap.set(parentId, startOrder);

        for (const row of normalizedRows) {
            while (stack.length > 1 && stack[stack.length - 1].level >= row.indentLevel) {
                stack.pop();
            }

            const parent = stack[stack.length - 1];
            const currentOrder = orderMap.get(parent.id) || 0;
            orderMap.set(parent.id, currentOrder + 1);

            const newBlock: Block = {
                id: row.id,
                parent_id: parent.id,
                content: row.content,
                type: row.type,
                order: currentOrder,
                metadata: row.metadata,
                updated_at: Date.now(),
                sync_status: 'dirty'
            };

            newBlocks.push(newBlock);

            stack.push({ level: row.indentLevel, id: row.id });
            orderMap.set(row.id, 0);
        }

        await db.blocks.bulkAdd(newBlocks);
        setBlocks(prev => [...prev, ...newBlocks]);
        // Trigger detection on the parent to update suggestions for the whole section
        if (triggerDetection) triggerDetection(parentId);
    }, [blocks, triggerDetection]);

    useEffect(() => {
        if (projectId) {
            loadProject(projectId);
        }
    }, [projectId]); // Removed loadProject dependency loop

    // Auto-create first block if empty
    useEffect(() => {
        // Only run if we've loaded (not loading) and have no blocks, and have a valid projectId
        // check internal loading state or just blocks.length
        if (blocks.length === 0 && projectId) {
            // We need to be careful not to create multiple.
            // Usually store should handle "loading" vs "empty".
            // Assuming loadProject works and returns empty array.
            // Let's add a small timeout or check if we just loaded?
            // Actually, the store has `isLoading`.
            // But we can't see isLoading from here easily unless we destructured it (we didn't).
            // Let's check if we can add 'isLoading' to destructuring.
            const timer = setTimeout(() => {
                if (useStore.getState().blocks.length === 0 && !useStore.getState().isLoading) {
                    createBlock(projectId, 'text', 0);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [blocks.length, projectId]);

    useEffect(() => {
        // Paste logic (previous implementation)
        const handlePaste = async (e: ClipboardEvent) => {
            if (!document.activeElement) return;

            const blockEl = (document.activeElement as HTMLElement)?.closest('[data-block-id]');
            const blockId = blockEl?.getAttribute('data-block-id');
            if (!blockId) return;

            const block = blocks.find(b => b.id === blockId);
            if (!block) return;

            // RICH TEXT PASTE SUPPORT
            const html = e.clipboardData?.getData('text/html');
            const text = e.clipboardData?.getData('text/plain');

            e.preventDefault();

            if (html) {
                const parsedBlocks = parseHtmlToBlocks(html);
                if (parsedBlocks.length > 0) {
                    // We have rich blocks!
                    // We need to insert these relative to the current block
                    const parentId = block.parent_id || projectId;

                    // 1. Calculate start order
                    const siblings = blocks.filter(b => b.parent_id === parentId);
                    const startOrder = siblings.reduce((max, b) => Math.max(max, b.order), -1) + 1;

                    // 2. Prepare new blocks with proper IDs and hierarchy relative to the paste location?
                    // Actually, if we just append them to the end of the list like 'handlePasteRows' does, that might be confusing if we are in the middle of a list.
                    // The existing 'handlePasteRows' logic appends to the end of the parent's children list.
                    // Let's stick to that behavior for consistency for now, or improve it to insert *after* the current block.

                    // Let's try to insert AFTER the current block.
                    const currentBlock = blocks.find(b => b.id === blockId);
                    const insertionOrder = currentBlock ? currentBlock.order + 1 : startOrder;

                    // Shift existing siblings down if we are inserting in the middle
                    if (currentBlock) {
                        const laterSiblings = siblings.filter(b => b.order > currentBlock.order);
                        if (laterSiblings.length > 0) {
                            // This db call might be heavy if many siblings
                            await Promise.all(laterSiblings.map(b => db.blocks.update(b.id, { order: b.order + parsedBlocks.length })));
                        }
                    }

                    const newBlocks: Block[] = [];
                    const stack: { level: number, id: string }[] = [{ level: -1, id: parentId }];

                    // We need a way to track the hierarchy based on the parsed indent levels
                    // The parser returns a flat list with 'indentLevel'.

                    // Re-map IDs to ensure we control them? Parser already gives UUIDs.
                    // We just need to link them up.

                    // Normalize indent
                    const minIndent = Math.min(...parsedBlocks.map(b => b.indentLevel));
                    const normalized = parsedBlocks.map(b => ({ ...b, indentLevel: b.indentLevel - minIndent }));

                    let currentOrderCounter = insertionOrder;

                    for (const pb of normalized) {
                        // Adjust stack
                        while (stack.length > 1 && stack[stack.length - 1].level >= pb.indentLevel) {
                            stack.pop();
                        }
                        const parent = stack[stack.length - 1];

                        // Create block
                        const newBlock: Block = {
                            id: pb.id,
                            parent_id: parent.id,
                            content: pb.content,
                            type: pb.type,
                            order: currentOrderCounter++, // This order logic is simplistic for nested items. 
                            // Realistically, order is per-parent. 
                            // But if we just increment globally it works if we don't reset for new parents.
                            // BUT: Jivvy uses 'order' scoped to parent.

                            metadata: pb.metadata,
                            updated_at: Date.now(),
                            sync_status: 'dirty'
                        };

                        // Fix order: If we are adding to a new parent (nested), start order at 0?
                        // Or just append. 
                        // Let's assume the parser order is the visual order.
                        // We need to query the parent's current max order? 
                        // Since we are doing this in a batch, we can track it in memory.
                        // Ideally we'd need a map of parentId -> nextOrder.

                        // Let's simplify: Use a map for order tracking
                        // (We need to initialize it with existing children counts if we insert into existing parents... 
                        // but here we are mostly creating NEW parents or inserting into the main parent)

                        // For the main parent (paste target), we managed the hole.
                        // For new parents (items we just created), they are empty, so order starts at 0.

                        if (!newBlocks.some(b => b.parent_id === parent.id)) {
                            // This is the first child we are adding to this parent in this batch.
                            // Logic handles existing children? No, these are new parents from the paste.
                            // EXCEPT the root parent.
                        }

                        // Hacky but robust: just set order = currentOrderCounter and let the UI sort it out?
                        // No, let's do it right.

                        // We can use a map: parentId -> nextOrder
                        // But we can't easily query DB for every item.

                        // If parent.id is one of the NEW blocks, order starts at 0.
                        // If parent.id is the existing root, order continues from insertionOrder.

                        // Actually, 'order' in Jivvy seems to be used for sorting siblings.

                        newBlocks.push(newBlock);

                        stack.push({ level: pb.indentLevel, id: pb.id });
                    }

                    // Fix sibling orders for the root items
                    // The loop above didn't set correct 'order' for siblings in new parents.
                    const orderMap = new Map<string, number>();
                    newBlocks.forEach(b => {
                        if (!b.parent_id) return;
                        const current = orderMap.get(b.parent_id);
                        if (current === undefined) {
                            // If parent is the root paste target, start at insertionOrder
                            if (b.parent_id === parentId) {
                                orderMap.set(b.parent_id, insertionOrder + 1);
                                b.order = insertionOrder;
                            } else {
                                orderMap.set(b.parent_id, 1);
                                b.order = 0;
                            }
                        } else {
                            orderMap.set(b.parent_id, current + 1);
                            b.order = current;
                        }
                    });

                    await db.blocks.bulkAdd(newBlocks);
                    setBlocks(prev => {
                        // Merge and sort
                        const combined = [...prev, ...newBlocks];
                        return combined; //.sort((a,b) => a.order - b.order); // Sorting is usually done by parent
                    });

                    // Trigger detection on the parent
                    if (triggerDetection) triggerDetection(parentId);
                    return;
                }
            }

            // Fallback to plain text
            if (!text) return;

            const rows = text.split('\n').filter(row => row.trim() !== '');

            if (rows.length === 0) return;

            // If only one row, just insert into current block
            if (rows.length === 1) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents(); // Delete selected text
                    range.insertNode(document.createTextNode(rows[0]));
                    // Manually update content and trigger detection
                    handleUpdateBlock(blockId, { content: blockEl?.textContent || '' });
                    triggerDetection(blockId);
                }
            } else {
                // If multiple rows, create new blocks
                await handlePasteRows(block.parent_id || projectId, rows);
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [blocks, projectId, handlePasteRows, handleUpdateBlock, triggerDetection]);

    // Slash menu trigger - detect "/" being typed
    const handleContentChange = useCallback((blockId: string, content: string) => {
        triggerDetection(blockId);

        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        if (block.type === 'text') {
            // Markdown triggers
            if (content === '* ' || content === '- ') {
                handleUpdateBlock(blockId, {
                    content: '',
                    metadata: { ...block.metadata, variant: 'bullet' }
                });
                return;
            }
            // Main Point trigger (user requested * specifically for bold main points)
            // Since * was previously just bullet, we need to decide.
            // Requirement: "* for main points these would be bold"
            // Requirement: "sub point ... adds a - to the next line" -> bullet
            // So: * -> Main Point, - -> Bullet
            if (content === '* ') {
                handleUpdateBlock(blockId, {
                    content: '',
                    metadata: { ...block.metadata, variant: 'main_point' }
                });
                return;
            }
            if (content === '- ') {
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

        // Show hints if modifying a lecture child
        if (!block.parent_id) return;
        const parent = blocks.find(b => b.id === block.parent_id);
        if (parent?.type === 'lecture_container') {
            setShowLectureHints(true);
            if (lectureHintTimeoutRef.current) window.clearTimeout(lectureHintTimeoutRef.current);
            lectureHintTimeoutRef.current = window.setTimeout(() => setShowLectureHints(false), 4000);
        }
    }, [activeSlashBlockId, blocks, handleUpdateBlock, slashMenuOpen]);

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
                    .map(b => b.metadata?.lecture_number)
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
                    .reduce((acc, n) => Math.max(acc, n), 0);

                const nextLecture = maxLecture + 1;
                newMetadata = { ...newMetadata, variant: undefined };

                await handleUpdateBlock(activeSlashBlockId, {
                    content: '',
                    type: newType,
                    metadata: {
                        ...newMetadata,
                        ...(blocks.find(b => b.id === activeSlashBlockId)?.metadata || {}),
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
            case 'subpage': {
                newType = 'subpage';
                // Create a new project for this page
                const newProjectId = uuidv4();

                // Add project to DB
                await db.projects.add({
                    id: newProjectId,
                    title: 'New Page',
                    parent_project_id: projectId,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    sync_status: 'dirty',
                    is_archived: false
                });

                newMetadata = { child_project_id: newProjectId };
                break;
            }
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

    const handleMakeMainPoint = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === 3 && container.parentElement) container = container.parentElement;

        const blockEl = (container as Element)?.closest('[data-block-id]');
        const blockId = blockEl?.getAttribute('data-block-id');

        if (!blockId) return;
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        // Convert to main point
        await handleUpdateBlock(blockId, { metadata: { ...block.metadata, variant: 'main_point' } });

        // Clear selection to dismiss toolbar
        selection.removeAllRanges();
    }, [blocks, handleUpdateBlock]);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent, block: Block) => {
        // If slash menu is open, let it handle arrow keys and enter
        if (slashMenuOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
            // Don't prevent default here - SlashMenu handles this via window event
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!e.shiftKey) {
                // Normal Enter
                await handleCreateBlock(block, variant === 'todoist' ? 'task' : undefined);
            } else {
                // Shift+Enter: Break out of container (Lecture) or forced sibling
                const parent = blocks.find(b => b.id === block.parent_id);
                if (parent && parent.type === 'lecture_container') {
                    // Create sibling of parent (break out of lecture)
                    const newBlock: Block = {
                        id: uuidv4(),
                        parent_id: parent.parent_id,
                        content: '',
                        type: 'text',
                        order: parent.order + 1,
                        metadata: { variant: 'bullet' },
                        updated_at: Date.now(),
                        sync_status: 'dirty'
                    };

                    const siblings = blocks.filter(b => b.parent_id === parent.parent_id && b.order > parent.order);
                    await Promise.all(siblings.map(b => db.blocks.update(b.id, { order: b.order + 1 })));
                    await db.blocks.add(newBlock);

                    // Optimistic
                    const updatedPeers = siblings.map(b => ({ ...b, order: b.order + 1 }));
                    const others = blocks.filter(b => !siblings.find(s => s.id === b.id) && b.id !== newBlock.id);
                    setBlocks([...others, ...updatedPeers, newBlock].sort((a, b) => a.order - b.order));
                    setFocusedBlockId(newBlock.id);
                } else {
                    // Normal Shift+Enter behavior (maybe just regular enter behavior for now?)
                    await handleCreateBlock(block, variant === 'todoist' ? 'task' : undefined);
                }
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
        const seenIds = new Set<string>();
        for (const b of blocks) {
            if (seenIds.has(b.id)) continue;
            seenIds.add(b.id);
            const pid = b.parent_id ?? null;
            const arr = map.get(pid);
            if (arr) arr.push(b);
            else map.set(pid, [b]);
        }
        for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
        return map;
    }, [blocks]);

    // Helper: Find the lecture container that owns a block
    const findLectureContainer = useCallback((blockId: string): string | null => {
        let current = blocks.find(b => b.id === blockId);
        while (current) {
            if (current.type === 'lecture_container') return current.id;
            if (!current.parent_id) return null;
            current = blocks.find(b => b.id === current!.parent_id);
        }
        return null;
    }, [blocks]);

    // Helper: Collect all text content from a section (block + descendants)
    const collectSectionText = useCallback((blockId: string): string => {
        const lines: string[] = [];
        const collect = (id: string, depth: number) => {
            const block = blocks.find(b => b.id === id);
            if (!block) return;
            const indent = '  '.repeat(depth);
            if (block.content?.trim()) {
                lines.push(`${indent}${block.content.trim()}`);
            }
            const children = blockMap.get(id) || [];
            children.forEach(child => collect(child.id, depth + 1));
        };
        collect(blockId, 0);
        return lines.join('\n');
    }, [blocks, blockMap]);

    // Helper: Collect parent context
    const collectParentContext = useCallback((blockId: string): string => {
        const contextLines: string[] = [];
        let current = blocks.find(b => b.id === blockId);

        while (current && current.parent_id) {
            const pid = current.parent_id;
            const parent = blocks.find(b => b.id === pid);
            if (parent && parent.content?.trim() && parent.type !== 'lecture_container') { // Skip lecture container itself
                contextLines.unshift(parent.content.trim());
            }
            current = parent;
        }
        return contextLines.join(' > ');
    }, [blocks]);

    // Queue a section for flashcard generation (called after structure changes)



    const getBlockVariant = (block: Block): 'heading1' | 'heading2' | 'bullet' | 'main_point' | undefined => {
        return block.metadata?.variant as 'heading1' | 'heading2' | 'bullet' | 'main_point' | undefined;
    };

    const getBlockIds = (parentId: string | null): string[] => {
        const children = blockMap.get(parentId) || [];
        return children.map(b => b.id);
    };

    const renderBlock = (block: Block) => {
        const explicitVariant = getBlockVariant(block);
        const hasChildren = (blockMap.get(block.id)?.length ?? 0) > 0;
        const isCollapsed = !!(block.metadata as any)?.collapsed;

        // Auto-detect main points: any text block with children inside a lecture is a main point
        const isInsideLecture = !!findLectureContainer(block.id);
        const isAutoMainPoint = block.type === 'text' && hasChildren && isInsideLecture;
        const variant = isAutoMainPoint ? 'main_point' : explicitVariant;

        // Check if this block is currently being processed for flashcards
        const isProcessingFlashcards = false; // Removed logic

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
                    projectColor={projectColor}
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
                hasChildren={hasChildren}
                isCollapsed={isCollapsed}
                isProcessingFlashcards={isProcessingFlashcards}
                onUpdate={(id, updates) => {
                    if ('content' in updates) handleContentChange(id, updates.content || '');
                    else handleUpdateBlock(id, updates);
                }}
                onKeyDown={handleKeyDown}
                autoFocus={block.id === focusedBlockId}
                onDelete={() => handleDeleteBlock(block)}
                onPasteRows={(rows) => handlePasteRows(block.parent_id!, rows)}
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

    // Render Tree
    const renderTree = (parentId: string | null, depth: number = 0) => {
        if (parentId) {
            const parent = blocks.find(b => b.id === parentId);
            if (parent && (parent.metadata as any)?.collapsed) {
                return null;
            }
        }

        const children = blockMap.get(parentId) || [];
        if (children.length === 0) return null;

        const blockIds = getBlockIds(parentId);

        // Visual guide for Lecture Content ("Drag-and-Drop Jail" Fix)
        const isLectureChild = parentId && blocks.find(b => b.id === parentId)?.type === 'lecture_container';

        // Todoist Variant: Less visual nesting, flat list feel (though still tree struct)
        const nestedClass = variant === 'todoist'
            ? cn('flex flex-col', depth > 0 && 'ml-8')
            : cn(
                'flex flex-col',
                depth > 0 && 'ml-6 border-l border-zinc-100 dark:border-zinc-800',
                // Add strong visual cue for direct children of a lecture
                isLectureChild && "ml-6 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/10 rounded-r-sm"
            );

        return (
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                <div className={nestedClass}>
                    {children.map(child => (
                        <div
                            key={child.id}
                            className={cn("relative", variant === 'todoist' && "mb-1")}
                            data-block-id={child.id}
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
        <div className={cn("w-full relative", variant === 'todoist' ? "pl-2 max-w-2xl mx-auto" : "pb-32 pl-8")}>
            {/* Lecture Hints Overlay (Fixed bottom right or center bottom) */}
            <div className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white px-4 py-2 rounded-full shadow-lg backdrop-blur-sm transition-opacity duration-500 z-50 pointer-events-none flex items-center gap-4 text-xs font-medium",
                showLectureHints ? "opacity-100" : "opacity-0"
            )}>
                <span className="flex items-center gap-1"><kbd className="bg-zinc-700 px-1 rounded">Tab</kbd> Indent</span>
                <span className="flex items-center gap-1"><kbd className="bg-zinc-700 px-1 rounded text-[10px]">Shift+Tab</kbd> Outdent</span>
                <span className="flex items-center gap-1"><kbd className="bg-zinc-700 px-1 rounded">*</kbd> Main Point</span>
                <span className="flex items-center gap-1"><kbd className="bg-zinc-700 px-1 rounded">-</kbd> Bullet</span>
            </div>

            {/* Flashcard Status Bar - Shows count and processing status */}
            {(flashcardCount > 0 || suggestedFlashcards.length > 0) && (
                <div
                    onClick={() => {
                        setContextPanelOpen(true);
                        setContextPanelView('flashcards');
                    }}
                    className="flex items-center gap-2 mx-2 mb-2 px-3 py-2 rounded-md border border-lime-500/20 bg-lime-500/5 text-xs cursor-pointer hover:bg-lime-500/10 transition-colors"
                >
                    <SquareStack size={14} className="text-lime-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                        <span className="font-medium text-lime-600 dark:text-lime-400">{flashcardCount}</span> cards
                        {suggestedFlashcards.length > 0 && <span className="text-lime-500"> (+{suggestedFlashcards.length} suggested)</span>}
                    </span>
                </div>
            )}

            {lectureContainers.length > 0 && (
                <div className="flex items-center justify-end gap-2 mb-2 pr-2">
                    <button
                        onClick={() => {
                            setContextPanelOpen(true);
                            setContextPanelView('flashcards');
                        }}
                        className="h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                        title="Open Flashcards"
                    >
                        <Zap size={14} className="text-amber-500" />
                        <span>Flashcards</span>
                    </button>
                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
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
                            const n = typeof l.metadata?.lecture_number === 'number' ? l.metadata.lecture_number : undefined;
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

            {/* Click to append area */}
            <div
                className="h-32 w-full cursor-text"
                onClick={() => {
                    // Find the last block
                    const lastBlock = blocks[blocks.length - 1];
                    if (lastBlock) {
                        // Create sibling after last block
                        if (lastBlock.type === 'lecture_container') {
                            // Break out logic manually
                            createBlock(projectId, 'text', lastBlock.order + 1);
                        } else {
                            createBlock(projectId, 'text', lastBlock.order + 1);
                        }
                    } else if (blocks.length === 0) {
                        createBlock(projectId, 'text', 0);
                    }
                }}
            />

            <SlashMenu
                isOpen={slashMenuOpen}
                filterText={slashFilterText}
                position={slashMenuPosition}
                onSelect={handleSlashSelect}
                onClose={handleSlashClose}
            />

            <TextSelectionToolbar
                onMakeMainPoint={handleMakeMainPoint}
                onOpenFlashcardManual={async (text) => {
                    // Try to suggest back
                    // This is a quick one-off generation
                    // We can import the action directly or use a helper
                    // Import locally to avoid top-level issues if any
                    const { generateFlashcardsFromNotes } = await import('@/lib/local-ai-actions');
                    const result = await generateFlashcardsFromNotes(text);
                    const suggestion = result.flashcards.length > 0 ? result.flashcards[0].back : '';

                    setManualFlashcardData({ front: text, back: suggestion });
                    setFlashcardTab('manual');
                    setContextPanelView('flashcards');
                    setContextPanelOpen(true);
                }}
            />
        </div>
    );

}
