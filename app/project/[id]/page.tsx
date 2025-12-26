"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Block } from "@/lib/db";
import { BlockList } from "@/components/editor/BlockList";
import { v4 as uuidv4 } from "uuid";

export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // Fetch Project
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);

    // Fetch Blocks for this project (Top level? Or all?)
    // In our BlockList, we scan the whole list and build a tree.
    // So we fetch ALL blocks where parent_id is relevant? 
    // Usually blocks are stored flat. "parent_id" points to another block OR to the project?
    // Use Case: If nested, root blocks must point to project or have no parent?
    // Let's assume root blocks have `parent_id` == projectId OR `parent_id` == null and we somehow link them.
    // Simplest for now: fetch ALL blocks. Filter in memory? No.
    // Let's assume blocks belonging to a project are connected via a "root node" or we just fetch everything?
    // Wait, the DB schema has `parent_id`. It doesn't have `project_id`.
    // This is a Linked List / Tree problem.
    // If a block is deeply nested, does it know its project?
    // Convention: ALL blocks in a project should probably have a `project_id` field if we want checking "all blocks for project" to be fast.
    // BUT, the schema I read in `db.ts` does NOT have `project_id` on Block interface!
    // It only has `id, parent_id, content, type, order...`.
    // This implies we need a ROOT block for the project?
    // OR we need to update the schema to include `project_id` on blocks. 
    // OR `parent_id` can be the `projectId`.

    // "Requirement: Connect to db.projects ... fetch specific project by ID and all associated blocks (where parent_id == project.id)."
    // Ah, User prompt: "where parent_id == project.id".
    // This implies only 1 level of nesting? Or that we only fetch roots?
    // If I fetch roots, how do I get children?
    // If children have `parent_id` = `parent_block_id`, then `db.blocks.where('parent_id').equals(projectId)` will ONLY return roots.
    // This breaks the "fetch ALL associated blocks" requirement if there is deep nesting.

    // SOLUTION: We either:
    // 1. Fetch recursively (expensive individually).
    // 2. Add `project_id` to Block schema (Best Practice).
    // 3. Assume `parent_id` == `projectId` for EVERY block (Flat list, no nesting). BUT "Recursive Rendering" was requested.

    // GIVEN "Context Window Efficiency", I should not edit `db.ts`. 
    // BUT I can't fulfill requirements efficiently without it.
    // HOWEVER, I can cheat: fetch ALL blocks and filter? No, too many.
    // I will assume for this deliverable that we only support 1 level deep OR
    // I will fetch roots `where('parent_id').equals(projectId)`
    // AND then for each root, we might need children.

    // Wait, let's look at `db.ts` again.
    // `blocks: 'id, parent_id, order, type'`
    // Index is on `parent_id`.

    // I will try to implement a recursive fetch or a "fetch all" if the dataset is small? 
    // Actually, maybe I can just fetch logic:
    // When `BlockList` renders, it can recursively fetch children? 
    // `useLiveQuery` inside a recursive component is risky (N+1 queries).

    // LET'S ADAMS-SMITH THIS:
    // I'll grab roots: `db.blocks.where('parent_id').equals(projectId).toArray()`.
    // AND I will blindly assume for now that if we want children, we fetch them too?
    // NO, implementing a full recursive fetcher in `useLiveQuery` is hard.

    // ALTERNATIVE:
    // We add `project_id` to `Block` in `db.ts`? 
    // User said: "Do not rewrite db.ts... assume they exist".
    // BUT User also said "Generate the code for...".
    // I can generate a `BlockList` that manages its own data?
    // NO, `page.tsx` must fetch.

    // Let's stick to the prompt's implied logic: "fetch ... associated blocks (where parent_id == project.id)".
    // Maybe the user intends flat list for this MVP?
    // BUT later "Recursive Rendering" was requested.
    // This contradicts unless:
    // 1. We start with flat.
    // 2. We allow nesting visually but `parent_id` always points to project? No, that's fake nesting.

    // OKAY, I will implement a "Greedy Fetch" in `page.tsx`.
    // I will fetch `db.blocks.toArray()` and filter by "descendant of project".
    // This is slow but works for MVP.
    // BETTER:
    // I'll assume for this prototype we just use `parent_id`.
    // I will fetch `const blocks = useLiveQuery(() => db.blocks.where('parent_id').equals(projectId).toArray())`.
    // AND ALSO `db.blocks.toArray()` is unsafe.

    // Let's assume we ONLY show root blocks for now, and `BlockList` sub-components fetch their children?
    // `BlockList` calls `renderTree`.
    // `renderTree` maps `children`.
    // If I pass `blocks` (roots) to BlockList, `renderTree` needs access to ALL blocks.

    // I will change my strategy:
    // I will fetch ALL blocks. `db.blocks.toArray()`. 
    // Yes, for a local-first MVP with indexedDB, fetching 1000 items is instant.
    // I will filter in memory for those that belong to the tree rooted at `projectId`.
    // Accessing `parent_id` chain.

    const allBlocks = useLiveQuery(() => db.blocks.toArray());

    // Filter for this project
    const projectBlocks = React.useMemo(() => {
        if (!allBlocks) return [];
        // Build a set of IDs that are in this project.
        // Start with roots (parent_id == projectId)
        // Then find children of those, etc.
        const relevantBlocks: Block[] = [];
        const queue = [projectId];

        // This is slow if we iterate allBlocks every time.
        // Optimization: Map parent -> children
        const childrenMap = new Map<string, Block[]>();
        allBlocks.forEach(b => {
            const pid = b.parent_id || 'root';
            if (!childrenMap.has(pid)) childrenMap.set(pid, []);
            childrenMap.get(pid)?.push(b);
        });

        const collect = (pid: string) => {
            const kids = childrenMap.get(pid);
            if (kids) {
                kids.forEach(k => {
                    relevantBlocks.push(k);
                    collect(k.id); // Recurse
                });
            }
        };

        collect(projectId);
        return relevantBlocks;
    }, [allBlocks, projectId]);

    const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (project) {
            await db.projects.update(projectId, { name: e.target.value });
        }
    };

    const handleEmptyClick = async () => {
        // Create first block
        await db.blocks.add({
            id: uuidv4(),
            parent_id: projectId,
            content: '',
            type: 'text',
            order: 0
        });
    };

    if (!project) return <div className="p-10 text-zinc-400">Loading Project...</div>;

    return (
        <div className="max-w-4xl mx-auto py-12 px-8">
            {/* Header */}
            <input
                className="text-4xl font-bold bg-transparent border-none outline-none w-full mb-8 text-text-primary placeholder:text-zinc-300"
                value={project.name}
                onChange={handleTitleChange}
                placeholder="Untitled Project"
            />

            {/* Blocks */}
            <div className="flex-1 min-h-[500px] cursor-text" onClick={projectBlocks.length === 0 ? handleEmptyClick : undefined}>
                {projectBlocks && projectBlocks.length > 0 ? (
                    <BlockList projectId={projectId} initialBlocks={projectBlocks} />
                ) : (
                    <div className="text-zinc-400 text-lg italic hover:text-zinc-500 transition-colors">
                        Click anywhere or type '/' to begin...
                    </div>
                )}
            </div>
        </div>
    );
}
