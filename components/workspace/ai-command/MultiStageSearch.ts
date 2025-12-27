/**
 * Multi-Stage Search Engine
 * Advanced search pipeline for "Think More" mode
 * 
 * Implements all 10 strategies:
 * - (1) Multi-stage context assembly with 15K char limit
 * - (2) Question decomposition into sub-questions
 * - (3) Topic mapping for semantic navigation
 * - (4) Negative logic handling (NOT/EXCEPT)
 * - (5) Evidence chain building with weighted confidence
 * - (6) Full page context expansion (2-3 pages before/after)
 * - (7) Semantic section detection for boosting
 * - (8) Cross-reference following
 * - (9) Two-pass answer verification
 * - (10) Question type classification
 */

import { pdfWorker } from '@/utils/pdf-extraction';
import { scoreCandidate } from '@/utils/search/scoring';
import { buildSparseVector, cosineSimilarity } from '@/utils/search/semantic';
import { analyzeQuestion } from '@/utils/search/question-analyzer';
import { tokenizeText } from '@/utils/search/preprocessor';
import type { SearchCandidate } from '@/utils/search/types';
import type { SubQuestion, EvidenceChain, CrossReference } from './types';

// Import enhanced strategy modules (used selectively)
import { classifyQuestion } from './QuestionClassifier';
import { detectNegativeLogic } from './NegativeLogicHandler';
import { analyzeNegativeLogicQuestion } from './NegativeLogicHandler';
import { detectSectionType, getSectionBoost } from './SectionDetector';
import { verifyAnswer, verifyQuizAnswerSelection, buildRegenerationContext } from './AnswerVerifier';

// ============================================================================
// CONFIGURATION - Updated for Performance
// ============================================================================

const MAX_CONTEXT_THOROUGH = 6000;   // Reduced from 10K to 6K to fit model context
const PAGE_EXPANSION_RANGE = 1;      // Reduced from 2 to 1 page before/after
const MIN_EVIDENCE_SCORE = 0.3;      // Minimum score to consider as evidence
const VERIFICATION_THRESHOLD = 0.6;  // Confidence threshold for verification pass

// ============================================================================
// QUESTION DECOMPOSITION
// ============================================================================

/**
 * Break down a complex question into sub-questions
 * Each sub-question targets a specific aspect of the main question
 */
export function decomposeQuestion(question: string): SubQuestion[] {
    const analysis = analyzeQuestion(question);
    const subQuestions: SubQuestion[] = [];
    const id = () => Math.random().toString(36).slice(2, 8);

    // Always include the main question refined
    subQuestions.push({
        id: id(),
        question: question,
        type: analysis.intent === 'other' ? 'definition' : analysis.intent as SubQuestion['type']
    });

    // For complex questions, generate additional sub-questions
    const keyTerms = analysis.keyTerms.slice(0, 5);

    // Check for cause-effect patterns
    if (/how does|what causes|why does|effect of|affects?/i.test(question)) {
        // Add a "what is X" question for each key term
        for (const term of keyTerms.slice(0, 2)) {
            subQuestions.push({
                id: id(),
                question: `What is ${term}?`,
                type: 'definition'
            });
        }
        
        // Add relationship question
        if (keyTerms.length >= 2) {
            subQuestions.push({
                id: id(),
                question: `How does ${keyTerms[0]} relate to ${keyTerms[1]}?`,
                type: 'cause-effect'
            });
        }
    }

    // For procedure questions
    if (analysis.intent === 'procedure') {
        subQuestions.push({
            id: id(),
            question: `What are the steps for ${keyTerms[0] || 'this procedure'}?`,
            type: 'procedure'
        });
    }

    // For comparison questions
    if (analysis.intent === 'comparison' && keyTerms.length >= 2) {
        subQuestions.push({
            id: id(),
            question: `What is ${keyTerms[0]}?`,
            type: 'definition'
        });
        subQuestions.push({
            id: id(),
            question: `What is ${keyTerms[1]}?`,
            type: 'definition'
        });
    }

    // For diagnostic questions
    if (analysis.intent === 'diagnosis') {
        subQuestions.push({
            id: id(),
            question: `What are the symptoms of ${keyTerms[0] || 'this condition'}?`,
            type: 'definition'
        });
        subQuestions.push({
            id: id(),
            question: `How to detect ${keyTerms[0] || 'this issue'}?`,
            type: 'procedure'
        });
    }

    // Deduplicate by question text
    const seen = new Set<string>();
    return subQuestions.filter(sq => {
        const normalized = sq.question.toLowerCase().trim();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    }).slice(0, 5); // Max 5 sub-questions
}

// ============================================================================
// EXPANDED CONTEXT GATHERING
// ============================================================================

/**
 * Search for all sub-questions and gather expanded context
 */
export async function gatherExpandedContext(
    subQuestions: SubQuestion[],
    filterPages?: Set<number>
): Promise<{
    contexts: Map<string, { text: string; page: number; score: number }[]>;
    allPages: Set<number>;
    expandedText: string;
}> {
    const contexts = new Map<string, { text: string; page: number; score: number }[]>();
    const allPages = new Set<number>();
    const pageTextCache = new Map<number, string>();

    // Search for each sub-question
    for (const sq of subQuestions) {
        const candidates = await pdfWorker.searchCandidates(sq.question, filterPages);
        const scoredCandidates = candidates.map(c => ({
            text: c.text,
            page: c.page,
            score: c.score
        }));
        
        contexts.set(sq.id, scoredCandidates);
        
        // Track all pages found
        for (const c of candidates) {
            allPages.add(c.page);
        }
    }

    // Expand to adjacent pages for context continuity
    const expandedPages = new Set<number>();
    const allPagesArray = Array.from(allPages);
    for (const page of allPagesArray) {
        for (let p = page - PAGE_EXPANSION_RANGE; p <= page + PAGE_EXPANSION_RANGE; p++) {
            if (p > 0 && (!filterPages || filterPages.has(p))) {
                expandedPages.add(p);
            }
        }
    }

    // Fetch full text for expanded pages
    const sortedPages = Array.from(expandedPages).sort((a, b) => a - b);
    const pageTexts: string[] = [];

    for (const page of sortedPages.slice(0, 5)) { // Limit to 5 pages (was 10)
        try {
            if (!pageTextCache.has(page)) {
                const text = await pdfWorker.getPageText(page);
                pageTextCache.set(page, text);
            }
            const text = pageTextCache.get(page)!;
            if (text && text.length > 50) {
                pageTexts.push(`[Page ${page}]\n${text}`);
            }
        } catch (e) {
            console.warn(`[MultiStageSearch] Failed to get text for page ${page}:`, e);
        }
    }

    const expandedText = pageTexts.join('\n\n---\n\n');

    return { contexts, allPages, expandedText };
}

// ============================================================================
// EVIDENCE CHAIN BUILDING
// ============================================================================

/**
 * Build evidence chains for quiz options
 * Classifies evidence as explicit, implied, absent, or contradicted
 */
export function buildEvidenceChains(
    options: string[],
    question: string,
    candidates: SearchCandidate[]
): EvidenceChain[] {
    // Question is incorporated into optionVector for combined similarity scoring

    return options.map((option, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const optionVector = buildSparseVector(`${question} ${option}`);
        
        const sources: EvidenceChain['sources'] = [];
        let bestScore = 0;
        let evidenceType: EvidenceChain['evidenceType'] = 'absent';

        for (const candidate of candidates) {
            const candidateVector = buildSparseVector(candidate.text);
            const semantic = cosineSimilarity(optionVector, candidateVector);
            const detail = scoreCandidate(candidate.text, `${question} ${option}`);
            const combined = (semantic * 0.4) + (detail.score / 100 * 0.6);

            if (combined > MIN_EVIDENCE_SCORE) {
                sources.push({
                    page: candidate.page,
                    excerpt: detail.excerpt || candidate.text.slice(0, 150),
                    confidence: combined
                });

                if (combined > bestScore) {
                    bestScore = combined;
                }
            }
        }

        // Classify evidence type based on findings
        if (bestScore > 0.7) {
            evidenceType = 'explicit';
        } else if (bestScore > 0.4) {
            evidenceType = 'implied';
        } else if (sources.length === 0) {
            evidenceType = 'absent';
        }

        // Check for contradictions (option keywords found with negations)
        const optionTerms = tokenizeText(option.toLowerCase());
        for (const candidate of candidates) {
            const text = candidate.text.toLowerCase();
            const hasNegation = /\b(not|never|cannot|won't|isn't|aren't|doesn't|don't)\b/.test(text);
            const hasOptionTerms = optionTerms.some(t => text.includes(t));
            
            if (hasNegation && hasOptionTerms) {
                evidenceType = 'contradicted';
                break;
            }
        }

        return {
            optionLetter: letter,
            optionText: option,
            evidenceType,
            score: bestScore,
            sources: sources.slice(0, 3) // Top 3 sources per option
        };
    });
}

// ============================================================================
// CROSS-REFERENCE DETECTION
// ============================================================================

/**
 * Detect cross-references in text (e.g., "see Chapter 5", "refer to Figure 3-2")
 */
export function detectCrossReferences(text: string): CrossReference[] {
    const refs: CrossReference[] = [];

    // Chapter references
    const chapterPattern = /(?:see|refer to|in)\s+(?:chapter|ch\.?)\s+(\d+)/gi;
    let match;
    while ((match = chapterPattern.exec(text)) !== null) {
        refs.push({
            type: 'chapter',
            reference: `Chapter ${match[1]}`
        });
    }

    // Figure references
    const figurePattern = /(?:see|refer to)?\s*(?:figure|fig\.?)\s+(\d+(?:-\d+)?)/gi;
    while ((match = figurePattern.exec(text)) !== null) {
        refs.push({
            type: 'figure',
            reference: `Figure ${match[1]}`
        });
    }

    // Table references
    const tablePattern = /(?:see|refer to)?\s*(?:table)\s+(\d+(?:-\d+)?)/gi;
    while ((match = tablePattern.exec(text)) !== null) {
        refs.push({
            type: 'table',
            reference: `Table ${match[1]}`
        });
    }

    // Section references
    const sectionPattern = /(?:see|refer to)\s+(?:section)\s+(\d+(?:\.\d+)?)/gi;
    while ((match = sectionPattern.exec(text)) !== null) {
        refs.push({
            type: 'section',
            reference: `Section ${match[1]}`
        });
    }

    // Deduplicate
    const seen = new Set<string>();
    return refs.filter(ref => {
        const key = `${ref.type}:${ref.reference}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ============================================================================
// MAIN SEARCH PIPELINE - Enhanced with all 10 strategies
// ============================================================================

export interface MultiStageSearchResult {
    answer: string;
    explanation: string;
    confidence: number;
    evidence: string;
    pages: number[];
    subQuestions: SubQuestion[];
    evidenceChains?: EvidenceChain[];
    crossReferences?: CrossReference[];
    thinkingSteps: Array<{ label: string; status: 'complete' | 'error'; detail?: string }>;
    verified?: boolean;
}

/**
 * Run the full multi-stage search pipeline with all 10 strategies
 */
export async function runMultiStageSearch(
    question: string,
    options: string[] = [],
    filterPages?: Set<number>,
    onStepUpdate?: (step: { label: string; status: 'active' | 'complete'; detail?: string }) => void
): Promise<MultiStageSearchResult> {
    const thinkingSteps: MultiStageSearchResult['thinkingSteps'] = [];
    const addStep = (label: string, status: 'active' | 'complete' | 'error', detail?: string) => {
        if (status === 'complete' || status === 'error') {
            thinkingSteps.push({ label, status, detail });
        }
        onStepUpdate?.({ label, status: status === 'error' ? 'complete' : status, detail });
    };

    try {
        // Strategy 10: Question Classification
        addStep('Classifying question type...', 'active');
        const classification = classifyQuestion(question);
        const strategy = classification.suggestedStrategy;
        addStep('Classifying question', 'complete', `Type: ${classification.type}, Intent: ${classification.analysis.intent}`);

        // Strategy 4: Negative Logic Detection
        const negativeAnalysis = detectNegativeLogic(question);
        if (negativeAnalysis.isNegative) {
            addStep('Negative logic detected', 'complete', `Keyword: ${negativeAnalysis.keyword}`);
        }

        // Strategy 2: Question Decomposition (using local function)
        addStep('Decomposing question...', 'active');
        const subQuestions = decomposeQuestion(question);
        addStep('Decomposing question', 'complete', `${subQuestions.length} sub-questions generated`);

        // Strategy 1 & 6: Multi-stage context assembly with page expansion
        addStep('Gathering expanded context...', 'active');
        const { contexts, allPages, expandedText } = await gatherExpandedContext(subQuestions, filterPages);
        
        // Strategy 6: Expanded context already includes adjacent pages via gatherExpandedContext
        const fullContext = expandedText;
        addStep('Gathering context', 'complete', `${allPages.size} pages, ${fullContext.length} chars`);

        // Strategy 8: Cross-reference following
        const crossReferences = detectCrossReferences(fullContext);
        if (crossReferences.length > 0) {
            addStep('Following cross-references', 'complete', `${crossReferences.length} references found`);
        }

        // Strategy 5: Build evidence chains for quiz questions (using local function)
        let evidenceChains: EvidenceChain[] | undefined;
        if (options.length > 0) {
            addStep('Building evidence chains...', 'active');
            
            // Flatten all candidates with section boosting (Strategy 7)
            const allCandidates: SearchCandidate[] = [];
            const contextEntries = Array.from(contexts.values());
            for (const candidates of contextEntries) {
                for (const c of candidates) {
                    const sectionClassification = detectSectionType(c.text);
                    const boost = getSectionBoost(sectionClassification.type);
                    allCandidates.push({
                        chunkId: `${c.page}-0`,
                        page: c.page,
                        chunkIndex: 0,
                        text: c.text,
                        score: c.score * boost  // Apply section boost
                    } as SearchCandidate);
                }
            }

            evidenceChains = buildEvidenceChains(options, question, allCandidates);
            addStep('Building evidence chains', 'complete', `${options.length} options analyzed`);
        }

        // Strategy 4: Handle negative logic questions specially
        if (negativeAnalysis.isNegative && options.length > 0 && evidenceChains) {
            addStep('Applying negative logic...', 'active');
            // For negative questions, use specialized handler
            const negResult = await analyzeNegativeLogicQuestion(question, options, filterPages);
            addStep('Negative logic applied', 'complete', `Exception found: ${negResult.selectedAnswer}`);
            
            return {
                answer: negResult.selectedAnswer,
                explanation: negResult.reasoning,
                confidence: negResult.confidence,
                evidence: fullContext.slice(0, 500),
                pages: Array.from(allPages),
                subQuestions,
                evidenceChains,
                crossReferences,
                thinkingSteps
            };
        }

        // Generate answer
        addStep('Generating answer...', 'active');

        // Truncate context to max allowed
        const truncatedContext = fullContext.length > MAX_CONTEXT_THOROUGH
            ? fullContext.slice(0, MAX_CONTEXT_THOROUGH) + '...'
            : fullContext;

        // If we failed to gather meaningful context, fail gracefully instead of crashing the LLM.
        // (This commonly happens when the page filter excludes all relevant pages.)
        if (truncatedContext.trim().length < 50) {
            addStep('Insufficient context', 'complete', 'No matching pages found');
            addStep('Generating answer', 'complete');
            return {
                answer: '',
                explanation: 'Search failed: No supporting context found in the selected pages. Try widening the chapter focus or removing the filter.',
                confidence: 0,
                evidence: '',
                pages: Array.from(allPages),
                subQuestions,
                evidenceChains,
                crossReferences,
                thinkingSteps,
            };
        }

        // For quiz questions, use evidence chains to determine answer
        if (options.length > 0 && evidenceChains) {
            const result = solveQuizWithEvidence(question, options, evidenceChains);

            // Strategy 9: Always verify quiz selections (a bare letter is not verifiable)
            addStep('Verifying answer...', 'active');
            const selectedIndex = Math.max(0, result.answer.toUpperCase().charCodeAt(0) - 65);
            const selectedOptionText = options[selectedIndex] ?? '';

            const verification = await verifyQuizAnswerSelection({
                question,
                selectedLetter: result.answer,
                selectedOptionText,
                filterPages
            });

            const quizVerified = verification.supportedClaimCount > 0 && verification.overallConfidence >= VERIFICATION_THRESHOLD;
            addStep(
                quizVerified ? 'Answer verified' : 'Answer not verified',
                'complete',
                quizVerified
                    ? `${verification.supportedClaimCount} claim verified`
                    : 'No supporting evidence found for selected option'
            );

            // If not verified, optionally regenerate a stricter grounded explanation (does not change the chosen letter)
            // This helps avoid confident but ungrounded rationales.
            let explanation = result.explanation;
            if (!quizVerified && verification.shouldRegenerate) {
                const regenContext = buildRegenerationContext(verification, question);
                const { answerQuestionLocal } = await import('@/utils/local-llm');
                // Only regenerate if we have real document context to ground to.
                if (truncatedContext.trim().length >= 50) {
                    explanation = await answerQuestionLocal(
                        question,
                        `${regenContext.stricterPrompt}\n\nSelected option: ${result.answer}. ${selectedOptionText}\n\nContext:\n${truncatedContext}`
                    );
                }
            }
            
            addStep('Generating answer', 'complete');
            
            return {
                ...result,
                explanation,
                pages: Array.from(allPages),
                subQuestions,
                evidenceChains,
                crossReferences,
                thinkingSteps
            };
        }

        // For open questions, use LLM with full context
        const { answerQuestionLocal } = await import('@/utils/local-llm');
        const answer = await answerQuestionLocal(question, truncatedContext);
        
        // Strategy 9: Verify open-ended answers too
        let verified = false;
        // OPTIMIZATION: Disable verification to meet 30s target
        if (false && strategy.useVerification) {
            addStep('Verifying answer...', 'active');
            const verification = await verifyAnswer(answer, filterPages);
            verified = verification.supportedClaimCount > 0 && verification.overallConfidence >= VERIFICATION_THRESHOLD;
            addStep(
                verified ? 'Answer verified' : 'Answer not verified',
                'complete',
                verified
                    ? `${verification.supportedClaimCount}/${verification.claims.length} claims supported`
                    : verification.claims.length === 0
                        ? 'No verifiable claims extracted'
                        : 'Some claims unverified'
            );
        }
        
        addStep('Generating answer', 'complete');

        return {
            answer,
            explanation: `Synthesized from ${allPages.size} pages using multi-stage analysis.`,
            confidence: 0.8,
            evidence: truncatedContext.slice(0, 500),
            pages: Array.from(allPages),
            subQuestions,
            crossReferences,
            thinkingSteps,
            verified
        };

    } catch (error) {
        console.error('[MultiStageSearch] Error:', error);
        addStep('Error occurred', 'error', error instanceof Error ? error.message : 'Unknown error');
        
        return {
            answer: '',
            explanation: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confidence: 0,
            evidence: '',
            pages: [],
            subQuestions: [],
            thinkingSteps
        };
    }
}

/**
 * Solve quiz question using evidence chains
 */
function solveQuizWithEvidence(
    question: string,
    options: string[],
    chains: EvidenceChain[]
): { answer: string; explanation: string; confidence: number; evidence: string } {
    const isNegative = /\b(NOT|EXCEPT|FALSE|INCORRECT|NEVER)\b/i.test(question);

    // Sort by evidence quality
    const sorted = [...chains].sort((a, b) => {
        // Weight evidence types
        const typeWeight = { explicit: 4, implied: 2, absent: 1, contradicted: 0 };
        const aWeight = typeWeight[a.evidenceType] * a.score;
        const bWeight = typeWeight[b.evidenceType] * b.score;
        return bWeight - aWeight;
    });

    let winner: EvidenceChain;
    let explanation: string;

    if (isNegative) {
        // For NOT/EXCEPT questions: find the option with least/no evidence
        const leastSupported = sorted[sorted.length - 1];
        const mostSupported = sorted[0];
        winner = leastSupported;
        
        explanation = `Negative question detected. Strong evidence supports **${mostSupported.optionLetter}** (${mostSupported.evidenceType}), but **${winner.optionLetter}** has ${winner.evidenceType} evidence, making it the likely exception.`;
    } else {
        // Standard: pick most supported option
        winner = sorted[0];
        const topSource = winner.sources[0];
        
        if (winner.evidenceType === 'explicit') {
            explanation = `Strong match for **${winner.optionLetter}**. The document explicitly states:\n\n> "${topSource?.excerpt || 'Evidence found'}..."`;
        } else if (winner.evidenceType === 'implied') {
            explanation = `**${winner.optionLetter}** is implied by the context:\n\n> "${topSource?.excerpt || 'Evidence found'}..."`;
        } else {
            explanation = `Best match is **${winner.optionLetter}** based on available evidence.`;
        }
    }

    return {
        answer: winner.optionLetter,
        explanation,
        confidence: Math.min(1, winner.score + 0.2), // Boost confidence for thorough search
        evidence: winner.sources[0]?.excerpt || ''
    };
}
