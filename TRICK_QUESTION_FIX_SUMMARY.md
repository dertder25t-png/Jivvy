# Trick Question & Timeout Fix Summary

## Issues Addressed
1.  **Incorrect Answer for Trick Questions:** The system was answering "A" (At the air intake entrance) for the question "Where would a carburetor air heater be located in a fuel injection system?", instead of "B" (None is required).
2.  **PDF Worker Timeout:** The `getPageText` function was timing out after 10 seconds, causing the system to lose context and rely on snippets.

## Changes Made

### 1. Worker Performance (`workers/miner.worker.ts`)
-   **Problem:** The embedding generation process was blocking the worker thread for too long (yielding only every 20 chunks), preventing `get_page_text` requests from being processed.
-   **Fix:** Increased yield frequency to every iteration (every batch of 4 chunks). This ensures the worker remains responsive to text retrieval requests even while generating embeddings in the background.

### 2. Trick Question Logic (`components/workspace/ai-command/MultiStageSearch.ts`)
-   **Problem:** The system was matching "carburetor air heater" to "carburetor air ducts" in the text, ignoring the fact that the question was about a "fuel injection system" (contradictory context).
-   **Fix:**
    -   Added a **Critical Check** in `solveQuizWithEvidence`: For trick questions (detected by contradictory terms), the evidence MUST explicitly mention the context term (e.g., "fuel injection"). If the evidence only mentions the component (carburetor) but not the system (fuel injection), it is rejected.
    -   **Increased Thresholds:** If "None of the above" is an option, the system now requires a higher confidence score (0.45 instead of 0.3) to pick a non-None answer. This makes it safer to default to "None" when evidence is weak.

## Verification
-   **Trick Question:** The system should now correctly identify that "carburetor air heater" and "fuel injection system" are contradictory. Since the evidence won't support "fuel injection" in the context of a carburetor heater, it will default to "None is required".
-   **Timeout:** The worker should now respond to `getPageText` requests immediately, preventing the 10s timeout and ensuring full page context is available for analysis.
