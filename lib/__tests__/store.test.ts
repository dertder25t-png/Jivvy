import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../store';
import { db } from '../db';

describe('useProjectStore', () => {
    beforeEach(async () => {
        // Reset DB
        await db.delete();
        await db.open();
        // Reset Store
        useProjectStore.setState({ blocks: [], error: null, isLoading: false, activeProjectId: null });
    });

    it('should add a block optimisticly and persistence', async () => {
        const block = {
            id: '100',
            parent_id: 'p1',
            content: 'Test Block',
            type: 'text' as const,
            order: 0
        };

        // Before adding
        expect(useProjectStore.getState().blocks).toHaveLength(0);

        await useProjectStore.getState().addBlock(block);

        // Check state
        expect(useProjectStore.getState().blocks).toContainEqual(block);

        // Check DB
        const stored = await db.blocks.get('100');
        expect(stored).toEqual(block);
    });

    it('should delete a block', async () => {
        const block = {
            id: '101',
            parent_id: 'p1',
            content: 'Delete Me',
            type: 'text' as const,
            order: 0
        };
        await useProjectStore.getState().addBlock(block);
        expect(useProjectStore.getState().blocks).toHaveLength(1);

        await useProjectStore.getState().deleteBlock('101');

        expect(useProjectStore.getState().blocks).toHaveLength(0);
        const stored = await db.blocks.get('101');
        expect(stored).toBeUndefined();
    });
});
