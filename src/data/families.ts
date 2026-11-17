// Verb families: verbs grouped by the way they change in the present tense, so that learning one teaches the rest.
// Stem-changing verbs change in the "boot" (yo, tú, él/ella, ellos/ellas) and stay regular for nosotros and
// vosotros. The other families only change in the yo form.

export type FamilyId = 'e-ie' | 'o-ue' | 'e-i' | 'go' | 'zco' | 'oy';
export interface FamilyVerb { inf: string; en: string; /** yo form, given for the families that only change there. */ yo?: string }
export interface Family {
  id: FamilyId;
  name: string;
  /** In a few words, what changes. */
  rule: string;
  /** Where it changes. */
  where: 'boot' | 'yo';
  tip: string;
  verbs: FamilyVerb[];
}

export const FAMILIES: Family[] = [
  { id: 'e-ie', name: 'e → ie', rule: 'The e in the stem becomes ie', where: 'boot', tip: 'Quiero, quieres, quiere, quieren. But queremos and queréis: no change for nosotros and vosotros.', verbs: [
    { inf: 'querer', en: 'to want' }, { inf: 'pensar', en: 'to think' }, { inf: 'empezar', en: 'to begin' }, { inf: 'entender', en: 'to understand' }, { inf: 'cerrar', en: 'to close' },
    { inf: 'preferir', en: 'to prefer' }, { inf: 'sentir', en: 'to feel' }, { inf: 'perder', en: 'to lose' }, { inf: 'despertar', en: 'to wake' }, { inf: 'comenzar', en: 'to start' },
  ] },
  { id: 'o-ue', name: 'o → ue', rule: 'The o in the stem becomes ue', where: 'boot', tip: 'Puedo, puedes, puede, pueden. But podemos and podéis. Jugar does the same with its u: juego, jugamos.', verbs: [
    { inf: 'poder', en: 'to be able to' }, { inf: 'dormir', en: 'to sleep' }, { inf: 'volver', en: 'to return' }, { inf: 'encontrar', en: 'to find' }, { inf: 'contar', en: 'to count, to tell' },
    { inf: 'recordar', en: 'to remember' }, { inf: 'costar', en: 'to cost' }, { inf: 'almorzar', en: 'to have lunch' }, { inf: 'mover', en: 'to move' }, { inf: 'morir', en: 'to die' },
  ] },
  { id: 'e-i', name: 'e → i', rule: 'The e in the stem becomes i', where: 'boot', tip: 'Pido, pides, pide, piden. But pedimos and pedís. Only -ir verbs do this.', verbs: [
    { inf: 'pedir', en: 'to ask for' }, { inf: 'servir', en: 'to serve' }, { inf: 'repetir', en: 'to repeat' }, { inf: 'vestir', en: 'to dress' }, { inf: 'medir', en: 'to measure' },
  ] },
  { id: 'go', name: 'yo → -go', rule: 'The yo form ends in -go', where: 'yo', tip: 'Tengo, pongo, salgo, hago. The other persons follow their usual pattern.', verbs: [
    { inf: 'tener', en: 'to have', yo: 'tengo' }, { inf: 'poner', en: 'to put', yo: 'pongo' }, { inf: 'salir', en: 'to go out', yo: 'salgo' }, { inf: 'hacer', en: 'to do, to make', yo: 'hago' },
    { inf: 'venir', en: 'to come', yo: 'vengo' }, { inf: 'decir', en: 'to say', yo: 'digo' }, { inf: 'traer', en: 'to bring', yo: 'traigo' }, { inf: 'caer', en: 'to fall', yo: 'caigo' }, { inf: 'oír', en: 'to hear', yo: 'oigo' },
  ] },
  { id: 'zco', name: 'yo → -zco', rule: 'The yo form ends in -zco', where: 'yo', tip: 'Conozco, conduzco, parezco. Verbs ending in -cer and -cir after a vowel do this.', verbs: [
    { inf: 'conocer', en: 'to know (people, places)', yo: 'conozco' }, { inf: 'conducir', en: 'to drive', yo: 'conduzco' }, { inf: 'traducir', en: 'to translate', yo: 'traduzco' },
    { inf: 'parecer', en: 'to seem', yo: 'parezco' }, { inf: 'ofrecer', en: 'to offer', yo: 'ofrezco' }, { inf: 'nacer', en: 'to be born', yo: 'nazco' }, { inf: 'crecer', en: 'to grow', yo: 'crezco' },
  ] },
  { id: 'oy', name: 'yo → -oy', rule: 'The yo form ends in -oy', where: 'yo', tip: 'Soy, estoy, voy, doy. Four very common verbs.', verbs: [
    { inf: 'ser', en: 'to be', yo: 'soy' }, { inf: 'estar', en: 'to be', yo: 'estoy' }, { inf: 'ir', en: 'to go', yo: 'voy' }, { inf: 'dar', en: 'to give', yo: 'doy' },
  ] },
];

export const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f])) as Record<FamilyId, Family>;
export const PRONOUNS = ['yo', 'tú', 'él / ella', 'nosotros', 'vosotros', 'ellos / ellas'];
/** The persons where a stem-changing verb changes: the "boot". */
export const BOOT = [0, 1, 2, 5];

const ENDINGS: Record<string, string[]> = { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] };

/** The present-tense form of a stem-changing verb: the last stem vowel changes inside the boot, and the endings are regular. */
export function stemForm(inf: string, family: 'e-ie' | 'o-ue' | 'e-i', person: number): string {
  const stem = inf.slice(0, -2), end = ENDINGS[inf.slice(-2)][person];
  if (!BOOT.includes(person)) return stem + end;
  const [from, to] = family === 'e-ie' ? ['e', 'ie'] : family === 'o-ue' ? ['o', 'ue'] : ['e', 'i'];
  const at = stem.lastIndexOf(from);
  return (at < 0 ? stem : stem.slice(0, at) + to + stem.slice(at + 1)) + end;
}
/** What the form would be if the verb did not change: the tempting wrong answer. */
export const regularForm = (inf: string, person: number) => inf.slice(0, -2) + ENDINGS[inf.slice(-2)][person];

export type FamilyQuestion =
  /** Which family does this verb belong to? */
  | { kind: 'sort'; verb: FamilyVerb; family: FamilyId; options: FamilyId[] }
  /** One verb of the family is shown changing; do the same to another. */
  | { kind: 'same'; family: FamilyId; model: { inf: string; form: string }; verb: FamilyVerb; person: number; answer: string }
  /** Does it change here or not? Inside the boot it does, for nosotros and vosotros it does not. */
  | { kind: 'boot'; family: FamilyId; verb: FamilyVerb; person: number; answer: string; options: string[] };

const pick = <T,>(list: T[], rng: () => number) => list[Math.floor(rng() * list.length)];
const mix = <T,>(list: T[], rng: () => number) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** A round of the family game. `only` keeps it to one family (for practising a single pattern). */
export function familyRound(count = 10, rng: () => number = Math.random, only?: FamilyId, vosotros = true): FamilyQuestion[] {
  const fams = only ? [FAMILY_BY_ID[only]] : FAMILIES;
  const out: FamilyQuestion[] = [];
  const seen = new Set<string>();
  for (let n = 0; out.length < count && n < count * 20; n++) {
    const fam = pick(fams, rng);
    const verb = pick(fam.verbs, rng);
    if (n % (count * 4) === count * 4 - 1) seen.clear(); // a small family runs out of fresh questions: allow repeats
    let kind = (only ? ['same', 'boot', 'same'] : ['sort', 'same', 'boot'])[out.length % 3] as FamilyQuestion['kind'];
    if (kind === 'boot' && fam.where !== 'boot') kind = 'same'; // only stem-changers have a boot
    const form = (v: FamilyVerb, p: number) => (fam.where === 'boot' ? stemForm(v.inf, fam.id as 'e-ie', p) : v.yo!);
    if (kind === 'sort') {
      if (seen.has(`sort ${verb.inf}`)) continue;
      const others = mix(FAMILIES.filter((f) => f.id !== fam.id && f.where === fam.where), rng).slice(0, 2).map((f) => f.id);
      out.push({ kind, verb, family: fam.id, options: mix([fam.id, ...others], rng) });
      seen.add(`sort ${verb.inf}`);
    } else if (kind === 'same') {
      const model = pick(fam.verbs.filter((v) => v.inf !== verb.inf), rng);
      const person = fam.where === 'boot' ? pick(BOOT, rng) : 0;
      if (!model || seen.has(`same ${verb.inf} ${person}`)) continue;
      out.push({ kind, family: fam.id, model: { inf: model.inf, form: form(model, person) }, verb, person, answer: form(verb, person) });
      seen.add(`same ${verb.inf} ${person}`);
    } else {
      const person = pick(vosotros ? [0, 1, 2, 3, 3, 4, 5] : [0, 1, 2, 3, 3, 5], rng);
      const answer = stemForm(verb.inf, fam.id as 'e-ie', person);
      // The wrong option is the other treatment: changed where it should not be, or unchanged where it should be.
      const wrong = BOOT.includes(person) ? regularForm(verb.inf, person) : stemForm(verb.inf, fam.id as 'e-ie', 0).slice(0, -1) + regularForm(verb.inf, person).slice(verb.inf.length - 2);
      if (wrong === answer || seen.has(`boot ${verb.inf} ${person}`)) continue;
      out.push({ kind, family: fam.id, verb, person, answer, options: mix([answer, wrong], rng) });
      seen.add(`boot ${verb.inf} ${person}`);
    }
  }
  return out;
}
