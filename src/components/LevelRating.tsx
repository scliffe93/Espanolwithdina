import { useState } from 'react';
import { CEFR_LEVELS, SKILLS, type Cefr, type Skill } from '../types';
import { Icon } from './Icon';
import { Sheet } from './ui';

/** A level in a word or two, for the one rating shown in place of six skill boxes. */
export const LEVEL_NAME: Record<Cefr, string> = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper intermediate', C1: 'Advanced', C2: 'Mastery',
};

const SKILL_LABEL: Record<Skill, string> = { vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading', listening: 'Listening', speaking: 'Speaking', verbs: 'Verbs' };

/**
 * One overall level, as a badge. Tapping it opens the detail: each skill's level, where the level comes from and,
 * when the learner may change them, the controls to do so.
 */
export function LevelRating({ level, levels, source, title = 'Your level', tone = 'light', size = 'md', showSkills = true, onSet, maxLevel, footer, testid = 'level-rating' }: {
  level: Cefr;
  levels?: Partial<Record<Skill, Cefr>>;
  /** One line on where the level comes from ("From your placement", "Set by Dina"). */
  source?: string;
  title?: string;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  /** False when the teacher has set the level: then hers is the one shown, alone. */
  showSkills?: boolean;
  /** When given, each skill can be changed in the detail. */
  onSet?: (skill: Skill, level: Cefr) => void;
  /** Levels above this cannot be chosen. */
  maxLevel?: Cefr | null;
  footer?: React.ReactNode;
  testid?: string;
}) {
  const [open, setOpen] = useState(false);
  const dark = tone === 'dark';
  const big = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  const within = (l: Cefr) => !maxLevel || CEFR_LEVELS.indexOf(l) <= CEFR_LEVELS.indexOf(maxLevel);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testid} aria-label={`${title}: ${level}, ${LEVEL_NAME[level]}. Show the detail`}
        className={`group inline-flex items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition ${dark ? 'bg-cream/10 text-cream ring-cream/15 hover:bg-cream/15' : 'bg-white text-ink ring-ink/10 hover:ring-ink/30'}`}>
        <span className={`font-display font-semibold leading-none ${big} ${dark ? 'text-saffron-light' : 'text-terracotta'}`}>{level}</span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">{LEVEL_NAME[level]}</span>
          <span className={`flex items-center gap-1 text-xs ${dark ? 'text-cream/70' : 'text-ink-mute'}`}>{showSkills && levels ? 'See each skill' : 'More about this'} <Icon name="arrowRight" size={11} /></span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div data-testid={`${testid}-detail`}>
          <p className="flex items-baseline gap-3"><span className="font-display text-5xl font-semibold text-terracotta">{level}</span><span className="text-lg font-semibold">{LEVEL_NAME[level]}</span></p>
          {source && <p className="mt-1 text-sm text-ink-mute" data-testid="level-source">{source}</p>}
          {showSkills && levels ? (
            onSet ? (
              <div className="mt-4 grid gap-2" data-testid="skill-levels">
                {SKILLS.map((s) => (
                  <div key={s} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{SKILL_LABEL[s]}</span>
                    <div className="flex gap-1" role="radiogroup" aria-label={`${s} level`}>
                      {CEFR_LEVELS.map((l) => (
                        <button key={l} type="button" role="radio" aria-checked={levels[s] === l} disabled={!within(l)} onClick={() => onSet(s, l)}
                          className={`h-9 w-10 rounded-xl text-sm font-semibold ring-1 transition disabled:opacity-30 ${levels[s] === l ? 'bg-ink text-cream ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2" data-testid="skill-levels">
                {SKILLS.map((s) => (
                  <div key={s} className="rounded-2xl bg-white p-3 text-center ring-1 ring-ink/5">
                    <p className="font-display text-2xl font-semibold text-terracotta">{levels[s] ?? '–'}</p>
                    <p className="text-[11px] uppercase tracking-wider text-ink-mute">{SKILL_LABEL[s]}</p>
                  </div>
                ))}
              </div>
            )
          ) : null}
          {footer && <div className="mt-4">{footer}</div>}
        </div>
      </Sheet>
    </>
  );
}
