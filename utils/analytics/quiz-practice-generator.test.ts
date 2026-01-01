import { describe, it, expect, beforeEach } from 'vitest';
import { db, type AnalyticsConcept, type Block } from '@/lib/db';
import { generatePracticeQuizBlocks } from './quiz-practice-generator';

describe('quiz-practice-generator', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('fetches weak concepts, generates a quiz, and persists a QuizBlock', async () => {
    const projectId = 'p1';
    const now = Date.now();

    const sourceBlock: Block = {
      id: 'b1',
      parent_id: projectId,
      type: 'text',
      content: 'Photosynthesis converts light energy into chemical energy in plants.',
      order: 0,
      metadata: {},
    };

    await db.blocks.add(sourceBlock);

    const concept: AnalyticsConcept = {
      id: `${projectId}::photosynthesis`,
      project_id: projectId,
      concept: 'photosynthesis',
      score: 0.1,
      first_seen_at: now,
      last_seen_at: now,
      updated_at: now,
      sources: [{ lecture_id: 'lec_1', block_id: 'b1', excerpt: 'Photosynthesis converts light…' }],
    };

    await db.analytics_concepts.put(concept);

    const res = await generatePracticeQuizBlocks(
      { projectId, maxConcepts: 5, maxQuestions: 2, skipValidation: true },
      {
        generate: async () => ({
          question: 'What does photosynthesis convert?',
          options: ['Light energy', 'DNA', 'Proteins', 'Sound'],
          correctIndex: 0,
          correctLetter: 'A',
          sourceQuote: 'light energy',
        }),
      }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.createdCount).toBe(1);
    const createdId = res.createdBlockIds[0];
    const created = await db.blocks.get(createdId);

    expect(created?.type).toBe('quiz');
    expect(created?.parent_id).toBe(projectId);
    expect(String(created?.content || '')).toContain('A)');

    const generationId = (created as any)?.metadata?.quiz?.generationId as string | undefined;
    expect(typeof generationId).toBe('string');

    const audit = generationId ? await db.analytics_quiz_generations.get(generationId) : null;
    expect(audit?.project_id).toBe(projectId);
  });
});
