import Dexie, { Table } from 'dexie';
import { AppError, createAppError, toAppError } from './errors';

export type BlockType = 'text' | 'task' | 'pdf_highlight' | 'image' | 'page_break' | 'lecture_container' | 'quiz';

export interface AnalyticsConceptSource {
    lecture_id: string;
    block_id: string;
    excerpt: string;
}

export interface AnalyticsConcept {
    id: string;
    project_id: string;
    concept: string;
    score: number; // 0..1
    first_seen_at: number;
    last_seen_at: number;
    updated_at: number;
    sources: AnalyticsConceptSource[];
}

export type QuizGeneratorKind = 'local-llm' | 'rule';
export type QuizModelMode = 'quick' | 'thorough' | 'unknown';

// Phase 4 roadmap: store quiz generation inputs + model mode used for debugging.
export interface AnalyticsQuizGeneration {
    id: string;
    project_id: string;
    created_at: number;
    generator: QuizGeneratorKind;
    model_mode: QuizModelMode;
    topic?: string;
    context_hash: string;
    context_length: number;
    context_excerpt?: string;
    source_block_ids?: string[];
    result?: unknown;
    error?: unknown;
}

export interface Block {
    id: string;
    parent_id: string | null;
    project_id?: string; // Added for scoping
    user_id?: string; // Added for ownership
    content: string;
    type: BlockType;
    // New fields for Smart Capture
    properties?: {
        priority?: 'low' | 'medium' | 'high';
        due_date?: number; // timestamp
        tags?: string[];
        checked?: boolean;

        // Phase 3: Lecture blocks
        lecture_number?: number;
        lecture_date?: number; // timestamp (start-of-day)
        audio_transcription_id?: string | null;
        summary?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    order: number;
}

export interface Project {
    id: string;
    user_id?: string; // Added for ownership
    name: string;
    created_at: number;
    updated_at: number;
    // New fields
    priority?: 'low' | 'medium' | 'high';
    due_date?: number;
    color?: string;
    tags?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}

export class JivvyDB extends Dexie {
    blocks!: Table<Block>;
    projects!: Table<Project>;
    analytics_concepts!: Table<AnalyticsConcept>;
    analytics_quiz_generations!: Table<AnalyticsQuizGeneration>;

    constructor() {
        super('JivvyDB');
        this.version(1).stores({
            blocks: 'id, parent_id, order, type',
            projects: 'id'
        });

        this.version(2).stores({
            projects: 'id, updated_at',
            blocks: 'id, parent_id, order, type'
        }).upgrade(trans => {
            return trans.table("projects").toCollection().modify(p => {
                if (!p.updated_at) p.updated_at = p.created_at || Date.now();
            });
        });

        this.version(3).stores({
            blocks: 'id, parent_id, order, type, properties.due_date, properties.priority, properties.tags',
            projects: 'id, updated_at, due_date, priority'
        });

        // v2 roadmap: avoid full scans for upcoming tasks by adding a compound index.
        // We keep the existing due date field location (block.properties.due_date) to avoid a migration churn.
        this.version(4).stores({
            blocks: 'id, parent_id, order, type, properties.due_date, properties.priority, properties.tags, [type+properties.due_date]',
            projects: 'id, updated_at, due_date, priority'
        });

        // Phase 4 roadmap: Super Learn concept analytics.
        this.version(5).stores({
            blocks: 'id, parent_id, order, type, properties.due_date, properties.priority, properties.tags, [type+properties.due_date]',
            projects: 'id, updated_at, due_date, priority',
            analytics_concepts: 'id, project_id, concept, score, updated_at, last_seen_at, [project_id+concept], [project_id+score]'
        });

        // Phase 4 roadmap: Quiz generation auditing (inputs + model mode + outputs/errors).
        this.version(6).stores({
            blocks: 'id, parent_id, order, type, properties.due_date, properties.priority, properties.tags, [type+properties.due_date]',
            projects: 'id, updated_at, due_date, priority',
            analytics_concepts: 'id, project_id, concept, score, updated_at, last_seen_at, [project_id+concept], [project_id+score]',
            analytics_quiz_generations: 'id, project_id, created_at, generator, model_mode, context_hash, [project_id+created_at]'
        });

        // Phase 2 Fix: Add user_id and project_id indices for better scoping
        this.version(7).stores({
            blocks: 'id, parent_id, order, type, project_id, user_id, properties.due_date, properties.priority, properties.tags, [type+properties.due_date]',
            projects: 'id, updated_at, due_date, priority, user_id',
            analytics_concepts: 'id, project_id, concept, score, updated_at, last_seen_at, [project_id+concept], [project_id+score]',
            analytics_quiz_generations: 'id, project_id, created_at, generator, model_mode, context_hash, [project_id+created_at]'
        });
    }
}

export const db = new JivvyDB();

let integrityState: 'unknown' | 'ok' | 'failed' = 'unknown';
let integrityFailure: AppError | null = null;

async function ensureDbIntegrityOnce(): Promise<{ ok: true } | { ok: false; error: AppError }> {
    if (integrityState === 'ok') return { ok: true };
    if (integrityState === 'failed' && integrityFailure) return { ok: false, error: integrityFailure };

    try {
        // Lightweight reads to validate core tables without scanning.
        // If IndexedDB is partially corrupted or blocked, these often throw.
        await db.projects.limit(1).toArray();
        await db.blocks.limit(1).toArray();
        // Newer schemas include analytics tables; a missing table (upgrade issue) should surface clearly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((db as any).analytics_concepts) {
            await db.analytics_concepts.limit(1).toArray();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((db as any).analytics_quiz_generations) {
            await db.analytics_quiz_generations.limit(1).toArray();
        }

        integrityState = 'ok';
        integrityFailure = null;
        return { ok: true };
    } catch (e) {
        const mapped = mapDbError(e);
        const err = createAppError(
            'DB_INTEGRITY_FAILED',
            'Database integrity check failed. Your browser storage may be corrupted or blocked.',
            {
                retryable: false,
                detail: {
                    cause: mapped,
                    guidance:
                        'Try reloading the page. If it persists, consider exporting what you can and clearing this site’s storage (browser settings → site data). Private/incognito mode may also block IndexedDB.',
                },
            }
        );
        integrityState = 'failed';
        integrityFailure = err;
        return { ok: false, error: err };
    }
}

function mapDbError(error: unknown): AppError {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    const name = typeof err?.name === 'string' ? err.name : '';
    const message = typeof err?.message === 'string' ? err.message : '';

    // Common browser/IndexedDB failure modes.
    if (name === 'MissingAPIError') {
        return createAppError(
            'DB_UNAVAILABLE',
            'IndexedDB is not available in this browser context.',
            {
                retryable: false,
                detail: { name, message }
            }
        );
    }

    // QuotaExceededError is often thrown when the browser storage is full.
    if (name === 'QuotaExceededError' || /quota/i.test(message)) {
        return createAppError(
            'DB_QUOTA_EXCEEDED',
            'Browser storage is full. Free up space and try again.',
            {
                retryable: true,
                detail: { name, message }
            }
        );
    }

    // A generic open/transaction failure.
    return toAppError(error, {
        code: 'DB_FAILED',
        message: 'Database operation failed',
        retryable: true,
    });
}

/**
 * Ensure IndexedDB is open and usable.
 * Returns a structured AppError with local-first guidance when the browser blocks DB access.
 */
export async function ensureDbReady(): Promise<{ ok: true } | { ok: false; error: AppError }> {
    try {
        // Dexie auto-opens on first operation, but explicit open lets us detect failures early.
        if (!db.isOpen()) {
            await db.open();
        }

        const integrity = await ensureDbIntegrityOnce();
        if (!integrity.ok) return integrity;

        return { ok: true };
    } catch (e) {
        const mapped = mapDbError(e);
        return {
            ok: false,
            error: createAppError(
                mapped.code === 'DB_FAILED' ? 'DB_OPEN_FAILED' : mapped.code,
                mapped.message || 'Database is unavailable',
                {
                    retryable: mapped.retryable,
                    detail: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...(typeof mapped.detail === 'object' && mapped.detail ? (mapped.detail as any) : {}),
                        guidance:
                            'Try reloading the page. If this persists, your browser may be blocking storage (private mode) or storage may be full.',
                    },
                }
            ),
        };
    }
}

/**
 * Safe DB wrapper that returns `{ data, error }` instead of throwing.
 * Use this for UI flows that need structured, user-visible errors.
 */
export async function safeDbResult<T>(
    operation: () => Promise<T>
): Promise<{ data: T | null; error?: AppError }> {
    const ready = await ensureDbReady();
    if (!ready.ok) return { data: null, error: ready.error };

    try {
        return { data: await operation() };
    } catch (e) {
        return { data: null, error: mapDbError(e) };
    }
}

// Error handling wrapper helper
export async function safeDbOperation<T>(operation: () => Promise<T>, fallback?: T): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        console.error("Database Operation Failed:", error);
        // In a real app, we might show a toast here using a passed callback or global event
        // For now, we log and re-throw or return fallback if provided
        if (fallback !== undefined) return fallback;
        throw error;
    }
}
