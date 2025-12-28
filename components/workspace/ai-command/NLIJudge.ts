import { judgeOption, initNLIModel } from '@/utils/local-llm';

export interface JudgeResult {
    bestOption: string;      // The selected letter (A, B, C...)
    bestOptionText: string;  // The text of the option
    confidence: number;      // 0.0 to 1.0
    explanation: string;     // Why it was chosen
    evidence: string;        // The specific text chunk used
    isAmbiguous: boolean;    // If results were too close
}

export async function solveWithJudge(
    question: string,
    options: string[], // ["A. Option text", "B. Option text"...]
    contextChunks: string[]
): Promise<JudgeResult> {
    
    // 1. Ensure Model Ready
    await initNLIModel();

    // 2. Detect Negative Logic (NOT/EXCEPT)
    const isNegativeQuestion = /\b(not|except|false|incorrect|unlikely)\b/i.test(question);
    
    // 3. Prepare the best context
    // We join the top 3 chunks to give the model enough evidence without overflowing
    // (Deberta xsmall has a smaller context window, so we prioritize the best chunks)
    const bestContext = contextChunks.slice(0, 3).join('\n... \n');

    const results = [];

    // 4. Judge Every Option
    for (let i = 0; i < options.length; i++) {
        const optionLetter = String.fromCharCode(65 + i); // A, B, C...
        
        // Remove the letter prefix for the hypothesis (e.g., "A. " -> "")
        const cleanOption = options[i].replace(/^[A-D][\.\)\s]+/, '').trim();
        
        // Formulate Hypothesis: "The carburetor heater is located at the air intake."
        // We combine Question + Option to make a complete statement for the model to verify.
        const hypothesis = `${question} ${cleanOption}`;

        const verdict = await judgeOption(bestContext, hypothesis);

        results.push({
            letter: optionLetter,
            text: cleanOption,
            ...verdict
        });
    }

    // 5. Determine the Winner
    let winner;
    let explanation = "";

    if (isNegativeQuestion) {
        // TRICK: For "NOT" questions, we want the highest CONTRADICTION score
        // (The statement that disagrees with the PDF)
        results.sort((a, b) => b.scores.contradiction - a.scores.contradiction);
        winner = results[0];
        explanation = `This is a negative question. While other options align with the text, Option ${winner.letter} contradicts the evidence (Contradiction Score: ${(winner.scores.contradiction * 100).toFixed(0)}%).`;
    } else {
        // NORMAL: We want the highest ENTAILMENT score
        results.sort((a, b) => b.scores.entailment - a.scores.entailment);
        winner = results[0];
        explanation = `The text explicitly supports Option ${winner.letter} (Confidence: ${(winner.scores.entailment * 100).toFixed(0)}%).`;
    }

    // 6. Handle "None of the Above" / Ambiguity Logic
    // If the winner's score is weak, or the margin between 1st and 2nd place is tiny...
    const runnerUp = results[1];
    const winningScore = isNegativeQuestion ? winner.scores.contradiction : winner.scores.entailment;
    const runnerUpScore = isNegativeQuestion ? runnerUp.scores.contradiction : runnerUp.scores.entailment;
    const margin = Math.abs(winningScore - runnerUpScore);
    
    const noneIndex = options.findIndex(o => /none of the above|none is correct|not required/i.test(o));
    
    // THRESHOLDS: 
    // - Absolute Confidence < 50% (or < 75% if "None" is an option)
    // - Margin < 5% (Too close to call)
    
    // If "None" is an option, we require higher confidence to pick a specific answer
    const confidenceThreshold = noneIndex !== -1 ? 0.75 : 0.5;

    if (winningScore < confidenceThreshold || margin < 0.05) {
        if (noneIndex !== -1) {
            return {
                bestOption: String.fromCharCode(65 + noneIndex),
                bestOptionText: options[noneIndex],
                confidence: 0.9,
                explanation: "None of the specific options are supported strongly enough by the text. Defaulting to 'None'.",
                evidence: bestContext,
                isAmbiguous: false
            };
        }
        return {
             bestOption: winner.letter,
             bestOptionText: winner.text,
             confidence: winningScore,
             explanation: "Warning: The evidence is weak. This is the closest match found, but verify manually.",
             evidence: bestContext,
             isAmbiguous: true
        };
    }

    return {
        bestOption: winner.letter,
        bestOptionText: winner.text,
        confidence: winningScore,
        explanation: explanation,
        evidence: bestContext,
        isAmbiguous: false
    };
}
