/* eslint-disable no-restricted-globals */
/**
 * Miner Worker - Background PDF Indexing and Search
 * 
 * Message Types:
 * - INIT_INDEX: Build search index from PDF data
 * - SEARCH: Query the index for matching pages
 * - init_pdf: Legacy init (backward compatible)
 * - search_pdf: Legacy search (backward compatible)
 * - get_page_text: Retrieve text for a specific page
 */

import { InvertedIndex, SearchResult } from '../utils/search-indexer';
import * as pdfjsLib from 'pdfjs-dist';

// Define Worker Scope
const ctx: Worker = self as any;

// -- State --
let searchIndex: InvertedIndex | null = null;
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let totalPages = 0;
let isIndexing = false;
let processedPages = new Set<number>();
let priorityQueue: number[] = [];

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// -- Main Message Handler --
ctx.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      // ==========================================
      // NEW API (matches user spec)
      // ==========================================
      case 'INIT_INDEX':
        await buildIndex(payload.pdfData);
        ctx.postMessage({ type: 'INDEX_READY', id });
        break;

      case 'SEARCH':
        if (!searchIndex) throw new Error("Index not ready");
        const results = searchIndex.search(payload.query, payload.isNegative || false);
        ctx.postMessage({ type: 'SEARCH_RESULT', id, payload: results });
        break;

      // ==========================================
      // LEGACY API (backward compatibility)
      // ==========================================
      case 'init_pdf':
        await handleInitPDF(payload.pdfBuffer, payload.subject);
        break;

      case 'search_pdf':
        if (!searchIndex) {
          ctx.postMessage({ type: 'search_results', results: [] });
          break;
        }
        const legacyResults = searchIndex.search(payload.query);
        // Map to legacy format
        ctx.postMessage({
          type: 'search_results',
          results: legacyResults.map(r => ({
            page: r.page,
            score: r.score,
            snippet: r.excerpt,
            matchCount: Math.floor(r.score / 10)
          }))
        });
        break;

      case 'get_page_text':
        const pText = searchIndex?.getPageText(payload.page) || null;
        ctx.postMessage({ type: 'page_text', page: payload.page, text: pText });
        break;

      case 'debug_status':
        ctx.postMessage({
          type: 'status',
          status: {
            indexed: processedPages.size,
            total: totalPages,
            queue: priorityQueue.length,
            stats: searchIndex?.getStats() || null
          }
        });
        break;
    }
  } catch (error: any) {
    console.error('[MinerWorker] Error:', error);
    ctx.postMessage({ type: 'ERROR', id, error: error.message });
  }
};

// ==========================================
// NEW INDEX BUILDER (User spec)
// ==========================================

/**
 * Build index from raw PDF data (new API)
 */
async function buildIndex(pdfData: ArrayBuffer): Promise<void> {
  if (isIndexing) {
    console.log('[MinerWorker] Already indexing, skipping');
    return;
  }
  isIndexing = true;

  searchIndex = new InvertedIndex();
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  console.log(`[MinerWorker] Building index for ${numPages} pages...`);

  // Process all pages in batches
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ');

      searchIndex.addPage(i, text);

      // Report progress every 10%
      if (i % Math.ceil(numPages / 10) === 0) {
        ctx.postMessage({
          type: 'PROGRESS',
          payload: { percent: Math.round((i / numPages) * 100) }
        });
      }
    } catch (err) {
      console.warn(`[MinerWorker] Skipped page ${i}`);
    }
  }

  isIndexing = false;
  console.log('[MinerWorker] Index build complete', searchIndex.getStats());
}

// ==========================================
// LEGACY INIT (Backward compatible)
// ==========================================

/**
 * Main Initialization Logic (legacy API)
 * 1. Load PDF
 * 2. Scout First 20 + Last 50
 * 3. Scan for "Subject" references
 * 4. Fill Priority Queue
 * 5. Start Processor
 */
async function handleInitPDF(buffer: ArrayBuffer, subject?: string) {
  // Reset
  processedPages.clear();
  searchIndex = new InvertedIndex();
  priorityQueue = [];

  // Load Doc
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  pdfDoc = await loadingTask.promise;
  totalPages = pdfDoc.numPages;

  ctx.postMessage({ type: 'progress', message: 'PDF Loaded. Scouting...', percent: 0 });

  // 1. Scout Phase: First 20 + Last 50 pages
  const scoutPages = new Set<number>();
  for (let i = 1; i <= Math.min(20, totalPages); i++) scoutPages.add(i);
  for (let i = Math.max(1, totalPages - 50); i <= totalPages; i++) scoutPages.add(i);

  // Extract Scout Text immediately
  const scoutTextArr = await extractPages(Array.from(scoutPages));

  // Index Scouted Pages
  scoutTextArr.forEach(p => {
    searchIndex!.addPage(p.page, p.content);
    processedPages.add(p.page);
  });

  ctx.postMessage({ type: 'progress', message: 'Scout Complete. Analyzing Priority...', percent: 5 });

  // 2. Map Phase (Subject Priority)
  const prioritizedPages = new Set<number>();

  if (subject) {
    const combinedScoutText = scoutTextArr.map(p => p.content).join('\n');

    // Look for subject + page numbers in TOC/Index
    const subjectRegex = new RegExp(`${subject}[^0-9\\n]{0,50}(\\d+(?:[-,]\\d+)*)`, 'gi');
    let match;
    while ((match = subjectRegex.exec(combinedScoutText)) !== null) {
      if (match[1]) {
        const nums = match[1].match(/\d+/g);
        nums?.forEach(n => {
          const p = parseInt(n);
          if (p > 0 && p <= totalPages && !processedPages.has(p)) {
            prioritizedPages.add(p);
          }
        });
      }
    }

    if (prioritizedPages.size > 0) {
      ctx.postMessage({
        type: 'info',
        message: `Prioritizing ${prioritizedPages.size} pages related to "${subject}"`
      });
    }
  }

  // 3. Build Queue: Priority pages first, then the rest
  priorityQueue.push(...Array.from(prioritizedPages));
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
 * Process the Queue in batches
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
        searchIndex!.addPage(p.page, p.content);
        processedPages.add(p.page);
      });

      // Report Progress
      const percent = Math.round((processedPages.size / totalPages) * 100);
      ctx.postMessage({
        type: 'progress',
        message: `Indexing... (${processedPages.size}/${totalPages})`,
        percent
      });

      // Yield to event loop briefly
      await new Promise(r => setTimeout(r, 50));

    } catch (e) {
      console.error('[MinerWorker] Batch Error', e);
    }
  }

  isIndexing = false;
  ctx.postMessage({ type: 'progress', message: 'Indexing Complete', percent: 100 });
}

/**
 * Extract text from specific pages
 */
async function extractPages(pages: number[]): Promise<{ page: number; content: string }[]> {
  if (!pdfDoc) return [];
  const results = [];

  for (const pageNum of pages) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const str = content.items.map((item: any) => item.str).join(' ');
      results.push({ page: pageNum, content: str });
    } catch (e) {
      console.warn(`[MinerWorker] Failed to extract page ${pageNum}`);
    }
  }
  return results;
}

export { };
