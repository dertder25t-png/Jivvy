'use client';

import * as pdfjsLib from 'pdfjs-dist';

import { initPDFWorker } from '@/lib/pdf-init';
import { extractKeywords, generateTextLocal } from '@/utils/local-llm';
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

async function extractPdfTextFromUrl(pdfUrl: string, maxPages = 3): Promise<string> {
    initPDFWorker();

    const res = await fetch(pdfUrl);
    if (!res.ok) {
        throw createAppError('PDF_FETCH_FAILED', 'Failed to fetch PDF', {
            retryable: true,
            detail: { status: res.status }
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

        // Optional LLM pass to refine labels/categories.
        const llm = await generateTextLocal(
            'You extract concise specification checklist items from text. Output 6-12 short bullet items. No markdown, one item per line.',
            `Extract technical specs and constraints from this PDF text (may be partial):\n\n${pdfText.slice(0, 12000)}`,
            { maxNewTokens: 180, temperature: 0.2 }
        );

        if (!llm) return { specs: baseline };

        const lines = llm
            .split('\n')
            .map(l => l.replace(/^[-•\s]+/, '').trim())
            .filter(Boolean)
            .slice(0, 12);

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

        const system = 'You are a writing assistant. Preserve meaning. Improve clarity and grammar. Output only the rewritten text.';

        const user =
            tone === 'custom' && sampleText
                ? `Rewrite the target text to match the tone, sentence structure, and style of the sample text.\n\nSample Text:\n${sampleText}\n\nTarget Text:\n${text}`
                : `Rewrite the following text to have a "${tone}" tone:\n\n${text}`;

        const out = await generateTextLocal(system, user, { maxNewTokens: 220, temperature: 0.3 });
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

        // LLM refinement: ask for 3-6 crisp queries
        const llm = await generateTextLocal(
            'You generate concise web search queries. Output 3-6 lines. No numbering.',
            `Create search queries for this text:\n${text}\n\nKeywords: ${keywords.join(', ')}`,
            { maxNewTokens: 120, temperature: 0.2 }
        );

        const llmQueries = (llm || '')
            .split('\n')
            .map(l => l.replace(/^\d+[.)]\s*/, '').trim())
            .filter(Boolean)
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
