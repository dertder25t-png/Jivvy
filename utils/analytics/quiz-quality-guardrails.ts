/**
 * Quiz Quality Guardrails
 * 
 * Validates quiz questions by ensuring options are grounded in source text
 * and rejecting questions with low entailment confidence.
 * 
 * Uses NLI (Natural Language Inference) model to judge whether each option
 * is supported by, contradicted by, or neutral to the source context.
 */

import { judgeOption, initNLIModel, type NLIResult } from '@/utils/local-llm';
import { createAppError, type AppError } from '@/lib/errors';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Minimum entailment confidence for the correct answer to be considered valid.
 * If the correct option doesn't reach this threshold, the question is rejected.
 */
export const MIN_CORRECT_ENTAILMENT = 0.35;

/**
 * Maximum entailment confidence for distractors (wrong options).
 * If a wrong option has too high entailment, it may confuse learners.
 */
export const MAX_DISTRACTOR_ENTAILMENT = 0.75;

/**
 * Minimum overall quality score for a question to be accepted.
 */
export const MIN_QUALITY_SCORE = 0.4;

// ============================================================================
// TYPES
// ============================================================================

export interface QuizOptionValidation {
    option: string;
    index: number;
    letter: string;
    isCorrect: boolean;
    nliResult: NLIResult;
    isValid: boolean;
    reason?: string;
}

export interface QuizValidationResult {
    isValid: boolean;
    qualityScore: number;
    optionValidations: QuizOptionValidation[];
    correctOptionValid: boolean;
    distractorsValid: boolean;
    reasons: string[];
    suggestions: string[];
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    correctLetter: string;
    sourceQuote?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Initialize the NLI judge model for validation.
 * Should be called once before validating multiple questions.
 */
export async function initQuizValidator(
    onProgress?: (p: { status: string; progress?: number }) => void
): Promise<boolean> {
    return initNLIModel(onProgress);
}

/**
 * Validate a single quiz question against source context.
 * 
 * This function:
 * 1. Checks if the correct answer is supported by the source text (entailment)
 * 2. Checks if distractors are not too strongly supported (avoiding ambiguity)
 * 3. Computes an overall quality score
 * 
 * @param question The quiz question to validate
 * @param sourceContext The source text the question was generated from
 * @param onProgress Progress callback for UI feedback
 * @returns Validation result with detailed feedback
 */
export async function validateQuizQuestion(
    question: QuizQuestion,
    sourceContext: string,
    onProgress?: (p: { status: string; progress?: number }) => void
): Promise<QuizValidationResult> {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    const optionValidations: QuizOptionValidation[] = [];

    if (!question || !question.options || question.options.length === 0) {
        return {
            isValid: false,
            qualityScore: 0,
            optionValidations: [],
            correctOptionValid: false,
            distractorsValid: false,
            reasons: ['Invalid question structure'],
            suggestions: ['Regenerate the question'],
        };
    }

    if (!sourceContext || sourceContext.trim().length === 0) {
        return {
            isValid: false,
            qualityScore: 0,
            optionValidations: [],
            correctOptionValid: false,
            distractorsValid: false,
            reasons: ['No source context provided'],
            suggestions: ['Add lecture notes or highlights before generating questions'],
        };
    }

    onProgress?.({ status: 'Initializing judge model...', progress: 10 });

    // Initialize NLI model if needed
    const modelReady = await initNLIModel(onProgress);
    if (!modelReady) {
        return {
            isValid: false,
            qualityScore: 0,
            optionValidations: [],
            correctOptionValid: false,
            distractorsValid: false,
            reasons: ['Failed to load judge model'],
            suggestions: ['Try again or check storage space'],
        };
    }

    // Build premise from source context and question
    const premise = `${sourceContext.slice(0, 2000)}\n\nQuestion: ${question.question}`;
    const letters = ['A', 'B', 'C', 'D'];

    // Validate each option
    for (let i = 0; i < question.options.length && i < 4; i++) {
        const option = question.options[i];
        const isCorrect = i === question.correctIndex;
        const letter = letters[i];

        onProgress?.({ 
            status: `Validating option ${letter}...`, 
            progress: 20 + (i * 20) 
        });

        try {
            // Judge whether this option is entailed by the source
            const hypothesis = `The answer "${option}" is correct.`;
            const nliResult = await judgeOption(premise, hypothesis);

            const validation: QuizOptionValidation = {
                option,
                index: i,
                letter,
                isCorrect,
                nliResult,
                isValid: true,
            };

            // Validate correct answer
            if (isCorrect) {
                if (nliResult.scores.entailment < MIN_CORRECT_ENTAILMENT) {
                    validation.isValid = false;
                    validation.reason = `Correct answer has low support (${(nliResult.scores.entailment * 100).toFixed(0)}% confidence)`;
                    reasons.push(`Option ${letter} (correct): Not well supported by source text`);
                    suggestions.push('The correct answer should be more clearly stated in the source material');
                } else if (nliResult.scores.contradiction > 0.5) {
                    validation.isValid = false;
                    validation.reason = `Correct answer contradicts source text`;
                    reasons.push(`Option ${letter} (correct): Contradicts source text`);
                    suggestions.push('Regenerate the question - the correct answer conflicts with the source');
                }
            } else {
                // Validate distractor
                if (nliResult.scores.entailment > MAX_DISTRACTOR_ENTAILMENT) {
                    validation.isValid = false;
                    validation.reason = `Distractor is too strongly supported (${(nliResult.scores.entailment * 100).toFixed(0)}% confidence)`;
                    reasons.push(`Option ${letter} (distractor): Also appears correct`);
                    suggestions.push(`Option ${letter} is ambiguous - it could also be a valid answer`);
                }
            }

            optionValidations.push(validation);
        } catch (error) {
            console.warn(`[QuizValidation] Failed to validate option ${letter}:`, error);
            optionValidations.push({
                option,
                index: i,
                letter,
                isCorrect,
                nliResult: {
                    option,
                    score: 0,
                    label: 'neutral',
                    scores: { entailment: 0, contradiction: 0, neutral: 1 }
                },
                isValid: false,
                reason: 'Validation failed'
            });
        }
    }

    onProgress?.({ status: 'Computing quality score...', progress: 90 });

    // Check if correct option is valid
    const correctValidation = optionValidations.find(v => v.isCorrect);
    const correctOptionValid = correctValidation?.isValid ?? false;

    // Check if all distractors are valid
    const distractorValidations = optionValidations.filter(v => !v.isCorrect);
    const distractorsValid = distractorValidations.every(v => v.isValid);

    // Compute quality score
    let qualityScore = 0;
    
    if (correctValidation) {
        // Correct answer contribution (40% weight)
        qualityScore += correctValidation.nliResult.scores.entailment * 0.4;
        
        // Distractor quality contribution (40% weight)
        // Good distractors should be neutral or contradicted
        const distractorScore = distractorValidations.reduce((sum, v) => {
            // Score is higher when entailment is lower (good distractor)
            return sum + (1 - v.nliResult.scores.entailment);
        }, 0) / Math.max(distractorValidations.length, 1);
        qualityScore += distractorScore * 0.4;
        
        // Source quote bonus (10% weight)
        if (question.sourceQuote && question.sourceQuote.length > 10) {
            qualityScore += 0.1;
        }
        
        // Question clarity bonus (10% weight) - simple heuristic
        if (question.question.endsWith('?') && question.question.length > 20) {
            qualityScore += 0.1;
        }
    }

    const isValid = correctOptionValid && distractorsValid && qualityScore >= MIN_QUALITY_SCORE;

    if (!isValid && reasons.length === 0) {
        reasons.push('Overall quality score too low');
        suggestions.push('Try regenerating with more specific source text');
    }

    onProgress?.({ status: 'Validation complete', progress: 100 });

    return {
        isValid,
        qualityScore,
        optionValidations,
        correctOptionValid,
        distractorsValid,
        reasons,
        suggestions,
    };
}

/**
 * Batch validate multiple quiz questions.
 * Returns only the valid questions with their validation scores.
 */
export async function filterValidQuizQuestions(
    questions: QuizQuestion[],
    sourceContext: string,
    onProgress?: (p: { status: string; progress?: number }) => void
): Promise<{ question: QuizQuestion; validation: QuizValidationResult }[]> {
    const results: { question: QuizQuestion; validation: QuizValidationResult }[] = [];

    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        onProgress?.({
            status: `Validating question ${i + 1} of ${questions.length}...`,
            progress: Math.round((i / questions.length) * 100)
        });

        const validation = await validateQuizQuestion(question, sourceContext);
        
        if (validation.isValid) {
            results.push({ question, validation });
        }
    }

    // Sort by quality score (highest first)
    results.sort((a, b) => b.validation.qualityScore - a.validation.qualityScore);

    onProgress?.({ status: 'Batch validation complete', progress: 100 });

    return results;
}

/**
 * Get a human-readable summary of validation results.
 */
export function getValidationSummary(validation: QuizValidationResult): string {
    if (validation.isValid) {
        return `✅ Valid (${(validation.qualityScore * 100).toFixed(0)}% quality)`;
    }

    const issues = validation.reasons.slice(0, 2).join('; ');
    return `❌ Invalid: ${issues}`;
}

/**
 * Structured error for quiz validation failures
 */
export function createQuizValidationError(validation: QuizValidationResult): AppError {
    return createAppError(
        'QUIZ_VALIDATION_FAILED',
        'Quiz question did not pass quality checks',
        {
            retryable: true,
            detail: {
                qualityScore: validation.qualityScore,
                reasons: validation.reasons,
                suggestions: validation.suggestions,
                optionIssues: validation.optionValidations
                    .filter(v => !v.isValid)
                    .map(v => ({ letter: v.letter, reason: v.reason })),
            },
        }
    );
}
