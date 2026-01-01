import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { generateQuizQuestionWithAudit } from './quiz-generation-audit';

describe('quiz-generation-audit', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('persists inputs and result on success', async () => {
    const res = await generateQuizQuestionWithAudit(
      {
        projectId: 'p1',
        context: 'Photosynthesis converts light energy into chemical energy.',
        topic: 'photosynthesis',
        sourceBlockIds: ['b1'],
        generator: 'local-llm',
        modelMode: 'quick',
      },
      {
        generate: async () => ({
          question: 'What does photosynthesis convert?',
          options: ['Light to chemical', 'DNA to RNA', 'ATP to ADP', 'Protein to fat'],
          correctIndex: 0,
          correctLetter: 'A',
          sourceQuote: 'light energy',
        }),
      }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await db.analytics_quiz_generations.get(res.generationId);
    expect(row?.project_id).toBe('p1');
    expect(row?.generator).toBe('local-llm');
    expect(row?.model_mode).toBe('quick');
    expect(row?.topic).toBe('photosynthesis');
    expect(row?.context_length).toBeGreaterThan(0);
    expect(row?.result).toBeTruthy();
    expect(row?.error).toBeNull();
  });

  it('persists inputs and error with remediation on failure', async () => {
    const res = await generateQuizQuestionWithAudit(
      {
        projectId: 'p1',
        context: 'Some long text...',
        generator: 'local-llm',
        modelMode: 'thorough',
      },
      {
        generate: async () => null,
      }
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;

    expect(res.error.code).toBe('QUIZ_GENERATION_FAILED');
    expect((res.error.detail as any)?.remediation?.length).toBeGreaterThan(0);

    const row = await db.analytics_quiz_generations.get(res.generationId);
    expect(row?.error).toBeTruthy();
    expect(row?.result).toBeNull();
  });
});
