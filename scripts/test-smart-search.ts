import { SmartSearchEngine } from '../utils/smart-search';

const MOCK_PDF_TEXT = `
The internal combustion engine works by igniting a mixture of fuel and air. 
The mitochondria is the powerhouse of the cell, generating most of the cell's supply of adenosine triphosphate (ATP).
Photosynthesis occurs in the chloroplasts of plant cells.
The Great Wall of China is visible from space.
Python is a high-level programming language that emphasizes code readability.
The Apollo 11 mission landed humans on the Moon in 1969.
Water boils at 100 degrees Celsius at standard atmospheric pressure.
The primary colors are Red, Blue, and Yellow. Green is a secondary color formed by mixing Blue and Yellow.
`;

const TESTS = [
    {
        name: "Standard Quiz",
        text: `What is known as the powerhouse of the cell?
        A) The Nucleus
        B) The Mitochondria
        C) The Ribosome
        D) The Golgi Apparatus`,
        expected: 'B'
    },
    {
        name: "Messy Separators (dots)",
        text: `When did Apollo 11 land?
        a. 1950
        b. 1969
        c. 1990
        d. 2000`,
        expected: 'B'
    },
    {
        name: "Negative Logic (NOT)",
        text: `Which of the following is NOT true about Python?
        A. It is a high-level language
        B. It emphasizes code readability
        C. It is a low-level assembly language
        D. It is a programming language`,
        expected: 'C'
    },
    {
        name: "Keyword Proximity",
        text: `Where does photosynthesis occur?
        A) In the roots
        B) In the mitochondria
        C) In the nucleus
        D) In the chloroplasts`,
        expected: 'D'
    },
    {
        name: "No Spacing / Bad Formatting",
        text: `At what temperature does water boil?A) 50 degrees B) 90 degrees C) 100 degrees D) 150 degrees`,
        expected: 'C'
    },
    {
        name: "Primary Colors NOT Question (from requirements)",
        text: `Which of these is NOT a primary color? A. Red B. Blue C. Green D. Yellow`,
        expected: 'C'
    },
    {
        name: "5 Options (A-E)",
        text: `What generates ATP in cells?
        A) Nucleus
        B) Ribosome
        C) Mitochondria
        D) Cell membrane
        E) Golgi apparatus`,
        expected: 'C'
    },
    {
        name: "Bracket Format [A]",
        text: `What does the mitochondria produce?
        [A] DNA
        [B] ATP
        [C] RNA
        [D] Protein`,
        expected: 'B'
    }
];

async function runTests() {
    console.log("===========================================");
    console.log("   Smart Search V3 - Large Doc Optimized");
    console.log("===========================================\n");
    let passed = 0;

    for (const t of TESTS) {
        console.log(`--- Test: ${t.name} ---`);

        // 1. Detect
        const quiz = SmartSearchEngine.detectQuizQuestion(t.text);
        if (!quiz.isQuiz) {
            console.error(`❌ FAILED DETECTION`);
            console.log(`   Options found: ${quiz.options.length}`);
            console.log(`   Raw text: ${t.text.substring(0, 50)}...`);
            console.log('');
            continue;
        }

        // 2. Solve
        const result = SmartSearchEngine.solveQuiz(quiz, MOCK_PDF_TEXT);

        console.log(`Question: ${quiz.question.substring(0, 50)}...`);
        console.log(`Options: ${quiz.options.map(o => o.letter).join(', ')}`);
        console.log(`Is Negative: ${quiz.isNegative}`);
        console.log(`Result: ${result.answer} (Confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        console.log(`Evidence: ${result.evidence.substring(0, 80)}...`);
        console.log(`Explanation: ${result.explanation}`);

        if (result.answer === t.expected) {
            console.log(`✅ PASSED`);
            passed++;
        } else {
            console.log(`❌ FAILED. Expected ${t.expected}, Got ${result.answer}`);
        }
        console.log('');
    }

    console.log("===========================================");
    console.log(`Summary: ${passed}/${TESTS.length} Passed`);
    console.log("===========================================");

    if (passed === TESTS.length) {
        console.log("🎉 ALL TESTS PASSED!");
    } else {
        console.log(`⚠️  ${TESTS.length - passed} tests failed`);
    }
}

runTests();
