export const SUPERLEARN_HALF_LIFE_DAYS = 30;

export const SUPERLEARN_WEAK_THRESHOLD = 0.4;
export const SUPERLEARN_STRONG_THRESHOLD = 0.8;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function superLearnDecayFactor(lastSeenAt: number, now: number, halfLifeDays = SUPERLEARN_HALF_LIFE_DAYS): number {
  const safeHalfLife = Number.isFinite(halfLifeDays) && halfLifeDays > 0 ? halfLifeDays : SUPERLEARN_HALF_LIFE_DAYS;
  const days = Math.max(0, (now - lastSeenAt) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, days / safeHalfLife);
}

export function superLearnEffectiveScore(rawScore: number, lastSeenAt: number, now: number): number {
  const score = clamp01(rawScore);
  const seen = Number.isFinite(lastSeenAt) ? lastSeenAt : now;
  return clamp01(score * superLearnDecayFactor(seen, now));
}

export function superLearnReinforceScore(params: {
  prevRawScore: number;
  prevLastSeenAt: number;
  now: number;
  delta?: number;
}): number {
  const delta = Number.isFinite(params.delta) ? (params.delta as number) : 0.08;
  const prev = clamp01(params.prevRawScore);
  const prevSeen = Number.isFinite(params.prevLastSeenAt) ? params.prevLastSeenAt : params.now;

  // Apply time decay up to `now`, then reinforce.
  const decayed = superLearnEffectiveScore(prev, prevSeen, params.now);
  return clamp01(decayed + delta);
}

export type SuperLearnStrength = 'weak' | 'ok' | 'strong';

export function superLearnStrength(score: number): SuperLearnStrength {
  const s = clamp01(score);
  if (s < SUPERLEARN_WEAK_THRESHOLD) return 'weak';
  if (s > SUPERLEARN_STRONG_THRESHOLD) return 'strong';
  return 'ok';
}
