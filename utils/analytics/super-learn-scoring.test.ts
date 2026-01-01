import { describe, it, expect } from 'vitest';
import {
  SUPERLEARN_HALF_LIFE_DAYS,
  SUPERLEARN_STRONG_THRESHOLD,
  SUPERLEARN_WEAK_THRESHOLD,
  superLearnDecayFactor,
  superLearnEffectiveScore,
  superLearnReinforceScore,
  superLearnStrength,
} from './super-learn-scoring';

describe('super-learn-scoring', () => {
  it('decays by half over the configured half-life', () => {
    const now = Date.now();
    const halfLifeMs = SUPERLEARN_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

    expect(superLearnDecayFactor(now, now)).toBeCloseTo(1, 6);
    expect(superLearnDecayFactor(now, now + halfLifeMs)).toBeCloseTo(0.5, 6);
    expect(superLearnDecayFactor(now, now + halfLifeMs * 2)).toBeCloseTo(0.25, 6);
  });

  it('computes effective score with decay and clamps to [0,1]', () => {
    const now = 1_700_000_000_000;
    const lastSeen = now - 30 * 24 * 60 * 60 * 1000;

    expect(superLearnEffectiveScore(1, lastSeen, now)).toBeCloseTo(0.5, 6);
    expect(superLearnEffectiveScore(2, lastSeen, now)).toBeCloseTo(0.5, 6);
    expect(superLearnEffectiveScore(-10, lastSeen, now)).toBe(0);
  });

  it('reinforces after applying decay since last seen', () => {
    const now = 1_700_000_000_000;
    const lastSeen = now - 60 * 24 * 60 * 60 * 1000; // ~2 half-lives

    const next = superLearnReinforceScore({
      prevRawScore: 0.8,
      prevLastSeenAt: lastSeen,
      now,
      delta: 0.1,
    });

    // 0.8 decays to ~0.2, then +0.1 => ~0.3
    expect(next).toBeCloseTo(0.3, 3);
  });

  it('classifies weak/ok/strong using thresholds', () => {
    expect(SUPERLEARN_WEAK_THRESHOLD).toBeCloseTo(0.4, 6);
    expect(SUPERLEARN_STRONG_THRESHOLD).toBeCloseTo(0.8, 6);

    expect(superLearnStrength(0)).toBe('weak');
    expect(superLearnStrength(0.39)).toBe('weak');
    expect(superLearnStrength(0.4)).toBe('ok');
    expect(superLearnStrength(0.8)).toBe('ok');
    expect(superLearnStrength(0.81)).toBe('strong');
  });
});
