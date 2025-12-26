/* eslint-disable no-restricted-globals */

/**
 * Miner Worker - Handles heavy AI tasks off the main thread
 * 
 * Uses real Transformers.js pipeline via local-llm.ts
 * Runs entirely in browser - no API calls, complete privacy
 */

// Import local LLM functions
// Note: Web workers have their own scope, so we import directly
import {
  initLocalLLM,
  answerQuestionLocal,
  summarizeLocal,
  generateQuizQuestionLocal,
  isModelLoaded,
} from '../utils/local-llm';

const ctx: Worker = self as any;

// Track initialization status
let isInitializing = false;
let isInitialized = false;

/**
 * Initialize the model in the worker
 * This keeps the UI thread responsive during download
 */
async function ensureModelLoaded(): Promise<boolean> {
  if (isModelLoaded()) {
    return true;
  }

  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return isInitialized;
  }

  isInitializing = true;

  try {
    ctx.postMessage({
      status: 'loading',
      message: 'Initializing AI model...'
    });

    const success = await initLocalLLM((progress) => {
      ctx.postMessage({
        status: 'loading',
        message: progress.status,
        progress: progress.progress
      });
    });

    isInitialized = success;
    return success;
  } catch (error) {
    console.error('[MinerWorker] Model initialization failed:', error);
    isInitialized = false;
    return false;
  } finally {
    isInitializing = false;
  }
}

/**
 * Handle incoming messages from main thread
 */
ctx.onmessage = async (event: MessageEvent) => {
  const { type, command, content, context, topic } = event.data;

  try {
    // Ensure model is loaded before processing
    const modelReady = await ensureModelLoaded();

    if (!modelReady) {
      ctx.postMessage({
        status: 'error',
        error: 'Failed to load AI model. Please check your internet connection.'
      });
      return;
    }

    ctx.postMessage({ status: 'processing', message: 'Processing request...' });

    let result: any = null;

    switch (command) {
      case 'summarize':
        result = await summarizeLocal(content, (progress) => {
          ctx.postMessage({
            status: 'processing',
            message: progress.status
          });
        });
        ctx.postMessage({ status: 'success', result });
        break;

      case 'answer':
        result = await answerQuestionLocal(content, context, (progress) => {
          ctx.postMessage({
            status: 'processing',
            message: progress.status
          });
        });
        ctx.postMessage({ status: 'success', result });
        break;

      case 'quiz':
        result = await generateQuizQuestionLocal(context, topic, (progress) => {
          ctx.postMessage({
            status: 'processing',
            message: progress.status
          });
        });

        if (result) {
          ctx.postMessage({ status: 'success', result });
        } else {
          ctx.postMessage({
            status: 'error',
            error: 'Could not generate quiz question from the provided content.'
          });
        }
        break;

      case 'init':
        // Explicit initialization command
        ctx.postMessage({
          status: 'success',
          result: 'Model initialized successfully'
        });
        break;

      default:
        ctx.postMessage({
          status: 'error',
          error: `Unknown command: ${command}`
        });
    }

  } catch (error: any) {
    console.error('[MinerWorker] Error processing command:', error);
    ctx.postMessage({
      status: 'error',
      error: error.message || 'An unexpected error occurred'
    });
  }
};

// Signal that worker is ready
ctx.postMessage({ status: 'ready', message: 'Worker initialized' });

export { };
