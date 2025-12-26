export interface QuizOption {
    id: string; // 'A', 'B', 'C', 'D'
    text: string;
}

export interface QuizQuestion {
    question: string;
    options: QuizOption[];
}

export interface SearchResult {
    answer: string; // "A"
    explanation: string; // "The text states..."
    confidence: number; // 0-1
    sourceSentence?: string;
}

// Common technical and general English stopwords
const STOPWORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'and', 'or', 'but', 'not', 'that', 'this', 'it', 'which', 'who', 'what', 'where', 'when', 'how',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can',
    'could', 'may', 'might', 'must', 'about', 'from', 'as', 'into', 'like', 'through', 'after', 'over',
    'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among'
]);

/**
 * Simple English Stemmer (Porter-like heuristics for performance)
 */
function stem(word: string): string {
    let w = word.toLowerCase();

    if (w.length < 4) return w;

    // Step 1a
    if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('ies')) w = w.slice(0, -3) + 'i';
    else if (w.endsWith('ss')) w = w;
    else if (w.endsWith('s')) w = w.slice(0, -1);

    // Step 1b (simplified)
    if (w.endsWith('ing')) {
        const stem = w.slice(0, -3);
        if (stem.length > 2) w = stem;
    } else if (w.endsWith('ed')) {
        const stem = w.slice(0, -2);
        if (stem.length > 2) w = stem;
    }

    // Custom technical plural/suffix handling
    if (w.endsWith('tion')) w = w.slice(0, -4) + 't';
    if (w.endsWith('ment')) w = w.slice(0, -4);

    return w;
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // remove punctuation
        .split(/\s+/)
        .filter(w => w.length > 0 && !STOPWORDS.has(w))
        .map(stem);
}

function getNgrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Jaccard Similarity: |Intersection| / |Union|
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Levenshtein Distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    const firstRow = Array.from({ length: a.length + 1 }, (_, i) => i);
    matrix[0] = firstRow;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[b.length][a.length];
}

export class SmartSearchEngine {
    /*
     * Detects if the provided text looks like a multiple choice question.
     * Expects format: "Question? A) ... B) ... C) ... D) ..."
     */
    static detectQuizQuestion(text: string): QuizQuestion | null {
        // 1. Split into lines or segments
        // Normalize newlines
        const cleanText = text.replace(/\r\n/g, '\n');

        // Regex to find options like A), A., (A), [A]
        const optionRegex = /(?:^|\n|\s)(?:A|B|C|D|1|2|3|4)[\.\)\-\]]\s+/g;

        // Check if we have enough options
        const matches = cleanText.match(optionRegex);
        if (!matches || matches.length < 2) return null;

        // Naive split attempt - Robust implementation would be state-machine based
        // Detecting the Question part: Everything before the first option
        const firstOptionIndex = cleanText.search(optionRegex);
        if (firstOptionIndex === -1) return null;

        const questionText = cleanText.substring(0, firstOptionIndex).trim();
        if (questionText.length < 10) return null; // Too short to be a valid question?

        // Detecting Options
        // We'll split by the regex, capturing the delimiter to know which option it is
        const parts = cleanText.slice(firstOptionIndex).split(/((?:^|\n|\s)(?:A|B|C|D|1|2|3|4)[\.\)\-\]]\s+)/);

        const options: QuizOption[] = [];
        let currentId = '';

        for (let i = 1; i < parts.length; i += 2) {
            const delimiter = parts[i].trim(); // e.g. "A)"
            const content = parts[i + 1] ? parts[i + 1].trim() : '';

            // Extract ID from delimiter
            const idMatch = delimiter.match(/[A-D1-4]/);
            const rawId = idMatch ? idMatch[0] : '?';
            // Normalize 1->A, 2->B if needed, or just keep as is.
            // Assuming standard A-D for now.

            if (content.length > 0) {
                options.push({ id: rawId, text: content });
            }
        }

        if (options.length < 2) return null;

        return {
            question: questionText,
            options
        };
    }

    /**
     * Main scoring logic
     */
    static solveQuiz(quiz: QuizQuestion, pdfText: string): SearchResult {
        const isNegative = /NOT|EXCEPT|FALSE|INCORRECT/i.test(quiz.question);

        const questionTokens = tokenize(quiz.question);
        const sentences = pdfText.match(/[^.!?]+[.!?]+/g) || [pdfText];

        const optionScores = quiz.options.map(option => {
            const optionTokens = tokenize(option.text);
            let bestSentenceScore = 0;
            let bestSentence = '';

            sentences.forEach(sentence => {
                const sentenceTokens = tokenize(sentence);
                const sentenceSet = new Set(sentenceTokens);

                // 1. Keyword Overlap (Question + Option)
                // Check if sentence contains question keywords
                const qOverlap = questionTokens.filter(t => sentenceSet.has(t)).length;
                // Check if sentence contains option keywords
                const oOverlap = optionTokens.filter(t => sentenceSet.has(t)).length;

                if (qOverlap === 0 && oOverlap === 0) return;

                // 2. Proximity / Windowing (N-gram overlap)
                const sentenceBigrams = new Set(getNgrams(sentenceTokens, 2));
                const optionBigrams = new Set(getNgrams(optionTokens, 2));
                const bigramOverlap = jaccardSimilarity(optionBigrams, sentenceBigrams);

                // 3. Score Calculation
                // We weight Option Match higher than Question Match because the question sets context, 
                // but the option must receive support.
                const score = (qOverlap * 1.0) + (oOverlap * 2.5) + (bigramOverlap * 5.0);

                if (score > bestSentenceScore) {
                    bestSentenceScore = score;
                    bestSentence = sentence.trim();
                }
            });

            return {
                option,
                score: bestSentenceScore,
                supportingSentence: bestSentence
            };
        });

        // Sort by score
        optionScores.sort((a, b) => b.score - a.score);

        let bestMatch;
        let explanationPrefix = "";

        if (isNegative) {
            // For "NOT" questions, the "correct" answer is often the one represented LEAST or NOT AT ALL,
            // while others ARE represented.
            // However, usually it's "Which of these is NOT true?" -> 3 are true (high score), 1 is false (low score or contradiction).
            // Hard to detect contradiction with just simple matching. 
            // Strategy: Pick the one with the LOWEST score if others are high? 
            // OR, simply note that this is hard for deterministic only. 
            // For now, let's assume we want the one with lowest evidence?
            // Lets reverse the sort.
            optionScores.sort((a, b) => a.score - b.score);
            bestMatch = optionScores[0];
            explanationPrefix = "This option has the least support in the text (identifying Negative Logic). ";
        } else {
            bestMatch = optionScores[0];
            explanationPrefix = "Based on strict text matching. ";
        }

        const confidence = Math.min(bestMatch.score / 10, 1); // Normalize somehow

        return {
            answer: bestMatch.option.id,
            explanation: `${explanationPrefix}Found evidence: "${bestMatch.supportingSentence}"`,
            confidence: confidence,
            sourceSentence: bestMatch.supportingSentence
        };
    }
}
