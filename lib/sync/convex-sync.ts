import { useEffect, useState, useCallback, useRef } from 'react';
import { useMutation, useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { db, SyncStatus } from '@/lib/db';
import { useAuth } from '@/components/providers/AuthProvider';
import { downloadTextAsset } from '@/lib/drive';

const SYNC_INTERVAL_MS = 10000; // 10 seconds

export function useConvexSync(enabled: boolean = true) {
    // Hooks must be called unconditionally
    const convex = useConvex();
    const pushChangesMutation = useMutation(api.sync.pushChanges);
    const { user } = useAuth();

    // Track sync state
    const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

    const syncCycle = useCallback(async () => {
        if (!enabled) return;
        if (!user) return; // Cannot sync without user
        if (status === 'syncing') return;

        setStatus('syncing');

        try {
            // 1. PUSH: Find dirty records
            const dirtyProjects = await db.projects.where('sync_status').equals('dirty').toArray();
            const dirtyBlocks = await db.blocks.where('sync_status').equals('dirty').toArray();
            const dirtyCitations = await db.citations.where('sync_status').equals('dirty').toArray();
            const dirtyFlashcards = await db.flashcards.where('sync_status').equals('dirty').toArray();

            const changes = [
                ...dirtyProjects.map(r => ({ table: 'projects', record: r, deleted: false })),
                ...dirtyBlocks.map(r => {
                    // Smart Storage Optimization:
                    // If this block is offloaded to Drive, don't send content to Convex.
                    // This keeps backend storage usage minimal.
                    if (r.metadata?.driveId && r.metadata?.isOffloaded) {
                        return { table: 'blocks', record: { ...r, content: '' }, deleted: false };
                    }
                    return { table: 'blocks', record: r, deleted: false };
                }),
                ...dirtyCitations.map(r => ({ table: 'citations', record: r, deleted: false })),
                ...dirtyFlashcards.map(r => ({ table: 'flashcards', record: r, deleted: false })),
            ];

            if (changes.length > 0) {
                await pushChangesMutation({ changes });

                await db.transaction('rw', db.projects, db.blocks, db.citations, db.flashcards, async () => {
                    for (const r of dirtyProjects) await db.projects.update(r.id, { sync_status: 'synced' });
                    for (const r of dirtyBlocks) await db.blocks.update(r.id, { sync_status: 'synced' });
                    for (const r of dirtyCitations) await db.citations.update(r.id, { sync_status: 'synced' });
                    for (const r of dirtyFlashcards) await db.flashcards.update(r.id, { sync_status: 'synced' });
                });
            }

            // 2. PULL: Get changes from server
            const lastServerTime = parseInt(localStorage.getItem('jivvy_last_sync_time') || '0');

            const serverChanges = await convex.query(api.sync.listChanges, { since: lastServerTime });

            if (serverChanges) {
                const { projects, blocks, citations, flashcards, serverTime } = serverChanges;

                await db.transaction('rw', db.projects, db.blocks, db.citations, db.flashcards, async () => {
                    // Helper to merge
                    const merge = async (table: any, items: any[]) => {
                        for (const remote of items) {
                            const local = await table.get({ id: remote.id });
                            if (!local || remote.updated_at > local.updated_at) {
                                let recordToSave = remote;

                                // Hydration Logic for Offloaded Blocks
                                if (table === db.blocks && remote.metadata?.driveId && !remote.content) {
                                    // It's an offloaded block. Try to hydrate content from Drive.
                                    const token = sessionStorage.getItem('jivvy_google_token');
                                    if (token) {
                                        try {
                                            const content = await downloadTextAsset(token, remote.metadata.driveId);
                                            recordToSave = { ...remote, content };
                                            console.log(`💧 Hydrated block ${remote.id} from Drive`);
                                        } catch (e) {
                                            console.warn(`Failed to hydrate block ${remote.id}`, e);
                                            // Save empty content; UI will handle or retry later
                                        }
                                    }
                                }

                                await table.put({ ...recordToSave, sync_status: 'synced' });
                            }
                        }
                    };

                    await merge(db.projects, projects);
                    await merge(db.blocks, blocks);
                    await merge(db.citations, citations);
                    await merge(db.flashcards, flashcards);
                });

                if (serverTime) {
                    localStorage.setItem('jivvy_last_sync_time', serverTime.toString());
                }
            }

            setStatus('idle');
        } catch (err) {
            console.error("Convex Sync Error:", err);
            setStatus('error');
        }
    }, [convex, user, pushChangesMutation, status, enabled]);

    // Interval
    useEffect(() => {
        if (!user || !enabled) return;
        const interval = setInterval(syncCycle, SYNC_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [user, syncCycle, enabled]);

    return {
        isSyncing: status === 'syncing',
        syncNow: syncCycle
    };
}
