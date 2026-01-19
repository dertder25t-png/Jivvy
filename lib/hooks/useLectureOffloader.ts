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

        const token = sessionStorage.getItem('jivvy_google_token');
        if (!token) return;

        for (const block of blocks) {
            // Check ancestry
            if (block.parent_id) {
                const parent = await db.blocks.get(block.parent_id);
                if (parent && parent.type === 'lecture_container') {
                    if (block.content && block.content.length > 0) {
                        try {
                            const filename = `lecture_block_${block.id}.txt`;
                            const driveId = await uploadTextAsset(token, block.content, filename);

                            // Update local block
                            await db.blocks.update(block.id, {
                                content: '',
                                metadata: {
                                    ...block.metadata,
                                    driveId: driveId,
                                    isOffloaded: true
                                },
                                sync_status: 'dirty'
                            });
                            console.log(`Offloaded block ${block.id} to Drive: ${driveId}`);
                        } catch (e: any) {
                            console.error("Offload failed", e);
                            // Auto-disconnect on Auth Error
                            if (e.message?.includes('401') || e.message?.includes('403') || e.status === 403 || e.status === 401) {
                                console.warn("Google Drive token expired. Disconnecting offloader.");
                                sessionStorage.removeItem('jivvy_google_token');
                                return; // Stop processing remaining blocks
                            }
                        }
                    }
                }
            }
        }
    }, []);

    useEffect(() => {
        if (dirtyBlocks && dirtyBlocks.length > 0) {
            processOffloading(dirtyBlocks);
        }
    }, [dirtyBlocks, processOffloading]);
}
