/**
 * FullPageContext - Strategy 6
 * 
 * Expands context by grabbing 2-3 pages before and after matches.
 * Provides full page text retrieval for comprehensive context assembly.
 */

import { pdfWorker } from '@/utils/pdf-extraction';
import type { SearchCandidate } from '@/utils/search/types';

export interface ExpandedContext {
    primaryPages: number[];
    expandedPages: number[];
    pageTexts: Map<number, string>;
    totalCharacters: number;
    assembledContext: string;
}

export interface PageRange {
    start: number;
    end: number;
}

// Configuration
const DEFAULT_EXPANSION_RANGE = 2; // Pages before and after
const MAX_EXPANSION_RANGE = 3;
const MAX_TOTAL_PAGES = 10;
const MAX_CHARS_PER_PAGE = 4000; // Truncate very long pages

/**
 * Expand context around candidate matches
 */
export async function expandContext(
    candidates: SearchCandidate[],
    totalPages: number,
    expansionRange: number = DEFAULT_EXPANSION_RANGE
): Promise<ExpandedContext> {
    // Get primary pages from candidates
    const primaryPages = Array.from(new Set(candidates.map(c => c.page))).sort((a, b) => a - b);
    
    // Calculate expanded page set
    const expandedPages = calculateExpandedPages(
        primaryPages,
        totalPages,
        expansionRange
    );
    
    // Fetch all page texts
    const pageTexts = new Map<number, string>();
    
    for (const page of expandedPages) {
        const text = await pdfWorker.getPageText(page);
        if (text) {
            pageTexts.set(page, truncatePageText(text, MAX_CHARS_PER_PAGE));
        }
    }
    
    // Assemble context with page markers
    const assembledContext = assemblePageContext(pageTexts, primaryPages);
    
    return {
        primaryPages,
        expandedPages,
        pageTexts,
        totalCharacters: assembledContext.length,
        assembledContext
    };
}

/**
 * Calculate which pages to include in expanded context
 */
function calculateExpandedPages(
    primaryPages: number[],
    totalPages: number,
    expansionRange: number
): number[] {
    const expandedSet = new Set<number>();
    const effectiveRange = Math.min(expansionRange, MAX_EXPANSION_RANGE);
    
    for (const page of primaryPages) {
        // Add pages before
        for (let i = page - effectiveRange; i < page; i++) {
            if (i >= 1) expandedSet.add(i);
        }
        
        // Add primary page
        expandedSet.add(page);
        
        // Add pages after
        for (let i = page + 1; i <= page + effectiveRange; i++) {
            if (i <= totalPages) expandedSet.add(i);
        }
    }
    
    // Sort and limit to MAX_TOTAL_PAGES
    const sorted = Array.from(expandedSet).sort((a, b) => a - b);
    return sorted.slice(0, MAX_TOTAL_PAGES);
}

/**
 * Assemble page texts into a single context string with markers
 */
function assemblePageContext(
    pageTexts: Map<number, string>,
    primaryPages: number[]
): string {
    const primarySet = new Set(primaryPages);
    const sections: string[] = [];
    
    // Sort pages
    const sortedPages = Array.from(pageTexts.keys()).sort((a, b) => a - b);
    
    for (const page of sortedPages) {
        const text = pageTexts.get(page);
        if (!text) continue;
        
        const isPrimary = primarySet.has(page);
        const marker = isPrimary ? '★' : '○';
        
        sections.push(`\n=== Page ${page} ${marker} ===\n${text}`);
    }
    
    return sections.join('\n\n');
}

/**
 * Get full page text with smart truncation
 */
export async function getFullPageText(page: number): Promise<string | null> {
    const text = await pdfWorker.getPageText(page);
    return text ? truncatePageText(text, MAX_CHARS_PER_PAGE) : null;
}

/**
 * Get adjacent pages for a given page
 */
export async function getAdjacentPages(
    page: number,
    totalPages: number,
    range: number = 1
): Promise<Map<number, string>> {
    const pageTexts = new Map<number, string>();
    
    for (let p = Math.max(1, page - range); p <= Math.min(totalPages, page + range); p++) {
        const text = await pdfWorker.getPageText(p);
        if (text) {
            pageTexts.set(p, truncatePageText(text, MAX_CHARS_PER_PAGE));
        }
    }
    
    return pageTexts;
}

/**
 * Merge multiple page ranges into contiguous blocks
 */
export function mergePageRanges(ranges: PageRange[]): PageRange[] {
    if (ranges.length === 0) return [];
    
    // Sort by start page
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: PageRange[] = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        
        // If overlapping or adjacent, merge
        if (next.start <= current.end + 1) {
            current.end = Math.max(current.end, next.end);
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    
    merged.push(current);
    return merged;
}

/**
 * Truncate page text at sentence boundary if possible
 */
function truncatePageText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    
    const truncated = text.slice(0, maxChars);
    
    // Try to cut at sentence boundary
    const lastPeriod = truncated.lastIndexOf('. ');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const cutPoint = Math.max(lastPeriod, lastNewline);
    
    if (cutPoint > maxChars * 0.7) {
        return truncated.slice(0, cutPoint + 1) + '...';
    }
    
    return truncated + '...';
}

/**
 * Build multi-source context from candidates with full page expansion
 * Strategy 1: Multi-stage context assembly
 */
export async function assembleMultiSourceContext(
    candidates: SearchCandidate[],
    totalPages: number,
    maxChars: number = 15000
): Promise<{
    context: string;
    pages: number[];
    sourceCounts: { primary: number; expanded: number };
}> {
    // Expand context around candidates
    const expanded = await expandContext(candidates, totalPages, 2);
    
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
    
    // Need to be more selective - prioritize primary pages
    const priorityContext = await buildPriorityContext(
        expanded.primaryPages,
        expanded.pageTexts,
        maxChars
    );
    
    return {
        context: priorityContext.context,
        pages: priorityContext.pages,
        sourceCounts: {
            primary: expanded.primaryPages.length,
            expanded: priorityContext.pages.length
        }
    };
}

/**
 * Build context prioritizing primary pages
 */
async function buildPriorityContext(
    primaryPages: number[],
    pageTexts: Map<number, string>,
    maxChars: number
): Promise<{ context: string; pages: number[] }> {
    const sections: string[] = [];
    const includedPages: number[] = [];
    let currentLength = 0;
    
    // First, add all primary pages
    for (const page of primaryPages) {
        const text = pageTexts.get(page);
        if (!text) continue;
        
        const section = `\n=== Page ${page} ★ ===\n${text}`;
        if (currentLength + section.length <= maxChars) {
            sections.push(section);
            includedPages.push(page);
            currentLength += section.length;
        }
    }
    
    // Then add adjacent pages if space allows
    const adjacentPages = Array.from(pageTexts.keys())
        .filter(p => !primaryPages.includes(p))
        .sort((a, b) => {
            // Sort by distance to nearest primary page
            const distA = Math.min(...primaryPages.map(pp => Math.abs(pp - a)));
            const distB = Math.min(...primaryPages.map(pp => Math.abs(pp - b)));
            return distA - distB;
        });
    
    for (const page of adjacentPages) {
        const text = pageTexts.get(page);
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
        pages: includedPages.sort((a, b) => a - b)
    };
}
