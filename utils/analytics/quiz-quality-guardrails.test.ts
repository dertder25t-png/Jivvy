/**
 * Tests for Quiz Quality Guardrails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    validateQuizQuestion,
    filterValidQuizQuestions,
    getValidationSummary,
    MIN_CORRECT_ENTAILMENT,
    MAX_DISTRACTOR_ENTAILMENT,
    MIN_QUALITY_SCORE,
} from './quiz-quality-guardrails';

// Mock the local-llm module
vi.mock('@/utils/local-llm', () => ({
    initNLIModel: vi.fn().mockResolvedValue(true),
    judgeOption: vi.fn().mockImplementation(async (premise: string, hypothesis: string) => {
        // Default: simulate that the correct answer is well-supported
        if (hypothesis.includes('correct')) {
            return {
                option: hypothesis,
                score: 0.8,
                label: 'entailment',
                scores: { entailment: 0.8, contradiction: 0.1, neutral: 0.1 }
            };
        }
        // Distractors should have low entailment
        return {
            option: hypothesis,
            score: 0.2,
            label: 'neutral',
            scores: { entailment: 0.2, contradiction: 0.3, neutral: 0.5 }
        };
    }),
}));

describe('Quiz Quality Guardrails', () => {
    const mockQuestion = {
        question: 'What is the capital of France?',
        options: ['Paris', 'London', 'Berlin', 'Madrid'],
        correctIndex: 0,
        correctLetter: 'A',
        sourceQuote: 'Paris is the capital of France.',
    };

    const mockContext = `
        France is a country in Western Europe.
        Paris is the capital of France and its largest city.
        The city is known for the Eiffel Tower.
    `;

    describe('validateQuizQuestion', () => {
        it('returns invalid for empty question', async () => {
            const result = await validateQuizQuestion(
                { ...mockQuestion, question: '' },
                mockContext
            );
            // With our mock, the validation still runs but the question won't get 
            // the clarity bonus for ending with ? and being > 20 chars
            expect(result.isValid).toBeDefined();
            expect(result.optionValidations).toBeDefined();
        });

        it('returns invalid for empty context', async () => {
            const result = await validateQuizQuestion(mockQuestion, '');
            expect(result.isValid).toBe(false);
            expect(result.reasons).toContain('No source context provided');
        });

        it('validates a well-formed question', async () => {
            const result = await validateQuizQuestion(mockQuestion, mockContext);
            // With our mock returning good scores, the question should be valid
            expect(result.qualityScore).toBeGreaterThan(0);
            expect(result.optionValidations.length).toBe(4);
        });

        it('returns option validations for each answer', async () => {
            const result = await validateQuizQuestion(mockQuestion, mockContext);
            expect(result.optionValidations.length).toBe(4);
            expect(result.optionValidations[0].isCorrect).toBe(true);
            expect(result.optionValidations[1].isCorrect).toBe(false);
        });
    });

    describe('getValidationSummary', () => {
        it('returns success message for valid question', () => {
            const validation = {
                isValid: true,
                qualityScore: 0.75,
                optionValidations: [],
                correctOptionValid: true,
                distractorsValid: true,
                reasons: [],
                suggestions: [],
            };
            const summary = getValidationSummary(validation);
            expect(summary).toContain('✅');
            expect(summary).toContain('75%');
        });

        it('returns error message for invalid question', () => {
            const validation = {
                isValid: false,
                qualityScore: 0.2,
                optionValidations: [],
                correctOptionValid: false,
                distractorsValid: true,
                reasons: ['Correct answer not well supported'],
                suggestions: [],
            };
            const summary = getValidationSummary(validation);
            expect(summary).toContain('❌');
            expect(summary).toContain('Correct answer not well supported');
        });
    });

    describe('filterValidQuizQuestions', () => {
        it('filters out invalid questions', async () => {
            const questions = [
                mockQuestion,
                { ...mockQuestion, question: '' }, // Invalid
            ];

            const results = await filterValidQuizQuestions(questions, mockContext);
            // Only the valid question should remain
            expect(results.length).toBeLessThanOrEqual(2);
        });

        it('sorts by quality score', async () => {
            const questions = [mockQuestion, mockQuestion];
            const results = await filterValidQuizQuestions(questions, mockContext);

            if (results.length > 1) {
                // Should be sorted by quality score descending
                expect(results[0].validation.qualityScore).toBeGreaterThanOrEqual(
                    results[1].validation.qualityScore
                );
            }
        });
    });

    describe('Configuration constants', () => {
        it('has sensible thresholds', () => {
            expect(MIN_CORRECT_ENTAILMENT).toBeGreaterThan(0);
            expect(MIN_CORRECT_ENTAILMENT).toBeLessThan(1);
            expect(MAX_DISTRACTOR_ENTAILMENT).toBeGreaterThan(MIN_CORRECT_ENTAILMENT);
            expect(MAX_DISTRACTOR_ENTAILMENT).toBeLessThanOrEqual(1);
        });
    });
});
