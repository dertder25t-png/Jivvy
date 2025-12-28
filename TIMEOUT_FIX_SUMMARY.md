# Timeout Issue Fix Summary

## Problem Statement
The system was timing out with the message "[MultiStageSearch] Parallel search completed, aggregating results" followed immediately by timeout. This indicated the search phase was working but something AFTER the search was causing the hang.

## Root Cause Analysis

### Issue 1: Missing Handler Timeout in `getPageText()`
**Location:** `utils/pdf-extraction.ts` lines 142-153
**Problem:** The `getPageText()` Promise had no timeout mechanism. If the worker failed to respond or the page was not cached, the Promise would hang forever.

**Before:**
```typescript
async getPageText(page: number): Promise<string> {
    return new Promise((resolve) => {
        const handler = (data: { page: number; text: string | null }) => {
            if (data.page === page) {
                this.off('page_text', handler as any);
                resolve(data.text || '');
            }
        };
        this.on('page_text', handler as any);
        this.worker?.postMessage({
            type: 'get_page_text',
            payload: { page }
        });
    });
}
```

**After:**
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
        
        // Add 5-second timeout to prevent hanging
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

### Issue 2: Missing Logging for Page Text Fetching
**Location:** `components/workspace/ai-command/MultiStageSearch.ts` lines 260-283
**Problem:** No detailed logging to understand which page was causing the timeout.

**Changes Made:**
- Added `console.time()` and `console.timeEnd()` around the page text fetching Promise.all()
- Added detailed logging of search results before page expansion
- Added logging of expanded pages count
- Added logging of which pages are being fetched

### Issue 3: Missing Logging in Worker for Page Text Requests
**Location:** `workers/miner.worker.ts` line 173
**Problem:** Worker wasn't logging what was happening when `get_page_text` messages arrived.

**Before:**
```typescript
case 'get_page_text':
    ctx.postMessage({ type: 'page_text', page: payload.page, text: pageTextCache.get(payload.page) ?? null });
    break;
```

**After:**
```typescript
case 'get_page_text':
    const cachedText = pageTextCache.get(payload.page);
    console.log(`[MinerWorker] get_page_text request for page ${payload.page}, cache has: ${cachedText ? 'YES (' + cachedText.length + ' chars)' : 'NO'}`);
    ctx.postMessage({ type: 'page_text', page: payload.page, text: cachedText ?? null });
    break;
```

## Timeline of Fixes Applied

This session applied **3 additional fixes** on top of the previous filterPages propagation fixes:

### Previous Session (Fixed):
1. ✅ Added `filterPages?: Set<number>` parameter to `findHybridCandidates()` in retriever.ts
2. ✅ Updated miner.worker.ts to pass `filterSet` to the search function
3. ✅ Fixed Set serialization in pdf-extraction.ts (convert to Array before postMessage)

### Current Session (New Fixes):
4. ✅ Added 5-second timeout to `getPageText()` to prevent hanging
5. ✅ Added detailed timing and logging to pageText fetching phase
6. ✅ Added worker-side logging for page text requests

## How to Diagnose Issues

When the system times out in the future, check the browser console for:

1. **Search completion:** Look for `[MultiStageSearch] Parallel search completed`
2. **Search results:** Check `Found X unique pages from search results`
3. **Page expansion:** Check `Expanded to X pages for context`
4. **Fetch timing:** Look for `Page text fetching` timer output
5. **Worker logs:** Check `[MinerWorker] get_page_text request for page X`
6. **Individual page timing:** Each `getPageText()` call should complete within 5 seconds

## Performance Expectations

- Parallel search: 1-3 seconds (for 2-3 sub-questions)
- Page text fetching: 0.5-2 seconds (for max 5 pages)
- LLM answer generation: 5-10 seconds
- **Total time budget:** 20 seconds (TIME_BUDGET_MS)

## Next Steps if Still Timing Out

1. Check the detailed logs to identify which page is slow
2. Verify that `expandedPages` count is reasonable (max 5 pages)
3. Check if PDF indexing has completed (via `pageTextCache` logs)
4. Consider reducing PAGE_EXPANSION_RANGE if too many pages are being fetched
5. Monitor individual `getPageText` calls to see if any exceed 5 seconds

## Testing Recommendations

1. Ask a question with focus pages selected
2. Check browser console for detailed logs
3. Verify `[MultiStageSearch] Parallel search completed` appears
4. Verify page text fetching completes within 2 seconds
5. Verify answers are correct and respect the focus page selection
