
import { PDFGlossaryScanner } from './pdf-extraction';

export interface MetricSchema {
  label: string;
  keywords: string[];
  type?: 'currency' | 'number' | 'text';
}

export interface ExtractedMetric {
  schema: MetricSchema;
  value: number | string;
  page: number;
  originalText: string;
}

export class UnstructuredMiner {
  private scanner: PDFGlossaryScanner;
  private worker: Worker | null = null;

  constructor(scanner: PDFGlossaryScanner) {
    this.scanner = scanner;
  }

  initWorker() {
    if (typeof window !== 'undefined' && !this.worker) {
      this.worker = new Worker(new URL('../workers/miner.worker.ts', import.meta.url));
    }
  }

  terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  keywordFilter(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
  }

  async runAI(text: string, prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
          if (!this.worker) {
              this.initWorker();
          }

          if (!this.worker) {
              reject("Worker could not be initialized");
              return;
          }

          const handler = (event: MessageEvent) => {
              const { type, result, error } = event.data;
              if (type === 'result') {
                  this.worker?.removeEventListener('message', handler);
                  resolve(result);
              } else if (type === 'error') {
                  this.worker?.removeEventListener('message', handler);
                  reject(error);
              }
          };

          this.worker.addEventListener('message', handler);
          this.worker.postMessage({ type: 'extract', text, prompt });
      });
  }

  async extractMetric(schema: MetricSchema): Promise<ExtractedMetric[]> {
    if (!this.scanner || !this.scanner.numPages) throw new Error("Scanner not initialized or PDF not loaded");

    const results: ExtractedMetric[] = [];

    // Loop through all pages
    for (let i = 1; i <= this.scanner.numPages; i++) {
        // We fetch text page by page.
        // Optimization: We could fetch all text at once if PDF is small, but chunking by page is safer.
        const pageTextMap = await this.scanner.extractTextFromPages([i]);
        const text = pageTextMap.get(i);

        if (text && this.keywordFilter(text, schema.keywords)) {
            // Found keywords, now run AI
            try {
                const prompt = `Extract the exact value for '${schema.label}' from this text. Return only the number.`;
                const aiResult = await this.runAI(text, prompt);

                let value: string | number = aiResult;
                if (schema.type === 'currency' || schema.type === 'number') {
                    const parsed = parseCurrency(aiResult);
                    if (parsed !== null) value = parsed;
                }

                results.push({
                    schema,
                    value,
                    page: i,
                    originalText: aiResult // Or the chunk where it was found
                });
            } catch (err) {
                console.error(`Error processing page ${i}:`, err);
            }
        }
    }

    return results;
  }
}

export function parseCurrency(input: string): number | null {
  // Remove non-numeric characters except dot and minus
  // Handle K/M suffixes?
  // "$1.2M" -> 1200000
  // "1,200,000" -> 1200000

  if (!input) return null;

  let clean = input.toUpperCase().replace(/[^0-9.\-KM]/g, '');
  // Remove commas if they are thousands separators
  // Only remove commas if followed by 3 digits?
  // Simple check: remove all commas.
  // But wait, what if it's "1,23"? (European decimal). Assuming US/UK locale for now based on roadmap "$1.2M".

  let multiplier = 1;

  if (clean.endsWith('K')) {
    multiplier = 1000;
    clean = clean.slice(0, -1);
  } else if (clean.endsWith('M')) {
    multiplier = 1000000;
    clean = clean.slice(0, -1);
  }

  const val = parseFloat(clean);
  if (isNaN(val)) return null;

  return val * multiplier;
}
