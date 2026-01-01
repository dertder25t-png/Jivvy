import { v4 as uuidv4 } from 'uuid';
import { db, type AnalyticsConcept, type Block } from '@/lib/db';
import { createAppError, toAppError, type AppError } from '@/lib/errors';
import { SUPERLEARN_WEAK_THRESHOLD, superLearnEffectiveScore } from './super-learn-scoring';
import { generateQuizQuestionWithAudit, type QuizGenerationRequest } from './quiz-generation-audit';
import { validateQuizQuestion, MIN_QUALITY_SCORE, type QuizValidationResult } from './quiz-quality-guardrails';
import type { QuizQuestionResult } from '@/utils/local-llm';

export type PracticeQuizGenerateParams = {
  projectId: string;
  maxConcepts?: number;
  maxQuestions?: number;
  weakThreshold?: number;
  /** If true, skip quality validation (faster but may produce lower quality questions) */
  skipValidation?: boolean;
  onProgress?: (p: { status: string; progress?: number }) => void;
};

export type PracticeQuizGenerateResult =
  | { ok: true; createdBlockIds: string[]; createdCount: number; validatedCount: number; rejectedCount: number }
  | { ok: false; error: AppError };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function buildQuizMarkdown(result: { question: string; options: string[] }): string {
  const opts = (result.options || []).slice(0, 4);
  const letters = ['A', 'B', 'C', 'D'];
  const lines = opts.map((t, i) => `${letters[i]}) ${String(t || '').trim()}`).join('\n');
  return `${String(result.question || '').trim()}\n\n${lines}`.trim();
}

function getTopSourceBlockIds(concept: AnalyticsConcept, limit = 6): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const s of concept.sources || []) {
    const id = s?.block_id;
    if (!id || typeof id !== 'string') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

  return ids;
}

function buildContextFromBlocks(blocks: Block[], maxChars = 8000): string {
  const parts: string[] = [];
  let used = 0;

  for (const b of blocks) {
    const t = String(b?.content || '').trim();
    if (!t) continue;
    const chunk = t.length > 1200 ? t.slice(0, 1200) + '…' : t;
    if (used + chunk.length + 2 > maxChars) break;
    parts.push(chunk);
    used += chunk.length + 2;
  }

  return parts.join('\n\n').trim();
}

export async function generatePracticeQuizBlocks(
  params: PracticeQuizGenerateParams,
  deps?: {
    generate?: (context: string, topic?: string, onProgress?: (p: { status: string }) => void) => Promise<QuizQuestionResult | null>;
  }
): Promise<PracticeQuizGenerateResult> {
  try {
    const projectId = String(params.projectId || '').trim();
    if (!projectId) {
      return { ok: false, error: createAppError('PRACTICE_QUIZ_INVALID', 'Missing projectId', { retryable: false }) };
    }

    const maxConcepts = clampInt(params.maxConcepts, 1, 30, 12);
    const maxQuestions = clampInt(params.maxQuestions, 1, 30, 8);
    const weakThreshold = typeof params.weakThreshold === 'number' ? params.weakThreshold : SUPERLEARN_WEAK_THRESHOLD;
    const skipValidation = params.skipValidation === true;
    const onProgress = params.onProgress;

    const rows = await db.analytics_concepts.where('project_id').equals(projectId).toArray();
    if (!rows.length) return { ok: true, createdBlockIds: [], createdCount: 0, validatedCount: 0, rejectedCount: 0 };

    const now = Date.now();

    const ranked = rows
      .map((c) => {
        const lastSeen = c.last_seen_at ?? c.updated_at ?? now;
        const effective = superLearnEffectiveScore(c.score ?? 0, lastSeen, now);
        return { c, effective };
      })
      .filter(x => x.effective < weakThreshold)
      .sort((a, b) => a.effective - b.effective)
      .slice(0, maxConcepts);

    if (!ranked.length) return { ok: true, createdBlockIds: [], createdCount: 0, validatedCount: 0, rejectedCount: 0 };

    const createdBlockIds: string[] = [];
    let validatedCount = 0;
    let rejectedCount = 0;

    for (const { c } of ranked) {
      if (createdBlockIds.length >= maxQuestions) break;

      const sourceBlockIds = getTopSourceBlockIds(c, 8);
      const sourceBlocks = sourceBlockIds.length ? await db.blocks.bulkGet(sourceBlockIds) : [];
      const blocks = (sourceBlocks || []).filter((b): b is Block => !!b);

      const context = buildContextFromBlocks(blocks, 8000);
      if (!context) continue;

      onProgress?.({ status: `Generating question for "${c.concept}"...` });

      const gen = await generateQuizQuestionWithAudit(
        {
          projectId,
          context,
          topic: c.concept,
          sourceBlockIds,
          generator: 'local-llm',
          modelMode: 'unknown',
        },
        deps?.generate ? { generate: deps.generate as any } : undefined
      );

      if (!gen.ok) {
        // If one concept fails, skip and try next.
        rejectedCount++;
        continue;
      }

      // Quality validation - reject low confidence questions
      let validationResult: QuizValidationResult | null = null;
      if (!skipValidation) {
        onProgress?.({ status: `Validating question quality...` });
        try {
          validationResult = await validateQuizQuestion(
            {
              question: gen.result.question,
              options: gen.result.options,
              correctIndex: gen.result.correctIndex,
              correctLetter: gen.result.correctLetter,
              sourceQuote: gen.result.sourceQuote,
            },
            context,
            onProgress
          );

          if (!validationResult.isValid) {
            // Question failed quality checks - skip it
            rejectedCount++;
            console.log(`[PracticeQuiz] Rejected question for "${c.concept}": ${validationResult.reasons.join(', ')}`);
            continue;
          }
          validatedCount++;
        } catch (validationError) {
          // If validation itself fails, still accept the question (fail-open)
          console.warn('[PracticeQuiz] Validation error, accepting question:', validationError);
        }
      }

      const quizBlockId = uuidv4();
      const content = buildQuizMarkdown(gen.result);

      const quizBlock: Block = {
        id: quizBlockId,
        parent_id: projectId,
        type: 'quiz',
        content,
        order: Number.MAX_SAFE_INTEGER,
        metadata: {
          quiz: {
            concept: c.concept,
            question: gen.result.question,
            options: gen.result.options,
            correctIndex: gen.result.correctIndex,
            correctLetter: gen.result.correctLetter,
            sourceQuote: gen.result.sourceQuote,
            generationId: gen.generationId,
            created_at: now,
            source_block_ids: sourceBlockIds,
            // Store validation results for debugging
            validation: validationResult ? {
              qualityScore: validationResult.qualityScore,
              isValid: validationResult.isValid,
            } : undefined,
          },
        },
      };

      await db.blocks.add(quizBlock);
      createdBlockIds.push(quizBlockId);
    }

    // Normalize order for any new blocks appended at the end.
    if (createdBlockIds.length) {
      const siblings = await db.blocks.where('parent_id').equals(projectId).sortBy('order');
      for (let i = 0; i < siblings.length; i++) {
        const b = siblings[i];
        if (!b) continue;
        if (b.order !== i) {
          await db.blocks.update(b.id, { order: i });
        }
      }
    }

    return { ok: true, createdBlockIds, createdCount: createdBlockIds.length, validatedCount, rejectedCount };
  } catch (e) {
    return {
      ok: false,
      error: toAppError(e, {
        code: 'PRACTICE_QUIZ_FAILED',
        message: 'Practice quiz generation failed',
        retryable: true,
      }),
    };
  }
}
