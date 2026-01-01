import { describe, it, expect } from 'vitest';
import { matchConceptsInText, normalizeForConceptMatch } from './super-learn-quiz-tagging';

describe('super-learn-quiz-tagging', () => {
  it('normalizes punctuation and whitespace', () => {
    expect(normalizeForConceptMatch('  Photosynthesis—converts  light!  ')).toBe('photosynthesis converts light');
  });

  it('matches concepts as whole tokens (space-bounded)', () => {
    const concepts = ['cell', 'mitosis', 'photosynthesis'];

    // Should not match "cell" inside "cells".
    const text = 'Q: Which process splits one nucleus into two?\nA) cells\nB) mitosis\nC) meiosis';
    expect(matchConceptsInText(text, concepts)).toEqual(['mitosis']);
  });

  it('matches multi-word concepts', () => {
    const concepts = ['newton s first law', 'mass'];
    const text = 'Newton\'s first law states an object stays at rest unless acted on.';
    expect(matchConceptsInText(text, concepts)).toEqual(['newton s first law']);
  });

  it('caps match count deterministically', () => {
    const concepts = Array.from({ length: 100 }, (_, i) => `concept ${i}`);
    const text = concepts.slice(0, 30).join(' ');
    expect(matchConceptsInText(text, concepts, 5)).toHaveLength(5);
  });
});
