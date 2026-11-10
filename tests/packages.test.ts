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
