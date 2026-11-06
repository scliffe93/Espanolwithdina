// Time-zone helpers built on Intl (no library). Lessons are stored in UTC and
// shown in the viewer's zone, with the scheduling zone available for display.

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const COMMON_ZONES = [
  'Europe/Madrid', 'Europe/London', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Dublin',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
  'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Sao_Paulo',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'UTC',
];

/** Offset (minutes east of UTC) of `zone` at the instant `utcMs`. */
export function zoneOffsetMinutes(zone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Interprets a local date (YYYY-MM-DD) and time (HH:MM) in `zone` and returns the UTC ISO instant. */
export function zonedToUtcIso(date: string, time: string, zone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle DST edges well enough for scheduling.
  let utc = guess - zoneOffsetMinutes(zone, guess) * 60_000;
  utc = guess - zoneOffsetMinutes(zone, utc) * 60_000;
  return new Date(utc).toISOString();
}

/** Splits a UTC instant into local date/time strings in `zone`. */
export function utcIsoToZoned(iso: string, zone: string): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function fmtDateTime(iso: string, zone = browserZone(), opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleString('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...opts });
}

export function fmtTime(iso: string, zone = browserZone()): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string, zone = browserZone(), opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', ...opts });
}

export function zoneLabel(zone: string): string {
  try {
    const name = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
    return `${zone.replace(/_/g, ' ')}${name ? ` (${name})` : ''}`;
  } catch {
    return zone;
  }
}

/** Human "in 2 days", "tomorrow", "in 3 h", "45 min ago". */
export function relative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  const f = (n: number, u: string) => `${past ? '' : 'in '}${n} ${u}${n === 1 ? '' : 's'}${past ? ' ago' : ''}`;
  if (abs < 60_000) return past ? 'just now' : 'now';
  if (abs < 3_600_000) return f(Math.round(abs / 60_000), 'min');
  if (abs < 86_400_000) return f(Math.round(abs / 3_600_000), 'hour');
  const days = Math.round(abs / 86_400_000);
  if (days === 1) return past ? 'yesterday' : 'tomorrow';
  return f(days, 'day');
}

export function addMinutes(iso: string, min: number): string {
  return new Date(new Date(iso).getTime() + min * 60_000).toISOString();
}

export function overlaps(aStart: string, aMin: number, bStart: string, bMin: number): boolean {
  const a0 = new Date(aStart).getTime(), a1 = a0 + aMin * 60_000;
  const b0 = new Date(bStart).getTime(), b1 = b0 + bMin * 60_000;
  return a0 < b1 && b0 < a1;
}
