import { ChunkData } from './types';

export const STOP_WORDS = new Set([
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
  'from', 'into', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'about', 'over', 'through', 'out', 'up', 'down'
]);

/**
 * Tokenizes arbitrary text while preserving numerics and filtering stopwords.
 */
export function tokenizeText(text: string): string[] {
  const normalized = text.toLowerCase();
  const cleanText = normalized.replace(/[^\w\s]/g, ' ');
  const rawTokens = cleanText.split(/\s+/);

  return rawTokens
    .map(token => token.trim())
    .filter(token => {
      if (token.length === 0) return false;
      if (STOP_WORDS.has(token)) return false;
      // Allow numeric-only tokens so we can match speeds, model numbers, etc.
      if (/^\d+(?:[.,]\d+)?$/.test(token)) return true;
      // Keep alphabetic tokens with length > 1 (single letters are often noise)
      return token.length > 1;
    });
}

/**
 * Splits page text into overlapping chunks and returns chunk metadata.
 * Chunks roughly approximate the target token length but respect sentence boundaries.
 */
export function chunkPageText(
  text: string,
  pageNumber: number,
  options: { targetTokens?: number; sentenceOverlap?: number } = {}
): ChunkData[] {
  const targetTokens = options.targetTokens ?? 200;
  const sentenceOverlap = options.sentenceOverlap ?? 1;

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);

  const chunks: ChunkData[] = [];
  let buffer: string[] = [];
  let bufferTokens: string[] = [];
  let chunkIndex = 0;

  const pushChunk = () => {
    if (buffer.length === 0) return;
    const chunkText = buffer.join(' ').trim();
    const tokens = tokenizeText(chunkText);
    if (tokens.length === 0) {
      buffer = [];
      bufferTokens = [];
      return;
    }

    const id = `${pageNumber}-${chunkIndex}`;
    chunks.push({
      id,
      pageNumber,
      chunkIndex,
      text: chunkText,
      tokens,
      length: tokens.length
    });

    chunkIndex++;

    if (sentenceOverlap > 0 && buffer.length > sentenceOverlap) {
      // Preserve the tail for overlapping context
      buffer = buffer.slice(-sentenceOverlap);
      bufferTokens = tokenizeText(buffer.join(' '));
    } else {
      buffer = [];
      bufferTokens = [];
    }
  };

  for (const sentence of sentences) {
    buffer.push(sentence);
    const sentenceTokens = tokenizeText(sentence);
    bufferTokens = bufferTokens.concat(sentenceTokens);

    if (bufferTokens.length >= targetTokens) {
      pushChunk();
    }
  }

  // Flush remaining text
  pushChunk();

  // Edge case: if there were no sentence boundaries, fall back to raw text chunking
  if (chunks.length === 0) {
    const tokens = tokenizeText(text);
    if (tokens.length > 0) {
      chunks.push({
        id: `${pageNumber}-0`,
        pageNumber,
        chunkIndex: 0,
        text: text.trim(),
        tokens,
        length: tokens.length
      });
    }
  }

  return chunks;
}

export function tokenizeQuery(query: string): string[] {
  return tokenizeText(query);
}
