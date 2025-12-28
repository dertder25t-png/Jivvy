import { IndexStructure, SearchCandidate, ChunkData, Posting } from './types';
import { tokenizeQuery } from './preprocessor';
import { cosineSimilarityDense } from './semantic';

/**
 * Fast candidate retrieval using a BM25-style scorer over chunked content.
 * Returns top N chunks based on lexical relevance.
 */
export function findCandidates(index: IndexStructure, query: string, limit: number = 5, filterPages?: Set<number>): SearchCandidate[] {
  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) return [];

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
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sortedChunks.map(([chunkId, score]) => {
    const chunk = chunkLookup.get(chunkId);
    if (!chunk) {
      throw new Error(`Chunk ${chunkId} missing from lookup`);
    }

    return {
      page: chunk.pageNumber,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      score,
      matchType: 'fuzzy',
      excerpt: getExcerpt(chunk.text, queryTokens),
      text: chunk.text
    };
  });
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
            .sort((a, b) => b.score - a.score)
            .slice(0, limit * 2);
            
        vectorCandidates = scores.map(s => ({
            page: s.chunk.pageNumber,
            chunkId: s.chunk.id,
            chunkIndex: s.chunk.chunkIndex,
            score: s.score,
            matchType: 'fuzzy',
            excerpt: s.chunk.text.substring(0, 200),
            text: s.chunk.text
        }));
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
