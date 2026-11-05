import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type { MemoryTechnique } from '../types';
import { useStore } from '../lib/store';
import { applyTechnique } from '../lib/state';
import { Icon } from './Icon';

export interface MemorySource {
  key: string; // SRS card key
  answer: string;
  en: string;
  origin?: string;
  trick?: string;
  visual?: string;
  story?: string;
  pattern?: string;
}

interface Hint {
  technique: MemoryTechnique;
  label: string;
  text: string;
  genuine?: boolean;
}

function firstLetters(answer: string): string {
  return answer
    .split(' ')
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).replace(/[^\s]/g, '·')))
    .join(' ');
}

/**
 * Progressive hints: clue → memory aid(s) → personal association → reveal.
 * Aids are ordered by which techniques have actually produced the best
 * delayed recall for this learner (with the learner's preferences as a tie-break).
 */
export function HelpMeRemember({ source, onReveal, onHintUsed, compact }: { source: MemorySource; onReveal?: () => void; onHintUsed?: () => void; compact?: boolean }) {
  const { state, update } = useStore();
  const [step, setStep] = useState(0);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(state.associations[source.key] ?? '');

  const hints = useMemo<Hint[]>(() => {
    const prefs = state.profile?.activities ?? [];
    const rate = (t: MemoryTechnique) => {
      const s = state.techniqueStats[t];
      const base = (s.delayedRecalled + 1) / (s.delayedAttempts + 2);
      const pref = (t === 'visual' && prefs.includes('visual')) || (t === 'story' && prefs.includes('stories')) ? 0.05 : 0;
      return base + pref;
    };
    const aids: Hint[] = [];
    if (source.pattern) aids.push({ technique: 'association', label: 'Pattern', text: source.pattern });
    if (source.origin) aids.push({ technique: 'origin', label: 'Real word origin', text: source.origin, genuine: true });
    if (source.trick) aids.push({ technique: 'mnemonic', label: 'Memory trick (invented)', text: source.trick });
    if (source.visual) aids.push({ technique: 'visual', label: 'Picture this (invented)', text: source.visual });
    if (source.story) aids.push({ technique: 'story', label: 'Mini story (invented)', text: source.story });
    aids.sort((a, b) => rate(b.technique) - rate(a.technique));
    const mine = state.associations[source.key];
    const out: Hint[] = [{ technique: 'first-letters', label: 'Clue', text: `${firstLetters(source.answer)}  —  ${source.answer.replace(/\s/g, '').length} letters` }];
    if (mine) out.push({ technique: 'personal', label: 'Your own association', text: mine });
    return [...out, ...aids];
  }, [source, state.techniqueStats, state.associations, state.profile?.activities]);

  const showHint = () => {
    const h = hints[step];
    if (!h) return;
    update((s) => applyTechnique(s, source.key, h.technique));
    onHintUsed?.();
    setStep((n) => n + 1);
  };

  const saveAssociation = () => {
    const text = draft.trim();
    update((s) => {
      const next = { ...s, associations: { ...s.associations } };
      if (text) next.associations[source.key] = text;
      else delete next.associations[source.key];
      return text ? applyTechnique(next, source.key, 'personal') : next;
    });
    setWriting(false);
  };

  return (
    <div className={compact ? '' : 'rounded-2xl bg-saffron-50 p-3 ring-1 ring-saffron/30'}>
      <AnimatePresence initial={false}>
        {hints.slice(0, step).map((h, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-2 text-sm">
            <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.genuine ? 'bg-olive/15 text-olive' : 'bg-saffron/25 text-[#8a5a12]'}`}>{h.label}</span>
            <span className={h.technique === 'first-letters' ? 'font-mono tracking-wider' : ''}>{h.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {writing ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor={`assoc-${source.key}`}>Your own way to remember “{source.answer}” ({source.en})</label>
          <input id={`assoc-${source.key}`} className="input !py-2 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. a person, place or joke it reminds you of" />
          <div className="flex gap-2">
            <button className="ctrl" onClick={saveAssociation}><Icon name="check" size={16} /> Save</button>
            <button className="ctrl" onClick={() => setWriting(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {step < hints.length ? (
            <button className="ctrl" onClick={showHint}><Icon name="bulb" size={16} /> {step === 0 ? 'Help me remember' : 'Another clue'}</button>
          ) : null}
          <button className="ctrl" onClick={() => setWriting(true)}><Icon name="edit" size={16} /> {state.associations[source.key] ? 'Edit my association' : 'Make my own association'}</button>
          {onReveal && step >= 1 && <button className="ctrl" onClick={onReveal}><Icon name="eye" size={16} /> Show answer</button>}
        </div>
      )}
    </div>
  );
}
