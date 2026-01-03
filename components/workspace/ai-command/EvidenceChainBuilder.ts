/**
 * EvidenceChainBuilder - Strategy 5
 * 
 * For each answer option, finds candidates and classifies evidence as:
 * - explicit (direct statement)
 * - implied (indirect support)
 * - absent (not mentioned)
 * - contradicted (document says otherwise)
 * 
 * Calculates weighted confidence and builds evidence chains for LLM transparency.
 */

import { pdfWorker } from '@/utils/pdf-extraction';
import { scoreCandidate } from '@/utils/search/scoring';
import { buildSparseVector, cosineSimilarity } from '@/utils/search/semantic';
import type { SearchCandidate } from '@/utils/search/types';

export type EvidenceType = 'explicit' | 'implied' | 'absent' | 'contradicted';

export interface EvidenceLink {
    text: string;
    page: number;
    chunkId: string;
    relevanceScore: number;
    type: EvidenceType;
    matchedTerms: string[];
}

export interface EvidenceChain {
    optionLetter: string;
    optionText: string;
    links: EvidenceLink[];
    overallType: EvidenceType;
    weightedConfidence: number;
    summary: string;
}

export interface EvidenceChainResult {
    chains: EvidenceChain[];
    bestOption: string;
    bestConfidence: number;
    contextForLLM: string;
}

// Evidence type weights for confidence calculation
const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
    explicit: 1.0,
    implied: 0.6,
    absent: 0.3,
    contradicted: 0.0
};

// Thresholds for evidence classification
const EXPLICIT_THRESHOLD = 0.7;
const IMPLIED_THRESHOLD = 0.4;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CONTRADICTION_THRESHOLD = 0.5;

/**
 * Build evidence chains for all answer options
 */
export async function buildEvidenceChains(
    question: string,
    options: string[],
    filterPages?: Set<number>
): Promise<EvidenceChainResult> {
    const chains: EvidenceChain[] = [];
    
    // Get all candidates once for efficiency
    const allCandidates = await pdfWorker.searchCandidates(question, filterPages);
    
    // Build chain for each option
    for (let i = 0; i < options.length; i++) {
        const letter = String.fromCharCode(65 + i);
        const chain = await buildChainForOption(
            question,
            options[i],
            letter,
            allCandidates,
            filterPages
        );
        chains.push(chain);
    }
    
    // Find best option
    const sortedChains = [...chains].sort((a, b) => b.weightedConfidence - a.weightedConfidence);
    const best = sortedChains[0];
    
    // Build context string for LLM
    const contextForLLM = buildLLMContext(question, chains);
    
    return {
        chains,
        bestOption: best.optionLetter,
        bestConfidence: best.weightedConfidence,
        contextForLLM
    };
}

/**
 * Build evidence chain for a single option
 */
async function buildChainForOption(
    question: string,
    optionText: string,
    letter: string,
    baseCandidates: SearchCandidate[],
    filterPages?: Set<number>
): Promise<EvidenceChain> {
    // Also search specifically for this option
    const optionCandidates = await pdfWorker.searchCandidates(
        `${optionText}`,
        filterPages
    );
    
    // Merge and dedupe candidates
    const candidateMap = new Map<string, SearchCandidate>();
    for (const c of [...baseCandidates, ...optionCandidates]) {
        if (!candidateMap.has(c.chunkId) || c.score > candidateMap.get(c.chunkId)!.score) {
            candidateMap.set(c.chunkId, c);
        }
    }
    
    const combinedQuery = `${question} ${optionText}`;
    const queryVector = buildSparseVector(combinedQuery);
    const optionTerms = optionText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    const links: EvidenceLink[] = [];
    
    for (const candidate of Array.from(candidateMap.values())) {
        const candidateVector = buildSparseVector(candidate.text);
        const semantic = cosineSimilarity(queryVector, candidateVector);
        const detail = scoreCandidate(candidate.text, optionText);
        const relevanceScore = (detail.score / 100) * 0.5 + semantic * 0.5;
        
        // Find which terms matched
        const lowerText = candidate.text.toLowerCase();
        const matchedTerms = optionTerms.filter(term => lowerText.includes(term));
        
        // Classify evidence type
        const type = classifyEvidence(
            candidate.text,
            optionText,
            relevanceScore,
            matchedTerms.length / optionTerms.length
        );
        
        links.push({
            text: detail.excerpt || candidate.text.slice(0, 200),
            page: candidate.page,
            chunkId: candidate.chunkId,
            relevanceScore,
            type,
            matchedTerms
        });
    }
    
    // Sort links by relevance
    links.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Take top 5 links
    const topLinks = links.slice(0, 5);
    
    // Determine overall evidence type
    const overallType = determineOverallType(topLinks);
    
    // Calculate weighted confidence
    const weightedConfidence = calculateWeightedConfidence(topLinks);
    
    // Build summary
    const summary = buildChainSummary(letter, optionText, topLinks, overallType);
    
    return {
        optionLetter: letter,
        optionText,
        links: topLinks,
        overallType,
        weightedConfidence,
        summary
    };
}

/**
 * Classify evidence type based on scores and patterns
 */
function classifyEvidence(
    text: string,
    option: string,
    relevanceScore: number,
    termCoverage: number
): EvidenceType {
    // Check for contradiction patterns
    if (hasContradiction(text, option)) {
        return 'contradicted';
    }
    
    // High relevance with good term coverage = explicit
    if (relevanceScore >= EXPLICIT_THRESHOLD && termCoverage >= 0.5) {
        return 'explicit';
    }
    
    // Medium relevance = implied
    if (relevanceScore >= IMPLIED_THRESHOLD) {
        return 'implied';
    }
    
    return 'absent';
}

/**
 * Check if text contradicts the option
 */
function hasContradiction(text: string, option: string): boolean {
    const lowerText = text.toLowerCase();
    const optionTerms = option.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    
    const contradictionPatterns = [
        /not\s+(?:the\s+)?(\w+)/gi,
        /no\s+(\w+)/gi,
        /never\s+(\w+)/gi,
        /without\s+(\w+)/gi,
        /avoid(?:ing)?\s+(\w+)/gi,
        /prevent(?:ing|s)?\s+(\w+)/gi
    ];
    
    for (const pattern of contradictionPatterns) {
        const matches = lowerText.matchAll(pattern);
        for (const match of Array.from(matches)) {
            const negatedTerm = match[1]?.toLowerCase();
            if (negatedTerm && optionTerms.some(t => t.includes(negatedTerm) || negatedTerm.includes(t))) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Determine overall evidence type from links
 */
function determineOverallType(links: EvidenceLink[]): EvidenceType {
    if (links.length === 0) return 'absent';
    
    const typeCounts: Record<EvidenceType, number> = {
        explicit: 0,
        implied: 0,
        absent: 0,
        contradicted: 0
    };
    
    for (const link of links) {
        typeCounts[link.type]++;
    }
    
    // Contradicted evidence is serious
    if (typeCounts.contradicted > 0 && typeCounts.contradicted >= typeCounts.explicit) {
        return 'contradicted';
    }
    
    // Explicit wins if present
    if (typeCounts.explicit > 0) {
        return 'explicit';
    }
    
    // Implied if some evidence
    if (typeCounts.implied > 0) {
        return 'implied';
    }
    
    return 'absent';
}

/**
 * Calculate weighted confidence from evidence links
 */
function calculateWeightedConfidence(links: EvidenceLink[]): number {
    if (links.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        // Decay weight for later links
        const positionWeight = 1 / (i + 1);
        const typeWeight = EVIDENCE_WEIGHTS[link.type];
        
        weightedSum += link.relevanceScore * typeWeight * positionWeight;
        totalWeight += positionWeight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Build human-readable summary of evidence chain
 */
function buildChainSummary(
    letter: string,
    optionText: string,
    links: EvidenceLink[],
    overallType: EvidenceType
): string {
    const typeDescriptions: Record<EvidenceType, string> = {
        explicit: 'directly stated',
        implied: 'indirectly supported',
        absent: 'not found',
        contradicted: 'contradicted'
    };
    
    const lines = [`Option ${letter} (${optionText.slice(0, 50)}...): ${typeDescriptions[overallType]}`];
    
    if (links.length > 0 && overallType !== 'absent') {
        const bestLink = links[0];
        lines.push(`  Best evidence (p.${bestLink.page}): "${bestLink.text.slice(0, 80)}..."`);
    }
    
    return lines.join('\n');
}

/**
 * Build context string for LLM with evidence transparency
 */
function buildLLMContext(question: string, chains: EvidenceChain[]): string {
    const sections: string[] = [
        `Question: ${question}`,
        '',
        '## Evidence Analysis',
        ''
    ];
    
    for (const chain of chains) {
        const icon = {
            explicit: '✓',
            implied: '~',
            absent: '✗',
            contradicted: '⊘'
        }[chain.overallType];
        
        sections.push(`### ${chain.optionLetter}. ${chain.optionText}`);
        sections.push(`Evidence: ${icon} ${chain.overallType} (confidence: ${(chain.weightedConfidence * 100).toFixed(0)}%)`);
        
        if (chain.links.length > 0) {
            sections.push('');
            for (const link of chain.links.slice(0, 3)) {
                sections.push(`- [Page ${link.page}] ${link.text.slice(0, 100)}...`);
            }
        }
        sections.push('');
    }
    
    sections.push('## Recommendation');
    const best = [...chains].sort((a, b) => b.weightedConfidence - a.weightedConfidence)[0];
    sections.push(`Based on evidence analysis, **${best.optionLetter}** has the strongest support.`);
    
    return sections.join('\n');
}

/**
 * Get confidence label for display
 */
export function getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    if (confidence >= 0.3) return 'Low';
    return 'Very Low';
}
