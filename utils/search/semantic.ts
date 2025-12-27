import { tokenizeText } from './preprocessor';

export interface SparseVector {
  weights: Map<string, number>;
  norm: number;
}

/**
 * Builds a lightweight sparse vector using tokens and bigrams. This serves as a fast
 * semantic proxy without requiring heavy embeddings.
 */
export function buildSparseVector(text: string): SparseVector {
  const tokens = tokenizeText(text);
  const weights = new Map<string, number>();

  for (const token of tokens) {
    weights.set(token, (weights.get(token) ?? 0) + 1);
  }

  // Add bigram features with smaller weight to capture short phrases.
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}__${tokens[i + 1]}`;
    weights.set(bigram, (weights.get(bigram) ?? 0) + 0.5);
  }

  let norm = 0;
  for (const weight of weights.values()) {
    norm += weight * weight;
  }
  norm = Math.sqrt(norm);

  return { weights, norm: norm === 0 ? 1 : norm };
}

export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  // Iterate through smaller map for efficiency
  const [smaller, larger] = a.weights.size < b.weights.size ? [a, b] : [b, a];

  for (const [feature, weight] of smaller.weights.entries()) {
    const otherWeight = larger.weights.get(feature);
    if (otherWeight !== undefined) {
      dot += weight * otherWeight;
    }
  }

  return dot / (a.norm * b.norm);
}

/**
 * Calculates cosine similarity between two dense vectors (arrays of numbers).
 */
export function cosineSimilarityDense(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const div = Math.sqrt(normA) * Math.sqrt(normB);
    return div === 0 ? 0 : dot / div;
}
