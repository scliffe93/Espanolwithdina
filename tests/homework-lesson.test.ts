import { describe, expect, it } from 'vitest';
import { lessonFor, lessonLabel } from '../src/lib/platform/homework';
import type { Booking, Homework } from '../src/lib/platform/types';

// Homework is named after the student's lesson nearest to when it was handed in, so it can be gone through in that lesson.
const day = (d: number, h = 10) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
const lesson = (d: number, extra: Partial<Booking> = {}): Booking => ({ id: `b${d}`, teacherId: 't', studentId: 'sam', startsAt: day(d), durationMin: 60, tz: 'UTC', format: 'online', location: '', topic: '', prepNotes: '', status: 'completed', createdAt: day(1), updatedAt: day(1), ...extra });
const hw = (assigned: number, done?: number, studentId = 'sam'): Homework => ({ id: 'h', teacherId: 't', studentId, activity: { kind: 'written', title: 'T' }, instructions: '', assignedAt: day(assigned, 12), dueAt: day(assigned + 6), status: done ? 'submitted' : 'assigned', ...(done ? { result: { completedAt: day(done, 18) } } : {}) });
// Five weekly lessons, one cancelled in between, and another student's lesson.
const lessons = [lesson(1), lesson(5), lesson(8), lesson(12, { status: 'cancelled' }), lesson(15), lesson(19), lesson(16, { studentId: 'anneka' })];

describe('the lesson a piece of homework belongs to', () => {
  it('is the lesson it was set in until it is handed in', () => {
    expect(lessonLabel(hw(19), lessons)).toBe('Homework for lesson 5');
    expect(lessonFor(hw(19), lessons)).toMatchObject({ number: 5, total: 5 });
  });
  it('is the lesson nearest to when it was handed in', () => {
    expect(lessonLabel(hw(8, 9), lessons)).toBe('Homework for lesson 3'); // done the day after lesson 3
    expect(lessonLabel(hw(8, 14), lessons)).toBe('Homework for lesson 4'); // done the evening before lesson 4
  });
  it('leaves out cancelled lessons and other students’ lessons', () => {
    expect(lessonFor(hw(8, 12), lessons)?.booking.id).toBe('b15');
    expect(lessonLabel(hw(8, 9, 'nobody'), lessons)).toBe('');
  });
});
