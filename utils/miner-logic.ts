
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks if offline (optional, good for production)
env.allowLocalModels = false;

// Singleton pattern to prevent reloading model
let extractorPipeline: any = null;

export async function getExtractor() {
  if (!extractorPipeline) {
    extractorPipeline = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M');
  }
  return extractorPipeline;
}

export async function mineMetric(chunks: string[], metricName: string, keywords: string[]) {
  // 1. Filter: Find chunks containing keywords (Fast)
  const relevantChunks = chunks.filter(chunk =>
    keywords.some(kw => chunk.toLowerCase().includes(kw.toLowerCase()))
  );

  if (relevantChunks.length === 0) return { value: "Not Found", confidence: 0 };

  // 2. Context: Take top 3 chunks, max 1500 chars (Save memory)
  const context = relevantChunks.slice(0, 3).join(' ').substring(0, 1500);

  // 3. AI Extraction (Slow/Smart)
  const extractor = await getExtractor();
  const prompt = `Extract the value for "${metricName}" from the text below. Return ONLY the number or short value. \n\nContext: ${context}`;

  try {
    const result = await extractor(prompt, { max_new_tokens: 20, temperature: 0.1 });
    return { value: result[0].generated_text, confidence: 0.9, pageContext: "Derived from keyword match" };
  } catch (err) {
    console.error("AI Error:", err);
    return { value: "Error", confidence: 0 };
  }
}
