/**
 * Deprecated (local-first migration).
 *
 * This file previously contained server-side Gemini (vision) calls.
 * External AI is intentionally disabled.
 *
 * Use local-only alternatives (or stubs) instead.
 */

export interface CritiqueResult {
    critique: string | null;
    error?: string;
}

/**
 * Critique a design crop (Mode A)
 * Requires a local vision model (not yet integrated).
 */
export async function critiqueCrop(formData: FormData): Promise<CritiqueResult> {
	void formData;
	return {
		critique: null,
		error:
			"Deprecated: server AI removed. Design critique requires a local vision model (not yet integrated)."
	};
}

/**
 * Full Canvas Critique (Mode B)
 * Analyzes full canvas snapshot JSON + Screenshot (if available).
 * Requires a local vision model (not yet integrated).
 */
export async function critiqueFullCanvas(formData: FormData): Promise<CritiqueResult> {
	void formData;
	return {
		critique: null,
		error:
			"Deprecated: server AI removed. Design critique requires a local vision model (not yet integrated)."
	};
}
