import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Block, db, deleteBlockRecursively, BlockType, Flashcard } from '@/lib/db';
import { TextBlock } from './blocks/TextBlock';
import { TaskBlock } from './blocks/TaskBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { PDFHighlightBlock } from './blocks/PDFHighlightBlock';
import { PageBreakBlock } from './blocks/PageBreakBlock';
import { LectureContainerBlock } from './blocks/LectureContainerBlock';
import { TextSelectionToolbar } from './TextSelectionToolbar'; // Import
import { SlashMenu, SlashMenuOption } from './SlashMenu';
import { SortableBlockWrapper } from './SortableBlockWrapper';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { generateFlashcardsFromNotes } from '@/utils/local-ai-actions';
import { useLiveQuery } from 'dexie-react-hooks';
import { SquareStack } from 'lucide-react';
import { useProjectStore } from '@/lib/store';

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
    const { setContextPanelOpen, setContextPanelView } = useProjectStore();
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');

    // Flashcard generation state (background, non-blocking with requestIdleCallback)
    const [flashcardQueue, setFlashcardQueue] = useState<{ sectionId: string; content: string; lectureId: string }[]>([]);
    const [processingFlashcards, setProcessingFlashcards] = useState<string | null>(null);
    const [generatedCount, setGeneratedCount] = useState(0); // Track newly generated cards
    const flashcardProcessingRef = useRef(false);
    const completedSectionsRef = useRef<Set<string>>(new Set());
    const [lastOutdentedParent, setLastOutdentedParent] = useState<{ parentId: string; childId: string } | null>(null);

    // Live query for flashcard count (non-blocking)
    const flashcardCount = useLiveQuery(
        async () => {
            if (!projectId) return 0;
            return db.flashcards.where('project_id').equals(projectId).count();
        },
        [projectId],
        0
    );

    // Background flashcard generation processor (optimized with requestIdleCallback)
    useEffect(() => {
        if (flashcardQueue.length === 0 || flashcardProcessingRef.current) return;

        const processNext = async () => {
            if (flashcardQueue.length === 0) return;
            flashcardProcessingRef.current = true;

            const item = flashcardQueue[0];
            setProcessingFlashcards(item.sectionId);

            try {
                const result = await generateFlashcardsFromNotes(item.content);
                if (result.flashcards && result.flashcards.length > 0) {
                    // Save flashcards to database
                    const newCards: Flashcard[] = result.flashcards.map(fc => ({
                        id: uuidv4(),
                        project_id: projectId,
                        front: fc.front,
                        back: fc.back,
                        color: ['lime', 'violet', 'amber', 'rose'][Math.floor(Math.random() * 4)],
                        created_at: Date.now(),
                    }));
                    await db.flashcards.bulkAdd(newCards);
                    setGeneratedCount(prev => prev + newCards.length);
                    console.log(`[Flashcards] Generated ${newCards.length} cards from section`);
                }
            } catch (err) {
                console.error('[Flashcards] Generation failed:', err);
            } finally {
                completedSectionsRef.current.add(item.sectionId);
                setFlashcardQueue(prev => prev.slice(1));
                setProcessingFlashcards(null);
                flashcardProcessingRef.current = false;
            }
        };

        // Use requestIdleCallback to process during browser idle time (non-blocking)
        const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
        if (typeof win !== 'undefined' && win.requestIdleCallback) {
            const idleId = win.requestIdleCallback(() => {
                processNext();
            }, { timeout: 5000 }); // Max 5s wait before forcing
            return () => win.cancelIdleCallback?.(idleId);
        } else {
            // Fallback for browsers without requestIdleCallback
            const timeout = setTimeout(processNext, 1000);
            return () => clearTimeout(timeout);
        }
    }, [flashcardQueue, projectId]);

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
    useEffect(() => {
        // If this is a local update we triggered, skip the sync
        if (isLocalUpdateRef.current) {
            return;
        }
        
        const sorted = [...initialBlocks].sort((a, b) => a.order - b.order);
        
        // Only update if there are actual structural changes (new/deleted blocks)
        // This prevents cursor jumping from content updates
        const currentIds = new Set(blocks.map(b => b.id));
        const newIds = new Set(sorted.map(b => b.id));
        
        // Check for structural changes: different number of blocks or different IDs
        const hasStructuralChange = 
            currentIds.size !== newIds.size ||
            [...currentIds].some(id => !newIds.has(id)) ||
            [...newIds].some(id => !currentIds.has(id));
        
        if (hasStructuralChange) {
            setBlocks(sorted);
        } else {
            // Only update metadata/properties without resetting order
            setBlocks(prev => {
                const blockMap = new Map(sorted.map(b => [b.id, b]));
                return prev.map(b => {
                    const updated = blockMap.get(b.id);
                    if (updated && updated.content !== b.content && !document.activeElement?.closest(`[data-block-id="${b.id}"]`)) {
                        // Only update content if this block isn't currently focused
                        return updated;
                    }
                    return b;
                });
            });
        }
    }, [initialBlocks]); // blocks intentionally excluded to prevent infinite loops

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

    const handleCreateBlock = useCallback(async (currentBlock: Block) => {
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
            metadata: newMetadata
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
        if (blocks.length <= 1) return;
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
    }, [blocks, handleUpdateBlock]);

    const handleOutdent = useCallback(async (block: Block) => {
        if (!block.parent_id) return;

        const parent = blocks.find(b => b.id === block.parent_id);
        const newParentId = parent ? parent.parent_id : null;

        // Track this outdent for flashcard generation (processed in useEffect after blockMap is available)
        if (parent) {
            setLastOutdentedParent({ parentId: parent.id, childId: block.id });
        }

        await handleUpdateBlock(block.id, { parent_id: newParentId });
    }, [blocks, handleUpdateBlock]);

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
            if (content.startsWith('*** ')) { // Special case for horizontal rule or bold italics? No, let's stick to simple
                 // ...
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
            } else if (/^\d+\.\s/.test(content)) {
                // Auto-detect numbered lists as bullets for now, or text with number
                // For simplified blocks, we might just keep the number in the text 
                // but treat it as a bullet variant for styling?
                // The user asked for "numbers and everything else".
                // Let's just treat as text but maybe add a variant 'numbered' if supported?
                // Current `BlockVariant` only supports heading1, heading2, bullet.
                // We'll treat as text, let the content have the number.
                // Or converting to bullet variant but keeping content as number?
                // Let's keep existing behavior for now: text.
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
        const normalizedRows = parsedRows.map(r => ({...r, indentLevel: r.indentLevel - minIndent}));

        const newBlocks: Block[] = [];
        
        // Stack to track parent hierarchy: [{ level: -1, id: parentId }]
        const stack = [{ level: -1, id: parentId }];
        const orderMap = new Map<string, number>();
        orderMap.set(parentId, startOrder);

        for (const row of normalizedRows) {
            // Pop ancestors that are deeper or equal (since we want strictly greater level to be child)
            // Wait, if next item has SAME level, it shares parent.
            // If next item has HIGHER level, it is child of previous.
            // If next item has LOWER level, we pop back.
            
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
                metadata: row.metadata
            };

            newBlocks.push(newBlock);
            
            // Push this block as a potential parent for the next iteration
            stack.push({ level: row.indentLevel, id: row.id });
            // Initialize order for its potential children
            orderMap.set(row.id, 0);
        }

        await db.blocks.bulkAdd(newBlocks);
        setBlocks(prev => [...prev, ...newBlocks]);
    }, [blocks]);

    // Slash menu trigger - detect "/" being typed
    const handleContentChange = useCallback((blockId: string, content: string) => {
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
    const queueSectionForFlashcards = useCallback((parentBlock: Block, excludeBlockId: string) => {
        if (!parentBlock || parentBlock.type !== 'text') return;
        
        const parentChildren = blockMap.get(parentBlock.id) || [];
        const hasContent = parentBlock.content?.trim();
        const hasOtherChildren = parentChildren.filter(c => c.id !== excludeBlockId).length > 0;

        // If the parent has content and other children, it's a completed main point
        if (hasContent && hasOtherChildren && !completedSectionsRef.current.has(parentBlock.id)) {
            const lectureId = findLectureContainer(parentBlock.id);
            if (lectureId) {
                const sectionText = collectSectionText(parentBlock.id);
                const parentContext = collectParentContext(parentBlock.id);
                // Combine context with section text
                const fullContent = parentContext ? `Context: ${parentContext}\n\n${sectionText}` : sectionText;

                // Only queue if there's meaningful content (at least 20 chars)
                if (sectionText.length >= 20) {
                    // Debounce: wait 3 seconds before adding to queue
                    window.setTimeout(() => {
                        // Re-check that section hasn't been modified
                        if (!completedSectionsRef.current.has(parentBlock.id)) {
                            setFlashcardQueue(prev => {
                                // Avoid duplicates
                                if (prev.some(q => q.sectionId === parentBlock.id)) return prev;
                                return [...prev, { sectionId: parentBlock.id, content: fullContent, lectureId }];
                            });
                        }
                    }, 3000);
                }
            }
        }
    }, [blockMap, findLectureContainer, collectSectionText, collectParentContext]);

    // Process outdent events for flashcard generation
    useEffect(() => {
        if (!lastOutdentedParent) return;
        
        const parentBlock = blocks.find(b => b.id === lastOutdentedParent.parentId);
        if (parentBlock) {
            queueSectionForFlashcards(parentBlock, lastOutdentedParent.childId);
        }
        
        setLastOutdentedParent(null);
    }, [lastOutdentedParent, blocks, queueSectionForFlashcards]);

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
        const isProcessingFlashcards = processingFlashcards === block.id;

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

    const renderTree = (parentId: string | null, depth: number = 0) => {
        if (parentId) {
            const parent = blocks.find(b => b.id === parentId);
            // Allow any block to be collapsible, not just lecture containers
            if (parent && (parent.metadata as any)?.collapsed) {
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
        <div className="w-full pb-32 relative pl-8">
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
            {(flashcardCount > 0 || processingFlashcards || generatedCount > 0) && (
                <div 
                    onClick={() => {
                        setContextPanelOpen(true);
                        setContextPanelView('flashcards');
                    }}
                    className="flex items-center gap-2 mx-2 mb-2 px-3 py-2 rounded-md border border-lime-500/20 bg-lime-500/5 text-xs cursor-pointer hover:bg-lime-500/10 transition-colors"
                >
                    <SquareStack size={14} className="text-lime-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                        <span className="font-medium text-lime-600 dark:text-lime-400">{flashcardCount}</span> flashcards
                        {generatedCount > 0 && <span className="text-lime-500"> (+{generatedCount} new)</span>}
                    </span>
                    {processingFlashcards && (
                        <span className="ml-auto flex items-center gap-1 text-zinc-400 animate-pulse">
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                        </span>
                    )}
                    {flashcardQueue.length > 1 && (
                        <span className="text-zinc-500">({flashcardQueue.length - 1} queued)</span>
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

            <TextSelectionToolbar onMakeMainPoint={handleMakeMainPoint} />
        </div>
    );

}
