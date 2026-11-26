import { describe, expect, it } from 'vitest';
import { unbilledLessons } from '../src/lib/platform/invoicing';
import { balanceFor, balanceLabel, creditFromPackage, isLow, pricePerLesson } from '../src/lib/platform/packages';
import type { Booking, Credit, LessonPackage } from '../src/lib/platform/types';

const NOW = Date.UTC(2026, 10, 20, 12);
const b = (id: string, day: string, status: Booking['status'] = 'scheduled'): Booking => ({ id, teacherId: 't', studentId: 's', startsAt: `${day}T10:00:00Z`, durationMin: 60, tz: 'Europe/London', format: 'online', location: '', topic: 'Lesson', prepNotes: '', status, createdAt: '', updatedAt: '' });
const pkg: LessonPackage = { id: 'p5', name: '5 lessons', lessons: 5, minutesPerLesson: 60, price: 180, validMonths: 6 };
const credit = (over: Partial<Credit> = {}): Credit => ({ id: 'c1', teacherId: 't', studentId: 's', name: '5 lessons', lessons: 5, minutesPerLesson: 60, price: 180, currency: 'GBP', purchasedAt: '2026-11-01', createdAt: '', ...over });

describe('lesson packages', () => {
  it('turns a package into a credit with expiry and per-lesson price', () => {
    const c = creditFromPackage(pkg, 's', 't', 'GBP', '2026-11-01', 'c1');
    expect(c).toMatchObject({ lessons: 5, price: 180, expiresAt: '2027-05-01', packageId: 'p5' });
    expect(pricePerLesson(pkg)).toBe(36);
  });
  it('consumes credits with taught lessons from the purchase date, ignoring cancelled and individually billed ones', () => {
    const bookings = [b('old', '2026-10-20'), b('l1', '2026-11-03'), b('l2', '2026-11-10'), b('x', '2026-11-12', 'cancelled'), b('l3', '2026-11-17', 'completed'), b('up1', '2026-11-24'), b('up2', '2026-12-01')];
    const bal = balanceFor('s', bookings, [], [credit({ expiresAt: '2027-05-01' })], NOW);
    expect(bal.credits).toBe(5);
    expect(bal.covered.map((x) => x.id)).toEqual(['l1', 'l2', 'l3']);
    expect(bal.remaining).toBe(2);
    expect(bal.upcoming).toBe(2);
    expect(bal.afterUpcoming).toBe(0);
    expect(isLow(bal)).toBe(true);
    expect(balanceLabel(bal)).toBe('2 of 5 left');
    expect(bal.nextExpiry).toBe('2027-05-01');
    // the old lesson is still unbilled (pay per lesson); the covered ones are not offered for invoicing
    expect(unbilledLessons(bookings, [], 's', NOW, [credit()]).map((x) => x.id)).toEqual(['old']);
  });
  it('goes negative when more lessons were taught than bought, and reports no packages otherwise', () => {
    const bookings = [b('l1', '2026-11-03'), b('l2', '2026-11-05'), b('l3', '2026-11-07')];
    const bal = balanceFor('s', bookings, [], [credit({ lessons: 2 })], NOW);
    expect(bal.remaining).toBe(-1);
    expect(bal.uncovered.map((x) => x.id)).toEqual(['l3']);
    expect(balanceLabel(bal)).toBe('Owes 1 lesson');
    const none = balanceFor('s', bookings, [], [], NOW);
    expect(none.hasPackages).toBe(false);
    expect(balanceLabel(none)).toBe('Pay per lesson');
    expect(isLow(none)).toBe(false);
  });
});

import { roomOnlyLessons } from '../src/lib/platform/packages';
import { bookingDay } from '../src/lib/platform/invoicing';
import type { LessonPlan } from '../src/lib/platform/types';
describe('checking a lesson balance', () => {
  it('says which taught lessons were not counted, and why', () => {
    const bookings = [b('old', '2026-10-20'), b('l1', '2026-11-03'), b('x', '2026-11-12', 'cancelled'), b('inv', '2026-11-14'), b('l2', '2026-11-17', 'completed'), b('up', '2026-11-24')];
    const invoices = [{ id: 'i1', status: 'sent', lines: [{ bookingId: 'inv', description: '', quantity: 1, unitPrice: 30 }] }] as never;
    const bal = balanceFor('s', bookings, invoices, [credit()], NOW);
    expect(bal.covered.map((x) => x.id)).toEqual(['l1', 'l2']);
    expect(bal.notCounted.map((n) => [n.booking.id, n.why])).toEqual([['old', 'before-package'], ['x', 'cancelled'], ['inv', 'billed']]);
    // seven calendar lessons are not the count: only the ones from the purchase date that were taught and not billed
    expect(balanceLabel(bal)).toBe('3 of 5 left');
  });
  it('puts a lesson just after midnight on the right day, in its own time zone', () => {
    // 00:30 in London in summer is 23:30 UTC the day before.
    const late: Booking = { ...b('mid', '2026-07-01'), startsAt: '2026-06-30T23:30:00Z', tz: 'Europe/London' };
    expect(bookingDay(late)).toBe('2026-07-01');
    const bal = balanceFor('s', [late], [], [credit({ purchasedAt: '2026-07-01' })], Date.UTC(2026, 7, 1));
    expect(bal.covered.map((x) => x.id)).toEqual(['mid']);
    expect(unbilledLessons([late], [], 's', Date.UTC(2026, 7, 1), [credit({ purchasedAt: '2026-07-01' })])).toEqual([]);
  });
  it('finds lessons taught in the lesson room with nothing in the calendar that day', () => {
    const plan = (id: string, startedAt: string | undefined, studentId = 's'): LessonPlan => ({ id, teacherId: 't', studentId, title: `Plan ${id}`, blocks: [], live: { on: false, current: null, ...(startedAt ? { startedAt } : {}) }, createdAt: '', updatedAt: '' });
    const lessons = [plan('booked', '2026-11-03T10:05:00Z'), plan('room', '2026-11-05T17:00:00Z'), plan('room2', '2026-11-05T18:00:00Z'), plan('never', undefined), plan('before', '2026-10-25T10:00:00Z'), plan('other', '2026-11-06T10:00:00Z', 'someone'), plan('future', '2026-12-01T10:00:00Z')];
    const found = roomOnlyLessons('s', lessons, [b('l1', '2026-11-03')], [credit()], NOW);
    expect(found.map((r) => [r.plan.id, r.day])).toEqual([['room', '2026-11-05']]);
    expect(roomOnlyLessons('s', lessons, [], [], NOW)).toEqual([]);
  });
});
