/**
 * SectionDetector - Strategy 7
 * 
 * Detects semantic section types in PDF content:
 * - explanation: Descriptive, educational content
 * - glossary: Term definitions
 * - table: Tabular data
 * - diagram: Figure/image references
 * - procedure: Step-by-step instructions
 * 
 * Used to tag chunks and boost relevant section types in scoring.
 */

export type SectionType = 
    | 'explanation'
    | 'glossary'
    | 'table'
    | 'diagram'
    | 'procedure'
    | 'formula'
    | 'warning'
    | 'example'
    | 'summary'
    | 'reference'
    | 'unknown';

export interface SectionClassification {
    type: SectionType;
    confidence: number;
    indicators: string[];
}

export interface TaggedChunk {
    text: string;
    sectionType: SectionType;
    sectionConfidence: number;
    isHighValue: boolean; // True for explanation, procedure, glossary
}

// Pattern definitions for each section type
const SECTION_PATTERNS: Record<SectionType, { patterns: RegExp[]; weight: number }> = {
    explanation: {
        patterns: [
            /\b(?:explain(?:s|ed|ing)?|describ(?:es?|ed|ing)|illustrat(?:es?|ed|ing))\b/i,
            /\b(?:means?|refers?\s+to|known\s+as|defined\s+as)\b/i,
            /\b(?:because|therefore|thus|hence|consequently)\b/i,
            /\b(?:purpose|function|role|significance)\s+(?:of|is)\b/i,
            /\bis\s+(?:a|an|the)\s+\w+\s+(?:that|which|where)\b/i
        ],
        weight: 1.3 // Boost explanations in scoring
    },
    glossary: {
        patterns: [
            /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*[-–:]\s+[A-Z]/m, // Term - Definition
            /\b(?:glossary|definitions?|terminology)\b/i,
            /\b(?:term|word|phrase)\s+(?:means?|refers?\s+to)\b/i,
            /^(?:\d+\.\s+)?[A-Z][a-z]+:\s+[A-Z]/m // Numbered definitions
        ],
        weight: 1.2
    },
    table: {
        patterns: [
            /\b(?:table|chart)\s+\d+/i,
            /\|\s*\w+\s*\|.*\|/,  // Pipe-separated columns
            /^\s*\w+\s{3,}\w+\s{3,}\w+/m, // Space-aligned columns
            /\b(?:row|column|cell)\b/i,
            /(?:\d+(?:\.\d+)?%?\s+){3,}/ // Multiple numbers in sequence
        ],
        weight: 1.0
    },
    diagram: {
        patterns: [
            /\b(?:figure|fig\.?)\s+\d+/i,
            /\b(?:diagram|illustration|schematic|drawing)\b/i,
            /\b(?:see|refer\s+to|shown\s+in)\s+(?:figure|fig\.?)/i,
            /\b(?:image|picture|photo(?:graph)?)\b/i,
            /\[(Figure|Image|Diagram)\s*\d*\]/i
        ],
        weight: 0.9
    },
    procedure: {
        patterns: [
            /\b(?:step|procedure)\s+\d+/i,
            /^\s*\d+\.\s+[A-Z][a-z]+/m, // Numbered steps
            /\b(?:first|then|next|finally|lastly)\b/i,
            /\b(?:how\s+to|instructions?|follow(?:ing)?\s+steps?)\b/i,
            /\b(?:perform|execute|carry\s+out|conduct)\b/i,
            /\b(?:ensure|verify|check\s+that|make\s+sure)\b/i
        ],
        weight: 1.25
    },
    formula: {
        patterns: [
            /[=><≤≥±∑∏∫√]\s*[\d\w]/,
            /\b(?:equation|formula|calculation)\b/i,
            /\b(?:equals?|plus|minus|multiply|divide)\b/i,
            /\(\s*[a-z]\s*[+\-*/]\s*[a-z]\s*\)/i, // (a + b) pattern
            /\d+\s*[+\-*/×÷]\s*\d+/
        ],
        weight: 1.0
    },
    warning: {
        patterns: [
            /\b(?:warning|caution|danger|alert)\b/i,
            /\b(?:note|important|attention)\s*:/i,
            /\b(?:do\s+not|never|avoid|must\s+not)\b/i,
            /[⚠⛔❗‼️]/,
            /\b(?:critical|hazard(?:ous)?|risk)\b/i
        ],
        weight: 1.1
    },
    example: {
        patterns: [
            /\b(?:example|e\.g\.|for\s+instance|such\s+as)\b/i,
            /\b(?:consider|suppose|imagine|let's\s+say)\b/i,
            /\b(?:sample|case\s+study|scenario)\b/i,
            /:\s*$/m // Colon at end often precedes example
        ],
        weight: 1.15
    },
    summary: {
        patterns: [
            /\b(?:summary|conclusion|recap|overview)\b/i,
            /\b(?:in\s+(?:summary|conclusion)|to\s+summarize)\b/i,
            /\b(?:key\s+points?|takeaways?|highlights?)\b/i,
            /\b(?:main\s+(?:ideas?|concepts?))\b/i
        ],
        weight: 1.1
    },
    reference: {
        patterns: [
            /\b(?:reference|bibliography|citation)\b/i,
            /\[\d+\]/, // [1], [2], etc.
            /\b(?:et\s+al\.|ibid\.|op\.\s*cit\.)\b/i,
            /\(\d{4}\)/, // Year citations
            /\b(?:source|cited\s+in)\b/i
        ],
        weight: 0.8
    },
    unknown: {
        patterns: [],
        weight: 1.0
    }
};

// High-value section types for answer generation
const HIGH_VALUE_SECTIONS = new Set<SectionType>([
    'explanation',
    'procedure',
    'glossary',
    'example'
]);

/**
 * Detect section type for a chunk of text
 */
export function detectSectionType(text: string): SectionClassification {
    const scores: { type: SectionType; score: number; matches: string[] }[] = [];
    
    for (const [type, config] of Object.entries(SECTION_PATTERNS)) {
        if (type === 'unknown') continue;
        
        let score = 0;
        const matches: string[] = [];
        
        for (const pattern of config.patterns) {
            const match = text.match(pattern);
            if (match) {
                score += 1;
                matches.push(match[0]);
            }
        }
        
        if (score > 0) {
            scores.push({ type: type as SectionType, score, matches });
        }
    }
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    if (scores.length === 0) {
        return { type: 'unknown', confidence: 0, indicators: [] };
    }
    
    const best = scores[0];
    const confidence = Math.min(1, best.score / 3); // Normalize: 3+ matches = full confidence
    
    return {
        type: best.type,
        confidence,
        indicators: best.matches
    };
}

/**
 * Tag a chunk with section information
 */
export function tagChunk(text: string): TaggedChunk {
    const classification = detectSectionType(text);
    
    return {
        text,
        sectionType: classification.type,
        sectionConfidence: classification.confidence,
        isHighValue: HIGH_VALUE_SECTIONS.has(classification.type)
    };
}

/**
 * Get boost multiplier for a section type
 */
export function getSectionBoost(type: SectionType): number {
    return SECTION_PATTERNS[type]?.weight ?? 1.0;
}

/**
 * Apply section-based scoring boost
 */
export function applyScoreBoost(
    baseScore: number,
    sectionType: SectionType,
    sectionConfidence: number
): number {
    const boost = getSectionBoost(sectionType);
    // Blend boost based on confidence
    const effectiveBoost = 1 + (boost - 1) * sectionConfidence;
    return baseScore * effectiveBoost;
}

/**
 * Batch classify multiple chunks
 */
export function classifyChunks(texts: string[]): TaggedChunk[] {
    return texts.map(tagChunk);
}

/**
 * Get section type distribution for analytics
 */
export function getSectionDistribution(chunks: TaggedChunk[]): Map<SectionType, number> {
    const distribution = new Map<SectionType, number>();
    
    for (const chunk of chunks) {
        const count = distribution.get(chunk.sectionType) || 0;
        distribution.set(chunk.sectionType, count + 1);
    }
    
    return distribution;
}

/**
 * Filter chunks by section type
 */
export function filterBySectionType(
    chunks: TaggedChunk[],
    types: SectionType[]
): TaggedChunk[] {
    const typeSet = new Set(types);
    return chunks.filter(chunk => typeSet.has(chunk.sectionType));
}

/**
 * Sort chunks prioritizing high-value sections
 */
export function sortByValuePriority(chunks: TaggedChunk[]): TaggedChunk[] {
    return [...chunks].sort((a, b) => {
        // High value first
        if (a.isHighValue !== b.isHighValue) {
            return a.isHighValue ? -1 : 1;
        }
        // Then by confidence
        return b.sectionConfidence - a.sectionConfidence;
    });
}
