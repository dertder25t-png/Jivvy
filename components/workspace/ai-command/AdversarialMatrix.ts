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
        option: string;
        searchQuery: string;
        evidenceFound: string;
        verdict: 'entailment' | 'contradiction' | 'neutral';
        scores: { entailment: number; contradiction: number; neutral: number };
    }[];
}

export async function runAdversarialCheck(
    question: string,
    options: string[], // ["A. Option text", "B. Option text"...]
    searchFunction: (query: string) => Promise<SearchResult[]>
): Promise<AdversarialResult> {
    
    // 1. Ensure Model Ready
    await initNLIModel();

    // 2. Detect Negative Logic (NOT/EXCEPT)
    const isNegativeQuestion = /\b(not|except|false|incorrect|unlikely)\b/i.test(question);
    
    const matrixResults = [];
    const foundPages = new Set<number>();

    // 3. Split & Search & Judge
    for (let i = 0; i < options.length; i++) {
        const optionLetter = String.fromCharCode(65 + i); // A, B, C...
        const cleanOption = options[i].replace(/^[A-D][\.\)\s]+/, '').trim();
        
        // Generate Targeted Query: Question Keywords + Option Keywords
        const qTokens = tokenizeText(question).join(' ');
        const oTokens = tokenizeText(cleanOption).join(' ');
        const query = `${qTokens} ${oTokens}`;

        // Search
        const searchResults = await searchFunction(query);
        
        // Get best evidence (top result text)
        // If no results, we have no evidence -> Neutral
        let evidenceText = "";
        if (searchResults && searchResults.length > 0) {
             searchResults.forEach(r => foundPages.add(r.page));
             evidenceText = searchResults[0].excerpt || ""; 
        }

        // Judge
        let verdict: NLIResult;
        if (!evidenceText) {
            verdict = {
                option: cleanOption,
                score: 0,
                label: 'neutral',
                scores: { entailment: 0, contradiction: 0, neutral: 1 }
            };
        } else {
            // Hypothesis: The Option Text
            verdict = await judgeOption(evidenceText, cleanOption);
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

    // 4. The Solver Logic (JavaScript)
    // const scores = results.map(r => r.label); // ['neutral', 'entailment', 'contradiction']

    // Rule 1: The "Highlander" (There can be only one)
    // If exactly one option is "Entailment" (Supported), it wins immediately.
    const supported = matrixResults.filter(r => r.verdict === 'entailment');
    
    let winner;
    let explanation = "";

    if (supported.length === 1) {
        winner = supported[0];
        explanation = `Adversarial Logic: Option ${winner.letter} is the only one supported by the evidence.`;
    } 
    // Rule 3: The "Negative Logic" Swap (Check this before Rule 2 if it's a negative question)
    else if (isNegativeQuestion) {
        // If question asks "Which is NOT...", we invert the logic:
        // Look for the single "Contradiction" among "Entailments" (or just the strongest contradiction).
        const contradicted = matrixResults.filter(r => r.verdict === 'contradiction');
        if (contradicted.length === 1) {
             winner = contradicted[0];
             explanation = `Adversarial Logic (Negative): Option ${winner.letter} is the only one contradicted by the evidence.`;
        } else {
            // Fallback: Pick the highest contradiction score
            matrixResults.sort((a, b) => b.scores.contradiction - a.scores.contradiction);
            winner = matrixResults[0];
            explanation = `Adversarial Logic (Negative): Option ${winner.letter} has the strongest contradiction with the evidence.`;
        }
    }
    // Rule 2: The "Last Man Standing" (Process of Elimination)
    // If the question is positive ("What IS...") and all other options are "Contradiction", 
    // picking the one "Neutral" or "Entailment" option left.
    else {
        const contradicted = matrixResults.filter(r => r.verdict === 'contradiction');
        if (contradicted.length === options.length - 1) {
            winner = matrixResults.find(r => r.verdict !== 'contradiction');
            explanation = `Adversarial Logic: All other options were contradicted by evidence. Option ${winner?.letter} remains.`;
        } else {
            // Fallback: Pick the highest entailment score
            matrixResults.sort((a, b) => b.scores.entailment - a.scores.entailment);
            winner = matrixResults[0];
            explanation = `Adversarial Logic: Option ${winner.letter} has the strongest support from the evidence.`;
        }
    }

    if (!winner) {
         // Absolute fallback
         winner = matrixResults[0];
         explanation = "Adversarial Logic: Could not determine a clear winner. Selected best match.";
    }

    return {
        bestOption: winner.letter,
        bestOptionText: winner.text,
        confidence: isNegativeQuestion ? winner.scores.contradiction : winner.scores.entailment,
        explanation: explanation,
        pages: Array.from(foundPages),
        evidence: winner.evidenceFound,
        matrix: matrixResults.map(r => ({
            option: r.text,
            searchQuery: r.searchQuery,
            evidenceFound: r.evidenceFound,
            verdict: r.verdict,
            scores: r.scores
        }))
    };
}
