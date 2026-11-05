export const DAY_MS = 86_400_000;

/** Local calendar date key, YYYY-MM-DD. */
export function dayKey(ts: number | Date = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday 00:00 (local) of the week containing ts. */
export function weekStart(ts: number | Date = Date.now()): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** The seven day keys (Mon→Sun) of the week starting at `start`. */
export function weekDayKeys(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
}

export function weekId(ts: number | Date = Date.now()): string {
  return dayKey(weekStart(ts));
}

export function formatRange(start: Date): string {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

export function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
