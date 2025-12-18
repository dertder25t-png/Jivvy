"use client";

import Dexie, { type Table } from "dexie";

/**
 * Local IndexedDB database for Jivvy
 * Stores large files (PDFs, images) and vector embeddings locally
 * Only lightweight metadata syncs to Supabase
 */

// Type definitions
export interface LocalProject {
    id: string; // UUID from Supabase
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface LocalPDF {
    id?: number; // Auto-incremented local ID
    projectId: string;
    filename: string;
    blob: Blob;
    size: number;
    hash: string; // SHA-256 fingerprint for verification
    createdAt: Date;
}

export interface LocalVector {
    id?: number;
    projectId: string;
    chunkIndex: number;
    content: string;
    embedding: number[]; // Float32 array from Transformers.js
    createdAt: Date;
}

export interface LocalCanvasSnapshot {
    id?: number;
    projectId: string;
    data: string; // JSON stringified canvas state
    timestamp: Date;
}

// Dexie database class
class JivvyDB extends Dexie {
    projects!: Table<LocalProject, string>;
    pdfs!: Table<LocalPDF, number>;
    vectors!: Table<LocalVector, number>;
    canvasSnapshots!: Table<LocalCanvasSnapshot, number>;

    constructor() {
        super("jivvyDB");

        this.version(1).stores({
            // Primary key is 'id', indexed by title
            projects: "id, title, createdAt",
            // Auto-incremented id, indexed by projectId and hash
            pdfs: "++id, projectId, hash, createdAt",
            // Auto-incremented id, indexed by projectId and chunkIndex
            vectors: "++id, projectId, chunkIndex, createdAt",
            // Auto-incremented id, indexed by projectId and timestamp
            canvasSnapshots: "++id, projectId, timestamp",
        });
    }
}

// Singleton instance
export const db = new JivvyDB();

// Helper functions for common operations

/**
 * Get PDF blob by project ID
 */
export async function getProjectPDF(projectId: string): Promise<LocalPDF | undefined> {
    return db.pdfs.where("projectId").equals(projectId).first();
}

/**
 * Save PDF blob with hash for verification
 */
export async function saveProjectPDF(
    projectId: string,
    filename: string,
    blob: Blob,
    hash: string
): Promise<number> {
    // Remove any existing PDFs for this project first
    await db.pdfs.where("projectId").equals(projectId).delete();

    return db.pdfs.add({
        projectId,
        filename,
        blob,
        size: blob.size,
        hash,
        createdAt: new Date(),
    });
}

/**
 * Check if PDF exists locally for project
 */
export async function hasPDFLocally(projectId: string): Promise<boolean> {
    const count = await db.pdfs.where("projectId").equals(projectId).count();
    return count > 0;
}

/**
 * Get all vectors for a project
 */
export async function getProjectVectors(projectId: string): Promise<LocalVector[]> {
    return db.vectors.where("projectId").equals(projectId).sortBy("chunkIndex");
}

/**
 * Save canvas snapshot (called from worker or debounced save)
 */
export async function saveCanvasSnapshot(projectId: string, data: string): Promise<number> {
    return db.canvasSnapshots.add({
        projectId,
        data,
        timestamp: new Date(),
    });
}

/**
 * Get latest canvas snapshot for project
 */
export async function getLatestCanvasSnapshot(
    projectId: string
): Promise<LocalCanvasSnapshot | undefined> {
    return db.canvasSnapshots
        .where("projectId")
        .equals(projectId)
        .reverse()
        .sortBy("timestamp")
        .then((snapshots) => snapshots[0]);
}

/**
 * Clear all local data (for logout/reset)
 */
export async function clearAllLocalData(): Promise<void> {
    await Promise.all([
        db.projects.clear(),
        db.pdfs.clear(),
        db.vectors.clear(),
        db.canvasSnapshots.clear(),
    ]);
}
