/**
 * Local LLM with Transformers.js
 * Runs entirely in the browser - no API calls, complete privacy
 * 
 * DUAL MODEL SUPPORT:
 * - Quick Mode: Qwen1.5-0.5B-Chat (fast, ~500MB)
 * - Think More Mode: Qwen2.5-1.5B-Instruct (thorough, ~1.5GB)
 * 
 * FEATURES:
 * - Lazy loading based on user preference
 * - Per-device settings (localStorage)
 * - Storage quota checking
 * - Model caching with IndexedDB
 */

import { pipeline, env } from '@xenova/transformers';

// Configure for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

export type AIMode = 'quick' | 'thorough';

export interface ModelConfig {
    id: AIMode;
    name: string;
    hfPath: string;
    maxContext: number;
    maxNewTokens: number;
    estimatedSizeMB: number;
}

export const MODEL_CONFIGS: Record<AIMode, ModelConfig> = {
    quick: {
        id: 'quick',
        name: 'Quick',
        hfPath: 'Xenova/Qwen1.5-0.5B-Chat',
        maxContext: 1200,
        maxNewTokens: 100,
        estimatedSizeMB: 500
    },
    thorough: {
        id: 'thorough',
        name: 'Think More',
        hfPath: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
        maxContext: 2048,
        maxNewTokens: 350,
        estimatedSizeMB: 650
    }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let textGenerationPipeline: any = null;
let currentModelId: AIMode | null = null;
let isLoading = false;
let loadingPromise: Promise<any> | null = null;

// Progress callback type
type ProgressCallback = (progress: { status: string; progress?: number }) => void;

// Storage keys
const STORAGE_KEY_MODE = 'jivvy-ai-mode';
const STORAGE_KEY_KEEP_BOTH = 'jivvy-ai-keep-both';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
const DEFAULT_TEMPERATURE = 0.3;
const MIN_FREE_SPACE_MB = 3000; // Warn if less than 3GB free

// ============================================================================
// QUIZ QUESTION RESULT TYPE
// ============================================================================
export interface QuizQuestionResult {
    question: string;
    options: string[];
    correctIndex: number;        // 0-3 mapping from A/B/C/D
    correctLetter: string;       // A, B, C, or D
    sourceQuote: string;
}

// ============================================================================
// PREFERENCE MANAGEMENT (Per-device, localStorage)
// ============================================================================

/**
 * Get user's preferred AI mode from localStorage
 */
export function getPreferredMode(): AIMode {
    if (typeof window === 'undefined') return 'quick';
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    return (saved === 'thorough' ? 'thorough' : 'quick') as AIMode;
}

/**
 * Set user's preferred AI mode in localStorage
 */
export function setPreferredMode(mode: AIMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    console.log(`[LocalLLM] Preferred mode set to: ${mode}`);
}

/**
 * Get whether user wants to keep both models cached
 */
export function getKeepBothCached(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_KEEP_BOTH) === 'true';
}

/**
 * Set whether to keep both models cached
 */
export function setKeepBothCached(keep: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_KEEP_BOTH, String(keep));
}

// ============================================================================
// STORAGE MANAGEMENT
// ============================================================================

/**
 * Check available storage space
 */
export async function checkStorageSpace(): Promise<{
    available: boolean;
    freeSpaceMB: number;
    freeSpaceFormatted: string;
    warning: string | null;
}> {
    try {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { available: true, freeSpaceMB: 0, freeSpaceFormatted: 'Unknown', warning: null };
        }

        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const freeBytes = quota - usage;
        const freeSpaceMB = Math.floor(freeBytes / (1024 * 1024));
        const freeSpaceFormatted = freeSpaceMB >= 1000 
            ? `${(freeSpaceMB / 1000).toFixed(1)}GB` 
            : `${freeSpaceMB}MB`;

        const warning = freeSpaceMB < MIN_FREE_SPACE_MB
            ? `Low storage: Only ${freeSpaceFormatted} available. Model download may fail.`
            : null;

        return { available: freeSpaceMB >= 500, freeSpaceMB, freeSpaceFormatted, warning };
    } catch (error) {
        console.warn('[LocalLLM] Could not check storage:', error);
        return { available: true, freeSpaceMB: 0, freeSpaceFormatted: 'Unknown', warning: null };
    }
}

/**
 * Check if a specific model is cached in browser storage
 */
export async function isModelCached(mode: AIMode): Promise<boolean> {
    try {
        const config = MODEL_CONFIGS[mode];
        // Check if model files exist in Cache API
        const cache = await caches.open('transformers-cache');
        const keys = await cache.keys();
        const modelPrefix = config.hfPath.replace('/', '_');
        return keys.some(req => req.url.includes(modelPrefix));
    } catch (error) {
        console.warn('[LocalLLM] Could not check model cache:', error);
        return false;
    }
}

/**
 * Get download progress (called from event listener)
 */
export function getDownloadProgress(): { modelId: string; progress: number } | null {
    // This is managed via events, return null for sync check
    return null;
}

/**
 * Clear a specific model from cache
 */
export async function clearModelCache(mode: AIMode): Promise<boolean> {
    try {
        const config = MODEL_CONFIGS[mode];
        const cache = await caches.open('transformers-cache');
        const keys = await cache.keys();
        const modelPrefix = config.hfPath.replace('/', '_');
        
        let deleted = false;
        for (const request of keys) {
            if (request.url.includes(modelPrefix)) {
                await cache.delete(request);
                deleted = true;
            }
        }
        
        console.log(`[LocalLLM] Cleared cache for ${mode} model: ${deleted}`);
        return deleted;
    } catch (error) {
        console.error('[LocalLLM] Failed to clear model cache:', error);
        return false;
    }
}

/**
 * Get cache status for both models
 */
export async function getModelCacheStatus(): Promise<Record<AIMode, { cached: boolean; sizeMB: number }>> {
    const quickCached = await isModelCached('quick');
    const thoroughCached = await isModelCached('thorough');
    
    return {
        quick: { cached: quickCached, sizeMB: quickCached ? MODEL_CONFIGS.quick.estimatedSizeMB : 0 },
        thorough: { cached: thoroughCached, sizeMB: thoroughCached ? MODEL_CONFIGS.thorough.estimatedSizeMB : 0 }
    };
}

// ============================================================================
// MODEL LOADING
// ============================================================================

/**
 * Emit download progress event
 */
function emitDownloadProgress(modelId: string, status: 'idle' | 'downloading' | 'complete' | 'error', progress: number, error?: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('llm-download-progress', {
        detail: { modelId, status, progress, error }
    }));
}

/**
 * Unload current model to free memory
 */
export async function unloadCurrentModel(): Promise<void> {
    if (textGenerationPipeline) {
        console.log(`[LocalLLM] Unloading current model: ${currentModelId}`);
        textGenerationPipeline = null;
        currentModelId = null;
        
        // Try to trigger garbage collection
        if (typeof window !== 'undefined' && (window as any).gc) {
            (window as any).gc();
        }
    }
}

/**
 * Load a specific model by mode
 */
export async function loadModel(mode: AIMode, onProgress?: ProgressCallback): Promise<boolean> {
    const config = MODEL_CONFIGS[mode];
    
    // If same model already loaded, return immediately
    if (textGenerationPipeline && currentModelId === mode) {
        console.log(`[LocalLLM] Model ${mode} already loaded`);
        return true;
    }

    // If different model loaded, unload it first
    if (textGenerationPipeline && currentModelId !== mode) {
        await unloadCurrentModel();
    }

    // If already loading, wait for it
    if (isLoading && loadingPromise) {
        console.log('[LocalLLM] Model loading in progress, waiting...');
        await loadingPromise;
        return currentModelId === mode;
    }

    isLoading = true;
    emitDownloadProgress(mode, 'downloading', 0);

    try {
        onProgress?.({ status: `Initializing ${config.name} model...`, progress: 0 });

        loadingPromise = pipeline('text-generation', config.hfPath, {
            progress_callback: (data: any) => {
                if (data.status === 'progress' && data.progress !== undefined) {
                    const progress = Math.round(data.progress);
                    onProgress?.({ status: `Downloading ${config.name}: ${progress}%`, progress });
                    emitDownloadProgress(mode, 'downloading', progress);
                } else if (data.status === 'initiate') {
                    onProgress?.({ status: 'Starting download...', progress: 0 });
                } else if (data.status === 'done') {
                    onProgress?.({ status: 'Download complete, initializing...', progress: 95 });
                }
            }
        });

        textGenerationPipeline = await loadingPromise;
        currentModelId = mode;
        
        onProgress?.({ status: `${config.name} model ready!`, progress: 100 });
        emitDownloadProgress(mode, 'complete', 100);
        
        console.log(`[LocalLLM] ${config.hfPath} loaded successfully`);
        return true;
    } catch (error) {
        console.error('[LocalLLM] Failed to load model:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onProgress?.({ status: `Failed to load model: ${errorMessage}` });
        emitDownloadProgress(mode, 'error', 0, errorMessage);
        textGenerationPipeline = null;
        currentModelId = null;
        return false;
    } finally {
        isLoading = false;
    }
}

/**
 * Ensure the preferred model is loaded (lazy load on first use)
 */
export async function ensureModelLoaded(onProgress?: ProgressCallback): Promise<boolean> {
    const preferredMode = getPreferredMode();
    return loadModel(preferredMode, onProgress);
}

/**
 * Preload a model for faster switching (downloads but may not keep in memory)
 */
export async function preloadModel(mode: AIMode, onProgress?: ProgressCallback): Promise<boolean> {
    // Just load it - this will cache the files
    const success = await loadModel(mode, onProgress);
    
    // If user doesn't want to keep both, and this isn't the preferred model, unload it
    if (success && !getKeepBothCached() && mode !== getPreferredMode()) {
        // Don't unload immediately - let user benefit from the load
        console.log(`[LocalLLM] Preloaded ${mode} model, keeping in memory for now`);
    }
    
    return success;
}

/**
 * Legacy: Initialize the local LLM model (uses preferred mode)
 */
export async function initLocalLLM(onProgress?: ProgressCallback): Promise<boolean> {
    return ensureModelLoaded(onProgress);
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
    return !!textGenerationPipeline;
}

/**
 * Get current loaded model ID
 */
export function getCurrentModelId(): AIMode | null {
    return currentModelId;
}

/**
 * Get current model config
 */
export function getCurrentModelConfig(): ModelConfig | null {
    return currentModelId ? MODEL_CONFIGS[currentModelId] : null;
}

// ============================================================================
// QWEN CHAT TEMPLATE HELPER
// ============================================================================

/**
 * Format prompt using Qwen's chat template
 * <|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n
 */
function formatQwenPrompt(systemPrompt: string, userPrompt: string): string {
    return `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${userPrompt}<|im_end|>
<|im_start|>assistant
`;
}

/**
 * Truncate text based on current model's max context
 * Preserves paragraph boundaries when possible (Strategy: smart truncation)
 */
function truncateInput(text: string, maxChars?: number): string {
    const limit = maxChars ?? (currentModelId ? MODEL_CONFIGS[currentModelId].maxContext : 1200);
    
    if (text.length <= limit) return text;
    
    // Try to cut at a paragraph boundary first
    const truncated = text.slice(0, limit);
    
    // Look for paragraph boundaries (double newline)
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > limit * 0.7) {
        return truncated.slice(0, lastParagraph) + '\n\n[Content truncated...]';
    }
    
    // Look for section markers (=== Page X ===)
    const lastSection = truncated.lastIndexOf('\n===');
    if (lastSection > limit * 0.7) {
        return truncated.slice(0, lastSection) + '\n\n[Content truncated...]';
    }
    
    // Fall back to sentence boundary
    const lastSentence = truncated.lastIndexOf('. ');
    if (lastSentence > limit * 0.7) {
        return truncated.slice(0, lastSentence + 1) + '\n\n[Content truncated...]';
    }
    
    // Last resort: hard cutoff
    return truncated + '...';
}

// ============================================================================
// QUIZ QUESTION GENERATION - Pipe-Delimited Strategy
// ============================================================================

/**
 * Generate a quiz question using pipe-delimited output (faster than JSON)
 * 
 * Format: QUESTION ||| OPTION_A ||| OPTION_B ||| OPTION_C ||| OPTION_D ||| CORRECT_LETTER ||| SOURCE_QUOTE
 * 
 * @returns QuizQuestionResult or null if parsing fails
 */
export async function generateQuizQuestionLocal(
    context: string,
    topic?: string,
    onProgress?: ProgressCallback
): Promise<QuizQuestionResult | null> {
    // Validate input
    if (!context || context.trim().length === 0) {
        console.warn('[LocalLLM] generateQuizQuestionLocal: empty context');
        return null;
    }

    // Initialize model if needed
    if (!textGenerationPipeline) {
        const success = await initLocalLLM(onProgress);
        if (!success) {
            console.error('[LocalLLM] Failed to initialize model for quiz generation');
            return null;
        }
    }

    onProgress?.({ status: 'Generating quiz question...' });

    // Truncate context for speed
    const truncatedContext = truncateInput(context);

    const systemPrompt = `You are a quiz generator. Output EXACTLY one line in this format:
QUESTION ||| OPTION_A ||| OPTION_B ||| OPTION_C ||| OPTION_D ||| CORRECT_LETTER ||| SOURCE_QUOTE

Rules:
- Use ||| as delimiter
- CORRECT_LETTER must be A, B, C, or D
- SOURCE_QUOTE is a short phrase from the text
- No extra text, just the formatted line`;

    const userPrompt = topic
        ? `Create a quiz question about "${topic}" from this text:\n\n${truncatedContext}`
        : `Create a quiz question from this text:\n\n${truncatedContext}`;

    const prompt = formatQwenPrompt(systemPrompt, userPrompt);

    try {
        const config = getCurrentModelConfig();
        const maxTokens = config?.maxNewTokens ?? 150;
        
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: maxTokens,
            temperature: DEFAULT_TEMPERATURE,
            do_sample: true,
            top_k: 50,
            repetition_penalty: 1.2,
            return_full_text: false,  // Only return generated text, not prompt
        });

        const generatedText = result[0]?.generated_text || '';
        onProgress?.({ status: 'Parsing quiz result...' });

        // Parse the pipe-delimited output
        return parseQuizOutput(generatedText);
    } catch (error) {
        console.error('[LocalLLM] Quiz generation error:', error);
        return null;
    }
}

/**
 * Parse pipe-delimited quiz output
 * Robust parser that handles missing columns gracefully
 * 
 * @returns QuizQuestionResult or null if parsing fails
 */
function parseQuizOutput(output: string): QuizQuestionResult | null {
    if (!output || typeof output !== 'string') {
        console.warn('[LocalLLM] parseQuizOutput: invalid output');
        return null;
    }

    // Clean up the output - take first line only
    const lines = output.trim().split('\n');
    const line = lines[0]?.trim();

    if (!line) {
        console.warn('[LocalLLM] parseQuizOutput: empty line');
        return null;
    }

    // Split by pipe delimiter
    const parts = line.split('|||').map(p => p.trim());

    // Minimum: we need question, 4 options, and correct letter (6 parts)
    if (parts.length < 6) {
        console.warn('[LocalLLM] parseQuizOutput: insufficient parts:', parts.length);
        return null;
    }

    const [question, optA, optB, optC, optD, correctLetterRaw, sourceQuote = ''] = parts;

    // Validate question exists
    if (!question || question.length < 5) {
        console.warn('[LocalLLM] parseQuizOutput: invalid question');
        return null;
    }

    // Validate options exist
    const options = [optA, optB, optC, optD];
    if (options.some(opt => !opt || opt.length < 1)) {
        console.warn('[LocalLLM] parseQuizOutput: invalid options');
        return null;
    }

    // Parse correct letter to index
    const correctLetter = correctLetterRaw?.toUpperCase()?.charAt(0);
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const correctIndex = letterMap[correctLetter];

    if (correctIndex === undefined) {
        console.warn('[LocalLLM] parseQuizOutput: invalid correct letter:', correctLetterRaw);
        return null;
    }

    return {
        question,
        options,
        correctIndex,
        correctLetter,
        sourceQuote: sourceQuote || ''
    };
}

// ============================================================================
// ANSWER QUESTION - Updated for Qwen
// ============================================================================

/**
 * Answer a question using local LLM with Qwen chat template
 * Automatically uses current model's context limits
 */
export async function answerQuestionLocal(
    question: string,
    context: string,
    onProgress?: ProgressCallback
): Promise<string> {
    const TIMEOUT_MS = 60000;  // 60 second timeout (longer for thorough mode)

    // Validate inputs
    if (!question || question.trim().length === 0) {
        throw new Error('Question cannot be empty');
    }

    if (!context || context.trim().length === 0) {
        throw new Error('Context cannot be empty');
    }

    // Initialize model if needed (uses preferred mode)
    if (!textGenerationPipeline) {
        const success = await ensureModelLoaded(onProgress);
        if (!success) {
            throw new Error('Failed to load local LLM model.');
        }
    }

    const config = getCurrentModelConfig()!;
    onProgress?.({ status: `Generating answer with ${config.name} model...` });

    // Truncate context based on current model's limits.
    // NOTE: config.maxContext is best-effort; in practice Transformers.js may throw
    // "invalid or out-of-range index" if tokenization exceeds model limits.
    const truncatedContext = truncateInput(context, config.maxContext);
    console.log(`[LocalLLM] Generating answer with ${config.name} model: "${question.slice(0, 50)}..." with ${truncatedContext.length} chars context`);

    const systemPrompt = currentModelId === 'thorough'
        ? 'You are an expert tutor. Answer the user\'s question based ONLY on the provided context. If the question is a multiple-choice question, select the best answer, explain WHY it is correct, and cite the page number where the information is found (e.g., [Page 12]).'
        : 'You are a helpful assistant. Answer based on context. If it is a multiple choice question, give the answer and a brief explanation with page citation.';
    
    const userPrompt = `Context:\n${truncatedContext}\n\nQuestion: ${question}\n\nInstructions:\n1. Identify the correct answer.\n2. Explain why it is correct using evidence from the text.\n3. Cite the page number (e.g., [Page 5]) for the evidence.\n\nAnswer:`;
    const prompt = formatQwenPrompt(systemPrompt, userPrompt);

    console.log(`[LocalLLM] Prompt length: ${prompt.length} chars`);

    const runGeneration = async (promptText: string, opts: { maxNewTokens: number; doSample: boolean; temperature: number }) => {
        const result = await textGenerationPipeline(promptText, {
            max_new_tokens: opts.maxNewTokens,
            temperature: opts.temperature,
            do_sample: opts.doSample,
            top_k: opts.doSample ? 40 : 1,
            repetition_penalty: 1.2,
            return_full_text: false,
        });

        return result;
    };

    try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('LLM generation timed out after 60 seconds')), TIMEOUT_MS);
        });

        const maxTokens = config.maxNewTokens;

        // Race between generation and timeout
        const generatePromise = runGeneration(prompt, {
            maxNewTokens: maxTokens,
            doSample: true,
            temperature: 0.3,
        });

        console.log('[LocalLLM] Starting generation...');
        const result = await Promise.race([generatePromise, timeoutPromise]);
        console.log('[LocalLLM] Generation complete');

        const answer = result[0]?.generated_text || 'Could not generate an answer.';
        onProgress?.({ status: 'Done!' });

        const trimmedAnswer = answer.trim();
        console.log(`[LocalLLM] Answer: "${trimmedAnswer.slice(0, 100)}..."`);

        if (trimmedAnswer.length === 0) {
            return 'No answer could be generated from the provided context.';
        }

        return trimmedAnswer;
    } catch (error) {
        console.error('[LocalLLM] Generation error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Transformers.js occasionally throws an internal indexing error.
        // Retry once with a smaller context and deterministic decoding.
        if (typeof errorMessage === 'string' && /out-of-range index|out of range/i.test(errorMessage)) {
            try {
                const reducedContext = truncateInput(context, Math.max(400, Math.floor(config.maxContext * 0.7)));
                const fallbackUserPrompt = `Context:\n${reducedContext}\n\nQuestion: ${question}\n\nInstructions:\n1. Identify the correct answer.\n2. Explain why it is correct using evidence from the text.\n3. Cite the page number (e.g., [Page 5]) for the evidence.\n\nAnswer:`;
                const fallbackPrompt = formatQwenPrompt(
                    'You are a helpful assistant. Answer the user\'s question based ONLY on the provided context. If unsure, say so.',
                    fallbackUserPrompt
                );

                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('LLM generation timed out after 60 seconds')), TIMEOUT_MS);
                });

                const retryPromise = runGeneration(fallbackPrompt, {
                    maxNewTokens: Math.min(150, config.maxNewTokens),
                    doSample: false,
                    temperature: 0,
                });

                const result = await Promise.race([retryPromise, timeoutPromise]);
                const answer = result[0]?.generated_text || 'Could not generate an answer.';
                const trimmedAnswer = answer.trim();
                if (trimmedAnswer.length === 0) {
                    throw new Error('No answer could be generated from the provided context.');
                }
                return trimmedAnswer;
            } catch (retryError) {
                console.error('[LocalLLM] Retry generation failed:', retryError);
            }
        }

        throw new Error(`Failed to generate answer: ${errorMessage}`);
    }
}

// ============================================================================
// SUMMARIZE - Updated for Qwen
// ============================================================================

/**
 * Summarize text using local LLM with Qwen chat template
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

    // Truncate text for sub-second performance
    const truncatedText = truncateInput(text);

    const systemPrompt = 'You are a helpful assistant. Provide concise, accurate summaries.';
    const userPrompt = `Summarize the following text concisely:\n\n${truncatedText}`;
    const prompt = formatQwenPrompt(systemPrompt, userPrompt);

    try {
        const result = await textGenerationPipeline(prompt, {
            max_new_tokens: 100,
            temperature: DEFAULT_TEMPERATURE,
            do_sample: true,
            top_k: 50,
            repetition_penalty: 1.2,
            return_full_text: false,
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

// ============================================================================
// DATA ANALYSIS (Kept from original - uses pattern matching, not LLM)
// ============================================================================

/**
 * Chart data structure for visualization
 */
export interface ChartData {
    type: 'bar' | 'line' | 'pie';
    title: string;
    summary: string;
    labels: string[];
    datasets: { label: string; data: number[]; backgroundColor?: string[] }[];
    sourcePages: number[];
}

/**
 * Analyze text to extract data for visualization
 * Uses pattern matching to find numerical data since small models struggle with JSON
 */
export async function analyzeDataset(
    text: string,
    query: string,
    sourcePages: number[],
    onProgress?: ProgressCallback
): Promise<ChartData | null> {
    if (!text || text.trim().length === 0) {
        return null;
    }

    onProgress?.({ status: 'Analyzing data patterns...' });

    // Extract numerical data using pattern matching
    const dataPoints = extractNumericalData(text);

    if (dataPoints.length === 0) {
        onProgress?.({ status: 'No numerical data found' });
        return null;
    }

    // Generate a summary using the LLM
    let summary = 'Data extracted from document.';
    try {
        if (!textGenerationPipeline) {
            await initLocalLLM(onProgress);
        }

        if (textGenerationPipeline) {
            const dataStr = dataPoints.slice(0, 5).map(d => `${d.label}: ${d.value}`).join(', ');
            const prompt = formatQwenPrompt(
                'You are a data analyst. Provide a brief summary.',
                `Summarize this data briefly: ${dataStr}`
            );
            const result = await textGenerationPipeline(prompt, {
                max_new_tokens: 50,
                temperature: 0.3,
                return_full_text: false,
            });
            summary = result[0]?.generated_text?.trim() || summary;
        }
    } catch (e) {
        console.warn('[LocalLLM] Summary generation failed:', e);
    }

    // Determine chart type based on data characteristics
    const chartType = dataPoints.length <= 6 ? 'pie' : dataPoints.length <= 12 ? 'bar' : 'line';

    // Generate colors for pie/bar charts
    const colors = generateChartColors(dataPoints.length);

    onProgress?.({ status: 'Data analysis complete!' });

    return {
        type: chartType,
        title: query || 'Extracted Data',
        summary,
        labels: dataPoints.map(d => d.label),
        datasets: [{
            label: 'Values',
            data: dataPoints.map(d => d.value),
            backgroundColor: colors
        }],
        sourcePages
    };
}

/**
 * Extract numerical data from text using pattern matching
 */
function extractNumericalData(text: string): { label: string; value: number }[] {
    const results: { label: string; value: number }[] = [];

    // Pattern 1: "Label: $123" or "Label: 123%" or "Label: 123"
    const colonPattern = /([A-Za-z][A-Za-z\s]{2,30}):\s*\$?([\d,]+(?:\.\d+)?)\s*%?/g;
    let match;
    while ((match = colonPattern.exec(text)) !== null) {
        const label = match[1].trim();
        const value = parseFloat(match[2].replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
            results.push({ label, value });
        }
    }

    // Pattern 2: "123 Label" (e.g., "150 employees", "50% increase")
    const prefixPattern = /\b([\d,]+(?:\.\d+)?)\s*%?\s+((?:[A-Z][a-z]+\s?){1,4})/g;
    while ((match = prefixPattern.exec(text)) !== null) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        const label = match[2].trim();
        if (!isNaN(value) && value > 0 && !results.some(r => r.label === label)) {
            results.push({ label, value });
        }
    }

    // Pattern 3: Table-like data "Item | Value" or tab-separated
    const tablePattern = /^([A-Za-z][A-Za-z\s]{2,25})\s*[\t|]\s*\$?([\d,]+(?:\.\d+)?)/gm;
    while ((match = tablePattern.exec(text)) !== null) {
        const label = match[1].trim();
        const value = parseFloat(match[2].replace(/,/g, ''));
        if (!isNaN(value) && value > 0 && !results.some(r => r.label === label)) {
            results.push({ label, value });
        }
    }

    // Limit to top 12 results and sort by value
    return results
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
}

/**
 * Generate chart colors
 */
function generateChartColors(count: number): string[] {
    const baseColors = [
        'rgba(163, 230, 53, 0.8)',  // lime
        'rgba(34, 197, 94, 0.8)',   // green
        'rgba(59, 130, 246, 0.8)', // blue
        'rgba(168, 85, 247, 0.8)', // purple
        'rgba(236, 72, 153, 0.8)', // pink
        'rgba(251, 146, 60, 0.8)', // orange
        'rgba(250, 204, 21, 0.8)', // yellow
        'rgba(20, 184, 166, 0.8)', // teal
        'rgba(239, 68, 68, 0.8)',  // red
        'rgba(99, 102, 241, 0.8)', // indigo
        'rgba(156, 163, 175, 0.8)', // gray
        'rgba(217, 119, 6, 0.8)',  // amber
    ];
    return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
}

// ============================================================================
// KEYWORD EXTRACTION (Kept from original)
// ============================================================================

/**
 * Extract search keywords from a user question
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
    const ngrams = extractNgrams(question);
    ngrams.forEach(ng => allTerms.add(ng));

    // Strategy 4: Try LLM extraction for semantic understanding (if model loads)
    try {
        if (!textGenerationPipeline) await initLocalLLM(onProgress);

        if (textGenerationPipeline) {
            const prompt = formatQwenPrompt(
                'Extract key technical terms from questions. Return comma-separated list only.',
                `Extract main topics from: "${question}"`
            );

            const result = await textGenerationPipeline(prompt, {
                max_new_tokens: 30,
                temperature: 0.1,
                return_full_text: false,
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

    const finalTerms = Array.from(allTerms).slice(0, 25);
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

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup function to free resources
 * Call this when the model is no longer needed
 */
export function cleanupLocalLLM(): void {
    if (textGenerationPipeline) {
        console.log(`[LocalLLM] Cleaning up model resources (${currentModelId})`);
        textGenerationPipeline = null;
        currentModelId = null;
        isLoading = false;
        loadingPromise = null;
        
        // Try to trigger garbage collection
        if (typeof window !== 'undefined' && (window as any).gc) {
            (window as any).gc();
        }
    }
}
