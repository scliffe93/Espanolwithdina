import { Icon } from '../../components/Icon';
import { CATEGORY_LABEL } from '../../lib/answer';
import { markLabel, segmentsWithCorrections, verdictFor } from '../../lib/platform/marking';
import { FOCUS_TAG_LABEL, type Homework } from '../../lib/platform/types';
import type { ErrorCategory } from '../../types';

const categoryLabel = (c?: string) => (c && c in CATEGORY_LABEL ? CATEGORY_LABEL[c as ErrorCategory] : c ?? '');

/** The teacher's marking as the student sees it: the mark, corrections laid over their own words, and notes on single answers. */
export function Marked({ h, teacher = 'Dina' }: { h: Homework; teacher?: string }) {
  const m = h.marking;
  const r = h.result;
  if (!m || !r) return null;
  const label = markLabel(m);
  const corrections = m.corrections ?? [];
  const notes = (m.items ?? []).filter((x) => x.comment || x.ok !== undefined);
  return (
    <section className="mt-3 grid gap-3" aria-label={`${teacher}’s marking`} data-testid="hw-marked">
      {label && <p className="inline-flex items-center gap-2 text-sm"><span className="rounded-full bg-olive px-3 py-1 font-semibold text-white" data-testid="hw-mark">{label}</span><span className="text-ink-mute">{teacher}’s mark</span></p>}
      {r.text && corrections.length > 0 && (
        <div>
          <p className="eyebrow mb-1">Your words, with {teacher}’s corrections</p>
          <blockquote lang="es" className="whitespace-pre-wrap rounded-2xl bg-cream-100 p-3 text-sm leading-relaxed" data-testid="hw-corrected-text">
            {segmentsWithCorrections(r.text, corrections).map((s, i) => s.correction ? <mark key={i} className="rounded bg-terracotta-50 px-0.5 text-terracotta-dark underline decoration-terracotta decoration-wavy">{s.text}</mark> : <span key={i}>{s.text}</span>)}
          </blockquote>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {corrections.map((c, i) => (
              <li key={i} className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-ink/5" data-testid="hw-correction">
                <span lang="es" className="text-terracotta-dark line-through decoration-terracotta/60">{c.quote}</span> <Icon name="arrowRight" size={12} className="inline text-ink-mute" /> <b lang="es" className="text-olive">{c.correction}</b>
                {c.category && <span className="ml-2 text-xs text-ink-mute">{FOCUS_TAG_LABEL[c.category]}</span>}
                {c.note && <p className="mt-0.5 text-xs text-ink-soft">{c.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.items && r.items.length > 0 && (
        <details className="rounded-2xl bg-white/70 p-3 ring-1 ring-ink/5" open={notes.length > 0}>
          <summary className="cursor-pointer text-sm font-semibold">Your answers, one by one <span className="font-normal text-ink-mute">· {r.items.filter((_, i) => verdictFor(h, i)).length} of {r.items.length} right</span></summary>
          <ol className="mt-2 grid gap-1 text-sm">
            {r.items.map((it, i) => {
              const ok = verdictFor(h, i);
              const n = m.items?.find((x) => x.index === i);
              return (
                <li key={i} className={`rounded-lg px-2.5 py-1.5 ${ok ? '' : 'bg-terracotta-50'}`}>
                  <span className="mr-1 text-xs text-ink-mute">{i + 1}.</span><span className="text-ink-soft">{it.prompt}</span>{' '}
                  <span lang="es" className={`font-semibold ${ok ? 'text-olive' : 'text-terracotta-dark'}`}>{it.given || '—'}</span>
                  {!ok && it.expected && <span lang="es" className="text-ink-soft"> → <b className="text-ink">{it.expected}</b></span>}
                  {!ok && it.category && <span className="ml-1 text-xs text-ink-mute">{categoryLabel(it.category)}</span>}
                  {n?.ok !== undefined && <span className="ml-1 text-xs text-azul">{teacher} {n.ok ? 'accepted this' : 'marked this wrong'}</span>}
                  {n?.comment && <p className="mt-0.5 rounded-lg bg-olive-50 px-2 py-1 text-xs">{teacher}: {n.comment}</p>}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}
