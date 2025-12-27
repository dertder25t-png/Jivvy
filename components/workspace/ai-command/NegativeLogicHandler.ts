/**
 * NegativeLogicHandler - Strategy 4
 * 
 * Handles NOT/EXCEPT questions by searching ALL answer options explicitly,
 * scoring which options have explicit support vs contradiction vs absence,
 * and returning the unsupported option as the answer.
 */

import { pdfWorker } from '@/utils/pdf-extraction';
import { scoreCandidate } from '@/utils/search/scoring';
import { buildSparseVector, cosineSimilarity } from '@/utils/search/semantic';
import type { SearchCandidate } from '@/utils/search/types';

export interface OptionEvidence {
    letter: string;
    text: string;
    evidenceType: 'explicit' | 'implied' | 'absent' | 'contradicted';
    supportScore: number;
    contradictionScore: number;
    bestEvidence: string;
    bestPage: number;
    explanation: string;
}

export interface NegativeLogicResult {
    isNegative: boolean;
    detectedKeyword: string | null;
    optionEvidences: OptionEvidence[];
    selectedAnswer: string;
    confidence: number;
    reasoning: string;
}

// Negative logic keywords and their contexts
const NEGATIVE_KEYWORDS = [
    { keyword: 'NOT', pattern: /\bNOT\b/i, meaning: 'exception' },
    { keyword: 'EXCEPT', pattern: /\bEXCEPT\b/i, meaning: 'exception' },
    { keyword: 'FALSE', pattern: /\bFALSE\b/i, meaning: 'incorrect' },
    { keyword: 'INCORRECT', pattern: /\bINCORRECT\b/i, meaning: 'incorrect' },
    { keyword: 'NEVER', pattern: /\bNEVER\b/i, meaning: 'exception' },
    { keyword: 'LEAST', pattern: /\bLEAST\b/i, meaning: 'minimum' },
    { keyword: 'WRONG', pattern: /\bWRONG\b/i, meaning: 'incorrect' },
    { keyword: 'UNLIKELY', pattern: /\bUNLIKELY\b/i, meaning: 'minimum' }
];

// Contradiction indicators
const CONTRADICTION_PATTERNS = [
    /\bnot\s+\w+/i,
    /\bno\s+\w+/i,
    /\bnever\b/i,
    /\bwithout\b/i,
    /\bexclude[sd]?\b/i,
    /\bprevents?\b/i,
    /\bavoid\b/i,
    /\bshould not\b/i,
    /\bmust not\b/i,
    /\bcannot\b/i,
    /\bdon't\b/i,
    /\bdoesn't\b/i
];

/**
 * Detect if a question uses negative logic
 */
export function detectNegativeLogic(question: string): { isNegative: boolean; keyword: string | null } {
    for (const { keyword, pattern } of NEGATIVE_KEYWORDS) {
        if (pattern.test(question)) {
            return { isNegative: true, keyword };
        }
    }
    return { isNegative: false, keyword: null };
}

/**
 * Analyze all options for evidence support in a negative logic question
 */
export async function analyzeNegativeLogicQuestion(
    question: string,
    options: string[],
    filterPages?: Set<number>
): Promise<NegativeLogicResult> {
    const { isNegative, keyword } = detectNegativeLogic(question);
    
    // Search for each option individually
    const optionEvidences: OptionEvidence[] = [];
    
    for (let i = 0; i < options.length; i++) {
        const letter = String.fromCharCode(65 + i);
        const optionText = options[i];
        
        // Search for this specific option
        const candidates = await pdfWorker.searchCandidates(
            `${question} ${optionText}`,
            filterPages
        );
        
        const evidence = await evaluateOptionEvidence(
            optionText,
            question,
            candidates,
            letter
        );
        
        optionEvidences.push(evidence);
    }
    
    // For negative questions, select the option with LOWEST support
    // (i.e., the exception, the false one, etc.)
    const sortedBySupport = [...optionEvidences].sort((a, b) => {
        // Primary: lowest support wins for negative questions
        // Secondary: higher contradiction helps identify the exception
        const aScore = a.supportScore - (a.contradictionScore * 0.5);
        const bScore = b.supportScore - (b.contradictionScore * 0.5);
        return isNegative ? aScore - bScore : bScore - aScore;
    });
    
    const winner = sortedBySupport[0];
    const runnerUp = sortedBySupport[1];
    
    // Calculate confidence based on score separation
    const scoreDiff = isNegative 
        ? (runnerUp?.supportScore ?? 0) - winner.supportScore
        : winner.supportScore - (runnerUp?.supportScore ?? 0);
    const confidence = Math.min(0.95, Math.max(0.2, scoreDiff / 2 + 0.5));
    
    // Build reasoning
    const reasoning = buildNegativeLogicReasoning(
        isNegative,
        keyword,
        winner,
        optionEvidences
    );
    
    return {
        isNegative,
        detectedKeyword: keyword,
        optionEvidences,
        selectedAnswer: winner.letter,
        confidence,
        reasoning
    };
}

/**
 * Evaluate evidence for a single option
 */
async function evaluateOptionEvidence(
    optionText: string,
    question: string,
    candidates: SearchCandidate[],
    letter: string
): Promise<OptionEvidence> {
    if (candidates.length === 0) {
        return {
            letter,
            text: optionText,
            evidenceType: 'absent',
            supportScore: 0,
            contradictionScore: 0,
            bestEvidence: '',
            bestPage: 0,
            explanation: `No evidence found for "${optionText}"`
        };
    }
    
    const optionVector = buildSparseVector(`${question} ${optionText}`);
    
    let bestSupportScore = 0;
    let bestContradictionScore = 0;
    let bestEvidence = '';
    let bestPage = 0;
    
    for (const candidate of candidates) {
        // Score how well this candidate supports the option
        const detailResult = scoreCandidate(candidate.text, optionText);
        const candidateVector = buildSparseVector(candidate.text);
        const semantic = cosineSimilarity(optionVector, candidateVector);
        
        const supportScore = (detailResult.score / 100) * 0.6 + semantic * 0.4;
        
        // Check for contradictions
        const contradictionScore = calculateContradictionScore(candidate.text, optionText);
        
        if (supportScore > bestSupportScore) {
            bestSupportScore = supportScore;
            bestEvidence = detailResult.excerpt;
            bestPage = candidate.page;
        }
        
        if (contradictionScore > bestContradictionScore) {
            bestContradictionScore = contradictionScore;
        }
    }
    
    // Determine evidence type
    let evidenceType: OptionEvidence['evidenceType'];
    if (bestContradictionScore > 0.5) {
        evidenceType = 'contradicted';
    } else if (bestSupportScore > 0.6) {
        evidenceType = 'explicit';
    } else if (bestSupportScore > 0.3) {
        evidenceType = 'implied';
    } else {
        evidenceType = 'absent';
    }
    
    return {
        letter,
        text: optionText,
        evidenceType,
        supportScore: bestSupportScore,
        contradictionScore: bestContradictionScore,
        bestEvidence,
        bestPage,
        explanation: buildEvidenceExplanation(evidenceType, bestSupportScore, bestContradictionScore)
    };
}

/**
 * Calculate how much the text contradicts the option
 */
function calculateContradictionScore(text: string, option: string): number {
    const lowerText = text.toLowerCase();
    const optionTerms = option.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    
    let contradictionIndicators = 0;
    
    // Check for contradiction patterns near option terms
    for (const term of optionTerms) {
        const termIndex = lowerText.indexOf(term);
        if (termIndex === -1) continue;
        
        // Get context around the term (50 chars before and after)
        const contextStart = Math.max(0, termIndex - 50);
        const contextEnd = Math.min(lowerText.length, termIndex + term.length + 50);
        const context = lowerText.slice(contextStart, contextEnd);
        
        // Check for contradiction patterns in this context
        for (const pattern of CONTRADICTION_PATTERNS) {
            if (pattern.test(context)) {
                contradictionIndicators++;
                break;
            }
        }
    }
    
    return Math.min(1, contradictionIndicators / optionTerms.length);
}

/**
 * Build explanation for evidence type
 */
function buildEvidenceExplanation(
    type: OptionEvidence['evidenceType'],
    support: number,
    contradiction: number
): string {
    switch (type) {
        case 'explicit':
            return `Strong evidence found (support: ${(support * 100).toFixed(0)}%)`;
        case 'implied':
            return `Partial evidence suggests this (support: ${(support * 100).toFixed(0)}%)`;
        case 'absent':
            return `No supporting evidence found in document`;
        case 'contradicted':
            return `Document appears to contradict this (contradiction: ${(contradiction * 100).toFixed(0)}%)`;
    }
}

/**
 * Build reasoning explanation for negative logic answer
 */
function buildNegativeLogicReasoning(
    isNegative: boolean,
    keyword: string | null,
    winner: OptionEvidence,
    allEvidences: OptionEvidence[]
): string {
    const lines: string[] = [];
    
    if (isNegative && keyword) {
        lines.push(`**Negative logic detected:** "${keyword}" keyword found.`);
        lines.push(`Looking for the option that is NOT supported by the document.\n`);
    }
    
    // Sort by support for display
    const sorted = [...allEvidences].sort((a, b) => b.supportScore - a.supportScore);
    
    lines.push('**Evidence Analysis:**');
    for (const ev of sorted) {
        const marker = ev.letter === winner.letter ? '→' : ' ';
        const typeIcon = {
            'explicit': '✓',
            'implied': '~',
            'absent': '✗',
            'contradicted': '⊘'
        }[ev.evidenceType];
        
        lines.push(`${marker} **${ev.letter}** ${typeIcon} ${ev.evidenceType} (${(ev.supportScore * 100).toFixed(0)}% support)`);
    }
    
    lines.push('');
    
    if (isNegative) {
        lines.push(`**Answer: ${winner.letter}** — This option has the ${winner.evidenceType === 'absent' ? 'least' : 'weakest'} evidence, making it the exception.`);
    } else {
        lines.push(`**Answer: ${winner.letter}** — This option has the strongest evidence support.`);
    }
    
    if (winner.bestEvidence) {
        lines.push(`\n> "${winner.bestEvidence.slice(0, 150)}..."`);
    }
    
    return lines.join('\n');
}

/**
 * Quick check if question might need negative logic handling
 */
export function mightBeNegativeQuestion(question: string): boolean {
    return NEGATIVE_KEYWORDS.some(({ pattern }) => pattern.test(question));
}
