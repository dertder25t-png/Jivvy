/**
 * Smart Search V2 - Deterministic Logic
 * 100% accuracy target for multiple choice questions
 * Uses strict string token matching and logic inversion
 */

interface QuizQuestion {
    isQuiz: boolean;
    isNegative: boolean;
    question: string;
    options: { letter: string; text: string }[];
}

interface SmartSearchResult {
    answer: string;
    confidence: number;
    evidence: string;
    method: 'quiz' | 'direct';
}

interface OptionScore {
    letter: string;
    text: string;
    totalScore: number;
    evidence: string;
    breakdown: string[];
}

export class SmartSearchEngine {

    // ===============================
    // PUBLIC API
    // ===============================

    public static async search(question: string, pdfText: string): Promise<SmartSearchResult> {
        // 1. Detect if it's a quiz
        const quiz = this.detectQuizQuestion(question);

        if (quiz.isQuiz) {
            return this.solveQuiz(quiz, pdfText);
        }

        // 2. Direct answer fallback
        return this.findDirectAnswer(question, pdfText);
    }

    public static extractKeywords(text: string): string[] {
        // Extract significant terms for search
        // 1. Technical terms (hyphenated)
        const hyphenated = text.match(/\b\w+-\w+(?:-\w+)*\b/g) || [];

        // 2. Numbers with context
        const numbers = text.match(/\d+(?:[:.]\d+)?(?:\s*[%°]|\s*to\s*\d+)?/g) || [];

        // 3. Significant words
        const tokens = this.tokenize(text);
        const words = Array.from(tokens).filter(t => t.length >= 4);

        // Combine and dedup
        const all = new Set([...hyphenated, ...numbers, ...words]);
        return Array.from(all).slice(0, 15);
    }

    public static detectQuizQuestion(input: string): QuizQuestion {
        // A) Detect Negative Logic
        const negativeKeywords = ['NOT', 'EXCEPT', 'FALSE', 'INCORRECT'];
        // Check if any negative keyword appears in uppercase or clearly in the question sentence
        // We look at the first part before options
        const questionBody = input.split(/\n[A-Za-z][\.\)]/)[0].toUpperCase();
        const isNegative = negativeKeywords.some(kw =>
            new RegExp(`\\b${kw}\\b`).test(questionBody)
        );

        // B) flexible option parsing
        const options: { letter: string; text: string }[] = [];

        // Regex to find options like "A)", "a.", "[A]", "(a)" 
        // We look for the pattern at start of line or preceded by spaces
        const optionRegex = /(?:^|\s+)([A-Ea-e])[\.\)\]](?:\s+)(.*?)(?=(?:\s+[A-Ea-e][\.\)\]])|$)/gs;

        // Clean input to help regex: ensure newlines before potential options if they are stuck together
        // e.g. "Question? A) opt1 B) opt2" -> "Question? \n A) opt1 \n B) opt2"
        let cleanInput = input.replace(/([a-eA-E][\.\)\]])/g, '\n$1');

        // Extract options
        const optionMatches = Array.from(cleanInput.matchAll(optionRegex));

        for (const m of optionMatches) {
            const letter = m[1].toUpperCase();
            const text = m[2].trim().replace(/\s+/g, ' '); // normalize spaces
            // Avoid duplicates
            if (!options.find(o => o.letter === letter)) {
                options.push({ letter, text });
            }
        }

        // If we found options, extract the question text (everything before the first option)
        let questionText = input.trim();
        if (options.length > 0) {
            // Find where the first option starts in the *original* input to capture the full question
            // We use the first detected letter and its index from the regex match conceptually
            // But since we modified cleanInput, let's just use a split approach on the first option pattern found.
            const firstLetter = options[0].letter;
            const splitRegex = new RegExp(`(?:^|\\s+)${firstLetter}[\\.\\)\\]]`, 'i');
            const parts = input.split(splitRegex);
            if (parts.length > 1) {
                questionText = parts[0].trim();
            }
        }

        return {
            isQuiz: options.length >= 2,
            isNegative,
            question: questionText,
            options
        };
    }

    public static solveQuiz(quiz: QuizQuestion, context: string): SmartSearchResult {
        const sentences = this.splitIntoSentences(context);
        const qTokens = this.tokenize(quiz.question);

        const optionScores: OptionScore[] = quiz.options.map(opt =>
            this.scoreOption(opt, qTokens, sentences, quiz.isNegative)
        );

        // Sort by score descending
        optionScores.sort((a, b) => b.totalScore - a.totalScore);

        // Decision logic
        let winner: OptionScore;
        let confidence = 0.5;

        // Debug log
        // console.log('Scores:', optionScores.map(o => `${o.letter}: ${o.totalScore}`));

        if (quiz.isNegative) {
            // Logic Inversion: 
            // We expect strict evidence for the TRUE statements (incorrect answers).
            // The Correct Answer (FALSE statement) should have low evidence.

            const worst = optionScores[optionScores.length - 1]; // Lowest score
            const best = optionScores[0]; // Highest score (proven true)

            // If the "best" (proven true) has a high score, and the "worst" has very low, 
            // then "worst" is likely the answer (because it's NOT true).
            if (best.totalScore > 30 && worst.totalScore < 15) {
                winner = worst; // The anomaly
                confidence = 0.95;
            } else {
                // Fallback: strict inverse
                winner = worst;
                confidence = 0.6;
            }

            winner.evidence = `(NEGATIVE QUESTION) Selected least matched option.\nEvidence for others:\n${best.letter}: ${best.evidence}`;

        } else {
            // Normal Logic: Pick the highest score
            winner = optionScores[0];
            const second = optionScores[1];

            if (winner.totalScore > 0) {
                if (!second || winner.totalScore > second.totalScore * 2) confidence = 0.95;
                else if (winner.totalScore > second.totalScore * 1.5) confidence = 0.85;
                else if (winner.totalScore > second.totalScore * 1.1) confidence = 0.70;
            }
        }

        return {
            answer: winner.letter,
            confidence: confidence,
            evidence: winner.evidence || 'No direct evidence found.',
            method: 'quiz'
        };
    }

    // ===============================
    // INTERNAL SCORING LOGIC
    // ===============================

    private static scoreOption(
        option: { letter: string; text: string },
        qTokens: Set<string>,
        sentences: string[],
        isNegative: boolean
    ): OptionScore {
        const optTokens = this.tokenize(option.text);

        let bestSentenceScore = 0;
        let bestSentence = '';
        let breakdown: string[] = [];

        // We score each sentence against (Question + Option)
        // The goal is to find the sentence that Best links the Question to the Option.

        for (const sent of sentences) {
            const sentTokens = this.tokenize(sent);

            // 1. Question Overlap (How relevant is this sentence to the topic?)
            const qOverlap = this.calculateOverlap(qTokens, sentTokens);

            // 2. Option Overlap (Does this sentence contain the answer choice?)
            const oOverlap = this.calculateOverlap(optTokens, sentTokens);

            // 3. Proximity / Co-occurrence
            // We need BOTH question context AND option text to assume it's the right answer source
            // OR if the option is long, maybe just the option text is unique enough

            if (qOverlap.count > 0 || oOverlap.count > 0) {
                let score = 0;

                // Base score: Sum of matched tokens
                // Weight option matches higher because they distinguish the answer
                score += (qOverlap.count * 10) + (oOverlap.count * 20);

                // Bonus: High percentage of option words matched (Exact phrase proxy)
                if (optTokens.size > 0) {
                    const optCoverage = oOverlap.count / optTokens.size;
                    if (optCoverage > 0.8) score += 30;
                    if (optCoverage === 1.0) score += 50; // Perfect match
                }

                // Exclude matches that are just 1 word if it's a common word, but we filtered stop words

                if (score > bestSentenceScore) {
                    bestSentenceScore = score;
                    bestSentence = sent;
                }
            }
        }

        return {
            letter: option.letter,
            text: option.text,
            totalScore: bestSentenceScore,
            evidence: bestSentence,
            breakdown
        };
    }

    private static findDirectAnswer(question: string, text: string): SmartSearchResult {
        // Simple shim for direct answers
        return {
            answer: '',
            confidence: 0,
            evidence: '',
            method: 'direct'
        };
    }

    // ===============================
    // TOKENIZERS & HELPERS
    // ===============================

    private static tokenize(text: string): Set<string> {
        // 1. Lowercase
        let clean = text.toLowerCase();
        // 2. Remove punctuation
        clean = clean.replace(/[^a-z0-9\s-]/g, '');
        // 3. Split
        const tokens = clean.split(/\s+/);

        const validTokens = new Set<string>();
        for (const t of tokens) {
            if (this.isStopWord(t)) continue;
            // 4. Simple Stemming (Suffix stripping)
            const stem = this.simpleStem(t);
            if (stem.length > 2) validTokens.add(stem);
        }
        return validTokens;
    }

    private static simpleStem(word: string): string {
        // Very basic porter-like steps for English
        if (word.endsWith('ing')) return word.slice(0, -3);
        if (word.endsWith('ly')) return word.slice(0, -2);
        if (word.endsWith('es')) return word.slice(0, -2);
        if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
        if (word.endsWith('ed')) return word.slice(0, -2);
        return word;
    }

    private static isStopWord(word: string): boolean {
        const stops = new Set([
            'the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at',
            'by', 'for', 'with', 'about', 'as', 'into', 'like', 'through', 'after',
            'over', 'between', 'out', 'against', 'during', 'without', 'before',
            'under', 'around', 'among', 'a', 'an', 'that', 'this', 'it', 'which',
            'who', 'what', 'where', 'when', 'why', 'how', 'all', 'any', 'both',
            'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
            'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
            'will', 'just', 'should', 'now', 'question', 'answer', 'following',
            'true', 'false', 'select', 'choose', 'best', 'option'
        ]);
        return stops.has(word);
    }

    private static calculateOverlap(setA: Set<string>, setB: Set<string>): { count: number, tokens: string[] } {
        let count = 0;
        const tokens: string[] = [];
        for (const elem of setA) {
            if (setB.has(elem)) {
                count++;
                tokens.push(elem);
            }
        }
        return { count, tokens };
    }

    private static splitIntoSentences(text: string): string[] {
        // Split by punctuation followed by space or end of line
        return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    }
}
