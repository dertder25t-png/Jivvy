/**
 * Smart Search V4 - Page-Targeted Search Engine
 * 
 * Key Features:
 * 1. PAGE TARGETING: Extracts [Page X] markers and prioritizes relevant pages
 * 2. SYNONYM MATCHING: Technical term synonyms for paraphrased questions  
 * 3. GLOSSARY DETECTION: Uses index/glossary pages to find content locations
 * 4. CONFIDENCE-DRIVEN RETRY: Keeps searching until 80%+ confidence
 * 5. FUZZY MATCHING: Handles questions that don't match exact phrasing
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
    answer: string;
    confidence: number;
    evidence: string;
    explanation: string;
    method: 'quiz' | 'direct' | 'ai';
    pageNumber?: number;
}

interface PageContent {
    pageNum: number;
    text: string;
    relevanceScore: number;
}

interface OptionScore {
    letter: string;
    text: string;
    totalScore: number;
    evidence: string;
    pageNum?: number;
    breakdown: string[];
}

// ================================
// CONSTANTS
// ================================

const MIN_CONFIDENCE = 0.80;
const TARGET_CONFIDENCE = 0.90;

// Scoring weights
const SCORING = {
    EXACT_PHRASE: 200,          // Exact phrase match - definitive
    SYNONYM_MATCH: 80,          // Matched via synonym
    BOTH_COLOCATED: 100,        // Question + option in same sentence
    OPTION_KEYWORD: 25,         // Option keyword found
    QUESTION_KEYWORD: 15,       // Question keyword found
    PHRASE_2GRAM: 50,           // 2-word phrase match
    PHRASE_3GRAM: 75,           // 3-word phrase match
    HIGH_COVERAGE: 40,          // >80% of option words found
    PERFECT_COVERAGE: 60,       // 100% of option words found
};

// ================================
// SYNONYM DICTIONARY
// Technical terms with their synonyms/paraphrases
// ================================

const SYNONYMS: Record<string, string[]> = {
    // Wire lacing terminology
    'lacing': ['lace', 'laced', 'tie', 'tying', 'bind', 'binding', 'wrap', 'wrapping'],
    'tying': ['tie', 'tied', 'lacing', 'lace', 'bind', 'binding', 'secure', 'securing'],
    'cord': ['string', 'thread', 'twine', 'tape', 'line'],
    'knot': ['hitch', 'loop', 'tie', 'bind'],
    'clove': ['clove hitch', 'clove-hitch'],
    'hitch': ['knot', 'tie', 'loop'],
    'square': ['reef', 'flat'],
    'bundle': ['group', 'bunch', 'harness', 'assembly', 'wires'],
    'wire': ['cable', 'conductor', 'lead', 'wiring'],
    'continuous': ['single', 'one piece', 'unbroken'],
    'individual': ['separate', 'discrete', 'single'],
    'cotton': ['fabric', 'cloth', 'textile'],
    'nylon': ['synthetic', 'plastic'],
    'waxed': ['coated', 'treated', 'impregnated'],
    'moisture': ['water', 'wet', 'humidity', 'damp'],
    'fungus': ['mold', 'mildew', 'fungal'],
    'thick': ['large', 'heavy', 'big'],
    'thin': ['small', 'light', 'narrow'],
    'trimmed': ['cut', 'clipped', 'shortened'],
    'branch': ['split', 'fork', 'divide', 'separate'],
    'support': ['hold', 'mount', 'bracket', 'clamp'],
    'deform': ['distort', 'crush', 'squeeze', 'damage'],
    'insulation': ['insulator', 'covering', 'sheath', 'jacket'],
    'coaxial': ['coax', 'shielded cable', 'rf cable'],
    'conduit': ['tube', 'pipe', 'duct', 'channel'],
    'junction': ['connection', 'joint', 'box', 'splice'],
    'approximately': ['about', 'around', 'roughly', 'nearly'],
    'temporary': ['temp', 'short-term', 'provisional'],
    'permanent': ['perm', 'long-term', 'fixed'],
    // General technical terms
    'start': ['begin', 'commence', 'initiate'],
    'end': ['finish', 'complete', 'terminate'],
    'use': ['utilize', 'employ', 'apply'],
    'purpose': ['reason', 'function', 'goal', 'objective'],
    'type': ['kind', 'sort', 'variety', 'form'],
    'material': ['substance', 'matter', 'fabric'],
    'inch': ['in', '"', 'inches'],
    'located': ['placed', 'positioned', 'situated', 'found'],
    'require': ['need', 'must', 'necessary', 'essential'],
};

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

const CONTRAST_ANTONYMS: Record<string, string[]> = {
    'primary': ['secondary', 'tertiary'],
    'true': ['false', 'untrue', 'incorrect'],
    'correct': ['incorrect', 'wrong', 'false'],
    'first': ['second', 'third', 'last'],
    'always': ['never', 'sometimes', 'rarely'],
    'all': ['none', 'some', 'few'],
    'major': ['minor'],
    'positive': ['negative'],
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

    public static async search(question: string, pdfText: string): Promise<SmartSearchResult> {
        console.log(`[SmartSearch] Analyzing question: "${question.slice(0, 100)}..."`);

        const quiz = this.detectQuizQuestion(question);
        console.log(`[SmartSearch] Quiz detected: ${quiz.isQuiz}, Options: ${quiz.options.length}, Negative: ${quiz.isNegative}`);

        if (quiz.isQuiz && quiz.options.length >= 2) {
            console.log(`[SmartSearch] Processing as QUIZ question`);
            return this.solveQuizWithRetry(quiz, pdfText);
        }

        // For non-quiz questions, try to find relevant content
        console.log(`[SmartSearch] Processing as DIRECT question (not a quiz)`);
        return this.findDirectAnswer(question, pdfText);
    }

    public static extractKeywords(text: string): string[] {
        const hyphenated = text.match(/\b\w+-\w+(?:-\w+)*\b/g) || [];
        const numbers = text.match(/\d+(?:[:.]\d+)?(?:\s*[%°]|\s*to\s*\d+)?/g) || [];
        const tokens = this.tokenize(text);
        const words = Array.from(tokens).filter(t => t.length >= 4);
        const all = new Set([...hyphenated, ...numbers, ...words]);
        return Array.from(all).slice(0, 15);
    }

    // ================================
    // CONFIDENCE-DRIVEN RETRY LOOP (with safeguards)
    // ================================

    private static solveQuizWithRetry(quiz: QuizQuestion, fullText: string): SmartSearchResult {
        const MAX_ATTEMPTS = 3;
        const MAX_PAGES_TO_ANALYZE = 15;  // Analyze up to 15 most relevant pages
        const MAX_TEXT_PER_SEARCH = 25000;  // 25KB per search iteration

        // Step 1: Extract ALL pages from the FULL document (no truncation here!)
        const allPages = this.extractPages(fullText);
        console.log(`[SmartSearch] Document has ${allPages.length} pages total`);

        // Step 2: Score ALL pages for relevance to this question
        // This is fast - just keyword matching, no deep analysis
        const relevantPages = this.findRelevantPages(quiz, allPages);
        console.log(`[SmartSearch] Scored ${relevantPages.length} pages, top ${Math.min(MAX_PAGES_TO_ANALYZE, relevantPages.length)} will be analyzed`);

        // Get top N most relevant pages
        const topPages = relevantPages.slice(0, MAX_PAGES_TO_ANALYZE);

        if (topPages.length === 0) {
            console.log(`[SmartSearch] No relevant pages found!`);
            return {
                answer: quiz.options[0]?.letter || 'A',
                confidence: 0.3,
                evidence: '',
                explanation: 'No relevant content found in document.',
                method: 'quiz'
            };
        }

        // Log top pages for debugging
        console.log(`[SmartSearch] Top pages: ${topPages.slice(0, 5).map(p => `p.${p.pageNum}(${p.relevanceScore})`).join(', ')}`);

        let bestResult: SmartSearchResult | null = null;

        // Search levels - analyze progressively more pages
        const searchLevels = [
            { pageCount: 3, name: 'focused' },
            { pageCount: 8, name: 'expanded' },
            { pageCount: MAX_PAGES_TO_ANALYZE, name: 'deep' },
        ];

        for (let attempt = 0; attempt < Math.min(searchLevels.length, MAX_ATTEMPTS); attempt++) {
            const level = searchLevels[attempt];
            const pagesToSearch = topPages.slice(0, level.pageCount);

            console.log(`[SmartSearch] Attempt ${attempt + 1}/${MAX_ATTEMPTS}: ${level.name} (${pagesToSearch.length} pages)`);

            // Combine page content for deep analysis
            let searchText = pagesToSearch.map(p => `[Page ${p.pageNum}]\n${p.text}`).join('\n\n');

            // Safety truncation only if still too long
            if (searchText.length > MAX_TEXT_PER_SEARCH) {
                searchText = searchText.slice(0, MAX_TEXT_PER_SEARCH);
                console.log(`[SmartSearch] Truncated search text to ${MAX_TEXT_PER_SEARCH} chars`);
            }

            const result = this.solveQuizInContext(quiz, searchText, pagesToSearch);

            // Track best result
            if (!bestResult || result.confidence > bestResult.confidence) {
                bestResult = result;
            }

            // Exit early if confidence is good enough
            if (result.confidence >= MIN_CONFIDENCE) {
                console.log(`[SmartSearch] ✓ ${(result.confidence * 100).toFixed(0)}% confidence on attempt ${attempt + 1}`);
                return { ...result, explanation: result.explanation + ` (${level.name})` };
            }

            console.log(`[SmartSearch] ${(result.confidence * 100).toFixed(0)}% - continuing...`);
        }

        // Return best result found
        console.log(`[SmartSearch] Done. Best: ${((bestResult?.confidence || 0) * 100).toFixed(0)}%`);
        return bestResult || {
            answer: quiz.options[0]?.letter || 'A',
            confidence: 0.5,
            evidence: '',
            explanation: 'Could not find confident answer.',
            method: 'quiz'
        };
    }

    // ================================
    // PAGE EXTRACTION & TARGETING
    // ================================

    private static extractPages(fullText: string): PageContent[] {
        const pages: PageContent[] = [];

        // Split by [Page X] markers
        const pageRegex = /\[Page (\d+)\]/g;
        const parts = fullText.split(pageRegex);

        // Parts alternate: [content before first page], pageNum1, content1, pageNum2, content2, ...
        for (let i = 1; i < parts.length; i += 2) {
            const pageNum = parseInt(parts[i]);
            const text = parts[i + 1] || '';
            if (text.trim().length > 0) {
                pages.push({ pageNum, text: text.trim(), relevanceScore: 0 });
            }
        }

        // If no page markers, treat entire text as one "page"
        if (pages.length === 0 && fullText.trim().length > 0) {
            pages.push({ pageNum: 1, text: fullText.trim(), relevanceScore: 0 });
        }

        return pages;
    }

    private static findRelevantPages(quiz: QuizQuestion, pages: PageContent[]): PageContent[] {
        // Extract keywords from question + all options
        const questionKeywords = this.getExpandedKeywords(quiz.question);
        const optionKeywords = quiz.options.flatMap(o => this.getExpandedKeywords(o.text));
        const allKeywords = new Set([...questionKeywords, ...optionKeywords]);

        // Score each page by keyword density
        for (const page of pages) {
            const pageLower = page.text.toLowerCase();
            let score = 0;

            const keywordArr = Array.from(allKeywords);
            for (let k = 0; k < keywordArr.length; k++) {
                const keyword = keywordArr[k];
                // Count occurrences (with word boundaries for accuracy)
                const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
                const matches = pageLower.match(regex);
                if (matches) {
                    score += matches.length * 2;
                }
            }

            // Bonus for glossary/index pages
            if (this.isGlossaryPage(page.text)) {
                score += 50;
            }

            page.relevanceScore = score;
        }

        // Sort by relevance (highest first)
        return pages
            .filter(p => p.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    private static isGlossaryPage(text: string): boolean {
        const lower = text.toLowerCase();
        const glossaryIndicators = ['glossary', 'index', 'definitions', 'terminology', 'terms', 'table of contents'];
        return glossaryIndicators.some(ind => lower.includes(ind));
    }

    private static escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ================================
    // EXPANDED KEYWORD EXTRACTION (with synonyms)
    // ================================

    private static getExpandedKeywords(text: string): string[] {
        const baseTokens = this.tokenize(text);
        const expanded = new Set<string>();

        const tokenArr = Array.from(baseTokens);
        for (let t = 0; t < tokenArr.length; t++) {
            const token = tokenArr[t];
            expanded.add(token);

            // Add synonyms
            for (const [key, synonyms] of Object.entries(SYNONYMS)) {
                if (token.includes(key) || key.includes(token)) {
                    synonyms.forEach(s => expanded.add(s.toLowerCase()));
                }
            }
        }

        // Also add 2-word phrases from original text
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (let i = 0; i < words.length - 1; i++) {
            expanded.add(`${words[i]} ${words[i + 1]}`);
        }

        return Array.from(expanded);
    }

    // ================================
    // QUIZ SOLVING IN CONTEXT
    // ================================

    private static solveQuizInContext(
        quiz: QuizQuestion,
        context: string,
        pages: PageContent[]
    ): SmartSearchResult {
        const MAX_SENTENCES = 150;  // Limit sentences to prevent slowdown

        let sentences = this.splitIntoSentences(context);
        if (sentences.length > MAX_SENTENCES) {
            sentences = sentences.slice(0, MAX_SENTENCES);
        }

        const qTokens = this.tokenize(quiz.question);
        const qExpanded = this.getExpandedKeywords(quiz.question);

        // Score each option
        const optionScores: OptionScore[] = quiz.options.map(opt =>
            this.scoreOptionAdvanced(opt, qTokens, qExpanded, sentences, quiz.isNegative, quiz.question)
        );

        // Decision logic
        return this.makeDecision(quiz, optionScores, pages);
    }

    private static scoreOptionAdvanced(
        option: { letter: string; text: string },
        qTokens: Set<string>,
        qExpanded: string[],
        sentences: string[],
        isNegative: boolean,
        questionText: string
    ): OptionScore {
        const optTokens = this.tokenize(option.text);
        const optExpanded = this.getExpandedKeywords(option.text);
        const optLower = option.text.toLowerCase();

        let bestScore = 0;
        let bestSentence = '';
        const breakdown: string[] = [];

        // Check for contrast evidence in negative questions
        let hasContrastEvidence = false;
        let contrastSentence = '';

        const questionLower = questionText.toLowerCase();
        const contrastTerms: string[] = [];
        for (const [key, antonyms] of Object.entries(CONTRAST_ANTONYMS)) {
            if (questionLower.includes(key)) {
                contrastTerms.push(...antonyms);
            }
        }

        for (const sentence of sentences) {
            const sentLower = sentence.toLowerCase();
            const sentTokens = this.tokenize(sentence);
            let score = 0;

            // === SCORING ===

            // 1. Exact phrase match (highest priority)
            if (this.containsPhrase(sentLower, optLower)) {
                score += SCORING.EXACT_PHRASE;
                breakdown.push('exact phrase');
            }

            // 2. Synonym matching
            let synonymMatches = 0;
            for (const keyword of optExpanded) {
                if (sentLower.includes(keyword)) {
                    synonymMatches++;
                }
            }
            if (synonymMatches > 0) {
                score += synonymMatches * SCORING.SYNONYM_MATCH / optExpanded.length;
                breakdown.push(`${synonymMatches} synonym matches`);
            }

            // 3. Co-location: question AND option keywords in same sentence
            const qOverlap = this.countOverlap(qTokens, sentTokens);
            const oOverlap = this.countOverlap(optTokens, sentTokens);

            if (qOverlap > 0 && oOverlap > 0) {
                score += SCORING.BOTH_COLOCATED;
                breakdown.push('co-located');
            }

            score += qOverlap * SCORING.QUESTION_KEYWORD;
            score += oOverlap * SCORING.OPTION_KEYWORD;

            // 4. N-gram matching (2-word and 3-word phrases)
            const optWords = option.text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
            for (let i = 0; i < optWords.length - 1; i++) {
                const bigram = `${optWords[i]} ${optWords[i + 1]}`;
                if (sentLower.includes(bigram)) {
                    score += SCORING.PHRASE_2GRAM;
                }
            }
            for (let i = 0; i < optWords.length - 2; i++) {
                const trigram = `${optWords[i]} ${optWords[i + 1]} ${optWords[i + 2]}`;
                if (sentLower.includes(trigram)) {
                    score += SCORING.PHRASE_3GRAM;
                }
            }

            // 5. Coverage bonus
            if (optTokens.size > 0) {
                const coverage = oOverlap / optTokens.size;
                if (coverage > 0.8) score += SCORING.HIGH_COVERAGE;
                if (coverage >= 1.0) score += SCORING.PERFECT_COVERAGE;
            }

            // 6. Contrast detection for negative questions
            if (isNegative && contrastTerms.length > 0) {
                const optIndex = sentLower.indexOf(optLower.split(' ')[0]);
                if (optIndex !== -1) {
                    for (const term of contrastTerms) {
                        const termIndex = sentLower.indexOf(term);
                        if (termIndex !== -1 && termIndex > optIndex) {
                            hasContrastEvidence = true;
                            contrastSentence = sentence;
                            break;
                        }
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestSentence = sentence;
            }
        }

        // For negative questions with contrast evidence, mark specially
        const finalScore = hasContrastEvidence ? -1 : bestScore;
        const finalEvidence = hasContrastEvidence ? contrastSentence : bestSentence;

        return {
            letter: option.letter,
            text: option.text,
            totalScore: finalScore,
            evidence: finalEvidence,
            breakdown
        };
    }

    // ================================
    // SYNONYM-EXPANDED SEARCH (fallback)
    // ================================

    private static solveWithSynonymExpansion(quiz: QuizQuestion, pages: PageContent[]): SmartSearchResult {
        // Expand all keywords with synonyms and search again
        const expandedQuestion: QuizQuestion = {
            ...quiz,
            // Expand question text with synonyms
            question: this.expandTextWithSynonyms(quiz.question),
            options: quiz.options.map(o => ({
                ...o,
                text: this.expandTextWithSynonyms(o.text)
            }))
        };

        const allText = pages.map(p => p.text).join('\n\n');
        return this.solveQuizInContext(expandedQuestion, allText, pages);
    }

    private static expandTextWithSynonyms(text: string): string {
        let expanded = text.toLowerCase();
        for (const [key, synonyms] of Object.entries(SYNONYMS)) {
            if (expanded.includes(key)) {
                // Add first synonym as alternative phrasing
                expanded += ' ' + synonyms[0];
            }
        }
        return expanded;
    }

    // ================================
    // DECISION LOGIC
    // ================================

    private static makeDecision(
        quiz: QuizQuestion,
        optionScores: OptionScore[],
        pages: PageContent[]
    ): SmartSearchResult {
        let winner: OptionScore;
        let confidence = 0.5;
        let explanation = '';

        if (quiz.isNegative) {
            // Check for contrast evidence first
            const contrastMatch = optionScores.find(o => o.totalScore === -1);

            if (contrastMatch) {
                winner = contrastMatch;
                confidence = 0.98;
                explanation = `Negative question: ${contrastMatch.letter} is explicitly contrasted in the text.`;
            } else {
                // Sort and pick lowest scored (least supported = correct for "NOT" questions)
                optionScores.sort((a, b) => b.totalScore - a.totalScore);
                const worst = optionScores[optionScores.length - 1];
                const best = optionScores[0];
                const highScoreCount = optionScores.filter(o => o.totalScore > 50).length;

                if (highScoreCount >= 2 && worst.totalScore < 20) {
                    winner = worst;
                    confidence = 0.95;
                    explanation = `Negative question: ${worst.letter} has least textual support while others are well-supported.`;
                } else if (worst.totalScore < best.totalScore * 0.3) {
                    winner = worst;
                    confidence = 0.80;
                    explanation = `Negative question: ${worst.letter} has significantly less support.`;
                } else {
                    winner = worst;
                    confidence = 0.60;
                    explanation = `Negative question: ${worst.letter} had lowest match (uncertain).`;
                }
            }
        } else {
            // Normal question: pick highest scored
            optionScores.sort((a, b) => b.totalScore - a.totalScore);
            winner = optionScores[0];
            const second = optionScores[1];

            if (winner.totalScore > 0) {
                const margin = second ? winner.totalScore / Math.max(second.totalScore, 1) : 10;

                if (margin >= 3 || winner.totalScore >= 200) {
                    confidence = 0.98;
                    explanation = `${winner.letter} has definitive textual evidence.`;
                } else if (margin >= 2) {
                    confidence = 0.92;
                    explanation = `${winner.letter} is clearly the best match.`;
                } else if (margin >= 1.5) {
                    confidence = 0.85;
                    explanation = `${winner.letter} has significantly more support.`;
                } else if (margin >= 1.2) {
                    confidence = 0.75;
                    explanation = `${winner.letter} has moderately more support.`;
                } else if (margin >= 1.1) {
                    confidence = 0.65;
                    explanation = `${winner.letter} has slightly more support.`;
                } else {
                    confidence = 0.55;
                    explanation = `${winner.letter} marginally matches better.`;
                }
            } else {
                confidence = 0.30;
                explanation = `No strong evidence found. ${winner.letter} is best guess.`;
            }
        }

        // Find page number from evidence
        let pageNum: number | undefined;
        if (winner.evidence) {
            for (const page of pages) {
                if (page.text.includes(winner.evidence.slice(0, 50))) {
                    pageNum = page.pageNum;
                    break;
                }
            }
        }

        return {
            answer: winner.letter,
            confidence,
            evidence: winner.evidence || 'No direct evidence found.',
            explanation,
            method: 'quiz',
            pageNumber: pageNum
        };
    }

    // ================================
    // QUIZ DETECTION
    // ================================

    public static detectQuizQuestion(input: string): QuizQuestion {
        const questionBody = this.extractQuestionBody(input);
        const isNegative = this.detectNegative(questionBody);
        const options = this.parseOptions(input);

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

    private static extractQuestionBody(input: string): string {
        const patterns = [
            /(?:^|\n)\s*[A-Ea-e][.\)\]]/,
            /\s{2,}[A-Ea-e][.\)\]]/
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match.index !== undefined) {
                return input.slice(0, match.index).toUpperCase();
            }
        }

        return input.toUpperCase();
    }

    private static detectNegative(questionBody: string): boolean {
        return NEGATIVE_KEYWORDS.some(kw =>
            new RegExp(`\\b${kw}\\b`, 'i').test(questionBody)
        );
    }

    private static parseOptions(input: string): { letter: string; text: string }[] {
        const options: { letter: string; text: string }[] = [];

        // Simple approach: find all occurrences of option patterns
        // Pattern 1: "A. text" or "A) text" or "(A) text"
        // Use very simple matching

        const text = input.replace(/\r\n/g, '\n');

        // Try to find options in various formats
        // Format: A. text  B. text  C. text  D. text
        // Format: A) text  B) text
        // Format: (A) text (B) text

        // First, try to split by common option markers
        const optionMatches: { letter: string; text: string; index: number }[] = [];

        // Pattern 1: A. or A) or (A) at start of line or after spaces
        const pattern1 = /(?:^|\s)([A-Ea-e])[.\)]\s*(.+?)(?=(?:\s[A-Ea-e][.\)])|$)/gi;
        let match;

        // Reset lastIndex to start from beginning
        const testText = text + ' '; // Add space to help capture last option

        // Simple line-by-line or split approach
        // Split by option markers
        const parts = text.split(/(?=\s[A-Ea-e][.\)])/);

        for (const part of parts) {
            // Try to extract option from this part
            const optMatch = part.match(/^\s*([A-Ea-e])[.\)]\s*(.+)/);
            if (optMatch) {
                const letter = optMatch[1].toUpperCase();
                let optText = optMatch[2].trim();

                // Clean up: remove next option if captured
                optText = optText.replace(/\s+[A-Ea-e][.\)].*$/i, '').trim();

                if (optText.length > 0 && !options.find(o => o.letter === letter)) {
                    options.push({ letter, text: optText });
                }
            }
        }

        // If no options found, try alternative: look for A through D/E markers
        if (options.length < 2) {
            const altPattern = /([A-Ea-e])[.\)]\s*([^A-Ea-e]+?)(?=[A-Ea-e][.\)]|$)/g;
            while ((match = altPattern.exec(text)) !== null) {
                const letter = match[1].toUpperCase();
                const optText = match[2].trim().replace(/\s+/g, ' ');

                if (optText.length > 1 && !options.find(o => o.letter === letter)) {
                    options.push({ letter, text: optText });
                }
            }
        }

        // Log for debugging
        console.log(`[SmartSearch] Parsed ${options.length} options:`, options.map(o => `${o.letter}: "${o.text.slice(0, 30)}..."`));

        options.sort((a, b) => a.letter.localeCompare(b.letter));
        return options;
    }

    private static extractQuestionText(input: string, firstLetter: string): string {
        const patterns = [
            new RegExp(`(?:^|\\n|\\s{2,})${firstLetter}[.\\)\\]]`, 'i'),
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
    // FALLBACK
    // ================================

    private static findDirectAnswer(question: string, text: string): SmartSearchResult {
        return {
            answer: '',
            confidence: 0,
            evidence: '',
            explanation: 'No quiz question detected.',
            method: 'direct'
        };
    }

    // ================================
    // UTILITY FUNCTIONS
    // ================================

    private static tokenize(text: string): Set<string> {
        const clean = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
        const tokens = clean.split(/\s+/);

        const validTokens = new Set<string>();
        for (const t of tokens) {
            if (STOP_WORDS.has(t)) continue;
            const stem = this.stem(t);
            if (stem.length > 2) validTokens.add(stem);
        }
        return validTokens;
    }

    private static stem(word: string): string {
        if (word.length < 4) return word;

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
                if (stem.length >= 3) return stem;
            }
        }

        return word;
    }

    private static containsPhrase(text: string, phrase: string): boolean {
        const normText = text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
        const normPhrase = phrase.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
        return normText.includes(normPhrase);
    }

    private static countOverlap(setA: Set<string>, setB: Set<string>): number {
        let count = 0;
        const arrA = Array.from(setA);
        for (let i = 0; i < arrA.length; i++) {
            if (setB.has(arrA[i])) count++;
        }
        return count;
    }

    private static splitIntoSentences(text: string): string[] {
        const normalized = text.replace(/([.!?])\s+/g, '$1|||');
        return normalized
            .split('|||')
            .filter(s => s.trim().length > 10);
    }

    // Public method for backward compatibility
    public static solveQuiz(quiz: QuizQuestion, context: string): SmartSearchResult {
        return this.solveQuizWithRetry(quiz, context);
    }
}
