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

    it('should store and retrieve an analytics concept', async () => {
        await db.analytics_concepts.put({
            id: 'proj_1::photosynthesis',
            project_id: 'proj_1',
            concept: 'photosynthesis',
            score: 0.4,
            first_seen_at: Date.now(),
            last_seen_at: Date.now(),
            updated_at: Date.now(),
            sources: [{ lecture_id: 'lec_1', block_id: 'b_1', excerpt: 'Photosynthesis converts light…' }],
        });

        const retrieved = await db.analytics_concepts.get('proj_1::photosynthesis');
        expect(retrieved?.project_id).toBe('proj_1');
        expect(retrieved?.concept).toBe('photosynthesis');
        expect(Array.isArray(retrieved?.sources)).toBe(true);
        expect(retrieved?.sources?.[0]?.block_id).toBe('b_1');
    });

    it('should store and retrieve a quiz generation audit record', async () => {
        const now = Date.now();
        await db.analytics_quiz_generations.put({
            id: 'qg_1',
            project_id: 'proj_1',
            created_at: now,
            generator: 'local-llm',
            model_mode: 'quick',
            topic: 'photosynthesis',
            context_hash: 'deadbeef',
            context_length: 1234,
            context_excerpt: 'Photosynthesis converts light into chemical energy…',
            source_block_ids: ['b_1', 'b_2'],
            result: {
                question: 'What does photosynthesis produce?',
                options: ['ATP', 'Glucose', 'DNA', 'Protein'],
                correctIndex: 1,
                correctLetter: 'B',
                sourceQuote: 'chemical energy',
            },
        });

        const retrieved = await db.analytics_quiz_generations.get('qg_1');
        expect(retrieved?.project_id).toBe('proj_1');
        expect(retrieved?.generator).toBe('local-llm');
        expect(retrieved?.model_mode).toBe('quick');
        expect(retrieved?.context_hash).toBe('deadbeef');
        expect(Array.isArray(retrieved?.source_block_ids)).toBe(true);
    });
});
