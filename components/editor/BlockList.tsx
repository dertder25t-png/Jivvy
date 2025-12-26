import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Block, db, BlockType } from '@/lib/db';
import { TextBlock } from './blocks/TextBlock';
import { TaskBlock } from './blocks/TaskBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { PDFHighlightBlock } from './blocks/PDFHighlightBlock';
import { SlashMenu, SlashMenuOption, SLASH_MENU_OPTIONS } from './SlashMenu';
import { SortableBlockWrapper } from './SortableBlockWrapper';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

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

// Extended block type to support heading and bullet variants
type ExtendedBlockType = BlockType | 'heading1' | 'heading2' | 'bullet';

interface BlockListProps {
    projectId: string;
    initialBlocks: Block[];
}

export function BlockList({ projectId, initialBlocks }: BlockListProps) {
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    // Slash menu state
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
    const [slashFilterText, setSlashFilterText] = useState('');
    const [activeSlashBlockId, setActiveSlashBlockId] = useState<string | null>(null);

    // Track block element refs for positioning
    const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

    // Slash menu trigger - detect "/" being typed
    const handleContentChange = useCallback((blockId: string, content: string) => {
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

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
    }, [blocks, slashMenuOpen, activeSlashBlockId, handleUpdateBlock]);

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

    // Handle drag end - reorder blocks
    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = blocks.findIndex(b => b.id === active.id);
        const newIndex = blocks.findIndex(b => b.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Create new sorted array
        const newBlocks = [...blocks];
        const [movedBlock] = newBlocks.splice(oldIndex, 1);
        newBlocks.splice(newIndex, 0, movedBlock);

        // Reassign order values
        const updatedBlocks = newBlocks.map((block, index) => ({
            ...block,
            order: index,
        }));

        // Optimistic UI update
        setBlocks(updatedBlocks);

        // Persist to database
        try {
            await Promise.all(
                updatedBlocks.map(block =>
                    db.blocks.update(block.id, { order: block.order })
                )
            );
        } catch (error) {
            console.error('Failed to persist block order:', error);
            // Revert on error
            setBlocks(blocks);
        }
    }, [blocks]);

    const blockMap = React.useMemo(() => {
        const map = new Map<string | null, Block[]>();
        blocks.forEach(b => {
            const pid = b.parent_id || null;
            if (!map.has(pid)) map.set(pid, []);
            map.get(pid)?.push(b);
        });
        return map;
    }, [blocks]);

    // Helper to get block style variant
    const getBlockVariant = (block: Block): 'heading1' | 'heading2' | 'bullet' | undefined => {
        return block.metadata?.variant as 'heading1' | 'heading2' | 'bullet' | undefined;
    };

    // Get flat list of block IDs for the current parent level (for SortableContext)
    const getBlockIds = (parentId: string | null): string[] => {
        const children = blockMap.get(parentId) || [];
        return children.sort((a, b) => a.order - b.order).map(b => b.id);
    };

    const renderBlock = (block: Block) => {
        const variant = getBlockVariant(block);

        if (block.type === 'image') {
            return (
                <ImageBlock
                    block={block}
                    onUpdate={(id, updates) => {
                        if ('content' in updates) {
                            handleContentChange(id, updates.content || '');
                        } else {
                            handleUpdateBlock(id, updates);
                        }
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
                        if ('content' in updates) {
                            handleContentChange(id, updates.content || '');
                        } else {
                            handleUpdateBlock(id, updates);
                        }
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
                    if ('content' in updates) {
                        handleContentChange(id, updates.content || '');
                    } else {
                        handleUpdateBlock(id, updates);
                    }
                }}
                onKeyDown={handleKeyDown}
                autoFocus={block.id === focusedBlockId}
                onDelete={() => handleDeleteBlock(block)}
            />
        );
    };

    const renderTree = (parentId: string | null, depth: number = 0) => {
        const children = blockMap.get(parentId) || [];
        children.sort((a, b) => a.order - b.order);

        if (children.length === 0) return null;

        const blockIds = getBlockIds(parentId);

        return (
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                <div className={cn("flex flex-col", depth > 0 && "ml-6 border-l border-zinc-100 dark:border-zinc-800")}>
                    {children.map(block => (
                        <div
                            key={block.id}
                            className="relative"
                            ref={(el) => {
                                if (el) blockRefs.current.set(block.id, el);
                            }}
                        >
                            <SortableBlockWrapper id={block.id}>
                                {renderBlock(block)}
                            </SortableBlockWrapper>
                            {renderTree(block.id, depth + 1)}
                        </div>
                    ))}
                </div>
            </SortableContext>
        );
    };

    return (
        <div className="w-full pb-32 relative pl-8">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                {renderTree(projectId)}
            </DndContext>

            <div
                className="flex-1 cursor-text min-h-[200px]"
                onClick={async () => {
                    const lastBlock = blocks[blocks.length - 1];
                    if (lastBlock) {
                        await handleCreateBlock(lastBlock);
                    } else {
                        const newBlock: Block = {
                            id: uuidv4(),
                            parent_id: projectId,
                            content: '',
                            type: 'text',
                            order: 0
                        };
                        await db.blocks.add(newBlock);
                        setBlocks([newBlock]);
                        setFocusedBlockId(newBlock.id);
                    }
                }}
            />

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
