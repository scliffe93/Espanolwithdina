import type { Person } from '../../lib/platform/types';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader, Segmented } from '../../components/ui';
import { usePlatformQuery } from '../../lib/platform/context';
import { addMinutes, fmtTime, zoneLabel } from '../../lib/platform/time';
import type { Booking } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { BookingForm, type BookingPrefill } from './BookingForm';
import { WEEKDAYS, dayLabel, dayRangeUtc, firstOfMonth, mondayOf, monthGrid, monthLabel, pad2, placeInZone, sameMonth, shiftDate, shiftMonth, todayIn, weekLabel } from './calendarMath';
import { DemoChip, FORMAT_LABEL, Loading, ZoneSelect, formatIcon, nameOf, toneFor, useStudents, useViewZone } from './shared';

type View = 'week' | 'month';
const HOUR_PX = 56;

interface Placed {
  b: Booking;
  date: string;
  minutes: number;
}

/** Dina's teaching calendar: week time-grid or month overview, in her chosen zone. */
export function Calendar({ params }: { params: URLSearchParams }) {
  const [zone, setZone] = useViewZone();
  const today = todayIn(zone);
  const [view, setView] = useState<View>(params.get('view') === 'month' ? 'month' : 'week');
  const [anchor, setAnchor] = useState(() => params.get('date') ?? today);
  const [showCancelled, setShowCancelled] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; edit?: Booking; prefill?: BookingPrefill }>({ open: false });
  const students = useStudents();
  const people = students.data?.people ?? [];

  const monday = mondayOf(anchor);
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const first = view === 'week' ? monday : grid[0];
  const last = view === 'week' ? shiftDate(monday, 6) : grid[41];
  const range = useMemo(() => dayRangeUtc(first, last, zone), [first, last, zone]);
  const bookings = usePlatformQuery((b) => b.bookings({ from: range.from, to: range.to, includeCancelled: true }), [range.from, range.to]);

  const placed = useMemo<Placed[]>(() => (bookings.data ?? []).filter((b) => showCancelled || b.status !== 'cancelled').map((b) => ({ b, ...placeInZone(b.startsAt, zone) })), [bookings.data, showCancelled, zone]);

  const go = (dir: -1 | 0 | 1) => {
    if (dir === 0) return setAnchor(today);
    setAnchor(view === 'week' ? shiftDate(monday, dir * 7) : shiftMonth(firstOfMonth(anchor), dir));
  };
  const create = (date: string, time: string) => setEditor({ open: true, prefill: { date, time, zone } });
  const openLesson = (b: Booking) => setEditor({ open: true, edit: b });

  return (
    <div>
      <PageHeader
        eyebrow="Agenda"
        title={view === 'week' ? weekLabel(monday) : monthLabel(anchor)}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Times shown in {zoneLabel(zone)}. <DemoChip /></span>}
        right={<button type="button" className="btn-primary hidden sm:inline-flex" onClick={() => create(today, '18:00')}><Icon name="calendar" size={18} /> Book a lesson</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label="Calendar view" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        <div className="inline-flex items-center gap-1" role="group" aria-label="Move through the calendar">
          <button type="button" className="ctrl !px-2.5" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => go(-1)}><Icon name="arrowLeft" size={16} /></button>
          <button type="button" className="ctrl" onClick={() => go(0)}>Today</button>
          <button type="button" className="ctrl !px-2.5" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => go(1)}><Icon name="arrowRight" size={16} /></button>
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-terracotta" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled</label>
        <details className="relative">
          <summary className="ctrl cursor-pointer list-none"><Icon name="globe" size={14} /> Zone</summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl bg-cream p-3 shadow-lift ring-1 ring-ink/10"><ZoneSelect id="cal-zone" value={zone} onChange={setZone} label="View the calendar in" /></div>
        </details>
      </div>

      {people.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3 text-xs text-ink-mute" aria-label="Legend">
          {people.map((p) => <li key={p.id} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${toneFor(people, p.id).bg}`} aria-hidden /> {p.firstName}</li>)}
          <li className="inline-flex items-center gap-1.5"><Icon name="check" size={12} /> completed</li>
          {showCancelled && <li className="inline-flex items-center gap-1.5"><span className="line-through">struck</span> cancelled</li>}
        </ul>
      )}

      {!bookings.data ? <Loading label="Loading lessons…" /> : view === 'week' ? (
        <WeekGrid monday={monday} today={today} zone={zone} placed={placed} people={people} onCreate={create} onOpen={openLesson} />
      ) : (
        <MonthGrid grid={grid} anchor={anchor} today={today} placed={placed} people={people} onCreate={create} onOpen={openLesson} onShowWeek={(d) => { setAnchor(d); setView('week'); }} />
      )}

      <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
        <button type="button" className="btn-primary" onClick={() => create(today, '18:00')}><Icon name="calendar" size={18} /> Book a lesson</button>
        <button type="button" className="btn-ghost" onClick={() => navigate('teach')}>Back to today</button>
      </div>

      <BookingForm open={editor.open} onClose={() => setEditor({ open: false })} people={people} booking={editor.edit} prefill={editor.prefill} viewZone={zone} />
    </div>
  );
}

function blockClass(b: Booking, tone: ReturnType<typeof toneFor>): string {
  if (b.status === 'cancelled') return 'bg-ink/10 text-ink-mute line-through ring-1 ring-ink/10';
  if (b.status === 'completed') return `${tone.soft} ${tone.text} ring-1 ${tone.ring}`;
  return `${tone.bg} ${tone.fg} shadow-soft`;
}

function WeekGrid({ monday, today, zone, placed, people, onCreate, onOpen }: {
  monday: string; today: string; zone: string; placed: Placed[]; people: Person[];
  onCreate: (date: string, time: string) => void; onOpen: (b: Booking) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const startHour = Math.min(7, ...placed.map((p) => Math.floor(p.minutes / 60)));
  const endHour = Math.min(24, Math.max(22, ...placed.map((p) => Math.ceil((p.minutes + p.b.durationMin) / 60))));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const nowMin = placeInZone(new Date().toISOString(), zone);
  const toY = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX;

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-ink/5">
          <div />
          {days.map((d, i) => (
            <div key={d} className={`py-2 text-center ${d === today ? 'text-terracotta' : ''}`}>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{WEEKDAYS[i]}</span>
              <span className={`mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full font-display text-lg font-semibold ${d === today ? 'bg-terracotta text-white' : ''}`}>{Number(d.slice(8))}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: hours.length * HOUR_PX }} aria-hidden>
            {hours.map((h) => <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-mute" style={{ top: toY(h * 60) }}>{pad2(h)}:00</span>)}
          </div>
          {days.map((d) => {
            const lessons = placed.filter((p) => p.date === d);
            return (
              <div key={d} className={`relative border-l border-ink/5 ${d === today ? 'bg-terracotta-50/40' : ''}`} style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => (
                  <button key={h} type="button" className="absolute inset-x-0 border-t border-ink/5 transition hover:bg-saffron-50 focus-visible:bg-saffron-50" style={{ top: toY(h * 60), height: HOUR_PX }} aria-label={`Book a lesson on ${dayLabel(d)} at ${pad2(h)}:00`} onClick={() => onCreate(d, `${pad2(h)}:00`)} />
                ))}
                {lessons.map(({ b, minutes }) => {
                  const tone = toneFor(people, b.studentId);
                  const end = addMinutes(b.startsAt, b.durationMin);
                  return (
                    <button
                      key={b.id} type="button" onClick={() => onOpen(b)}
                      className={`absolute z-10 overflow-hidden rounded-xl px-2 py-1 text-left text-xs leading-tight transition hover:brightness-105 ${b.status === 'cancelled' ? 'inset-x-2' : 'inset-x-1'} ${blockClass(b, tone)}`}
                      style={{ top: toY(minutes), height: Math.max(28, (b.durationMin / 60) * HOUR_PX - 2) }}
                      aria-label={`${nameOf(people, b.studentId)}: ${b.topic}, ${fmtTime(b.startsAt, zone)} to ${fmtTime(end, zone)}, ${FORMAT_LABEL[b.format]}, ${b.status}`}
                      title={`${b.topic} · ${fmtTime(b.startsAt, zone)}–${fmtTime(end, zone)}${b.tz !== zone ? ` (scheduled as ${fmtTime(b.startsAt, b.tz)} ${zoneLabel(b.tz)})` : ''}`}
                    >
                      <span className="flex items-center gap-1 font-bold"><Icon name={formatIcon(b.format)} size={11} /> {nameOf(people, b.studentId)}{b.status === 'completed' && <Icon name="check" size={11} />}</span>
                      <span className="block truncate">{b.topic}</span>
                      {b.durationMin >= 45 && <span className="block opacity-80">{fmtTime(b.startsAt, zone)}–{fmtTime(end, zone)}</span>}
                    </button>
                  );
                })}
                {d === today && nowMin.minutes >= startHour * 60 && nowMin.minutes <= endHour * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-terracotta" style={{ top: toY(nowMin.minutes) }} aria-hidden><span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-terracotta" /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ grid, anchor, today, placed, people, onCreate, onOpen, onShowWeek }: {
  grid: string[]; anchor: string; today: string; placed: Placed[]; people: Person[];
  onCreate: (date: string, time: string) => void; onOpen: (b: Booking) => void; onShowWeek: (date: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-ink/5">
        {WEEKDAYS.map((w) => <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const inMonth = sameMonth(d, anchor);
          const lessons = placed.filter((p) => p.date === d).sort((a, b) => a.minutes - b.minutes);
          return (
            <div key={d} className={`min-h-[76px] border-b border-l border-ink/5 p-1 sm:min-h-[96px] ${inMonth ? '' : 'bg-cream-100/60 text-ink-mute'} ${d === today ? 'bg-terracotta-50/50' : ''}`}>
              <div className="flex items-center justify-between">
                <button type="button" className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold transition hover:bg-saffron-50 ${d === today ? 'bg-terracotta text-white' : ''}`} aria-label={`Book a lesson on ${dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}`} onClick={() => onCreate(d, '10:00')}>{Number(d.slice(8))}</button>
                {lessons.length > 2 && <button type="button" className="text-[10px] font-semibold text-ink-mute hover:text-ink" onClick={() => onShowWeek(d)} aria-label={`Show the week of ${dayLabel(d)}`}>+{lessons.length - 2}</button>}
              </div>
              <ul className="mt-1 grid gap-0.5">
                {lessons.slice(0, 2).map(({ b }) => {
                  const tone = toneFor(people, b.studentId);
                  return (
                    <li key={b.id}>
                      <button type="button" onClick={() => onOpen(b)} className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10.5px] font-semibold ${blockClass(b, tone)}`} aria-label={`${nameOf(people, b.studentId)}: ${b.topic} at ${fmtTime(b.startsAt)}, ${b.status}`}>
                        <span className="tabular-nums">{fmtTime(b.startsAt)}</span> <span className="truncate">{nameOf(people, b.studentId)}</span>{b.status === 'completed' && <Icon name="check" size={10} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
