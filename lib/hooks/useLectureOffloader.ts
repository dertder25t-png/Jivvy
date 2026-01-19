import { useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Block } from '@/lib/db';
import { useSync } from '@/components/providers/SyncProvider';
import { uploadTextAsset, authenticateGoogleDrive } from '@/lib/drive';

/**
 * This hook watches for "Lecture Sub-Items" that have content but haven't been offloaded yet.
 * It automatically uploads them to Drive and clears the local content to save space (and money on Convex).
 */
export function useLectureOffloader() {
    const { connectDrive, driveConnected } = useSync();

    // Query for blocks that:
    // 1. Are "dirty" (recently changed) - logic: we want to catch them before sync if possible, or after.
    // Actually, better is to find blocks that have content AND are children of a lecture_container AND don't have a recent driveId sync.
    // For simplicity efficiently:
    // Find all blocks where `type` is text/list-item (assumed standard blocks)
    // AND they have `content.length > 50` (optimization threshold? or all?)
    // AND `metadata.driveId` is missing OR `sync_status` is dirty.

    // To identify "Lecture Items", we need to know the parent type.
    // Dexie doesn't join easily. 
    // Optimization: The application (Editor) should probably flag these blocks as `metadata.isOffloadable = true` or similar.
    // OR create a specific block type `lecture_note`.

    // For now, let's assume ALL blocks in the system that are 'text' and long (>1KB?) should be candidates?
    // User asked for "sub list items in lectures".
    // Let's assume we scan for blocks with `metadata.containerType === 'lecture'`. 
    // We will need to ensure the Editor sets this.

    // For this prototype, I will query blocks with `metadata.offload` set to `true` (Trigger) 
    // OR just watch for `sync_status: dirty`.

    // Let's do a naive approach first: Watch ALL dirty blocks. Check if they have a parent that is a lecture.

    const dirtyBlocks = useLiveQuery(
        () => db.blocks.where('sync_status').equals('dirty').toArray()
    );

    const processOffloading = useCallback(async (blocks: Block[]) => {
        if (!blocks || blocks.length === 0) return;

        // We need a token.
        // If we are not connected, we can't offload. 
        // We silently fail/skip (data stays local/convex until connected).
        // But we need the token. `useSync` doesn't expose token directly for security/complexity.
        // We'll convert `authenticateGoogleDrive` to a cached internal utility or just call it 
        // (it handles token reuse/refresh if GIS used correctly, though `initTokenClient` prompts UI... 
        // actually `requestAccessToken` with `prompt: ''` might work if already granted?)
        // The `lib/drive.ts` implementation calls `initTokenClient` every time which pops up UI. 
        // We need a silent way.
        // GIS `initTokenClient` is for user interaction. 
        // We should store the `access_token` in memory in `SyncProvider` context and expose it?
        // Or store in localStorage (with expiry).
        // Let's assume the user just clicked "Connect" recently.

        // REALITY CHECK: Automated background uploads with Google Identity Services (GIS) on client-side 
        // REQUIRE a valid access token. GIS tokens expire in 1 hour. Refreshing requires user interaction 
        // (or at least `prompt: 'none'` in hidden iframe, which GIS abstracts).
        // If the token is expired, this background process will trigger a popup! That is BAD UX.

        // SOLUTION: Only run offloading when we explicitly have a valid token (e.g. valid for X mins).
        // Or let the `SyncProvider` manage the "Session".

        // For this Prototype: We will skip the automated offloader if we don't have a fresh token.
        // We'll rely on the "Sync Now" button or simple checks.

        // However, the prompt says "automatically".
        // Let's try to get a token. If it requires prompt, it might be annoying.
        // We'll use a `sessionStorage` token if available.

        const token = sessionStorage.getItem('jivvy_google_token');
        if (!token) return;

        for (const block of blocks) {
            // Check ancestry (expensive?)
            // Let's look up parent.
            if (block.parent_id) {
                const parent = await db.blocks.get(block.parent_id);
                // Assumption: Lecture Container has type 'lecture_container'
                if (parent && parent.type === 'lecture_container') {
                    // It's a target!
                    if (block.content && block.content.length > 0) {
                        try {
                            const filename = `lecture_block_${block.id}.txt`;
                            const driveId = await uploadTextAsset(token, block.content, filename);

                            // Update local block: Strip content, add driveId reference
                            await db.blocks.update(block.id, {
                                content: '', // Strip!
                                metadata: {
                                    ...block.metadata,
                                    driveId: driveId,
                                    isOffloaded: true
                                },
                                // Keep sync_status dirty so the METADATA update syncs to Convex
                                sync_status: 'dirty'
                            });
                            console.log(`Offloaded block ${block.id} to Drive: ${driveId}`);
                        } catch (e) {
                            console.error("Offload failed", e);
                        }
                    }
                }
            }
        }
    }, []);

    useEffect(() => {
        if (dirtyBlocks) {
            processOffloading(dirtyBlocks);
        }
    }, [dirtyBlocks, processOffloading]);
}
