
import { pipeline, env } from '@xenova/transformers';
import { calcPatch } from 'fast-myers-diff';
import { safeLogError, toAppError } from '../lib/errors';

// Skip local model checks since we're running in the browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class GrammarCorrectionSingleton {
  static task = 'text2text-generation';
  static model = 'Xenova/grammar-correction'; // or 'Xenova/gec-t5-small' for speed
  static instance: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.instance = await pipeline(this.task as any, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { text, type, requestId } = event.data;

  if (type === 'check') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generator = await GrammarCorrectionSingleton.getInstance((data: any) => {
          self.postMessage({ type: 'progress', data, requestId });
      });

      const output = await generator(text);
      const corrected = output[0]?.generated_text;

      // Calculate diffs
      const diffs = [];
      if (corrected && corrected !== text) {
          // fast-myers-diff returns iterator of [sx, ex, correction, ey]
          const patches = Array.from(calcPatch(text, corrected));

          for (const [sx, ex, correction] of patches) {
              diffs.push({
                  from: sx,
                  to: ex,
                  correction: correction
              });
          }
      }

      self.postMessage({
        type: 'result',
        requestId,
        text: text,
        corrected: corrected,
        diffs: diffs
      });

    } catch (error) {
      safeLogError('GrammarWorker.check', error);
      self.postMessage({
        type: 'error',
        requestId,
        error: toAppError(error, {
          code: 'WORKER_GRAMMAR_FAILED',
          message: 'Grammar check failed',
          retryable: true,
        }),
      });
    }
  }
});
