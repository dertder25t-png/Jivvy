import Dexie, { Table } from 'dexie';

export type BlockType = 'text' | 'task' | 'pdf_highlight' | 'image';

export interface Block {
    id: string;
    parent_id: string | null;
    content: string;
    type: BlockType;
    // New fields for Smart Capture
    properties?: {
        priority?: 'low' | 'medium' | 'high';
        due_date?: number; // timestamp
        tags?: string[];
        checked?: boolean;
    };
    metadata?: Record<string, any>;
    order: number;
}

export interface Project {
    id: string;
    name: string;
    created_at: number;
    updated_at: number;
    // New fields
    priority?: 'low' | 'medium' | 'high';
    due_date?: number;
    color?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}

export class JivvyDB extends Dexie {
    blocks!: Table<Block>;
    projects!: Table<Project>;

    constructor() {
        super('JivvyDB');
        this.version(1).stores({
            blocks: 'id, parent_id, order, type',
            projects: 'id'
        });

        this.version(2).stores({
            projects: 'id, updated_at',
            blocks: 'id, parent_id, order, type'
        }).upgrade(trans => {
            return trans.table("projects").toCollection().modify(p => {
                if (!p.updated_at) p.updated_at = p.created_at || Date.now();
            });
        });

        this.version(3).stores({
            blocks: 'id, parent_id, order, type, properties.due_date, properties.priority, properties.tags',
            projects: 'id, updated_at, due_date, priority'
        });
    }
}

export const db = new JivvyDB();

// Error handling wrapper helper
export async function safeDbOperation<T>(operation: () => Promise<T>, fallback?: T): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        console.error("Database Operation Failed:", error);
        // In a real app, we might show a toast here using a passed callback or global event
        // For now, we log and re-throw or return fallback if provided
        if (fallback !== undefined) return fallback;
        throw error;
    }
}
