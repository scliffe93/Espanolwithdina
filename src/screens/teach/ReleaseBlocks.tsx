import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { CONTENT_BLOCKS, STARTER_BLOCKS, nextBlock, type BlockKind, type ContentBlock } from '../../data/blocks';
import { VOCAB_BY_ID } from '../../data/vocab';
import { CEFR_LEVELS } from '../../types';
import type { StudentSettings } from '../../lib/platform/types';

/**
 * Gradual release for one student: the teacher switches it on, then releases blocks of verbs and
 * words one step at a time. Lives inside the level-access card and saves through it.
 */
export function ReleaseBlocks({ name, settings, busy, onSave }: { name: string; settings: StudentSettings | null; busy: boolean; onSave: (patch: { stepped: boolean; unlocked: string[] }, message: string) => void }) {
  const stepped = !!settings?.stepped;
  const unlocked = settings?.unlocked ?? [];
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const count = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind && unlocked.includes(b.id)).length;
  const total = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind).length;
  const items = (kind: BlockKind) => CONTENT_BLOCKS.filter((b) => b.kind === kind && unlocked.includes(b.id)).reduce((n, b) => n + b.items.length, 0);

  const turnOn = () => onSave({ stepped: true, unlocked: unlocked.length ? unlocked : STARTER_BLOCKS }, `${name} now gets verbs and words in blocks. The first blocks are released.`);
  const turnOff = () => onSave({ stepped: false, unlocked }, `${name} can open everything within their level again.`);
  const toggle = (b: ContentBlock) => {
    const on = unlocked.includes(b.id);
    onSave({ stepped: true, unlocked: on ? unlocked.filter((x) => x !== b.id) : [...unlocked, b.id] }, on ? `${b.title} is locked again for ${name}.` : `${b.title} released to ${name}.`);
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
          {stepped && nextVerbs && <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={() => releaseNext('verbs')} data-testid="release-next-verbs">+ Next verbs ({nextVerbs.title})</button>}
          {stepped && nextWords && <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={() => releaseNext('words')} data-testid="release-next-words">+ Next words ({nextWords.level} · {nextWords.title})</button>}
          {stepped && <button type="button" className="ctrl !py-1.5" onClick={() => setOpen(!open)} data-testid="release-choose">{open ? 'Hide blocks' : 'Choose blocks'}</button>}
          {stepped
            ? <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={turnOff} data-testid="release-off">Turn off</button>
            : <button type="button" className="btn-dark !py-1.5 !text-sm" disabled={busy} onClick={turnOn} data-testid="release-on">Release in blocks</button>}
        </div>
      </div>
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
                          {on ? '✓ ' : ''}{b.kind === 'verbs' ? b.title.replace(`${l} `, '') : `Words: ${b.title}`} <span className="opacity-60">({b.items.length})</span>
                        </button>
                        <button type="button" className="py-1.5 pl-1 pr-2.5 opacity-70 hover:opacity-100" aria-label={`Show what is in ${b.title}`} aria-expanded={peek === b.id} onClick={() => setPeek(peek === b.id ? null : b.id)}><Icon name="eye" size={13} /></button>
                      </span>
                    );
                  })}
                </div>
                {blocks.filter((b) => b.id === peek).map((b) => <p key={b.id} className="mt-2 rounded-xl bg-white p-2.5 text-xs text-ink-soft" lang="es" data-testid="block-peek"><b>{b.title}:</b> {label(b)}</p>)}
              </div>
            );
          })}
          <p className="text-xs text-ink-mute">Tap a block to release it or lock it again. Words already in {name}’s deck stay there if you lock a pack; locking only stops new ones being added.</p>
        </div>
      )}
    </div>
  );
}
