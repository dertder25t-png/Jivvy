import { v4 as uuidv4 } from 'uuid';
import { db, type QuizGeneratorKind, type QuizModelMode, type AnalyticsQuizGeneration } from '@/lib/db';
import { createAppError, safeLogError, toAppError, type AppError } from '@/lib/errors';
import { generateQuizQuestionLocal, getPreferredMode, type QuizQuestionResult } from '@/utils/local-llm';
import { hashText } from './super-learn-shared';

export type QuizGenerationRequest = {
  projectId: string;
  context: string;
  topic?: string;
  sourceBlockIds?: string[];
  generator?: QuizGeneratorKind;
  modelMode?: QuizModelMode;
  onProgress?: (p: { status: string }) => void;
};

export type QuizGenerationOk = {
  ok: true;
  generationId: string;
  result: QuizQuestionResult;
};

export type QuizGenerationErr = {
  ok: false;
  generationId: string;
  error: AppError;
};

function toQuizModelMode(): QuizModelMode {
  try {
    const pref = getPreferredMode();
    return pref === 'thorough' ? 'thorough' : 'quick';
  } catch {
    return 'unknown';
  }
}

function makeExcerpt(text: string, max = 360): string {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return compact.slice(0, max) + '…';
}

export async function generateQuizQuestionWithAudit(
  req: QuizGenerationRequest,
  deps?: {
    generate?: (context: string, topic?: string, onProgress?: (p: { status: string }) => void) => Promise<QuizQuestionResult | null>;
  }
): Promise<QuizGenerationOk | QuizGenerationErr> {
  const generationId = uuidv4();
  const now = Date.now();

  const context = String(req.context || '');
  const contextHash = hashText(context);
  const modelMode: QuizModelMode = req.modelMode ?? toQuizModelMode();
  const generator: QuizGeneratorKind = req.generator ?? 'local-llm';

  const baseRow: AnalyticsQuizGeneration = {
    id: generationId,
    project_id: req.projectId,
    created_at: now,
    generator,
    model_mode: modelMode,
    topic: req.topic,
    context_hash: contextHash,
    context_length: context.length,
    context_excerpt: makeExcerpt(context, 360),
    source_block_ids: Array.isArray(req.sourceBlockIds) ? req.sourceBlockIds.slice(0, 50) : undefined,
  };

  // Persist something even if generation fails early.
  try {
    await db.analytics_quiz_generations.put({ ...baseRow, error: null, result: null });
  } catch (e) {
    // Non-fatal: generation can still proceed, but we log it.
    safeLogError('QuizGeneration.audit.putBase', e, { projectId: req.projectId });
  }

  try {
    if (!req.projectId) {
      const err = createAppError('QUIZ_GENERATION_INVALID', 'Quiz generation request is missing projectId', { retryable: false });
      await db.analytics_quiz_generations.put({ ...baseRow, error: err, result: null });
      return { ok: false, generationId, error: err };
    }

    if (!context.trim()) {
      const err = createAppError('QUIZ_GENERATION_EMPTY_CONTEXT', 'Quiz generation needs some source text', {
        retryable: false,
        detail: { remediation: 'Add lecture notes or highlights, then try again.' },
      });
      await db.analytics_quiz_generations.put({ ...baseRow, error: err, result: null });
      return { ok: false, generationId, error: err };
    }

    let result: QuizQuestionResult | null = null;

    if (generator === 'local-llm') {
      const gen = deps?.generate ?? generateQuizQuestionLocal;
      result = await gen(context, req.topic, req.onProgress);
    } else {
      // Placeholder for future non-LLM generator modes.
      result = null;
    }

    if (!result) {
      const err = createAppError('QUIZ_GENERATION_FAILED', 'Quiz generation failed', {
        retryable: true,
        detail: {
          reason: 'The generator returned no result (model init failure, timeout, or parse failure).',
          remediation: [
            'Shorten the source text (select a smaller excerpt).',
            'Try switching AI mode (quick ↔ thorough) and retry.',
            'If your device is low on storage, free space and retry.',
          ],
          generator,
          modelMode,
        },
      });

      await db.analytics_quiz_generations.put({ ...baseRow, error: err, result: null });
      return { ok: false, generationId, error: err };
    }

    await db.analytics_quiz_generations.put({ ...baseRow, error: null, result });
    return { ok: true, generationId, result };
  } catch (e) {
    const err = toAppError(e, {
      code: 'QUIZ_GENERATION_THROWN',
      message: 'Quiz generation failed',
      retryable: true,
      detail: {
        remediation: [
          'Shorten the source text (select a smaller excerpt).',
          'Try switching AI mode (quick ↔ thorough) and retry.',
        ],
        generator,
        modelMode,
      },
    });

    safeLogError('QuizGeneration.generate', err, { projectId: req.projectId });

    try {
      await db.analytics_quiz_generations.put({ ...baseRow, error: err, result: null });
    } catch {
      // ignore
    }

    return { ok: false, generationId, error: err };
  }
}
