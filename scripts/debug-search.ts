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

const tests = [
    { name: "Standard Quiz", text: `What is known as the powerhouse of the cell? A) The Nucleus B) The Mitochondria C) The Ribosome D) The Golgi Apparatus`, expected: 'B' },
    { name: "Messy Separators", text: `When did Apollo 11 land? a. 1950 b. 1969 c. 1990 d. 2000`, expected: 'B' },
    { name: "Negative Logic", text: `Which of the following is NOT true about Python? A. It is a high-level language B. It emphasizes code readability C. It is a low-level assembly language D. It is a programming language`, expected: 'C' },
    { name: "Keyword Proximity", text: `Where does photosynthesis occur? A) In the roots B) In the mitochondria C) In the nucleus D) In the chloroplasts`, expected: 'D' },
    { name: "No Spacing", text: `At what temperature does water boil?A) 50 degrees B) 90 degrees C) 100 degrees D) 150 degrees`, expected: 'C' },
    { name: "Primary Colors NOT", text: `Which of these is NOT a primary color? A. Red B. Blue C. Green D. Yellow`, expected: 'C' },
    { name: "5 Options", text: `What generates ATP in cells? A) Nucleus B) Ribosome C) Mitochondria D) Cell membrane E) Golgi apparatus`, expected: 'C' },
    { name: "Bracket Format", text: `What does the mitochondria produce? [A] DNA [B] ATP [C] RNA [D] Protein`, expected: 'B' }
];

let passed = 0;
for (const t of tests) {
    const quiz = SmartSearchEngine.detectQuizQuestion(t.text);
    if (!quiz.isQuiz) { console.log(`${t.name}: DETECTION FAILED`); continue; }
    const result = SmartSearchEngine.solveQuiz(quiz, MOCK_PDF_TEXT);
    const ok = result.answer === t.expected;
    console.log(`${t.name}: ${ok ? '✓' : '✗'} Got ${result.answer}, Expected ${t.expected}`);
    if (ok) passed++;
}
console.log(`\n=== TOTAL: ${passed}/${tests.length} ===`);
if (passed === tests.length) console.log('ALL TESTS PASSED! ✓');
