/* eslint-disable no-restricted-globals */
import { SearchIndexer } from '../utils/search-indexer';
import * as pdfjsLib from 'pdfjs-dist';

// Define Worker Scope
const ctx: Worker = self as any;

// -- State --
const indexer = new SearchIndexer();
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let totalPages = 0;
let isIndexing = false;
let processedPages = new Set<number>();
let priorityQueue: number[] = [];

// Configure PDF.js Worker
// In a web worker, we might need to point to the external worker script or use a fake worker.
// For simplicity in this env, we try standard config.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// -- Handlers --

ctx.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'init_pdf':
        await handleInitPDF(payload.pdfBuffer, payload.subject);
        break;

      case 'search_pdf':
        const results = indexer.search(payload.query);
        ctx.postMessage({ type: 'search_results', results });
        break;

      case 'get_page_text':
        // Retrieve text from indexer (if indexed) or extract on demand?
        // Indexer has private pageText map. We might need to expose it or move map to worker scope.
        // Indexer is inside worker, so we can access it if we add a getter to Indexer
        // For now let's assume indexer has the text if it was indexed.
        // If not indexed, we might need to fetch from doc.
        // Let's modify Indexer to allow getting text.
        // Or simpler: handle it here.
        const pText = indexer.getPageText(payload.page);
        ctx.postMessage({ type: 'page_text', page: payload.page, text: pText });
        break;

      case 'debug_status':
        ctx.postMessage({
          type: 'status',
          status: {
            indexed: processedPages.size,
            total: totalPages,
            queue: priorityQueue.length
          }
        });
        break;
    }
  } catch (err: any) {
    console.error('Worker Error:', err);
    ctx.postMessage({ type: 'error', error: err.message });
  }
};

/**
 * Main Initialization Logic
 * 1. Load PDF
 * 2. Scout First 20 + Last 50
 * 3. Scan for "Subject" references
 * 4. Fill Priority Queue
 * 5. Start Processor
 */
async function handleInitPDF(buffer: ArrayBuffer, subject?: string) {
  // Reset
  processedPages.clear();
  indexer.clear();
  priorityQueue = [];

  // Load Doc
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  pdfDoc = await loadingTask.promise;
  totalPages = pdfDoc.numPages;

  ctx.postMessage({ type: 'progress', message: 'PDF Loaded. Scouting...', percent: 0 });

  // 1. Scout Phase
  // First 20 pages (TOC)
  const scoutPages = new Set<number>();
  for (let i = 1; i <= Math.min(20, totalPages); i++) scoutPages.add(i);

  // Last 50 pages (Index/Glossary)
  for (let i = Math.max(1, totalPages - 50); i <= totalPages; i++) scoutPages.add(i);

  // Extract Scout Text immediately
  const scoutTextArr = await extractPages(Array.from(scoutPages));

  // Index Scouted Pages immediately
  scoutTextArr.forEach(p => {
    indexer.addPage(p.page, p.content);
    processedPages.add(p.page);
  });

  ctx.postMessage({ type: 'progress', message: 'Scout Complete. Analyzing Priority...', percent: 5 });

  // 2. Map Phase (Subject Priority)
  const prioritizedPages = new Set<number>();

  if (subject) {
    const combinedScoutText = scoutTextArr.map(p => p.content).join('\n');

    // Look for subject + page numbers
    // Regex: Subject ... 123
    // Simple heuristic: Subject match, then look for numbers in proximity
    const subjectRegex = new RegExp(`${subject}[^0-9\n]{0,50}(\\d+(?:[-,]\\d+)*)`, 'gi');
    let match;
    while ((match = subjectRegex.exec(combinedScoutText)) !== null) {
      if (match[1]) {
        // Parse numbers
        const nums = match[1].match(/\d+/g);
        nums?.forEach(n => {
          const p = parseInt(n);
          if (p > 0 && p <= totalPages && !processedPages.has(p)) {
            prioritizedPages.add(p);
          }
        });
      }
    }

    // Give boost to these pages in Indexer
    indexer.setSubjectPages(Array.from(prioritizedPages));

    if (prioritizedPages.size > 0) {
      ctx.postMessage({ type: 'info', message: `Prioritizing ${prioritizedPages.size} pages related to "${subject}"` });
    }
  }

  // 3. Build Queue
  // Priority 1: Subject Pages
  priorityQueue.push(...Array.from(prioritizedPages));

  // Priority 2: The rest (linear fill)
  for (let i = 1; i <= totalPages; i++) {
    if (!processedPages.has(i) && !prioritizedPages.has(i)) {
      priorityQueue.push(i);
    }
  }

  // 4. Start Background Processing
  ctx.postMessage({ type: 'progress', message: 'Starting Indexing...', percent: 10 });
  processQueue();
}

/**
 * Process the Queue
 * Batched extraction to stay responsive
 */
async function processQueue() {
  if (!pdfDoc || priorityQueue.length === 0) {
    ctx.postMessage({ type: 'progress', message: 'Indexing Complete', percent: 100 });
    return;
  }

  isIndexing = true;
  const BATCH_SIZE = 5;

  while (priorityQueue.length > 0) {
    const batch = priorityQueue.splice(0, BATCH_SIZE);

    try {
      const extracted = await extractPages(batch);
      extracted.forEach(p => {
        indexer.addPage(p.page, p.content);
        processedPages.add(p.page);
      });

      // Report Progress
      const percent = Math.round((processedPages.size / totalPages) * 100);
      ctx.postMessage({
        type: 'progress',
        message: `Indexing... (${processedPages.size}/${totalPages})`,
        percent
      });

      // Yield to event loop briefly? (Workers are background, but good practice)
      await new Promise(r => setTimeout(r, 50));

    } catch (e) {
      console.error('Batch Error', e);
    }
  }

  isIndexing = false;
  ctx.postMessage({ type: 'progress', message: 'Indexing Complete', percent: 100 });
}

async function extractPages(pages: number[]) {
  if (!pdfDoc) return [];
  const results = [];

  for (const pageNum of pages) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const str = content.items.map((item: any) => item.str).join(' ');
      results.push({ page: pageNum, content: str });
    } catch (e) {
      console.warn(`Failed to extract p${pageNum}`);
    }
  }
  return results;
}

export { };
