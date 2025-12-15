
/**
 * PDF Extraction Utilities
 * Uses pdfjs from CDN to avoid webpack bundling issues
 */

// Type definition for the global pdfjsLib object
declare global {
  interface Window {
    pdfjsLib: any;
    pdfjsLibLoaded: boolean;
  }
}

// Load pdfjs from CDN
async function loadPdfJsFromCDN(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction only works in browser');
  }

  // Check if already loaded
  if (window.pdfjsLibLoaded && window.pdfjsLib) {
    return window.pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    // Load the main library
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
    script.type = 'module';

    // For module scripts, we need to use a different approach
    // Use the legacy build instead which is easier to load
    const legacyScript = document.createElement('script');
    legacyScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

    legacyScript.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        window.pdfjsLib = pdfjsLib;
        window.pdfjsLibLoaded = true;
        console.log('[PDF Extraction] pdfjs loaded from CDN');
        resolve(pdfjsLib);
      } else {
        reject(new Error('Failed to load pdfjs from CDN'));
      }
    };

    legacyScript.onerror = () => {
      reject(new Error('Failed to load pdfjs script'));
    };

    document.head.appendChild(legacyScript);
  });
}

export async function scanForIndex(pdfData: ArrayBuffer): Promise<{ term: string; pages: number[] }[]> {
  try {
    console.log('[PDF Extraction] Starting scan, buffer size:', pdfData.byteLength);

    const pdfjsLib = await loadPdfJsFromCDN();
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const doc = await loadingTask.promise;

    console.log('[PDF Extraction] PDF loaded, pages:', doc.numPages);

    const allText: string[] = [];
    const pageLimit = Math.min(doc.numPages, 30);

    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        allText.push(pageText);
      } catch (pageError) {
        console.warn(`[PDF Extraction] Error on page ${i}:`, pageError);
      }
    }

    const combinedText = allText.join('\n');
    console.log('[PDF Extraction] Extracted text length:', combinedText.length);

    const indexTerms = findAndParseIndex(combinedText);

    if (indexTerms.length > 0) {
      console.log('[PDF Extraction] Found', indexTerms.length, 'index terms');
      return indexTerms;
    }

    const terms = extractImportantTerms(combinedText);
    console.log('[PDF Extraction] Extracted', terms.length, 'common terms');
    return terms;

  } catch (error) {
    console.error('[PDF Extraction] Error:', error);
    throw error;
  }
}

function findAndParseIndex(text: string): { term: string; pages: number[] }[] {
  const indexMap = new Map<string, number[]>();

  const indexStart = text.search(/\b(INDEX|GLOSSARY)\b/i);
  let indexText = text;

  if (indexStart !== -1) {
    indexText = text.slice(indexStart);
  }

  const patterns = [
    /([A-Za-z][A-Za-z\s\-']{2,40})(?:\s*\.{2,}|…+|\s{2,})\s*(\d+(?:[,\s-]+\d+)*)/g,
    /([A-Za-z][A-Za-z\s\-']{2,40}),?\s+(\d+(?:[,\s]+\d+)*)\s*$/gm
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(indexText)) !== null) {
      const term = match[1].trim();
      const pageStr = match[2];
      const pageRefs = pageStr.match(/\d+/g)?.map(n => parseInt(n)).filter(n => n > 0 && n < 1000) || [];

      if (term.length > 2 && term.length < 60 && pageRefs.length > 0 && !isCommonWord(term)) {
        const existing = indexMap.get(term) || [];
        indexMap.set(term, Array.from(new Set([...existing, ...pageRefs])));
      }
    }
  }

  return Array.from(indexMap.entries())
    .map(([term, pages]) => ({ term, pages }))
    .slice(0, 100);
}

function extractImportantTerms(text: string): { term: string; pages: number[] }[] {
  const wordCounts = new Map<string, number>();

  const wordPatterns = [
    /\b([A-Z][a-z]{3,15}(?:\s+[A-Z][a-z]{3,15})?)\b/g,
    /\b([A-Z]{2,10})\b/g,
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

  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([term]) => ({
      term,
      pages: [1]
    }));
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out',
    'This', 'That', 'With', 'From', 'Have', 'Been', 'Will', 'Would', 'Could', 'Should', 'There',
    'Their', 'Where', 'Which', 'About', 'After', 'Before', 'Between', 'Through', 'During', 'Without',
    'Chapter', 'Section', 'Figure', 'Table', 'Page', 'Note', 'Example', 'Introduction', 'Conclusion',
    'References', 'Appendix', 'Contents', 'Preface', 'Aviation', 'Maintenance', 'Federal', 'Administration'
  ]);
  return commonWords.has(word) || commonWords.has(word.toLowerCase());
}

export async function extractAllText(pdfData: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await loadPdfJsFromCDN();
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const doc = await loadingTask.promise;
    const allText: string[] = [];

    const pageLimit = Math.min(doc.numPages, 50);

    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
        allText.push(pageText);
      } catch (e) {
        // Skip problematic pages
      }
    }

    return allText.join('\n');
  } catch (error) {
    console.error('[PDF Extraction] Error extracting all text:', error);
    return '';
  }
}

export async function extractSpecificPages(pdfData: ArrayBuffer, pageNumbers: number[]): Promise<{ page: number; content: string }[]> {
  try {
    const pdfjsLib = await loadPdfJsFromCDN();
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const doc = await loadingTask.promise;
    const extracted: { page: number; content: string }[] = [];

    for (const pageNum of pageNumbers) {
      if (pageNum > doc.numPages || pageNum < 1) continue;
      try {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str || '').join(' ');
        extracted.push({ page: pageNum, content: text });
      } catch (e) {
        console.warn(`[PDF Extraction] Error extracting page ${pageNum}:`, e);
      }
    }

    return extracted;
  } catch (error) {
    console.error('[PDF Extraction] Error extracting pages:', error);
    return [];
  }
}
