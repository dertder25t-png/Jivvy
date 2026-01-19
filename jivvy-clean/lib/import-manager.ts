
import { db, Block, BlockType } from '@/lib/db';
import { fetchCalendarValues, parseCalendar, categorizeEvent, CategorizedItem } from '@/lib/calendar-service';
import { v4 as uuidv4 } from 'uuid';
import { getRandomPaletteColor } from '@/lib/utils';

export async function syncSource(source: { id: string, url: string, name: string }) {
    console.log(`Syncing source: ${source.name}`);

    // 1. Fetch & Parse
    let icsData = '';
    try {
        icsData = await fetchCalendarValues(source.url);
    } catch (e) {
        console.error(`Failed to sync source ${source.name}`, e);
        return { success: false, error: e };
    }

    const events = parseCalendar(icsData);
    if (events.length === 0) {
        return { success: true, count: 0 };
    }

    // 2. Map & Categorize
    const categorized = events.map(categorizeEvent);

    // 3. Process Items
    let updatedCount = 0;
    let createdCount = 0;

    // Cache projects to avoid excessive lookups
    const projectCache = new Map<string, string>(); // Title -> ID

    // Helper to get/create project
    const ensureProject = async (title: string): Promise<string> => {
        if (projectCache.has(title)) return projectCache.get(title)!;

        // Lookup in DB
        const existing = await db.projects.where('title').equals(title).first();
        if (existing) {
            projectCache.set(title, existing.id);
            // Retroactive: If existing project has no color, give it one
            if (!existing.color) {
                await db.projects.update(existing.id, { color: getRandomPaletteColor() });
            }
            return existing.id;
        }

        // Create
        const newId = uuidv4();
        await db.projects.add({
            id: newId,
            title: title,
            created_at: Date.now(),
            updated_at: Date.now(),
            sync_status: 'dirty',
            is_archived: false,
            color: getRandomPaletteColor(), // Assign color
            metadata: { source_id: source.id }
        });
        projectCache.set(title, newId);
        return newId;
    };

    // Ensure "Imported Events" project exists for non-assignment events
    const eventsProjectId = await ensureProject("Imported Events");

    for (const item of categorized) {
        const { type, courseCode, projectTitle, originalEvent } = item;

        // Determine target project
        let targetProjectId = eventsProjectId;
        if (type === 'assignment' && projectTitle) {
            targetProjectId = await ensureProject(projectTitle);
        } else if (type === 'assignment' && !projectTitle) {
            // Assignment but no course code? Put in Inbox or specific logic. 
            // We'll put in Inbox for now, or just same Events project with type=task
            targetProjectId = 'inbox'; // Special ID often used for Inbox
        }

        // Check if block already exists
        const existingBlocks = await db.blocks.filter(b => b.metadata?.ical_uid === originalEvent.uid).toArray();
        const existing = existingBlocks[0];

        const blockData = {
            content: originalEvent.summary,
            // description... handled inside content? Or we put in metadata? 
            // Jivvy blocks are usually just content.
            // We can append description to content or just leave it.
            // Let's append description if short, or ignore.

            type: (type === 'assignment' ? 'task' : 'event') as BlockType,
            due_date: originalEvent.startDate.getTime(), // Date object
            parent_id: targetProjectId,
            metadata: {
                ical_uid: originalEvent.uid,
                source_id: source.id,
                description: originalEvent.description,
                location: originalEvent.location,
                is_imported: true,
                priority: (item as CategorizedItem).priority // Propagate priority
            }
        };

        if (existing) {
            // Update if changed
            if (existing.due_date !== blockData.due_date || existing.content !== blockData.content || existing.parent_id !== blockData.parent_id) {
                await db.blocks.update(existing.id, {
                    ...blockData,
                    updated_at: Date.now(),
                    sync_status: 'dirty'
                });
                updatedCount++;
            }
        } else {
            // Create
            await db.blocks.add({
                id: uuidv4(),
                ...blockData,
                order: Date.now(), // Put at bottom
                updated_at: Date.now(),
                sync_status: 'dirty'
            });
            createdCount++;
        }
    }


    return { success: true, created: createdCount, updated: updatedCount };
}

export async function deleteSourceEvents(sourceId: string) {
    // 1. Find all blocks with this source_id
    const blocksToDelete = await db.blocks
        .filter(b => b.metadata?.source_id === sourceId)
        .toArray();

    const blockIds = blocksToDelete.map(b => b.id);

    // 2. Delete them
    await db.blocks.bulkDelete(blockIds);

    // 3. Optional: Delete empty projects that were created by this source
    // This is trickier if user added other tasks to them. 
    // For now, we only delete the blocks.

    return blockIds.length;
}
