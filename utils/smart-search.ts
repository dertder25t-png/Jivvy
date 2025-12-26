/**
 * Smart Search V3 - Large Document Optimized
 * "Focus and Verify" Algorithm for 100% Quiz Accuracy
 * 
 * Key improvements:
 * 1. Chunking: Split text into overlapping windows
 * 2. Hotspot Detection: Filter to top 20 relevant chunks
 * 3. Sliding Window Scoring: Deep context analysis
 * 4. Enhanced Stemming: Better word matching
 * 5. Negative Logic: NOT/EXCEPT question handling
 */

// ================================
// INTERFACES
// ================================

interface QuizQuestion {
    isQuiz: boolean;
    isNegative: boolean;
    question: string;
    options: { letter: string; text: string }[];
}

export interface SmartSearchResult {
    answer: string;           // "A"
    confidence: number;       // 0.0 to 1.0
    evidence: string;         // Specific sentence/paragraph
    explanation: string;      // "I chose A because..."
    method: 'quiz' | 'direct' | 'ai';
}

interface OptionScore {
    letter: string;
    text: string;
    totalScore: number;
    evidence: string;
    breakdown: string[];
}

interface Chunk {
    text: string;
    keywordDensity: number;
}

// ================================
// CONSTANTS
// ================================

const SCORING = {
    QUESTION_KEYWORD: 10,
    OPTION_KEYWORD: 15,
    BOTH_SAME_SENTENCE: 50,
    EXACT_PHRASE_MATCH: 100,
    HIGH_COVERAGE_BONUS: 30,
    PERFECT_COVERAGE_BONUS: 50
};

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const TOP_HOTSPOTS = 20;

// ================================
// STOP WORDS
// ================================

const STOP_WORDS = new Set([
    'the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at',
    'by', 'for', 'with', 'about', 'as', 'into', 'like', 'through', 'after',
    'over', 'between', 'out', 'against', 'during', 'without', 'before',
    'under', 'around', 'among', 'a', 'an', 'that', 'this', 'it', 'which',
    'who', 'what', 'where', 'when', 'why', 'how', 'all', 'any', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
    'will', 'just', 'should', 'now', 'question', 'answer', 'following',
    'true', 'false', 'select', 'choose', 'best', 'option', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'would', 'could', 'might', 'must', 'shall', 'may', 'these', 'those',
    'am', 'if', 'or', 'because', 'until', 'while', 'from', 'up', 'down'
]);

const NEGATIVE_KEYWORDS = ['NOT', 'EXCEPT', 'FALSE', 'INCORRECT', 'LEAST LIKELY', 'UNTRUE', 'WRONG'];

// Antonym pairs for semantic contrast detection
// If question contains key, finding the value near an option means that option
// is explicitly contrasted with the question's concept
const CONTRAST_ANTONYMS: Record<string, string[]> = {
    'primary': ['secondary', 'tertiary'],
    'true': ['false', 'untrue', 'incorrect'],
    'correct': ['incorrect', 'wrong', 'false'],
    'first': ['second', 'third', 'last'],
    'always': ['never', 'sometimes', 'rarely'],
    'all': ['none', 'some', 'few'],
    'major': ['minor'],
    'positive': ['negative'],
    'increase': ['decrease', 'reduce'],
    'advantage': ['disadvantage'],
    'benefit': ['drawback', 'harm'],
    'include': ['exclude'],
    'maximum': ['minimum'],
    'best': ['worst'],
    'most': ['least']
};

// ================================
// MAIN CLASS
// ================================

export class SmartSearchEngine {

    // ================================
    // PUBLIC API
    // ================================

    /**
     * Main search entry point
     */
    public static async search(question: string, pdfText: string): Promise<SmartSearchResult> {
        // 1. Detect if it's a quiz question
        const quiz = this.detectQuizQuestion(question);

        if (quiz.isQuiz) {
            return this.solveQuiz(quiz, pdfText);
        }

        // 2. Direct answer fallback
        return this.findDirectAnswer(question, pdfText);
    }

    /**
     * Extract keywords for page-level search
     */
    public static extractKeywords(text: string): string[] {
        // Technical terms (hyphenated)
        const hyphenated = text.match(/\b\w+-\w+(?:-\w+)*\b/g) || [];

        // Numbers with context
        const numbers = text.match(/\d+(?:[:.]\d+)?(?:\s*[%°]|\s*to\s*\d+)?/g) || [];

        // Significant words (stemmed, no stop words)
        const tokens = this.tokenize(text);
        const words = Array.from(tokens).filter(t => t.length >= 4);

        // Combine and dedup
        const all = new Set([...hyphenated, ...numbers, ...words]);
        return Array.from(all).slice(0, 15);
    }

    /**
     * Detect quiz question with robust option parsing
     * Supports: A), A., (A), [A], or just A followed by text
     * Handles 2-5 options (A-E)
     */
    public static detectQuizQuestion(input: string): QuizQuestion {
        // A) Detect Negative Logic
        const questionBody = this.extractQuestionBody(input);
        const isNegative = this.detectNegative(questionBody);

        // B) Parse options with multiple strategies
        const options = this.parseOptions(input);

        // C) Extract question text
        let questionText = input.trim();
        if (options.length > 0) {
            questionText = this.extractQuestionText(input, options[0].letter);
        }

        return {
            isQuiz: options.length >= 2,
            isNegative,
            question: questionText,
            options
        };
    }

    /**
     * Solve a quiz question using Focus and Verify algorithm
     */
    public static solveQuiz(quiz: QuizQuestion, context: string): SmartSearchResult {
        const qTokens = this.tokenize(quiz.question);

        // === PHASE 1: CHUNK THE TEXT ===
        const chunks = this.chunkText(context, CHUNK_SIZE, CHUNK_OVERLAP);

        // === PHASE 2: FIND HOTSPOTS ===
        const hotspots = this.findHotspots(chunks, qTokens, TOP_HOTSPOTS);

        // Combine hotspots for deep analysis
        const focusedText = hotspots.join('\n\n');
        const sentences = this.splitIntoSentences(focusedText);

        // === PHASE 3: SCORE EACH OPTION ===
        const optionScores: OptionScore[] = quiz.options.map(opt =>
            this.scoreOption(opt, qTokens, sentences, quiz.isNegative, quiz.question)
        );

        // === PHASE 4: DECISION LOGIC ===
        let winner: OptionScore;
        let confidence = 0.5;
        let explanation = '';

        if (quiz.isNegative) {
            // First check for contrast match (score -1 indicates definitive contrast evidence)
            const contrastMatch = optionScores.find(o => o.totalScore === -1);

            if (contrastMatch) {
                // We found explicit contrast evidence (e.g., "Green is secondary" for "NOT primary")
                winner = contrastMatch;
                confidence = 0.98;
                explanation = `This is a negative question. ${contrastMatch.letter} is explicitly contrasted in the text: "${contrastMatch.evidence.substring(0, 100)}..."`;
            } else {
                // Fall back to logic inversion
                // Sort by score descending (ignoring -1 which shouldn't exist here)
                optionScores.sort((a, b) => b.totalScore - a.totalScore);

                const worst = optionScores[optionScores.length - 1];
                const best = optionScores[0];

                const highScoreCount = optionScores.filter(o => o.totalScore > 30).length;

                if (highScoreCount >= 2 && worst.totalScore < 15) {
                    winner = worst;
                    confidence = 0.95;
                    explanation = `This is a negative question (NOT/EXCEPT). ${worst.letter} has the least textual support while others are well-supported.`;
                } else if (worst.totalScore < best.totalScore * 0.3) {
                    winner = worst;
                    confidence = 0.75;
                    explanation = `This is a negative question. ${worst.letter} has significantly less textual support.`;
                } else {
                    winner = worst;
                    confidence = 0.6;
                    explanation = `Negative question inversion applied. ${worst.letter} had lowest match.`;
                }
            }
        } else {
            // Normal Logic: Sort by score descending and pick highest
            optionScores.sort((a, b) => b.totalScore - a.totalScore);
            winner = optionScores[0];
            const second = optionScores[1];

            if (winner.totalScore > 0) {
                if (!second || winner.totalScore > second.totalScore * 2) {
                    confidence = 0.95;
                    explanation = `${winner.letter} is clearly the best match with strong textual evidence.`;
                } else if (winner.totalScore > second.totalScore * 1.5) {
                    confidence = 0.85;
                    explanation = `${winner.letter} has significantly more support than other options.`;
                } else if (winner.totalScore > second.totalScore * 1.1) {
                    confidence = 0.70;
                    explanation = `${winner.letter} has slightly more textual support.`;
                } else {
                    confidence = 0.55;
                    explanation = `${winner.letter} marginally matches better, but evidence is weak.`;
                }
            } else {
                explanation = `No strong evidence found. ${winner.letter} selected as best guess.`;
            }
        }

        // Build evidence string
        const evidenceStr = winner.evidence || 'No direct textual evidence found.';

        return {
            answer: winner.letter,
            confidence: confidence,
            evidence: evidenceStr,
            explanation: explanation,
            method: 'quiz'
        };
    }

    // ================================
    // TEXT CHUNKING
    // ================================

    /**
     * Split text into overlapping chunks for better context preservation
     */
    private static chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
        const chunks: string[] = [];

        if (text.length <= chunkSize) {
            return [text];
        }

        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.slice(start, end));
            start += chunkSize - overlap;
        }

        return chunks;
    }

    /**
     * Find hotspots - chunks with highest keyword density
     */
    private static findHotspots(chunks: string[], questionTokens: Set<string>, topK: number = 20): string[] {
        if (chunks.length <= topK) {
            return chunks;
        }

        // Score each chunk by keyword density
        const scoredChunks: Chunk[] = chunks.map(chunk => {
            const chunkTokens = this.tokenize(chunk);
            const overlap = this.calculateOverlap(questionTokens, chunkTokens);
            return {
                text: chunk,
                keywordDensity: overlap.count / Math.max(chunkTokens.size, 1)
            };
        });

        // Sort by density descending
        scoredChunks.sort((a, b) => b.keywordDensity - a.keywordDensity);

        // Return top K
        return scoredChunks.slice(0, topK).map(c => c.text);
    }

    /**
     * Score an option using sliding window analysis
     */
    private static scoreOption(
        option: { letter: string; text: string },
        qTokens: Set<string>,
        sentences: string[],
        isNegative: boolean,
        questionText: string = ''
    ): OptionScore {
        const optTokens = this.tokenize(option.text);

        let bestSentenceScore = 0;
        let bestSentence = '';
        let hasContrastEvidence = false;
        let contrastSentence = '';
        const breakdown: string[] = [];

        // For negative questions, look for contrast antonyms in the question
        const questionLower = questionText.toLowerCase();
        const contrastTerms: string[] = [];
        for (const [key, antonyms] of Object.entries(CONTRAST_ANTONYMS)) {
            if (questionLower.includes(key)) {
                contrastTerms.push(...antonyms);
            }
        }

        // Sliding window: prev + current + next sentence
        for (let i = 0; i < sentences.length; i++) {
            // Build context window
            const prevSent = i > 0 ? sentences[i - 1] : '';
            const currSent = sentences[i];
            const nextSent = i < sentences.length - 1 ? sentences[i + 1] : '';

            const windowText = [prevSent, currSent, nextSent].join(' ');
            const windowTokens = this.tokenize(windowText);
            const currTokens = this.tokenize(currSent);
            const currLower = currSent.toLowerCase();

            // Calculate overlaps
            const qOverlap = this.calculateOverlap(qTokens, windowTokens);
            const oOverlap = this.calculateOverlap(optTokens, windowTokens);

            // Check for contrast evidence: option appears with a contrast antonym
            // The option should appear BEFORE the contrast word (pattern: "Green is a secondary")
            if (isNegative && contrastTerms.length > 0) {
                const optLower = option.text.toLowerCase();
                const optIndex = currLower.indexOf(optLower);

                if (optIndex !== -1) {
                    // Check if any contrast term appears AFTER the option
                    for (const term of contrastTerms) {
                        const contrastIndex = currLower.indexOf(term);
                        if (contrastIndex !== -1 && contrastIndex > optIndex) {
                            // Option appears before contrast term - this is the pattern we want
                            // e.g., "Green is a secondary color" - Green before secondary
                            hasContrastEvidence = true;
                            contrastSentence = currSent;
                            break;
                        }
                    }
                }
            }


            if (qOverlap.count > 0 || oOverlap.count > 0) {
                let score = 0;

                // Base scoring
                score += qOverlap.count * SCORING.QUESTION_KEYWORD;
                score += oOverlap.count * SCORING.OPTION_KEYWORD;

                // Bonus: Both question and option keywords in same sentence
                const currQOverlap = this.calculateOverlap(qTokens, currTokens);
                const currOOverlap = this.calculateOverlap(optTokens, currTokens);

                if (currQOverlap.count > 0 && currOOverlap.count > 0) {
                    score += SCORING.BOTH_SAME_SENTENCE;
                }

                // Bonus: Exact phrase match
                if (this.containsExactPhrase(currSent, option.text)) {
                    score += SCORING.EXACT_PHRASE_MATCH;
                }

                // Bonus: High option coverage
                if (optTokens.size > 0) {
                    const coverage = oOverlap.count / optTokens.size;
                    if (coverage > 0.8) score += SCORING.HIGH_COVERAGE_BONUS;
                    if (coverage === 1.0) score += SCORING.PERFECT_COVERAGE_BONUS;
                }

                if (score > bestSentenceScore) {
                    bestSentenceScore = score;
                    bestSentence = currSent;
                }
            }
        }

        // For negative questions, if we have contrast evidence, this is the definitive answer
        // Give it a special marker score of -1 to indicate "contrast match" for the solver
        const finalScore = hasContrastEvidence ? -1 : bestSentenceScore;
        const finalEvidence = hasContrastEvidence ? contrastSentence : bestSentence;

        return {
            letter: option.letter,
            text: option.text,
            totalScore: finalScore,
            evidence: finalEvidence,
            breakdown
        };
    }


    /**
     * Check for exact phrase match (case insensitive)
     */
    private static containsExactPhrase(text: string, phrase: string): boolean {
        const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const normalizedPhrase = phrase.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        return normalizedText.includes(normalizedPhrase);
    }

    // ================================
    // OPTION PARSING
    // ================================

    /**
     * Extract the question body (before options) for negative detection
     */
    private static extractQuestionBody(input: string): string {
        // Try to find where options start
        const patterns = [
            /(?:^|\n)\s*[A-Ea-e][\.\)\]]/,
            /\s{2,}[A-Ea-e][\.\)\]]/
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match.index !== undefined) {
                return input.slice(0, match.index).toUpperCase();
            }
        }

        return input.toUpperCase();
    }

    /**
     * Detect negative question keywords
     */
    private static detectNegative(questionBody: string): boolean {
        return NEGATIVE_KEYWORDS.some(kw =>
            new RegExp(`\\b${kw}\\b`, 'i').test(questionBody)
        );
    }

    /**
     * Parse options with multiple format support
     */
    private static parseOptions(input: string): { letter: string; text: string }[] {
        const options: { letter: string; text: string }[] = [];

        // Normalize: add newlines before potential options stuck together
        let normalized = input.replace(/([^a-zA-Z])([A-Ea-e])[\.\)\]]/g, '$1\n$2)');

        // Strategy 1: Standard patterns like "A)", "A.", "(A)", "[A]"
        // Using 'g' flag only (no 's' for ES5 compat) - since we normalized newlines
        const patterns = [
            // A) text or A. text - match until next option or end
            /(?:^|\n|\s{2,})([A-Ea-e])[.\)]\s*([^\n]+?)(?=(?:\n|\s{2,})[A-Ea-e][.\)]|$)/g,
            // (A) text or [A] text
            /(?:^|\n|\s{2,})[\(\[]([A-Ea-e])[\)\]]\s*([^\n]+?)(?=(?:\n|\s{2,})[\(\[][A-Ea-e][\)\]]|$)/g
        ];

        for (const regex of patterns) {
            let match;
            while ((match = regex.exec(normalized)) !== null) {
                const letter = match[1].toUpperCase();
                const text = match[2].trim().replace(/\s+/g, ' ');

                if (text.length > 0 && !options.find(o => o.letter === letter)) {
                    options.push({ letter, text });
                }
            }
        }

        // Sort by letter
        options.sort((a, b) => a.letter.localeCompare(b.letter));

        return options;
    }

    /**
     * Extract question text before options
     */
    private static extractQuestionText(input: string, firstLetter: string): string {
        const patterns = [
            new RegExp(`(?:^|\\n|\\s{2,})${firstLetter}[\\.\\)\\]]`, 'i'),
            new RegExp(`[\\(\\[]${firstLetter}[\\)\\]]`, 'i')
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match.index !== undefined) {
                return input.slice(0, match.index).trim();
            }
        }

        return input.trim();
    }

    // ================================
    // DIRECT ANSWER FALLBACK
    // ================================

    private static findDirectAnswer(question: string, text: string): SmartSearchResult {
        // Simple fallback - no quiz detected
        return {
            answer: '',
            confidence: 0,
            evidence: '',
            explanation: 'No quiz question detected.',
            method: 'direct'
        };
    }

    // ================================
    // TOKENIZERS & HELPERS
    // ================================

    /**
     * Tokenize text with stemming and stop word removal
     */
    private static tokenize(text: string): Set<string> {
        let clean = text.toLowerCase();
        clean = clean.replace(/[^a-z0-9\s-]/g, '');
        const tokens = clean.split(/\s+/);

        const validTokens = new Set<string>();
        for (const t of tokens) {
            if (this.isStopWord(t)) continue;
            const stem = this.stem(t);
            if (stem.length > 2) validTokens.add(stem);
        }
        return validTokens;
    }

    /**
     * Enhanced Porter-like stemmer
     */
    private static stem(word: string): string {
        if (word.length < 4) return word;

        // Order matters - check longer suffixes first
        const suffixes = [
            { suffix: 'ization', replace: 'ize' },
            { suffix: 'ational', replace: 'ate' },
            { suffix: 'fulness', replace: 'ful' },
            { suffix: 'iveness', replace: 'ive' },
            { suffix: 'ousness', replace: 'ous' },
            { suffix: 'ement', replace: '' },
            { suffix: 'ment', replace: '' },
            { suffix: 'tion', replace: '' },
            { suffix: 'sion', replace: '' },
            { suffix: 'able', replace: '' },
            { suffix: 'ible', replace: '' },
            { suffix: 'ness', replace: '' },
            { suffix: 'ance', replace: '' },
            { suffix: 'ence', replace: '' },
            { suffix: 'ing', replace: '' },
            { suffix: 'ies', replace: 'y' },
            { suffix: 'ied', replace: 'y' },
            { suffix: 'es', replace: '' },
            { suffix: 'ed', replace: '' },
            { suffix: 'ly', replace: '' },
            { suffix: 'er', replace: '' },
            { suffix: 's', replace: '' }
        ];

        for (const { suffix, replace } of suffixes) {
            if (word.endsWith(suffix) && word.length > suffix.length + 2) {
                const stem = word.slice(0, -suffix.length) + replace;
                // Avoid too short stems
                if (stem.length >= 3) return stem;
            }
        }

        return word;
    }

    /**
     * Check if word is a stop word
     */
    private static isStopWord(word: string): boolean {
        return STOP_WORDS.has(word);
    }

    /**
     * Calculate overlap between two token sets
     */
    private static calculateOverlap(setA: Set<string>, setB: Set<string>): { count: number; tokens: string[] } {
        let count = 0;
        const tokens: string[] = [];
        const aArray = Array.from(setA);
        for (let i = 0; i < aArray.length; i++) {
            const elem = aArray[i];
            if (setB.has(elem)) {
                count++;
                tokens.push(elem);
            }
        }
        return { count, tokens };
    }

    /**
     * Split text into sentences
     */
    private static splitIntoSentences(text: string): string[] {
        // Split by sentence-ending punctuation followed by space or newline
        // Use replace + split pattern for ES5/ES2015 compatibility
        const normalized = text.replace(/([.!?])\s+/g, '$1|||');
        return normalized
            .split('|||')
            .filter(s => s.trim().length > 10);
    }
}
