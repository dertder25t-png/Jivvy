
import { pdfjs } from 'react-pdf';

// Ensure worker is set up correctly.
// In a Next.js environment, we typically rely on the app to set this up globally,
// but for this utility to be standalone or work in workers, we might need to be careful.
// If running in the main thread (client), react-pdf usually handles this if configured.
// If running in a worker, we might need to set it explicitly.

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface IndexEntry {
  term: string;
  pages: number[];
}

export class PDFGlossaryScanner {
  private pdfDoc: any = null;
  public numPages: number = 0;

  async loadPDF(url: string | File | Blob) {
    // pdfjs.getDocument can handle URL, TypedArray, ArrayBuffer, File, etc.
    // However, TypeScript might complain if we pass File/Blob directly to getDocument which expects specific types.
    // We cast to any to bypass type check for File/Blob which are supported by pdf.js but maybe not fully typed in this version of @types/pdfjs-dist or react-pdf exports.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadingTask = pdfjs.getDocument(url as any);
    this.pdfDoc = await loadingTask.promise;
    this.numPages = this.pdfDoc.numPages;
    return this.pdfDoc.numPages;
  }

  async findIndexPage(): Promise<number | null> {
    if (!this.pdfDoc) throw new Error("PDF not loaded");

    const numPages = this.pdfDoc.numPages;
    // Scan last 10% or at least last 5 pages
    const pagesToScanCount = Math.max(5, Math.floor(numPages * 0.1));
    const startPage = Math.max(1, numPages - pagesToScanCount);

    // Scan backwards from the end
    for (let i = numPages; i >= startPage; i--) {
      const page = await this.pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str).join(' ');

      // Check header (rough heuristic: start of text)
      // We look for "Index" or "Glossary" in the first 500 characters
      const headerText = textItems.substring(0, 500).toLowerCase();

      if (headerText.includes('index') || headerText.includes('glossary')) {
        // Double check it's likely a title, not just a mention
        // If it's very short or has "Index" followed by newline or large gap, it's a good candidate.
        return i;
      }
    }
    return null;
  }

  async parseIndexPage(pageNumber: number): Promise<IndexEntry[]> {
    if (!this.pdfDoc) throw new Error("PDF not loaded");

    const page = await this.pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    const entries: IndexEntry[] = [];
    // Regex from roadmap: /(.+?)(?:\.{2,}|…+)\s*(\d+(?:,\s*\d+)*)/
    // This regex looks for:
    // 1. Term (lazy)
    // 2. Dots (2 or more) or Ellipsis
    // 3. Optional whitespace
    // 4. Page numbers (digit, comma separated)
    const regex = /(.+?)(?:\.{2,}|…+)\s*(\d+(?:,\s*\d+)*)/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const term = match[1].trim();
        const pagesStr = match[2];
        const pages = pagesStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));

        if (term && pages.length > 0) {
            entries.push({ term, pages });
        }
    }

    return entries;
  }

  async extractTextFromPages(pageNumbers: number[]): Promise<Map<number, string>> {
      if (!this.pdfDoc) throw new Error("PDF not loaded");

      const results = new Map<number, string>();
      for (const pageNum of pageNumbers) {
          if (pageNum > 0 && pageNum <= this.pdfDoc.numPages) {
              const page = await this.pdfDoc.getPage(pageNum);
              const textContent = await page.getTextContent();
              const text = textContent.items.map((item: any) => item.str).join(' ');
              results.set(pageNum, text);
          }
      }
      return results;
  }
}

export function searchGlossary(query: string, indexEntries: IndexEntry[]): IndexEntry[] {
    const q = query.toLowerCase();
    return indexEntries.filter(entry => entry.term.toLowerCase().includes(q));
}
