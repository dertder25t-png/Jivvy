
const { calcPatch } = require('fast-myers-diff');

function testDiff(original, corrected) {
    console.log(`---`);
    console.log(`Original: "${original}"`);
    console.log(`Corrected: "${corrected}"`);

    const diffs = [];
    if (corrected && corrected !== original) {
        // Simulating the worker logic
        const patches = [...calcPatch(original, corrected)];

        for (const [sx, ex, correctionText, ey] of patches) {
            // Found that fast-myers-diff returns [sx, ex, "correctionString", ey]
            console.log(`Patch: replace original[${sx}:${ex}] ("${original.slice(sx, ex)}") with "${correctionText}"`);

            diffs.push({
                from: sx,
                to: ex,
                correction: correctionText
            });
        }
    }

    console.log("Result diffs:", diffs);
    return diffs;
}

testDiff("He go to school", "He goes to school");
testDiff("I here", "I am here");
