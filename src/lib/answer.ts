import type { ErrorCategory } from '../types';
import { conjugate, type Tense, type Verb } from '../data/verbs';

/** Lower-case, trim, remove punctuation (keeps accents and ñ). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[¿?¡!.,;:"“”«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Removes accents but keeps ñ distinct (ñ → ñ). */
export function stripAccents(s: string): string {
  return s
    .replace(/ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'ñ');
}

export type CheckResult = 'correct' | 'accent' | 'wrong';

/** Exact (normalised) → correct; differs only in accents → accent; else wrong. */
export function checkAnswer(given: string, accepted: string[]): CheckResult {
  const g = normalize(given);
  if (!g) return 'wrong';
  const acc = accepted.map(normalize);
  if (acc.includes(g)) return 'correct';
  if (acc.map(stripAccents).includes(stripAccents(g))) return 'accent';
  return 'wrong';
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const ENDINGS: Record<'ar' | 'er' | 'ir', string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

/** What a learner would produce if they treated the verb as fully regular. */
export function regularPresent(inf: string, person: number): string {
  const clean = inf.replace('í', 'i');
  const type = clean.slice(-2) as 'ar' | 'er' | 'ir';
  const stem = clean.slice(0, -2);
  return stem + (ENDINGS[type]?.[person] ?? '');
}

/** Diagnoses *why* a conjugation answer was wrong. */
export function classifyVerbError(verb: Verb, tense: Tense, person: number, given: string): ErrorCategory {
  const g = normalize(given);
  const expected = normalize(conjugate(verb, tense, person));
  if (stripAccents(g) === stripAccents(expected)) return 'accents';

  const sameTenseForms = [0, 1, 2, 3, 4, 5].map((p) => normalize(conjugate(verb, tense, p)));
  if (sameTenseForms.includes(g) || sameTenseForms.map(stripAccents).includes(stripAccents(g))) return 'person-agreement';

  if (tense !== 'present' && !verb.pronominal) {
    const [aux, ...rest] = g.split(' ');
    const [expAux, ...expRest] = expected.split(' ');
    if (rest.join(' ') === expRest.join(' ') && aux !== expAux) return 'auxiliary';
    if (aux === expAux) return verb.group === 'regular' ? 'spelling' : 'irregular-verb';
  }

  if (tense === 'present' && !verb.pronominal) {
    const regular = normalize(regularPresent(verb.inf, person));
    if (g === regular || stripAccents(g) === stripAccents(regular)) {
      if (verb.group.startsWith('stem')) return 'stem-change';
      if (verb.group === 'irregular-yo' && person === 0) return 'irregular-yo';
      if (verb.group === 'irregular') return person === 0 ? 'irregular-yo' : 'irregular-verb';
    }
  }

  if (levenshtein(g, expected) <= 2) return 'spelling';
  if (verb.group !== 'regular') return 'irregular-verb';
  return 'other';
}

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  accents: 'Missing or wrong accents',
  'person-agreement': 'Verb ending doesn’t match the person',
  'stem-change': 'Forgetting stem changes (e→ie, o→ue, e→i)',
  'irregular-yo': 'Irregular "yo" forms (tengo, hago, salgo…)',
  'irregular-verb': 'Irregular verb forms',
  'ser-estar': 'Ser vs estar',
  register: 'Formal vs informal register (tú / usted)',
  vocabulary: 'Vocabulary recall',
  spelling: 'Spelling slips',
  auxiliary: 'Auxiliary verb (estar / haber)',
  other: 'Other',
};

export const CATEGORY_TIP: Record<ErrorCategory, string> = {
  accents: 'Accents change meaning and stress (habló ≠ hablo). Practise typing them: on mobile, long-press the vowel.',
  'person-agreement': 'Say the subject pronoun aloud before the verb: "yo… hablo", "tú… hablas".',
  'stem-change': 'Picture a "boot": yo, tú, él and ellos change the stem; nosotros and vosotros don\'t.',
  'irregular-yo': 'Group the -go verbs together: tengo, vengo, hago, pongo, salgo, digo, traigo, oigo.',
  'irregular-verb': 'Irregular verbs are the most common ones — short daily recall beats long sessions.',
  'ser-estar': 'Ser = what something is (identity, origin, job, characteristics). Estar = where and how it is right now.',
  register: 'Use usted with older people, officials and strangers until they invite you to use tú.',
  vocabulary: 'Use Help me remember on missed words — the clue you build yourself is what sticks.',
  spelling: 'Slow down on the final letters: most slips are in the ending.',
  auxiliary: 'Progressive uses estar (estoy hablando); perfect uses haber (he hablado).',
  other: 'Review the model sentence and say it aloud twice.',
};
