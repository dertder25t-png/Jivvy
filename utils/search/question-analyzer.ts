import { tokenizeText } from './preprocessor';

export interface QuestionAnalysis {
  intent: 'definition' | 'procedure' | 'diagnosis' | 'comparison' | 'calculation' | 'trick' | 'other';
  keyTerms: string[];
  constraints: string[];
  negations: string[];
  focusPhrases: string[];
  nounPhrases: string[];  // NEW: extracted noun phrases for better term identification
  isTrickQuestion?: boolean;  // NEW: detected contradictory/trick questions
  contradictoryTerms?: [string, string];  // NEW: pair of contradictory terms
}

const INTENT_PATTERNS: Array<{ intent: QuestionAnalysis['intent']; regex: RegExp }> = [
  { intent: 'definition', regex: /\b(what is|define|explain|meaning of|describe|characterized by)\b/i },
  { intent: 'procedure', regex: /\b(how do|how does|procedure|steps|process|best way|method|way to)\b/i },
  { intent: 'diagnosis', regex: /\b(why|cause|causes|symptom|indicate|detect|diagnos|sign of|characteristic of|detected by|indication of|reveal|troubleshoot|failure|fault)\b/i },
  { intent: 'comparison', regex: /\b(difference|compare|versus|vs\.?|better than|different from|distinguish|distinguish between)\b/i },
  { intent: 'calculation', regex: /\b(calculate|compute|determine|formula|value of|how much|how many)\b/i }
];

const NEGATION_PATTERN = /\b(no|not|never|without|except|unless)\b/gi;
const CONSTRAINT_PATTERN = /\b(during|while|when|with|at|after|before|under|assuming|given)\b/gi;
const NOUN_PHRASE_PATTERN = /\b([A-Z][a-z]+(?:\s+[a-z]+)*|[a-z]+(?:\s+[a-z]+)*(?:\s+(?:engine|system|fuel|ignition|mechanism|process|component|part|type|model|version|variant)))\b/gi;

export function analyzeQuestion(question: string): QuestionAnalysis {
  const normalized = question.replace(/\s+/g, ' ').trim();
  let intent: QuestionAnalysis['intent'] = 'other';
  
  // Check for trick questions first (contradictory combinations)
  const trickyPairs = [
    { term1: /carburetor/i, term2: /fuel.?injection/i, name: 'carburetor-fuel-injection' },
    { term1: /ignition/i, term2: /carburetor/i, name: 'ignition-carburetor' },
    { term1: /fuel.?injection/i, term2: /jets?/i, name: 'fuel-injection-jets' },
  ];
  
  let isTrickQuestion = false;
  let contradictoryTerms: [string, string] | undefined;
  
  for (const pair of trickyPairs) {
    const has1 = pair.term1.test(normalized);
    const has2 = pair.term2.test(normalized);
    if (has1 && has2) {
      isTrickQuestion = true;
      intent = 'trick';
      const match1 = normalized.match(pair.term1);
      const match2 = normalized.match(pair.term2);
      contradictoryTerms = [match1?.[0] || 'term1', match2?.[0] || 'term2'];
      break;
    }
  }
  
  if (!isTrickQuestion) {
    for (const pattern of INTENT_PATTERNS) {
      if (pattern.regex.test(normalized)) {
        intent = pattern.intent;
        break;
      }
    }
  }

  const tokens = tokenizeText(normalized);
  const keyTerms = dedupe(tokens.filter(token => token.length > 2).slice(0, 12));
  
  // Extract noun phrases - much better for distinguishing concepts like "carburetor engine" vs "fuel injection system"
  const nounPhrases = extractNounPhrases(normalized);

  const negations = matchPhrases(normalized, NEGATION_PATTERN);
  const constraints = matchConstraintPhrases(normalized);
  const focusPhrases = extractQuotedPhrases(normalized);

  // Ensure entities like numbers remain even if remove duplicates earlier
  for (const numeric of normalized.match(/\b\d+(?:\.\d+)?\b/g) || []) {
    if (!keyTerms.includes(numeric)) {
      keyTerms.push(numeric);
    }
  }
  
  // Merge noun phrases into key terms for better coverage
  const mergedTerms = dedupe([...nounPhrases, ...keyTerms]);

  return {
    intent,
    keyTerms: mergedTerms.slice(0, 15),
    constraints,
    negations,
    focusPhrases,
    nounPhrases,
    isTrickQuestion,
    contradictoryTerms
  };
}

function extractNounPhrases(text: string): string[] {
  const phrases: string[] = [];
  
  // Pattern 1: System/component name patterns (e.g., "fuel injection system", "carburetor engine")
  const systemPattern = /\b([a-z\s]+?)(?:system|engine|mechanism|component|process|method|device|apparatus|unit|module|type)\b/gi;
  let match;
  systemPattern.lastIndex = 0;
  while ((match = systemPattern.exec(text)) !== null) {
    const phrase = match[1].trim().toLowerCase();
    if (phrase.length > 2) {
      phrases.push(phrase + ' ' + match[0].slice(match[1].length).trim());
    }
  }
  
  // Pattern 2: Capitalized multi-word terms (proper nouns)
  const capitalizedPattern = /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  capitalizedPattern.lastIndex = 0;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    phrases.push(match[0].toLowerCase());
  }
  
  // Pattern 3: "X and Y" patterns (good for comparisons)
  const andPattern = /\b([a-z\s]{3,}?)\s+and\s+([a-z\s]{3,}?)\b/gi;
  andPattern.lastIndex = 0;
  while ((match = andPattern.exec(text)) !== null) {
    phrases.push(match[1].trim().toLowerCase());
    phrases.push(match[2].trim().toLowerCase());
  }
  
  // Pattern 4: "X vs Y" or "X versus Y" patterns
  const versusPattern = /\b([a-z\s]{3,}?)\s+(?:vs\.?|versus)\s+([a-z\s]{3,}?)\b/gi;
  versusPattern.lastIndex = 0;
  while ((match = versusPattern.exec(text)) !== null) {
    phrases.push(match[1].trim().toLowerCase());
    phrases.push(match[2].trim().toLowerCase());
  }
  
  return dedupe(phrases.filter(p => p.length > 2 && !p.match(/^(the|and|or|of|in|on|at|to|from|by|with|without)\s*$/i)));
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
