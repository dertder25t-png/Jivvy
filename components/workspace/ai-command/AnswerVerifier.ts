/**
 * AnswerVerifier - Strategy 9
 * 
 * Two-pass answer verification:
 * 1. First pass: Generate initial answer
 * 2. Extract key claims from answer
 * 3. Search PDF for each claim
 * 4. Flag unsupported claims
 * 5. Optionally regenerate with stricter prompt
 */

import { pdfWorker } from '@/utils/pdf-extraction';
import { scoreCandidate } from '@/utils/search/scoring';
import { buildSparseVector, cosineSimilarity } from '@/utils/search/semantic';

export interface Claim {
    id: string;
    text: string;
    isSupported: boolean;
    confidence: number;
    supportingEvidence: string | null;
    supportingPage: number | null;
}

export interface VerificationResult {
    originalAnswer: string;
    claims: Claim[];
    overallConfidence: number;
    supportedClaimCount: number;
    unsupportedClaims: string[];
    verificationSummary: string;
    shouldRegenerate: boolean;
}

export interface RegenerationContext {
    stricterPrompt: string;
    onlySupportedClaims: string[];
    unsupportedWarnings: string[];
}

// Thresholds
const CLAIM_SUPPORT_THRESHOLD = 0.4;  // Minimum score to consider claim supported
const REGENERATE_THRESHOLD = 0.5;     // If overall confidence below this, suggest regeneration
const MIN_CLAIM_LENGTH = 10;          // Minimum characters for a claim

/**
 * Extract claims from an answer text
 */
export function extractClaims(answer: string): string[] {
    // Split by sentences
    const sentences = answer
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length >= MIN_CLAIM_LENGTH);
    
    // Filter out conversational/meta sentences
    const filterPatterns = [
        /^(?:I|we|you|the document|this|that)\s+(?:think|believe|assume|suggest|recommend)/i,
        /^(?:based on|according to|it seems|appears to|might|may|could|should|would)/i,
        /^(?:however|therefore|thus|hence|so|but|and|or|also|additionally)/i,
        /^(?:in conclusion|to summarize|in summary|overall|finally)/i
    ];
    
    return sentences.filter(sentence => {
        // Keep factual-looking claims
        return !filterPatterns.some(p => p.test(sentence));
    });
}

/**
 * Verify a single claim against PDF content
 */
export async function verifyClaim(
    claim: string,
    filterPages?: Set<number>
): Promise<Claim> {
    const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // Search for supporting evidence
    const candidates = await pdfWorker.searchCandidates(claim, filterPages);
    
    if (candidates.length === 0) {
        return {
            id: claimId,
            text: claim,
            isSupported: false,
            confidence: 0,
            supportingEvidence: null,
            supportingPage: null
        };
    }
    
    // Score candidates against the claim
    const claimVector = buildSparseVector(claim);
    let bestScore = 0;
    let bestEvidence = '';
    let bestPage = 0;
    
    for (const candidate of candidates) {
        const detailResult = scoreCandidate(candidate.text, claim);
        const candidateVector = buildSparseVector(candidate.text);
        const semantic = cosineSimilarity(claimVector, candidateVector);
        
        const combined = (detailResult.score / 100) * 0.5 + semantic * 0.5;
        
        if (combined > bestScore) {
            bestScore = combined;
            bestEvidence = detailResult.excerpt || candidate.text.slice(0, 200);
            bestPage = candidate.page;
        }
    }
    
    return {
        id: claimId,
        text: claim,
        isSupported: bestScore >= CLAIM_SUPPORT_THRESHOLD,
        confidence: bestScore,
        supportingEvidence: bestScore >= CLAIM_SUPPORT_THRESHOLD ? bestEvidence : null,
        supportingPage: bestScore >= CLAIM_SUPPORT_THRESHOLD ? bestPage : null
    };
}

/**
 * Verify all claims in an answer
 */
export async function verifyAnswer(
    answer: string,
    filterPages?: Set<number>
): Promise<VerificationResult> {
    const claimTexts = extractClaims(answer);
    
    if (claimTexts.length === 0) {
        return {
            originalAnswer: answer,
            claims: [],
            // No claims extracted means we did not actually verify anything.
            // Keep confidence at 0 so callers/UI can avoid marking it as verified.
            overallConfidence: 0,
            supportedClaimCount: 0,
            unsupportedClaims: [],
            verificationSummary: 'No verifiable claims found in answer.',
            shouldRegenerate: false
        };
    }
    
    // Verify each claim
    const claims: Claim[] = [];
    for (const claimText of claimTexts) {
        const verified = await verifyClaim(claimText, filterPages);
        claims.push(verified);
    }
    
    // Calculate statistics
    const supportedClaims = claims.filter(c => c.isSupported);
    const unsupportedClaims = claims.filter(c => !c.isSupported).map(c => c.text);
    const overallConfidence = claims.length > 0
        ? supportedClaims.length / claims.length
        : 0;
    
    // Build summary
    const summary = buildVerificationSummary(claims, overallConfidence);
    
    return {
        originalAnswer: answer,
        claims,
        overallConfidence,
        supportedClaimCount: supportedClaims.length,
        unsupportedClaims,
        verificationSummary: summary,
        shouldRegenerate: overallConfidence < REGENERATE_THRESHOLD && unsupportedClaims.length > 0
    };
}

/**
 * Verify a multiple-choice (quiz) selection.
 *
 * Unlike open-ended answers, a quiz answer is often just a letter ("A").
 * Verifying that string is meaningless, so we verify the selected option text
 * (and a combined question+option query) against the PDF.
 */
export async function verifyQuizAnswerSelection(
    params: {
        question: string;
        selectedLetter: string;
        selectedOptionText: string;
        filterPages?: Set<number>;
    }
): Promise<VerificationResult> {
    const { question, selectedLetter, selectedOptionText, filterPages } = params;

    const queries = [
        selectedOptionText,
        `${question} ${selectedOptionText}`.trim()
    ].filter(q => q.trim().length > 0);

    // Pick the best-scoring claim verification among the queries.
    let best: Claim | null = null;
    for (const query of queries) {
        // Skip ultra-short queries that tend to match noise.
        if (query.trim().length < MIN_CLAIM_LENGTH) continue;
        const verified = await verifyClaim(query, filterPages);
        if (!best || verified.confidence > best.confidence) {
            best = verified;
        }
    }

    if (!best) {
        return {
            originalAnswer: selectedLetter,
            claims: [],
            overallConfidence: 0,
            supportedClaimCount: 0,
            unsupportedClaims: [selectedOptionText],
            verificationSummary: 'No verifiable option text found for quiz answer.',
            shouldRegenerate: true
        };
    }

    const supported = best.isSupported;
    const supportedClaimCount = supported ? 1 : 0;

    const summary = supported
        ? `**Verification Results:** Supported (p.${best.supportingPage})\n- 1/1 selected option supported by document`
        : `**Verification Results:** Not supported\n- 0/1 selected option supported by document`;

    return {
        originalAnswer: selectedLetter,
        claims: [
            {
                ...best,
                text: selectedOptionText
            }
        ],
        // For quiz verification, use the best match confidence directly.
        overallConfidence: best.confidence,
        supportedClaimCount,
        unsupportedClaims: supported ? [] : [selectedOptionText],
        verificationSummary: summary,
        shouldRegenerate: !supported
    };
}

/**
 * Build human-readable verification summary
 */
function buildVerificationSummary(claims: Claim[], confidence: number): string {
    const supported = claims.filter(c => c.isSupported);
    const unsupported = claims.filter(c => !c.isSupported);
    
    const lines: string[] = [];
    
    lines.push(`**Verification Results:** ${(confidence * 100).toFixed(0)}% confidence`);
    lines.push(`- ${supported.length}/${claims.length} claims supported by document`);
    
    if (unsupported.length > 0) {
        lines.push(`\n**⚠ Unsupported claims:**`);
        unsupported.forEach((claim, i) => {
            lines.push(`${i + 1}. "${claim.text.slice(0, 80)}..."`);
        });
    }
    
    if (supported.length > 0) {
        lines.push(`\n**✓ Supported claims:**`);
        supported.slice(0, 3).forEach((claim, i) => {
            lines.push(`${i + 1}. "${claim.text.slice(0, 60)}..." (p.${claim.supportingPage})`);
        });
    }
    
    return lines.join('\n');
}

/**
 * Build context for regeneration with stricter grounding
 */
export function buildRegenerationContext(
    verification: VerificationResult,
    originalQuestion: string
): RegenerationContext {
    const supported = verification.claims.filter(c => c.isSupported);
    
    const stricterPrompt = `Answer the following question based ONLY on the provided text. Do not include any information that is not explicitly stated.

Question: ${originalQuestion}

Rules:
- Only make claims that are directly supported by the text
- If information is not in the text, say "The document does not specify..."
- Do not infer or extrapolate beyond what is stated
- Cite page numbers when possible`;
    
    const onlySupportedClaims = supported.map(c => c.text);
    
    const unsupportedWarnings = verification.unsupportedClaims.map(
        claim => `This claim could not be verified: "${claim.slice(0, 50)}..."`
    );
    
    return {
        stricterPrompt,
        onlySupportedClaims,
        unsupportedWarnings
    };
}

/**
 * Format answer with verification indicators
 */
export function formatVerifiedAnswer(
    answer: string,
    verification: VerificationResult
): string {
    let formatted = answer;
    
    // Add verification badge
    const badge = verification.overallConfidence >= 0.7
        ? '✓ Verified'
        : verification.overallConfidence >= 0.4
        ? '~ Partially Verified'
        : '⚠ Needs Review';
    
    formatted = `${badge} (${(verification.overallConfidence * 100).toFixed(0)}% supported)\n\n${formatted}`;
    
    // Add warning if low confidence
    if (verification.shouldRegenerate) {
        formatted += `\n\n---\n⚠ *Some claims could not be verified against the document.*`;
    }
    
    return formatted;
}

/**
 * Quick check if answer needs verification
 * (Skip for very short or clearly uncertain answers)
 */
export function needsVerification(answer: string): boolean {
    // Skip if answer is too short
    if (answer.length < 50) return false;
    
    // Skip if answer already indicates uncertainty
    const uncertaintyPatterns = [
        /I (?:don't|do not|cannot|can't) (?:know|find|determine)/i,
        /(?:not|no) (?:information|evidence|mention)/i,
        /(?:unclear|uncertain|unknown|unspecified)/i
    ];
    
    return !uncertaintyPatterns.some(p => p.test(answer));
}

/**
 * Get confidence label for display
 */
export function getVerificationLabel(confidence: number): {
    label: string;
    color: string;
    icon: string;
} {
    if (confidence >= 0.8) {
        return { label: 'Highly Verified', color: 'green', icon: '✓✓' };
    }
    if (confidence >= 0.6) {
        return { label: 'Verified', color: 'lime', icon: '✓' };
    }
    if (confidence >= 0.4) {
        return { label: 'Partially Verified', color: 'yellow', icon: '~' };
    }
    if (confidence >= 0.2) {
        return { label: 'Low Confidence', color: 'orange', icon: '?' };
    }
    return { label: 'Unverified', color: 'red', icon: '⚠' };
}
