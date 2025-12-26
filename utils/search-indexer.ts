export class SearchIndexer {
    private index: Map<string, Set<number>>; // word -> Set<pageIndex>
    private pageText: Map<number, string>;   // pageIndex -> raw text (for snippets)
    private subjectPages: Set<number>;       // Pages identified as subject-relevant

    constructor() {
        this.index = new Map();
        this.pageText = new Map();
        this.subjectPages = new Set();
    }

    clear() {
        this.index = new Map();
        this.pageText = new Map();
        this.subjectPages = new Set();
    }

    /**
     * Add a page to the index
     */
    addPage(pageIndex: number, text: string) {
        // Store raw text for snippet extraction
        this.pageText.set(pageIndex, text);

        // Tokenize
        const tokens = this.tokenize(text);

        // Update Inverted Index
        tokens.forEach(token => {
            if (!this.index.has(token)) {
                this.index.set(token, new Set());
            }
            this.index.get(token)!.add(pageIndex);
        });
    }

    /**
     * Get raw text for a page
     */
    getPageText(pageIndex: number): string | null {
        return this.pageText.get(pageIndex) || null;
    }

    /**
     * Mark pages as high priority based on subject scouting
     */
    setSubjectPages(pages: number[]) {
        this.subjectPages = new Set(pages);
    }

    /**
     * Search for query terms
     * Returns pages with score, snippets
     */
    search(query: string): SearchResult[] {
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return [];

        const pageScores = new Map<number, number>();

        // Calculate Scores (TF-like approach)
        tokens.forEach(token => {
            const pages = this.index.get(token);
            if (pages) {
                pages.forEach(pageIndex => {
                    const currentScore = pageScores.get(pageIndex) || 0;
                    pageScores.set(pageIndex, currentScore + 1);
                });
            }
        });

        // Apply Boosts and Format Results
        const results: SearchResult[] = [];

        pageScores.forEach((score, pageIndex) => {
            let finalScore = score;

            // 2x Boost for Subject Pages
            if (this.subjectPages.has(pageIndex)) {
                finalScore *= 2;
            }

            // Get Snippet
            const text = this.pageText.get(pageIndex) || "";
            const snippet = this.getSnippet(text, tokens);

            results.push({
                page: pageIndex,
                score: finalScore,
                snippet,
                matchCount: score // Raw matches
            });
        });

        // Sort by Score desc
        return results.sort((a, b) => b.score - a.score);
    }

    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .split(/[^a-z0-9]+/g) // Split by non-alphanumeric
            .filter(t => t.length > 2) // Filter short words
            .filter(t => !this.isStopWord(t));
    }

    private isStopWord(word: string): boolean {
        const stops = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'that', 'this']);
        return stops.has(word);
    }

    private getSnippet(text: string, queryTokens: string[]): string {
        // Simple snippet extraction: find first occurrence of a token
        const lowerText = text.toLowerCase();
        let bestIndex = -1;

        for (const token of queryTokens) {
            const idx = lowerText.indexOf(token);
            if (idx !== -1) {
                bestIndex = idx;
                break;
            }
        }

        if (bestIndex === -1) return text.substring(0, 100) + "...";

        const start = Math.max(0, bestIndex - 40);
        const end = Math.min(text.length, bestIndex + 100);
        return (start > 0 ? "..." : "") + text.substring(start, end) + (end < text.length ? "..." : "");
    }
}

export interface SearchResult {
    page: number;
    score: number;
    snippet: string;
    matchCount: number;
}
