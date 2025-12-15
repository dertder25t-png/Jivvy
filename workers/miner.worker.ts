
import { scanForIndex, extractSpecificPages } from '../utils/pdf-extraction';
import { mineMetric } from '../utils/miner-logic';

const ctx: Worker = self as any;

ctx.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'SCAN_INDEX':
        const indexData = await scanForIndex(payload.pdfBuffer);
        ctx.postMessage({ type: 'INDEX_RESULT', data: indexData });
        break;

      case 'EXTRACT_PAGES':
        const pageData = await extractSpecificPages(payload.pdfBuffer, payload.pages);
        ctx.postMessage({ type: 'PAGES_RESULT', data: pageData });
        break;

      case 'MINE_METRIC':
        const { chunks, metric, keywords } = payload;
        const result = await mineMetric(chunks, metric, keywords);
        ctx.postMessage({ type: 'METRIC_RESULT', metric, data: result });
        break;

      default:
        console.warn('Unknown worker command:', type);
    }
  } catch (error) {
    ctx.postMessage({ type: 'ERROR', error: error });
  }
};
