export interface PDFTextItem {
    str: string;
    dir: string;
    transform: number[]; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
    width: number;
    height: number;
    fontName: string;
    hasEOL: boolean;
}

export interface LayoutBlock {
    type: 'heading' | 'paragraph' | 'table' | 'list';
    text: string;
    boundingBox: { x: number, y: number, w: number, h: number };
    fontSize: number;
}

/**
 * Parses raw PDF text items into structured layout blocks.
 * Groups items by line, then by block based on font size and spacing.
 */
export function parseLayout(items: PDFTextItem[]): LayoutBlock[] {
    if (items.length === 0) return [];

    // 1. Calculate statistics (common font size) to detect body text vs headings
    const fontSizes = items.map(i => Math.sqrt(i.transform[0] * i.transform[0] + i.transform[1] * i.transform[1])); // Approximate scale
    const sizeCounts: Record<number, number> = {};
    fontSizes.forEach(s => {
        const rounded = Math.round(s * 10) / 10;
        sizeCounts[rounded] = (sizeCounts[rounded] || 0) + 1;
    });
    
    let bodyFontSize = 0;
    let maxCount = 0;
    for (const [size, count] of Object.entries(sizeCounts)) {
        if (count > maxCount) {
            maxCount = count;
            bodyFontSize = parseFloat(size);
        }
    }

    // 2. Group into lines
    // Sort by Y (descending for PDF usually), then X
    // PDF Y is usually 0 at bottom.
    const sortedItems = [...items].sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        if (Math.abs(yA - yB) > 5) return yB - yA; // Different lines (threshold 5 units)
        return a.transform[4] - b.transform[4]; // Same line, sort by X
    });

    const lines: PDFTextItem[][] = [];
    let currentLine: PDFTextItem[] = [];
    let lastY = sortedItems[0].transform[5];

    for (const item of sortedItems) {
        const y = item.transform[5];
        // Check if new line
        if (Math.abs(y - lastY) > 5) { 
            if (currentLine.length > 0) lines.push(currentLine);
            currentLine = [];
            lastY = y;
        }
        currentLine.push(item);
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // 3. Group lines into blocks
    const blocks: LayoutBlock[] = [];
    let currentBlockItems: PDFTextItem[] = [];
    let currentBlockType: 'heading' | 'paragraph' = 'paragraph';
    
    for (const line of lines) {
        const firstItem = line[0];
        const fontSize = Math.sqrt(firstItem.transform[0] * firstItem.transform[0] + firstItem.transform[1] * firstItem.transform[1]);
        
        // Heuristic: Heading if font is significantly larger than body
        const isHeading = fontSize > bodyFontSize * 1.15; // 15% larger
        
        // If type changes, push old block
        // Also push if we have a large vertical gap (paragraph break) - TODO
        if ((isHeading && currentBlockType !== 'heading') || (!isHeading && currentBlockType === 'heading')) {
            if (currentBlockItems.length > 0) {
                blocks.push(createBlock(currentBlockItems, currentBlockType));
                currentBlockItems = [];
            }
            currentBlockType = isHeading ? 'heading' : 'paragraph';
        }
        
        currentBlockItems.push(...line);
    }
    
    if (currentBlockItems.length > 0) {
        blocks.push(createBlock(currentBlockItems, currentBlockType));
    }

    return blocks;
}

function createBlock(items: PDFTextItem[], type: 'heading' | 'paragraph'): LayoutBlock {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let text = "";
    let totalFontSize = 0;
    let lastX = -1;

    items.forEach(item => {
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width;
        const h = item.height || 10; // Fallback
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
        
        // Add space if there's a gap
        if (lastX !== -1 && x - lastX > 5) {
            text += " ";
        }
        text += item.str;
        lastX = x + item.width;
        
        totalFontSize += Math.sqrt(item.transform[0]**2 + item.transform[1]**2);
    });

    // Clean up text
    text = text.replace(/\s+/g, ' ').trim();

    return {
        type,
        text,
        boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        fontSize: totalFontSize / items.length
    };
}
