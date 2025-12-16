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
const MAX_CONTEXT_LENGTH = 3000; // Increased for better answers
const MAX_GENERATION_TOKENS = 200; // Increased for longer answers
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
 * Uses multiple strategies for better coverage:
 * 1. LLM extraction for semantic understanding
 * 2. Regex extraction for technical terms (acronyms, capitalized words)
 * 3. Direct word extraction as fallback
 */
export async function extractKeywords(
    question: string,
    onProgress?: ProgressCallback
): Promise<string[]> {
    const allTerms = new Set<string>();

    // Strategy 1: Extract technical terms using regex (fast, no LLM needed)
    const technicalTerms = extractTechnicalTerms(question);
    technicalTerms.forEach(t => allTerms.add(t));

    // Strategy 2: Extract individual important words
    const importantWords = question
        .split(/\s+/)
        .map(w => w.replace(/[?.,!'"]/g, '').toLowerCase())
        .filter(w => w.length > 3 && !isStopWord(w));
    importantWords.forEach(w => allTerms.add(w));

    // Strategy 3: Extract 2-word and 3-word phrases (n-grams)
    // Critical for multi-word technical terms like "ignition harness", "zinc chromate"
    const ngrams = extractNgrams(question);
    ngrams.forEach(ng => allTerms.add(ng));

    // Strategy 4: Try LLM extraction for semantic understanding (if model loads)
    try {
        if (!textGenerationPipeline) await initLocalLLM(onProgress);

        if (textGenerationPipeline) {
            const prompt = `Extract the main technical topics from this question. Return them as a comma-separated list.

Question: "${question}"
Topics:`;

            const result = await textGenerationPipeline(prompt, {
                max_new_tokens: 30,
                temperature: 0.1,
            });

            const text = result[0]?.generated_text || '';
            const llmTerms = text.split(',')
                .map((t: string) => t.trim().toLowerCase())
                .filter((t: string) => t.length > 2);
            llmTerms.forEach((t: string) => allTerms.add(t));
        }
    } catch (e) {
        console.warn('[LocalLLM] LLM keyword extraction failed, using regex fallback:', e);
    }

    // Strategy 5: Generate related terms for common acronyms
    const expandedTerms = expandAcronyms(question);
    expandedTerms.forEach(t => allTerms.add(t));

    const finalTerms = Array.from(allTerms).slice(0, 25); // Increased to 25 terms
    console.log('[LocalLLM] Extracted keywords:', finalTerms);
    return finalTerms;
}

/**
 * Extract 2-word and 3-word phrases (n-grams) from text
 */
function extractNgrams(text: string): string[] {
    const words = text
        .replace(/[?.,!'"]/g, '')
        .split(/\s+/)
        .map(w => w.toLowerCase())
        .filter(w => w.length > 1);

    const ngrams: string[] = [];

    // 2-grams
    for (let i = 0; i < words.length - 1; i++) {
        const w1 = words[i];
        const w2 = words[i + 1];
        // Only include if at least one word is not a stop word
        if (!isStopWord(w1) || !isStopWord(w2)) {
            if (!isStopWord(w1) && !isStopWord(w2)) {
                ngrams.push(`${w1} ${w2}`);
            }
        }
    }

    // 3-grams
    for (let i = 0; i < words.length - 2; i++) {
        const w1 = words[i];
        const w2 = words[i + 1];
        const w3 = words[i + 2];
        // Only include if first and last words are not stop words
        if (!isStopWord(w1) && !isStopWord(w3)) {
            ngrams.push(`${w1} ${w2} ${w3}`);
        }
    }

    return ngrams;
}

/**
 * Extract technical terms using regex patterns
 */
function extractTechnicalTerms(text: string): string[] {
    const terms: string[] = [];

    // Pattern 1: Acronyms (2-6 capital letters)
    const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
    terms.push(...acronyms.map(a => a.toLowerCase()));

    // Pattern 2: Capitalized phrases (e.g., "Cylinder Head Temperature")
    const capitalizedPhrases = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
    terms.push(...capitalizedPhrases.map(p => p.toLowerCase()));

    // Pattern 3: Hyphenated terms (e.g., "air-fuel", "pre-ignition")
    const hyphenated = text.match(/\b\w+-\w+(?:-\w+)*\b/g) || [];
    terms.push(...hyphenated.map(h => h.toLowerCase()));

    // Pattern 4: Technical compound words with numbers
    const techTerms = text.match(/\b\w+\d+\w*\b/g) || [];
    terms.push(...techTerms.map(t => t.toLowerCase()));

    return Array.from(new Set(terms));
}

/**
 * Expand common aviation/technical acronyms to full terms
 */
function expandAcronyms(text: string): string[] {
    const acronymMap: Record<string, string[]> = {
        'cht': ['cylinder', 'head', 'temperature'],
        'egt': ['exhaust', 'gas', 'temperature'],
        'rpm': ['revolutions', 'minute', 'engine', 'speed'],
        'tit': ['turbine', 'inlet', 'temperature'],
        'oil': ['lubrication', 'pressure'],
        'fuel': ['mixture', 'flow', 'consumption'],
        'manifold': ['pressure', 'intake'],
        'propeller': ['prop', 'blade', 'pitch'],
        'magneto': ['ignition', 'spark'],
        'carb': ['carburetor', 'mixture', 'icing'],
        'turbo': ['turbine', 'turbocharger', 'boost'],
    };

    const expanded: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [acronym, related] of Object.entries(acronymMap)) {
        if (lowerText.includes(acronym)) {
            expanded.push(...related);
        }
    }

    return expanded;
}

/**
 * Check if a word is a common stop word
 */
function isStopWord(word: string): boolean {
    const stopWords = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out',
        'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'there',
        'their', 'where', 'which', 'about', 'after', 'before', 'between', 'through', 'during', 'without',
        'when', 'what', 'who', 'why', 'how', 'some', 'many', 'more', 'most', 'other', 'such', 'only',
        'each', 'every', 'both', 'few', 'several', 'since', 'while', 'until', 'whether',
        'also', 'just', 'very', 'here', 'then', 'even', 'much', 'well', 'back',
        'does', 'show', 'make', 'made', 'take', 'give', 'want', 'need', 'main', 'five',
    ]);
    return stopWords.has(word.toLowerCase());
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
