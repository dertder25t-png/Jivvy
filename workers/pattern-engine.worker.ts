/* eslint-disable no-restricted-globals */

// Enhanced hierarchical flashcard generation algorithm
// Prioritizes explicit structure (Question -> Answer) and user intent over arbitrary chunking.

export interface FlashcardPattern {
    type: 'definition' | 'question' | 'cloze' | 'list' | 'fact';
    front: string;
    back: string;
    confidence: number; // 0-1
    originalText: string;
}

interface ParsedNode {
    content: string;
    level: number;
    children: ParsedNode[];
    lineIndex: number;
}

/**
 * Parse indented text into hierarchical tree
 */
function parseHierarchy(text: string): ParsedNode[] {
    const lines = text.split('\n').map(line => line.trimEnd());
    const root: ParsedNode[] = [];
    const stack: { node: ParsedNode; level: number }[] = [];

    lines.forEach((line, index) => {
        if (!line.trim()) return;

        const match = line.match(/^(\s*)/);
        const indent = match ? match[1].replace(/\t/g, '  ').length : 0;
        const level = Math.floor(indent / 2);

        let content = line.trim();
        // Clean common bullet markers but keep semantic ones if needed
        // For "2 events..." we want to keep the "2 events" text.
        // Just remove strict bullet symbols.
        content = content.replace(/^([•\*\-]|\d+\.)\s+/, '');

        // Handle "Q:" or "A:" prefixes explicitly if user typed them
        content = content.replace(/^(Q:|Question:|A:|Answer:)\s*/i, '');

        if (!content && level === 0) return;

        const node: ParsedNode = {
            content: content || '',
            level,
            children: [],
            lineIndex: index
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        if (stack.length === 0) {
            root.push(node);
        } else {
            stack[stack.length - 1].node.children.push(node);
        }

        stack.push({ node, level });
    });

    return root;
}

function buildContext(parents: string[]): string {
    if (parents.length === 0) return '';
    // Only capture immediate parent if it seems like a category
    // e.g. "Politics" -> "Absolutism"
    const immediateParent = parents[parents.length - 1];

    // Don't include context if the parent is very long (likely a sentence/question itself)
    if (immediateParent.length > 50) return '';

    return `[${immediateParent}]`;
}

function extractDefinition(content: string): { term: string; definition: string } | null {
    // Term: Definition
    const colonMatch = content.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch && colonMatch[2].length > 2) {
        return { term: colonMatch[1].trim(), definition: colonMatch[2].trim() };
    }

    // Term - Definition (only if dash is bounded by spaces to avoid hyphenated words)
    const dashMatch = content.match(/^([^-]+)\s+-\s+(.+)$/);
    if (dashMatch && dashMatch[2].length > 2) {
        return { term: dashMatch[1].trim(), definition: dashMatch[2].trim() };
    }

    // Question? Answer
    const qMarkMatch = content.match(/^([^?]+\?)\s*(.+)$/);
    if (qMarkMatch) {
        return { term: qMarkMatch[1].trim(), definition: qMarkMatch[2].trim() };
    }

    return null;
}

function createClozeDeletion(content: string, keyPhrase: string): { front: string; back: string } | null {
    if (!content.includes(keyPhrase)) return null;
    // Replace only the first occurrence to avoid ambiguity or simple "replace all"
    const clozeText = content.replace(keyPhrase, '___');
    return { front: clozeText, back: keyPhrase };
}

function generateFromNode(
    node: ParsedNode,
    parents: string[],
    patterns: FlashcardPattern[],
    depth: number = 0
): void {
    if (!node.content.trim() && node.children.length === 0) return;
    if (depth > 15) return; // Recursion guard

    const currentPath = node.content ? [...parents, node.content] : parents;
    const hasChildren = node.children.length > 0;
    const context = buildContext(parents); // Optional context string

    // Clean content for processing
    const text = node.content;

    // --- STRATEGY 1: EXPLICIT Q&A PARENT ---
    // User typed "What are 2 events? \n - Event 1 \n - Event 2"
    if (hasChildren && (text.endsWith('?') || text.endsWith(':'))) {
        const answerText = node.children.map(c => `• ${c.content}`).join('\n');

        patterns.push({
            type: 'question',
            front: text, // Use exact text as question
            back: answerText,
            confidence: 0.95, // High confidence for explicit structure
            originalText: `${text}\n${answerText}`
        });

        // Don't recurse into children for new cards if they are just parts of the answer
        // UNLESS the children themselves have complexity (grandchild nodes).
        // For simple lists, stop here.
        if (node.children.every(c => c.children.length === 0)) {
            return;
        }
    }

    // --- STRATEGY 2: TOPIC -> LIST ---
    // "Rising Social Trends \n - trend 1 \n - trend 2"
    // No question mark, but has children.
    else if (hasChildren && node.children.length >= 2) {
        const answerText = node.children.map(c => `• ${c.content}`).join('\n');

        // Infer question
        const question = `What are the details about "${text}"?`;

        patterns.push({
            type: 'list',
            front: context ? `${context} ${question}` : question,
            back: answerText,
            confidence: 0.85,
            originalText: `${text}\n${answerText}`
        });

        // Check if children are complex enough to be their own cards
        // If a child is a leaf node, we might want to check for definition patterns
    }

    // --- STRATEGY 3: INLINE DEFINITION / Q&A ---
    // "Absolutism: Divine Right" or "Key issue = Sovereignty"
    const def = extractDefinition(text);
    if (def) {
        // If it has children, the children are *additional* details
        let back = def.definition;
        if (hasChildren) {
            back += '\n\n' + node.children.map(c => `• ${c.content}`).join('\n');
        }

        patterns.push({
            type: 'definition',
            front: def.term, // e.g. "Absolutism" or "Absolutism?"
            back: back,
            confidence: 0.9,
            originalText: text
        });

        // If we handled the children as details, we might skip full recursion
        // But let's allow recursion in case sub-points are rich
    }

    // --- STRATEGY 4: SINGLE CHILD ASSOCIATION ---
    // "Key political issue \n Sovereignty"
    else if (hasChildren && node.children.length === 1) {
        const child = node.children[0];
        // Only if parent is short enough to be a prompt
        if (text.length < 100) {
            patterns.push({
                type: 'question',
                front: context ? `${context} ${text}` : text,
                back: child.content,
                confidence: 0.8,
                originalText: `${text}\n${child.content}`
            });
        }
    }

    // Recursively process children
    node.children.forEach(child => {
        generateFromNode(child, currentPath, patterns, depth + 1);
    });
}

function detectPatterns(text: string): FlashcardPattern[] {
    if (!text || text.trim().length === 0) return [];

    const patterns: FlashcardPattern[] = [];

    try {
        const tree = parseHierarchy(text);
        tree.forEach(node => {
            generateFromNode(node, [], patterns, 0);
        });

        // Deduplicate
        const seen = new Set<string>();
        const uniquePatterns = patterns.filter(pattern => {
            const key = `${pattern.front}|||${pattern.back}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by confidence
        uniquePatterns.sort((a, b) => b.confidence - a.confidence);

        // Limit to 100 cards
        return uniquePatterns.slice(0, 100);
    } catch (error) {
        console.error('Error in flashcard generation:', error);
        return [];
    }
}

self.onmessage = (e: MessageEvent) => {
    const { text, blockId } = e.data;
    if (!text || typeof text !== 'string') return;

    const patterns = detectPatterns(text);

    if (patterns.length > 0) {
        self.postMessage({
            blockId,
            patterns,
            timestamp: Date.now()
        });
    }
};
