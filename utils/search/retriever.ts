import { IndexStructure, SearchCandidate, ChunkData, Posting } from './types';
import { tokenizeQuery } from './preprocessor';
import { cosineSimilarityDense } from './semantic';

function normalizeForContains(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQueryPhrase(query: string): string {
  // Keep it simple: the exact user string, normalized.
  return normalizeForContains(query);
}

function isExactPhraseMatch(text: string, queryPhrase: string, queryTokens: string[]): boolean {
  // Only treat multi-token queries as phrase candidates.
  if (queryTokens.length < 2) return false;
  if (!queryPhrase || queryPhrase.length < 4) return false;
  const normalizedText = normalizeForContains(text);
  return normalizedText.includes(queryPhrase);
}

function looksLikeIndexOrToc(text: string): boolean {
  const t = normalizeForContains(text);
  // High-level demotion terms (intentionally broad): TOC/Index pages are high-noise.
  return (
    t.includes('table of contents') ||
    t.includes('contents') ||
    t.includes('index') ||
    t.includes('introduction')
  );
}

function adjustScore(baseScore: number, text: string, phraseMatch: boolean): number {
  let score = baseScore;

  // Massive boost for exact phrase match to force landing on definition pages.
  if (phraseMatch) {
    score = score * 8;
  }

  // Strong penalty for TOC/Index/Intro-like pages (unless they also contain the exact phrase).
  if (looksLikeIndexOrToc(text)) {
    score = score * (phraseMatch ? 0.7 : 0.15);
  }

  return score;
}

/**
 * Fast candidate retrieval using a BM25-style scorer over chunked content.
 * Returns top N chunks based on lexical relevance.
 */
export function findCandidates(index: IndexStructure, query: string, limit: number = 5, filterPages?: Set<number>): SearchCandidate[] {
  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) return [];
  const queryPhrase = getQueryPhrase(query);

  const chunkLookup = new Map<string, ChunkData>();
  for (const chunk of index.chunks) {
    chunkLookup.set(chunk.id, chunk);
  }

  const chunkScores = new Map<string, number>();
  const totalChunks = index.chunks.length || 1;
  const avgLength = index.averageLength || 1;
  const k1 = 1.6;
  const b = 0.75;

  for (const token of queryTokens) {
    const postings: Posting[] | undefined = index.keywordIndex[token];
    if (!postings || postings.length === 0) continue;

    const docFreq = postings.length;
    // BM25 IDF variant with log-smoothing
    const idf = Math.log(1 + (totalChunks - docFreq + 0.5) / (docFreq + 0.5));

    for (const { chunkId, frequency } of postings) {
      const chunk = chunkLookup.get(chunkId);
      if (!chunk) continue;
      if (filterPages && !filterPages.has(chunk.pageNumber)) continue;

      const tf = frequency;
      const lengthNorm = 1 - b + (b * (chunk.length / avgLength));
      const bm25 = idf * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));

      const current = chunkScores.get(chunkId) ?? 0;
      chunkScores.set(chunkId, current + bm25);
    }
  }

  const sortedChunks = Array.from(chunkScores.entries())
    .map(([chunkId, baseScore]) => {
      const chunk = chunkLookup.get(chunkId);
      if (!chunk) return null;
      const phraseMatch = isExactPhraseMatch(chunk.text, queryPhrase, queryTokens);
      const score = adjustScore(baseScore, chunk.text, phraseMatch);
      return { chunk, score, phraseMatch };
    })
    .filter((v): v is { chunk: ChunkData; score: number; phraseMatch: boolean } => !!v)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return sortedChunks.map(({ chunk, score, phraseMatch }) => ({
    page: chunk.pageNumber,
    chunkId: chunk.id,
    chunkIndex: chunk.chunkIndex,
    score,
    matchType: phraseMatch ? 'phrase' : 'fuzzy',
    excerpt: getExcerpt(chunk.text, queryTokens),
    text: chunk.text
  }));
}

function getExcerpt(text: string, tokens: string[]): string {
    // Simple excerpt generation: find first occurrence of a token
    // This can be improved in scoring.ts or here
    const lowerText = text.toLowerCase();
    let bestIndex = -1;
    
    for(const token of tokens) {
        const idx = lowerText.indexOf(token);
        if (idx !== -1) {
            bestIndex = idx;
            break;
        }
    }

    if (bestIndex === -1) return text.substring(0, 150) + "...";

    const start = Math.max(0, bestIndex - 60);
    const end = Math.min(text.length, bestIndex + 140);
    return (start > 0 ? "..." : "") + text.substring(start, end).replace(/\s+/g, ' ') + "...";
}

/**
 * Hybrid retrieval combining BM25 and Vector Search using Reciprocal Rank Fusion (RRF).
 */
export function findHybridCandidates(
    index: IndexStructure, 
    query: string, 
    queryEmbedding: number[] | null, 
    limit: number = 20,
    filterPages?: Set<number>
): SearchCandidate[] {
  const queryTokens = tokenizeQuery(query);
  const queryPhrase = getQueryPhrase(query);

    // 1. Get BM25 candidates
    const bm25Candidates = findCandidates(index, query, limit * 2, filterPages);
    
    // 2. Get Vector candidates (if embedding available)
    let vectorCandidates: SearchCandidate[] = [];
    if (queryEmbedding && index.chunks.some(c => c.embedding)) {
        const scores = index.chunks
            .filter(c => c.embedding && (!filterPages || filterPages.has(c.pageNumber)))
            .map(c => ({
                chunk: c,
                score: cosineSimilarityDense(queryEmbedding, c.embedding!)
            }))
            .map(({ chunk, score }) => {
              const phraseMatch = isExactPhraseMatch(chunk.text, queryPhrase, queryTokens);
              return { chunk, score: adjustScore(score, chunk.text, phraseMatch), phraseMatch };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit * 2);
            
        vectorCandidates = scores.map(s => {
          const phraseMatch = isExactPhraseMatch(s.chunk.text, queryPhrase, queryTokens);
          return {
            page: s.chunk.pageNumber,
            chunkId: s.chunk.id,
            chunkIndex: s.chunk.chunkIndex,
            score: s.score,
            matchType: phraseMatch ? 'phrase' : 'fuzzy',
            excerpt: s.chunk.text.substring(0, 200),
            text: s.chunk.text
          };
        });
    }
    
    // 3. RRF Fusion
    return performRRF([bm25Candidates, vectorCandidates], limit);
}

function performRRF(rankings: SearchCandidate[][], limit: number): SearchCandidate[] {
    const k = 60;
    const scores = new Map<string, number>();
    const lookup = new Map<string, SearchCandidate>();
    
    for (const ranking of rankings) {
        ranking.forEach((candidate, rank) => {
            const current = scores.get(candidate.chunkId) || 0;
            scores.set(candidate.chunkId, current + (1 / (k + rank + 1)));
            
            if (!lookup.has(candidate.chunkId)) {
                lookup.set(candidate.chunkId, candidate);
            }
        });
    }
    
    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, score]) => {
            const c = lookup.get(id)!;
            return { ...c, score };
        });
}
