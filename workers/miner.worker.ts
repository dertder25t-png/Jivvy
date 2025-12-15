
import { scanForIndex, extractSpecificPages } from '../utils/pdf-extraction';
import { mineMetric } from '../utils/miner-logic';

const ctx: Worker = self as any;

ctx.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'SCAN_INDEX':
        console.log('[Worker] Starting index scan...');
        const startTime = performance.now();
        const indexData = await scanForIndex(payload.pdfBuffer);
        const duration = Math.round(performance.now() - startTime);
        console.log(`[Worker] Index scan completed in ${duration}ms, found ${indexData.length} terms`);
        ctx.postMessage({ type: 'INDEX_RESULT', data: indexData });
        break;

      case 'EXTRACT_PAGES':
        const pageData = await extractSpecificPages(payload.pdfBuffer, payload.pages);
        ctx.postMessage({ type: 'PAGES_RESULT', data: pageData });
        break;

      case 'MINE_METRIC':
        console.log('[Worker] Starting metric mining...');
        const mineStart = performance.now();
        const { pdfBuffer, chunks, metric, keywords } = payload;

        // Use pdfBuffer if provided, otherwise use chunks
        const dataToProcess = pdfBuffer || chunks || [];
        const result = await mineMetric(dataToProcess, metric, keywords);

        const mineDuration = Math.round(performance.now() - mineStart);
        console.log(`[Worker] Metric mining completed in ${mineDuration}ms`);
        ctx.postMessage({ type: 'METRIC_RESULT', metric, data: result });
        break;

      default:
        console.warn('[Worker] Unknown command:', type);
    }
  } catch (error) {
    console.error('[Worker] Error processing:', error);
    ctx.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Signal that worker is ready
console.log('[Worker] Miner worker initialized');
