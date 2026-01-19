/* eslint-disable no-restricted-globals */

// Enhanced hierarchical flashcard generation algorithm
// No AI required - purely rule-based with advanced pattern recognition

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
        content = content.replace(/^[•\*\-]\s+/, '');
        content = content.replace(/^\d+[\.)]\s+/, '');
        content = content.replace(/^[a-zA-Z][\.)]\s+/, '');
        content = content.replace(/^[ivxIVX]+[\.)]\s+/, '');

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
    const relevantParents = parents.slice(-2);
    if (relevantParents.length === 1) return `[${relevantParents[0]}]`;
    return `[${relevantParents.join(' → ')}]`;
}

function extractDefinition(content: string): { term: string; definition: string } | null {
    const colonMatch = content.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch && colonMatch[2].length > 2) {
        return { term: colonMatch[1].trim(), definition: colonMatch[2].trim() };
    }

    const dashMatch = content.match(/^([^-]+)\s+-\s+(.+)$/);
    if (dashMatch && dashMatch[2].length > 2) {
        return { term: dashMatch[1].trim(), definition: dashMatch[2].trim() };
    }

    return null;
}

function createClozeDeletion(content: string, keyPhrase: string): { front: string; back: string } | null {
    if (!content.includes(keyPhrase)) return null;
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
    if (depth > 15) return;

    const currentPath = node.content ? [...parents, node.content] : parents;
    const hasChildren = node.children.length > 0;
    const context = buildContext(parents);

    // STRATEGY 1: Definition Pattern
    const definition = extractDefinition(node.content);
    if (definition && node.content.length < 200) {
        patterns.push({
            type: 'definition',
            front: `${context ? context + ' ' : ''}What is "${definition.term}"?`,
            back: definition.definition,
            confidence: 0.9,
            originalText: node.content
        });

        if (hasChildren && node.children.length <= 5) {
            const details = node.children.map(c => `• ${c.content}`).join('\n');
            patterns.push({
                type: 'list',
                front: `${context ? context + ' ' : ''}What are the details about "${definition.term}"?`,
                back: details,
                confidence: 0.85,
                originalText: `${node.content}\n${details}`
            });
        }
    }
    // STRATEGY 2: List of Items
    else if (hasChildren && node.children.length >= 2) {
        const childrenWithContent = node.children.filter(c => c.content.trim());

        if (childrenWithContent.length > 0) {
            // Chunk large lists
            if (childrenWithContent.length > 10) {
                const chunkSize = 5;
                for (let i = 0; i < childrenWithContent.length; i += chunkSize) {
                    const chunk = childrenWithContent.slice(i, i + chunkSize);
                    const items = chunk.map(c => `• ${c.content}`).join('\n');
                    patterns.push({
                        type: 'list',
                        front: `${context ? context + ' ' : ''}${node.content} - What are items ${i + 1}-${Math.min(i + chunkSize, childrenWithContent.length)}?`,
                        back: items,
                        confidence: 0.8,
                        originalText: items
                    });
                }
            } else {
                const items = childrenWithContent.map(c => `• ${c.content}`).join('\n');
                if (node.content.trim()) {
                    patterns.push({
                        type: 'list',
                        front: `${context ? context + ' ' : ''}What are the main points about "${node.content}"?`,
                        back: items,
                        confidence: 0.85,
                        originalText: `${node.content}\n${items}`
                    });
                }

                // Individual cloze cards for short items
                if (childrenWithContent.every(c => c.content.length < 50) && childrenWithContent.length <= 7) {
                    childrenWithContent.forEach(child => {
                        if (child.content.length > 10) {
                            const cloze = createClozeDeletion(`${node.content}: ${child.content}`, child.content);
                            if (cloze) {
                                patterns.push({
                                    type: 'cloze',
                                    front: cloze.front,
                                    back: cloze.back,
                                    confidence: 0.75,
                                    originalText: child.content
                                });
                            }
                        }
                    });
                }
            }
        }
    }
    // STRATEGY 3: Single Child
    else if (hasChildren && node.children.length === 1) {
        const child = node.children[0];
        if (node.content.trim() && child.content.trim()) {
            patterns.push({
                type: 'question',
                front: `${context ? context + ' ' : ''}${node.content}`,
                back: child.content,
                confidence: 0.8,
                originalText: `${node.content}\n${child.content}`
            });
        }
    }
    // STRATEGY 4: Leaf Node Fact
    else if (!hasChildren && node.content.trim() && parents.length > 0) {
        const parentTopic = parents[parents.length - 1];
        if (node.content.split(/\s+/).length >= 4) {
            patterns.push({
                type: 'fact',
                front: `${buildContext(parents.slice(0, -1))} What is one key point about "${parentTopic}"?`,
                back: node.content,
                confidence: 0.75,
                originalText: node.content
            });

            // Cloze deletion for memorable facts
            const words = node.content.split(/\s+/);
            if (words.length >= 5 && words.length <= 15) {
                const importantWord = words
                    .filter(w => w.length > 3)
                    .sort((a, b) => {
                        const aScore = (a[0] === a[0].toUpperCase() ? 10 : 0) + a.length;
                        const bScore = (b[0] === b[0].toUpperCase() ? 10 : 0) + b.length;
                        return bScore - aScore;
                    })[0];

                if (importantWord) {
                    const cloze = createClozeDeletion(node.content, importantWord);
                    if (cloze) {
                        patterns.push({
                            type: 'cloze',
                            front: cloze.front,
                            back: cloze.back,
                            confidence: 0.7,
                            originalText: node.content
                        });
                    }
                }
            }
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
