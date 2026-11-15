import { TENSES, TENSE_BY_ID, type Tense, type Verb } from '../../data/verbs';
import { personsWithForm } from '../../lib/exercises';
import { levelIdx } from '../../lib/platform/level';
import type { Cefr, Region } from '../../types';

/**
 * The tense for one round of a verb game. A beginner only meets the present; as the learner's level rises the
 * tenses of that level come in, so the same game grows with them. The present still appears, less and less.
 */
export function tenseForLevel(level: Cefr, rng: () => number = Math.random): Tense {
  const open = TENSES.filter((t) => levelIdx(t.minLevel) <= levelIdx(level)).map((t) => t.id);
  const presentShare = level === 'A1' ? 1 : level === 'A2' ? 0.45 : level === 'B1' ? 0.25 : 0.15;
  if (open.length <= 1 || rng() < presentShare) return 'present';
  // Favour the tenses of the learner's own level over the ones they met earlier.
  const own = open.filter((t) => TENSE_BY_ID[t].minLevel === level);
  const from = own.length && rng() < 0.6 ? own : open.slice(1);
  return from[Math.floor(rng() * from.length)];
}

/** A person this verb really has in this tense (commands have no "yo"). */
export function personFor(verb: Verb, tense: Tense, region: Region, rng: () => number = Math.random): number | null {
  const ps = personsWithForm(verb, tense, region);
  return ps.length ? ps[Math.floor(rng() * ps.length)] : null;
}

export const tenseLabel = (t: Tense) => TENSE_BY_ID[t].label;
