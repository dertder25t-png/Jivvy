import { v4 as uuidv4 } from 'uuid';
import { db, type AnalyticsConcept, type Block } from '@/lib/db';
import { createAppError, safeLogError, toAppError, type AppError } from '@/lib/errors';
import { SmartSearchEngine } from '@/utils/smart-search';
import {
  collectProjectLecturePayloads,
  getLectureSuperLearnHash,
  normalizeConcept,
  setLectureSuperLearnMeta,
  type SuperLearnWorkerResult,
} from './super-learn-shared';
import {
  superLearnEffectiveScore,
  superLearnReinforceScore,
} from './super-learn-scoring';
import { matchConceptsInText } from './super-learn-quiz-tagging';

export type SuperLearnStatus = 'idle' | 'analyzing' | 'ready' | 'error';

export type SuperLearnInsight = {
  sentence: string;
  concept: string;
  effectiveScore: number;
  targetBlockId: string | null;
};

function setBlockSuperLearnMeta(prev: Block['metadata'] | undefined, patch: Record<string, any>): Block['metadata'] {
  const base = (prev && typeof prev === 'object') ? { ...(prev as any) } : {};
  base.superLearn = { ...(base.superLearn || {}), ...(patch || {}) };
  return base;
}

function stripQuizMeta(prev: Block['metadata'] | undefined): Block['metadata'] {
  const base = (prev && typeof prev === 'object') ? { ...(prev as any) } : {};
  const sl = (base.superLearn && typeof base.superLearn === 'object') ? { ...(base.superLearn as any) } : {};
  if ('quizConcepts' in sl) delete sl.quizConcepts;
  if ('quizTaggedAt' in sl) delete sl.quizTaggedAt;
  base.superLearn = sl;
  return base;
}

function arraysEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function getSuperLearnInsight(projectId: string): Promise<SuperLearnInsight | null> {
  const concepts = await db.analytics_concepts.where('project_id').equals(projectId).toArray();
  if (!concepts.length) return null;

  const now = Date.now();
  let best: { c: AnalyticsConcept; effective: number } | null = null;

  for (const c of concepts) {
    const effective = superLearnEffectiveScore(c.score ?? 0, c.last_seen_at ?? c.updated_at ?? now, now);
    if (!best || effective < best.effective) {
      best = { c, effective };
    }
  }

  if (!best) return null;

  const targetBlockId = best.c.sources?.[0]?.block_id ?? null;
  const pct = Math.round(best.effective * 100);
  
  let sentence = `Weakest concept: ${best.c.concept} (${pct}%).`;
  if (targetBlockId) {
    sentence += " Tap Start Review to jump to the source.";
  }

  return {
    concept: best.c.concept,
    effectiveScore: best.effective,
    targetBlockId,
    sentence,
  };
}

export async function runSuperLearnAnalysis(projectId: string, projectBlocks: Block[]): Promise<{ ok: true } | { ok: false; error: AppError }> {
  try {
    const lectures = projectBlocks.filter(b => b.type === 'lecture_container');
    if (lectures.length === 0) return { ok: true };

    const payloads = collectProjectLecturePayloads(projectBlocks, projectId);
    if (payloads.length === 0) return { ok: true };

    // Only analyze changed lectures
    const lectureById = new Map(lectures.map(l => [l.id, l] as const));
    const toAnalyze = payloads.filter(p => {
      const lecture = lectureById.get(p.lectureId);
      if (!lecture) return false;
      const prevHash = getLectureSuperLearnHash(lecture);
      return prevHash !== p.lectureHash;
    });

    if (toAnalyze.length === 0) return { ok: true };

    const worker = new Worker(new URL('../../workers/superlearn.worker.ts', import.meta.url), { type: 'module' });
    const requestId = uuidv4();

    const results = await new Promise<SuperLearnWorkerResult[]>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(createAppError('SUPERLEARN_TIMEOUT', 'Super Learn analysis timed out', { retryable: true }));
      }, 20_000);

      const onMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (!msg || msg.requestId !== requestId) return;

        if (msg.type === 'SUPERLEARN_RESULT') {
          window.clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError as any);
          resolve((msg.results || []) as SuperLearnWorkerResult[]);
        }

        if (msg.type === 'SUPERLEARN_ERROR') {
          window.clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError as any);
          reject(msg.error);
        }
      };

      const onError = (error: unknown) => {
        window.clearTimeout(timeout);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError as any);
        reject(error);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError as any);
      worker.postMessage({ type: 'SUPERLEARN_EXTRACT', requestId, lectures: toAnalyze, maxConcepts: 12 });
    });

    try {
      worker.terminate();
    } catch {
      // ignore
    }

    const now = Date.now();

    await db.transaction('rw', db.blocks, db.analytics_concepts, async () => {
      for (const r of results) {
        const lecture = lectureById.get(r.lectureId);
        if (lecture) {
          await db.blocks.update(r.lectureId, {
            metadata: setLectureSuperLearnMeta(lecture.metadata, { hash: r.lectureHash, updatedAt: now }),
          });
        }

        for (const hit of r.concepts) {
          const concept = normalizeConcept(hit.concept);
          if (!concept) continue;

          const id = `${projectId}::${concept}`;
          const existing = await db.analytics_concepts.get(id);

          const nextSources = (hit.sources || [])
            .filter(s => s && typeof s.blockId === 'string')
            .map(s => ({
              lecture_id: r.lectureId,
              block_id: s.blockId,
              excerpt: s.excerpt,
            }));

          if (!existing) {
            const row: AnalyticsConcept = {
              id,
              project_id: projectId,
              concept,
              score: 0.35,
              first_seen_at: now,
              last_seen_at: now,
              updated_at: now,
              sources: nextSources,
            };
            await db.analytics_concepts.put(row);
            continue;
          }

          const mergedSources = [...nextSources, ...(existing.sources || [])]
            .filter(s => s && typeof s.block_id === 'string')
            .slice(0, 10);

          await db.analytics_concepts.put({
            ...existing,
            concept,
            // Apply time decay since last seen, then reinforce.
            score: superLearnReinforceScore({
              prevRawScore: existing.score ?? 0,
              prevLastSeenAt: existing.last_seen_at ?? existing.updated_at ?? now,
              now,
              delta: 0.08,
            }),
            last_seen_at: now,
            updated_at: now,
            sources: mergedSources,
          });
        }
      }

      // Phase 4 roadmap: Tag quiz questions with extracted concepts.
      const conceptRows = await db.analytics_concepts.where('project_id').equals(projectId).toArray();
      const concepts = conceptRows
        .map(c => normalizeConcept(c.concept))
        .filter(Boolean);

      // Only attempt tagging if we actually have concepts.
      if (concepts.length > 0) {
        for (const b of projectBlocks) {
          if (!b || b.type === 'lecture_container') continue;
          const content = String(b.content || '').trim();
          if (!content) continue;

          const quiz = SmartSearchEngine.detectQuizQuestion(content);
          const prevQuizConcepts = (b.metadata as any)?.superLearn?.quizConcepts;

          if (!quiz?.isQuiz) {
            // If it no longer looks like a quiz, clear quiz tagging.
            if (Array.isArray(prevQuizConcepts) && prevQuizConcepts.length > 0) {
              await db.blocks.update(b.id, { metadata: stripQuizMeta(b.metadata) });
            }
            continue;
          }

          const combined = [quiz.question, ...(quiz.options || []).map(o => o.text)].filter(Boolean).join('\n');
          const matched = matchConceptsInText(combined, concepts, 12);

          if (arraysEqual(prevQuizConcepts, matched)) continue;

          await db.blocks.update(b.id, {
            metadata: setBlockSuperLearnMeta(b.metadata, {
              quizConcepts: matched,
              quizTaggedAt: now,
            }),
          });
        }
      }
    });

    return { ok: true };
  } catch (e) {
    safeLogError('SuperLearn.run', e);
    return {
      ok: false,
      error: toAppError(e, {
        code: 'SUPERLEARN_FAILED',
        message: 'Super Learn failed',
        retryable: true,
      }),
    };
  }
}
