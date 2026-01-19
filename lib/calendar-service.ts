
import ICAL from 'ical.js';

export interface CalendarEvent {
    uid: string;
    summary: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    isAllDay: boolean;
    raw: any;
}

export interface CategorizedItem {
    type: 'assignment' | 'event';
    priority?: 'p1' | 'p2' | 'p3';
    courseCode?: string; // e.g., "CS-101"
    projectTitle?: string; // e.g., "CS-101: Intro to CS"
    originalEvent: CalendarEvent;
}

/**
 * Fetches calendar data, handling CORS via proxy if needed.
 */
export async function fetchCalendarValues(url: string): Promise<string> {
    try {
        // Try direct fetch first (works for some non-browser contexts or permissive CORS)
        const res = await fetch(url);
        if (res.ok) return await res.text();
    } catch (e) {
        // Ignore and try proxy
    }

    // Fallback to proxy
    const proxyUrl = `/api/proxy-calendar?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.statusText}`);
    return await res.text();
}

/**
 * Parses ICS string into structured events.
 */
export function parseCalendar(icsData: string): CalendarEvent[] {
    try {
        const jcalData = ICAL.parse(icsData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        return vevents.map(vevent => {
            const event = new ICAL.Event(vevent);
            return {
                uid: event.uid,
                summary: event.summary,
                description: event.description,
                startDate: event.startDate.toJSDate(),
                endDate: event.endDate ? event.endDate.toJSDate() : undefined,
                location: event.location,
                isAllDay: event.startDate.isDate, // isDate means just date (no time), so all-day
                raw: event
            };
        });
    } catch (e) {
        console.error("Failed to parse ICS data", e);
        return [];
    }
}

/**
 * Smartly categorizes an event into an Assignment (Task) or general Event (Calendar Item).
 */
export function categorizeEvent(event: CalendarEvent): CategorizedItem {
    const summary = event.summary || '';
    const description = event.description || '';
    const lowerSummary = summary.toLowerCase();

    // Heuristics for Academics

    // 1. Course Codes
    // Regex: 3-4 letters, optional space/dash, 3-4 numbers
    const courseRegex = /\b([A-Z]{2,4})[\s-]?(\d{3,4})\b/i;

    // Heuristic 2: PCCI format [T226UEN 210-5] -> Capture "UEN" and "210"
    const pcciRegex = /\[T\d{3}([A-Z]{3})\s(\d{3})-\d+\]/i;

    const pcciMatch = summary.match(pcciRegex) || description.match(pcciRegex);
    const courseMatch = summary.match(courseRegex) || description.match(courseRegex);

    let type: 'assignment' | 'event' = 'event';
    let priority: 'p1' | 'p2' | 'p3' | undefined = undefined;
    let courseCode: string | undefined = undefined;
    let projectTitle: string | undefined = undefined;

    // Detect Course
    if (pcciMatch) {
        courseCode = `${pcciMatch[1].toUpperCase()}-${pcciMatch[2]}`;
        projectTitle = courseCode;
    } else if (courseMatch) {
        courseCode = `${courseMatch[1].toUpperCase()}-${courseMatch[2]}`;
        projectTitle = courseCode;
    }

    // Detect Type
    const assignmentKeywords = ['assignment', 'quiz', 'exam', 'test', 'due', 'project', 'midterm', 'final', 'paper', 'draft'];
    const isAssignment = assignmentKeywords.some(kw => lowerSummary.includes(kw));

    if (isAssignment || courseCode) {
        // If we found a course code, we default to assignment/task unless it explicitly says "Class" or "Meeting"
        if (!lowerSummary.includes('no class') && !lowerSummary.includes('class meeting') && !lowerSummary.includes('office hours')) {
            // "Class" alone might be too generic ("Class Project"), so be specific about exclusion
            type = 'assignment';
        } else {
            type = 'event';
        }
    }

    // specific overrides
    const eventKeywords = ['chapel', 'work', 'shift', 'meeting', 'birthday', 'holiday', 'no class'];
    if (eventKeywords.some(kw => lowerSummary.includes(kw))) {
        type = 'event';
    }

    // Detect Priority
    if (type === 'assignment') {
        if (lowerSummary.includes('exam') || lowerSummary.includes('final') || lowerSummary.includes('midterm') || lowerSummary.includes('test')) {
            priority = 'p1';
        } else if (lowerSummary.includes('project') || lowerSummary.includes('paper') || lowerSummary.includes('quiz') || lowerSummary.includes('draft')) {
            priority = 'p2';
        } else if (lowerSummary.includes('homework') || lowerSummary.includes('assignment') || lowerSummary.includes('read')) {
            priority = 'p3';
        }
    }

    return {
        type,
        priority,
        courseCode,
        projectTitle,
        originalEvent: event
    };
}
