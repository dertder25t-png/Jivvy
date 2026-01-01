function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.max(min, Math.min(max, n));
}

export function normalizeForConceptMatch(text: string): string {
  return String(text || '')
    .toLowerCase()
    // Replace anything that isn't a letter/number with spaces (unicode-aware)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchConceptsInText(text: string, concepts: string[], maxMatches = 12): string[] {
  const limit = clampInt(maxMatches, 0, 50);
  if (!limit) return [];

  const normalizedText = ` ${normalizeForConceptMatch(text)} `;
  if (normalizedText.trim().length === 0) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const c of concepts || []) {
    const concept = String(c || '').trim().toLowerCase();
    if (!concept) continue;
    if (seen.has(concept)) continue;

    const needle = ` ${normalizeForConceptMatch(concept)} `;
    if (needle.trim().length === 0) continue;

    if (normalizedText.includes(needle)) {
      seen.add(concept);
      out.push(concept);
      if (out.length >= limit) break;
    }
  }

  return out;
}
