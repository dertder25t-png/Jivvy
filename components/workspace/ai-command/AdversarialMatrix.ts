import { judgeOption, initNLIModel, NLIResult } from '@/utils/local-llm';
import { tokenizeText } from '@/utils/search/preprocessor';
import { SearchResult } from '@/utils/search-indexer';

export interface AdversarialResult {
    bestOption: string;      // The selected letter (A, B, C...)
    bestOptionText: string;  // The text of the option
    confidence: number;      // 0.0 to 1.0
    explanation: string;     // Why it was chosen
    evidence: string;        // The specific text chunk used
    pages: number[];         // Pages where evidence was found
    matrix: {                // The full scoreboard
        letter: string;
        text: string;
        searchQuery: string;
        evidenceFound: string;
        verdict: 'entailment' | 'contradiction' | 'neutral';
        scores: { entailment: number; contradiction: number; neutral: number };
    }[];
}

export async function runAdversarialCheck(
    question: string,
    options: string[], 
    searchFunction: (query: string) => Promise<SearchResult[]>
): Promise<AdversarialResult> {
    
    await initNLIModel();

    const isNegativeQuestion = /\b(not|except|false|incorrect|unlikely)\b/i.test(question);
    const foundPages = new Set<number>();
    const matrixResults = [];

    for (let i = 0; i < options.length; i++) {
        const optionLetter = String.fromCharCode(65 + i);
        const cleanOption = options[i].replace(/^[A-D][\.\)\s]+/, '').trim();
        const isNoneOption = /none of|not required|none is/i.test(cleanOption);

        // --- FIX 1 & 2: Smarter Search Queries ---
        let query;
        if (isNoneOption) {
            // For "None", just search the question to find general context
            query = tokenizeText(question).join(' '); 
        } else {
            // Targeted search
            const qTokens = tokenizeText(question).join(' ');
            const oTokens = tokenizeText(cleanOption).join(' ');
            query = `${qTokens} ${oTokens}`;
        }

        const searchResults = await searchFunction(query);
        
        let evidenceText = "";
        if (searchResults && searchResults.length > 0) {
             searchResults.forEach(r => foundPages.add(r.page));
             evidenceText = searchResults[0].excerpt || ""; 
        }

        // --- FIX 3: Verdict Logic ---
        let verdict: NLIResult;
        
        if (!evidenceText) {
            verdict = {
                option: cleanOption,
                score: 0,
                label: 'neutral',
                scores: { entailment: 0, contradiction: 0, neutral: 1 }
            };
        } else {
            // --- FIX 1: Combine Question + Option for Hypothesis ---
            // "Blue" -> "What color is the sky? Blue"
            const hypothesis = `${question} ${cleanOption}`;
            verdict = await judgeOption(evidenceText, hypothesis);
            
            // Special handling for "None" options: 
            // If the text says "Not required" and option is "None required", that is Entailment.
            // The NLI model usually handles this, but ensuring the hypothesis is complete helps.
        }

        matrixResults.push({
            letter: optionLetter,
            text: cleanOption,
            searchQuery: query,
            evidenceFound: evidenceText,
            verdict: verdict.label,
            scores: verdict.scores
        });
    }

    // --- FIX 4: Robust Solver Logic ---
    
    // Sort by Entailment (Descending)
    const sortedByEntailment = [...matrixResults].sort((a, b) => b.scores.entailment - a.scores.entailment);
    // Sort by Contradiction (Descending)
    const sortedByContradiction = [...matrixResults].sort((a, b) => b.scores.contradiction - a.scores.contradiction);

    let winner;
    let explanation = "";

    if (isNegativeQuestion) {
        // For "NOT" questions, the winner is the one with highest CONTRADICTION
        winner = sortedByContradiction[0];
        explanation = `Negative Logic: Option ${winner.letter} contradicts the evidence most strongly.`;
    } else {
        // Standard "Find the Truth"
        winner = sortedByEntailment[0];
        const runnerUp = sortedByEntailment[1];
        
        // Safety Check: Ambiguity
        if (runnerUp && (winner.scores.entailment - runnerUp.scores.entailment < 0.05)) {
             explanation = `Ambiguous Result: Options ${winner.letter} and ${runnerUp.letter} have very similar support. Selected ${winner.letter} by slight margin.`;
        } else if (winner.scores.entailment < 0.2) {
             // If best match is garbage, look for "None of the above"
             const noneOption = matrixResults.find(r => /none/i.test(r.text));
             if (noneOption) {
                 winner = noneOption;
                 explanation = "Process of Elimination: No strong evidence found for specific options. Defaulting to 'None'.";
             } else {
                 explanation = "Low Confidence: Evidence is weak for all options.";
             }
        } else {
             explanation = `Process of Elimination: Option ${winner.letter} is the strongest match to the evidence.`;
        }
    }

    return {
        bestOption: winner.letter,
        bestOptionText: winner.text,
        confidence: isNegativeQuestion ? winner.scores.contradiction : winner.scores.entailment,
        explanation: explanation,
        pages: Array.from(foundPages),
        evidence: winner.evidenceFound,
        matrix: matrixResults
    };
}
