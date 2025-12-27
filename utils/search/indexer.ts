import { ChunkData, IndexStructure, Posting } from './types';

/**
 * Builds an inverted index from preprocessed pages.
 */
export function buildIndex(chunks: ChunkData[]): IndexStructure {
  const keywordIndex: Record<string, Posting[]> = {};

  for (const chunk of chunks) {
    const termFrequency = new Map<string, number>();
    for (const token of chunk.tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    for (const [token, frequency] of termFrequency.entries()) {
      if (!keywordIndex[token]) {
        keywordIndex[token] = [];
      }
      keywordIndex[token].push({ chunkId: chunk.id, frequency });
    }
  }

  const averageLength =
    chunks.length > 0
      ? chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length
      : 0;

  return {
    chunks,
    keywordIndex,
    averageLength
  };
}
