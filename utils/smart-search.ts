import { pdfWorker } from './pdf-extraction';
import { scoreCandidate } from './search/scoring';
import { SearchCandidate, SearchAnswer } from './search/types';
import { STOP_WORDS, tokenizeText } from './search/preprocessor';
import { buildSparseVector, cosineSimilarity, SparseVector } from './search/semantic';
import { analyzeQuestion, QuestionAnalysis } from './search/question-analyzer';

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
    page?: number;
    pages?: number[];
    chunkIds?: string[];
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
        const cleanText = text.replace(/\r\n/g, '\n').trim();

        // Detect negative logic keywords
        const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(cleanText);

        // Option pattern: A), A., (A), [A], a), 1), etc.
        // Improved regex to handle inline options and messy formatting
        // Looks for a single letter/number followed by a separator, then text, 
        // but ensures it's not just a random letter in a sentence.
        const optionRegex = /(?:^|\n|\s+)(?:\(?|\[?)([A-Da-d1-4])(?:\)|\.|]|-)\s+(.*?)(?=(?:(?:\n|\s+)(?:\(?|\[?)[A-Da-d1-4](?:\)|\.|]|-)\s+)|$)/gs;

        const matches: { letter: string; text: string }[] = [];
        let match;
        while ((match = optionRegex.exec(cleanText)) !== null) {
            const letter = match[1].toUpperCase();
            const text = match[2].trim();
            
            // Normalize numeric to letter
            const normalizedLetter = letter.match(/[1-4]/)
                ? String.fromCharCode(64 + parseInt(letter)) // 1->A, 2->B
                : letter;

            if (text.length > 0) {
                matches.push({ letter: normalizedLetter, text });
            }
        }

        if (matches.length < 2) {
            return { isQuiz: false, question: '', options: [], isNegative: false };
        }

        // Extract question (everything before first option match)
        // We need the index of the first match
        const firstMatchIndex = cleanText.indexOf(matches[0].text) - 4; // Approximate start
        const question = cleanText.substring(0, Math.max(0, firstMatchIndex)).trim();

        return {
            isQuiz: true,
            question: question.length > 10 ? question : cleanText, // Fallback if extraction fails
            options: matches,
            isNegative
        };
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

    private selectTopChunks(evaluatedCandidates: EvaluatedCandidate[], analysis: QuestionAnalysis, limit: number = 4): EvaluatedCandidate[] {
        if (evaluatedCandidates.length === 0) return [];

        const normalizedTerms = analysis.keyTerms.map(t => t.toLowerCase());
        const sorted = [...evaluatedCandidates].sort((a, b) => b.combined - a.combined);
        const selected: EvaluatedCandidate[] = [];
        const covered = new Set<string>();
        const usedIds = new Set<string>();

        for (const candidate of sorted) {
            if (selected.length >= limit) break;
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
            if (selected.length >= Math.min(limit, sorted.length)) break;
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
        const SEGMENT_CHAR_LIMIT = 220;

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

        // Trim down context if it exceeds the LLM limit
        const MAX_CONTEXT = 1100;
        if (context.length > MAX_CONTEXT) {
            const trimmedSegments = segments.map(segment => this.trimText(segment, 160));
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
            context: this.trimText(context, 1150),
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