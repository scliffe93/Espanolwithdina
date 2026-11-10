import type { Booking, Credit, Invoice, InvoiceLine, TeacherConfig } from './types';

// ───────────────────────────────────────────────────────────────
// Invoicing arithmetic and helpers, shared by the teacher's screens,
// the student's view and the PDF. Money is kept in whole units of the
// invoice currency with two decimals; totals are rounded once at the end.
// ───────────────────────────────────────────────────────────────

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(l: InvoiceLine): number {
  return round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0));
}
export function subtotal(lines: InvoiceLine[]): number {
  return round2(lines.reduce((a, l) => a + lineTotal(l), 0));
}
export function total(lines: InvoiceLine[], discount = 0): number {
  return round2(Math.max(0, subtotal(lines) - (Number(discount) || 0)));
}

export function money(n: number, currency = 'GBP', locale = 'en-GB'): string {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n); } catch { return `${currency} ${n.toFixed(2)}`; }
}

/** "LWD-2026-0007": prefix, year of issue, running number. */
export function invoiceNumber(cfg: TeacherConfig, issuedAt: string): string {
  return `${cfg.invoicePrefix || 'INV'}-${issuedAt.slice(0, 4)}-${String(cfg.nextNumber || 1).padStart(4, '0')}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days overdue (positive) for an unpaid, non-void invoice; 0 otherwise. */
export function daysOverdue(inv: Invoice, now = Date.now()): number {
  if (inv.status === 'paid' || inv.status === 'void') return 0;
  const due = new Date(inv.dueAt + 'T23:59:59').getTime();
  return now > due ? Math.floor((now - due) / 86_400_000) + 1 : 0;
}

export type InvoiceBucket = 'draft' | 'outstanding' | 'overdue' | 'paid' | 'void';
export function bucket(inv: Invoice, now = Date.now()): InvoiceBucket {
  if (inv.status === 'void') return 'void';
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'draft') return 'draft';
  return daysOverdue(inv, now) > 0 ? 'overdue' : 'outstanding';
}

/** A billable line for a lesson: duration-based from the hourly rate. */
export function lineForBooking(b: Booking, cfg: TeacherConfig, studentZone?: string): InvoiceLine {
  const when = new Date(b.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: studentZone });
  const price = round2((cfg.hourlyRate * b.durationMin) / 60);
  return { description: `Spanish lesson · ${when} · ${b.durationMin} min · ${b.topic}`, qty: 1, unitPrice: price, bookingId: b.id };
}

/** Lessons that have happened, are not on any non-void invoice, and are not covered by a package credit. */
export function unbilledLessons(bookings: Booking[], invoices: Invoice[], studentId: string, now = Date.now(), credits: Credit[] = []): Booking[] {
  const billed = new Set(invoices.filter((i) => i.status !== 'void').flatMap((i) => i.lines.map((l) => l.bookingId).filter(Boolean)));
  const taught = bookings
    .filter((b) => b.studentId === studentId && b.status !== 'cancelled' && new Date(b.startsAt).getTime() <= now && !billed.has(b.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const packages = credits.filter((c) => c.studentId === studentId).sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  if (!packages.length) return taught;
  const total = packages.reduce((a, c) => a + c.lessons, 0);
  const first = packages[0].purchasedAt;
  const covered = new Set(taught.filter((b) => b.startsAt.slice(0, 10) >= first).slice(0, total).map((b) => b.id));
  return taught.filter((b) => !covered.has(b.id));
}

export interface InvoiceSummary { outstanding: number; overdue: number; paidThisMonth: number; invoicedThisMonth: number; count: { draft: number; outstanding: number; overdue: number; paid: number } }

export function summarise(invoices: Invoice[], now = Date.now()): InvoiceSummary {
  const month = new Date(now).toISOString().slice(0, 7);
  const s: InvoiceSummary = { outstanding: 0, overdue: 0, paidThisMonth: 0, invoicedThisMonth: 0, count: { draft: 0, outstanding: 0, overdue: 0, paid: 0 } };
  for (const inv of invoices) {
    const b = bucket(inv, now);
    if (b === 'void') continue;
    if (b === 'draft') s.count.draft++;
    if (b === 'outstanding') { s.outstanding = round2(s.outstanding + inv.total); s.count.outstanding++; }
    if (b === 'overdue') { s.outstanding = round2(s.outstanding + inv.total); s.overdue = round2(s.overdue + inv.total); s.count.overdue++; }
    if (b === 'paid') { s.count.paid++; if ((inv.paidAt ?? '').startsWith(month)) s.paidThisMonth = round2(s.paidThisMonth + inv.total); }
    if (inv.status !== 'draft' && inv.issuedAt.startsWith(month)) s.invoicedThisMonth = round2(s.invoicedThisMonth + inv.total);
  }
  return s;
}

/** Plain-text version for an email body. */
export function invoiceText(inv: Invoice, cfg: TeacherConfig, studentName: string): string {
  const lines = [
    `Invoice ${inv.number} from ${cfg.businessName}`,
    `To: ${studentName}`,
    `Issued ${inv.issuedAt} · Due ${inv.dueAt}`,
    '',
    ...inv.lines.map((l) => `• ${l.description} — ${l.qty} × ${money(l.unitPrice, inv.currency)} = ${money(lineTotal(l), inv.currency)}`),
  ];
  if (inv.discount) lines.push(`Discount: −${money(inv.discount, inv.currency)}`);
  lines.push(`Total due: ${money(inv.total, inv.currency)}`);
  if (inv.paymentInstructions) lines.push('', 'How to pay:', inv.paymentInstructions);
  if (inv.notes) lines.push('', inv.notes);
  lines.push('', cfg.footer || '');
  return lines.join('\n');
}
