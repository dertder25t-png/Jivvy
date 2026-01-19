export interface FlashcardGenerationResult {
    flashcards: { front: string; back: string }[];
    error?: any;
}

interface ParsedNode {
    content: string;
    level: number;
    children: ParsedNode[];
    lineIndex: number;
}

/**
 * Parse indented text into a hierarchical tree structure
 * Handles massive amounts of sub-points efficiently
 */
function parseHierarchy(text: string): ParsedNode[] {
    const lines = text.split('\n').map(line => line.trimEnd());
    const root: ParsedNode[] = [];
    const stack: { node: ParsedNode; level: number }[] = [];

    lines.forEach((line, index) => {
        if (!line.trim()) return;

        // Calculate indentation level (supports both spaces and tabs)
        const match = line.match(/^(\s*)/);
        const indent = match ? match[1].replace(/\t/g, '  ').length : 0;
        const level = Math.floor(indent / 2);

        // Remove leading markers (•, *, -, numbers, letters, etc.)
        let content = line.trim();
        content = content.replace(/^[•\*\-]\s+/, ''); // Bullet points
        content = content.replace(/^\d+[\.)]\s+/, ''); // Numbered lists (1. or 1))
        content = content.replace(/^[a-zA-Z][\.)]\s+/, ''); // Lettered lists (a. or a))
        content = content.replace(/^[ivxIVX]+[\.)]\s+/, ''); // Roman numerals

        // Don't skip empty content after cleanup - it might have children
        if (!content && level === 0) return;

        const node: ParsedNode = {
            content: content || '',
            level,
            children: [],
            lineIndex: index
        };

        // Build hierarchy using stack
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

/**
 * Build contextual breadcrumb from parent hierarchy
 */
function buildContext(parents: string[]): string {
    if (parents.length === 0) return '';
    // Use last 2 parents max for brevity
    const relevantParents = parents.slice(-2);
    if (relevantParents.length === 1) return `[${relevantParents[0]}]`;
    return `[${relevantParents.join(' → ')}]`;
}

/**
 * Check if content is a definition pattern
 */
function isDefinitionPattern(content: string): boolean {
    // term: definition
    if (/^[^:]+:\s*.{3,}/.test(content)) return true;
    // term - definition (with dash)
    if (/^[^-]+\s+-\s+.{3,}/.test(content)) return true;
    return false;
}

/**
 * Extract term and definition from patterns
 */
function extractDefinition(content: string): { term: string; definition: string } | null {
    // Colon pattern: "term: definition"
    const colonMatch = content.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch && colonMatch[2].length > 2) {
        return { term: colonMatch[1].trim(), definition: colonMatch[2].trim() };
    }

    // Dash pattern: "term - definition"
    const dashMatch = content.match(/^([^-]+)\s+-\s+(.+)$/);
    if (dashMatch && dashMatch[2].length > 2) {
        return { term: dashMatch[1].trim(), definition: dashMatch[2].trim() };
    }

    return null;
}

/**
 * Create cloze deletion flashcard (fill-in-the-blank)
 * Example: "The capital of France is [Paris]" -> "The capital of France is ___?"
 */
function createClozeDeletion(content: string, keyPhrase: string): { front: string; back: string } | null {
    if (!content.includes(keyPhrase)) return null;

    const clozeText = content.replace(keyPhrase, '___');
    return {
        front: `${clozeText}`,
        back: keyPhrase
    };
}

/**
 * Check if node should be condensed (too many children)
 */
function shouldCondense(children: ParsedNode[]): boolean {
    return children.length > 10; // Condense if more than 10 items
}

/**
 * Condense many children into groups
 */
function condenseChildren(children: ParsedNode[]): { front: string; back: string }[] {
    const cards: { front: string; back: string }[] = [];
    const chunkSize = 5;

    // Split into chunks of 5 for better retention
    for (let i = 0; i < children.length; i += chunkSize) {
        const chunk = children.slice(i, i + chunkSize);
        const items = chunk.map(c => `• ${c.content}`).join('\n');

        cards.push({
            front: `What are items ${i + 1}-${Math.min(i + chunkSize, children.length)}?`,
            back: items
        });
    }

    return cards;
}

/**
 * Generate flashcards from hierarchical node tree
 * Optimized to handle massive amounts of sub-points
 */
function generateFromNode(
    node: ParsedNode,
    parents: string[],
    flashcards: { front: string; back: string }[],
    depth: number = 0
): void {
    // Skip if no content and no children
    if (!node.content.trim() && node.children.length === 0) return;

    // Prevent infinite recursion / handle extremely deep trees
    if (depth > 15) return;

    const currentPath = node.content ? [...parents, node.content] : parents;
    const hasChildren = node.children.length > 0;
    const context = buildContext(parents);

    // STRATEGY 1: Simple Definition Pattern (highest priority)
    const definition = extractDefinition(node.content);
    if (definition && node.content.length < 200) {
        flashcards.push({
            front: `${context ? context + ' ' : ''}What is "${definition.term}"?`,
            back: definition.definition
        });

        // If it has children (elaborations), create a detail card
        if (hasChildren && node.children.length <= 5) {
            const details = node.children.map(c => `• ${c.content}`).join('\n');
            flashcards.push({
                front: `${context ? context + ' ' : ''}What are the details about "${definition.term}"?`,
                back: details
            });
        }
    }
    // STRATEGY 2: List of Items (Parent with multiple children)
    else if (hasChildren && node.children.length >= 2) {
        const childrenWithContent = node.children.filter(c => c.content.trim());

        if (childrenWithContent.length === 0) {
            // Skip this node, but process children
        } else if (shouldCondense(childrenWithContent)) {
            // MASSIVE LIST: Break into smaller chunks
            const condensedCards = condenseChildren(childrenWithContent);
            condensedCards.forEach(card => {
                flashcards.push({
                    front: `${context ? context + ' ' : ''}${node.content} - ${card.front}`,
                    back: card.back
                });
            });
        } else {
            // Normal list: Create overview card
            const items = childrenWithContent.map(c => `• ${c.content}`).join('\n');

            if (node.content.trim()) {
                flashcards.push({
                    front: `${context ? context + ' ' : ''}What are the main points about "${node.content}"?`,
                    back: items
                });
            }

            // If children are short (< 50 chars), create individual cloze cards
            if (childrenWithContent.every(c => c.content.length < 50) && childrenWithContent.length <= 7) {
                childrenWithContent.forEach(child => {
                    if (child.content.length > 10) {
                        // Create cloze deletion for each item
                        const cloze = createClozeDeletion(
                            `${node.content}: ${child.content}`,
                            child.content
                        );
                        if (cloze) flashcards.push(cloze);
                    }
                });
            }
        }
    }
    // STRATEGY 3: Single Child (Explanation/Elaboration)
    else if (hasChildren && node.children.length === 1) {
        const child = node.children[0];
        if (node.content.trim() && child.content.trim()) {
            flashcards.push({
                front: `${context ? context + ' ' : ''}${node.content}`,
                back: child.content
            });
        }
    }
    // STRATEGY 4: Standalone Fact (Leaf node with substantial content)
    else if (!hasChildren && node.content.trim() && parents.length > 0) {
        const parentTopic = parents[parents.length - 1];

        // Only create if content is substantial (4+ words)
        if (node.content.split(/\s+/).length >= 4) {
            flashcards.push({
                front: `${buildContext(parents.slice(0, -1))} What is one key point about "${parentTopic}"?`,
                back: node.content
            });

            // Also try cloze deletion for memorable facts
            const words = node.content.split(/\s+/);
            if (words.length >= 5 && words.length <= 15) {
                // Find the most "important" word (longest word, or capitalized)
                const importantWord = words
                    .filter(w => w.length > 3)
                    .sort((a, b) => {
                        const aScore = (a[0] === a[0].toUpperCase() ? 10 : 0) + a.length;
                        const bScore = (b[0] === b[0].toUpperCase() ? 10 : 0) + b.length;
                        return bScore - aScore;
                    })[0];

                if (importantWord) {
                    const cloze = createClozeDeletion(node.content, importantWord);
                    if (cloze) flashcards.push(cloze);
                }
            }
        }
    }
    // STRATEGY 5: Top-level Topic (no children, standalone)
    else if (!hasChildren && parents.length === 0 && node.content.length > 20) {
        flashcards.push({
            front: 'What is this key concept?',
            back: node.content
        });
    }

    // Recursively process all children
    node.children.forEach(child => {
        generateFromNode(child, currentPath, flashcards, depth + 1);
    });
}

/**
 * Enhanced flashcard generation from hierarchical lecture notes
 * Handles massive amounts of sub-points efficiently without AI
 * 
 * Based on best practices:
 * - Hierarchical parsing
 * - Cloze deletion for active recall
 * - Condensation of large lists
 * - Multiple question types
 * - Context preservation
 */
export async function generateFlashcardsFromNotes(notes: string): Promise<FlashcardGenerationResult> {
    const flashcards: { front: string; back: string }[] = [];

    if (!notes || notes.trim().length === 0) {
        return { flashcards: [] };
    }

    try {
        // Parse the text into a hierarchical structure
        const tree = parseHierarchy(notes);

        // Generate flashcards from each top-level node
        tree.forEach(node => {
            generateFromNode(node, [], flashcards, 0);
        });

        // Deduplicate flashcards (exact matches)
        const seen = new Set<string>();
        const uniqueFlashcards = flashcards.filter(card => {
            const key = `${card.front}|||${card.back}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by front text for consistency
        uniqueFlashcards.sort((a, b) => a.front.localeCompare(b.front));

        // If no pattern-based cards were generated but we have substantial content,
        // create a fallback summary card
        if (uniqueFlashcards.length === 0 && notes.trim().length > 30) {
            const lines = notes.split('\n').filter(l => l.trim()).slice(0, 5);
            if (lines.length > 0) {
                uniqueFlashcards.push({
                    front: 'What are the main topics covered in this section?',
                    back: lines.map(l => `• ${l.trim().replace(/^[•\*\-]\s+/, '')}`).join('\n')
                });
            }
        }

        // Limit total cards to prevent overwhelming the user (optional)
        const MAX_CARDS = 100; // Reasonable limit for massive notes
        const limitedFlashcards = uniqueFlashcards.slice(0, MAX_CARDS);

        return { flashcards: limitedFlashcards };
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return { flashcards: [], error };
    }
}
