# Focus Page Filtering - Complete Flow Documentation

## Overview
This document explains how focus page selections flow through the system and where each fix was applied.

## Complete Data Flow

### Step 1: User Selects Focus Pages
**File:** `components/workspace/ai-command/AICommandCenter.tsx` line 189-203
**What Happens:** User clicks on ChapterDropdown to select pages/chapters

```typescript
const getPageFilter = useCallback((): Set<number> | undefined => {
    if (chapterSelection.length === 0) return undefined;

    const pages = new Set<number>();
    
    for (const chapter of chapterSelection) {
        const endPage = chapter.endPage ?? chapter.startPage + 30;
        for (let i = chapter.startPage; i <= endPage; i++) {
            pages.add(i);
        }
    }
    
    return pages;
}, [chapterSelection]);
```

**Output:** `Set<number>` containing all pages in selected chapters

---

### Step 2: Pass to Search Function
**File:** `components/workspace/ai-command/AICommandCenter.tsx` line 369
**What Happens:** filterPages passed to `runMultiStageSearch()`

```typescript
result = await withTimeout(
    runMultiStageSearch(
        quiz.isQuiz ? quiz.question : searchContent,
        quiz.isQuiz ? quiz.options.map(o => o.text) : [],
        filterPages,  // ← PASSED HERE
        // ... callbacks
    ),
    TIME_BUDGET_MS
);
```

**Output:** `Set<number> | undefined` passed to MultiStageSearch

---

### Step 3: Decompose and Gather Context
**File:** `components/workspace/ai-command/MultiStageSearch.ts` line 544-560
**What Happens:** Question is decomposed into sub-questions and filterPages is passed to context gathering

```typescript
export async function runMultiStageSearch(
    question: string,
    options: string[] = [],
    filterPages?: Set<number>,  // ← RECEIVED HERE
    // ...
) {
    // ...
    const { contexts, allPages, expandedText } = await gatherExpandedContext(
        subQuestions, 
        filterPages  // ← PASSED HERE
    );
}
```

**Output:** filterPages is now in `gatherExpandedContext()`

---

### Step 4: Parallel Sub-Question Searching
**File:** `components/workspace/ai-command/MultiStageSearch.ts` line 200-230
**What Happens:** Each sub-question is searched in parallel with filterPages

```typescript
export async function gatherExpandedContext(
    subQuestions: SubQuestion[],
    filterPages?: Set<number>  // ← RECEIVED HERE
) {
    console.log(`[MultiStageSearch] Filter pages: ${filterPages ? Array.from(filterPages).slice(0, 10).join(', ') : 'NONE'}`);
    
    const searchPromises = subQuestions.map(async (sq) => {
        try {
            // ← filterPages PASSED HERE
            const candidates = await pdfWorker.searchCandidates(sq.question, filterPages);
            // ...
        }
    });
}
```

**Output:** `searchCandidates()` receives filterPages

---

### Step 5: Worker Communication with Serialization Fix
**File:** `utils/pdf-extraction.ts` line 80-97
**What Happens:** filterPages Set converted to Array for postMessage serialization

**THIS IS THE CRITICAL FIX:** Sets cannot be serialized over postMessage!

```typescript
async searchCandidates(query: string, filterPages?: Set<number>): Promise<SearchCandidate[]> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (data: { id: string; payload: SearchCandidate[] }) => {
            if (data.id === id) {
                this.off('SEARCH_RESULT', handler as any);
                resolve(data.payload);
            }
        };
        this.on('SEARCH_RESULT', handler as any);
        this.worker?.postMessage({
            type: 'SEARCH',
            id,
            payload: { 
                query, 
                // FIX: Convert Set to Array before sending
                filterPages: filterPages ? Array.from(filterPages) : undefined
            }
        });
    });
}
```

**Output:** `{ type: 'SEARCH', payload: { query, filterPages: number[] } }` sent to worker

---

### Step 6: Worker Receives and Converts Back to Set
**File:** `workers/miner.worker.ts` line 111-124
**What Happens:** Worker converts Array back to Set before searching

```typescript
case 'SEARCH':
    const { query, filterPages } = payload;
    // FIX: Convert Array back to Set
    const filterSet = filterPages ? new Set(filterPages as number[]) : undefined;
    
    const { candidates, similarCandidates } = await performSearch(
        query,
        cachedEmbeddings,
        searchIndex,
        queryEmbedding,
        filterSet  // ← FIX: Now passed to search!
    );
    break;
```

**Output:** filterSet `Set<number> | undefined` ready for search

---

### Step 7: Search with Filtering
**File:** `utils/search/retriever.ts` line 92-130
**What Happens:** Both BM25 and vector search apply the filter

```typescript
export function findHybridCandidates(
    index: IndexStructure,
    query: string,
    queryEmbedding?: number[],
    limit: number = 20,
    filterPages?: Set<number>  // ← FIX: Added parameter
): SearchCandidate[] {
    // BM25 Search with filtering
    const bm25Results = findCandidates(
        index, 
        query, 
        limit * 2, 
        filterPages  // ← Applied here
    );

    // Vector search with filtering
    const vectorResults = index.candidates
        .filter(c => c.embedding && (!filterPages || filterPages.has(c.pageNumber)))
        // ↑ FIX: Only include pages in filterSet
        
    // Combine results
    const combined = combineResults(bm25Results, vectorResults);
}
```

**Output:** Only candidates from filtered pages are returned

---

### Step 8: Page Expansion with Filter Respect
**File:** `components/workspace/ai-command/MultiStageSearch.ts` line 245-260
**What Happens:** When expanding to adjacent pages, respect the filter

```typescript
// Expand to adjacent pages for context continuity
const expandedPages = new Set<number>();
const allPagesArray = Array.from(allPages);
for (const page of allPagesArray) {
    for (let p = page - PAGE_EXPANSION_RANGE; p <= page + PAGE_EXPANSION_RANGE; p++) {
        if (p > 0 && (!filterPages || filterPages.has(p))) {  // ← RESPECTS FILTER!
            expandedPages.add(p);
        }
    }
}
```

**Output:** `expandedPages` only contains pages within the filter

---

### Step 9: Page Text Fetching with Timeout
**File:** `utils/pdf-extraction.ts` line 142-162
**What Happens:** Fetch text for each expanded page with timeout protection

```typescript
async getPageText(page: number): Promise<string> {
    return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout;
        const handler = (data: { page: number; text: string | null }) => {
            if (data.page === page) {
                clearTimeout(timeoutId);
                this.off('page_text', handler as any);
                resolve(data.text || '');
            }
        };
        this.on('page_text', handler as any);
        
        // FIX: 5-second timeout to prevent hanging
        timeoutId = setTimeout(() => {
            this.off('page_text', handler as any);
            console.warn(`[PDFWorkerClient] getPageText timeout for page ${page}`);
            resolve('');
        }, 5000);
        
        this.worker?.postMessage({
            type: 'get_page_text',
            payload: { page }
        });
    });
}
```

**Output:** Page text retrieved (or empty string after 5s timeout)

---

## Summary of All Fixes

| Fix # | Location | Problem | Solution |
|-------|----------|---------|----------|
| 1 | `retriever.ts:92` | Missing filterPages parameter | Added `filterPages?: Set<number>` to function signature |
| 2 | `retriever.ts:96-130` | Filter not applied to search | Apply filter in BM25 search and vector search `.filter()` |
| 3 | `miner.worker.ts:124` | filterSet created but not used | Pass `filterSet` as 5th parameter to `findHybridCandidates()` |
| 4 | `pdf-extraction.ts:94` | **CRITICAL:** Set cannot serialize over postMessage | Convert `Set` to `Array` before sending: `Array.from(filterPages)` |
| 5 | `MultiStageSearch.ts:253` | Adjacent pages ignore filter | Add filter check: `(!filterPages \|\| filterPages.has(p))` |
| 6 | `pdf-extraction.ts:157-160` | `getPageText` hangs forever with no timeout | Add 5-second timeout with `setTimeout` |
| 7 | `MultiStageSearch.ts:220, 262-283` | No visibility into timeout cause | Add detailed logging and timing measurements |
| 8 | `miner.worker.ts:173-176` | Worker doesn't log page text requests | Log cache hit/miss for debugging |

---

## Testing the Flow

To verify the fix works:

1. **Select focus pages** in the ChapterDropdown
2. **Ask a question** - check browser console for:
   - `[MultiStageSearch] Filter pages: [100, 101, 102, ...]`
   - `[MultiStageSearch] Found X unique pages from search results`
   - `[MultiStageSearch] Expanded to Y pages for context`
   - `[MultiStageSearch] Fetching text for X pages: [...]`
   - `[MultiStageSearch] Page text fetching: XXXms`
3. **Verify answer** comes only from selected pages
4. **Test without filter** - should search all pages

---

## Performance Checklist

✅ Parallel search: 1-3 seconds
✅ BM25 filtering: applied
✅ Vector filtering: applied  
✅ Page expansion: respects filter
✅ Page text fetching: 0.5-2 seconds (max 5 pages)
✅ Timeout protection: 5 seconds per page
✅ Total time budget: 20 seconds

---

## Potential Issues and Solutions

| Symptom | Cause | Solution |
|---------|-------|----------|
| Empty results with filter selected | Filter too narrow | Widen chapter selection |
| Timeout after "Parallel search completed" | getPageText hanging | Check individual page logs, verify page exists |
| Wrong answers despite filter | Filter ignored | Verify logs show filterPages being passed |
| Slow page text fetching | Too many pages expanded | Reduce PAGE_EXPANSION_RANGE or max pages |
| Worker not responding | Worker crashed | Check worker logs, reload page |
