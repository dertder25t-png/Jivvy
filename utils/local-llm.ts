/**
 * Local LLM with Transformers.js
 * Runs entirely in the browser - no API calls, complete privacy
 * Optimized for better performance and error handling
 */

import { pipeline, env } from '@xenova/transformers';

// Configure for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton pipeline - only load once
let textGenerationPipeline: any = null;
let isLoading = false;
let loadingPromise: Promise<any> | null = null;

// Progress callback type
type ProgressCallback = (progress: { status: string; progress?: number }) => void;

// Configuration constants
const MAX_CONTEXT_LENGTH = 2000;
const MAX_GENERATION_TOKENS = 150;
const DEFAULT_TEMPERATURE = 0.3;

/**
 * Initialize the local LLM model
 * Uses a small, fast model suitable for browser
 * Enhanced with better error handling and retry logic
 */
export async function initLocalLLM(onProgress?: ProgressCallback): Promise<boolean> {
    // Return immediately if already loaded
    if (textGenerationPipeline) {
        console.log('[LocalLLM] Model already loaded');
        return true;
    }

    // If already loading, wait for existing promise
    if (isLoading && loadingPromise) {
        console.log('[LocalLLM] Model loading in progress, waiting...');
        await loadingPromise;
        return !!textGenerationPipeline;
    }

    isLoading = true;

    try {
        onProgress?.({ status: 'Initializing model...', progress: 0 });

        // Use LaMini-Flan-T5-248M - small (248MB) but capable model
        // Good balance between size and performance for browser usage
        loadingPromise = pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-248M', {
            progress_callback: (data: any) => {
                if (data.status === 'progress' && data.progress !== undefined) {
                    onProgress?.({
                        status: `Downloading model: ${Math.round(data.progress)}%`,
                        progress: data.progress
                    });
                } else if (data.status === 'initiate') {
                    onProgress?.({
                        status: 'Starting download...',
                        progress: 0
                    });
                } else if (data.status === 'done') {
                    onProgress?.({
                        status: 'Download complete, initializing...',
                        progress: 95
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onProgress?.({ status: `Failed to load model: ${errorMessage}` });
        textGenerationPipeline = null; // Reset on failure
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
 * Improved prompt engineering and error handling
 */
export async function answerQuestionLocal(
    question: string,
    context: string,
    onProgress?: ProgressCallback
): Promise<string> {
    // Validate inputs
    if (!question || question.trim().length === 0) {
        throw new Error('Question cannot be empty');
    }

    if (!context || context.trim().length === 0) {
        throw new Error('Context cannot be empty');
    }

    // Initialize model if needed
    if (!textGenerationPipeline) {
        const success = await initLocalLLM(onProgress);
        if (!success) {
            throw new Error('Failed to load local LLM model. Please check your internet connection and try again.');
        }
    }

    onProgress?.({ status: 'Generating answer...' });

    // Truncate context to fit model limits (T5 models have ~512 token limit)
    // Using conservative limit for better results
    const truncatedContext = context.slice(0, MAX_CONTEXT_LENGTH);

    // Improved prompt for better results
    const prompt = `Answer the question based on the context.

Context: ${truncatedContext}

Question: ${question}

Answer:`;

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: MAX_GENERATION_TOKENS,
            temperature: DEFAULT_TEMPERATURE,
            do_sample: true,
            top_k: 50, // Limit vocabulary for more focused answers
            repetition_penalty: 1.2, // Reduce repetition
        });

        const answer = result[0]?.generated_text || 'Could not generate an answer.';
        onProgress?.({ status: 'Done!' });

        const trimmedAnswer = answer.trim();
        
        if (trimmedAnswer.length === 0) {
            return 'No answer could be generated from the provided context.';
        }

        return trimmedAnswer;
    } catch (error) {
        console.error('[LocalLLM] Generation error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to generate answer: ${errorMessage}`);
    }
}

/**
 * Summarize text using local LLM
 * Improved summarization with better prompts
 */
export async function summarizeLocal(
    text: string,
    onProgress?: ProgressCallback
): Promise<string> {
    // Validate input
    if (!text || text.trim().length === 0) {
        throw new Error('Text to summarize cannot be empty');
    }

    // Initialize model if needed
    if (!textGenerationPipeline) {
        const success = await initLocalLLM(onProgress);
        if (!success) {
            throw new Error('Failed to load local LLM model. Please check your internet connection and try again.');
        }
    }

    onProgress?.({ status: 'Summarizing...' });

    // Truncate text for model limits
    const truncatedText = text.slice(0, MAX_CONTEXT_LENGTH);
    
    // Improved prompt for better summaries
    const prompt = `Summarize the following text concisely:\n\n${truncatedText}\n\nSummary:`;

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: 100,
            temperature: DEFAULT_TEMPERATURE,
            do_sample: true,
            top_k: 50,
            repetition_penalty: 1.2,
        });

        const summary = result[0]?.generated_text?.trim() || 'Could not generate summary.';
        onProgress?.({ status: 'Done!' });

        return summary;
    } catch (error) {
        console.error('[LocalLLM] Summarization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to generate summary: ${errorMessage}`);
    }
}

/**
 * Extract search keywords from a user question
 * Uses the LLM to identify technical terms for index lookup
 */
export async function extractKeywords(
    question: string,
    onProgress?: ProgressCallback
): Promise<string[]> {
    if (!textGenerationPipeline) await initLocalLLM(onProgress);

    // Prompt specifically for the FLAN-T5 model to pull out nouns/topics
    const prompt = `Extract the main technical topics from this question. Return them as a comma-separated list.

Question: "${question}"
Topics:`;

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: 30,
            temperature: 0.1, // Low temperature for consistency
        });

        const text = result[0]?.generated_text || '';
        // Clean up the output: split by comma, remove whitespace, remove short words
        return text.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 2);
    } catch (e) {
        console.error('Keyword extraction failed', e);
        // Fallback: simple split if LLM fails
        return question.split(' ').filter(w => w.length > 3);
    }
}

/**
 * Cleanup function to free resources
 * Call this when the model is no longer needed
 */
export function cleanupLocalLLM(): void {
    if (textGenerationPipeline) {
        console.log('[LocalLLM] Cleaning up model resources');
        textGenerationPipeline = null;
        isLoading = false;
        loadingPromise = null;
    }
}
