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
