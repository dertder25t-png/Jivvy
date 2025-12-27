export interface ChunkData {
  /**
   * Unique identifier for this chunk. We use `${pageNumber}-${chunkIndex}` for fast lookups.
   */
  id: string;
  pageNumber: number;
  chunkIndex: number;
  /**
   * Raw text extracted for this chunk.
   */
  text: string;
  /**
   * Tokenized, stopword-filtered representation used for the inverted index.
   */
  tokens: string[];
  /**
   * Token length used for BM25 style normalization.
   */
  length: number;
  /**
   * Extracted keywords for this chunk (Tier 1).
   */
  keywords?: string[];
  /**
   * The section or header this chunk belongs to (Tier 1).
   */
  sectionTitle?: string;
  /**
   * The semantic type of the content (Tier 1).
   */
  type?: 'text' | 'table' | 'list' | 'image';
  /**
   * Dense vector embedding for semantic search (Tier 2).
   */
  embedding?: number[];
}

export interface Posting {
  chunkId: string;
  frequency: number;
}

// Serializable index structure for Worker <-> Main thread communication
export interface IndexStructure {
  chunks: ChunkData[];
  /**
   * Keyword -> postings list referencing chunk ids.
   */
  keywordIndex: Record<string, Posting[]>;
  /**
   * Cached average chunk length for BM25 normalization.
   */
  averageLength: number;
}

export interface SearchCandidate {
  page: number;
  chunkId: string;
  chunkIndex: number;
  score: number;
  matchType: 'exact' | 'phrase' | 'fuzzy';
  excerpt: string;
  text: string; // Full text needed for detailed scoring in Layer 4
}

export interface SearchAnswer {
  answer: string;
  confidence: number; // 0 to 1
  page: number;
  evidence: string;
}
