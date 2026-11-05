import { motion } from 'motion/react';
import { useState } from 'react';

/**
 * Single-series bar chart (magnitude → one hue). Rounded data-end, 2px gaps,
 * recessive grid, per-bar hover/focus tooltip, and a visually-hidden table.
 */
export function BarChart({ data, unit, title, highlightLast = false, height = 160 }: {
  data: { label: string; value: number; note?: string }[];
  unit: string;
  title: string;
  highlightLast?: boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 5 ? 5 : max <= 10 ? 10 : max <= 30 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 30) * 30;
  const w = 100 / data.length;
  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative" style={{ height }}>
        {[0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-ink/10" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-white/80 px-1 text-[10px] tabular-nums text-ink-mute">{Math.round(nice * g)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-ink/20" />
        <div className="absolute inset-0 flex items-end" aria-hidden>
          {data.map((d, i) => {
            const h = (d.value / nice) * 100;
            const strong = highlightLast ? i === data.length - 1 : true;
            return (
              <div
                key={i}
                className="relative flex h-full items-end justify-center px-[1px]"
                style={{ width: `${w}%` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <motion.div
                  className={`w-full max-w-[34px] rounded-t-[4px] ${strong ? 'bg-terracotta' : 'bg-terracotta/45'} ${hover === i ? 'brightness-110' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(d.value > 0 ? 2 : 0, h)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-cream shadow-lift">
                    <b>{d.label}</b> · {d.value} {unit}{d.note ? ` · ${d.note}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex" aria-hidden>
        {data.map((d, i) => (
          <span key={i} className={`text-center text-[11px] ${highlightLast && i === data.length - 1 ? 'font-semibold text-ink' : 'text-ink-mute'}`} style={{ width: `${w}%` }}>{d.label}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{d.value} {unit}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
