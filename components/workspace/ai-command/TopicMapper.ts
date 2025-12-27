/**
 * TopicMapper - Strategy 3
 * 
 * Builds a topic map during PDF load by scanning for section headers,
 * detecting content types, and storing page ranges per topic.
 */

export interface TopicEntry {
    title: string;
    normalizedTitle: string;
    startPage: number;
    endPage: number;
    contentTypes: ContentType[];
    keywords: string[];
    parentTopic?: string;
    depth: number;
}

export type ContentType = 
    | 'explanation'
    | 'glossary'
    | 'table'
    | 'diagram'
    | 'procedure'
    | 'formula'
    | 'list'
    | 'example'
    | 'warning'
    | 'summary';

export interface TopicMap {
    topics: TopicEntry[];
    pageToTopics: Map<number, TopicEntry[]>;
    contentTypePages: Map<ContentType, number[]>;
    totalPages: number;
    buildTime: number;
}

// Patterns for detecting section headers
const HEADER_PATTERNS = [
    // Chapter/Section numbered headers
    /^(?:Chapter|Section|Part)\s+\d+[\.:]\s*(.+)/i,
    /^\d+(?:\.\d+)*\s+([A-Z][A-Za-z\s]+)/,
    // Roman numeral headers
    /^(?:I{1,3}|IV|V|VI{0,3}|IX|X)[\.:]\s*(.+)/i,
    // All caps headers (common in technical docs)
    /^([A-Z][A-Z\s]{3,50})$/,
    // Title case headers with colon
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*:/
];

// Patterns for detecting content types
const CONTENT_TYPE_PATTERNS: Record<ContentType, RegExp[]> = {
    explanation: [
        /\bexplain(?:s|ed|ing)?\b/i,
        /\bdescrib(?:es?|ed|ing)\b/i,
        /\bdefin(?:es?|ed|ition)\b/i,
        /\bmeans?\b.*\bis\b/i
    ],
    glossary: [
        /\bglossary\b/i,
        /\bdefinitions?\b/i,
        /\bterms?\s+(?:and\s+)?definitions?\b/i,
        /\b[A-Z][a-z]+:\s+[A-Z]/  // Term: Definition pattern
    ],
    table: [
        /\btable\s+\d+/i,
        /\|\s*\w+\s*\|/,  // Pipe-separated
        /\t\w+\t/,  // Tab-separated
        /^\s*\w+\s{2,}\w+\s{2,}\w+/m  // Space-aligned columns
    ],
    diagram: [
        /\bfigure\s+\d+/i,
        /\bdiagram\b/i,
        /\billustration\b/i,
        /\bschematic\b/i,
        /\b(?:see\s+)?fig(?:ure)?\.?\s*\d+/i
    ],
    procedure: [
        /\bstep\s+\d+/i,
        /\bprocedure\b/i,
        /^\s*\d+\.\s+[A-Z]/m,  // Numbered steps
        /\bhow\s+to\b/i,
        /\binstructions?\b/i
    ],
    formula: [
        /[=><≤≥±]\s*\d/,
        /\bequation\b/i,
        /\bformula\b/i,
        /\bcalculat(?:e|ion)\b/i,
        /[∑∏∫√πθ]/
    ],
    list: [
        /^\s*[•●○▪▫-]\s+/m,
        /^\s*[a-z]\)\s+/mi,
        /^\s*\(\d+\)\s+/m
    ],
    example: [
        /\bexample\b/i,
        /\bfor instance\b/i,
        /\be\.g\.\b/i,
        /\bsuch as\b/i
    ],
    warning: [
        /\bwarning\b/i,
        /\bcaution\b/i,
        /\bdanger\b/i,
        /\bnote:\b/i,
        /\bimportant:\b/i,
        /⚠|⛔|❗/
    ],
    summary: [
        /\bsummary\b/i,
        /\bconclusion\b/i,
        /\bkey\s+points?\b/i,
        /\btakeaways?\b/i,
        /\bin\s+summary\b/i
    ]
};

/**
 * Build a topic map from page texts
 */
export function buildTopicMap(pageTexts: Map<number, string>): TopicMap {
    const startTime = performance.now();
    const topics: TopicEntry[] = [];
    const pageToTopics = new Map<number, TopicEntry[]>();
    const contentTypePages = new Map<ContentType, number[]>();
    
    // Initialize content type pages
    for (const type of Object.keys(CONTENT_TYPE_PATTERNS) as ContentType[]) {
        contentTypePages.set(type, []);
    }
    
    let currentTopic: TopicEntry | null = null;
    const totalPages = pageTexts.size;
    
    // First pass: detect headers and create topics
    const pageEntries = Array.from(pageTexts.entries()).sort((a, b) => a[0] - b[0]);
    
    for (const [pageNum, text] of pageEntries) {
        const lines = text.split('\n').slice(0, 10); // Check first 10 lines for headers
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length < 3 || trimmed.length > 100) continue;
            
            for (const pattern of HEADER_PATTERNS) {
                const match = trimmed.match(pattern);
                if (match) {
                    // Close previous topic
                    if (currentTopic) {
                        currentTopic.endPage = pageNum - 1;
                    }
                    
                    // Create new topic
                    const title = match[1] || trimmed;
                    currentTopic = {
                        title: title.trim(),
                        normalizedTitle: normalizeTitle(title),
                        startPage: pageNum,
                        endPage: totalPages, // Will be updated when next topic starts
                        contentTypes: [],
                        keywords: extractKeywords(title),
                        depth: detectHeaderDepth(trimmed)
                    };
                    
                    topics.push(currentTopic);
                    break;
                }
            }
        }
        
        // Detect content types on this page
        const detectedTypes = detectContentTypes(text);
        for (const type of detectedTypes) {
            contentTypePages.get(type)?.push(pageNum);
        }
        
        // Update current topic's content types
        if (currentTopic) {
            for (const type of detectedTypes) {
                if (!currentTopic.contentTypes.includes(type)) {
                    currentTopic.contentTypes.push(type);
                }
            }
        }
        
        // Build page-to-topics mapping
        const topicsForPage = topics.filter(t => 
            pageNum >= t.startPage && pageNum <= t.endPage
        );
        if (topicsForPage.length > 0) {
            pageToTopics.set(pageNum, topicsForPage);
        }
    }
    
    // Close last topic
    if (currentTopic) {
        currentTopic.endPage = totalPages;
    }
    
    // Second pass: establish parent-child relationships
    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        // Find closest previous topic with lower depth
        for (let j = i - 1; j >= 0; j--) {
            if (topics[j].depth < topic.depth) {
                topic.parentTopic = topics[j].normalizedTitle;
                break;
            }
        }
    }
    
    const buildTime = performance.now() - startTime;
    
    return {
        topics,
        pageToTopics,
        contentTypePages,
        totalPages,
        buildTime
    };
}

/**
 * Detect content types present in text
 */
export function detectContentTypes(text: string): ContentType[] {
    const detected: ContentType[] = [];
    
    for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                detected.push(type as ContentType);
                break; // One match per type is enough
            }
        }
    }
    
    return detected;
}

/**
 * Find topics relevant to a query
 */
export function findRelevantTopics(
    topicMap: TopicMap,
    query: string,
    limit: number = 5
): TopicEntry[] {
    const queryTerms = normalizeTitle(query).split(/\s+/);
    
    const scored = topicMap.topics.map(topic => {
        let score = 0;
        
        // Title match
        for (const term of queryTerms) {
            if (topic.normalizedTitle.includes(term)) {
                score += 2;
            }
            // Keyword match
            if (topic.keywords.some(k => k.includes(term) || term.includes(k))) {
                score += 1;
            }
        }
        
        // Boost topics with explanation content
        if (topic.contentTypes.includes('explanation')) {
            score *= 1.3;
        }
        
        return { topic, score };
    });
    
    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.topic);
}

/**
 * Get pages containing specific content type
 */
export function getPagesWithContentType(
    topicMap: TopicMap,
    contentType: ContentType
): number[] {
    return topicMap.contentTypePages.get(contentType) || [];
}

/**
 * Get topic for a specific page
 */
export function getTopicForPage(topicMap: TopicMap, page: number): TopicEntry | null {
    const topics = topicMap.pageToTopics.get(page);
    if (!topics || topics.length === 0) return null;
    
    // Return most specific (deepest) topic
    return topics.reduce((a, b) => a.depth > b.depth ? a : b);
}

// Helper functions
function normalizeTitle(title: string): string {
    return title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractKeywords(title: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with']);
    return normalizeTitle(title)
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}

function detectHeaderDepth(text: string): number {
    // Check for numbering pattern: 1. = depth 1, 1.1 = depth 2, 1.1.1 = depth 3
    const numberMatch = text.match(/^(\d+(?:\.\d+)*)/);
    if (numberMatch) {
        return numberMatch[1].split('.').length;
    }
    
    // Check for chapter/section keywords
    if (/^chapter/i.test(text)) return 1;
    if (/^section/i.test(text)) return 2;
    if (/^part/i.test(text)) return 0;
    
    // Default based on caps
    if (/^[A-Z\s]+$/.test(text)) return 1;
    
    return 2;
}
