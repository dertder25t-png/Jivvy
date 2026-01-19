import { v4 as uuidv4 } from 'uuid';

export interface FlashcardPattern {
    type: 'definition' | 'question' | 'cloze';
    front: string;
    back: string;
    confidence: number; // 0-1
    originalText: string;
}

export interface SuggestedFlashcard extends FlashcardPattern {
    id: string;
    blockId: string;
    timestamp: number;
}

export function detectPatterns(text: string): FlashcardPattern[] {
    const results: FlashcardPattern[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. Definition Syntax: "Term: Definition" or "Term - Definition"
        // Avoids common times like 10:30 or simple lists
        const defMatch = trimmed.match(/^([^:-]+)(?::| -)\s+(.+)$/);
        if (defMatch) {
            const [_, term, def] = defMatch;
            // Basic heuristic: Term shouldn't be too long compared to definition
            if (term.length < 50 && def.length > 5) {
                results.push({
                    type: 'definition',
                    front: term.trim(),
                    back: def.trim(),
                    confidence: 0.9,
                    originalText: trimmed
                });
            }
        }

        // 2. Question Syntax: "Q: ... A: ..." (Single line)
        const qaMatch = trimmed.match(/^(?:Q:|Question:)\s*(.+?)\s+(?:A:|Answer:)\s*(.+)$/i);
        if (qaMatch) {
            const [_, q, a] = qaMatch;
            results.push({
                type: 'question',
                front: q.trim(),
                back: a.trim(),
                confidence: 0.95,
                originalText: trimmed
            });
        }

        // 3. Cloze Syntax: "The [mitochondria] is the powerhouse."
        // Look for content inside square brackets, but ignore [ ] empty or [x] checkboxes
        const clozeRegex = /\[([^\]]+)\]/g;
        let match;
        const clozes = [];
        while ((match = clozeRegex.exec(trimmed)) !== null) {
            // Ignore if it looks like a checkbox [ ] or [x]
            if (match[1].length === 0 || (match[1].length === 1 && match[1].toLowerCase() === 'x')) continue;
            // Ignore if it looks like a citation [1]
            if (/^\d+$/.test(match[1])) continue;

            clozes.push(match[1]);
        }

        if (clozes.length > 0) {
            // For now, just take the first cloze or create multiple? 
            // Let's create one card per line with clozes revealed one by one? 
            // Or simpler: Front = Text with first [...] hidden, Back = Text with [...] revealed.
            // Actually, standard cloze is: Front: "The [...] is the powerhouse." Back: "mitochondria"

            // For simplicity in this v1:
            // Just one cloze per line supported for "Instant" generation to avoid UI clutter
            const term = clozes[0];
            const front = trimmed.replace(`[${term}]`, '[...]');
            results.push({
                type: 'cloze',
                front: front,
                back: term,
                confidence: 0.8,
                originalText: trimmed
            });
        }
    }

    return results;
}
