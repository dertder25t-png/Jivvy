import { Block, BlockType } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedBlockPreview {
    id: string; // Temporary ID
    type: BlockType;
    content: string;
    indentLevel: number;
    metadata: Record<string, any>;
}

// Bullet character patterns for Google Docs and other sources
// Filled bullets (●, •, *, ◆) = main_point (primary items)
// Empty/outline bullets (○, ◦, -) = bullet (sub-items)
// Square bullets (■, ▪, □) = bullet (deeper nesting)
const MAIN_POINT_BULLETS = /^[●•◆]\s*/;
const SUB_BULLET_CHARS = /^[○◦■▪□▶▷◇]\s*/;
const ASTERISK_BULLET = /^\*\s+/; // "* " pattern user uses in Google Docs

function stripBulletCharacter(text: string): { content: string; variant: 'main_point' | 'bullet' | null } {
    const trimmed = text.trim();

    // Check for main point bullets (filled circles, etc.)
    if (MAIN_POINT_BULLETS.test(trimmed)) {
        return { content: trimmed.replace(MAIN_POINT_BULLETS, '').trim(), variant: 'main_point' };
    }

    // Check for asterisk bullet (user's preferred main point marker)
    if (ASTERISK_BULLET.test(trimmed)) {
        return { content: trimmed.replace(ASTERISK_BULLET, '').trim(), variant: 'main_point' };
    }

    // Check for sub-bullets (empty circles, squares, etc.)
    if (SUB_BULLET_CHARS.test(trimmed)) {
        return { content: trimmed.replace(SUB_BULLET_CHARS, '').trim(), variant: 'bullet' };
    }

    // Check for dash bullet
    if (trimmed.startsWith('- ')) {
        return { content: trimmed.substring(2).trim(), variant: 'bullet' };
    }

    return { content: trimmed, variant: null };
}

function getIndentFromStyle(style: string): number {
    if (!style) return 0;

    // Normalize style string
    const normalized = style.toLowerCase();

    // Helper to extract value - handles various units
    const extract = (prop: string) => {
        // Match property with optional spaces and various units
        const regex = new RegExp(`${prop}\\s*:\\s*([\\d.]+)\\s*(pt|px|in|em|cm|mm)?`, 'i');
        const match = normalized.match(regex);
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const unit = (match[2] || 'px').toLowerCase();

        // Convert all units to pixels
        switch (unit) {
            case 'pt': return val * 1.333; // 1pt = 1.333px
            case 'px': return val;
            case 'in': return val * 96; // 1in = 96px
            case 'em': return val * 16; // Assume base 16px
            case 'cm': return val * 37.795; // 1cm ≈ 37.795px
            case 'mm': return val * 3.7795; // 1mm ≈ 3.7795px
            default: return val;
        }
    };

    const marginLeft = extract('margin-left');
    const paddingLeft = extract('padding-left');

    let totalPx = marginLeft + paddingLeft;

    if (totalPx <= 0) return 0;

    // Google Docs uses 0.5in (48px) per indent level
    // Standard word processors use ~36-48px per level
    // We'll use 40px as a good middle ground
    return Math.round(totalPx / 40);
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
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            // Check if this 'block' actually contains other blocks (is a container)
            // e.g. <div><p>...</p><p>...</p></div>
            const hasBlockChildren = Array.from(el.children).some(child =>
                ['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(child.tagName.toLowerCase())
            );

            if (hasBlockChildren) {
                // Recurse instead of consuming
                for (const child of Array.from(el.children)) {
                    traverse(child, effectiveIndent);
                }
                return;
            }

            // It's a leaf block (or contains only inline)
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

            // Split content by newlines to ensure 1 line = 1 block
            // GDocs/Word often put <br> inside <p>, which innerText converts to \n
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
                if (line.trim()) {
                    // Check for bullet characters (Google Docs format)
                    const { content: cleanContent, variant: bulletVariant } = stripBulletCharacter(line);

                    // Use bullet variant if detected, otherwise fall back to header detection
                    const finalMetadata = { ...metadata };
                    if (bulletVariant) {
                        finalMetadata.variant = bulletVariant;
                    }

                    if (cleanContent.trim()) {
                        results.push({
                            id: uuidv4(),
                            type,
                            content: cleanContent.trim(),
                            indentLevel: effectiveIndent,
                            metadata: finalMetadata,
                        });
                    }
                }
            }
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
                // Strip bullet characters and detect variant
                const { content: cleanContent, variant: bulletVariant } = stripBulletCharacter(textContent);

                // Determine variant priority: bold > bullet detection > default bullet
                let variant: 'main_point' | 'bullet' = 'bullet';
                if (liIsBold) {
                    variant = 'main_point';
                } else if (bulletVariant) {
                    variant = bulletVariant;
                }

                if (cleanContent.trim()) {
                    results.push({
                        id: uuidv4(),
                        type: 'text',
                        content: cleanContent.trim(),
                        indentLevel: effectiveIndent,
                        metadata: { variant },
                    });
                }
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
