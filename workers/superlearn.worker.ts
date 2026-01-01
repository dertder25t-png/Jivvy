/* eslint-disable no-restricted-globals */

import { extractKeywords } from '../utils/search/keyword-extractor';
import { safeLogError, toAppError, createAppError } from '../lib/errors';
import { normalizeConcept, type SuperLearnLecturePayload, type SuperLearnWorkerResult } from '../utils/analytics/super-learn-shared';

// Define Worker Scope
const ctx: Worker = self as any;

type InMessage =
  | {
      type: 'SUPERLEARN_EXTRACT';
      requestId: string;
      lectures: SuperLearnLecturePayload[];
      maxConcepts?: number;
    };

type OutMessage =
  | { type: 'SUPERLEARN_RESULT'; requestId: string; results: SuperLearnWorkerResult[] }
  | { type: 'SUPERLEARN_ERROR'; requestId: string; error: ReturnType<typeof toAppError> };

function pickSourcesForConcept(concept: string, lecture: SuperLearnLecturePayload): Array<{ blockId: string; excerpt: string }> {
  const norm = normalizeConcept(concept);
  if (!norm) return [];

  const hits: Array<{ blockId: string; excerpt: string }> = [];
  for (const s of lecture.sources) {
    const t = String(s.fullText || '').toLowerCase();
    if (t.includes(norm)) {
      hits.push({ blockId: s.blockId, excerpt: s.excerpt });
      if (hits.length >= 2) break;
    }
  }

  // Fallback to first source if nothing matched.
  if (hits.length === 0 && lecture.sources[0]) {
    hits.push({ blockId: lecture.sources[0].blockId, excerpt: lecture.sources[0].excerpt });
  }

  return hits;
}

ctx.addEventListener('message', async (event: MessageEvent<InMessage>) => {
  const data = event.data;
  if (!data || data.type !== 'SUPERLEARN_EXTRACT') return;

  const { requestId, lectures, maxConcepts } = data;
  try {
    const limit = typeof maxConcepts === 'number' && Number.isFinite(maxConcepts) ? Math.max(1, Math.min(30, maxConcepts)) : 12;

    const results: SuperLearnWorkerResult[] = lectures.map((lecture) => {
      const keywords = extractKeywords(lecture.text, limit)
        .map(normalizeConcept)
        .filter(Boolean);

      // Dedupe while keeping order
      const seen = new Set<string>();
      const concepts = [] as string[];
      for (const k of keywords) {
        if (seen.has(k)) continue;
        seen.add(k);
        concepts.push(k);
      }

      return {
        lectureId: lecture.lectureId,
        lectureHash: lecture.lectureHash,
        concepts: concepts.map((concept) => ({
          concept,
          sources: pickSourcesForConcept(concept, lecture),
        })),
      };
    });

    const out: OutMessage = { type: 'SUPERLEARN_RESULT', requestId, results };
    ctx.postMessage(out);
  } catch (error) {
    safeLogError('SuperLearnWorker.extract', error);
    const out: OutMessage = {
      type: 'SUPERLEARN_ERROR',
      requestId,
      error: toAppError(error, createAppError('SUPERLEARN_EXTRACT_FAILED', 'Super Learn extraction failed', { retryable: true })),
    };
    ctx.postMessage(out);
  }
});
