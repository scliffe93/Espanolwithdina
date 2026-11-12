import type { Activity, AppState, Cefr, Region } from '../types';
import { withinLevel } from './platform/level';
import { HABER_FORMS, VERBS, VERB_BY_INF, conjugate, getActiveVariety, isCompound, parseExample, personsForRegion, personsForTense, verbKey, type Tense, type Verb, type VerbExample } from '../data/verbs';
import { conjugateSimple } from '../data/conjugation';
import { GRAMMAR_DRILLS, type GrammarItem, type GrammarMode } from '../data/grammar';
import { regularPresent } from './answer';

export type ExKind = 'type' | 'choice' | 'match' | 'build' | 'listen' | 'fix' | 'translate' | 'context' | 'serEstar' | 'grammar';

export const EX_LABEL: Record<ExKind, string> = {
  type: 'Conjugate',
  choice: 'Choose the form',
  match: 'Match the pairs',
  build: 'Build the sentence',
  listen: 'Listen',
  fix: 'Fix the mistake',
  translate: 'Translate',
  context: 'In conversation',
  serEstar: 'Ser or estar?',
  grammar: 'Grammar',
};

export interface SerEstarItem {
  before: string;
  after: string;
  answer: string;
  options: string[];
  en: string;
  why: string;
  person: number;
  verb: 'ser' | 'estar';
  /** The other verb is also possible with a different meaning (e.g. está simpática = being nice today). */
  ambiguous?: boolean;
}

export const SER_ESTAR: SerEstarItem[] = [
  { before: 'Mi piso', after: 'en Lavapiés.', answer: 'está', options: ['es', 'está'], en: 'My flat is in Lavapiés.', why: 'Location → estar.', person: 2, verb: 'estar' },
  { before: 'Mi piso', after: 'pequeño pero bonito.', answer: 'es', options: ['es', 'está'], en: 'My flat is small but pretty.', why: 'Characteristics → ser.', person: 2, verb: 'ser', ambiguous: true },
  { before: 'Yo', after: 'de Manchester.', answer: 'soy', options: ['soy', 'estoy'], en: 'I am from Manchester.', why: 'Origin → ser.', person: 0, verb: 'ser' },
  { before: 'Hoy', after: 'muy cansado.', answer: 'estoy', options: ['soy', 'estoy'], en: 'Today I am very tired.', why: 'Temporary state → estar.', person: 0, verb: 'estar' },
  { before: 'Carmen', after: 'muy simpática.', answer: 'es', options: ['es', 'está'], en: 'Carmen is very nice.', why: 'Personality → ser.', person: 2, verb: 'ser', ambiguous: true },
  { before: 'La farmacia', after: 'al lado del café.', answer: 'está', options: ['es', 'está'], en: 'The pharmacy is next to the café.', why: 'Location of a thing → estar.', person: 2, verb: 'estar' },
  { before: 'Javi', after: 'camarero.', answer: 'es', options: ['es', 'está'], en: 'Javi is a waiter.', why: 'Profession → ser.', person: 2, verb: 'ser' },
  { before: '¿Cómo', after: '? — Bien, gracias.', answer: 'estás', options: ['eres', 'estás'], en: 'How are you? — Fine, thanks.', why: 'How you are right now → estar.', person: 1, verb: 'estar' },
  { before: 'La fiesta', after: 'en casa de Marta.', answer: 'es', options: ['es', 'está'], en: 'The party is at Marta\'s place.', why: 'Where an EVENT takes place → ser (a classic exception!).', person: 2, verb: 'ser' },
  { before: 'Nosotros', after: 'en el metro.', answer: 'estamos', options: ['somos', 'estamos'], en: 'We are on the metro.', why: 'Location → estar.', person: 3, verb: 'estar' },
  { before: '', after: 'las ocho y media.', answer: 'Son', options: ['Son', 'Están'], en: 'It\'s half past eight.', why: 'Time → ser.', person: 5, verb: 'ser' },
  { before: 'El café', after: 'frío.', answer: 'está', options: ['es', 'está'], en: 'The coffee is cold (it\'s gone cold).', why: 'Condition right now → estar.', person: 2, verb: 'estar', ambiguous: true },
  { before: 'Mis vecinos', after: 'muy ruidosos.', answer: 'son', options: ['son', 'están'], en: 'My neighbours are very noisy (by nature).', why: 'A characteristic → ser.', person: 5, verb: 'ser', ambiguous: true },
  { before: 'Marta', after: 'contenta con su trabajo nuevo.', answer: 'está', options: ['es', 'está'], en: 'Marta is happy with her new job.', why: 'Emotion / state → estar.', person: 2, verb: 'estar' },
  { before: 'Hoy', after: 'lunes.', answer: 'es', options: ['es', 'está'], en: 'Today is Monday.', why: 'Days and dates → ser.', person: 2, verb: 'ser' },
  { before: 'La sopa', after: 'muy caliente.', answer: 'está', options: ['es', 'está'], en: 'The soup is very hot.', why: 'A current condition → estar.', person: 2, verb: 'estar', ambiguous: true },
  { before: 'Mi hermana', after: 'médica.', answer: 'es', options: ['es', 'está'], en: 'My sister is a doctor.', why: 'Profession → ser.', person: 2, verb: 'ser' },
  { before: 'El concierto', after: 'en el teatro.', answer: 'es', options: ['es', 'está'], en: 'The concert is (taking place) at the theatre.', why: 'Where an event happens → ser.', person: 2, verb: 'ser' },
  { before: 'Las llaves', after: 'en la mesa.', answer: 'están', options: ['son', 'están'], en: 'The keys are on the table.', why: 'Location of things → estar.', person: 5, verb: 'estar' },
  { before: '¿De dónde', after: '?', answer: 'eres', options: ['eres', 'estás'], en: 'Where are you from?', why: 'Origin → ser.', person: 1, verb: 'ser' },
  { before: 'Yo', after: 'muy contenta hoy.', answer: 'estoy', options: ['soy', 'estoy'], en: 'I\'m very happy today.', why: 'Mood right now → estar.', person: 0, verb: 'estar' },
  { before: 'La reunión', after: 'a las diez.', answer: 'es', options: ['es', 'está'], en: 'The meeting is at ten.', why: 'Time of an event → ser.', person: 2, verb: 'ser' },
  { before: 'Este restaurante', after: 'muy caro.', answer: 'es', options: ['es', 'está'], en: 'This restaurant is very expensive.', why: 'A characteristic → ser.', person: 2, verb: 'ser', ambiguous: true },
  { before: 'Los niños', after: 'dormidos.', answer: 'están', options: ['son', 'están'], en: 'The children are asleep.', why: 'A resulting state → estar.', person: 5, verb: 'estar' },
  { before: 'Mi abuelo', after: 'muy mayor.', answer: 'es', options: ['es', 'está'], en: 'My grandfather is very old.', why: 'Age as a characteristic → ser.', person: 2, verb: 'ser', ambiguous: true },
  { before: 'La tienda', after: 'cerrada.', answer: 'está', options: ['es', 'está'], en: 'The shop is closed.', why: 'A current state → estar.', person: 2, verb: 'estar' },
  { before: '', after: 'las tres de la tarde.', answer: 'Son', options: ['Son', 'Están'], en: 'It\'s three in the afternoon.', why: 'Telling the time → ser.', person: 5, verb: 'ser' },
  { before: 'Nosotros', after: 'de vacaciones.', answer: 'estamos', options: ['somos', 'estamos'], en: 'We\'re on holiday.', why: 'Estar de vacaciones — a temporary situation.', person: 3, verb: 'estar' },
  { before: 'Esta mesa', after: 'de madera.', answer: 'es', options: ['es', 'está'], en: 'This table is made of wood.', why: 'Material → ser.', person: 2, verb: 'ser' },
  { before: '¿Cómo', after: 'tu madre? — Bien, gracias.', answer: 'está', options: ['es', 'está'], en: 'How is your mother? — Fine, thanks.', why: 'How someone is doing → estar.', person: 2, verb: 'estar' },
  { before: 'Juan', after: 'aburrido: no hay nada que hacer.', answer: 'está', options: ['es', 'está'], en: 'Juan is bored: there\'s nothing to do.', why: 'Estar aburrido = to be bored (a feeling).', person: 2, verb: 'estar' },
  { before: 'Esta película', after: 'aburrida.', answer: 'es', options: ['es', 'está'], en: 'This film is boring.', why: 'Ser aburrido = to be boring (a characteristic).', person: 2, verb: 'ser', ambiguous: true },
  { before: 'Mi casa', after: 'cerca del metro.', answer: 'está', options: ['es', 'está'], en: 'My house is near the metro.', why: 'Location → estar.', person: 2, verb: 'estar' },
];

export type Exercise =
  | { kind: 'type' | 'choice' | 'listen'; verb: string; tense: Tense; person: number; options?: string[]; pronoun: string }
  | { kind: 'context'; verb: string; tense: 'present'; person: number; example: VerbExample }
  | { kind: 'match'; verb: string; tense: Tense; persons: number[]; pronouns: string[] }
  | { kind: 'build'; verb: string; example: VerbExample; tiles: string[] }
  | { kind: 'fix'; verb: string; example: VerbExample; wrong: string; options: string[] }
  | { kind: 'translate'; verb: string; example: VerbExample; options: string[] }
  | { kind: 'serEstar'; item: SerEstarItem }
  | { kind: 'grammar'; mode: Exclude<GrammarMode, 'ser-estar'>; index: number; item: GrammarItem };

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PRONOUN_CHOICES: string[][] = [['yo'], ['tú'], ['él', 'ella', 'usted'], ['nosotros', 'nosotras'], ['vosotros', 'vosotras'], ['ellos', 'ellas', 'ustedes']];
const IO_PRONOUN_CHOICES: string[][] = [['a mí'], ['a ti'], ['a él', 'a ella', 'a usted'], ['a nosotros'], ['a vosotros'], ['a ellos', 'a ellas', 'a ustedes']];

export function pronounFor(verb: Verb, person: number, rng: Rng = Math.random): string {
  const vos = getActiveVariety() === 'argentina' && person === 1;
  if (vos) return verb.pronominal ? 'a vos' : 'vos';
  const list = (verb.pronominal ? IO_PRONOUN_CHOICES : PRONOUN_CHOICES)[person];
  return list[Math.floor(rng() * list.length)];
}

/** Distractors: other persons' forms plus the "regularised" mistake for irregular verbs. */
export function formOptions(verb: Verb, tense: Tense, person: number, region: Region, rng: Rng = Math.random, n = 4): string[] {
  const answer = conjugate(verb, tense, person);
  const pool = new Set<string>();
  if (tense === 'present' && getActiveVariety() === 'argentina' && person === 1 && !verb.pronominal) pool.add(verb.present[1]); // tú form as a distractor for vos
  if (tense === 'present' && verb.group !== 'regular' && !verb.pronominal) {
    const reg = regularPresent(verb.inf, person);
    if (reg !== answer) pool.add(reg);
  }
  if (tense !== 'present' && tense !== 'progressive' && tense !== 'negative-imperative' && !isCompound(tense) && verb.group !== 'regular' && !verb.pronominal) {
    // The "regularised" mistake for irregular verbs in the simple tenses (tener → tení, ser → sé…).
    const reg = conjugateSimple({ inf: verb.inf, group: 'regular', present: verb.present }, tense, person);
    if (reg && reg !== answer) pool.add(reg);
  }
  for (const p of shuffle(personsForTense(tense, region), rng)) {
    const f = conjugate(verb, tense, p);
    if (f !== answer) pool.add(f);
  }
  if (tense === 'progressive' && !verb.pronominal) pool.add(`${['he', 'has', 'ha', 'hemos', 'habéis', 'han'][person]} ${verb.gerund}`);
  if (isCompound(tense) && tense !== 'perfect' && !verb.pronominal) {
    // The same person with haber in a neighbouring tense (había / habría / habrá hablado) is the natural slip.
    for (const other of ['pluperfect', 'conditional-perfect', 'future-perfect', 'perfect-subjunctive', 'pluperfect-subjunctive', 'perfect'] as const) if (other !== tense) pool.add(`${HABER_FORMS[other][person]} ${verb.participle}`);
  }
  if (tense === 'negative-imperative' && !verb.pronominal) {
    const affirmative = conjugate(verb, 'imperative', person); // "no habla" for "no hables" is the classic mistake
    if (affirmative) pool.add(`no ${affirmative}`);
    pool.add(`no ${verb.present[person]}`);
  }
  if (tense === 'perfect' && !verb.pronominal) pool.add(`${['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'][person]} ${verb.participle}`);
  return shuffle([answer, ...[...pool].slice(0, n - 1)], rng);
}

export function tokenize(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean);
}

export interface PlanInput {
  state: AppState;
  focus?: string[];
  tense: Tense;
  length?: number;
  now?: number;
  rng?: Rng;
  mode?: GrammarMode;
  /** The teacher's level ceiling for this student (null/undefined = none): verbs above it are never picked by the app. */
  maxLevel?: Cefr | null;
  /** Gradual release: only these verbs may be picked (null = any). */
  allowed?: Set<string> | null;
}

/** Picks which verbs to practise: due → weak → in-progress → new (by frequency, within level). */
export function pickVerbs(state: AppState, tense: Tense, count: number, now = Date.now(), maxLevel: Cefr | null = null, allowed: Set<string> | null = null): string[] {
  const region = state.profile?.region ?? 'spain';
  const persons = personsForTense(tense, region);
  // Frequency order; A2 verbs come later for A1 learners naturally (they rank lower). A teacher's ceiling removes verbs above it.
  const eligible = VERBS.filter((v) => (allowed ? allowed.has(v.inf) : withinLevel(v.level, maxLevel))).sort((a, b) => a.frequencyRank - b.frequencyRank);
  const info = eligible.map((v) => {
    const cards = persons.map((p) => state.srs[verbKey(v.inf, tense, p)]).filter(Boolean);
    const attempts = cards.reduce((a, c) => a + c!.attempts, 0);
    const correct = cards.reduce((a, c) => a + c!.correct, 0);
    const due = cards.some((c) => c!.attempts > 0 && c!.due <= now);
    return { inf: v.inf, attempts, acc: attempts ? correct / attempts : 1, due };
  });
  const due = info.filter((i) => i.due).map((i) => i.inf);
  const weak = info.filter((i) => i.attempts >= 2 && i.acc < 0.75 && !due.includes(i.inf)).sort((a, b) => a.acc - b.acc).map((i) => i.inf);
  const started = info.filter((i) => i.attempts > 0 && !due.includes(i.inf) && !weak.includes(i.inf)).map((i) => i.inf);
  const fresh = info.filter((i) => i.attempts === 0).map((i) => i.inf);
  // Mix: never more than 2 brand-new verbs per session so new forms stick.
  const out: string[] = [];
  for (const list of [due, weak, fresh.slice(0, 2), started, fresh.slice(2)]) for (const v of list) if (out.length < count && !out.includes(v)) out.push(v);
  return out;
}

const KIND_PREF: Record<Activity, ExKind[]> = {
  games: ['match', 'choice'],
  writing: ['type', 'build'],
  audio: ['listen'],
  stories: ['context', 'translate'],
  visual: ['match', 'build'],
  speaking: ['context'],
};

/** Builds a varied session. Preferences tilt the mix but every learner sees every kind. */
export function buildSession({ state, focus, tense, length = 12, now = Date.now(), rng = Math.random, mode, maxLevel = null, allowed = null }: PlanInput): Exercise[] {
  const region = state.profile?.region ?? 'spain';
  if (mode === 'ser-estar') {
    const items = shuffle(SER_ESTAR, rng).slice(0, Math.min(length, SER_ESTAR.length));
    const mixed: Exercise[] = items.map((item) => ({ kind: 'serEstar', item }));
    // Interleave a couple of conjugation items for ser/estar themselves.
    mixed.splice(3, 0, { kind: 'match', verb: 'ser', tense: 'present', persons: shuffle(personsForRegion(region), rng).slice(0, 4), pronouns: [] });
    mixed.splice(7, 0, { kind: 'match', verb: 'estar', tense: 'present', persons: shuffle(personsForRegion(region), rng).slice(0, 4), pronouns: [] });
    return fillPronouns(mixed, rng);
  }
  if (mode) {
    // The other grammar drills: items within the student's level ceiling, shuffled.
    const pool = GRAMMAR_DRILLS[mode].map((item, index) => ({ item, index })).filter((x) => withinLevel(x.item.level, maxLevel));
    return shuffle(pool, rng).slice(0, Math.min(length, pool.length)).map((x) => ({ kind: 'grammar' as const, mode, index: x.index, item: x.item }));
  }

  const verbs = focus?.length ? focus.filter((v) => VERB_BY_INF[v]) : pickVerbs(state, tense, 5, now, maxLevel, allowed);
  const persons = personsForTense(tense, region);
  const prefs = state.profile?.activities ?? [];
  const base: ExKind[] = ['choice', 'type', 'match', 'listen', 'fix', 'type', 'choice', 'build'];
  if (tense === 'present') base.push('context', 'translate', 'context');
  const kinds: ExKind[] = [...base];
  for (const a of prefs) for (const k of KIND_PREF[a]) if (tense === 'present' || !['context', 'translate', 'build', 'fix'].includes(k)) kinds.push(k);

  const out: Exercise[] = [];
  let i = 0;
  // Progression within a session: recognition first, production later.
  const order = (k: ExKind) => ({ match: 0, choice: 1, listen: 2, translate: 3, fix: 4, build: 5, context: 6, type: 7, serEstar: 1, grammar: 1 })[k];
  const picks = shuffle(kinds, rng).slice(0, length).sort((a, b) => order(a) - order(b));
  for (const kind of picks) {
    const inf = verbs[i++ % verbs.length];
    const verb = VERB_BY_INF[inf];
    const examples = verb.examples.filter((e) => e.person >= 0 && (region !== 'mexico' || e.person !== 4));
    const ex = examples.length ? examples[Math.floor(rng() * examples.length)] : undefined;
    const person = persons[Math.floor(rng() * persons.length)];
    const needsExample = ['context', 'build', 'fix', 'translate'].includes(kind);
    if (needsExample && (!ex || tense !== 'present')) {
      out.push({ kind: 'type', verb: inf, tense, person, pronoun: '' });
      continue;
    }
    switch (kind) {
      case 'type':
        out.push({ kind, verb: inf, tense, person, pronoun: '' });
        break;
      case 'choice':
      case 'listen':
        out.push({ kind, verb: inf, tense, person, options: formOptions(verb, tense, person, region, rng), pronoun: '' });
        break;
      case 'match':
        out.push({ kind, verb: inf, tense, persons: shuffle(persons, rng).slice(0, 4), pronouns: [] });
        break;
      case 'context':
        out.push({ kind, verb: inf, tense: 'present', person: ex!.person, example: ex! });
        break;
      case 'build':
        out.push({ kind, verb: inf, example: ex!, tiles: shuffle(tokenize(parseExample(ex!).plain), rng) });
        break;
      case 'fix': {
        const right = verb.present[ex!.person];
        const wrongs = formOptions(verb, 'present', ex!.person, region, rng).filter((f) => f !== right);
        const wrong = wrongs[0];
        out.push({ kind, verb: inf, example: ex!, wrong, options: shuffle([right, ...wrongs.slice(1, 3)], rng) });
        break;
      }
      case 'translate': {
        const pe = parseExample(ex!);
        const wrongForms = formOptions(verb, 'present', ex!.person, region, rng).filter((f) => f.toLowerCase() !== pe.answer.toLowerCase()).slice(0, 2);
        const sentences = wrongForms.map((w) => pe.before + (pe.answer[0] === pe.answer[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w) + pe.after);
        out.push({ kind, verb: inf, example: ex!, options: shuffle([pe.plain, ...sentences], rng) });
        break;
      }
      default:
        break;
    }
  }
  return fillPronouns(out, rng);
}

function fillPronouns(list: Exercise[], rng: Rng): Exercise[] {
  return list.map((e) => {
    if (e.kind === 'type' || e.kind === 'choice' || e.kind === 'listen') return { ...e, pronoun: pronounFor(VERB_BY_INF[e.verb], e.person, rng) };
    if (e.kind === 'match') return { ...e, pronouns: e.persons.map((p) => pronounFor(VERB_BY_INF[e.verb], p, rng)) };
    return e;
  });
}

export function cardKeyFor(e: Exercise): { key: string; person: number; tense: Tense } | null {
  switch (e.kind) {
    case 'type': case 'choice': case 'listen': return { key: verbKey(e.verb, e.tense, e.person), person: e.person, tense: e.tense };
    case 'context': case 'build': case 'fix': case 'translate': return { key: verbKey(e.verb, 'present', e.example.person), person: e.example.person, tense: 'present' };
    case 'serEstar': return { key: verbKey(e.item.verb, 'present', e.item.person), person: e.item.person, tense: 'present' };
    case 'grammar': return { key: `grammar:${e.mode}|${e.index}`, person: 0, tense: 'present' };
    case 'match': return null;
  }
}
