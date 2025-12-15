/**
 * Local LLM with Transformers.js
 * Runs entirely in the browser - no API calls, complete privacy
 */

import { pipeline, env } from '@xenova/transformers';

// Configure for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton pipelines
let textGenerationPipeline: any = null;
let isLoading = false;
let loadingPromise: Promise<any> | null = null;

// Progress callback type
type ProgressCallback = (progress: { status: string; progress?: number }) => void;

/**
 * Initialize the local LLM model
 * Uses a small, fast model suitable for browser
 */
export async function initLocalLLM(onProgress?: ProgressCallback): Promise<boolean> {
    if (textGenerationPipeline) return true;

    if (isLoading && loadingPromise) {
        await loadingPromise;
        return !!textGenerationPipeline;
    }

    isLoading = true;

    try {
        onProgress?.({ status: 'Loading model...', progress: 0 });

        // Use Phi-2 or TinyLlama which are small but capable
        // For even faster loading, we use a text2text model
        loadingPromise = pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-248M', {
            progress_callback: (data: any) => {
                if (data.progress !== undefined) {
                    onProgress?.({
                        status: `Downloading model: ${Math.round(data.progress)}%`,
                        progress: data.progress
                    });
                }
            }
        });

        textGenerationPipeline = await loadingPromise;
        onProgress?.({ status: 'Model ready!', progress: 100 });

        console.log('[LocalLLM] Model loaded successfully');
        return true;
    } catch (error) {
        console.error('[LocalLLM] Failed to load model:', error);
        onProgress?.({ status: 'Failed to load model' });
        return false;
    } finally {
        isLoading = false;
        loadingPromise = null;
    }
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
    return !!textGenerationPipeline;
}

/**
 * Answer a question using local LLM
 */
export async function answerQuestionLocal(
    question: string,
    context: string,
    onProgress?: ProgressCallback
): Promise<string> {
    // Initialize model if needed
    if (!textGenerationPipeline) {
        const success = await initLocalLLM(onProgress);
        if (!success) {
            throw new Error('Failed to load local LLM model');
        }
    }

    onProgress?.({ status: 'Generating answer...' });

    // Truncate context to fit model limits (T5 models have ~512 token limit)
    const truncatedContext = context.slice(0, 2000);

    // Craft a prompt for Q&A
    const prompt = `Answer the question based on the context.

Context: ${truncatedContext}

Question: ${question}

Answer:`;

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: 150,
            temperature: 0.3,
            do_sample: true,
        });

        const answer = result[0]?.generated_text || 'Could not generate an answer.';
        onProgress?.({ status: 'Done!' });

        return answer.trim();
    } catch (error) {
        console.error('[LocalLLM] Generation error:', error);
        throw new Error('Failed to generate answer');
    }
}

/**
 * Summarize text using local LLM
 */
export async function summarizeLocal(
    text: string,
    onProgress?: ProgressCallback
): Promise<string> {
    if (!textGenerationPipeline) {
        const success = await initLocalLLM(onProgress);
        if (!success) {
            throw new Error('Failed to load local LLM model');
        }
    }

    onProgress?.({ status: 'Summarizing...' });

    const truncatedText = text.slice(0, 2000);
    const prompt = `Summarize the following text concisely:\n\n${truncatedText}`;

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: 100,
            temperature: 0.3,
        });

        return result[0]?.generated_text?.trim() || 'Could not generate summary.';
    } catch (error) {
        console.error('[LocalLLM] Summarization error:', error);
        throw new Error('Failed to generate summary');
    }
}
