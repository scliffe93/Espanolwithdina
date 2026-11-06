import { utcIsoToZoned, zonedToUtcIso } from '../../lib/platform/time';

// ───────────────────────────────────────────────────────────────
// Calendar arithmetic on plain "YYYY-MM-DD" strings in the viewer's zone.
// Only the conversions to/from instants go through the platform time helpers,
// so DST and zone differences never leak into the grid maths.
// ───────────────────────────────────────────────────────────────

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function splitDate(d: string): [number, number, number] {
  const [y, m, dd] = d.split('-').map(Number);
  return [y, m, dd];
}

export function joinDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = splitDate(date);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return joinDate(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = splitDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string): string {
  return shiftDate(date, -weekdayOf(date));
}

export function firstOfMonth(date: string): string {
  const [y, m] = splitDate(date);
  return joinDate(y, m, 1);
}

export function shiftMonth(date: string, n: number): string {
  const [y, m] = splitDate(date);
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  return joinDate(x.getUTCFullYear(), x.getUTCMonth() + 1, 1);
}

/** Six rows of seven days, starting on the Monday on or before the 1st. */
export function monthGrid(date: string): string[] {
  const start = mondayOf(firstOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function monthLabel(date: string): string {
  const [y, m] = splitDate(date);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
}

/** "10 – 16 Nov 2026" (or across months: "27 Oct – 2 Nov 2026"). */
export function weekLabel(monday: string): string {
  const sunday = shiftDate(monday, 6);
  const sameM = sameMonth(monday, sunday);
  return `${dayLabel(monday, sameM ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${dayLabel(sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function todayIn(zone: string, now = Date.now()): string {
  return utcIsoToZoned(new Date(now).toISOString(), zone).date;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC window covering the local days first…last (inclusive) in `zone`. */
export function dayRangeUtc(firstDate: string, lastDate: string, zone: string): { from: string; to: string } {
  return { from: zonedToUtcIso(firstDate, '00:00', zone), to: zonedToUtcIso(shiftDate(lastDate, 1), '00:00', zone) };
}

/** Where an instant lands in the viewer's zone: local date and minutes since midnight. */
export function placeInZone(iso: string, zone: string): { date: string; minutes: number } {
  const z = utcIsoToZoned(iso, zone);
  return { date: z.date, minutes: minutesOf(z.time) };
}
