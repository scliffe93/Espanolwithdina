import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { CONTENT_BLOCKS, STARTER_BLOCKS, nextBlock, type BlockKind, type ContentBlock } from '../../data/blocks';
import { VOCAB_BY_ID } from '../../data/vocab';
import { VERB_BY_INF } from '../../data/verbs';
import { CEFR_LEVELS } from '../../types';
import type { StudentSettings } from '../../lib/platform/types';

/**
 * Gradual release for one student: the teacher switches it on, then releases blocks of verbs and
 * words one step at a time. Lives inside the level-access card and saves through it.
 */
export function ReleaseBlocks({ name, settings, busy, onSave }: { name: string; settings: StudentSettings | null; busy: boolean; onSave: (patch: { stepped: boolean; unlocked: string[]; verbs?: string[] }, message: string) => void }) {
  const stepped = !!settings?.stepped;
  const unlocked = settings?.unlocked ?? [];
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  // Verbs are released one by one: the teacher sees the next block, ticks the ones she wants, and releases only those.
  const single = settings?.verbs ?? [];
  const [choosing, setChoosing] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const outOf = (b: ContentBlock) => (unlocked.includes(b.id) ? b.items.length : b.items.filter((v) => single.includes(v)).length);
  const startChoosing = (b: ContentBlock) => { setChoosing(b.id); setTicked([]); setOpen(false); };
  const releaseTicked = (b: ContentBlock) => {
    const now = [...new Set([...single, ...ticked])];
    const whole = b.items.every((v) => now.includes(v));
    // A block with every verb released is recorded as the block, and its verbs leave the one-by-one list.
    onSave({ stepped: true, unlocked: whole ? [...unlocked, b.id] : unlocked, verbs: whole ? now.filter((v) => !b.items.includes(v)) : now }, `${ticked.length} verb${ticked.length === 1 ? '' : 's'} released to ${name}: ${ticked.join(', ')}.`);
    setChoosing(null); setTicked([]);
  };
  const count = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind && unlocked.includes(b.id)).length;
  const total = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind).length;
  const items = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind && unlocked.includes(b.id)).reduce((n, b) => n + b.items.length, 0) + (kind === 'verbs' ? (settings?.verbs ?? []).length : 0);

  const turnOn = () => onSave({ stepped: true, unlocked: unlocked.length ? unlocked : STARTER_BLOCKS, verbs: single }, `${name} now gets verbs and words in blocks. The first blocks are released.`);
  const turnOff = () => onSave({ stepped: false, unlocked, verbs: single }, `${name} can open everything within their level again.`);
  const toggle = (b: ContentBlock) => {
    const on = unlocked.includes(b.id);
    onSave({ stepped: true, unlocked: on ? unlocked.filter((x) => x !== b.id) : [...unlocked, b.id], verbs: b.kind === 'verbs' ? single.filter((v) => !b.items.includes(v)) : single }, on ? `${b.title} is locked again for ${name}.` : `${b.title} released to ${name}.`);
  };
  const releaseNext = (kind: BlockKind) => { const b = nextBlock(unlocked, kind); if (b) toggle(b); };
  const label = (b: ContentBlock) => (b.kind === 'verbs' ? b.items.join(', ') : b.items.map((id) => VOCAB_BY_ID[id]?.es ?? id).join(', '));
  const nextVerbs = nextBlock(unlocked, 'verbs');
  const nextWords = nextBlock(unlocked, 'words');

  return (
    <div className="mt-3 border-t border-ink/10 pt-3" data-testid="release">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="eyebrow mr-2 !text-[10px]">Gradual release</span>
          {stepped
            ? <span data-testid="release-summary"><b>{items('verbs')}</b> verbs in {count('verbs')} of {total('verbs')} blocks · <b>{items('words')}</b> words in {count('words')} of {total('words')} packs</span>
            : <span data-testid="release-summary">Off: all verbs and words within the level are open at once</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {stepped && nextVerbs && <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={() => startChoosing(nextVerbs)} data-testid="release-next-verbs">+ Next verbs: choose ({nextVerbs.title})</button>}
          {stepped && nextWords && <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={() => releaseNext('words')} data-testid="release-next-words">+ Next words ({nextWords.level} · {nextWords.title})</button>}
          {stepped && <button type="button" className="ctrl !py-1.5" onClick={() => setOpen(!open)} data-testid="release-choose">{open ? 'Hide blocks' : 'Choose blocks'}</button>}
          {stepped
            ? <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={turnOff} data-testid="release-off">Turn off</button>
            : <button type="button" className="btn-dark !py-1.5 !text-sm" disabled={busy} onClick={turnOn} data-testid="release-on">Release in blocks</button>}
        </div>
      </div>
      {stepped && choosing && (() => {
        const b = CONTENT_BLOCKS.find((x) => x.id === choosing); if (!b) return null;
        const left = b.items.filter((v) => !single.includes(v));
        return (
          <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid="release-choose-verbs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p><b>{b.title}</b> <span className="text-ink-mute">· tick the verbs to release to {name}. Nothing is released until you press the button.</span></p>
              <span className="flex gap-1.5">
                <button type="button" className="ctrl !py-1" onClick={() => setTicked(left)} data-testid="release-tick-all">Tick all</button>
                <button type="button" className="ctrl !py-1" onClick={() => setTicked([])}>Untick all</button>
              </span>
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {b.items.map((v) => { const done = single.includes(v); const on = done || ticked.includes(v); return (
                <li key={v}><label className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ring-1 ${done ? 'bg-olive-50 ring-olive/30' : on ? 'bg-ink text-cream ring-ink' : 'bg-cream-100 ring-transparent'}`}>
                  <input type="checkbox" checked={on} disabled={done || busy} onChange={() => setTicked((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]))} data-testid={`release-verb-${v}`} />
                  <span className="min-w-0"><b lang="es">{v}</b> <span className={on && !done ? 'text-cream/70' : 'text-ink-mute'}>{VERB_BY_INF[v]?.en.split(' (')[0] ?? ''}{done ? ' · released' : ''}</span></span>
                </label></li>
              ); })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-dark !py-1.5 !text-sm" disabled={busy || ticked.length === 0} onClick={() => releaseTicked(b)} data-testid="release-ticked">Release the {ticked.length} I ticked</button>
              <button type="button" className="ctrl !py-1.5" onClick={() => { setChoosing(null); setTicked([]); }}>Cancel</button>
            </div>
          </div>
        );
      })()}
      {!stepped && <p className="mt-2 text-xs text-ink-mute">Turn this on to add verbs and words a block at a time, so {name} is not faced with everything on day one. Homework you assign always opens.</p>}
      {stepped && open && (
        <div className="mt-3 grid gap-3" data-testid="release-blocks">
          {CEFR_LEVELS.map((l) => {
            const blocks = CONTENT_BLOCKS.filter((b) => b.level === l);
            if (!blocks.length) return null;
            return (
              <div key={l}>
                <p className="mb-1.5 text-xs font-bold text-ink-mute">{l}</p>
                <div className="flex flex-wrap gap-1.5">
                  {blocks.map((b) => {
                    const on = unlocked.includes(b.id);
                    return (
                      <span key={b.id} className={`inline-flex items-center overflow-hidden rounded-full text-xs font-medium ${on ? 'bg-ink text-cream' : 'bg-white text-ink-soft ring-1 ring-ink/15'}`}>
                        <button type="button" className="py-1.5 pl-3 pr-1.5" aria-pressed={on} disabled={busy} onClick={() => toggle(b)} data-testid={`block-${b.id}`}>
                          {on ? '✓ ' : ''}{b.kind === 'verbs' ? b.title.replace(`${l} `, '') : `Words: ${b.title}`} <span className="opacity-60">({b.kind === 'verbs' && !on && outOf(b) ? `${outOf(b)}/${b.items.length}` : b.items.length})</span>
                        </button>
                        {b.kind === 'verbs' && !on && <button type="button" className="py-1.5 pl-1 pr-1 text-[11px] font-bold opacity-80 hover:opacity-100" onClick={() => startChoosing(b)} data-testid={`pick-${b.id}`}>pick</button>}
                        <button type="button" className="py-1.5 pl-1 pr-2.5 opacity-70 hover:opacity-100" aria-label={`Show what is in ${b.title}`} aria-expanded={peek === b.id} onClick={() => setPeek(peek === b.id ? null : b.id)}><Icon name="eye" size={13} /></button>
                      </span>
                    );
                  })}
                </div>
                {blocks.filter((b) => b.id === peek).map((b) => <p key={b.id} className="mt-2 rounded-xl bg-white p-2.5 text-xs text-ink-soft" lang="es" data-testid="block-peek"><b>{b.title}:</b> {label(b)}</p>)}
              </div>
            );
          })}
          <p className="text-xs text-ink-mute">Tap a block to release all of it or lock it again, or “pick” to choose its verbs one by one. Words already in {name}’s deck stay there if you lock a pack; locking only stops new ones being added.</p>
        </div>
      )}
    </div>
  );
}
