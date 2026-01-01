export function tidyMarkdown(input: string): string {
    const text = String(input ?? '').replace(/\r\n/g, '\n');
    if (!text.trim()) return '';

    const rawLines = text.split('\n');
    const normalizedLines: string[] = [];

    for (const raw of rawLines) {
        const line = raw.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
            normalizedLines.push('');
            continue;
        }

        // Normalize common bullet glyphs and list markers.
        let next = line
            .replace(/^\s*[•·▪◦]\s+/, '- ')
            .replace(/^\s*[-*+]\s+/, '- ')
            .replace(/^\s*(\d+)[\).]\s+/, '$1. ');

        const core = next.trim();

        // Heuristic heading detection: short ALL CAPS lines or trailing-colon labels.
        const isShort = core.length <= 60;
        const isFewWords = core.split(/\s+/).length <= 8;
        const isAllCaps = core === core.toUpperCase() && /[A-Z]/.test(core);
        const isColonLabel = /:\s*$/.test(core);

        if (isShort && isFewWords && (isAllCaps || isColonLabel)) {
            const headingText = core.replace(/:\s*$/, '');
            next = `## ${headingText}`;
        }

        normalizedLines.push(next);
    }

    let out = normalizedLines.join('\n');

    // Ensure a blank line before/after headings for readability.
    out = out.replace(/([^\n])\n## /g, '$1\n\n## ');
    out = out.replace(/(\n## [^\n]+\n)(?=[^\n])/g, '$1\n');

    // Collapse excessive blank lines.
    out = out.replace(/\n{3,}/g, '\n\n');

    return out.trim();
}
