import { describe, expect, it } from 'vitest';
import { bucket, daysOverdue, invoiceNumber, lineForBooking, money, subtotal, summarise, total, unbilledLessons } from '../src/lib/platform/invoicing';
import { DEFAULT_TEACHER_CONFIG, type Booking, type Invoice } from '../src/lib/platform/types';

const cfg = { ...DEFAULT_TEACHER_CONFIG, hourlyRate: 40, invoicePrefix: 'LWD', nextNumber: 7 };
const booking = (id: string, startsAt: string, durationMin = 60, status: Booking['status'] = 'scheduled'): Booking => ({ id, teacherId: 't', studentId: 's', startsAt, durationMin, tz: 'Europe/London', format: 'online', location: '', topic: 'Ser y estar', prepNotes: '', status, createdAt: startsAt, updatedAt: startsAt });
const inv = (over: Partial<Invoice>): Invoice => ({ id: 'i', teacherId: 't', studentId: 's', number: 'LWD-2026-0001', issuedAt: '2026-11-01', dueAt: '2026-11-15', currency: 'GBP', lines: [{ description: 'Lesson', qty: 1, unitPrice: 40 }], discount: 0, total: 40, status: 'sent', createdAt: '', updatedAt: '', ...over });
const NOW = Date.UTC(2026, 10, 20, 12);

describe('invoicing', () => {
  it('prices lessons from the hourly rate by duration and rounds money', () => {
    expect(lineForBooking(booking('b1', '2026-11-03T10:00:00Z', 45), cfg).unitPrice).toBe(30);
    expect(lineForBooking(booking('b1', '2026-11-03T10:00:00Z', 90), cfg).unitPrice).toBe(60);
    expect(subtotal([{ description: '', qty: 3, unitPrice: 19.99 }])).toBe(59.97);
    expect(total([{ description: '', qty: 2, unitPrice: 40 }], 10)).toBe(70);
    expect(total([{ description: '', qty: 1, unitPrice: 5 }], 10)).toBe(0);
    expect(money(1234.5, 'GBP')).toBe('£1,234.50');
    expect(money(20, 'EUR')).toBe('€20.00');
  });
  it('numbers invoices by prefix, year and running number', () => {
    expect(invoiceNumber(cfg, '2026-11-20')).toBe('LWD-2026-0007');
  });
  it('finds lessons that have happened and are not yet billed', () => {
    const bookings = [booking('past1', '2026-11-10T10:00:00Z'), booking('past2', '2026-11-17T10:00:00Z', 60, 'completed'), booking('future', '2026-11-25T10:00:00Z'), booking('cancelled', '2026-11-12T10:00:00Z', 60, 'cancelled')];
    const billed = inv({ lines: [{ description: 'x', qty: 1, unitPrice: 40, bookingId: 'past1' }] });
    const voided = inv({ id: 'v', status: 'void', lines: [{ description: 'x', qty: 1, unitPrice: 40, bookingId: 'past2' }] });
    expect(unbilledLessons(bookings, [billed, voided], 's', NOW).map((b) => b.id)).toEqual(['past2']);
  });
  it('buckets and summarises: outstanding, overdue, paid this month', () => {
    const a = inv({ id: 'a', dueAt: '2026-11-25' });
    const b = inv({ id: 'b', dueAt: '2026-11-15', total: 80 });
    const c = inv({ id: 'c', status: 'paid', paidAt: '2026-11-18', total: 40 });
    const d = inv({ id: 'd', status: 'draft' });
    const v = inv({ id: 'v', status: 'void', total: 999 });
    expect(bucket(a, NOW)).toBe('outstanding');
    expect(bucket(b, NOW)).toBe('overdue');
    expect(daysOverdue(b, NOW)).toBe(5);
    expect(daysOverdue(c, NOW)).toBe(0);
    const s = summarise([a, b, c, d, v], NOW);
    expect(s).toMatchObject({ outstanding: 120, overdue: 80, paidThisMonth: 40, invoicedThisMonth: 160, count: { draft: 1, outstanding: 1, overdue: 1, paid: 1 } });
  });
});
