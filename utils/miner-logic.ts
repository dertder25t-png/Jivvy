/**
 * PDF Miner Worker - Inverted Index Builder
 * 
 * Runs in background thread to:
 * 1. Extract text from PDF pages (via PDF.js)
 * 2. Build inverted index for O(1) term lookups
 * 3. Detect subject-relevant pages for boosting
 * 4. Handle search queries without blocking UI
 * 
 * Performance: Indexes 1000-page PDF in ~30s
 */

import * as pdfjsLib from 'pdfjs-dist';
import { SearchIndexer, SearchResult } from '../utils/search-indexer';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================================================
// STATE
// ============================================================================

let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
let searchIndexer: SearchIndexer | null = null;
let isIndexed = false;
let subject: string | undefined;

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'init_pdf':
        await handleInitPDF(payload.pdfBuffer, payload.subject);
        break;

      case 'search_pdf':
        await handleSearch(payload.query);
        break;

      case 'get_page_text':
        await handleGetPageText(payload.page);
        break;

      default:
        console.warn('[Worker] Unknown message type:', type);
    }
  } catch (error) {
    sendError(error);
  }
};

// ============================================================================
// INIT PDF - Build Inverted Index
// ============================================================================

async function handleInitPDF(pdfBuffer: ArrayBuffer, subjectHint?: string) {
  try {
    sendProgress('Loading PDF document...', 0);

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    pdfDocument = await loadingTask.promise;

    const numPages = pdfDocument.numPages;
    sendProgress(`Loaded ${numPages} pages`, 5);

    // Initialize indexer
    searchIndexer = new SearchIndexer();
    subject = subjectHint;

    sendProgress('Building search index...', 10);

    // Phase 1: Subject Scouting (if hint provided)
    let subjectPages: number[] = [];
    if (subject) {
      sendProgress(`Scouting for "${subject}" chapters...`, 15);
      subjectPages = await scoutSubjectPages(pdfDocument, subject, numPages);
      searchIndexer.setSubjectPages(subjectPages);
      sendInfo(`Found ${subjectPages.length} subject-relevant pages`);
    }

    // Phase 2: Index all pages
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();

      // Extract text
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      // Add to index
      searchIndexer.addPage(i, text);

      // Report progress
      const progress = 15 + Math.floor((i / numPages) * 80);
      if (i % 10 === 0 || i === numPages) {
        sendProgress(`Indexing page ${i}/${numPages}...`, progress);
      }
    }

    isIndexed = true;
    sendProgress('Index complete!', 100);
    sendStatus({ indexed: true, numPages, subjectPages: subjectPages.length });

  } catch (error) {
    console.error('[Worker] Init error:', error);
    sendError(error);
  }
}

// ============================================================================
// SUBJECT SCOUTING
// ============================================================================

/**
 * Identify pages relevant to the subject (for boosting)
 * 
 * Strategy:
 * 1. Sample pages (every 10th page + TOC area)
 * 2. Find pages with high subject term density
 * 3. Expand around clusters (if page N matches, check N-1, N+1)
 */
async function scoutSubjectPages(
  pdf: pdfjsLib.PDFDocumentProxy,
  subject: string,
  numPages: number
): Promise<number[]> {

  const subjectTerms = subject.toLowerCase().split(/\s+/);
  const relevantPages: number[] = [];
  const DENSITY_THRESHOLD = 0.5; // terms per 1000 chars

  // 1. Sample key areas
  const samplesToCheck = [
    ...Array.from({ length: Math.min(20, numPages) }, (_, i) => i + 1), // First 20 pages (TOC)
    ...Array.from({ length: numPages }, (_, i) => i + 1).filter(p => p % 10 === 0) // Every 10th
  ];

  for (const pageNum of samplesToCheck) {
    if (pageNum > numPages) continue;

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();

    // Calculate term density
    const termCount = subjectTerms.reduce((count, term) => {
      return count + (text.match(new RegExp(term, 'g')) || []).length;
    }, 0);

    const density = termCount / (text.length / 1000);

    if (density >= DENSITY_THRESHOLD) {
      relevantPages.push(pageNum);
    }
  }

  // 2. Expand around clusters
  const expanded = new Set(relevantPages);
  for (const pageNum of relevantPages) {
    if (pageNum > 1) expanded.add(pageNum - 1);
    if (pageNum < numPages) expanded.add(pageNum + 1);
  }

  return Array.from(expanded).sort((a, b) => a - b);
}

// ============================================================================
// SEARCH
// ============================================================================

async function handleSearch(query: string) {
  if (!searchIndexer || !isIndexed) {
    sendError(new Error('PDF not indexed yet'));
    return;
  }

  try {
    const results = searchIndexer.search(query);
    sendSearchResults(results);
  } catch (error) {
    sendError(error);
  }
}

// ============================================================================
// GET PAGE TEXT
// ============================================================================

async function handleGetPageText(pageNum: number) {
  if (!searchIndexer) {
    sendError(new Error('PDF not loaded'));
    return;
  }

  try {
    const text = searchIndexer.getPageText(pageNum);
    sendPageText(pageNum, text);
  } catch (error) {
    sendError(error);
  }
}

// ============================================================================
// MESSAGE SENDERS
// ============================================================================

function sendProgress(message: string, percent: number) {
  self.postMessage({ type: 'progress', message, percent });
}

function sendStatus(status: any) {
  self.postMessage({ type: 'status', status });
}

function sendInfo(message: string) {
  self.postMessage({ type: 'info', message });
}

function sendError(error: any) {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ type: 'error', error: message });
}

function sendSearchResults(results: SearchResult[]) {
  self.postMessage({ type: 'search_results', results });
}

function sendPageText(page: number, text: string | null) {
  self.postMessage({ type: 'page_text', page, text });
}