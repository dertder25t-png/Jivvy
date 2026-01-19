
import nlp from 'compromise';
import datePlugin from 'compromise-dates';

// Extend compromise with date plugin
nlp.plugin(datePlugin);

export interface TaskMetadata {
    date: Date | null;
    priority: string | null;
    project: string | null;
    tags: string[];
}

export interface ParseResult {
    cleanText: string;
    metadata: TaskMetadata;
    newProjectCandidate?: string;
}

export function parseTaskNaturalLanguage(text: string): ParseResult {
    let cleanText = text;
    const metadata: TaskMetadata = {
        date: null,
        priority: null,
        project: null,
        tags: []
    };

    const doc = nlp(text);

    // 1. Extract Dates
    // @ts-ignore - dates() is added by the plugin
    const dates = doc.dates().json();
    if (dates && dates.length > 0) {
        // Use the first detected date
        // compromise-dates returns ISO strings mainly
        const dateInfo = dates[0].dates;
        if (dateInfo && dateInfo.start) {
            metadata.date = new Date(dateInfo.start);

            // Remove the date text from the main string
            // We use the original 'text' from the json match to remove it
            const dateText = dates[0].text;
            // Create a case-insensitive regex effectively
            const regex = new RegExp(dateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            cleanText = cleanText.replace(regex, '');
        }
    }

    // 2. Extract Priorities (!p1, !priority, etc or p1, p2 as standalone tokens if we want)
    // Common pattern: p1, p2, p3 or !high !urgent
    // Heuristic: specific tokens like "p1" "p2" "p3" at start/end or with ! prefix
    const priorityMatch = cleanText.match(/(?:^|\s)(?:!|p)([1-4])(?:\s|$)/i);
    if (priorityMatch) {
        metadata.priority = `p${priorityMatch[1]}`;
        cleanText = cleanText.replace(priorityMatch[0], ' ');
    } else if (cleanText.match(/(?:^|\s)!high(?:\s|$)/i)) {
        metadata.priority = 'p1';
        cleanText = cleanText.replace(/(?:^|\s)!high(?:\s|$)/i, ' ');
    }

    // 3. Extract Projects (#project)
    const projectMatch = cleanText.match(/(?:^|\s)#(\w+)(?:\s|$)/);
    if (projectMatch) {
        metadata.project = projectMatch[1];
        cleanText = cleanText.replace(projectMatch[0], ' ');
    }

    // 4. Extract Tags (@tag)
    const tagMatches = cleanText.matchAll(/(?:^|\s)@(\w+)(?:\s|$)/g);
    for (const match of tagMatches) {
        metadata.tags.push(match[1]);
        // We will remove tags from text too
        // Note: multiple replaces might be tricky with index, but simple replace string works if unique
    }
    // Clean all tags in one go
    cleanText = cleanText.replace(/(?:^|\s)@(\w+)(?:\s|$)/g, ' ');

    // Cleanup whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return {
        cleanText,
        metadata,
    };
}
