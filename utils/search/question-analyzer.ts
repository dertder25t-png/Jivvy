import { tokenizeText } from './preprocessor';

export interface QuestionAnalysis {
  intent: 'definition' | 'procedure' | 'diagnosis' | 'comparison' | 'calculation' | 'other';
  keyTerms: string[];
  constraints: string[];
  negations: string[];
  focusPhrases: string[];
}

const INTENT_PATTERNS: Array<{ intent: QuestionAnalysis['intent']; regex: RegExp }> = [
  { intent: 'definition', regex: /\b(what is|define|explain|meaning of)\b/i },
  { intent: 'procedure', regex: /\b(how do|how does|procedure|steps|process|best way)\b/i },
  { intent: 'diagnosis', regex: /\b(why|cause|causes|symptom|indicate|detect|diagnos)\b/i },
  { intent: 'comparison', regex: /\b(difference|compare|versus|vs\.?|better than)\b/i },
  { intent: 'calculation', regex: /\b(calculate|compute|determine|formula|value of)\b/i }
];

const NEGATION_PATTERN = /\b(no|not|never|without|except|unless)\b/gi;
const CONSTRAINT_PATTERN = /\b(during|while|when|with|at|after|before|under|assuming|given)\b/gi;

export function analyzeQuestion(question: string): QuestionAnalysis {
  const normalized = question.replace(/\s+/g, ' ').trim();
  let intent: QuestionAnalysis['intent'] = 'other';
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      intent = pattern.intent;
      break;
    }
  }

  const tokens = tokenizeText(normalized);
  const keyTerms = dedupe(tokens.filter(token => token.length > 2).slice(0, 12));

  const negations = matchPhrases(normalized, NEGATION_PATTERN);
  const constraints = matchConstraintPhrases(normalized);
  const focusPhrases = extractQuotedPhrases(normalized);

  // Ensure entities like numbers remain even if remove duplicates earlier
  for (const numeric of normalized.match(/\b\d+(?:\.\d+)?\b/g) || []) {
    if (!keyTerms.includes(numeric)) {
      keyTerms.push(numeric);
    }
  }

  return {
    intent,
    keyTerms,
    constraints,
    negations,
    focusPhrases
  };
}

function matchPhrases(text: string, regex: RegExp): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[0].toLowerCase());
  }
  return dedupe(matches);
}

function matchConstraintPhrases(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  CONSTRAINT_PATTERN.lastIndex = 0;
  while ((match = CONSTRAINT_PATTERN.exec(text)) !== null) {
    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + 60);
    const snippet = text.slice(start, end).trim();
    matches.push(snippet);
  }
  return dedupe(matches);
}

function extractQuotedPhrases(text: string): string[] {
  const quotes = text.match(/"([^\"]+)"|'([^']+)'/g) || [];
  return dedupe(
    quotes
      .map(q => q.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
  );
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
