/**
 * CrossReferenceResolver - Strategy 8
 * 
 * Scans text for cross-references like "see Chapter X", "refer to Figure Y",
 * "as discussed in Section N" and automatically fetches the referenced content.
 */

import { pdfWorker } from '@/utils/pdf-extraction';

export interface CrossReference {
    type: 'chapter' | 'section' | 'figure' | 'table' | 'page' | 'appendix' | 'equation';
    identifier: string;
    originalText: string;
    resolvedPage: number | null;
    resolvedContent: string | null;
}

export interface ResolvedContext {
    originalText: string;
    references: CrossReference[];
    expandedContent: string;
    totalReferences: number;
    resolvedCount: number;
}

// Patterns to detect cross-references
const REFERENCE_PATTERNS: { type: CrossReference['type']; pattern: RegExp }[] = [
    // Chapter references
    { type: 'chapter', pattern: /(?:see|refer\s+to|in)\s+chapter\s+(\d+)/gi },
    { type: 'chapter', pattern: /chapter\s+(\d+)\s+(?:discusses?|describes?|explains?)/gi },
    
    // Section references
    { type: 'section', pattern: /(?:see|refer\s+to|in)\s+section\s+([\d.]+)/gi },
    { type: 'section', pattern: /(?:as\s+)?(?:discussed|described|explained|mentioned)\s+in\s+section\s+([\d.]+)/gi },
    
    // Figure references
    { type: 'figure', pattern: /(?:see|refer\s+to)\s+(?:figure|fig\.?)\s+([\d.-]+)/gi },
    { type: 'figure', pattern: /(?:as\s+)?(?:shown|illustrated|depicted)\s+in\s+(?:figure|fig\.?)\s+([\d.-]+)/gi },
    
    // Table references
    { type: 'table', pattern: /(?:see|refer\s+to)\s+table\s+([\d.-]+)/gi },
    { type: 'table', pattern: /(?:as\s+)?(?:shown|listed)\s+in\s+table\s+([\d.-]+)/gi },
    
    // Page references
    { type: 'page', pattern: /(?:see|on)\s+page\s+(\d+)/gi },
    { type: 'page', pattern: /\(p\.?\s*(\d+)\)/gi },
    
    // Appendix references
    { type: 'appendix', pattern: /(?:see|refer\s+to)\s+appendix\s+([A-Z\d]+)/gi },
    
    // Equation references
    { type: 'equation', pattern: /(?:see|using)\s+equation\s+([\d.-]+)/gi },
    { type: 'equation', pattern: /(?:eq\.?|equation)\s*\(?([\d.-]+)\)?/gi }
];

/**
 * Scan text for cross-references
 */
export function scanForReferences(text: string): CrossReference[] {
    const references: CrossReference[] = [];
    const seen = new Set<string>(); // Avoid duplicates
    
    for (const { type, pattern } of REFERENCE_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const identifier = match[1];
            const key = `${type}-${identifier}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                references.push({
                    type,
                    identifier,
                    originalText: match[0],
                    resolvedPage: null,
                    resolvedContent: null
                });
            }
        }
    }
    
    return references;
}

/**
 * Resolve cross-references by fetching their content
 */
export async function resolveReferences(
    references: CrossReference[],
    totalPages: number
): Promise<CrossReference[]> {
    const resolved: CrossReference[] = [];
    
    for (const ref of references) {
        const resolvedRef = await resolveReference(ref, totalPages);
        resolved.push(resolvedRef);
    }
    
    return resolved;
}

/**
 * Resolve a single cross-reference
 */
async function resolveReference(
    ref: CrossReference,
    totalPages: number
): Promise<CrossReference> {
    let resolvedPage: number | null = null;
    let resolvedContent: string | null = null;
    
    switch (ref.type) {
        case 'page':
            // Direct page reference
            resolvedPage = parseInt(ref.identifier, 10);
            if (resolvedPage >= 1 && resolvedPage <= totalPages) {
                resolvedContent = await pdfWorker.getPageText(resolvedPage);
            }
            break;
            
        case 'chapter':
        case 'section':
            // Search for chapter/section header
            resolvedPage = await findSectionPage(ref.type, ref.identifier, totalPages);
            if (resolvedPage) {
                resolvedContent = await pdfWorker.getPageText(resolvedPage);
            }
            break;
            
        case 'figure':
        case 'table':
        case 'equation':
            // Search for figure/table/equation caption
            resolvedPage = await findCaptionPage(ref.type, ref.identifier, totalPages);
            if (resolvedPage) {
                resolvedContent = await pdfWorker.getPageText(resolvedPage);
            }
            break;
            
        case 'appendix':
            // Search for appendix header
            resolvedPage = await findAppendixPage(ref.identifier, totalPages);
            if (resolvedPage) {
                resolvedContent = await pdfWorker.getPageText(resolvedPage);
            }
            break;
    }
    
    return {
        ...ref,
        resolvedPage,
        resolvedContent: resolvedContent ? truncateContent(resolvedContent, 2000) : null
    };
}

/**
 * Find page containing a chapter or section header
 */
async function findSectionPage(
    type: 'chapter' | 'section',
    identifier: string,
    totalPages: number
): Promise<number | null> {
    const pattern = type === 'chapter'
        ? new RegExp(`chapter\\s*${identifier}\\b`, 'i')
        : new RegExp(`section\\s*${identifier}\\b`, 'i');
    
    // Search through pages (could be optimized with outline/index)
    for (let page = 1; page <= Math.min(totalPages, 50); page++) {
        const text = await pdfWorker.getPageText(page);
        if (text && pattern.test(text)) {
            return page;
        }
    }
    
    return null;
}

/**
 * Find page containing a figure, table, or equation caption
 */
async function findCaptionPage(
    type: 'figure' | 'table' | 'equation',
    identifier: string,
    totalPages: number
): Promise<number | null> {
    const patterns: Record<string, RegExp> = {
        figure: new RegExp(`(?:figure|fig\\.?)\\s*${identifier}\\b`, 'i'),
        table: new RegExp(`table\\s*${identifier}\\b`, 'i'),
        equation: new RegExp(`(?:equation|eq\\.?)\\s*${identifier}\\b`, 'i')
    };
    
    const pattern = patterns[type];
    
    for (let page = 1; page <= totalPages; page++) {
        const text = await pdfWorker.getPageText(page);
        if (text && pattern.test(text)) {
            return page;
        }
    }
    
    return null;
}

/**
 * Find page containing an appendix
 */
async function findAppendixPage(
    identifier: string,
    totalPages: number
): Promise<number | null> {
    const pattern = new RegExp(`appendix\\s*${identifier}\\b`, 'i');
    
    // Search from the end (appendices usually at back)
    for (let page = totalPages; page >= Math.max(1, totalPages - 30); page--) {
        const text = await pdfWorker.getPageText(page);
        if (text && pattern.test(text)) {
            return page;
        }
    }
    
    return null;
}

/**
 * Truncate content to max length at sentence boundary
 */
function truncateContent(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf('. ');
    
    if (lastSentence > maxLength * 0.6) {
        return truncated.slice(0, lastSentence + 1) + '...';
    }
    
    return truncated + '...';
}

/**
 * Expand context with resolved cross-references
 */
export async function expandWithCrossReferences(
    text: string,
    totalPages: number,
    maxReferences: number = 3
): Promise<ResolvedContext> {
    const references = scanForReferences(text);
    
    // Limit number of references to resolve (performance)
    const toResolve = references.slice(0, maxReferences);
    const resolved = await resolveReferences(toResolve, totalPages);
    
    // Build expanded content
    const expandedSections: string[] = [text];
    let resolvedCount = 0;
    
    for (const ref of resolved) {
        if (ref.resolvedContent) {
            resolvedCount++;
            expandedSections.push(
                `\n--- Referenced ${ref.type} ${ref.identifier} (Page ${ref.resolvedPage}) ---\n${ref.resolvedContent}`
            );
        }
    }
    
    return {
        originalText: text,
        references: resolved,
        expandedContent: expandedSections.join('\n'),
        totalReferences: references.length,
        resolvedCount
    };
}

/**
 * Get summary of cross-references found
 */
export function getReferenceSummary(references: CrossReference[]): string {
    if (references.length === 0) return 'No cross-references found.';
    
    const byType = new Map<string, string[]>();
    
    for (const ref of references) {
        const list = byType.get(ref.type) || [];
        list.push(ref.identifier);
        byType.set(ref.type, list);
    }
    
    const parts: string[] = [];
    for (const [type, ids] of Array.from(byType)) {
        parts.push(`${type}s: ${ids.join(', ')}`);
    }
    
    return parts.join(' | ');
}

/**
 * Check if text contains any cross-references
 */
export function hasCrossReferences(text: string): boolean {
    return REFERENCE_PATTERNS.some(({ pattern }) => {
        pattern.lastIndex = 0;
        return pattern.test(text);
    });
}
