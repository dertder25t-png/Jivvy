/**
 * Deprecated (local-first migration).
 *
 * This module previously contained server-side Gemini calls.
 * It is intentionally kept as a safe stub so builds/type-checks
 * don't accidentally pull in external AI dependencies.
 *
 * Use client-side local alternatives in `utils/local-ai-actions.ts`.
 */

export interface GenerateSearchQueriesResult {
	queries: string[];
	error?: string;
}

export async function generateSearchQueries(
	_text: string,
	_queryCount = 3,
	_platforms?: string
): Promise<GenerateSearchQueriesResult> {
	return {
		queries: [],
		error:
			"Deprecated: server AI removed. Use utils/local-ai-actions.ts instead."
	};
}

export interface AnswerQuestionResult {
	answer: string | null;
	error?: string;
}

export async function answerQuestion(
	_question: string,
	_context: string
): Promise<AnswerQuestionResult> {
	return {
		answer: null,
		error:
			"Deprecated: server AI removed. Use client-side local AI instead."
	};
}

