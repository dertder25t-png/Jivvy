/**
 * Tests for ICS Parser
 */

import { describe, it, expect } from 'vitest';
import { parseICS, eventsToTasks, type ICSEvent } from './ics-parser';

describe('ICS Parser', () => {
    describe('parseICS', () => {
        const validICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Test Calendar
BEGIN:VEVENT
UID:event1@test.com
SUMMARY:Midterm Exam
DESCRIPTION:Chapter 1-5 Review
DTSTART:20250115T090000Z
DTEND:20250115T110000Z
LOCATION:Room 101
END:VEVENT
BEGIN:VEVENT
UID:event2@test.com
SUMMARY:Assignment Due
DTSTART:20250120
END:VEVENT
END:VCALENDAR`;

        it('parses valid ICS content', () => {
            const result = parseICS(validICS);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.events.length).toBe(2);
                expect(result.name).toBe('Test Calendar');
            }
        });

        it('extracts event properties correctly', () => {
            const result = parseICS(validICS);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const event = result.events[0];
                expect(event.uid).toBe('event1@test.com');
                expect(event.summary).toBe('Midterm Exam');
                expect(event.description).toBe('Chapter 1-5 Review');
                expect(event.location).toBe('Room 101');
                expect(event.dtstart).toBeInstanceOf(Date);
            }
        });

        it('handles all-day events (YYYYMMDD format)', () => {
            const result = parseICS(validICS);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const allDayEvent = result.events[1];
                expect(allDayEvent.dtstart).toBeInstanceOf(Date);
                expect(allDayEvent.dtstart.getFullYear()).toBe(2025);
                expect(allDayEvent.dtstart.getMonth()).toBe(0); // January
                expect(allDayEvent.dtstart.getDate()).toBe(20);
            }
        });

        it('returns error for empty content', () => {
            const result = parseICS('');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('ICS_PARSE_EMPTY');
            }
        });

        it('returns error for invalid format', () => {
            const result = parseICS('This is not an ICS file');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('ICS_PARSE_INVALID');
            }
        });

        it('handles line unfolding', () => {
            const icsWithFolding = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test@test.com
SUMMARY:This is a very long event title that needs to be
 folded across multiple lines
DTSTART:20250115T090000Z
END:VEVENT
END:VCALENDAR`;

            const result = parseICS(icsWithFolding);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.events[0].summary).toContain('folded across multiple lines');
            }
        });

        it('unescapes special characters', () => {
            const icsWithEscapes = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test@test.com
SUMMARY:Meeting\\, with commas\\; and semicolons
DESCRIPTION:Line 1\\nLine 2
DTSTART:20250115T090000Z
END:VEVENT
END:VCALENDAR`;

            const result = parseICS(icsWithEscapes);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.events[0].summary).toBe('Meeting, with commas; and semicolons');
                expect(result.events[0].description).toBe('Line 1\nLine 2');
            }
        });
    });

    describe('eventsToTasks', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 7);

        const mockEvents: ICSEvent[] = [
            {
                uid: 'future1',
                summary: 'Final Exam',
                dtstart: futureDate,
            },
            {
                uid: 'past1',
                summary: 'Old Event',
                dtstart: pastDate,
            },
            {
                uid: 'future2',
                summary: 'Homework Assignment Due',
                description: 'Complete chapters 1-3',
                dtstart: futureDate,
            },
        ];

        it('filters out past events', () => {
            const tasks = eventsToTasks(mockEvents);
            const summaries = tasks.map(t => t.content);
            expect(summaries).not.toContain('Old Event');
        });

        it('converts future events to tasks', () => {
            const tasks = eventsToTasks(mockEvents);
            expect(tasks.length).toBe(2);
        });

        it('preserves description', () => {
            const tasks = eventsToTasks(mockEvents);
            const homeworkTask = tasks.find(t => t.content.includes('Homework'));
            expect(homeworkTask?.description).toBe('Complete chapters 1-3');
        });

        it('detects #Urgent tag for exam keywords', () => {
            const tasks = eventsToTasks(mockEvents);
            const examTask = tasks.find(t => t.content.includes('Exam'));
            expect(examTask?.tags).toContain('#Urgent');
        });

        it('detects #Assignment tag for assignment keywords', () => {
            const tasks = eventsToTasks(mockEvents);
            const assignmentTask = tasks.find(t => t.content.includes('Assignment'));
            expect(assignmentTask?.tags).toContain('#Assignment');
        });

        it('sorts tasks by due date', () => {
            const tasks = eventsToTasks(mockEvents);
            if (tasks.length > 1) {
                for (let i = 1; i < tasks.length; i++) {
                    expect(tasks[i].dueDate).toBeGreaterThanOrEqual(tasks[i - 1].dueDate);
                }
            }
        });

        it('sets selected to true by default', () => {
            const tasks = eventsToTasks(mockEvents);
            tasks.forEach(task => {
                expect(task.selected).toBe(true);
            });
        });
    });
});
