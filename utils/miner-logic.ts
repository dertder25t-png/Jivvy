
/**
 * Miner Logic - Keyword-based metric extraction
 * Works with extracted text from PDFs
 */

import { extractAllText } from './pdf-extraction';

export async function mineMetric(
  chunksOrBuffer: string[] | ArrayBuffer,
  metricName: string,
  keywords: string[]
): Promise<{ value: string; confidence: number; pageContext?: string }> {

  // Get text from buffer or use chunks directly
  let text: string;
  if (chunksOrBuffer instanceof ArrayBuffer) {
    console.log('[Miner] Extracting text from PDF buffer...');
    text = await extractAllText(chunksOrBuffer);
    console.log('[Miner] Extracted text length:', text.length);
  } else {
    text = chunksOrBuffer.join(' ');
  }

  if (!text || text.length === 0) {
    return { value: "No text extracted", confidence: 0 };
  }

  // 1. Find all sentences containing keywords
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
  const relevantSentences = sentences.filter(sentence =>
    keywords.some(kw => sentence.toLowerCase().includes(kw.toLowerCase()))
  );

  console.log('[Miner] Found', relevantSentences.length, 'relevant sentences from', sentences.length, 'total');

  if (relevantSentences.length === 0) {
    return { value: "Keywords not found", confidence: 0 };
  }

  // 2. Extract numbers from relevant sentences
  const numberPattern = /[\$£€]?\s*[\d,]+\.?\d*\s*(?:million|billion|thousand|k|m|b)?/gi;
  const percentPattern = /\d+\.?\d*\s*%/g;

  const foundNumbers: string[] = [];
  const foundPercentages: string[] = [];

  relevantSentences.forEach(sentence => {
    const numbers = sentence.match(numberPattern) || [];
    const percentages = sentence.match(percentPattern) || [];
    foundNumbers.push(...numbers.map(n => n.trim()));
    foundPercentages.push(...percentages.map(p => p.trim()));
  });

  // 3. Return the most likely value based on metric type
  const metricLower = metricName.toLowerCase();

  if (metricLower.includes('percent') || metricLower.includes('%') || metricLower.includes('rate')) {
    if (foundPercentages.length > 0) {
      return {
        value: foundPercentages[0],
        confidence: 0.8,
        pageContext: relevantSentences[0].substring(0, 100)
      };
    }
  }

  if (foundNumbers.length > 0) {
    // Filter out small numbers that are likely page numbers
    const meaningfulNumbers = foundNumbers.filter(n => {
      const num = parseFloat(n.replace(/[,$£€]/g, ''));
      return !isNaN(num) && num > 10;
    });

    if (meaningfulNumbers.length > 0) {
      return {
        value: meaningfulNumbers[0],
        confidence: 0.75,
        pageContext: relevantSentences[0].substring(0, 100)
      };
    }
  }

  // 4. Return text context if no numbers found
  return {
    value: relevantSentences[0].substring(0, 100).trim(),
    confidence: 0.5,
    pageContext: "Found keyword match, showing context"
  };
}
