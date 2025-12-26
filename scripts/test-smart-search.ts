import { SmartSearchEngine } from '../utils/smart-search';

const MOCK_PDF_TEXT = `
The internal combustion engine works by igniting a mixture of fuel and air. 
The mitochondria is the powerhouse of the cell, generating most of the cell's supply of adenosine triphosphate (ATP).
Photosynthesis occurs in the chloroplasts of plant cells.
The Great Wall of China is visible from space.
Python is a high-level programming language that emphasizes code readability.
The Apollo 11 mission landed humans on the Moon in 1969.
Water boils at 100 degrees Celsius at standard atmospheric pressure.
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
        name: "Messy Separators",
        text: `When did Apollo 11 land?
        a. 1950
        b. 1969
        c. 1990
        d. 2000`,
        expected: 'B'
    },
    {
        name: "Negative Logic",
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
    }
];

async function runTests() {
    console.log("Running Smart Search V2 Tests...\n");
    let passed = 0;

    for (const t of TESTS) {
        console.log(`--- Test: ${t.name} ---`);

        // 1. Detect
        const quiz = SmartSearchEngine.detectQuizQuestion(t.text);
        if (!quiz.isQuiz) {
            console.error(`❌ FAILED DETECTION`);
            continue;
        }

        // 2. Solve
        const result = SmartSearchEngine.solveQuiz(quiz, MOCK_PDF_TEXT);

        console.log(`Question: ${quiz.question}`);
        console.log(`Result: ${result.answer} (Confidence: ${result.confidence})`);
        console.log(`Evidence: ${result.evidence.substring(0, 100)}...`);

        if (result.answer === t.expected) {
            console.log(`✅ PASSED`);
            passed++;
        } else {
            console.log(`❌ FAILED. Expected ${t.expected}, Got ${result.answer}`);
        }
        console.log('\n');
    }

    console.log(`Summary: ${passed}/${TESTS.length} Passed`);
}

runTests();
