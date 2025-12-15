
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we're running in the browser/worker
env.allowLocalModels = false;
env.useBrowserCache = true;

class ExtractionSingleton {
  static task = 'text2text-generation';
  static model = 'Xenova/LaMini-Flan-T5-783M';
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
  const { text, prompt, type } = event.data;

  if (type === 'extract') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generator = await ExtractionSingleton.getInstance((data: any) => {
          self.postMessage({ type: 'progress', data });
      });

      // Construct prompt for extraction
      // "Extract the exact value for 'Net Profit' from this text. Return only the number. Text: [Chunk]"
      const fullPrompt = `${prompt} Text: ${text}`;

      const output = await generator(fullPrompt, {
        max_new_tokens: 50, // Short answer expected
        temperature: 0.1, // Low temperature for deterministic/factual output
      });

      const result = output[0]?.generated_text;

      self.postMessage({
        type: 'result',
        result: result,
      });

    } catch (error) {
      console.error(error);
      self.postMessage({ type: 'error', error: String(error) });
    }
  }
});
