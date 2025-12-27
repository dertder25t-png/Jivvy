import { STOP_WORDS } from './preprocessor';

/**
 * Simple RAKE (Rapid Automatic Keyword Extraction) implementation
 * Extracts key phrases from text based on word co-occurrence and frequency.
 */
export function extractKeywords(text: string, maxKeywords: number = 5): string[] {
    // 1. Split by delimiters to get candidate phrases
    // We split by punctuation and newlines to find "candidate phrases"
    const phrases = text.split(/[,.;:!?()"\n]+/).map(p => p.trim()).filter(p => p.length > 0);
    
    const wordFreq: Record<string, number> = {};
    const wordDegree: Record<string, number> = {};
    
    // 2. Calculate word scores (frequency and degree)
    phrases.forEach(phrase => {
        // Filter stopwords and short words/numbers
        const words = phrase.toLowerCase().split(/\s+/).filter(w => 
            !STOP_WORDS.has(w) && 
            w.length > 2 && 
            !/^\d+(?:[.,]\d+)?$/.test(w)
        );
        
        const phraseDegree = words.length - 1;
        
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
            // Degree is the number of other words this word co-occurs with in the phrase
            // +1 for itself (standard RAKE definition usually includes itself in degree)
            wordDegree[word] = (wordDegree[word] || 0) + phraseDegree + 1;
        });
    });
    
    // 3. Calculate phrase scores
    const phraseScores: { phrase: string, score: number }[] = [];
    const seenPhrases = new Set<string>();
    
    phrases.forEach(phrase => {
        const lowerPhrase = phrase.toLowerCase();
        if (seenPhrases.has(lowerPhrase)) return;
        
        const words = lowerPhrase.split(/\s+/);
        let score = 0;
        let meaningfulWords = 0;
        
        words.forEach(word => {
            // Only score words that passed our filter in step 2
            if (wordFreq[word]) {
                score += wordDegree[word] / wordFreq[word];
                meaningfulWords++;
            }
        });
        
        // Only keep phrases that have at least one meaningful word
        // and aren't just a single stopword (though step 2 filters prevent that)
        if (meaningfulWords > 0) {
            phraseScores.push({ phrase, score });
            seenPhrases.add(lowerPhrase);
        }
    });
    
    // 4. Sort and return top keywords
    return phraseScores
        .sort((a, b) => b.score - a.score)
        .slice(0, maxKeywords)
        .map(p => p.phrase);
}
