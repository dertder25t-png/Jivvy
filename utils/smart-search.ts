import { pdfWorker } from './pdf-extraction';
import { scoreCandidate } from './search/scoring';
import { SearchCandidate, SearchAnswer } from './search/types';
import { STOP_WORDS, tokenizeText } from './search/preprocessor';
import { buildSparseVector, cosineSimilarity, SparseVector } from './search/semantic';
import { analyzeQuestion, QuestionAnalysis } from './search/question-analyzer';
import { getPreferredMode, type AIMode } from './local-llm';

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
 * - Mode-aware context limits (Quick vs Thorough)
 * - Multi-source context assembly for deep analysis
 */

// ============================================================================
// CONTEXT CONFIGURATION (Strategy 1: Multi-stage context assembly)
// ============================================================================

// Maximum context sizes (increased for thorough mode)
const MAX_CONTEXT_QUICK = 1100;
const MAX_CONTEXT_THOROUGH = 15000;  // Increased from 8000 to 15000

// Per-segment character limits
const SEGMENT_CHAR_LIMIT_QUICK = 220;
const SEGMENT_CHAR_LIMIT_THOROUGH = 2000;  // Increased from 500 to 2000

// Page expansion for context gathering
const PAGE_EXPANSION_RANGE = 2;  // Grab 2-3 pages before/after matches

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
    page?: number;
    pages?: number[];
    chunkIds?: string[];
}

export interface ExpandedContext {
    primaryPages: number[];
    expandedPages: number[];
    pageTexts: Map<number, string>;
    totalCharacters: number;
    assembledContext: string;
}

// ============================================================================
// CONTEXT EXPANSION FUNCTIONS (Strategy 1 & 6)
// ============================================================================

/**
 * Expand context by grabbing adjacent pages around matches
 * Strategy 6: Full page context expansion
 */
export async function expandContext(
    candidates: SearchCandidate[],
    totalPages: number,
    expansionRange: number = PAGE_EXPANSION_RANGE
): Promise<ExpandedContext> {
    const primaryPages = [...new Set(candidates.map(c => c.page))].sort((a, b) => a - b);
    const expandedPages = new Set<number>();
    
    // Add primary and adjacent pages
    for (const page of primaryPages) {
        for (let p = Math.max(1, page - expansionRange); p <= Math.min(totalPages, page + expansionRange); p++) {
            expandedPages.add(p);
        }
    }
    
    // Limit to prevent excessive fetching
    const maxExpanded = 10;
    const sortedExpanded = [...expandedPages].sort((a, b) => a - b).slice(0, maxExpanded);
    
    // Fetch page texts
    const pageTexts = new Map<number, string>();
    for (const page of sortedExpanded) {
        const text = await pdfWorker.getPageText(page);
        if (text) {
            pageTexts.set(page, text.slice(0, 4000)); // Limit per-page size
        }
    }
    
    // Assemble context with page markers
    const primarySet = new Set(primaryPages);
    const sections: string[] = [];
    
    for (const page of sortedExpanded) {
        const text = pageTexts.get(page);
        if (!text) continue;
        const marker = primarySet.has(page) ? '★' : '○';
        sections.push(`\n=== Page ${page} ${marker} ===\n${text}`);
    }
    
    const assembledContext = sections.join('\n\n');
    
    return {
        primaryPages,
        expandedPages: sortedExpanded,
        pageTexts,
        totalCharacters: assembledContext.length,
        assembledContext
    };
}

/**
 * Assemble multi-source context from candidates with full page expansion
 * Strategy 1: Multi-stage context assembly
 */
export async function assembleMultiSourceContext(
    candidates: SearchCandidate[],
    totalPages: number,
    maxChars: number = MAX_CONTEXT_THOROUGH
): Promise<{
    context: string;
    pages: number[];
    sourceCounts: { primary: number; expanded: number };
}> {
    const expanded = await expandContext(candidates, totalPages, PAGE_EXPANSION_RANGE);
    
    // If expanded context fits, use it
    if (expanded.totalCharacters <= maxChars) {
        return {
            context: expanded.assembledContext,
            pages: expanded.expandedPages,
            sourceCounts: {
                primary: expanded.primaryPages.length,
                expanded: expanded.expandedPages.length
            }
        };
    }
    
    // Need to be selective - prioritize primary pages
    const sections: string[] = [];
    const includedPages: number[] = [];
    let currentLength = 0;
    const primarySet = new Set(expanded.primaryPages);
    
    // First add primary pages
    for (const page of expanded.primaryPages) {
        const text = expanded.pageTexts.get(page);
        if (!text) continue;
        
        const section = `\n=== Page ${page} ★ ===\n${text}`;
        if (currentLength + section.length <= maxChars) {
            sections.push(section);
            includedPages.push(page);
            currentLength += section.length;
        }
    }
    
    // Then add adjacent pages if space allows
    for (const page of expanded.expandedPages) {
        if (primarySet.has(page)) continue; // Already added
        const text = expanded.pageTexts.get(page);
        if (!text) continue;
        
        const section = `\n=== Page ${page} ○ ===\n${text}`;
        if (currentLength + section.length <= maxChars) {
            sections.push(section);
            includedPages.push(page);
            currentLength += section.length;
        }
    }
    
    return {
        context: sections.join('\n\n'),
        pages: includedPages.sort((a, b) => a - b),
        sourceCounts: {
            primary: expanded.primaryPages.length,
            expanded: includedPages.length
        }
    };
}

/**
 * SmartSearchEngine - Worker-based search coordinator
 */
interface EvaluatedCandidate {
    candidate: SearchCandidate;
    lexical: number;
    detailed: number;
    semantic: number;
    combined: number;
    excerpt: string;
    matchType: 'exact' | 'phrase' | 'fuzzy';
    vector: SparseVector;
}

export class SmartSearchEngine {
    
    // ==========================================
    // QUIZ DETECTION (Static - No worker needed)
    // ==========================================

    /**
     * Detect if text is a multiple-choice question
     * Handles formats: A), A., (A), [A], a), 1), etc.
     */
    static detectQuizQuestion(text: string): DetectedQuiz {
        try {
            const cleanText = text.replace(/\r\n?/g, '\n').trim();

            // Detect negative logic keywords
            const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(cleanText);

            // Option pattern: A), A., (A), [A], a), 1), etc.
            // Also supports ':', '-', '—' separators and inline options.
            // Expanded to A-H and 1-8 to handle more choices.
            // Boundary ensures we don't match random letters inside a word.
            const optionRegex = /(?:^|\n|\s)(?:\(?|\[)?([A-Ha-h1-8])(?:\)|\.|]|\-|:|—)\s+(.*?)(?=(?:(?:\n|\s)(?:\(?|\[)?[A-Ha-h1-8](?:\)|\.|]|\-|:|—)\s+)|$)/gs;

            const rawMatches = Array.from(cleanText.matchAll(optionRegex));
            if (rawMatches.length < 2) {
                return { isQuiz: false, question: '', options: [], isNegative: false };
            }

            const options: { letter: string; text: string }[] = [];
            const seenLetters = new Set<string>();

            for (const m of rawMatches) {
                const rawLetter = (m[1] || '').toUpperCase();
                const optionText = (m[2] || '').trim();

                const normalizedLetter = /[1-8]/.test(rawLetter)
                    ? String.fromCharCode(64 + parseInt(rawLetter, 10))
                    : rawLetter;

                if (!normalizedLetter || seenLetters.has(normalizedLetter)) continue;
                if (optionText.length === 0) continue;

                // Heuristic: ignore extremely short "options" that are likely parsing noise.
                if (optionText.length < 2) continue;

                seenLetters.add(normalizedLetter);
                options.push({ letter: normalizedLetter, text: optionText });
            }

            if (options.length < 2) {
                // Fallback parser for messy inputs that don't include explicit separators
                // (e.g., "A option" or "A)option" inconsistently).
                const fallbackRegex = /(?:^|\n)\s*(?:\(?|\[)?([A-Ha-h1-8])(?:\)|\.|]|:|\-|–|—|\s)\s+(.+?)(?=(?:\n\s*(?:\(?|\[)?[A-Ha-h1-8](?:\)|\.|]|:|\-|–|—|\s)\s+)|$)/gs;
                const fallbackMatches = Array.from(cleanText.matchAll(fallbackRegex));
                if (fallbackMatches.length < 2) {
                    return { isQuiz: false, question: '', options: [], isNegative: false };
                }

                const fallbackOptions: { letter: string; text: string }[] = [];
                const fallbackSeen = new Set<string>();
                for (const m of fallbackMatches) {
                    const rawLetter = (m[1] || '').toUpperCase();
                    const optionText = (m[2] || '').trim();

                    const normalizedLetter = /[1-8]/.test(rawLetter)
                        ? String.fromCharCode(64 + parseInt(rawLetter, 10))
                        : rawLetter;

                    if (!normalizedLetter || fallbackSeen.has(normalizedLetter)) continue;
                    if (optionText.length < 2) continue;

                    fallbackSeen.add(normalizedLetter);
                    fallbackOptions.push({ letter: normalizedLetter, text: optionText });
                }

                if (fallbackOptions.length < 2) {
                    return { isQuiz: false, question: '', options: [], isNegative: false };
                }

                const firstMatchIndex = fallbackMatches[0]?.index ?? -1;
                const extractedQuestion = firstMatchIndex > 0
                    ? cleanText.slice(0, firstMatchIndex).trim()
                    : '';

                return {
                    isQuiz: true,
                    question: extractedQuestion.length > 10 ? extractedQuestion : cleanText,
                    options: fallbackOptions,
                    isNegative
                };
            }

            const firstMatchIndex = rawMatches[0]?.index ?? -1;
            const extractedQuestion = firstMatchIndex > 0
                ? cleanText.slice(0, firstMatchIndex).trim()
                : '';

            return {
                isQuiz: true,
                question: extractedQuestion.length > 10 ? extractedQuestion : cleanText,
                options,
                isNegative
            };
        } catch {
            return { isQuiz: false, question: '', options: [], isNegative: false };
        }
    }

    // ==========================================
    // SEARCH METHODS
    // ==========================================

    /**
     * Refines the query by removing conversational fluff and focusing on key terms.
     * This helps the density scorer focus on the actual content.
     */
    private refineQuery(query: string): string {
        // Remove common conversational prefixes
        // e.g. "What is the...", "Can you find...", "Tell me about..."
        let refined = query.replace(/^(what|where|when|who|how|why|can you|please|tell me|find|search for|i need to know)\s+(is|are|do|does|did|was|were|about|the|a|an|to)\s+/i, '');
        
        // Remove "in the document", "according to the text"
        refined = refined.replace(/\b(in the document|according to the text|based on the pdf|in this file)\b/gi, '');
        
        return refined.trim() || query; // Fallback to original if empty
    }

    /**
     * Main search entry point
     * Queries worker for relevant context, then scores options
     */
    public async search(question: string, options: string[] = [], filterPages?: Set<number>, forceAnswer: boolean = false): Promise<SmartSearchResult> {
        // 1. Detect negative logic
        const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(question);

        // 2. Refine Query for better scoring
        // We use the refined query for scoring, but maybe the original for retrieval?
        // Actually, TF-IDF in retrieval handles common words well, but let's pass the refined query 
        // to ensure we don't match on "what" or "is" if they happen to be rare in a weird doc.
        const refinedQuery = this.refineQuery(question);
        
        // Use original question for retrieval to cast a wider net.
        const candidates = await pdfWorker.searchCandidates(question, filterPages);

        if (candidates.length === 0) {
             return {
                answer: '',
                explanation: 'No relevant context found in document.',
                confidence: 0,
                evidence: ''
            };
        }

        const lexicalMax = Math.max(...candidates.map(c => c.score), 0) || 1;
        const questionVector = buildSparseVector(refinedQuery);
        const evaluatedCandidates: EvaluatedCandidate[] = [];

        let bestCandidate: EvaluatedCandidate | null = null;

        for (const candidate of candidates) {
            const lexicalNorm = Math.min(candidate.score / lexicalMax, 1);
            const vector = buildSparseVector(candidate.text);
            const semanticScore = cosineSimilarity(questionVector, vector);
            const detailResult = scoreCandidate(candidate.text, refinedQuery);
            const detailedNorm = detailResult.score / 100;

            const combined = (lexicalNorm * 0.35) + (detailedNorm * 0.4) + (semanticScore * 0.25);

            const evaluated: EvaluatedCandidate = {
                candidate,
                lexical: lexicalNorm,
                detailed: detailedNorm,
                semantic: semanticScore,
                combined,
                excerpt: detailResult.excerpt,
                matchType: detailResult.matchType,
                vector
            };

            evaluatedCandidates.push(evaluated);

            if (!bestCandidate || evaluated.combined > bestCandidate.combined) {
                bestCandidate = evaluated;
            }
        }

        const analysis = analyzeQuestion(question);
        const chosenChunks = this.selectTopChunks(evaluatedCandidates, analysis);

        // 4. Confidence Gating
        const CONFIDENCE_THRESHOLD = 0.38; // tuned for combined scoring range 0-1
        if (!forceAnswer && (!bestCandidate || bestCandidate.combined < CONFIDENCE_THRESHOLD)) {
             return {
                answer: '',
                explanation: 'I can’t find a confident answer. Would you like me to keep searching? This will take longer and use more device power.',
                confidence: bestCandidate ? bestCandidate.combined : 0,
                evidence: '',
                page: bestCandidate?.candidate.page,
                pages: chosenChunks.map(c => c.candidate.page)
            };
        }

        // 5. If options provided (Quiz Mode), pick the best option based on evidence
        if (options.length > 0) {
            return this.solveQuiz(question, options, evaluatedCandidates, isNegative);
        }

        // 6. Direct Answer Mode - leverage compact LLM pass over selected chunks
        const bestEvidence = bestCandidate?.excerpt ?? '';
        const synthesis = await this.synthesizeAnswer(question, analysis, chosenChunks, bestCandidate, bestEvidence);

        return {
            answer: synthesis.answer,
            explanation: synthesis.explanation,
            confidence: bestCandidate?.combined ?? 0,
            evidence: synthesis.evidence,
            page: synthesis.primaryPage,
            pages: synthesis.pages,
            chunkIds: synthesis.chunkIds
        };
    }

    private selectTopChunks(evaluatedCandidates: EvaluatedCandidate[], analysis: QuestionAnalysis, limit?: number): EvaluatedCandidate[] {
        if (evaluatedCandidates.length === 0) return [];

        // Mode-aware chunk limit
        const mode = getPreferredMode();
        const effectiveLimit = limit ?? (mode === 'thorough' ? 8 : 4);

        const normalizedTerms = analysis.keyTerms.map(t => t.toLowerCase());
        const sorted = [...evaluatedCandidates].sort((a, b) => b.combined - a.combined);
        const selected: EvaluatedCandidate[] = [];
        const covered = new Set<string>();
        const usedIds = new Set<string>();

        for (const candidate of sorted) {
            if (selected.length >= effectiveLimit) break;
            if (usedIds.has(candidate.candidate.chunkId)) continue;

            const chunkTokens = new Set(tokenizeText(candidate.candidate.text));
            let addsCoverage = false;
            for (const term of normalizedTerms) {
                if (!covered.has(term) && chunkTokens.has(term)) {
                    addsCoverage = true;
                    break;
                }
            }

            if (selected.length === 0 || addsCoverage) {
                selected.push(candidate);
                usedIds.add(candidate.candidate.chunkId);
                for (const term of normalizedTerms) {
                    if (chunkTokens.has(term)) {
                        covered.add(term);
                    }
                }
            }
        }

        // Backfill remaining slots with highest scoring unused chunks
        for (const candidate of sorted) {
            if (selected.length >= Math.min(effectiveLimit, sorted.length)) break;
            if (usedIds.has(candidate.candidate.chunkId)) continue;
            selected.push(candidate);
            usedIds.add(candidate.candidate.chunkId);
        }

        return selected;
    }

    private async synthesizeAnswer(
        question: string,
        analysis: QuestionAnalysis,
        chosenChunks: EvaluatedCandidate[],
        bestCandidate: EvaluatedCandidate | null,
        fallbackEvidence: string
    ): Promise<{
        answer: string;
        explanation: string;
        evidence: string;
        pages?: number[];
        chunkIds?: string[];
        primaryPage?: number;
    }> {
        if (chosenChunks.length === 0 || !bestCandidate) {
            const primaryPage = bestCandidate?.candidate.page;
            return {
                answer: fallbackEvidence,
                explanation: primaryPage
                    ? `Returning best matching excerpt from page ${primaryPage}.`
                    : 'Returning best matching excerpt from closest chunk.',
                evidence: fallbackEvidence,
                pages: primaryPage ? [primaryPage] : undefined,
                chunkIds: bestCandidate ? [bestCandidate.candidate.chunkId] : undefined,
                primaryPage
            };
        }

        const { context, pages, chunkIds, leadEvidence } = this.buildLLMContext(chosenChunks, analysis);

        if (!context) {
            const primaryPage = bestCandidate.candidate.page;
            return {
                answer: fallbackEvidence,
                explanation: `Unable to synthesize context. Falling back to excerpt on page ${primaryPage}.`,
                evidence: fallbackEvidence,
                pages: [primaryPage],
                chunkIds: [bestCandidate.candidate.chunkId],
                primaryPage
            };
        }

        try {
            const { answerQuestionLocal } = await import('@/utils/local-llm');
            const augmentedQuestion = this.buildAugmentedQuestion(question, analysis);
            const answer = await answerQuestionLocal(augmentedQuestion, context);
            const primaryPage = pages[0] ?? bestCandidate.candidate.page;
            return {
                answer,
                explanation: `Synthesized from ${chunkIds.length} focused sections.`,
                evidence: leadEvidence || fallbackEvidence,
                pages,
                chunkIds,
                primaryPage
            };
        } catch (error) {
            console.error('[SmartSearch] Failed to synthesize answer with local LLM', error);
            const primaryPage = chosenChunks[0]?.candidate.page ?? bestCandidate.candidate.page;
            const fallbackPages = pages.length ? pages : (primaryPage ? [primaryPage] : []);
            const fallbackChunks = chunkIds.length ? chunkIds : [bestCandidate.candidate.chunkId];
            return {
                answer: fallbackEvidence,
                explanation: 'Falling back to highest scoring excerpt due to synthesis error.',
                evidence: fallbackEvidence,
                pages: fallbackPages.length ? fallbackPages : undefined,
                chunkIds: fallbackChunks,
                primaryPage
            };
        }
    }

    private buildLLMContext(chosenChunks: EvaluatedCandidate[], analysis: QuestionAnalysis): {
        context: string;
        pages: number[];
        chunkIds: string[];
        leadEvidence: string;
    } {
        const header = this.buildAnalysisHeader(analysis);
        const pages = new Set<number>();
        const chunkIds: string[] = [];
        const segments: string[] = [];
        let leadEvidence = chosenChunks[0]?.excerpt ?? '';
        
        // Mode-aware limits (Strategy 1: expanded context for thorough mode)
        const mode = getPreferredMode();
        const SEGMENT_CHAR_LIMIT = mode === 'thorough' ? SEGMENT_CHAR_LIMIT_THOROUGH : SEGMENT_CHAR_LIMIT_QUICK;
        const MAX_CONTEXT = mode === 'thorough' ? MAX_CONTEXT_THOROUGH : MAX_CONTEXT_QUICK;

        for (const candidate of chosenChunks) {
            pages.add(candidate.candidate.page);
            chunkIds.push(candidate.candidate.chunkId);
            const snippetSource = candidate.excerpt || candidate.candidate.text;
            const snippet = this.trimText(snippetSource.replace(/\s+/g, ' '), SEGMENT_CHAR_LIMIT);
            if (!leadEvidence) {
                leadEvidence = snippet;
            }
            segments.push(`Page ${candidate.candidate.page}, Chunk ${candidate.candidate.chunkIndex}: ${snippet}`);
        }

        let body = segments.join('\n\n---\n\n');
        let context = `${header}\n\nEvidence:\n${body}`;

        // Trim down context if it exceeds the model's limit
        if (context.length > MAX_CONTEXT) {
            const trimmedSegments = segments.map(segment => this.trimText(segment, mode === 'thorough' ? 400 : 160));
            body = trimmedSegments.join('\n\n---\n\n');
            context = `${header}\n\nEvidence:\n${body}`;

            let mutableSegments = [...trimmedSegments];
            while (context.length > MAX_CONTEXT && mutableSegments.length > 1) {
                mutableSegments = mutableSegments.slice(0, mutableSegments.length - 1);
                body = mutableSegments.join('\n\n---\n\n');
                context = `${header}\n\nEvidence:\n${body}`;
            }
        }

        return {
            context: this.trimText(context, MAX_CONTEXT + 50),
            pages: Array.from(pages).sort((a, b) => a - b),
            chunkIds,
            leadEvidence
        };
    }

    private buildAnalysisHeader(analysis: QuestionAnalysis): string {
        const lines = [`Intent: ${analysis.intent}`];
        if (analysis.keyTerms.length) {
            lines.push(`Key terms: ${analysis.keyTerms.join(', ')}`);
        }
        if (analysis.constraints.length) {
            lines.push(`Context cues: ${analysis.constraints.join(' | ')}`);
        }
        if (analysis.negations.length) {
            lines.push(`Negations to respect: ${analysis.negations.join(', ')}`);
        }
        if (analysis.focusPhrases.length) {
            lines.push(`Quoted focus: ${analysis.focusPhrases.join(' | ')}`);
        }
        return lines.join('\n');
    }

    private buildAugmentedQuestion(question: string, analysis: QuestionAnalysis): string {
        const lines = [question.trim()];
        if (analysis.intent === 'diagnosis') {
            lines.push('Return the most likely cause or detection cue, not a definition.');
        }
        if (analysis.intent === 'procedure') {
            lines.push('Outline the required steps or control actions.');
        }
        if (analysis.negations.length) {
            lines.push(`Respect these negations: ${analysis.negations.join(', ')}`);
        }
        if (analysis.constraints.length) {
            lines.push(`Conditions to honor: ${analysis.constraints.join(' | ')}`);
        }
        return lines.join('\n');
    }

    private trimText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, Math.max(0, maxLength - 3)) + '...';
    }

    /**
     * Escalation Mode: Deeper search if user approves
     */
    public async escalateSearch(question: string, options: string[] = [], filterPages?: Set<number>): Promise<SmartSearchResult> {
        // Force answer even with low confidence
        return this.search(question, options, filterPages, true);
    }

    /**
     * Solves a quiz by finding the best evidence for EACH option across all candidates.
     */
    private solveQuiz(
        question: string,
        options: string[],
        evaluatedCandidates: EvaluatedCandidate[],
        isNegative: boolean
    ): SmartSearchResult {
        const refinedQuestion = this.refineQuery(question);
        const optionVectors = options.map(opt => buildSparseVector(`${refinedQuestion} ${opt}`));
        const optionScores = options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const optionVector = optionVectors[idx];

            let bestCombined = 0;
            let bestEvidence = '';
            let bestPage = 0;

            for (const evaluated of evaluatedCandidates) {
                const combinedQuery = `${refinedQuestion} ${opt} ${opt}`;
                const optionDetail = scoreCandidate(evaluated.candidate.text, combinedQuery);
                const optionDetailedNorm = optionDetail.score / 100;
                const optionSemantic = cosineSimilarity(optionVector, evaluated.vector);

                const lexicalComponent = evaluated.lexical;
                const combined = (lexicalComponent * 0.2) + (optionDetailedNorm * 0.5) + (optionSemantic * 0.3);

                if (combined > bestCombined) {
                    bestCombined = combined;
                    bestEvidence = optionDetail.excerpt;
                    bestPage = evaluated.candidate.page;
                }
            }

            return {
                letter,
                text: opt,
                score: bestCombined,
                evidence: bestEvidence,
                page: bestPage
            };
        });

        // Decision Logic
        let winner;
        let explanation;

        if (isNegative) {
            // For NOT/EXCEPT: The "correct" answer is the one with the LEAST evidence (or evidence that it's false)
            // This is tricky. Usually "NOT" questions imply 3 options are True (high score) and 1 is False (low score).
            // So we pick the lowest score.
            optionScores.sort((a, b) => a.score - b.score);
            winner = optionScores[0];
            const runnerUp = optionScores[optionScores.length - 1];
            explanation = `Negative question detected. I found strong evidence for **${runnerUp.letter}** ("...${runnerUp.evidence}..."), but minimal support for **${winner.letter}**, making it the likely exception.`;
        } else {
            // Standard: Pick the option with the HIGHEST score
            optionScores.sort((a, b) => b.score - a.score);
            winner = optionScores[0];

            // Tie-breaking or Low Confidence Check
            if (winner.score < 0.2) {
                 return {
                    answer: '',
                    explanation: 'I analyzed the text but couldn\'t find strong evidence linking any of the options to the question.',
                    confidence: 0.1,
                    evidence: '',
                    page: undefined
                };
            }

            explanation = `It matches **${winner.letter}** because the document states:\n\n> "...${winner.evidence}..."`;
        }

        return {
            answer: winner.letter,
            explanation,
            confidence: Math.min(1, winner.score),
            evidence: winner.evidence,
            page: winner.page,
            pages: winner.page ? [winner.page] : undefined
        };
    }

    /**
     * Score options against retrieved context (Legacy / Fallback)
     */
    private solveLogic(
        question: string,
        options: string[],
        evidence: string,
        isNegative: boolean,
        confidenceScore: number,
        page?: number
    ): SmartSearchResult {
        
        // Score each option by keyword frequency in evidence
        const scores = options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...

            // Extract meaningful keywords (use stopword list instead of length > 3)
            const keywords = opt.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 1 && !STOP_WORDS.has(w));

            let score = 0;
            keywords.forEach(k => {
                // Use word boundary check for better accuracy
                const regex = new RegExp(`\\b${k}\\b`, 'i');
                if (regex.test(evidence)) score++;
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
            explanation = `Negative question detected. The document supports other options, making **${winner.letter}** the likely answer (least evidence found).\n\nContext:\n> "...${evidence}..."`;
        } else {
            // Standard: pick option with MOST evidence
            scores.sort((a, b) => b.score - a.score);
            winner = scores[0];
            
            // Check for ties or low scores
            if (winner.score === 0) {
                 return {
                    answer: '',
                    explanation: 'I found relevant text, but none of the options seem to match it clearly.',
                    confidence: 0.1,
                    evidence: evidence,
                    page: page
                };
            }
            
            explanation = `It matches **${winner.letter}** because the document states:\n\n> "...${evidence}..."`;
        }

        return {
            answer: winner.letter,
            explanation,
            confidence: confidenceScore / 100,
            evidence: evidence,
            page: page
        };
    }
}

// Default singleton for convenience
export const smartSearch = new SmartSearchEngine();