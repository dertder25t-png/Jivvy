import React, { useState, useEffect, useCallback } from 'react';
import { Block, db, BlockType } from '@/lib/db';
import { TextBlock } from './blocks/TextBlock';
import { TaskBlock } from './blocks/TaskBlock';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface BlockListProps {
    projectId: string; // We'll manage fetching or refetching here for simplicity in updates
    initialBlocks: Block[]; // Pass initial blocks to render immediately
}

export function BlockList({ projectId, initialBlocks }: BlockListProps) {
    // Local state for immediate UI feedback, but we sync to DB
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    // Sort blocks by order. 
    // We also organize them into a tree structure for strict recursive rendering?
    // For now, let's keep it simple: We render a flat list but with indentation based on depth?
    // Or we filter by parent_id. 
    // "Recursive Rendering" was requested.
    // The issue with full recursion is efficient updates.
    // Let's build a tree function.

    // Sort logic
    useEffect(() => {
        // Ensure initial blocks are sorted or processed if needed
        const sorted = [...initialBlocks].sort((a, b) => a.order - b.order);
        setBlocks(sorted);
    }, [initialBlocks]);

    const handleUpdateBlock = useCallback(async (id: string, updates: Partial<Block>) => {
        // Optimistic
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
        // DB
        await db.blocks.update(id, updates);
    }, []);

    const handleCreateBlock = useCallback(async (currentBlock: Block) => {
        const newBlock: Block = {
            id: uuidv4(),
            parent_id: currentBlock.parent_id,
            content: '',
            type: 'text',
            order: currentBlock.order + 1, // We need to shift others later or use fractional indexing? 
            // For simple "Todoist" style, just +1 works if we reorder often.
            // Let's use simple order shifting for now.
        };

        // Shift orders of subsequent blocks
        const siblings = blocks.filter(b => b.parent_id === currentBlock.parent_id && b.order > currentBlock.order);

        // Batch DB update for shifting
        // This is expensive for large lists, fractional indexing is better, but obeying "context window efficiency"
        // we'll stick to a simple reliable append/insert.
        await Promise.all(siblings.map(b => db.blocks.update(b.id, { order: b.order + 1 })));

        await db.blocks.add(newBlock);

        // Optimistic append - wait for LiveQuery in parent or just update local
        // We'll update local to be snappy
        const updatedPeers = siblings.map(b => ({ ...b, order: b.order + 1 }));
        const others = blocks.filter(b => !siblings.find(s => s.id === b.id));

        setBlocks([...others, ...updatedPeers, newBlock].sort((a, b) => a.order - b.order));
        setFocusedBlockId(newBlock.id);
    }, [blocks]);

    const handleDeleteBlock = useCallback(async (block: Block) => {
        if (blocks.length <= 1) return; // Don't delete last block? 

        // Find previous block to focus
        const currentIndex = blocks.findIndex(b => b.id === block.id);
        const prevBlock = blocks[currentIndex - 1];

        await db.blocks.delete(block.id);
        setBlocks(prev => prev.filter(b => b.id !== block.id));

        if (prevBlock) setFocusedBlockId(prevBlock.id);
    }, [blocks]);

    const handleIndent = useCallback(async (block: Block) => {
        // Find the block immediately above it
        const currentIndex = blocks.findIndex(b => b.id === block.id);
        if (currentIndex <= 0) return; // Can't indent top item

        const prevBlock = blocks[currentIndex - 1];
        // Parent becomes prevBlock
        await handleUpdateBlock(block.id, { parent_id: prevBlock.id });
    }, [blocks, handleUpdateBlock]);

    const handleOutdent = useCallback(async (block: Block) => {
        if (!block.parent_id) return; // Already root

        // Find grandparent (parent of parent) to adopt this child
        // For simplicity, just un-nest to root or parent's parent
        // We need to fetch the parent to know its parent
        const parent = blocks.find(b => b.id === block.parent_id);
        const newParentId = parent ? parent.parent_id : null;

        await handleUpdateBlock(block.id, { parent_id: newParentId });
    }, [blocks, handleUpdateBlock]);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent, block: Block) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) return; // Let textarea handle default? New lines in block? NO, Enter is new block usually. Shift+Enter is new line.
            // Actually, for "Todoist-like", Enter is new task.
            // Shift+Enter should be new line in textarea (default). 
            // So default prevent only if NOT shift.
            if (!e.shiftKey) {
                await handleCreateBlock(block);
            }
        } else if (e.key === 'Backspace' && block.content === '') {
            e.preventDefault();
            await handleDeleteBlock(block);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const index = blocks.findIndex(b => b.id === block.id);
            if (index > 0) setFocusedBlockId(blocks[index - 1].id);
        } else if (e.key === 'ArrowDown') {
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
        } else if (e.key === '/') {
            // Very basic slash command trigger placeholder
            // In a real app, we'd open a popover.
            // For now, simpler: check content after this key.
        }
    }, [blocks, handleCreateBlock, handleDeleteBlock, handleIndent, handleOutdent]);

    // Handle type change simply by checking content changes (e.g. "/task ")
    // We can do this in the `TaskBlock` or `TextBlock` handleChange, but centralized here is okay too.
    // Let's keep it simple: if content starts with "/task ", switch type.
    useEffect(() => {
        blocks.forEach(b => {
            if (b.type === 'text' && b.content.startsWith('/task ')) {
                handleUpdateBlock(b.id, {
                    type: 'task',
                    content: b.content.replace('/task ', '')
                });
            } else if (b.type === 'task' && b.content.startsWith('/text ')) {
                handleUpdateBlock(b.id, {
                    type: 'text',
                    content: b.content.replace('/text ', '')
                });
            }
        });
    }, [blocks, handleUpdateBlock]);


    // Recursive Render Helper
    // We need to group by parentID first to avoid O(N^2) inside render
    const blockMap = React.useMemo(() => {
        const map = new Map<string | null, Block[]>();
        blocks.forEach(b => {
            const pid = b.parent_id || null; // normalizing
            if (!map.has(pid)) map.set(pid, []);
            map.get(pid)?.push(b);
        });
        return map;
    }, [blocks]);

    const renderTree = (parentId: string | null, depth: number = 0) => {
        const children = blockMap.get(parentId) || [];
        // Sort children by order
        children.sort((a, b) => a.order - b.order);

        if (children.length === 0) return null;

        return (
            <div className={cn("flex flex-col", depth > 0 && "ml-6 border-l border-zinc-100 dark:border-zinc-800")}>
                {children.map(block => (
                    <div key={block.id} className="relative">
                        {block.type === 'task' ? (
                            <TaskBlock
                                block={block}
                                onUpdate={handleUpdateBlock}
                                onKeyDown={handleKeyDown}
                                autoFocus={block.id === focusedBlockId}
                                onDelete={() => handleDeleteBlock(block)}
                            />
                        ) : (
                            <TextBlock
                                block={block}
                                onUpdate={handleUpdateBlock}
                                onKeyDown={handleKeyDown}
                                autoFocus={block.id === focusedBlockId}
                                onDelete={() => handleDeleteBlock(block)}
                            />
                        )}
                        {/* Recursive Children */}
                        {renderTree(block.id, depth + 1)}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="w-full pb-32">
            {renderTree(projectId)}

            {/* Click empty area to focus last block or create new if empty? */}
            <div
                className="flex-1 cursor-text min-h-[200px]"
                onClick={async () => {
                    const lastBlock = blocks[blocks.length - 1];
                    if (lastBlock) {
                        await handleCreateBlock(lastBlock);
                    } else {
                        // Create first block if none exist (though BlockList is usually non-empty)
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
        </div>
    );
}
