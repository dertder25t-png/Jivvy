/**
 * File utility functions for hash generation and verification
 * Uses Web Crypto API for SHA-256 fingerprinting
 */

/**
 * Generate SHA-256 hash fingerprint for a file
 * Used for verifying file integrity on device switch
 */
export async function generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
}

/**
 * Generate hash from Blob (for already-loaded files)
 */
export async function generateBlobHash(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
}

/**
 * Verify uploaded file matches expected hash
 */
export async function verifyFileHash(file: File, expectedHash: string): Promise<boolean> {
    const actualHash = await generateFileHash(file);
    return actualHash === expectedHash;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
