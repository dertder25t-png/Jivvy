
import * as pdfjsLib from 'pdfjs-dist';

// Ensure the worker is loaded from the public directory
// Check for window (main thread) or self (worker thread)
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
} else if (typeof self !== 'undefined' && 'Worker' in self) {
    // In a worker, we might not need to set workerSrc if we are processing directly,
    // or we might need to set it to valid path if pdfjs tries to spawn sub-workers.
    // For now, let's leave it unset to allow fallback to fake worker or main thread logic if applicable,
    // as setting it to '/pdf.worker.min.js' might be relative to the worker script URL which could be a blob.
}

export async function scanForIndex(pdfData: ArrayBuffer) {
  const doc = await pdfjsLib.getDocument(pdfData).promise;
  const totalPages = doc.numPages;
  const startPage = Math.max(1, totalPages - 20); // Only scan last 20 pages for speed

  let potentialIndexPages = [];

  for (let i = startPage; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    // Heuristic: Does this page title look like an index?
    if (/index|glossary/i.test(text.substring(0, 100))) {
       potentialIndexPages.push({ pageNumber: i, text });
    }
  }

  // Parse terms from the found pages
  return parseIndexTerms(potentialIndexPages);
}

function parseIndexTerms(pages: { pageNumber: number, text: string }[]) {
  const indexMap = new Map<string, number[]>();
  // Regex matches: "Term ...... 123" or "Term 123, 125"
  const rowRegex = /([a-zA-Z\s\-]+)(?:\.{2,}|…+)\s*(\d+(?:,\s*\d+)*)/g;

  pages.forEach(p => {
    let match;
    while ((match = rowRegex.exec(p.text)) !== null) {
      const term = match[1].trim();
      const pageRefs = match[2].split(',').map(n => parseInt(n.trim()));

      if (term.length > 2) { // Filter noise
        const existing = indexMap.get(term) || [];
        indexMap.set(term, Array.from(new Set([...existing, ...pageRefs])));
      }
    }
  });

  // Convert Map to array for JSON serialization
  return Array.from(indexMap.entries()).map(([term, pages]) => ({ term, pages }));
}

export async function extractSpecificPages(pdfData: ArrayBuffer, pageNumbers: number[]) {
  const doc = await pdfjsLib.getDocument(pdfData).promise;
  const extracted = [];

  for (const pageNum of pageNumbers) {
    if (pageNum > doc.numPages || pageNum < 1) continue;
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');
    extracted.push({ page: pageNum, content: text });
  }
  return extracted;
}
