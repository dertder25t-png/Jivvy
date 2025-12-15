
import { pipeline, env } from '@xenova/transformers';
import { calcPatch } from 'fast-myers-diff';

// Skip local model checks since we're running in the browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class GrammarCorrectionSingleton {
  static task = 'text2text-generation';
  static model = 'Xenova/grammar-correction'; // or 'Xenova/gec-t5-small' for speed
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { text, type } = event.data;

  if (type === 'check') {
    try {
      const generator = await GrammarCorrectionSingleton.getInstance((data) => {
          self.postMessage({ type: 'progress', data });
      });

      const output = await generator(text);
      const corrected = output[0]?.generated_text;

      // Calculate diffs
      const diffs = [];
      if (corrected && corrected !== text) {
          // fast-myers-diff returns iterator of [sx, ex, correction, ey]
          const patches = [...calcPatch(text, corrected)];

          for (const [sx, ex, correction, ey] of patches) {
              diffs.push({
                  from: sx,
                  to: ex,
                  correction: correction
              });
          }
      }

      self.postMessage({
        type: 'result',
        text: text,
        corrected: corrected,
        diffs: diffs
      });

    } catch (error) {
      console.error(error);
      self.postMessage({ type: 'error', error: error.toString() });
    }
  }
});
