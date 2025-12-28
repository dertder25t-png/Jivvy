/**
 * QuestionClassifier - Strategy 10
 * 
 * Classifies question types to optimize search and answer strategies:
 * - Factual: Direct lookup questions
 * - Procedural: How-to questions
 * - Comparative: Compare/contrast questions
 * - Causal: Why/because questions
 * - Definitional: What is X questions
 * - Evaluative: Best/worst/should questions
 * - Hypothetical: What if questions
 * - Enumerative: List/count questions
 */

import { analyzeQuestion, QuestionAnalysis } from '@/utils/search/question-analyzer';

export type QuestionType =
    | 'factual'
    | 'procedural'
    | 'comparative'
    | 'causal'
    | 'definitional'
    | 'evaluative'
    | 'hypothetical'
    | 'enumerative'
    | 'diagnostic'
    | 'mechanism'
    | 'unknown';

export interface QuestionClassification {
    type: QuestionType;
    subType: string | null;
    confidence: number;
    suggestedStrategy: SearchStrategy;
    expectedAnswerFormat: AnswerFormat;
    analysis: QuestionAnalysis;
}

export interface SearchStrategy {
    name: string;
    prioritizeSections: string[];
    expandContext: boolean;
    useDecomposition: boolean;
    requireEvidence: boolean;
    useVerification: boolean;  // Strategy 9: Two-pass verification
    maxChunks: number;
}

export type AnswerFormat = 
    | 'sentence'      // Short factual answer
    | 'paragraph'     // Explanation
    | 'list'          // Bullet points
    | 'steps'         // Numbered procedure
    | 'comparison'    // Side-by-side comparison
    | 'table'         // Structured data
    | 'detailed';     // Long-form response

// Classification patterns
const TYPE_PATTERNS: Record<QuestionType, RegExp[]> = {
    factual: [
        /^(?:what|which|who|where|when)\s+(?:is|are|was|were)\b/i,
        /^(?:name|identify|state)\s+(?:the|a|an)\b/i,
        /\b(?:what is the|what are the)\s+\w+\s+(?:of|for|in)\b/i
    ],
    procedural: [
        /^how\s+(?:do|does|can|should|to|would)\b/i,
        /\b(?:steps?|procedure|process|method)\s+(?:to|for)\b/i,
        /\b(?:how to|best way to|correct way to)\b/i,
        /^(?:what are the steps|what is the procedure)\b/i
    ],
    comparative: [
        /\b(?:compare|contrast|difference|differ|versus|vs\.?)\b/i,
        /\b(?:similar|different|better|worse)\s+(?:than|from)\b/i,
        /\b(?:more|less|higher|lower)\s+\w+\s+than\b/i,
        /\bwhich\s+(?:is|are)\s+(?:better|worse|more|less)\b/i
    ],
    causal: [
        /^why\s+(?:is|are|do|does|did|would|should)\b/i,
        /\b(?:cause|causes|caused|causing)\b/i,
        /\b(?:because|reason|result|effect|consequence)\b/i,
        /\b(?:leads? to|results? in|due to)\b/i
    ],
    definitional: [
        /^what\s+(?:is|are)\s+(?:a|an|the)?\s*\w+\??$/i,
        /^define\s+/i,
        /\b(?:definition|meaning|explain what)\b/i,
        /\b(?:refers? to|known as|called)\b/i
    ],
    evaluative: [
        /\b(?:best|worst|most|least|optimal|ideal)\b/i,
        /\b(?:should|recommend|advise|suggest)\b/i,
        /\b(?:advantage|disadvantage|benefit|drawback)\b/i,
        /\b(?:important|critical|essential|necessary)\b/i
    ],
    hypothetical: [
        /^what\s+(?:if|would happen if)\b/i,
        /\b(?:suppose|assume|imagine|hypothetically)\b/i,
        /\b(?:would|could|might)\s+happen\b/i,
        /\bif\s+\w+\s+(?:were|was|is)\b/i
    ],
    enumerative: [
        /\b(?:list|name|identify|enumerate)\s+(?:all|the|some)\b/i,
        /\b(?:how many|what are all|what are the)\b/i,
        /\b(?:types? of|kinds? of|examples? of)\b/i,
        /\b(?:various|different|several|multiple)\s+\w+s?\b/i
    ],
    diagnostic: [
        /\b(?:symptom|indication|sign|diagnos|detected by|indicates)\b/i, // Added 'detected by', 'indicates'
        /\b(?:troubleshoot|debug|fix|solve|resolve)\b/i,
        /\b(?:error|problem|issue|fault|failure)\b/i,
        /\b(?:what is wrong|what causes|why does.*fail)\b/i
    ],
    mechanism: [],
    unknown: []
};

// Strategy recommendations per question type
const TYPE_STRATEGIES: Record<QuestionType, SearchStrategy> = {
    factual: {
        name: 'Direct Lookup',
        prioritizeSections: ['glossary', 'explanation', 'table'],
        expandContext: false,
        useDecomposition: false,
        requireEvidence: true,
        useVerification: false,  // Simple lookups don't need verification
        maxChunks: 4
    },
    procedural: {
        name: 'Procedure Search',
        prioritizeSections: ['procedure', 'example', 'warning'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: true,
        useVerification: true,  // Steps need verification
        maxChunks: 8
    },
    comparative: {
        name: 'Multi-Aspect Search',
        prioritizeSections: ['explanation', 'table', 'summary'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: true,
        useVerification: true,  // Comparisons need accuracy
        maxChunks: 10
    },
    causal: {
        name: 'Causal Chain Search',
        prioritizeSections: ['explanation', 'example', 'diagram'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: true,
        useVerification: true,  // Causal claims need verification
        maxChunks: 8
    },
    definitional: {
        name: 'Definition Lookup',
        prioritizeSections: ['glossary', 'explanation'],
        expandContext: false,
        useDecomposition: false,
        requireEvidence: true,
        useVerification: false,  // Definitions are usually direct matches
        maxChunks: 3
    },
    evaluative: {
        name: 'Evaluation Search',
        prioritizeSections: ['summary', 'explanation', 'example'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: false,
        useVerification: true,  // Evaluations can be subjective
        maxChunks: 8
    },
    hypothetical: {
        name: 'Inference Search',
        prioritizeSections: ['explanation', 'example', 'warning'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: false,
        useVerification: false,  // Hypotheticals are inherently uncertain
        maxChunks: 10
    },
    enumerative: {
        name: 'List Collection',
        prioritizeSections: ['table', 'procedure', 'summary'],
        expandContext: true,
        useDecomposition: false,
        requireEvidence: true,
        useVerification: true,  // Lists need completeness check
        maxChunks: 12
    },
    diagnostic: {
        name: 'Problem Analysis',
        prioritizeSections: ['procedure', 'warning', 'example'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: true,
        useVerification: true,  // Diagnostics need accuracy
        maxChunks: 8
    },
    mechanism: {
        name: 'Causal Chain Search',
        prioritizeSections: ['explanation', 'example', 'diagram'],
        expandContext: true,
        useDecomposition: true,
        requireEvidence: true,
        useVerification: true,
        maxChunks: 8
    },
    unknown: {
        name: 'General Search',
        prioritizeSections: ['explanation'],
        expandContext: true,
        useDecomposition: false,
        requireEvidence: false,
        useVerification: false,
        maxChunks: 6
    }
};

// Expected answer formats per question type
const TYPE_FORMATS: Record<QuestionType, AnswerFormat> = {
    factual: 'sentence',
    procedural: 'steps',
    comparative: 'comparison',
    causal: 'paragraph',
    definitional: 'sentence',
    evaluative: 'paragraph',
    hypothetical: 'paragraph',
    enumerative: 'list',
    diagnostic: 'steps',
    mechanism: 'paragraph',
    unknown: 'paragraph'
};

/**
 * Classify a question to determine optimal search strategy
 */
export function classifyQuestion(question: string): QuestionClassification {
    const analysis = analyzeQuestion(question);
    
    // Score each type
    const typeScores: { type: QuestionType; score: number }[] = [];
    
    for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
        if (type === 'unknown') continue;
        
        let score = 0;
        for (const pattern of patterns) {
            if (pattern.test(question)) {
                score++;
            }
        }
        
        // Boost based on intent alignment
        if (analysis.intent === 'procedure' && type === 'procedural') score += 2;
        if (analysis.intent === 'comparison' && type === 'comparative') score += 2;
        if (analysis.intent === 'diagnosis' && type === 'diagnostic') score += 2;
        if (analysis.intent === 'definition' && type === 'definitional') score += 2;
        
        if (score > 0) {
            typeScores.push({ type: type as QuestionType, score });
        }
    }
    
    // Sort by score
    typeScores.sort((a, b) => b.score - a.score);
    
    let bestType = typeScores[0]?.type ?? 'unknown';
    const confidence = typeScores.length > 0
        ? Math.min(1, typeScores[0].score / 4)
        : 0;

    // Add this condition BEFORE the final return:
    if (/detected by|indicates|caused by|result of|sign of/i.test(question)) {
        bestType = 'mechanism'; 
    }
    
    return {
        type: bestType,
        subType: determineSubType(question, bestType),
        confidence,
        suggestedStrategy: TYPE_STRATEGIES[bestType],
        expectedAnswerFormat: TYPE_FORMATS[bestType],
        analysis
    };
}

/**
 * Determine sub-type for more specific handling
 */
function determineSubType(question: string, mainType: QuestionType): string | null {
    const lowerQ = question.toLowerCase();
    
    switch (mainType) {
        case 'factual':
            if (/when|date|year|time/.test(lowerQ)) return 'temporal';
            if (/where|location|place/.test(lowerQ)) return 'spatial';
            if (/who|person|name/.test(lowerQ)) return 'person';
            if (/what|which/.test(lowerQ)) return 'entity';
            break;
            
        case 'procedural':
            if (/install|setup|configure/.test(lowerQ)) return 'setup';
            if (/troubleshoot|fix|repair/.test(lowerQ)) return 'repair';
            if (/operate|use|run/.test(lowerQ)) return 'operation';
            break;
            
        case 'comparative':
            if (/better|best|prefer/.test(lowerQ)) return 'preference';
            if (/same|similar|alike/.test(lowerQ)) return 'similarity';
            if (/differ|different/.test(lowerQ)) return 'difference';
            break;
    }
    
    return null;
}

/**
 * Get human-readable description of question type
 */
export function getTypeDescription(type: QuestionType): string {
    const descriptions: Record<QuestionType, string> = {
        factual: 'Direct fact lookup',
        procedural: 'How-to or step-by-step',
        comparative: 'Compare and contrast',
        causal: 'Cause and effect',
        definitional: 'Definition or meaning',
        evaluative: 'Evaluation or recommendation',
        hypothetical: 'What-if scenario',
        enumerative: 'List or collection',
        diagnostic: 'Problem diagnosis',
        unknown: 'General question'
    };
    
    return descriptions[type];
}

/**
 * Suggest follow-up questions based on classification
 */
export function suggestFollowUps(classification: QuestionClassification): string[] {
    const { type, analysis } = classification;
    const suggestions: string[] = [];
    
    switch (type) {
        case 'definitional':
            suggestions.push(`How is ${analysis.keyTerms[0]} used in practice?`);
            suggestions.push(`What are examples of ${analysis.keyTerms[0]}?`);
            break;
            
        case 'procedural':
            suggestions.push('What are common mistakes to avoid?');
            suggestions.push('What tools or materials are needed?');
            break;
            
        case 'comparative':
            suggestions.push('When should I use each option?');
            suggestions.push('What are the pros and cons?');
            break;
            
        case 'causal':
            suggestions.push('How can this be prevented?');
            suggestions.push('What are the effects?');
            break;
    }
    
    return suggestions.slice(0, 2);
}

/**
 * Get optimal chunk selection settings based on question type
 */
export function getChunkSelectionSettings(classification: QuestionClassification): {
    minChunks: number;
    maxChunks: number;
    diversityWeight: number;
} {
    const strategy = classification.suggestedStrategy;
    
    return {
        minChunks: Math.max(2, Math.floor(strategy.maxChunks / 2)),
        maxChunks: strategy.maxChunks,
        diversityWeight: strategy.useDecomposition ? 0.3 : 0.1
    };
}
