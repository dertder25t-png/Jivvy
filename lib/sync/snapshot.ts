import { db } from '@/lib/db';

export async function exportToJSON() {
    const blocks = await db.blocks.toArray();
    const projects = await db.projects.toArray();
    return {
        version: 1,
        timestamp: Date.now(),
        blocks,
        projects
    };
}

export async function importFromJSON(data: any) {
    if (!data || !data.blocks || !data.projects) {
        throw new Error("Invalid backup data format");
    }

    await db.transaction('rw', db.blocks, db.projects, async () => {
        // Clear existing data to restore the snapshot exactly
        // This is a destructive operation designed for full restores
        await db.blocks.clear();
        await db.projects.clear();

        await db.blocks.bulkAdd(data.blocks);
        await db.projects.bulkAdd(data.projects);
    });
}
