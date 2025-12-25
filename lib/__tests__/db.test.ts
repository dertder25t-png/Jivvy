import { describe, it, expect, beforeEach } from 'vitest';
import { db, Block } from '../db'; // Adjust path block logic

describe('JivvyDB', () => {
    beforeEach(async () => {
        await db.delete();
        await db.open();
    });

    it('should store and retrieve a block', async () => {
        const block: Block = {
            id: '1',
            parent_id: 'root',
            content: 'Hello World',
            type: 'text',
            order: 0,
            metadata: {}
        };

        await db.blocks.add(block);
        const retrieved = await db.blocks.get('1');
        expect(retrieved).toEqual(block);
    });

    it('should verify BlockType constraints in logic (TS verified)', async () => {
        const block: Block = {
            id: '2',
            parent_id: 'root',
            content: 'Task Item',
            type: 'task',
            order: 1,
            metadata: { checked: false }
        };
        await db.blocks.add(block);
        const retrieved = await db.blocks.get('2');
        expect(retrieved?.type).toBe('task');
        expect(retrieved?.metadata?.checked).toBe(false);
    });
});
