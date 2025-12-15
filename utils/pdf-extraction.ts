
/**
 * PDF Extraction Utilities
 * Uses pdfjs-dist package with proper initialization
 */

import * as pdfjsLib from 'pdfjs-dist';

// Type for pdf.js document
type PDFDocumentProxy = any;
type PDFPageProxy = any;

// Configure worker path
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Get the PDF.js library instance
 * Ensures proper initialization in browser environment
 */
async function getPdfJs(): Promise<typeof pdfjsLib> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction only works in browser');
  }

  // Verify worker is configured
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  return pdfjsLib;
}

/**
 * Scan PDF for index terms or extract important terms
 * Optimized to scan more pages with better error handling
 */
export async function scanForIndex(pdfData: ArrayBuffer): Promise<{ term: string; pages: number[] }[]> {
  try {
    if (!pdfData || pdfData.byteLength === 0) {
      throw new Error('Invalid PDF data: empty buffer');
    }

    console.log('[PDF Extraction] Starting scan, buffer size:', pdfData.byteLength);

    const pdfjs = await getPdfJs();
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const doc: PDFDocumentProxy = await loadingTask.promise;

    console.log('[PDF Extraction] PDF loaded, pages:', doc.numPages);

    const allText: string[] = [];
    // Increased page limit for better index detection (was 30)
    const pageLimit = Math.min(doc.numPages, 50);

    // Process pages with better error recovery
    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page: PDFPageProxy = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        allText.push(pageText);
      } catch (pageError) {
        console.warn(`[PDF Extraction] Error on page ${i}:`, pageError);
        // Continue with other pages even if one fails
        allText.push(''); // Add empty string to maintain page alignment
      }
    }

    const combinedText = allText.join('\n');
    console.log('[PDF Extraction] Extracted text length:', combinedText.length);

    if (combinedText.length === 0) {
      throw new Error('No text could be extracted from PDF');
    }

    // Try to find formal index first
    const indexTerms = findAndParseIndex(combinedText);

    if (indexTerms.length > 0) {
      console.log('[PDF Extraction] Found', indexTerms.length, 'index terms');
      return indexTerms;
    }

    // Fallback to extracting important terms
    const terms = extractImportantTerms(combinedText);
    console.log('[PDF Extraction] Extracted', terms.length, 'common terms');
    return terms;

  } catch (error) {
    console.error('[PDF Extraction] Error:', error);
    if (error instanceof Error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
    throw new Error('PDF extraction failed: Unknown error');
  }
}

/**
 * Find and parse index/glossary section from PDF text
 * Improved pattern matching and term extraction
 */
function findAndParseIndex(text: string): { term: string; pages: number[] }[] {
  const indexMap = new Map<string, number[]>();

  // Look for index/glossary section with more patterns
  const indexStart = text.search(/\b(INDEX|GLOSSARY|CONTENTS)\b/i);
  let indexText = text;

  if (indexStart !== -1) {
    // Extract from index section only (more accurate)
    indexText = text.slice(indexStart);
    console.log('[PDF Extraction] Found index section at position', indexStart);
  }

  // Multiple patterns to catch different index formatting styles
  const patterns = [
    // Pattern 1: "Term .... 123" or "Term ... 123, 456"
    /([A-Za-z][A-Za-z\s\-']{2,40})(?:\s*\.{2,}|…+|\s{2,})\s*(\d+(?:[,\s-]+\d+)*)/g,
    // Pattern 2: "Term, 123" or "Term 123" at end of line
    /([A-Za-z][A-Za-z\s\-']{2,40}),?\s+(\d+(?:[,\s]+\d+)*)\s*$/gm,
    // Pattern 3: "Term (123)"
    /([A-Za-z][A-Za-z\s\-']{2,40})\s*\((\d+(?:[,\s-]+\d+)*)\)/g
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(indexText)) !== null) {
      const term = match[1].trim();
      const pageStr = match[2];
      
      // Extract all page numbers from the string
      const pageRefs = pageStr
        .match(/\d+/g)
        ?.map(n => parseInt(n, 10))
        .filter(n => n > 0 && n < 10000) || []; // Increased max page to 10000

      // Validate term quality
      if (
        term.length > 2 && 
        term.length < 60 && 
        pageRefs.length > 0 && 
        !isCommonWord(term)
      ) {
        const existing = indexMap.get(term) || [];
        // Merge and deduplicate page references
        const mergedPages = Array.from(new Set([...existing, ...pageRefs])).sort((a, b) => a - b);
        indexMap.set(term, mergedPages);
      }
    }
  }

  const indexTerms = Array.from(indexMap.entries())
    .map(([term, pages]) => ({ term, pages }))
    .slice(0, 150); // Increased limit from 100

  return indexTerms;
}

/**
 * Extract important terms from document when no formal index is found
 * Improved frequency analysis and term quality
 */
function extractImportantTerms(text: string): { term: string; pages: number[] }[] {
  const wordCounts = new Map<string, number>();

  // Patterns to catch different types of important terms
  const wordPatterns = [
    // Pattern 1: Capitalized words (proper nouns, titles)
    /\b([A-Z][a-z]{3,15}(?:\s+[A-Z][a-z]{3,15})?)\b/g,
    // Pattern 2: Acronyms (2-10 capital letters)
    /\b([A-Z]{2,10})\b/g,
    // Pattern 3: Technical terms (camelCase or hyphenated)
    /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g,
  ];

  for (const regex of wordPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[1].trim();
      if (!isCommonWord(word) && word.length > 2) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  // Sort by frequency and return top terms
  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 3) // Minimum occurrence threshold
    .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
    .slice(0, 75) // Increased from 50
    .map(([term]) => ({
      term,
      pages: [1], // Default to page 1 since we don't have specific page info
    }));
}

/**
 * Check if a word is a common stop word that should be filtered out
 * Expanded list for better term quality
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    // Articles and conjunctions
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out',
    'The', 'And', 'For', 'Are', 'But', 'Not', 'You', 'All', 'Can', 'Her', 'Was', 'One', 'Our', 'Out',
    // Common verbs and prepositions
    'This', 'That', 'With', 'From', 'Have', 'Been', 'Will', 'Would', 'Could', 'Should', 'There',
    'Their', 'Where', 'Which', 'About', 'After', 'Before', 'Between', 'Through', 'During', 'Without',
    'When', 'What', 'Who', 'Why', 'How', 'Some', 'Many', 'More', 'Most', 'Other', 'Such', 'Only',
    // Document structure words
    'Chapter', 'Section', 'Figure', 'Table', 'Page', 'Note', 'Example', 'Examples', 'Introduction', 
    'Conclusion', 'References', 'Appendix', 'Contents', 'Preface', 'Summary', 'Overview', 'Abstract',
    // Common filler words
    'Each', 'Every', 'Both', 'Few', 'Several', 'Since', 'While', 'Until', 'Where', 'Whether',
    'Also', 'Just', 'Very', 'Too', 'Here', 'Then', 'Now', 'Even', 'Much', 'Well', 'Back', 'Only',
  ]);
  
  // Check both exact match and case-insensitive match
  return commonWords.has(word) || commonWords.has(word.toLowerCase());
}

/**
 * Extract all text from PDF
 * Optimized to handle more pages with better error recovery
 */
export async function extractAllText(pdfData: ArrayBuffer): Promise<string> {
  try {
    if (!pdfData || pdfData.byteLength === 0) {
      throw new Error('Invalid PDF data: empty buffer');
    }

    const pdfjs = await getPdfJs();
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const doc: PDFDocumentProxy = await loadingTask.promise;
    const allText: string[] = [];

    // Increased limit for more complete extraction (was 50)
    const pageLimit = Math.min(doc.numPages, 100);

    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page: PDFPageProxy = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        allText.push(pageText);
      } catch (e) {
        console.warn(`[PDF Extraction] Error on page ${i}, skipping:`, e);
        // Continue processing remaining pages
      }
    }

    const result = allText.join('\n');
    
    if (result.length === 0) {
      console.warn('[PDF Extraction] No text extracted from PDF');
    }

    return result;
  } catch (error) {
    console.error('[PDF Extraction] Error extracting all text:', error);
    if (error instanceof Error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
    return '';
  }
}

/**
 * Extract text from specific pages
 * Returns array of page content with page numbers
 */
export async function extractSpecificPages(
  pdfData: ArrayBuffer,
  pageNumbers: number[]
): Promise<{ page: number; content: string }[]> {
  try {
    if (!pdfData || pdfData.byteLength === 0) {
      throw new Error('Invalid PDF data: empty buffer');
    }

    if (!pageNumbers || pageNumbers.length === 0) {
      return [];
    }

    const pdfjs = await getPdfJs();
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const doc: PDFDocumentProxy = await loadingTask.promise;
    const extracted: { page: number; content: string }[] = [];

    // Filter out invalid page numbers upfront
    const validPageNumbers = pageNumbers.filter(
      (pageNum) => pageNum >= 1 && pageNum <= doc.numPages
    );

    if (validPageNumbers.length === 0) {
      console.warn('[PDF Extraction] No valid page numbers provided');
      return [];
    }

    // Extract pages in parallel for better performance
    const extractionPromises = validPageNumbers.map(async (pageNum) => {
      try {
        const page: PDFPageProxy = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        return { page: pageNum, content: text };
      } catch (e) {
        console.warn(`[PDF Extraction] Error extracting page ${pageNum}:`, e);
        return null;
      }
    });

    const results = await Promise.all(extractionPromises);
    
    // Filter out failed extractions
    results.forEach((result) => {
      if (result) {
        extracted.push(result);
      }
    });

    return extracted;
  } catch (error) {
    console.error('[PDF Extraction] Error extracting pages:', error);
    if (error instanceof Error) {
      throw new Error(`Page extraction failed: ${error.message}`);
    }
    return [];
  }
}
