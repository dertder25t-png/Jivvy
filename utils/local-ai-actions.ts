'use client';

import * as pdfjsLib from 'pdfjs-dist';

import { initPDFWorker } from '@/lib/pdf-init';
import { llmClient } from '@/utils/llm-worker-client';
import { AppError, createAppError, toAppError } from '@/lib/errors';

export interface SpecItem {
    id: string;
    label: string;
    checked: boolean;
    category?: string;
}

export interface GenerateSpecResult {
    specs: SpecItem[];
    error?: AppError;
}

export interface RewriteTextResult {
    rewrittenText: string | null;
    error?: AppError;
}

export interface SearchQueryResult {
    queries: string[];
    error?: AppError;
}

export interface FlashcardGenerationResult {
    flashcards: { front: string; back: string }[];
    error?: AppError;
}

/**
 * Extracts key terms using simple heuristics to avoid LLM overhead.
 */
async function extractKeywords(text: string): Promise<string[]> {
    const stopWords = new Set([
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'a', 'an', 
        'is', 'are', 'was', 'were', 'it', 'this', 'that', 'from', 'by', 'as', 'be', 'have',
        'has', 'had', 'do', 'does', 'did', 'not', 'can', 'could', 'will', 'would'
    ]);
    
    const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
    const counts = new Map<string, number>();
    
    for (const w of words) {
        if (w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w)) {
            counts.set(w, (counts.get(w) || 0) + 1);
        }
    }
    
    // Sort by frequency
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(e => e[0]);
}

async function extractPdfTextFromUrl(pdfUrl: string, maxPages = 3): Promise<string> {
    initPDFWorker();

    // Use proxy to avoid CORS issues when fetching external PDFs
    const encodedUrl = encodeURIComponent(pdfUrl);
    const proxyUrl = `/api/proxy?url=${encodedUrl}`;
    
    const res = await fetch(proxyUrl);
    if (!res.ok) {
        throw createAppError('PDF_FETCH_FAILED', 'Failed to fetch PDF', {
            retryable: true,
            detail: { status: res.status, url: pdfUrl }
        });
    }

    const buf = await res.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const doc = await loadingTask.promise;

    const pages = Math.min(doc.numPages, Math.max(1, maxPages));
    let out = '';

    for (let i = 1; i <= pages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items
            .map((it: any) => ('str' in it ? String((it as any).str) : ''))
            .filter(Boolean);
        out += strings.join(' ') + '\n';
    }

    return out;
}

function extractSpecsRegex(text: string): SpecItem[] {
    const specs: SpecItem[] = [];
    const push = (label: string, category?: string) => {
        specs.push({ id: `local-${specs.length + 1}`, label, checked: false, category });
    };

    const t = text.toLowerCase();

    if (/(\ba4\b|\ba3\b|\bletter\b|8\.5\s*x\s*11)/i.test(text)) {
        const match = text.match(/\b(A[3-5])\b/i)?.[1];
        push(match ? `${match.toUpperCase()} Format` : 'Document format mentioned', 'format');
    }
    if (/cmyk/.test(t)) push('CMYK Color Mode', 'color');
    if (/rgb/.test(t)) push('RGB Color Mode', 'color');
    if (/pantone|pms/.test(t)) push('Pantone Colors', 'color');
    if (/bleed|trim|margin/.test(t)) push('Bleed / margin requirements', 'format');
    if (/dpi|pp[i]/.test(t)) push('Image resolution requirement (DPI)', 'imagery');
    if (/pdf|\.pdf/.test(t)) push('PDF delivery', 'delivery');

    return specs;
}

export async function generateSpecSheet(pdfUrl: string): Promise<GenerateSpecResult> {
    try {
        if (!pdfUrl) return { specs: [], error: createAppError('NO_PDF_URL', 'No PDF URL provided', { retryable: false }) };

        const pdfText = await extractPdfTextFromUrl(pdfUrl, 3);
        const baseline = extractSpecsRegex(pdfText);

        // Uses specialized 77M model for fast extraction
        const prompt = `Extract checklist items from text.
Output: Item 1 | Item 2 | Item 3
Text:
${pdfText.slice(0, 1000)}`;

        const llm = await llmClient.generate(pdfText.slice(0, 1000), 'flashcard-fast', prompt);
        
        let lines: string[] = [];
        if (llm) {
             // Handle "Item | Item" format
             if (llm.includes('|')) {
                 lines = llm.split('|').map(l => l.trim());
             } else {
                 lines = llm.split('\n').map(l => l.replace(/^[-•\d.\s]+/, '').trim());
             }
        }
        
        lines = lines.filter(l => l.length > 3).slice(0, 12);

        const specs: SpecItem[] = [
            ...baseline,
            ...lines.map((label, idx) => ({
                id: `ai-${idx + 1}`,
                label,
                checked: false,
                category: 'other',
            })),
        ];

        // De-dup by label
        const seen = new Set<string>();
        const deduped = specs.filter(s => {
            const key = s.label.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { specs: deduped };
    } catch (e) {
        return {
            specs: [],
            error: toAppError(e, {
                code: 'SPEC_SHEET_FAILED',
                message: 'Failed to generate spec sheet',
                retryable: true,
            })
        };
    }
}

export async function rewriteText(text: string, tone: string, sampleText?: string): Promise<RewriteTextResult> {
    try {
        if (!text || !text.trim()) {
            return { rewrittenText: null, error: createAppError('NO_TEXT', 'No text provided', { retryable: false }) };
        }

        const prompt = tone === 'custom' && sampleText
            ? `Rewrite to match style.
Sample: ${sampleText.slice(0,100)}...
Text: ${text}`
            : `Rewrite in ${tone} tone: ${text}`;

        // Use balanced model (248M) for writing tasks
        const out = await llmClient.generate(text, 'flashcard-balanced', prompt);
        
        return { rewrittenText: out?.trim() ?? null };
    } catch (e) {
        return {
            rewrittenText: null,
            error: toAppError(e, {
                code: 'REWRITE_FAILED',
                message: 'Failed to rewrite text',
                retryable: true,
            })
        };
    }
}

export async function generateSearchQueries(text: string): Promise<SearchQueryResult> {
    try {
        if (!text || !text.trim()) {
            return { queries: [], error: createAppError('NO_TEXT', 'No text provided', { retryable: false }) };
        }

        const keywords = await extractKeywords(text);
        const base = keywords.slice(0, 6);

        // Fast heuristic queries (works even without model)
        const heuristic = [
            base.slice(0, 3).join(' '),
            `${base.slice(0, 2).join(' ')} study guide`,
            `${base.slice(0, 2).join(' ')} practice questions`,
        ].filter(q => q.trim().length > 0);

        const prompt = `Generate 3 search queries for: ${keywords.slice(0, 5).join(', ')}`;
        
        // Use fast model for queries
        const llm = await llmClient.generate(text, 'flashcard-fast', prompt);

        const llmQueries = (llm || '')
            .split(/[\n|]/)
            .map(l => l.replace(/^\d+[.)]\s*|^Q:\s*/, '').trim())
            .filter(l => l.length > 5)
            .slice(0, 6);

        const merged = [...heuristic, ...llmQueries];
        const seen = new Set<string>();
        const deduped = merged.filter(q => {
            const key = q.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { queries: deduped.slice(0, 6) };
    } catch (e) {
        return {
            queries: [],
            error: toAppError(e, {
                code: 'SEARCH_QUERIES_FAILED',
                message: 'Failed to generate search queries',
                retryable: true,
            })
        };
    }
}

/**
 * Generate flashcards from lecture notes.
 * 
 * Uses Web Worker to prevent UI lag.
 * Models: LaMini-Flan-T5-77M (Fast) or 248M (Balanced)
 */
export async function generateFlashcardsFromNotes(notes: string): Promise<FlashcardGenerationResult> {
    try {
        if (!notes || notes.trim().length < 20) {
            return { flashcards: [] };
        }

        // Prompt optimized for Flan-T5 models
        const prompt = `Task: Create 3 study questions and answers based on the text.
Format:
Q: [Question]
A: [Answer]

Text:
${notes.slice(0, 1000)}`;

        // Use 'flashcard-balanced' (248M) for better quality
        const llmOutput = await llmClient.generate(notes, 'flashcard-balanced', prompt);

        if (!llmOutput) {
            return { flashcards: [] };
        }

        const flashcards = parseFlashcardsFromLLM(llmOutput);
        return { flashcards };

    } catch (e) {
        console.error('[generateFlashcardsFromNotes] Failed:', e);
        // Fallback to empty, don't crash
        return { flashcards: [] };
    }
}

function parseFlashcardsFromLLM(output: string): { front: string; back: string }[] {
    const cards: { front: string; back: string }[] = [];
    const cleaned = output.replace(/```/g, '').trim();
    
    // 1. Pipe Format: "Question | Answer"
    const lines = cleaned.split('\n');
    for (const line of lines) {
        // Filter out instruction echoes
        if (line.toLowerCase().startsWith('format:') || 
            line.toLowerCase().startsWith('instructions:') || 
            line.toLowerCase().startsWith('extract') ||
            line.includes('Format:')) {
            continue;
        }

        if (line.includes('|')) {
            const parts = line.split('|');
            if (parts.length >= 2) {
                const f = parts[0].trim();
                const b = parts.slice(1).join('|').trim();
                
                // Extra validation to avoid parsing instructions "Question | Answer"
                if (f.toLowerCase() === 'question' && b.toLowerCase() === 'answer') continue;

                if (f.length > 2 && b.length > 2) {
                     cards.push({ front: f.slice(0, 200), back: b.slice(0, 500) });
                }
            }
        }
    }
    
    // 2. Q/A Format: "Q: ... A: ..."
    if (cards.length === 0) {
        let currentQuestion: string | null = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Match "Q:" or "Question:"
            if (trimmed.match(/^(Q:|Question:)/i)) {
                currentQuestion = trimmed.replace(/^(Q:|Question:)\s*/i, '');
            } 
            // Match "A:" or "Answer:"
            else if (trimmed.match(/^(A:|Answer:)/i) && currentQuestion) {
                const answer = trimmed.replace(/^(A:|Answer:)\s*/i, '');
                cards.push({
                    front: currentQuestion.slice(0, 200),
                    back: answer.slice(0, 500)
                });
                currentQuestion = null;
            }
        }
    }

    // 3. JSON Fallback
    if (cards.length === 0) {
        try {
            const match = cleaned.match(/\[.*\]/s);
            if (match) {
                const arr = JSON.parse(match[0]);
                if (Array.isArray(arr)) {
                    arr.forEach((x: any) => {
                        if (x.front && x.back) cards.push({ front: x.front, back: x.back });
                    });
                }
            }
        } catch (e) {}
    }

    return cards.slice(0, 5);
}
