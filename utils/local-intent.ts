export type SmartCreateType = 'task' | 'project' | 'paper' | 'brainstorm';

export interface IntentSuggestion {
	kind: SmartCreateType;
	confidence: 'explicit' | 'high' | 'medium' | 'low';
}

function normalizeKind(raw: string): SmartCreateType | null {
	const v = raw.trim().toLowerCase();
	if (v === 'task') return 'task';
	if (v === 'project') return 'project';
	if (v === 'paper' || v === 'essay' || v === 'doc' || v === 'document') return 'paper';
	if (v === 'brainstorm' || v === 'note' || v === 'notes' || v === 'idea') return 'brainstorm';
	return null;
}

export function classifyIntentHeuristic(text: string): IntentSuggestion {
	const t = text.trim();
	if (!t) return { kind: 'task', confidence: 'low' };

	// Explicit prefixes win.
	if (/^(project:|folder:|new project\b)/i.test(t)) return { kind: 'project', confidence: 'explicit' };
	if (/^(paper:|essay:|doc:|document:)/i.test(t)) return { kind: 'paper', confidence: 'explicit' };
	if (/^(brainstorm:|canvas:|board:|notes?:)/i.test(t)) return { kind: 'brainstorm', confidence: 'explicit' };

	// Strong keyword cues.
	if (/\b(essay|paper|research|thesis|outline|bibliography|works cited|references)\b/i.test(t)) {
		return { kind: 'paper', confidence: 'high' };
	}
	if (/\b(brainstorm|ideas?|mindmap|moodboard|sketch)\b/i.test(t)) {
		return { kind: 'brainstorm', confidence: 'high' };
	}
	if (/\b(project|unit|module|semester|class)\b/i.test(t)) {
		return { kind: 'project', confidence: 'medium' };
	}

	return { kind: 'task', confidence: 'low' };
}

export async function classifyIntentLocal(text: string): Promise<IntentSuggestion> {
	// Keep this module client-safe: dynamic import.
	const heuristic = classifyIntentHeuristic(text);
	if (heuristic.confidence === 'explicit' || heuristic.confidence === 'high') return heuristic;

	try {
		const { generateTextLocal } = await import('@/utils/local-llm');
		const system =
			'You classify a single user input into one of: Task, Project, Paper, Brainstorm. ' +
			'Output ONLY one word: Task | Project | Paper | Brainstorm.';
		const user = `Input: "${text.trim()}"`;

		const raw = await generateTextLocal(system, user, { maxNewTokens: 6, temperature: 0.0 });
		if (!raw) return heuristic;

		const firstToken = raw.split(/\s+/)[0] ?? '';
		const kind = normalizeKind(firstToken);
		if (!kind) return heuristic;

		return { kind, confidence: 'medium' };
	} catch {
		return heuristic;
	}
}
