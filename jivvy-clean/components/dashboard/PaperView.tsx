'use client';

import React, { useState, useMemo } from 'react';
import { Block, db } from '@/lib/db';
import { useStore } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { TaskItem } from './TaskItem';
import { parseTaskNaturalLanguage } from '@/lib/smart-parser';

interface PaperViewProps {
    tasks: Block[];
    view: 'inbox' | 'today' | 'upcoming';
}

// Helper to build tree
interface TreeNode extends Block {
    children: TreeNode[];
    depth: number;
}

function buildTree(blocks: Block[], rootParentId: string = 'inbox', view: string): TreeNode[] {
    const blockMap = new Map<string, TreeNode>();
    blocks.forEach(b => blockMap.set(b.id, { ...b, children: [], depth: 0 }));

    const roots: TreeNode[] = [];

    // Build Hierarchy
    blocks.forEach(b => {
        const node = blockMap.get(b.id)!;

        // If parent is also in this list, attach to it
        if (b.parent_id && blockMap.has(b.parent_id)) {
            const parent = blockMap.get(b.parent_id)!;
            parent.children.push(node);
        } else {
            // Otherwise treat as root for this view
            roots.push(node);
        }
    });

    // Sort by order
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.order - b.order);
        nodes.forEach(node => {
            node.children.forEach(c => c.depth = node.depth + 1);
            sortNodes(node.children);
        });
    };

    sortNodes(roots);
    return roots;
}

export function PaperView({ tasks, view }: PaperViewProps) {
    const { updateBlock, deleteBlock, viewGrouping, viewSorting, showCompletedTasks } = useStore();
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

    // 1. Filter by Completion
    const filteredTasks = useMemo(() => {
        return showCompletedTasks
            ? tasks
            : tasks.filter(t => t.metadata?.status !== 'done');
    }, [tasks, showCompletedTasks]);

    // 2. Grouping & Sorting Logic
    const renderedContent = useMemo(() => {

        // Helper to sort a list of blocks based on current sort setting
        const sortBlocks = (blocks: Block[]) => {
            return [...blocks].sort((a, b) => {
                switch (viewSorting) {
                    case 'priority':
                        // P1 < P2 < P3 < None
                        const pA = a.metadata?.priority || 'p4';
                        const pB = b.metadata?.priority || 'p4';
                        return pA.localeCompare(pB);
                    case 'date':
                        const dA = a.metadata?.due_date || Infinity;
                        const dB = b.metadata?.due_date || Infinity;
                        return dA - dB;
                    case 'alpha':
                        return (a.content || '').localeCompare(b.content || '');
                    case 'smart':
                    default:
                        return a.order - b.order;
                }
            });
        };

        const renderNode = (node: TreeNode) => (
            <TaskItem
                key={node.id}
                node={node}
                updateBlock={updateBlock}
                onKeyDown={handleKeyDown}
                onFocus={setFocusedTaskId}
                isFocused={focusedTaskId === node.id}
                renderChildren={renderNode}
            />
        );

        // If sorting is active (not smart), we flatten the list to show sorted items clearly
        const isSorted = viewSorting !== 'smart';

        if (viewGrouping === 'project') {
            // Group by project
            const groups: Record<string, Block[]> = {};
            filteredTasks.forEach(t => {
                const proj = t.metadata?.project || 'No Project';
                if (!groups[proj]) groups[proj] = [];
                groups[proj].push(t);
            });

            return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([project, groupTasks]) => {
                const sortedGroup = sortBlocks(groupTasks);
                // If sorted, flat list. If smart sort, try to build tree (best effort for subset)
                const nodes = isSorted
                    ? sortedGroup.map(b => ({ ...b, children: [], depth: 0 } as TreeNode))
                    : buildTree(groupTasks, 'inbox', view); // Note: might lose parents if parent is in another group

                return (
                    <div key={project} className="mb-8">
                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                            {project}
                        </h3>
                        <div>{nodes.map(renderNode)}</div>
                    </div>
                );
            });
        }

        // No Grouping
        let nodes: TreeNode[];
        if (isSorted) {
            nodes = sortBlocks(filteredTasks).map(b => ({ ...b, children: [], depth: 0 } as TreeNode));
        } else {
            nodes = buildTree(filteredTasks, 'inbox', view);
        }

        return <div className="space-y-0.5">{nodes.map(renderNode)}</div>;

    }, [filteredTasks, viewGrouping, viewSorting, view, tasks, focusedTaskId]);

    // Handle indentation (Only allowed if NOT sorted and NOT grouped - simplifiction for now)
    const canIndent = viewGrouping === 'none' && viewSorting === 'smart';

    const handleIndent = async (task: Block) => {
        if (!canIndent) return;
        const siblings = tasks.filter(t => t.parent_id === task.parent_id).sort((a, b) => a.order - b.order);
        const index = siblings.findIndex(t => t.id === task.id);

        if (index > 0) {
            const newParent = siblings[index - 1];
            await updateBlock(task.id, { parent_id: newParent.id });
        }
    };

    const handleOutdent = async (task: Block) => {
        if (!canIndent) return;
        if (!task.parent_id || task.parent_id === 'inbox') return;

        // Find current parent
        const parent = tasks.find(t => t.id === task.parent_id);
        const newParentId = parent ? parent.parent_id : 'inbox';

        await updateBlock(task.id, { parent_id: newParentId });
    };

    async function handleKeyDown(e: React.KeyboardEvent, task: Block) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const result = parseTaskNaturalLanguage(task.content);
            if (result.cleanText !== task.content) {
                await updateBlock(task.id, {
                    content: result.cleanText,
                    metadata: {
                        ...task.metadata,
                        due_date: result.metadata.date?.getTime() || task.metadata?.due_date,
                    }
                });
            }

            const newId = uuidv4();
            const newTask: Block = {
                id: newId,
                parent_id: task.parent_id,
                type: 'task',
                content: '',
                order: task.order + 100,
                metadata: {
                    status: 'todo',
                    due_date: view === 'today' ? Date.now() : undefined,
                    color: task.metadata?.color,
                    project: task.metadata?.project // Inherit project
                },
                updated_at: Date.now(),
                sync_status: 'dirty'
            };

            const siblings = tasks.filter(t => t.parent_id === task.parent_id && t.order > task.order);
            await Promise.all(siblings.map(s => updateBlock(s.id, { order: s.order + 200 })));

            await db.blocks.add(newTask);
            setFocusedTaskId(newId);

        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                await handleOutdent(task);
            } else {
                await handleIndent(task);
            }
        } else if (e.key === 'Backspace' && task.content === '') {
            e.preventDefault();
            // Focus previous (visual check would be better but flattening list is ok)
            const flatList = tasks.sort((a, b) => a.order - b.order);
            const index = flatList.findIndex(t => t.id === task.id);
            if (index > 0) {
                const prev = flatList[index - 1];
                setFocusedTaskId(prev.id);
            }
            await deleteBlock(task.id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const flatList = tasks.sort((a, b) => a.order - b.order);
            const index = flatList.findIndex(t => t.id === task.id);
            if (index > 0) {
                const prev = flatList[index - 1];
                setFocusedTaskId(prev.id);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const flatList = tasks.sort((a, b) => a.order - b.order);
            const index = flatList.findIndex(t => t.id === task.id);
            if (index < flatList.length - 1) {
                const next = flatList[index + 1];
                setFocusedTaskId(next.id);
            }
        }
    };

    const createRootTask = async () => {
        const newId = uuidv4();
        const newTask: Block = {
            id: newId,
            parent_id: 'inbox',
            type: 'task',
            content: '',
            order: Date.now(),
            metadata: {
                status: 'todo',
                due_date: view === 'today' ? Date.now() : undefined
            },
            updated_at: Date.now(),
            sync_status: 'dirty'
        };
        await db.blocks.add(newTask);
        setFocusedTaskId(newId);
    };

    return (
        <div className="flex flex-col pb-40 relative min-h-[50vh] max-w-3xl mx-auto">
            {tasks.length === 0 && (
                <div
                    className="opacity-40 italic text-lg px-8 py-4 text-zinc-500 cursor-text hover:text-zinc-700 transition-colors"
                    onClick={createRootTask}
                >
                    Your clean slate. Start typing...
                </div>
            )}

            {renderedContent}

            {/* Click empty area to create new proper root task */}
            <div
                className="flex-1 cursor-text min-h-[100px]"
                onClick={async (e) => {
                    if (e.target !== e.currentTarget) return;
                    await createRootTask();
                }}
            />
        </div>
    );
}
