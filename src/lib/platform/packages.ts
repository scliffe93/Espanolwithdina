import { round2 } from './invoicing';
import type { Booking, Credit, Invoice, LessonPackage } from './types';

// ───────────────────────────────────────────────────────────────
// Lesson packages and balances. A credit record is a package a student
// bought. Lessons that have happened (not cancelled, not billed one by one
// on an invoice) consume credits in date order, starting from the first
// purchase. The balance can go negative: the student owes lessons.
// ───────────────────────────────────────────────────────────────

export interface Balance {
  /** Lessons bought in total. */
  credits: number;
  /** Taught lessons that used a credit, oldest first. */
  covered: Booking[];
  /** Taught lessons with no credit left (pay per lesson). */
  uncovered: Booking[];
  /** credits − covered − (uncovered after the first purchase); negative = owes lessons. */
  remaining: number;
  /** Upcoming scheduled lessons that will use credits. */
  upcoming: number;
  /** Remaining minus upcoming: what is left once booked lessons happen. */
  afterUpcoming: number;
  packages: Credit[];
  /** The soonest expiry date among packages still holding credits, if any. */
  nextExpiry: string | null;
  hasPackages: boolean;
}

const dayOf = (iso: string) => iso.slice(0, 10);

/** Lessons billed one by one on a non-void invoice are never package lessons. */
function billedIds(invoices: Invoice[]): Set<string> {
  return new Set(invoices.filter((i) => i.status !== 'void').flatMap((i) => i.lines.map((l) => l.bookingId).filter((x): x is string => !!x)));
}

export function balanceFor(studentId: string, bookings: Booking[], invoices: Invoice[], credits: Credit[], now = Date.now()): Balance {
  const packages = credits.filter((c) => c.studentId === studentId).sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  const total = packages.reduce((a, c) => a + c.lessons, 0);
  const billed = billedIds(invoices);
  const nowIso = new Date(now).toISOString();
  const mine = bookings.filter((b) => b.studentId === studentId && b.status !== 'cancelled' && !billed.has(b.id));
  const firstPurchase = packages[0]?.purchasedAt ?? null;
  const taught = mine.filter((b) => b.startsAt <= nowIso && (!firstPurchase || dayOf(b.startsAt) >= firstPurchase)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const covered = taught.slice(0, total);
  const uncovered = taught.slice(total);
  const remaining = total - taught.length;
  const upcoming = mine.filter((b) => b.startsAt > nowIso && b.status === 'scheduled').length;
  const expiries = packages.filter((c) => c.expiresAt).map((c) => c.expiresAt!).sort();
  return { credits: total, covered, uncovered, remaining, upcoming, afterUpcoming: remaining - upcoming, packages, nextExpiry: remaining > 0 && expiries.length ? expiries[expiries.length - 1] : null, hasPackages: packages.length > 0 };
}

/** Low means one lesson or none left once the booked lessons happen. */
export function isLow(b: Balance): boolean {
  return b.hasPackages && b.afterUpcoming <= 1;
}

export function balanceLabel(b: Balance): string {
  if (!b.hasPackages) return 'Pay per lesson';
  if (b.remaining < 0) return `Owes ${-b.remaining} lesson${b.remaining === -1 ? '' : 's'}`;
  return `${b.remaining} of ${b.credits} left`;
}

export function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** The credit record for a purchase, plus the invoice line that bills it. */
export function creditFromPackage(pkg: LessonPackage, studentId: string, teacherId: string, currency: string, purchasedAt: string, id: string): Credit {
  return { id, teacherId, studentId, packageId: pkg.id, name: pkg.name, lessons: pkg.lessons, minutesPerLesson: pkg.minutesPerLesson, price: round2(pkg.price), currency, purchasedAt, expiresAt: pkg.validMonths > 0 ? addMonths(purchasedAt, pkg.validMonths) : undefined, createdAt: new Date().toISOString() };
}

export function pricePerLesson(pkg: LessonPackage): number {
  return pkg.lessons ? round2(pkg.price / pkg.lessons) : 0;
}
