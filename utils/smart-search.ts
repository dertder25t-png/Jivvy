/**
 * Smart Search Client
 * "The Coordinator"
 * Sends questions to the Worker -> Gets Results -> Formats Answer
 * 
 * This module provides:
 * - Quiz question detection
 * - Worker-based search coordination
 * - Negative logic handling (NOT/EXCEPT questions)
 * - Option scoring against retrieved context
 */

// Types for the search system
export interface QuizOption {
    letter: string;  // 'A', 'B', 'C', 'D'
    text: string;
}

export interface DetectedQuiz {
    isQuiz: boolean;
    question: string;
    options: QuizOption[];
    isNegative: boolean;
}

export interface SmartSearchResult {
    answer: string;
    explanation: string;
    confidence: number;
    evidence: string;
}

export interface WorkerSearchResult {
    page: number;
    score: number;
    matchType: 'exact' | 'phrase' | 'fuzzy';
    excerpt: string;
}

/**
 * SmartSearchEngine - Worker-based search coordinator
 */
export class SmartSearchEngine {
    private worker: Worker | null = null;

    constructor(worker?: Worker) {
        this.worker = worker || null;
    }

    /**
     * Set the worker instance
     */
    public setWorker(worker: Worker): void {
        this.worker = worker;
    }

    // ==========================================
    // QUIZ DETECTION (Static - No worker needed)
    // ==========================================

    /**
     * Detect if text is a multiple-choice question
     * Handles formats: A), A., (A), [A], a), 1), etc.
     */
    static detectQuizQuestion(text: string): DetectedQuiz {
        const cleanText = text.replace(/\r\n/g, '\n').trim();

        // Detect negative logic keywords
        const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(cleanText);

        // Option pattern: A), A., (A), [A], a), 1), etc.
        const optionRegex = /(?:^|\n|\s)(?:\(?|\[?)([A-Da-d1-4])(?:\)|\.|]|-)\s+/g;

        // Use exec loop instead of matchAll for broader compatibility
        const matches: { match: RegExpExecArray; index: number }[] = [];
        let match;
        while ((match = optionRegex.exec(cleanText)) !== null) {
            matches.push({ match, index: match.index });
        }

        if (matches.length < 2) {
            return { isQuiz: false, question: '', options: [], isNegative: false };
        }

        // Extract question (everything before first option)
        const firstMatchIndex = matches[0].index;
        const question = cleanText.substring(0, firstMatchIndex).trim();

        if (question.length < 10) {
            return { isQuiz: false, question: '', options: [], isNegative: false };
        }

        // Extract options
        const options: QuizOption[] = [];
        for (let i = 0; i < matches.length; i++) {
            const { match, index } = matches[i];
            const letter = match[1].toUpperCase();

            // Normalize numeric to letter
            const normalizedLetter = letter.match(/[1-4]/)
                ? String.fromCharCode(64 + parseInt(letter)) // 1->A, 2->B
                : letter;

            // Get text between this match and next (or end)
            const startIdx = index + match[0].length;
            const endIdx = matches[i + 1]?.index || cleanText.length;
            const optText = cleanText.substring(startIdx, endIdx).trim();

            if (optText.length > 0) {
                options.push({ letter: normalizedLetter, text: optText });
            }
        }

        return {
            isQuiz: options.length >= 2,
            question,
            options,
            isNegative
        };
    }

    // ==========================================
    // SEARCH METHODS
    // ==========================================

    /**
     * Main search entry point
     * Queries worker for relevant context, then scores options
     */
    public async search(question: string, options: string[]): Promise<SmartSearchResult> {
        // 1. Detect negative logic
        const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(question);

        // 2. Get relevant context from worker (fast, deterministic)
        const relevantContext = await this.queryWorker(question, isNegative);

        // 3. Score options against the context
        return this.solveLogic(question, options, relevantContext, isNegative);
    }

    /**
     * Solve a detected quiz question using PDF context
     */
    static solveQuiz(quiz: DetectedQuiz, pdfText: string): SmartSearchResult {
        // Split PDF into sentences for matching
        const sentences = pdfText.match(/[^.!?]+[.!?]+/g) || [pdfText];

        // Tokenize question for matching
        const qTokens = quiz.question.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2);

        // Score each option
        const optionScores = quiz.options.map(opt => {
            const optTokens = opt.text.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2);

            let bestScore = 0;
            let bestSentence = '';

            sentences.forEach(sentence => {
                const sentLower = sentence.toLowerCase();
                const sentTokens = new Set(
                    sentLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/)
                );

                // Count overlaps
                const qOverlap = qTokens.filter(t => sentTokens.has(t)).length;
                const oOverlap = optTokens.filter(t => sentTokens.has(t)).length;

                if (qOverlap === 0 && oOverlap === 0) return;

                // Weight option matches higher (they confirm the answer)
                const score = (qOverlap * 1.0) + (oOverlap * 2.5);

                if (score > bestScore) {
                    bestScore = score;
                    bestSentence = sentence.trim();
                }
            });

            return { option: opt, score: bestScore, sentence: bestSentence };
        });

        // Sort by score
        optionScores.sort((a, b) => b.score - a.score);

        let winner;
        let explanation;

        if (quiz.isNegative) {
            // For NOT questions, find option with LEAST evidence
            optionScores.sort((a, b) => a.score - b.score);
            winner = optionScores[0];
            explanation = `Negative question: "${winner.option.text}" has the least textual evidence.`;
        } else {
            winner = optionScores[0];
            explanation = `Found matching evidence for "${winner.option.text}"`;
        }

        const confidence = Math.min(winner.score / 10, 1);

        return {
            answer: winner.option.letter,
            explanation,
            confidence,
            evidence: winner.sentence.substring(0, 200)
        };
    }

    // ==========================================
    // WORKER COMMUNICATION
    // ==========================================

    /**
     * Query the worker for relevant pages
     * Returns search results from the inverted index
     */
    private queryWorker(query: string, isNegative: boolean): Promise<WorkerSearchResult[]> {
        return new Promise((resolve) => {
            if (!this.worker) {
                console.warn('[SmartSearch] No worker attached, returning empty results');
                resolve([]);
                return;
            }

            const id = Math.random().toString(36).substring(2);

            const handler = (e: MessageEvent) => {
                if (e.data.id === id && e.data.type === 'SEARCH_RESULT') {
                    this.worker!.removeEventListener('message', handler);
                    resolve(e.data.payload || []);
                }
            };

            this.worker.addEventListener('message', handler);
            this.worker.postMessage({
                type: 'SEARCH',
                id,
                payload: { query, isNegative }
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                this.worker?.removeEventListener('message', handler);
                resolve([]);
            }, 5000);
        });
    }

    /**
     * Score options against retrieved context
     * Fast client-side logic - no network calls
     */
    private solveLogic(
        question: string,
        options: string[],
        context: WorkerSearchResult[],
        isNegative: boolean
    ): SmartSearchResult {
        if (!context || context.length === 0) {
            return {
                answer: '',
                explanation: 'No relevant context found in document',
                confidence: 0,
                evidence: ''
            };
        }

        // Combine excerpts for matching
        const fullText = context.map(c => c.excerpt).join(' ');

        // Score each option by keyword frequency in context
        const scores = options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...

            // Extract meaningful keywords (>3 chars)
            const keywords = opt.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3);

            let score = 0;
            keywords.forEach(k => {
                if (fullText.toLowerCase().includes(k)) score++;
            });

            return { letter, text: opt, score };
        });

        // Decision
        let winner;
        let explanation;

        if (isNegative) {
            // For NOT/EXCEPT: pick option with LEAST evidence
            scores.sort((a, b) => a.score - b.score);
            winner = scores[0];
            explanation = `Negative question detected. "${winner.text}" has the least evidence in the retrieved text.`;
        } else {
            // Standard: pick option with MOST evidence
            scores.sort((a, b) => b.score - a.score);
            winner = scores[0];
            explanation = `Found strong evidence linking "${winner.text}" to the query topics.`;
        }

        return {
            answer: winner.letter,
            explanation,
            confidence: winner.score > 0 ? 0.9 : 0.4,
            evidence: context[0]?.excerpt || ''
        };
    }
}

// Default singleton for convenience
export const smartSearch = new SmartSearchEngine();