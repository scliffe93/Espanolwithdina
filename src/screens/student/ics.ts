import { addMinutes, utcIsoToZoned } from '../../lib/platform/time';
import type { Booking } from '../../lib/platform/types';

// ───────────────────────────────────────────────────────────────
// "Add to calendar": a one-event iCalendar file generated in the browser
// (RFC 5545). Times are written in UTC ("Z"), so every calendar app shows
// the lesson at the right local time wherever the student is.
// ───────────────────────────────────────────────────────────────

/** 2026-11-08T17:00:00.000Z → 20261108T170000Z */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapes text per RFC 5545 §3.3.11. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets (UTF-8), continuation lines start with a space. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const limit = 74;
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = ` ${ch}`;
      bytes = 1 + n;
    } else {
      cur += ch;
      bytes += n;
    }
  }
  out.push(cur);
  return out.join('\r\n');
}

export const isMeetingLink = (s: string) => /^https?:\/\//i.test(s.trim());

export function bookingIcs(b: Booking, now = new Date()): string {
  const link = b.format === 'online' && isMeetingLink(b.location);
  const description = [
    b.prepNotes.trim() && `Prepare: ${b.prepNotes.trim()}`,
    link && `Meeting link: ${b.location.trim()}`,
    `Scheduled in ${b.tz.replace(/_/g, ' ')} · ${b.durationMin} min · ${b.format === 'online' ? 'online' : 'in person'}`,
    'Learning with Dina',
  ].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Learning with Dina//Lessons//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@learningwithdina`,
    `DTSTAMP:${icsStamp(now.toISOString())}`,
    `DTSTART:${icsStamp(b.startsAt)}`,
    `DTEND:${icsStamp(addMinutes(b.startsAt, b.durationMin))}`,
    `SUMMARY:${esc(`Spanish lesson with Dina — ${b.topic}`)}`,
    `DESCRIPTION:${esc(description)}`,
    `STATUS:${b.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (link) {
    lines.push(`URL:${b.location.trim()}`, 'LOCATION:Online');
  } else if (b.location.trim()) {
    lines.push(`LOCATION:${esc(b.location.trim())}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Triggers a download of the lesson as an .ics file. */
export function downloadIcs(b: Booking) {
  const blob = new Blob([bookingIcs(b)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lesson-with-dina-${utcIsoToZoned(b.startsAt, b.tz).date}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
