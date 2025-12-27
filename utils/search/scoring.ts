import { tokenizeQuery } from './preprocessor';

export interface ScoreResult {
    score: number;
    excerpt: string;
    matchType: 'exact' | 'phrase' | 'fuzzy';
}

/**
 * Scores a candidate page text against a query.
 * Returns a confidence score (0-100), the best excerpt, and match type.
 */
export function scoreCandidate(text: string, query: string): ScoreResult {
    const cleanText = text.replace(/\s+/g, ' ');
    const lowerText = cleanText.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    
    // 1. Exact Phrase Match (Highest Priority)
    if (lowerText.includes(lowerQuery)) {
        return {
            score: 100,
            excerpt: extractContext(cleanText, lowerText.indexOf(lowerQuery), lowerQuery.length),
            matchType: 'exact'
        };
    }

    // 1.5 Check for Quoted Phrases in Query
    const quoteMatches = query.match(/"([^"]+)"/g);
    if (quoteMatches) {
        for (const quote of quoteMatches) {
            const phrase = quote.replace(/"/g, '').toLowerCase();
            if (lowerText.includes(phrase)) {
                // Boost score significantly if quoted phrase is found
                // We continue to calculate density to find the BEST part of the page
                // but we ensure the score is high.
            } else {
                // If a quoted phrase is MISSING, this candidate is bad.
                return { score: 0, excerpt: '', matchType: 'fuzzy' };
            }
        }
    }

    const queryTokens = tokenizeQuery(query);
    if (queryTokens.length === 0) {
        return { score: 0, excerpt: text.substring(0, 100), matchType: 'fuzzy' };
    }

    // Identify "Important" tokens (Heuristic: Numbers, Long words > 4 chars)
    const importantTokens = new Set(queryTokens.filter(t => t.length > 4 || /\d/.test(t)));

    // 2. Sentence-level density
    // Split into sentences (rough approximation)
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    
    let bestScore = 0;
    let bestSentenceIndex = 0;
    
    // We'll look at a sliding window of 3 sentences to capture context
    for (let i = 0; i < sentences.length; i++) {
        // Construct window: Prev + Current + Next
        const windowSentences = sentences.slice(Math.max(0, i - 1), Math.min(sentences.length, i + 2));
        const windowText = windowSentences.join(' ').toLowerCase();
        
        let hits = 0;
        let importantHits = 0;
        const foundTokens = new Set<string>();

        for (const token of queryTokens) {
            if (windowText.includes(token)) {
                hits++;
                foundTokens.add(token);
                if (importantTokens.has(token)) {
                    importantHits++;
                }
            }
        }
        
        // Metric 1: Density (How packed are the keywords?)
        const weightedHits = hits + (importantHits * 2.0); // Boost important tokens more
        const effectiveLength = Math.min(queryTokens.length, 10); // Cap denominator
        const density = weightedHits / effectiveLength;

        // Metric 2: Coverage (How many UNIQUE query terms are present?)
        // This prevents high scores for repeating just one keyword (e.g. "pressure pressure pressure")
        const coverage = foundTokens.size / queryTokens.length;

        // Combined Score
        // Coverage is critical. If we only have 10% coverage, density shouldn't matter much.
        const combinedScore = (density * 0.6) + (coverage * 0.4);
        
        if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestSentenceIndex = i;
        }
    }

    // Normalize score to 0-100
    // We expect scores around 1.0 - 2.0 for perfect matches due to weighting
    let finalScore = Math.min(99, Math.round(bestScore * 60));
    
    // Extract a window of context (prev + current + next)
    // Expanded window for better explanations
    const startIdx = Math.max(0, bestSentenceIndex - 2);
    const endIdx = Math.min(sentences.length, bestSentenceIndex + 3);
    const excerpt = sentences.slice(startIdx, endIdx).join(' ').trim();

    return {
        score: finalScore,
        excerpt: excerpt,
        matchType: finalScore > 85 ? 'phrase' : 'fuzzy'
    };
}

function extractContext(text: string, index: number, length: number): string {
    const start = Math.max(0, index - 100); // Expanded context
    const end = Math.min(text.length, index + length + 150);
    return (start > 0 ? "..." : "") + text.substring(start, end) + (end < text.length ? "..." : "");
}
