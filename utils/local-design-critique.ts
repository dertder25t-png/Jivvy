export interface CritiqueResult {
	critique: string | null;
	error?: import('@/lib/errors').AppError;
}

/**
 * Local-first placeholder for image critique.
 *
 * We intentionally do NOT call any external APIs.
 * A real implementation would require a local vision model.
 */
export async function critiqueCropLocal(_image: File, _issue: string): Promise<CritiqueResult> {
	return {
		critique: null,
		error: {
			code: 'LOCAL_VISION_DISABLED',
			message:
				'Design Doctor is disabled in local-only mode until a local vision model is integrated.',
			retryable: false,
		}
	};
}

export async function critiqueFullCanvasLocal(_image: File): Promise<CritiqueResult> {
	return {
		critique: null,
		error: {
			code: 'LOCAL_VISION_DISABLED',
			message:
				'Design Doctor is disabled in local-only mode until a local vision model is integrated.',
			retryable: false,
		}
	};
}
