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

import * as pdfjsLib from 'pdfjs-dist';
import { chunkPageText } from '../utils/search/preprocessor';
import { buildIndex } from '../utils/search/indexer';
import { findCandidates } from '../utils/search/retriever';
import { IndexStructure, ChunkData } from '../utils/search/types';

// Define Worker Scope
const ctx: Worker = self as any;

// -- State --
let searchIndex: IndexStructure | null = null;
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let totalPages = 0;
const pageTextCache: Map<number, string> = new Map();

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
        await handleInitIndex(payload.pdfData);
        // Extract and send outline (Table of Contents)
        const outline = await extractOutline();
        ctx.postMessage({ type: 'OUTLINE_READY', payload: outline });
        ctx.postMessage({ type: 'INDEX_READY', id });
        break;

      case 'SEARCH':
        if (!searchIndex) throw new Error("Index not ready");
        const filterSet = payload.filterPages ? new Set(payload.filterPages as number[]) : undefined;
        const candidates = findCandidates(searchIndex, payload.query, 12, filterSet); // Get top 12 chunks
        ctx.postMessage({ type: 'SEARCH_RESULT', id, payload: candidates });
        break;

      // ==========================================
      // LEGACY API (backward compatibility)
      // ==========================================
      case 'init_pdf':
        // Legacy init just calls the new one
        await handleInitIndex(payload.pdfBuffer || payload.pdfData);
        break;

      case 'search_pdf':
        if (!searchIndex) {
          ctx.postMessage({ type: 'search_results', results: [] });
          break;
        }
        const legacyCandidates = findCandidates(searchIndex, payload.query, 5);
        // Map to legacy format
        ctx.postMessage({
          type: 'search_results',
          results: legacyCandidates.map(r => ({
            page: r.page,
            score: r.score * 10, // Scale up for legacy expectations
            snippet: r.excerpt,
            matchCount: Math.round(r.score)
          }))
        });
        break;

      case 'get_page_text':
        ctx.postMessage({ type: 'page_text', page: payload.page, text: pageTextCache.get(payload.page) ?? null });
        break;
    }
  } catch (error: any) {
    console.error('[MinerWorker] Error:', error);
    ctx.postMessage({ type: 'ERROR', id, error: error.message });
  }
};

// ==========================================
// INDEX BUILDER
// ==========================================

async function handleInitIndex(pdfData: ArrayBuffer) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

  const chunks: ChunkData[] = [];
  pageTextCache.clear();

    // Extract text from all pages
    // Note: For very large PDFs, we might want to chunk this or report progress
    for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
    pageTextCache.set(i, text);

    const pageChunks = chunkPageText(text, i, {
      targetTokens: 200,
      sentenceOverlap: 1
    });
    chunks.push(...pageChunks);
        
        // Report progress every 10 pages
        if (i % 10 === 0) {
             ctx.postMessage({ type: 'progress', message: `Indexing page ${i}/${totalPages}`, percent: (i / totalPages) * 100 });
        }
    }

  searchIndex = buildIndex(chunks);
  console.log(`[MinerWorker] Index built for ${totalPages} pages across ${chunks.length} chunks.`);
}

// ==========================================
// OUTLINE EXTRACTION
// ==========================================

interface OutlineItem {
    title: string;
    page: number;
    items: OutlineItem[];
}

async function extractOutline(): Promise<OutlineItem[]> {
    if (!pdfDoc) return [];
    
    try {
        const rawOutline = await pdfDoc.getOutline();
        if (!rawOutline) return [];

        const processItems = async (items: any[]): Promise<OutlineItem[]> => {
            const result: OutlineItem[] = [];
            for (const item of items) {
                let pageNumber = 0;
                try {
                    if (typeof item.dest === 'string') {
                        const dest = await pdfDoc!.getDestination(item.dest);
                        if (dest) {
                            const ref = dest[0];
                            pageNumber = (await pdfDoc!.getPageIndex(ref)) + 1;
                        }
                    } else if (Array.isArray(item.dest)) {
                        const ref = item.dest[0];
                        pageNumber = (await pdfDoc!.getPageIndex(ref)) + 1;
                    }
                } catch (e) {
                    console.warn('Failed to resolve outline destination', e);
                }

                if (pageNumber > 0) {
                    result.push({
                        title: item.title,
                        page: pageNumber,
                        items: await processItems(item.items || [])
                    });
                }
            }
            return result;
        };

        return await processItems(rawOutline);
    } catch (e) {
        console.error('Error extracting outline', e);
        return [];
    }
}

export {};
