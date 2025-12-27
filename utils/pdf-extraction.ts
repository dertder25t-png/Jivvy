import { SearchResult } from './search-indexer';
import { SearchCandidate } from './search/types';

// Defines the interface for the Worker logic
type WorkerMessage =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'search_results'; results: SearchResult[] }
  | { type: 'SEARCH_RESULT'; id: string; payload: SearchCandidate[] }
  | { type: 'INDEX_READY'; id: string }
  | { type: 'OUTLINE_READY'; payload: any[] }
  | { type: 'page_text'; page: number; text: string | null }
  | { type: 'status'; status: any }
  | { type: 'info'; message: string }
  | { type: 'error'; error: string };

class PDFWorkerClient {
  private worker: Worker | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private outlineCache: any[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.worker = new Worker(new URL('../workers/miner.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event: MessageEvent) => {
        const data = event.data as WorkerMessage;
        if (data.type === 'OUTLINE_READY') {
            this.outlineCache = data.payload;
        }
        this.emit(data.type, data);
      };
    }
  }

  getOutline(): any[] {
      return this.outlineCache;
  }

  private emit(type: string, data: any) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  on(type: string, handler: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
  }

  off(type: string, handler: (data: any) => void) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      this.listeners.set(type, handlers.filter(h => h !== handler));
    }
  }

  // New API
  async initIndex(pdfData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (data: { id: string }) => {
            if (data.id === id) {
                this.off('INDEX_READY', handler as any);
                resolve();
            }
        };
        this.on('INDEX_READY', handler as any);
        this.worker?.postMessage({
            type: 'INIT_INDEX',
            id,
            payload: { pdfData }
        });
    });
  }

  async searchCandidates(query: string, filterPages?: Set<number>): Promise<SearchCandidate[]> {
      return new Promise((resolve) => {
          const id = Math.random().toString(36).substring(7);
          const handler = (data: { id: string; payload: SearchCandidate[] }) => {
              if (data.id === id) {
                  this.off('SEARCH_RESULT', handler as any);
                  resolve(data.payload);
              }
          };
          this.on('SEARCH_RESULT', handler as any);
          this.worker?.postMessage({
              type: 'SEARCH',
              id,
              payload: { query, filterPages }
          });
      });
  }

  async rerank(query: string, texts: string[]): Promise<{ index: number, score: number }[]> {
      return new Promise((resolve) => {
          const id = Math.random().toString(36).substring(7);
          const handler = (data: { id: string; payload: any[] }) => {
              if (data.id === id) {
                  this.off('RERANK_RESULT', handler as any);
                  resolve(data.payload);
              }
          };
          this.on('RERANK_RESULT', handler as any);
          this.worker?.postMessage({
              type: 'RERANK',
              id,
              payload: { query, texts }
          });
      });
  }

  // Legacy API (Wraps new API or Legacy Worker calls)
  init(pdfBuffer: ArrayBuffer, subject?: string) {
    this.worker?.postMessage({
      type: 'init_pdf',
      payload: { pdfBuffer, subject }
    });
  }

  async search(query: string): Promise<SearchResult[]> {
    return new Promise((resolve) => {
      const handler = (data: { results: SearchResult[] }) => {
        this.off('search_results', handler as any);
        resolve(data.results);
      };
      this.on('search_results', handler as any);
      this.worker?.postMessage({
        type: 'search_pdf',
        payload: { query }
      });
    });
  }

  async getPageText(page: number): Promise<string> {
    return new Promise((resolve) => {
      const handler = (data: { page: number; text: string | null }) => {
        if (data.page === page) {
          this.off('page_text', handler as any);
          resolve(data.text || '');
        }
      };
      this.on('page_text', handler as any);
      this.worker?.postMessage({
        type: 'get_page_text',
        payload: { page }
      });
    });
  }
}

// Singleton
export const pdfWorker = new PDFWorkerClient();

// Legacy Adapters to maintain AICommandCenter compatibility
// These now route to the Worker

export async function scanForIndex(pdfData: ArrayBuffer): Promise<{ term: string; pages: number[] }[]> {
  // Now handled by Worker Init
  // We just return empty or catch the init call here
  // But AICommandCenter calls this explicitly as a fallback.
  // We can just return [] and rely on the worker search.
  return [];
}

export async function extractAllText(pdfData: ArrayBuffer): Promise<string> {
  // We can't easily get ALL text from worker without streaming.
  // AICommandCenter used this for legacy reasons? Maybe not used in critical path.
  // We'll return empty string for now or throw.
  console.warn('extractAllText is deprecated for large PDFs');
  return "";
}

export async function searchPagesForTerms(
  pdfData: ArrayBuffer,
  searchTerms: string[],
  options: { maxResults?: number } = {}
): Promise<{ page: number; matchCount: number; matchedTerms: string[]; uniqueTermMatches: number }[]> {
  // Convert list of terms to single query for our indexer (or join them)
  const query = searchTerms.join(' ');
  const results = await pdfWorker.search(query);

  // Map SearchResult to the expected format
  return results.slice(0, options.maxResults || 10).map(r => ({
    page: r.page,
    matchCount: Math.floor(r.score / 10), // Convert score to approx match count
    matchedTerms: [], // Indexer doesn't return exact terms matched list yet
    uniqueTermMatches: r.matchType === 'phrase' ? 2 : 1
  }));
}

export async function extractSpecificPages(
  pdfData: ArrayBuffer, // Argument ignored, worker has state
  pageNumbers: number[]
): Promise<{ page: number; content: string }[]> {
  const results = await Promise.all(
    pageNumbers.map(async p => ({
      page: p,
      content: await pdfWorker.getPageText(p)
    }))
  );
  return results;
}
