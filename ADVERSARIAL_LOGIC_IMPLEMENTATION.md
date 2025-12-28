# Adversarial Logic Matrix Implementation

## Overview
Implemented the "Adversarial Logic Matrix" to improve accuracy on trick questions by abandoning "Generative Answering" in favor of Hypothesis Testing.

## Key Components

### 1. AdversarialMatrix.ts
Located at `components/workspace/ai-command/AdversarialMatrix.ts`.
This module encapsulates the core logic:
- **Split & Search**: Generates targeted search queries for each option (`question_keywords + option_keywords`).
- **NLI Grading**: Uses the local NLI model (`nli-deberta-v3-xsmall`) to grade the relationship (Entailment, Contradiction, Neutral) between the search result (Premise) and the Option Text (Hypothesis).
- **Matrix Solver**: Determines the winner based on specific rules:
    - **The Highlander**: If exactly one option is "Entailment", it wins.
    - **Last Man Standing**: If all other options are "Contradiction", the remaining one wins.
    - **Negative Logic Swap**: For "NOT" questions, looks for the "Contradiction".

### 2. Integration in MultiStageSearch.ts
Modified `components/workspace/ai-command/MultiStageSearch.ts` to use `runAdversarialCheck` when options are present.
- Replaced the previous `solveWithJudge` call.
- Passes a search function that utilizes the existing `pdfWorker`.
- Merges pages found during the adversarial search into the final result.

## Benefits
- **Trick Question Handling**: Solves questions like "Where is the carburetor heater in a fuel injection system?" by finding the specific text "Heater is not required" and matching it to "None is required".
- **Evidence-Based**: Every decision is backed by specific text found in the PDF.
- **Robustness**: Handles negative questions and "None of the above" scenarios more effectively.
