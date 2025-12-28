# All Changes Made - Quick Reference

## File: utils/search/retriever.ts

**Line 92 - Function Signature Update:**
```diff
- export function findHybridCandidates(
+ export function findHybridCandidates(
      index: IndexStructure,
      query: string,
      queryEmbedding?: number[],
-     limit: number = 20
+     limit: number = 20,
+     filterPages?: Set<number>
  ): SearchCandidate[] {
```

**Line 96 - BM25 Search Filtering:**
```diff
  const bm25Results = findCandidates(
      index,
      query,
      limit * 2,
+     filterPages
  );
```

**Line 110 - Vector Search Filtering:**
```diff
  const vectorResults = index.candidates
-     .filter(c => c.embedding)
+     .filter(c => c.embedding && (!filterPages || filterPages.has(c.pageNumber)))
```

---

## File: workers/miner.worker.ts

**Line 111-124 - Search Message Handler Update:**
```diff
  case 'SEARCH':
      const { query, filterPages } = payload;
+     const filterSet = filterPages ? new Set(filterPages as number[]) : undefined;
      
      const { candidates, similarCandidates } = await performSearch(
          query,
          cachedEmbeddings,
          searchIndex,
          queryEmbedding,
+         filterSet
      );
```

**Line 173-176 - Page Text Request Logging:**
```diff
  case 'get_page_text':
+     const cachedText = pageTextCache.get(payload.page);
+     console.log(`[MinerWorker] get_page_text request for page ${payload.page}, cache has: ${cachedText ? 'YES (' + cachedText.length + ' chars)' : 'NO'}`);
-     ctx.postMessage({ type: 'page_text', page: payload.page, text: pageTextCache.get(payload.page) ?? null });
+     ctx.postMessage({ type: 'page_text', page: payload.page, text: cachedText ?? null });
```

---

## File: utils/pdf-extraction.ts

**Line 80-97 - Search Function Update (Set to Array Conversion - CRITICAL):**
```diff
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
-                 filterPages
+                 filterPages: filterPages ? Array.from(filterPages) : undefined
              }
          });
      });
  }
```

**Line 142-162 - GetPageText Timeout Addition (CRITICAL):**
```diff
  async getPageText(page: number): Promise<string> {
      return new Promise((resolve) => {
+         let timeoutId: NodeJS.Timeout;
          const handler = (data: { page: number; text: string | null }) => {
              if (data.page === page) {
+                 clearTimeout(timeoutId);
                  this.off('page_text', handler as any);
                  resolve(data.text || '');
              }
          };
          this.on('page_text', handler as any);
+         
+         // Add 5-second timeout to prevent hanging
+         timeoutId = setTimeout(() => {
+             this.off('page_text', handler as any);
+             console.warn(`[PDFWorkerClient] getPageText timeout for page ${page}`);
+             resolve('');
+         }, 5000);
+         
          this.worker?.postMessage({
              type: 'get_page_text',
              payload: { page }
          });
      });
  }
```

---

## File: components/workspace/ai-command/MultiStageSearch.ts

**Line 220 - Add Filter Logging:**
```diff
  console.log(`[MultiStageSearch] Starting parallel search for ${subQuestions.length} sub-questions`);
+ console.log(`[MultiStageSearch] Filter pages: ${filterPages ? Array.from(filterPages).slice(0, 10).join(', ') + (filterPages.size > 10 ? '...' : '') : 'NONE (searching all pages)'}`);
  
  const searchPromises = subQuestions.map(async (sq) => {
```

**Line 241 - Add Search Result Logging:**
```diff
  console.log(`[MultiStageSearch] Parallel search completed, aggregating results`);
+ console.log(`[MultiStageSearch] Found ${allPages.size} unique pages from search results:`, Array.from(allPages).slice(0, 10));

  for (const result of results) {
```

**Line 252 - Add Expansion Logging:**
```diff
+ console.log(`[MultiStageSearch] Expanded to ${expandedPages.size} pages for context`);
  
  // Fetch full text for expanded pages in parallel using Promise.all
  const sortedPages = Array.from(expandedPages).sort((a, b) => a - b).slice(0, 5); // Limit to 5 pages
  
+ console.log(`[MultiStageSearch] Fetching text for ${sortedPages.length} pages:`, sortedPages);
```

**Line 253 - Respect Filter in Page Expansion:**
```diff
  for (const page of allPagesArray) {
      for (let p = page - PAGE_EXPANSION_RANGE; p <= page + PAGE_EXPANSION_RANGE; p++) {
-         if (p > 0) {
+         if (p > 0 && (!filterPages || filterPages.has(p))) {
              expandedPages.add(p);
          }
      }
  }
```

**Line 277-283 - Add Timing Logging:**
```diff
  // === ALL PAGE TEXTS FETCHED IN PARALLEL ===
+ console.time(`[MultiStageSearch] Page text fetching`);
  const pageTextsResults = await Promise.all(pageTextPromises);
+ console.timeEnd(`[MultiStageSearch] Page text fetching`);
+ console.log(`[MultiStageSearch] Received ${pageTextsResults.length} page text results`);
  
  const pageTexts: string[] = [];
```

---

## Summary Statistics

**Total Files Modified:** 4
**Total Lines Changed:** ~50
**New Logging Lines:** ~12
**Critical Fixes:** 3
  - Set serialization (pdf-extraction.ts)
  - Filter application (retriever.ts + miner.worker.ts)
  - Timeout protection (pdf-extraction.ts)

**New Documentation Files:** 3
**Total Documentation Lines:** ~500

---

## Change Categories

### Bug Fixes (Critical)
1. ✅ Set serialization issue - Convert to Array for postMessage
2. ✅ Missing filter parameter - Add to findHybridCandidates
3. ✅ Filter not applied - Pass filterSet to search function
4. ✅ Forever hanging - Add 5-second timeout
5. ✅ Filter ignored in expansion - Add filter check in page expansion

### Improvements (Non-Critical)
6. ✅ Add diagnostic logging for filterPages
7. ✅ Add search result count logging
8. ✅ Add page expansion count logging
9. ✅ Add timing for page text fetching
10. ✅ Add worker-side logging for page requests

---

## Testing Commands

```bash
# Verify no compilation errors
npm run build

# Run tests (if available)
npm run test

# Type check
npx tsc --noEmit
```

---

## Deployment Checklist

- [ ] All files compiled without errors
- [ ] Logging statements do not impact performance
- [ ] Timeout value (5000ms) is appropriate for your server
- [ ] Page expansion range (PAGE_EXPANSION_RANGE) is appropriate
- [ ] Filter respects chapter boundaries correctly
- [ ] Documentation is clear and accessible
- [ ] Rollback plan documented
- [ ] Team notified of changes
