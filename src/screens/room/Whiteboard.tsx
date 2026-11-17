import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { BOARD_H, BOARD_W, type Board, type Stroke } from '../../lib/platform/lessonExtras';

const INKS = ['#2a2420', '#c2563a', '#1f3a5f', '#4f6b3a', '#d99a1c'];
const INK_NAMES = ['Black', 'Red', 'Blue', 'Green', 'Yellow'];
const path = (s: Stroke) => (s.pts.length === 1 ? `M${s.pts[0][0]} ${s.pts[0][1]} l0.1 0` : `M${s.pts.map(([x, y]) => `${x} ${y}`).join(' L')}`);

/**
 * The whiteboard of a lesson: typed text and pen strokes on one surface. The teacher writes and draws on it with a
 * mouse, a finger or a pen; with no `onChange` it is shown as it was left, for the student to look back at.
 */
export function Whiteboard({ board, onChange, full }: { board: Board; onChange?: (b: Board) => void; full?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const [ink, setInk] = useState(0);
  const [thick, setThick] = useState(false);
  const [live, setLive] = useState<Stroke | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const can = !!onChange;
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(BOARD_W, ((e.clientX - r.left) / r.width) * BOARD_W)), Math.max(0, Math.min(BOARD_H, ((e.clientY - r.top) / r.height) * BOARD_H))];
  };
  const down = (e: React.PointerEvent) => { if (!can) return; e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); const s = { c: ink, w: thick ? 8 : 4, pts: [at(e)] }; drawing.current = s; setLive(s); };
  const move = (e: React.PointerEvent) => {
    const s = drawing.current; if (!s) return;
    const p = at(e); const last = s.pts[s.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 5) return; // few enough points to store, close enough to look smooth
    s.pts.push(p); setLive({ ...s, pts: [...s.pts] });
  };
  const up = () => { const s = drawing.current; drawing.current = null; setLive(null); if (s && onChange) onChange({ ...board, strokes: [...board.strokes, s] }); };
  const all = live ? [...board.strokes, live] : board.strokes;
  return (
    <div data-testid="whiteboard">
      {can && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-ink/5" data-testid="board-tools">
          <span className="flex items-center gap-1.5" role="radiogroup" aria-label="Pen colour">
            {INKS.map((c, i) => <button key={c} type="button" role="radio" aria-checked={ink === i} aria-label={INK_NAMES[i]} onClick={() => setInk(i)} className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition ${ink === i ? 'ring-ink' : 'ring-transparent'}`} style={{ background: c }} data-testid={`board-ink-${i}`} />)}
          </span>
          <button type="button" className={`ctrl ${thick ? '!bg-ink !text-cream' : ''}`} aria-pressed={thick} onClick={() => setThick(!thick)}>Thick pen</button>
          <button type="button" className="ctrl" disabled={!board.strokes.length} onClick={() => onChange!({ ...board, strokes: board.strokes.slice(0, -1) })} data-testid="board-undo"><Icon name="refresh" size={14} /> Undo</button>
          <button type="button" className="ctrl hover:!text-terracotta-dark" disabled={!board.strokes.length && !board.text} onClick={() => { if (window.confirm('Wipe the whiteboard?')) onChange!({ ...board, text: '', strokes: [] }); }} data-testid="board-clear"><Icon name="trash" size={14} /> Wipe</button>
          <span className="ml-auto text-xs text-ink-mute">Draw with the mouse, a finger or a pen. Type below to put text on the board.</span>
        </div>
      )}
      <div className={`relative overflow-hidden rounded-3xl bg-white shadow-soft ring-2 ${can ? 'ring-ink/10' : 'ring-ink/5'}`} style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}`, maxHeight: full ? '72vh' : undefined }}>
        <div className="pointer-events-none absolute inset-0 whitespace-pre-wrap p-[4%] font-display font-medium leading-snug text-ink" style={{ fontSize: 'clamp(16px, 2.6vw, 34px)' }} lang="es" data-testid="board-text">{board.text}</div>
        <svg ref={svg} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className={`absolute inset-0 h-full w-full ${can ? 'cursor-crosshair' : ''}`} style={{ touchAction: can ? 'none' : 'auto' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Whiteboard drawing" data-testid="board-surface" data-strokes={board.strokes.length}>
          {all.map((s, i) => <path key={i} d={path(s)} fill="none" stroke={INKS[s.c % INKS.length]} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
        {!can && !board.text && !board.strokes.length && <p className="absolute inset-0 grid place-items-center text-ink-mute">Nothing on the whiteboard.</p>}
      </div>
      {can && <textarea className="input mt-2 min-h-[84px] w-full text-lg" value={board.text} onChange={(e) => onChange!({ ...board, text: e.target.value })} placeholder={'Type here to put text on the board…\nla playa = the beach'} lang="es" spellCheck={false} maxLength={3900} data-testid="board-type" />}
    </div>
  );
}
