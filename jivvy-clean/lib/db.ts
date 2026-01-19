import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'clean' | 'dirty' | 'synced';

export interface Project {
    id: string;
    title: string;
    parent_project_id?: string;
    created_at: number;
    updated_at: number;
    sync_status: SyncStatus;
    is_archived: boolean;
    color?: string;
    metadata?: Record<string, any>;
}

export type BlockType = 'text' | 'task' | 'event' | 'header' | 'page_break' | 'pdf_highlight' | 'flashcard_candidate' | 'lecture_container' | 'image' | 'subpage';

export interface Block {
    id: string;
    parent_id: string;
    type: BlockType;
    content: string;
    order: number;
    due_date?: number;
    is_complete?: boolean;
    metadata?: Record<string, any>;
    updated_at: number;
    sync_status: SyncStatus;
}

export interface Citation {
    id: string;
    project_id: string;
    type: 'article' | 'book' | 'website' | 'pdf';
    title: string;
    author: string;
    year?: string;
    url?: string;
    updated_at: number;
    sync_status: SyncStatus;
}

export interface Flashcard {
    id: string;
    project_id: string;
    lecture_id?: string;
    front: string;
    back: string;
    next_review: number;
    updated_at: number;
    sync_status: SyncStatus;
}

export interface CalendarSource {
    id: string;
    userId: string;
    url: string;
    name: string;
    color?: string;
    last_synced_at?: number;
    etag?: string;
    updated_at: number;
    sync_status: SyncStatus;
}

export class JivvyDatabase extends Dexie {
    projects!: Table<Project>;
    blocks!: Table<Block>;
    citations!: Table<Citation>;
    flashcards!: Table<Flashcard>;
    calendar_sources!: Table<CalendarSource>;

    constructor() {
        super('JivvyCleanDB_v2');

        // Version 1: Explicit string keys (no auto-increment) for UUIDs
        this.version(1).stores({
            projects: 'id, title, parent_project_id, created_at, updated_at, sync_status, is_archived',
            blocks: 'id, parent_id, type, content, order, due_date, is_complete, updated_at, sync_status, [parent_id+order]',
            citations: 'id, project_id, type, title, author, year, url, updated_at, sync_status',
            flashcards: 'id, project_id, front, back, next_review, updated_at, sync_status'
        });

        // Version 2: Add lecture_id index
        this.version(2).stores({
            flashcards: 'id, project_id, lecture_id, front, back, next_review, updated_at, sync_status'
        });

        // Version 3: Add calendar_sources
        this.version(3).stores({
            calendar_sources: 'id, userId, url, name, updated_at, sync_status'
        });

        // Middleware to track changes
        this.use({
            stack: 'dbcore',
            name: 'SyncStatusMiddleware',
            create: (downlevelDatabase) => {
                return {
                    ...downlevelDatabase,
                    table: (tableName) => {
                        const downlevelTable = downlevelDatabase.table(tableName);
                        return {
                            ...downlevelTable,
                            mutate: (req) => {
                                if (req.type === 'add' || req.type === 'put') {
                                    const values = req.values.map(val => ({
                                        ...val,
                                        updated_at: Date.now(),
                                        sync_status: 'dirty'
                                    }));
                                    return downlevelTable.mutate({ ...req, values });
                                }
                                return downlevelTable.mutate(req);
                            }
                        };
                    }
                };
            }
        });
    }
}

export const db = (typeof window !== 'undefined' ? new JivvyDatabase() : undefined) as JivvyDatabase;

export async function deleteBlockRecursively(blockId: string): Promise<string[]> {
    const children = await db.blocks.where('parent_id').equals(blockId).toArray();
    let deletedIds = [blockId];
    for (const child of children) {
        const childDeletedIds = await deleteBlockRecursively(child.id);
        deletedIds = [...deletedIds, ...childDeletedIds];
    }
    await db.blocks.delete(blockId);
    return deletedIds;
}
