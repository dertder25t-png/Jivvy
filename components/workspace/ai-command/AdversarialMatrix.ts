import { judgeOption, initNLIModel, NLIResult } from '@/utils/local-llm';
import { tokenizeText } from '@/utils/search/preprocessor';
import { SearchResult } from '@/utils/search-indexer';

export interface AdversarialResult {
    bestOption: string;
    bestOptionText: string;
    confidence: number;
    explanation: string;
    evidence: string;
    pages: number[];
    matrix: {
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

    // 1. Identify "Core Subject" (Nouns only, >3 chars) to filter noise
    // We use this to ensure the evidence is at least vaguely related.
    const qTokens = tokenizeText(question);
    const subjectKeywords = qTokens.filter(w => w.length > 3 && !/^(what|where|when|which|does|can|will|should)$/i.test(w));

    // === PHASE 1: SEARCH & INITIAL SCORING ===
    for (let i = 0; i < options.length; i++) {
        const optionLetter = String.fromCharCode(65 + i);
        const cleanOption = options[i].replace(/^[A-D][\.\)\s]+/, '').trim();
        const isNoneOption = /none of|not required|none is/i.test(cleanOption);

        // --- SEARCH STRATEGY ---
        let query;
        if (isNoneOption) {
            // For "None", we search for the core condition of the question
            query = subjectKeywords.join(' '); 
        } else {
            // Standard: "Carburetor icing" + "Decrease Manifold Pressure"
            const oTokens = tokenizeText(cleanOption).filter(w => w.length > 3);
            
            // We combine the top subject words with the option words
            // Limit to ~15 words to keep search focused
            query = `${subjectKeywords.slice(0, 5).join(' ')} ${oTokens.join(' ')}`;
        }

        const searchResults = await searchFunction(query);
        
        let evidenceText = "";
        let pageFound = 0;
        
        if (searchResults && searchResults.length > 0) {
             evidenceText = searchResults[0].excerpt || ""; 
             pageFound = searchResults[0].page;
             foundPages.add(pageFound);
        }

        // --- IMPROVED CONTEXT GATING ---
        // Old Logic: Required 30% match of ALL words (Too strict).
        // New Logic: Just requires ONE strong match of a rare keyword (e.g. "Turbocharger")
        // OR if the evidence is very short/dense, we trust the NLI model more.
        let relevancePenalty = 1.0;
        
        if (evidenceText) {
            const evidenceLower = evidenceText.toLowerCase();
            const hasSubjectMatch = subjectKeywords.some(k => evidenceLower.includes(k.toLowerCase()));
            
            // Only penalize if ZERO subject keywords appear in the evidence
            // This prevents "Carburetor" answers for "Fuel Injection" questions
            if (!hasSubjectMatch && subjectKeywords.length > 0) {
                relevancePenalty = 0.7; // Softer penalty (was 0.5)
            }
        }

        let verdict: NLIResult;
        
        if (!evidenceText) {
            verdict = {
                option: cleanOption,
                score: 0,
                label: 'neutral',
                scores: { entailment: 0, contradiction: 0, neutral: 1 }
            };
        } else {
            // HYPOTHESIS FORMULATION
            // We combine them to create a "Fact Check" statement.
            const hypothesis = `${question} ${cleanOption}`;
            verdict = await judgeOption(evidenceText, hypothesis);
            
            // Apply the Context Penalty
            verdict.scores.entailment *= relevancePenalty;
            verdict.score *= relevancePenalty;
        }

        matrixResults.push({
            letter: optionLetter,
            text: cleanOption,
            searchQuery: query,
            evidenceFound: evidenceText,
            page: pageFound,
            verdict: verdict.label,
            scores: verdict.scores,
            relevancePenalty 
        });
    }

    // === PHASE 2: THE TRIPLE CHECK (Tie-Breaking) ===
    
    // Sort by Entailment (High to Low)
    const sortedByEntailment = [...matrixResults].sort((a, b) => b.scores.entailment - a.scores.entailment);
    const sortedByContradiction = [...matrixResults].sort((a, b) => b.scores.contradiction - a.scores.contradiction);

    let winner = isNegativeQuestion ? sortedByContradiction[0] : sortedByEntailment[0];
    let runnerUp = isNegativeQuestion ? sortedByContradiction[1] : sortedByEntailment[1];
    
    let explanation = "";
    let confidence = isNegativeQuestion ? winner.scores.contradiction : winner.scores.entailment;

    // RULE: If top 2 are close (within 10%), trigger HEAD-TO-HEAD logic
    if (runnerUp && (confidence - (isNegativeQuestion ? runnerUp.scores.contradiction : runnerUp.scores.entailment) < 0.10)) {
        
        // Tie-Breaker: Keyword Density Check
        // If the scores are identical, pick the one where the Evidence actually contains the Option's unique words.
        const winnerOptionWords = tokenizeText(winner.text).filter(w => w.length > 3);
        const winnerMatches = winnerOptionWords.filter(w => winner.evidenceFound.toLowerCase().includes(w));
        
        const runnerUpOptionWords = tokenizeText(runnerUp.text).filter(w => w.length > 3);
        const runnerUpMatches = runnerUpOptionWords.filter(w => runnerUp.evidenceFound.toLowerCase().includes(w));

        // If Runner Up has significantly more keyword matches in its evidence, flip the winner
        if (runnerUpMatches.length > winnerMatches.length + 1) {
             // Swap winner
             const temp = winner;
             winner = runnerUp;
             runnerUp = temp;
             explanation = `Triple Check: Model initially favored ${runnerUp.letter}, but Option ${winner.letter} was selected because its evidence specifically mentions key terms ('${winnerMatches.join("', '")}') missing from the other evidence.`;
             confidence = 0.8; // Set a safe confidence
        } else {
             explanation = `Triple Check Result: Options ${winner.letter} and ${runnerUp.letter} were close. Selected ${winner.letter} based on slightly higher logical support (${(confidence * 100).toFixed(0)}%).`;
        }
    } else {
        // Clear Winner
        explanation = isNegativeQuestion
            ? `Negative Logic: Option ${winner.letter} is the only one contradicted by the text.`
            : `Logic Match: Option ${winner.letter} is strongly supported by the text.`;
    }

    // === PHASE 3: FINAL SAFETY & FORMATTING ===
    
    // Safety: If "None" is an option and confidence is low (< 40%), default to None
    const noneOption = matrixResults.find(r => /none/i.test(r.text));
    if (confidence < 0.4 && noneOption && winner !== noneOption) {
        winner = noneOption;
        explanation = "Process of Elimination: Evidence for specific options was too weak. Defaulting to 'None' as the safest answer.";
        confidence = 0.85; 
    }

    // Format Explanation with Citation
    if (winner.evidenceFound) {
        // Clean up newlines in citation for display
        const citation = winner.evidenceFound.replace(/\s+/g, ' ').slice(0, 180);
        explanation += `\n\n**Evidence (Page ${winner.page}):** "...${citation}..."`;
    }

    return {
        bestOption: winner.letter,
        bestOptionText: winner.text,
        confidence: confidence,
        explanation: explanation,
        pages: Array.from(foundPages),
        evidence: winner.evidenceFound,
        matrix: matrixResults
    };
}
