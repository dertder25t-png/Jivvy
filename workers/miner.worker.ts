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
 * - GET_TOPIC_MAP: Get topic map with sections and content types
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
let topicMap: TopicMap | null = null;

// Topic Map Types (Strategy 3: Topic Mapping)
interface TopicEntry {
    title: string;
    normalizedTitle: string;
    startPage: number;
    endPage: number;
    contentTypes: ContentType[];
    keywords: string[];
    depth: number;
}

type ContentType = 'explanation' | 'glossary' | 'table' | 'diagram' | 'procedure' | 'formula' | 'warning' | 'example';

interface TopicMap {
    topics: TopicEntry[];
    pageToTopics: Map<number, TopicEntry[]>;
    contentTypePages: Map<ContentType, number[]>;
    totalPages: number;
}

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
        // Build topic map (Strategy 3)
        topicMap = buildTopicMap(pageTextCache, totalPages);
        ctx.postMessage({ type: 'TOPIC_MAP_READY', payload: serializeTopicMap(topicMap) });
        ctx.postMessage({ type: 'INDEX_READY', id });
        break;

      case 'SEARCH':
        if (!searchIndex) throw new Error("Index not ready");
        const filterSet = payload.filterPages ? new Set(payload.filterPages as number[]) : undefined;
        const candidates = findCandidates(searchIndex, payload.query, 12, filterSet); // Get top 12 chunks
        ctx.postMessage({ type: 'SEARCH_RESULT', id, payload: candidates });
        break;

      case 'GET_TOPIC_MAP':
        if (!topicMap) {
          ctx.postMessage({ type: 'TOPIC_MAP_RESULT', id, payload: null });
        } else {
          ctx.postMessage({ type: 'TOPIC_MAP_RESULT', id, payload: serializeTopicMap(topicMap) });
        }
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

// ==========================================
// TOPIC MAP BUILDER (Strategy 3)
// ==========================================

const HEADER_PATTERNS = [
    /^(?:Chapter|Section|Part)\s+\d+[\.:]\s*(.+)/i,
    /^\d+(?:\.\d+)*\s+([A-Z][A-Za-z\s]+)/,
    /^(?:I{1,3}|IV|V|VI{0,3}|IX|X)[\.:]\s*(.+)/i,
    /^([A-Z][A-Z\s]{3,50})$/,
];

const CONTENT_TYPE_PATTERNS: Record<ContentType, RegExp[]> = {
    explanation: [/\bexplain|describ|defin|means?\b.*\bis\b/i],
    glossary: [/\bglossary|definitions?\b/i, /^[A-Z][a-z]+:\s+[A-Z]/m],
    table: [/\btable\s+\d+/i, /\|\s*\w+\s*\|/],
    diagram: [/\bfigure\s+\d+|diagram|schematic/i],
    procedure: [/\bstep\s+\d+|procedure|how\s+to\b/i, /^\s*\d+\.\s+[A-Z]/m],
    formula: [/[=><≤≥±]\s*\d|equation|formula/i],
    warning: [/\bwarning|caution|danger|note:\b/i],
    example: [/\bexample|e\.g\.|for\s+instance/i]
};

function buildTopicMap(pageTexts: Map<number, string>, totalPagesCount: number): TopicMap {
    const topics: TopicEntry[] = [];
    const pageToTopics = new Map<number, TopicEntry[]>();
    const contentTypePages = new Map<ContentType, number[]>();
    
    // Initialize content type pages
    for (const type of Object.keys(CONTENT_TYPE_PATTERNS) as ContentType[]) {
        contentTypePages.set(type, []);
    }
    
    let currentTopic: TopicEntry | null = null;
    const pageEntries = Array.from(pageTexts.entries()).sort((a, b) => a[0] - b[0]);
    
    for (const [pageNum, text] of pageEntries) {
        const lines = text.split('\n').slice(0, 10);
        
        // Detect headers
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length < 3 || trimmed.length > 100) continue;
            
            for (const pattern of HEADER_PATTERNS) {
                const match = trimmed.match(pattern);
                if (match) {
                    if (currentTopic) {
                        currentTopic.endPage = pageNum - 1;
                    }
                    
                    const title = match[1] || trimmed;
                    currentTopic = {
                        title: title.trim(),
                        normalizedTitle: title.toLowerCase().replace(/[^\w\s]/g, ' ').trim(),
                        startPage: pageNum,
                        endPage: totalPagesCount,
                        contentTypes: [],
                        keywords: title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2),
                        depth: detectHeaderDepth(trimmed)
                    };
                    topics.push(currentTopic);
                    break;
                }
            }
        }
        
        // Detect content types
        for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    contentTypePages.get(type as ContentType)?.push(pageNum);
                    if (currentTopic && !currentTopic.contentTypes.includes(type as ContentType)) {
                        currentTopic.contentTypes.push(type as ContentType);
                    }
                    break;
                }
            }
        }
        
        // Build page-to-topics mapping
        const topicsForPage = topics.filter(t => pageNum >= t.startPage && pageNum <= t.endPage);
        if (topicsForPage.length > 0) {
            pageToTopics.set(pageNum, topicsForPage);
        }
    }
    
    if (currentTopic) {
        currentTopic.endPage = totalPagesCount;
    }
    
    return { topics, pageToTopics, contentTypePages, totalPages: totalPagesCount };
}

function detectHeaderDepth(text: string): number {
    const numberMatch = text.match(/^(\d+(?:\.\d+)*)/);
    if (numberMatch) return numberMatch[1].split('.').length;
    if (/^chapter/i.test(text)) return 1;
    if (/^section/i.test(text)) return 2;
    if (/^[A-Z\s]+$/.test(text)) return 1;
    return 2;
}

function serializeTopicMap(tm: TopicMap): {
    topics: TopicEntry[];
    contentTypePages: Record<ContentType, number[]>;
    totalPages: number;
} {
    return {
        topics: tm.topics,
        contentTypePages: Object.fromEntries(tm.contentTypePages) as Record<ContentType, number[]>,
        totalPages: tm.totalPages
    };
}

export {};
