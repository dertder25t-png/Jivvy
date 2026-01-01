/**
 * ICS (iCalendar) Parser
 * 
 * Parses .ics files locally without external dependencies.
 * Maps calendar events to task data for import.
 */

import { createAppError, type AppError } from '@/lib/errors';

// ============================================================================
// TYPES
// ============================================================================

export interface ICSEvent {
    uid: string;
    summary: string;
    description?: string;
    dtstart: Date;
    dtend?: Date;
    location?: string;
    rrule?: string;
    categories?: string[];
}

export type ParsedICSSuccess = {
    ok: true;
    events: ICSEvent[];
    name?: string;
};

export type ParsedICSError = {
    ok: false;
    error: AppError;
};

export type ParsedICS = ParsedICSSuccess | ParsedICSError;

export interface TaskFromEvent {
    id: string;
    content: string;
    dueDate: number;
    description?: string;
    tags: string[];
    selected: boolean;
    sourceEvent: ICSEvent;
}

// ============================================================================
// KEYWORDS FOR TAG DETECTION
// ============================================================================

const URGENT_KEYWORDS = [
    'exam', 'final', 'midterm', 'quiz', 'test',
    'deadline', 'due', 'submit', 'submission',
    'presentation', 'defense'
];

const ASSIGNMENT_KEYWORDS = [
    'assignment', 'homework', 'hw', 'project',
    'paper', 'essay', 'report', 'lab'
];

const READING_KEYWORDS = [
    'reading', 'chapter', 'ch.', 'pages', 'read'
];

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a date string from ICS format (YYYYMMDD or YYYYMMDDTHHmmssZ)
 */
function parseICSDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Remove timezone info for basic parsing
    const cleaned = dateStr.replace(/[TZ]/g, '').trim();

    try {
        if (cleaned.length === 8) {
            // YYYYMMDD format (all-day event)
            const year = parseInt(cleaned.slice(0, 4), 10);
            const month = parseInt(cleaned.slice(4, 6), 10) - 1;
            const day = parseInt(cleaned.slice(6, 8), 10);
            return new Date(year, month, day);
        } else if (cleaned.length >= 14) {
            // YYYYMMDDTHHmmss format
            const year = parseInt(cleaned.slice(0, 4), 10);
            const month = parseInt(cleaned.slice(4, 6), 10) - 1;
            const day = parseInt(cleaned.slice(6, 8), 10);
            const hour = parseInt(cleaned.slice(8, 10), 10);
            const minute = parseInt(cleaned.slice(10, 12), 10);
            const second = parseInt(cleaned.slice(12, 14), 10);
            
            // Handle UTC vs local
            if (dateStr.endsWith('Z')) {
                return new Date(Date.UTC(year, month, day, hour, minute, second));
            }
            return new Date(year, month, day, hour, minute, second);
        }
    } catch {
        // Fall through to null
    }

    return null;
}

/**
 * Unfold ICS content lines (lines starting with space/tab are continuations)
 */
function unfoldLines(icsContent: string): string[] {
    const lines: string[] = [];
    const rawLines = icsContent.split(/\r?\n/);

    for (const line of rawLines) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
            // Continuation of previous line
            if (lines.length > 0) {
                lines[lines.length - 1] += line.slice(1);
            }
        } else {
            lines.push(line);
        }
    }

    return lines;
}

/**
 * Parse a single property line
 */
function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;

    const beforeColon = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Parse property name and parameters
    const semiIdx = beforeColon.indexOf(';');
    const name = (semiIdx === -1 ? beforeColon : beforeColon.slice(0, semiIdx)).toUpperCase();
    const params: Record<string, string> = {};

    if (semiIdx !== -1) {
        const paramStr = beforeColon.slice(semiIdx + 1);
        const paramPairs = paramStr.split(';');
        for (const pair of paramPairs) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx !== -1) {
                const pName = pair.slice(0, eqIdx).toUpperCase();
                const pValue = pair.slice(eqIdx + 1).replace(/^"|"$/g, '');
                params[pName] = pValue;
            }
        }
    }

    return { name, params, value };
}

/**
 * Unescape ICS text values
 */
function unescapeValue(value: string): string {
    return value
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

/**
 * Parse ICS content and extract events
 */
export function parseICS(icsContent: string): ParsedICS {
    try {
        if (!icsContent || typeof icsContent !== 'string') {
            return {
                ok: false,
                error: createAppError('ICS_PARSE_EMPTY', 'No ICS content provided', { retryable: false }),
            };
        }

        // Check for ICS header
        if (!icsContent.includes('BEGIN:VCALENDAR')) {
            return {
                ok: false,
                error: createAppError('ICS_PARSE_INVALID', 'Invalid ICS format - missing VCALENDAR', { retryable: false }),
            };
        }

        const lines = unfoldLines(icsContent);
        const events: ICSEvent[] = [];
        let calendarName: string | undefined;

        let currentEvent: Partial<ICSEvent> | null = null;
        let inEvent = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed === 'BEGIN:VEVENT') {
                inEvent = true;
                currentEvent = {};
                continue;
            }

            if (trimmed === 'END:VEVENT') {
                if (currentEvent && currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
                    events.push(currentEvent as ICSEvent);
                }
                currentEvent = null;
                inEvent = false;
                continue;
            }

            const prop = parseProperty(trimmed);
            if (!prop) continue;

            // Calendar name
            if (prop.name === 'X-WR-CALNAME' && !calendarName) {
                calendarName = unescapeValue(prop.value);
                continue;
            }

            if (!inEvent || !currentEvent) continue;

            // Event properties
            switch (prop.name) {
                case 'UID':
                    currentEvent.uid = prop.value;
                    break;
                case 'SUMMARY':
                    currentEvent.summary = unescapeValue(prop.value);
                    break;
                case 'DESCRIPTION':
                    currentEvent.description = unescapeValue(prop.value);
                    break;
                case 'LOCATION':
                    currentEvent.location = unescapeValue(prop.value);
                    break;
                case 'DTSTART': {
                    const dt = parseICSDate(prop.value);
                    if (dt) currentEvent.dtstart = dt;
                    break;
                }
                case 'DTEND': {
                    const dt = parseICSDate(prop.value);
                    if (dt) currentEvent.dtend = dt;
                    break;
                }
                case 'RRULE':
                    currentEvent.rrule = prop.value;
                    break;
                case 'CATEGORIES':
                    currentEvent.categories = prop.value.split(',').map(c => c.trim());
                    break;
            }
        }

        return {
            ok: true,
            events,
            name: calendarName,
        };

    } catch (error) {
        console.error('[ICSParser] Parse error:', error);
        return {
            ok: false,
            error: createAppError('ICS_PARSE_FAILED', 'Failed to parse ICS content', {
                retryable: false,
                detail: { message: error instanceof Error ? error.message : 'Unknown error' },
            }),
        };
    }
}

/**
 * Detect tags based on event content
 */
function detectTags(event: ICSEvent): string[] {
    const tags: string[] = [];
    const text = `${event.summary} ${event.description || ''}`.toLowerCase();

    // Check for urgent keywords
    if (URGENT_KEYWORDS.some(kw => text.includes(kw))) {
        tags.push('#Urgent');
    }

    // Check for assignment keywords
    if (ASSIGNMENT_KEYWORDS.some(kw => text.includes(kw))) {
        tags.push('#Assignment');
    }

    // Check for reading keywords
    if (READING_KEYWORDS.some(kw => text.includes(kw))) {
        tags.push('#Reading');
    }

    // Add any categories from the event
    if (event.categories) {
        for (const cat of event.categories) {
            const tag = `#${cat.replace(/\s+/g, '')}`;
            if (!tags.includes(tag)) {
                tags.push(tag);
            }
        }
    }

    return tags;
}

/**
 * Convert ICS events to task imports
 */
export function eventsToTasks(events: ICSEvent[]): TaskFromEvent[] {
    const tasks: TaskFromEvent[] = [];

    for (const event of events) {
        // Skip past events by default
        const now = new Date();
        if (event.dtstart < now) {
            continue;
        }

        const id = `import-${event.uid}-${Date.now()}`;
        const tags = detectTags(event);

        tasks.push({
            id,
            content: event.summary,
            dueDate: event.dtstart.getTime(),
            description: event.description,
            tags,
            selected: true, // Default to selected
            sourceEvent: event,
        });
    }

    // Sort by due date
    tasks.sort((a, b) => a.dueDate - b.dueDate);

    return tasks;
}

/**
 * Fetch and parse ICS from URL
 */
export async function fetchAndParseICS(url: string): Promise<ParsedICS> {
    try {
        // Use our proxy API to fetch the ICS
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return {
                ok: false,
                error: createAppError(
                    data.code || 'ICS_FETCH_FAILED',
                    data.error || 'Failed to fetch ICS feed',
                    { retryable: true }
                ),
            };
        }

        const data = await response.json();
        if (!data.ok || !data.content) {
            return {
                ok: false,
                error: createAppError('ICS_FETCH_EMPTY', 'No content received from ICS feed', { retryable: true }),
            };
        }

        return parseICS(data.content);

    } catch (error) {
        console.error('[ICSParser] Fetch error:', error);
        return {
            ok: false,
            error: createAppError('ICS_FETCH_FAILED', 'Failed to fetch ICS feed', {
                retryable: true,
                detail: { message: error instanceof Error ? error.message : 'Network error' },
            }),
        };
    }
}
