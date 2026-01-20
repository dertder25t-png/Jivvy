/* eslint-disable no-restricted-globals */
import { generateFlashcardsFromNotes } from '../lib/local-ai-actions';

// Web Worker for handling flashcard pattern detection in the background
// Now strictly uses the shared logic from local-ai-actions.ts

self.onmessage = async (e: MessageEvent) => {
    const { text, blockId } = e.data;
    if (!text || typeof text !== 'string') return;

    try {
        // Use the shared library logic
        const result = await generateFlashcardsFromNotes(text);

        // Map back to the expected format if needed, but the store handles 'patterns' generic object.
        // We'll pass the enriched flashcards back.
        if (result.flashcards.length > 0) {
            const patterns = result.flashcards.map(card => ({
                type: card.type || 'fact', // fallback
                front: card.front,
                back: card.back,
                confidence: card.confidence || 0.8,
                originalText: text // This might be too long if we pass whole text, but okay for now
            }));

            self.postMessage({
                blockId,
                patterns,
                timestamp: Date.now()
            });
        }
    } catch (err) {
        console.error('Worker error:', err);
    }
};
