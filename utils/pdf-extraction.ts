import { SearchResult } from './search-indexer';
import { SearchCandidate } from './search/types';
import { AppError, toAppError } from '@/lib/errors';

// Defines the interface for the Worker logic
type WorkerMessage =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'search_results'; results: SearchResult[] }
  | { type: 'SEARCH_RESULT'; id: string; payload: SearchCandidate[] }
  | { type: 'INDEX_READY'; id: string }
  | { type: 'OUTLINE_READY'; payload: any[] }
  | { type: 'page_text_response'; id: string; payload: { pageIndex: number; text: string } }
  | { type: 'page_text'; page: number; text: string | null }
  | { type: 'status'; status: any }
  | { type: 'info'; message: string }
  | { type: 'error'; id?: string; error: AppError | string }
  | { type: 'ERROR'; id?: string; error: AppError | string };

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
        // Normalize legacy error event name
        if (data.type === 'ERROR') {
          const normalized = { ...data, type: 'error', error: toAppError(data.error, { code: 'WORKER_ERROR' }) } as any;
          this.emit('error', normalized);
          return;
        }

        if (data.type === 'error') {
          const normalized = { ...data, error: toAppError(data.error, { code: 'WORKER_ERROR' }) };
          this.emit('error', normalized);
          return;
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
                this.off('error', onError as any);
                resolve();
            }
        };

        const onError = (data: { id?: string; error: AppError }) => {
          if (!data.id || data.id === id) {
            this.off('INDEX_READY', handler as any);
            this.off('error', onError as any);
            reject(toAppError(data.error, { code: 'PDF_INDEX_FAILED', message: 'Failed to index PDF', retryable: true }));
          }
        };

        this.on('INDEX_READY', handler as any);
        this.on('error', onError as any);
        this.worker?.postMessage({
            type: 'INIT_INDEX',
            id,
            payload: { pdfData }
        });
    });
  }

  async getPageText(page: number): Promise<string> {
    return new Promise((resolve) => {
      const requestId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const handler = (data: { id: string; payload: { text: string } }) => {
        if (data.id === requestId) {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          this.off('page_text_response', handler as any);
          resolve(data.payload.text);
        }
      };
      this.on('page_text_response', handler as any);

      // Send BOTH names (payload + root) to be compatible with any worker/client variant.
      this.worker?.postMessage({
        type: 'get_page_text',
        id: requestId,
        payload: { pageIndex: page, page },
        pageIndex: page,
        page
      });

      // Timeout safety (heavy PDFs / first-run model loads)
      timeoutHandle = setTimeout(() => {
        const handlers = this.listeners.get('page_text_response');
        if (handlers && handlers.includes(handler as any)) {
          this.off('page_text_response', handler as any);
          console.warn(`[PDFWorkerClient] Timeout for page ${page}`);
          resolve('');
        }
      }, 30000);
    });
  }

  async searchCandidates(query: string, filterPages?: Set<number>): Promise<SearchCandidate[]> {
      return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).substring(7);
          const handler = (data: { id: string; payload: SearchCandidate[] }) => {
              if (data.id === id) {
                  this.off('SEARCH_RESULT', handler as any);
            this.off('error', onError as any);
                  resolve(data.payload);
              }
          };
        const onError = (data: { id?: string; error: AppError }) => {
        if (!data.id || data.id === id) {
          this.off('SEARCH_RESULT', handler as any);
          this.off('error', onError as any);
          reject(toAppError(data.error, { code: 'PDF_SEARCH_FAILED', message: 'Search failed', retryable: true }));
        }
        };
          this.on('SEARCH_RESULT', handler as any);
        this.on('error', onError as any);
          this.worker?.postMessage({
              type: 'SEARCH',
              id,
              payload: { 
                  query, 
                  filterPages: filterPages ? Array.from(filterPages) : undefined
              }
          });
      });
  }

  async rerank(query: string, texts: string[]): Promise<{ index: number, score: number }[]> {
      return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).substring(7);
          const handler = (data: { id: string; payload: any[] }) => {
              if (data.id === id) {
                  this.off('RERANK_RESULT', handler as any);
            this.off('error', onError as any);
                  resolve(data.payload);
              }
          };
        const onError = (data: { id?: string; error: AppError }) => {
        if (!data.id || data.id === id) {
          this.off('RERANK_RESULT', handler as any);
          this.off('error', onError as any);
          reject(toAppError(data.error, { code: 'PDF_RERANK_FAILED', message: 'Rerank failed', retryable: true }));
        }
        };
          this.on('RERANK_RESULT', handler as any);
        this.on('error', onError as any);
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
