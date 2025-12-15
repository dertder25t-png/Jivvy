
/**
 * Miner Logic - Keyword-based metric extraction
 * Works with extracted text from PDFs
 * Enhanced with better error handling and number extraction
 */

import { extractAllText } from './pdf-extraction';

export async function mineMetric(
  chunksOrBuffer: string[] | ArrayBuffer,
  metricName: string,
  keywords: string[]
): Promise<{ value: string; confidence: number; pageContext?: string }> {

  // Validate inputs
  if (!metricName || metricName.trim().length === 0) {
    throw new Error('Metric name is required');
  }

  if (!keywords || keywords.length === 0) {
    throw new Error('Keywords are required');
  }

  // Get text from buffer or use chunks directly
  let text: string;
  try {
    if (chunksOrBuffer instanceof ArrayBuffer) {
      console.log('[Miner] Extracting text from PDF buffer...');
      text = await extractAllText(chunksOrBuffer);
      console.log('[Miner] Extracted text length:', text.length);
    } else {
      text = chunksOrBuffer.join(' ');
    }
  } catch (error) {
    console.error('[Miner] Text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
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

  // 2. Extract numbers from relevant sentences with improved patterns
  // Enhanced pattern to catch more number formats
  const numberPattern = /[\$£€]?\s*[\d,]+\.?\d*\s*(?:million|billion|thousand|trillion|k|m|b|t)?/gi;
  const percentPattern = /\d+\.?\d*\s*%/g;
  const rangePattern = /\d+\.?\d*\s*[-–]\s*\d+\.?\d*/g; // For ranges like "10-20"

  const foundNumbers: string[] = [];
  const foundPercentages: string[] = [];
  const foundRanges: string[] = [];

  relevantSentences.forEach(sentence => {
    const numbers = sentence.match(numberPattern) || [];
    const percentages = sentence.match(percentPattern) || [];
    const ranges = sentence.match(rangePattern) || [];
    
    foundNumbers.push(...numbers.map(n => n.trim()));
    foundPercentages.push(...percentages.map(p => p.trim()));
    foundRanges.push(...ranges.map(r => r.trim()));
  });

  // 3. Return the most likely value based on metric type
  const metricLower = metricName.toLowerCase();

  // Check for percentage-based metrics first (highest confidence)
  if (metricLower.includes('percent') || metricLower.includes('%') || metricLower.includes('rate')) {
    if (foundPercentages.length > 0) {
      return {
        value: foundPercentages[0],
        confidence: 0.85,
        pageContext: relevantSentences[0].substring(0, 120)
      };
    }
  }

  // Check for range-based metrics
  if (metricLower.includes('range') || metricLower.includes('between')) {
    if (foundRanges.length > 0) {
      return {
        value: foundRanges[0],
        confidence: 0.8,
        pageContext: relevantSentences[0].substring(0, 120)
      };
    }
  }

  // Extract monetary or numeric values
  if (foundNumbers.length > 0) {
    // Filter out small numbers that are likely page numbers or years
    const meaningfulNumbers = foundNumbers.filter(n => {
      const cleanNum = n.replace(/[,$£€\s]/g, '');
      const num = parseFloat(cleanNum);
      // Exclude page numbers, years (1900-2100), and very small numbers
      return !isNaN(num) && num > 10 && !(num >= 1900 && num <= 2100);
    });

    if (meaningfulNumbers.length > 0) {
      return {
        value: meaningfulNumbers[0],
        confidence: 0.75,
        pageContext: relevantSentences[0].substring(0, 120)
      };
    }
  }

  // 4. Return text context if no numbers found (lowest confidence)
  const contextText = relevantSentences[0].substring(0, 120).trim();
  return {
    value: contextText,
    confidence: 0.5,
    pageContext: "Found keyword match, showing context"
  };
}

/**
 * Extract multiple metrics from a PDF in batch
 */
export async function mineMultipleMetrics(
  chunksOrBuffer: string[] | ArrayBuffer,
  metrics: Array<{ name: string; keywords: string[] }>
): Promise<Array<{ metric: string; value: string; confidence: number; pageContext?: string }>> {
  const results = [];

  for (const metric of metrics) {
    try {
      const result = await mineMetric(chunksOrBuffer, metric.name, metric.keywords);
      results.push({
        metric: metric.name,
        ...result
      });
    } catch (error) {
      console.error(`[Miner] Error mining metric "${metric.name}":`, error);
      results.push({
        metric: metric.name,
        value: "Extraction failed",
        confidence: 0,
        pageContext: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return results;
}
