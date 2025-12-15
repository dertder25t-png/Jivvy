
const { calcPatch } = require('fast-myers-diff');

const iter = calcPatch("He go to school", "He goes to school");
for (const item of iter) {
    console.log("Type:", typeof item[2]);
    console.log("Item:", item);
}
