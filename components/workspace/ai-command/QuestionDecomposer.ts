/**
 * QuestionDecomposer - Strategy 2
 * 
 * Breaks complex questions into sub-questions for parallel searching.
 * Runs separate searches for each sub-question and merges results.
 */

import { analyzeQuestion, QuestionAnalysis } from '@/utils/search/question-analyzer';
import { pdfWorker } from '@/utils/pdf-extraction';
import type { SearchCandidate } from '@/utils/search/types';

export interface SubQuestion {
    id: string;
    text: string;
    type: 'main' | 'context' | 'definition' | 'comparison' | 'constraint' | 'fact' | 'mechanism';
    priority: number;
}

export interface DecomposedQuestion {
    original: string;
    analysis: QuestionAnalysis;
    subQuestions: SubQuestion[];
    isComplex: boolean;
}

export interface MergedSearchResult {
    candidates: SearchCandidate[];
    subQuestionResults: Map<string, SearchCandidate[]>;
    totalCandidates: number;
}

// Patterns for detecting complex question structures
const COMPLEX_PATTERNS = {
    multiPart: /\b(and also|as well as|in addition|furthermore|moreover)\b/i,
    conditional: /\b(if|when|assuming|given that|provided that)\b/i,
    comparative: /\b(compare|versus|vs\.?|difference between|better than|more than)\b/i,
    causal: /\b(why|because|cause|effect|result|leads to|due to)\b/i,
    sequential: /\b(first|then|after|before|next|finally|steps)\b/i,
    embedded: /\b(which|that|where|who)\s+\w+\s+\w+/i
};

// Question type templates for decomposition
const DECOMPOSITION_TEMPLATES: Record<string, (q: string, analysis: QuestionAnalysis) => SubQuestion[]> = {
    definition: (q, analysis) => {
        const subQs: SubQuestion[] = [
            { id: 'main', text: q, type: 'main', priority: 1 }
        ];
        
        // NEW LOGIC: Join key terms into a single specific phrase
        // instead of searching for them individually
        const subject = analysis.keyTerms
            .filter(k => k.length > 3 && !/^(what|when|where|does|how|purpose|function)$/i.test(k))
            .join(' ');

        if (subject.length > 0) {
            subQs.push({
                id: 'def-subject',
                text: `What is ${subject}? Detailed explanation of ${subject}`,
                type: 'definition',
                priority: 0.9
            });
        }
        
        return subQs;
    },
    
    comparison: (q, analysis) => {
        const subQs: SubQuestion[] = [
            { id: 'main', text: q, type: 'main', priority: 1 }
        ];
        
        // Extract items being compared
        const vsMatch = q.match(/(.+?)\s+(?:versus|vs\.?|compared to|or)\s+(.+?)(?:\?|$)/i);
        if (vsMatch) {
            subQs.push(
                { id: 'item-a', text: `What is ${vsMatch[1].trim()}?`, type: 'definition', priority: 0.7 },
                { id: 'item-b', text: `What is ${vsMatch[2].trim()}?`, type: 'definition', priority: 0.7 }
            );
        }
        
        return subQs;
    },
    
    procedure: (q, analysis) => {
        const subQs: SubQuestion[] = [
            { id: 'main', text: q, type: 'main', priority: 1 }
        ];
        
        // Add context for procedure constraints
        analysis.constraints.forEach((constraint, i) => {
            subQs.push({
                id: `ctx-${i}`,
                text: constraint,
                type: 'constraint',
                priority: 0.5
            });
        });
        
        return subQs;
    },
    
    diagnosis: (question, analysis) => {
        const subQs: SubQuestion[] = [];
        const subject = analysis.keyTerms.filter(k => k.length > 3).join(' ');

        // 1. Ask about symptoms directly
        subQs.push({ id: 'symptoms', text: `What are the symptoms of ${subject}?`, type: 'fact', priority: 1 });
        
        // 2. Ask about the specific indicators mentioned in the options
        // (This helps the AI connect "icing" to "manifold pressure")
        subQs.push({ id: 'mech-1', text: `How does ${subject} affect manifold pressure?`, type: 'mechanism', priority: 0.9 });
        subQs.push({ id: 'mech-2', text: `How does ${subject} affect RPM?`, type: 'mechanism', priority: 0.9 });
        
        return subQs;
    }
};

/**
 * Analyze and decompose a complex question into searchable sub-questions
 */
export function decomposeQuestion(question: string): DecomposedQuestion {
    const analysis = analyzeQuestion(question);
    
    // Determine if question is complex
    const isComplex = Object.values(COMPLEX_PATTERNS).some(pattern => pattern.test(question)) ||
                      analysis.constraints.length > 1 ||
                      analysis.keyTerms.length > 5;
    
    // Get appropriate decomposition template
    const template = DECOMPOSITION_TEMPLATES[analysis.intent] || DECOMPOSITION_TEMPLATES.definition;
    const subQuestions = template(question, analysis);
    
    // Add constraint-based sub-questions for complex queries
    if (isComplex && analysis.constraints.length > 0) {
        analysis.constraints.forEach((constraint, i) => {
            if (!subQuestions.some(sq => sq.text.includes(constraint))) {
                subQuestions.push({
                    id: `constraint-${i}`,
                    text: `${constraint} ${analysis.keyTerms.slice(0, 2).join(' ')}`,
                    type: 'constraint',
                    priority: 0.4
                });
            }
        });
    }
    
    // Add negation handling
    if (analysis.negations.length > 0) {
        subQuestions.push({
            id: 'negation-context',
            text: `${analysis.keyTerms.join(' ')} ${analysis.negations.join(' ')}`,
            type: 'context',
            priority: 0.7
        });
    }
    
    return {
        original: question,
        analysis,
        subQuestions,
        isComplex
    };
}

/**
 * Run parallel searches for all sub-questions and merge results
 */
export async function searchWithDecomposition(
    question: string,
    filterPages?: Set<number>
): Promise<MergedSearchResult> {
    const decomposed = decomposeQuestion(question);
    const subQuestionResults = new Map<string, SearchCandidate[]>();
    
    // Run searches in parallel for all sub-questions
    const searchPromises = decomposed.subQuestions.map(async (subQ) => {
        const candidates = await pdfWorker.searchCandidates(subQ.text, filterPages);
        return { id: subQ.id, candidates, priority: subQ.priority };
    });
    
    const results = await Promise.all(searchPromises);
    
    // Collect and weight results
    const candidateMap = new Map<string, { candidate: SearchCandidate; weightedScore: number }>();
    
    for (const result of results) {
        subQuestionResults.set(result.id, result.candidates);
        
        for (const candidate of result.candidates) {
            const existing = candidateMap.get(candidate.chunkId);
            const weightedScore = candidate.score * result.priority;
            
            if (existing) {
                // Merge scores - boost candidates that appear in multiple sub-question results
                existing.weightedScore = Math.max(existing.weightedScore, weightedScore) * 1.2;
            } else {
                candidateMap.set(candidate.chunkId, { candidate, weightedScore });
            }
        }
    }
    
    // Sort by weighted score and return
    const mergedCandidates = Array.from(candidateMap.values())
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .map(item => ({
            ...item.candidate,
            score: item.weightedScore
        }));
    
    return {
        candidates: mergedCandidates,
        subQuestionResults,
        totalCandidates: mergedCandidates.length
    };
}

/**
 * Get decomposition summary for debugging/display
 */
export function getDecompositionSummary(decomposed: DecomposedQuestion): string {
    const lines = [
        `Original: ${decomposed.original}`,
        `Intent: ${decomposed.analysis.intent}`,
        `Complex: ${decomposed.isComplex}`,
        `Sub-questions (${decomposed.subQuestions.length}):`
    ];
    
    decomposed.subQuestions.forEach(sq => {
        lines.push(`  - [${sq.type}] ${sq.text} (priority: ${sq.priority})`);
    });
    
    return lines.join('\n');
}
