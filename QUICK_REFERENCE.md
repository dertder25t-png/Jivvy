# Quick Reference: Context Focus & Follow-up Speed

## What Was Changed?

### 🎯 Problem Solved
- **Before**: Generic LLM responses could hallucinate; follow-up questions lost context; searches were slow
- **After**: Strict grounding (cites text), instant follow-ups (cached context), fast searches (parallel)

---

## 1️⃣ Strict Context Grounding (`utils/local-llm.ts`)

### New Requirement: Citations
The LLM **must** cite specific text before answering:

```typescript
// Function signature
answerQuestionLocal(
    question: string,
    context: string,
    onProgress?: ProgressCallback,
    previousConversation?: PreviousConversationTurn[]  // ← NEW
)
```

### System Prompt Rules
```
1. ANSWER ONLY FROM PROVIDED TEXT → Forbid outside knowledge
2. CITE EVERYTHING → Quote exact sentences
3. NO OUTSIDE KNOWLEDGE → "Not found in context" if not there
4. EXPLICIT ONLY → Don't infer beyond text
5. MAINTAIN CONTEXT → Remember previous conversation
```

### Output Format
```
[CITATION]: "Exact quote from the document"
[ANSWER]: Your answer based on the citation
[EXPLANATION]: Why this answers the question
```

---

## 2️⃣ Session Caching (`MultiStageSearch.ts`)

### How It Works
```
User asks Q1 → Search runs → Cache stores context + answer
                                    ↓
                           User asks Q2 (follow-up)
                                    ↓
                    Cache returns context INSTANTLY
                    New search runs in BACKGROUND
                                    ↓
                    Fast answer + updated context
```

### Cache Structure
```typescript
SessionCache = {
    lastContextString: "...",  // Full page text
    lastPages: Set<number>,    // Which pages
    lastQuestion: "...",       // Previous Q
    lastAnswer: "...",         // Previous A
    timestamp: Date.now()      // When cached
}
```

### Enable Follow-ups
```typescript
// Pass conversation history
await runMultiStageSearch(
    "How do pilots detect these issues?",  // Follow-up Q
    [],
    filterPages,
    onStepUpdate,
    [
        { 
            question: "What causes engine failures?",  // Previous Q
            answer: "..."  // Previous A
        }
    ]  // ← NEW history parameter
)
```

---

## 3️⃣ Parallel Searching (`MultiStageSearch.ts`)

### Speed Improvement
```
Before: Search Q1 → Search Q2 → Search Q3  (Serial: 3×T seconds)
After:  Search Q1, Q2, Q3 simultaneously  (Parallel: 1×T seconds)
```

### Implementation
```typescript
// All sub-questions searched at once
const results = await Promise.all([
    searchCandidates("What is X?", filterPages),
    searchCandidates("How does X work?", filterPages),
    searchCandidates("Where is X located?", filterPages)
]);  // ← All 3 run simultaneously
```

---

## Testing Checklist

### ✅ Strict Grounding Test
```
Q: "What is photosynthesis?"
Context: [Document about trees, but no photosynthesis detail]

Expected: "Not found in provided context"
Forbidden: "Photosynthesis is the process where plants..."
```

### ✅ Follow-up Speed Test
```
Q1: "What are the main aircraft systems?" → Takes 3 seconds
Q2: "How does the electrical system work?" → Should take <1 second (cached)
```

### ✅ Context Retention Test
```
Q1: "What is CHT?" → Answer: "Cylinder Head Temperature..."
Q2: "Why is it important?" → Answer mentions previous context

Expected: Model knows CHT = Cylinder Head Temperature from Q1
```

### ✅ Parallelization Test
```
Enable logging in gatherExpandedContext()
Check logs for: "Starting parallel search for X sub-questions"
Should see ~50-70% faster context gathering
```

---

## Configuration Quick Edit

### To change SessionCache TTL (default 5 minutes):
**File**: `MultiStageSearch.ts`
**Search**: `cacheAgeMs < 5 * 60 * 1000`
**Change to**: `cacheAgeMs < 10 * 60 * 1000` (10 minutes)

### To change max context length:
**File**: `MultiStageSearch.ts`
**Search**: `const MAX_CONTEXT_THOROUGH = 6000`
**Change to**: `const MAX_CONTEXT_THOROUGH = 8000` (8000 chars)

### To disable follow-up caching:
**File**: `MultiStageSearch.ts`
**Change**: Remove the `if (cachedData && history && history.length > 0)` block

---

## Key Metrics to Monitor

| Metric | Target | What It Means |
|--------|--------|---------------|
| **Cache Hit Rate** | >70% for related questions | Effective follow-up detection |
| **Follow-up Response Time** | <500ms | Session cache is working |
| **Hallucination Rate** | <10% | Strict grounding is effective |
| **Citation Accuracy** | >95% | Model follows output format |
| **Parallel Search Speedup** | 1.5-2.0× | Good parallelization |

---

## Troubleshooting

### Problem: Follow-up questions are slow
- **Cause**: Cache may have expired (>5 min) or question detected as new
- **Fix**: Check `getCachedContext()` - increase TTL or verify history is passed

### Problem: LLM not citing sources
- **Cause**: System prompt not followed or different model used
- **Fix**: Check `answerQuestionLocal()` system prompt - may need prompt tuning

### Problem: High hallucination rate
- **Cause**: Strict grounding not enforced properly
- **Fix**: Add penalty for out-of-context claims in the system prompt

### Problem: Parallelization not working
- **Cause**: `Promise.all` in `gatherExpandedContext()` not reached
- **Fix**: Check error handling - verify sub-questions are being generated

---

## See Also
- [Full Implementation Guide](./IMPLEMENTATION_SUMMARY.md)
- Main Files Modified:
  - `utils/local-llm.ts` - Strict grounding + citation requirement
  - `components/workspace/ai-command/MultiStageSearch.ts` - Caching + parallel search

