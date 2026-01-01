import * as chrono from 'chrono-node';

export interface ParsedTask {
    type: 'task' | 'project' | 'paper' | 'brainstorm';
    title: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: Date;
    projectId?: string; // If linking to existing logic, for now we just extract the name
    projectTag?: string; // The extracted tag word
}

export function parseInputString(text: string): ParsedTask {
    let cleanText = text;
    let type: ParsedTask['type'] = 'task';
    let priority: 'low' | 'medium' | 'high' | undefined = undefined;
    let projectTag: string | undefined = undefined;

    // 1. Type Detection
    if (/^(Project:|Folder:|New Project)/i.test(cleanText)) {
        type = 'project';
        cleanText = cleanText.replace(/^(Project:|Folder:|New Project\:?)\s*/i, '');
    }

    if (/^(Paper:|Essay:|Doc:|Document:)/i.test(cleanText)) {
        type = 'paper';
        cleanText = cleanText.replace(/^(Paper:|Essay:|Doc:|Document\:?)\s*/i, '');
    }

    if (/^(Brainstorm:|Canvas:|Board:|Note:|Notes:)/i.test(cleanText)) {
        type = 'brainstorm';
        cleanText = cleanText.replace(/^(Brainstorm:|Canvas:|Board:|Note\:|Notes\:?)\s*/i, '');
    }

    // 2. Priority Parsing
    if (/\b(urgent|high priority|!!)\b/i.test(cleanText)) {
        priority = 'high';
        cleanText = cleanText.replace(/\b(urgent|high priority|!!)\b/gi, '');
    } else if (/\b(medium priority|!)\b/i.test(cleanText)) {
        priority = 'medium';
        cleanText = cleanText.replace(/\b(medium priority|!)\b/gi, '');
    }

    // 3. Project Linking (Hashtags or "for X")
    // Simple regex for hashtag
    const tagMatch = cleanText.match(/#(\w+)/);
    if (tagMatch) {
        projectTag = tagMatch[1];
        // We generally keep tags in text for context, or remove them. 
        // User prompt implies extracting.
        // cleanText = cleanText.replace(/#\w+/, ''); 
    }

    // 4. Date Parsing (using Chrono)
    const parsedDate = chrono.parseDate(cleanText);
    if (parsedDate) {
        // Remove the date string from text to clean it up? 
        // Chrono gives us the text it matched.
        const results = chrono.parse(cleanText);
        if (results.length > 0) {
            results.forEach(result => {
                cleanText = cleanText.replace(result.text, '');
            });
        }
    }

    // Cleanup whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return {
        type,
        title: cleanText,
        priority,
        dueDate: parsedDate || undefined,
        projectTag
    };
}
