
import { pipeline, env } from '@xenova/transformers';

// Skip local checks for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

// Define specific small models for specific tasks
const MODELS = {
    // Ultra-light model for simple extraction (77M params)
    'flashcard-fast': 'Xenova/LaMini-Flan-T5-77M',
    // Slightly better reasoning (248M params)
    'flashcard-balanced': 'Xenova/LaMini-Flan-T5-248M', 
    // The previous large model (0.5B params) - keeping as backup
    'flashcard-quality': 'Xenova/Qwen1.5-0.5B-Chat' 
};

type ModelSize = keyof typeof MODELS;

let generator: any = null;
let currentModel: ModelSize | null = null;

self.onmessage = async (event: MessageEvent) => {
    const { type, text, prompt: inputPrompt, modelSize = 'flashcard-fast', requestId } = event.data;

    if (type === 'generate') {
        try {
            if (!generator || currentModel !== modelSize) {
                // Determine model ID
                const modelId = MODELS[modelSize as ModelSize] || MODELS['flashcard-fast'];
                
                self.postMessage({ type: 'progress', status: 'loading', message: `Loading ${modelSize}...` });
                
                // Dispose previous if any (though transformers.js doesn't expose dispose on pipeline easily, we just overwrite)
                generator = await pipeline('text2text-generation', modelId, {
                    quantized: true,
                    progress_callback: (progress: any) => {
                        self.postMessage({ 
                            type: 'progress', 
                            status: 'loading', 
                            progress: progress.status === 'progress' ? progress.progress : 0 
                        });
                    }
                });
                currentModel = modelSize;
            }

            self.postMessage({ type: 'progress', status: 'generating', message: 'Analyzing notes...' });

            const prompt = inputPrompt || `
Extract flashcards from the following notes. 
Format: Front | Back
Focus on key terms and definitions.
Notes:
${text}
`;

            const output = await generator(prompt, {
                max_new_tokens: 300,
                temperature: 0.3,
                repetition_penalty: 1.2
            });

            const generatedText = output[0]?.generated_text || '';
            
            self.postMessage({ 
                type: 'result', 
                text: generatedText,
                requestId 
            });

        } catch (error) {
            console.error('LLM Worker Error:', error);
            self.postMessage({ 
                type: 'error', 
                error: String(error), 
                requestId 
            });
        }
    }
};
