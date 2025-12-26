import { SmartSearchEngine } from '../lib/smart-search';

const MOCK_PDF_TEXT = `
The internal combustion engine works by igniting a mixture of fuel and air. 
The mitochondria is the powerhouse of the cell, generating most of the cell's supply of adenosine triphosphate (ATP).
Photosynthesis occurs in the chloroplasts of plant cells.
The Great Wall of China is visible from space.
Python is a high-level programming language that emphasizes code readability.
`;

const POSITIVE_TEST_CASE = `
What is the powerhouse of the cell?
A) The Nucleus
B) The Mitochondria
C) The Ribosome
D) The Golgi Apparatus
`;

const NEGATIVE_TEST_CASE = `
Which of the following is NOT true about Python?
A) It is a high-level language
B) It emphasizes code readability
C) It is a low-level assembly language
D) It is a programming language
`;

async function runTests() {
    console.log("Running Smart Search Tests...\n");

    // Test 1: Quiz Detection
    console.log("Test 1: Quiz Detection");
    const quiz1 = SmartSearchEngine.detectQuizQuestion(POSITIVE_TEST_CASE);
    if (quiz1 && quiz1.options.length === 4) {
        console.log("✅ Quiz Detected Correctly");
    } else {
        console.error("❌ Quiz Detection Failed", quiz1);
    }

    // Test 2: Positive Logic Answering
    console.log("\nTest 2: Positive Logic Answering");
    if (quiz1) {
        const result1 = SmartSearchEngine.solveQuiz(quiz1, MOCK_PDF_TEXT);
        console.log(`Question: ${quiz1.question}`);
        console.log(`Answer: ${result1.answer}`);
        console.log(`Explanation: ${result1.explanation}`);

        if (result1.answer === 'B') {
            console.log("✅ Correct Answer (B) Identified");
        } else {
            console.error(`❌ Wrong Answer: Expected B, got ${result1.answer}`);
        }
    }

    // Test 3: Negative Logic Answering
    console.log("\nTest 3: Negative Logic Answering");
    const quiz2 = SmartSearchEngine.detectQuizQuestion(NEGATIVE_TEST_CASE);
    if (quiz2) {
        const result2 = SmartSearchEngine.solveQuiz(quiz2, MOCK_PDF_TEXT);
        console.log(`Question: ${quiz2.question}`);
        console.log(`Answer: ${result2.answer}`);
        console.log(`Explanation: ${result2.explanation}`);

        // In the text: 
        // Python is high-level (A supported)
        // Emphasizes readability (B supported)
        // Is a programming language (D supported implicitly by "programming language")
        // Low-level assembly is NOT mentioned -> Should be the answer (C)

        if (result2.answer === 'C') {
            console.log("✅ Correct Negative Answer (C) Identified");
        } else {
            console.error(`❌ Wrong Answer: Expected C, got ${result2.answer}`);
        }
    }
}

runTests();
