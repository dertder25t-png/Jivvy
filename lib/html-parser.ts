import { Block, BlockType } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedBlockPreview {
    id: string; // Temporary ID
    type: BlockType;
    content: string;
    indentLevel: number;
    metadata: Record<string, any>;
}

function getIndentFromStyle(style: string): number {
    if (!style) return 0;

    // Normalize style string
    const normalized = style.toLowerCase();

    // Helper to extract value
    const extract = (prop: string) => {
        const match = normalized.match(new RegExp(`${prop}:\\s*([\\d.-]+)(pt|px|in|em)`));
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'pt') return val * 1.333;
        if (unit === 'px') return val;
        if (unit === 'in') return val * 96;
        if (unit === 'em') return val * 16;
        return 0;
    };

    const marginLeft = extract('margin-left');
    const paddingLeft = extract('padding-left');
    const textIndent = extract('text-indent'); // Hanging indents (bullets) often use negative text-indent

    // Effective visual indentation of the block body
    // Often: margin-left is the total indent. text-indent shifts the first line (bullet).
    // We care about the block's alignment, which is usually margin-left.
    // However, some editors assume margin-left + padding-left.

    let totalPx = marginLeft + paddingLeft;

    // If text-indent is negative, it sticks out. 
    // We usually want the 'content' indentation, which is 'margin-left'.
    // Jivvy indentation is roughly 24px-30px per level visually.
    // Let's be more sensitive: 20px per level.

    // Google Docs: Level 1 = 36pt (48px). Level 2 = 72pt.
    // If we divide by 24px, 48px -> 2. That's fine.
    // But if we divide by 40, 48px -> 1.

    if (totalPx <= 0) return 0;

    return Math.round(totalPx / 24);
}

export function parseHtmlToBlocks(html: string): ParsedBlockPreview[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    const results: ParsedBlockPreview[] = [];

    function traverse(node: Node, currentIndent: number) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                // Loose text, usually shouldn't happen in well-formed HTML from editors
                // but if it does, it takes current indent
                results.push({
                    id: uuidv4(),
                    type: 'text',
                    content: text,
                    indentLevel: currentIndent,
                    metadata: {},
                });
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Calculate extra indent from style
        const style = el.getAttribute('style') || '';
        const styleIndent = getIndentFromStyle(style);
        const effectiveIndent = currentIndent + styleIndent;

        // Visual properties
        const isBold = style.includes('font-weight: 700') ||
            style.includes('font-weight: bold') ||
            Number(style.match(/font-weight:\s*(\d+)/)?.[1] || 0) >= 600 ||
            tag === 'b' || tag === 'strong';

        // Check for direct bold wrapping: <p><b>Text</b></p>
        const directBoldChild = el.querySelector(':scope > b, :scope > strong');
        const isAllBold = isBold || (directBoldChild && directBoldChild.textContent === el.textContent?.trim());

        // Handle specific block tags
        if (tag === 'p' || tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
            const content = el.innerText.trim();
            if (!content) return;

            let type: BlockType = 'text';
            let metadata: Record<string, any> = {};

            if (tag === 'h1') metadata.variant = 'heading1';
            else if (tag === 'h2') metadata.variant = 'heading2';
            else if (tag === 'h3') metadata.variant = 'heading3';
            else if (tag.startsWith('h')) metadata.variant = 'heading3';

            // Map detected bold to "main_point" if not a header
            if (isAllBold && !metadata.variant) {
                metadata.variant = 'main_point';
            }

            results.push({
                id: uuidv4(),
                type,
                content: content,
                indentLevel: effectiveIndent,
                metadata,
            });
        }
        else if (tag === 'ul' || tag === 'ol') {
            // Lists usually add an indent level visually
            // Google docs nested lists might be flat <ul> structure with style indents?
            // Or standard nesting. Standard nesting adds one level.
            for (const child of Array.from(el.children)) {
                traverse(child, effectiveIndent);
            }
        }
        else if (tag === 'li') {
            // List item -> Block
            // Clean content: remove bullet chars if they exist in innerText
            // But wait, if we are in a UL, we likely want to say it IS a bullet metadata

            // NOTE: LI usually doesn't have margin-left for *indent*, the UL does. 
            // But if LI has nested lists, standard HTML handles it.

            // We need to handle content + potential nested lists

            // 1. Extract text content excluding nested lists
            const clone = el.cloneNode(true) as HTMLElement;
            const subLists = clone.querySelectorAll('ul, ol');
            subLists.forEach(sl => sl.remove());
            const textContent = clone.innerText.trim();

            // Detect bold in the LI text
            const liStyle = el.getAttribute('style') || '';
            const liIsBold = liStyle.includes('font-weight: 700') ||
                clone.querySelector('b, strong')?.textContent === textContent;

            if (textContent) {
                results.push({
                    id: uuidv4(),
                    type: 'text',
                    content: textContent,
                    indentLevel: effectiveIndent, // LI matches parent UL indent usually? Or +1? 
                    // In our recursive logic 'ul' didn't increment 'effectiveIndent' passed to children yet?
                    // Let's assume valid HTML lists imply +1 indent from the UL containment.
                    // But 'getIndentFromStyle' on UL might have added it.
                    // Let's just trust effectiveIndent and maybe add 1 for being in a list?
                    // The caller handles relative indent normalization.
                    metadata: {
                        variant: liIsBold ? 'main_point' : 'bullet'
                    },
                });
            }

            // 2. Traversal for children (nested lists)
            for (const child of Array.from(el.children)) {
                if (child.tagName === 'UL' || child.tagName === 'OL') {
                    // Nested list - standard HTML structure often nests UL inside LI
                    // We increment indent for the nested list
                    traverse(child, effectiveIndent + 1);
                }
            }
        }
        else if (tag === 'br') {
            // Ignore
        }
        else if (tag === 'b' || tag === 'strong' || tag === 'span' || tag === 'i' || tag === 'em' || tag === 'u') {
            // Inline tags directly at root (unlikely for copy-paste block context, usually inside p)
            // But if they appear, treat as text block
            // Recurse to get text
            for (const child of Array.from(el.childNodes)) {
                traverse(child, effectiveIndent);
            }
        }
        else {
            // Generic container
            for (const child of Array.from(el.children)) {
                traverse(child, effectiveIndent);
            }
        }
    }

    traverse(body, 0);

    return results.filter(b => b.content.length > 0);
}
