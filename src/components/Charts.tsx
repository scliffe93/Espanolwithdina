import { Fragment } from 'react';
import type { DayPoint } from '../lib/analytics';

// Small, dependency-free charts for the analytics views. Every chart has a
// text alternative so the numbers are available to screen readers and print.

/** 4 weeks of study, one cell per day; darker = more minutes. */
export function Heatmap({ days, goalMinutes = 10, title }: { days: DayPoint[]; goalMinutes?: number; title: string }) {
  const max = Math.max(goalMinutes, ...days.map((d) => d.minutes));
  const cells = days.map((d) => {
    const t = d.minutes === 0 ? 0 : Math.min(1, 0.25 + (0.75 * d.minutes) / max);
    return { ...d, opacity: t };
  });
  const dow = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const offset = (new Date(days[0].date + 'T12:00:00').getDay() + 6) % 7; // Monday first
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))' }}>
        <span />
        {dow.map((d, i) => <span key={i} className="text-center text-[10px] text-ink-mute">{d}</span>)}
        {Array.from({ length: offset }).map((_, i) => <span key={`pad-${i}`} />)}
        {cells.map((c, i) => {
          const first = (i + offset) % 7 === 0;
          return (
            <Fragment key={c.date}>
              {(first || i === 0) && <span className="text-[10px] text-ink-mute">{new Date(c.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              <span title={`${c.date}: ${c.minutes} min${c.accuracy !== null ? `, ${Math.round(c.accuracy * 100)}% accuracy` : ''}`} className={`aspect-square rounded-md ${c.minutes >= goalMinutes ? 'ring-2 ring-saffron ring-inset' : ''}`} style={{ background: c.minutes ? `rgba(196, 85, 54, ${c.opacity})` : 'rgba(0,0,0,0.05)' }} />
            </Fragment>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-ink-mute">Darker = more minutes · gold ring = daily goal met ({goalMinutes} min)</p>
      <table className="sr-only"><tbody>{days.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.minutes} min</td></tr>)}</tbody></table>
    </figure>
  );
}

/** A line over weeks (minutes, accuracy, vocabulary…). `nulls` are skipped. */
export function Sparkline({ points, unit, title, color = '#C45536', percent = false }: { points: { label: string; value: number | null }[]; unit: string; title: string; color?: string; percent?: boolean }) {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = percent ? 1 : Math.max(1, ...vals);
  const w = 100, h = 36;
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w));
  const path = points.map((p, i) => (p.value === null ? null : `${xs[i].toFixed(1)},${(h - 4 - (p.value / max) * (h - 8)).toFixed(1)}`)).reduce<string[]>((acc, pt) => { if (pt) acc.push(acc.length && acc[acc.length - 1] !== 'M' ? `L${pt}` : `M${pt}`); return acc; }, []).join(' ');
  const last = [...points].reverse().find((p) => p.value !== null);
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex items-end gap-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
          <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => p.value === null ? null : <circle key={i} cx={xs[i]} cy={h - 4 - (p.value / max) * (h - 8)} r="1.6" fill={color} />)}
        </svg>
        <span className="shrink-0 font-display text-2xl font-semibold tabular-nums">{last?.value === null || last?.value === undefined ? '—' : percent ? `${Math.round(last.value * 100)}%` : `${last.value}${unit}`}</span>
      </div>
      <div className="flex justify-between text-[10px] text-ink-mute"><span>{points[0]?.label}</span><span>{points[points.length - 1]?.label}</span></div>
      <table className="sr-only"><tbody>{points.map((p) => <tr key={p.label}><td>{p.label}</td><td>{p.value === null ? '—' : percent ? `${Math.round(p.value * 100)}%` : `${p.value}${unit}`}</td></tr>)}</tbody></table>
    </figure>
  );
}

/** Labelled horizontal bars (accuracy by skill, errors by category…). */
export function Meters({ items, max, format }: { items: { label: string; value: number; note?: string; color?: string }[]; max?: number; format?: (v: number) => string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-2">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm">
          <span className="truncate">{it.label}</span>
          <span className="tabular-nums text-ink-soft">{format ? format(it.value) : it.value}{it.note ? <span className="text-ink-mute"> · {it.note}</span> : null}</span>
          <span className="col-span-2 h-2 overflow-hidden rounded-full bg-ink/5"><span className={`block h-full rounded-full ${it.color ?? 'bg-terracotta'}`} style={{ width: `${Math.min(100, (it.value / top) * 100)}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
