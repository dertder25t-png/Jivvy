import { db, type Block, type Project, type Citation, type Flashcard } from '../db';

export interface Snapshot {
    timestamp: number;
    projects: Project[];
    blocks: Block[];
    citations: Citation[];
    flashcards: Flashcard[];
}

export async function exportToJSON(): Promise<Snapshot> {
    const projects = await db.projects.toArray();
    const blocks = await db.blocks.toArray();
    const citations = await db.citations.toArray();
    const flashcards = await db.flashcards.toArray();

    return {
        timestamp: Date.now(),
        projects,
        blocks,
        citations,
        flashcards
    };
}

export async function importFromJSON(json: Snapshot): Promise<void> {
    await db.transaction('rw', db.projects, db.blocks, db.citations, db.flashcards, async () => {
        // Projects
        for (const remote of json.projects) {
            const local = await db.projects.get({ id: remote.id });
            if (!local || remote.updated_at > local.updated_at) {
                await db.projects.put({ ...remote, sync_status: 'synced' });
            }
        }

        // Blocks
        for (const remote of json.blocks) {
            const local = await db.blocks.get({ id: remote.id });
            if (!local || remote.updated_at > local.updated_at) {
                await db.blocks.put({ ...remote, sync_status: 'synced' });
            }
        }

        // Citations
        if (json.citations) {
            for (const remote of json.citations) {
                const local = await db.citations.get({ id: remote.id });
                if (!local || remote.updated_at > local.updated_at) {
                    await db.citations.put({ ...remote, sync_status: 'synced' });
                }
            }
        }

        // Flashcards
        if (json.flashcards) {
            for (const remote of json.flashcards) {
                const local = await db.flashcards.get({ id: remote.id });
                if (!local || remote.updated_at > local.updated_at) {
                    await db.flashcards.put({ ...remote, sync_status: 'synced' });
                }
            }
        }
    });
}
