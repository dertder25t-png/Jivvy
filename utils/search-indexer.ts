/**
 * Inverted Index Engine
 * The "Brain" of the search system.
 * Maps: "term" -> [Page 1, Page 5, Page 10]
 * 
 * Features:
 * - Bigram indexing for technical phrases ("cable lacing")
 * - TF-IDF style scoring (50pt bigram, 10pt unigram)
 * - Porter-like stemming
 * - Best-window excerpt extraction
 */

export interface SearchResult {
    page: number;
    score: number;
    matchType: 'exact' | 'phrase' | 'fuzzy';
    excerpt: string;
}

// Expanded stopword list for better indexing
const STOP_WORDS = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
    'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'from', 'into', 'during', 'before', 'after', 'above', 'below', 'between',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'about', 'over', 'through', 'out', 'up', 'down'
]);

export class InvertedIndex {
    private index: Map<string, number[]> = new Map();       // term -> pageIds
    private bigramIndex: Map<string, number[]> = new Map(); // "cable lacing" -> pageIds
    private pageText: Map<number, string> = new Map();
    private totalPages = 0;
    private subjectPages: number[] = [];

    /**
     * Legacy hook used by older miner logic; currently informational only.
     */
    public setSubjectPages(pages: number[]): void {
        this.subjectPages = Array.isArray(pages) ? pages : [];
    }

    // ==========================================
    // BUILD PHASE (Happens once on upload)
    // ==========================================

    /**
     * Clear all indexed data
     */
    public clear(): void {
        this.index.clear();
        this.bigramIndex.clear();
        this.pageText.clear();
        this.totalPages = 0;
        this.subjectPages = [];
        console.log('[InvertedIndex] Cleared');
    }

    /**
     * Add a page to the index
     * @param pageNum - 1-indexed page number
     * @param text - Raw text content of the page
     */
    public addPage(pageNum: number, text: string): void {
        // 1. Store raw text for excerpt generation
        this.pageText.set(pageNum, text);
        this.totalPages = Math.max(this.totalPages, pageNum);

        // 2. Tokenize
        const tokens = this.tokenize(text);

        // 3. Index Unigrams ("cable", "lacing")
        tokens.forEach(token => {
            if (!this.index.has(token)) this.index.set(token, []);
            const pages = this.index.get(token)!;
            // Only add if not already added for this page
            if (pages[pages.length - 1] !== pageNum) pages.push(pageNum);
        });

        // 4. Index Bigrams ("cable lacing") - CRITICAL for technical terms
        for (let i = 0; i < tokens.length - 1; i++) {
            const bigram = tokens[i] + ' ' + tokens[i + 1];
            if (!this.bigramIndex.has(bigram)) this.bigramIndex.set(bigram, []);
            const pages = this.bigramIndex.get(bigram)!;
            if (pages[pages.length - 1] !== pageNum) pages.push(pageNum);
        }
    }

    /**
     * Get raw text for a specific page
     */
    public getPageText(pageNum: number): string | null {
        return this.pageText.get(pageNum) || null;
    }

    /**
     * Get indexing statistics
     */
    public getStats(): { pages: number; terms: number; bigrams: number } {
        return {
            pages: this.totalPages,
            terms: this.index.size,
            bigrams: this.bigramIndex.size
        };
    }

    // ==========================================
    // SEARCH PHASE (Happens on every question)
    // ==========================================

    /**
     * Search the index for matching pages
     * @param query - Search query string
     * @param isNegative - If true, this is a negative logic question (NOT/EXCEPT)
     * @returns Top 5 search results sorted by score
     */
    public search(query: string, isNegative: boolean = false): SearchResult[] {
        const scores = new Map<number, number>();
        const qTokens = this.tokenize(query);
        const qBigrams: string[] = [];

        // Generate query bigrams
        for (let i = 0; i < qTokens.length - 1; i++) {
            qBigrams.push(qTokens[i] + ' ' + qTokens[i + 1]);
        }

        // 1. Score Bigrams (Higher Weight: 50pts)
        // "cable lacing" is more important than just "cable"
        qBigrams.forEach(bigram => {
            const pages = this.bigramIndex.get(bigram) || [];
            pages.forEach(p => {
                scores.set(p, (scores.get(p) || 0) + 50);
            });
        });

        // 2. Score Unigrams (Standard Weight: 10pts)
        qTokens.forEach(token => {
            const pages = this.index.get(token) || [];
            pages.forEach(p => {
                scores.set(p, (scores.get(p) || 0) + 10);
            });
        });

        // 3. Convert to Sorted Results
        const results: SearchResult[] = Array.from(scores.entries())
            .map(([page, score]): SearchResult => ({
                page,
                score,
                matchType: score >= 50 ? 'phrase' : 'fuzzy',
                excerpt: this.getExcerpt(page, qTokens)
            }))
            .sort((a, b) => b.score - a.score) // High Score -> Most Relevant
            .slice(0, 5); // Return top 5 hottest pages

        return results;
    }

    // ==========================================
    // HELPERS
    // ==========================================

    /**
     * Tokenize text into searchable terms
     * - Lowercases
     * - Removes punctuation (keeps hyphens for "tie-wrap")
     * - Filters short words and stopwords
     * - Applies stemming
     */
    private tokenize(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ') // Keep hyphens for "tie-wrap"
            .split(/\s+/)
            .filter(t => t.length > 2 && !STOP_WORDS.has(t))
            .map(t => this.stem(t));
    }

    /**
     * Simple Porter-like stemmer
     */
    private stem(word: string): string {
        if (word.length < 4) return word;

        // Remove common suffixes
        if (word.endsWith('ing') && word.length > 6) return word.slice(0, -3);
        if (word.endsWith('ies') && word.length > 5) return word.slice(0, -3) + 'y';
        if (word.endsWith('ed') && word.length > 5) return word.slice(0, -2);
        if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) return word.slice(0, -1);
        if (word.endsWith('tion')) return word.slice(0, -4) + 't';
        if (word.endsWith('ment') && word.length > 7) return word.slice(0, -4);

        return word;
    }

    /**
     * Extract a context excerpt from a page
     * Uses a sliding window to find the best match area
     */
    private getExcerpt(pageNum: number, tokens: string[]): string {
        const text = this.pageText.get(pageNum) || "";
        if (!text) return "";

        const lower = text.toLowerCase();

        // Find best window using sliding window approach
        let bestIdx = 0;
        let maxMatches = 0;
        const WINDOW_SIZE = 200;
        const STEP = 50;

        for (let i = 0; i < lower.length; i += STEP) {
            const window = lower.slice(i, i + WINDOW_SIZE);
            let matches = 0;
            tokens.forEach(t => {
                if (window.includes(t)) matches++;
            });
            if (matches > maxMatches) {
                maxMatches = matches;
                bestIdx = i;
            }
        }

        // Extract and clean the excerpt
        const excerpt = text.slice(bestIdx, bestIdx + 300).replace(/\n/g, ' ').trim();
        return excerpt ? `...${excerpt}...` : "";
    }
}

// Legacy export for backward compatibility
export { InvertedIndex as SearchIndexer };