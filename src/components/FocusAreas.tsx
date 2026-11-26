import { useState } from 'react';
import type { FocusArea } from '../lib/focus';
import { navigate } from '../lib/router';
import { Icon } from './Icon';

const TREND: Record<NonNullable<FocusArea['trend']>, { text: string; cls: string }> = {
  better: { text: 'Improving', cls: 'bg-olive-50 text-olive' },
  worse: { text: 'Needs attention', cls: 'bg-terracotta-50 text-terracotta-dark' },
  same: { text: 'Steady', cls: 'bg-cream-100 text-ink-soft' },
};

/** Everything about one area: their own slips, why it happens, how to improve, what to raise in the lesson. */
export function FocusDetail({ area }: { area: FocusArea }) {
  return (
    <div className="grid gap-4 text-[15px] leading-relaxed" data-testid="focus-detail">
      <p className="text-ink-soft">{area.summary}</p>
      {area.examples.length > 0 && (
        <div>
          <p className="font-semibold">From your own answers</p>
          <ul className="mt-1.5 grid gap-1.5">
            {area.examples.map((e, i) => (
              <li key={i} className="rounded-xl bg-white px-3 py-2 ring-1 ring-ink/5">
                You wrote <span className="rounded bg-terracotta-50 px-1 text-terracotta-dark line-through decoration-1">{e.wrong}</span>. It should be <b lang="es">{e.right}</b>{e.note ? <span className="text-ink-mute"> ({e.note})</span> : null}.
              </li>
            ))}
          </ul>
        </div>
      )}
      <div><p className="font-semibold">Why this happens</p><p className="mt-1 text-ink-soft">{area.explain}</p></div>
      <div>
        <p className="font-semibold">How to improve</p>
        <ol className="mt-1.5 grid gap-1.5">
          {area.steps.map((s, i) => <li key={i} className="flex gap-2.5 text-ink-soft"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-terracotta text-[11px] font-bold text-white">{i + 1}</span><span>{s}</span></li>)}
        </ol>
      </div>
      <div className="rounded-2xl bg-saffron-50 p-3.5 ring-1 ring-saffron/40"><p className="font-semibold">Take this to your lesson</p><p className="mt-1 text-ink-soft">{area.ask}</p></div>
      {area.practise && <button type="button" className="btn-primary w-full justify-center sm:w-auto sm:justify-self-start" onClick={() => navigate(area.practise!.href)}><Icon name="play" size={18} filled /> {area.practise.label}</button>}
    </div>
  );
}

/** The areas to concentrate on, each opening to its full explanation. */
export function FocusAreas({ areas, openFirst = false }: { areas: FocusArea[]; openFirst?: boolean }) {
  const [open, setOpen] = useState<string | null>(openFirst ? areas[0]?.id ?? null : null);
  return (
    <ul className="grid gap-2.5" data-testid="focus-areas">
      {areas.map((a, i) => {
        const isOpen = open === a.id;
        return (
          <li key={a.id} className={`rounded-2xl ring-1 transition ${isOpen ? 'bg-cream-100 ring-terracotta/30' : 'bg-cream-100 ring-transparent'}`}>
            <button type="button" className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen} data-testid={`focus-${a.id}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white font-display text-sm font-semibold text-terracotta ring-1 ring-ink/10">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="text-[16px] leading-tight">{a.title}</b>{a.trend && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TREND[a.trend].cls}`}>{TREND[a.trend].text}</span>}</span>
              </span>
              <Icon name={isOpen ? 'x' : 'arrowRight'} size={16} className="shrink-0 text-ink-mute" />
            </button>
            {isOpen && <div className="px-3.5 pb-4 sm:pl-[3.4rem]"><FocusDetail area={a} /></div>}
          </li>
        );
      })}
    </ul>
  );
}
