// ───────────────────────────────────────────────────────────────
// Conjugation rules for the simple tenses beyond the present:
// preterite, imperfect, future, conditional, present subjunctive,
// imperfect subjunctive (-ra) and the affirmative imperative.
//
// Regular endings plus the systematic changes (stem changes in the
// boot and in the -ir 3rd persons, spelling changes before e/i, vowel
// stems taking -y-), with explicit tables for the strong preterites,
// irregular futures, imperfects, subjunctives and tú commands. Compound
// verbs (mantener, suponer, prevenir…) inherit the irregularity of
// their base by suffix. Pure functions, no imports from the UI.
// ───────────────────────────────────────────────────────────────

export type SimpleTense = 'preterite' | 'imperfect' | 'future' | 'conditional' | 'subjunctive' | 'imperfect-subjunctive' | 'imperative';
export type StemGroup = 'regular' | 'stem-e-ie' | 'stem-o-ue' | 'stem-e-i' | 'stem-u-ue' | 'irregular-yo' | 'irregular';

export interface ConjugableVerb {
  inf: string;
  group: StemGroup;
  /** Present indicative, six persons (used for the subjunctive's yo stem). */
  present: readonly string[];
  pronominal?: boolean;
}

const ACCENT: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const IO_PRONOUNS = ['me', 'te', 'le', 'nos', 'os', 'les'];

/** `inf` with a final -ír normalised to -ir (oír → oir) so the stem and ending split cleanly. */
const norm = (inf: string) => inf.replace(/ír$/, 'ir');
export const infType = (inf: string): 'ar' | 'er' | 'ir' => norm(inf).slice(-2) as 'ar' | 'er' | 'ir';
export const infStem = (inf: string) => norm(inf).slice(0, -2);

/** Adds an accent to the last vowel of a word (habla → hablá, tuvie → tuvié). */
export function accentLastVowel(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) if (ACCENT[s[i]]) return s.slice(0, i) + ACCENT[s[i]] + s.slice(i + 1);
  return s;
}

// ── Irregular tables (base verbs; compounds inherit by suffix) ──

/** Strong preterite stems; endings -e, -iste, -o, -imos, -isteis, -ieron (-eron after j). */
const STRONG_PRETERITE: Record<string, string> = { tener: 'tuv', estar: 'estuv', andar: 'anduv', poder: 'pud', poner: 'pus', saber: 'sup', hacer: 'hic', querer: 'quis', venir: 'vin', haber: 'hub', caber: 'cup', decir: 'dij', traer: 'traj', conducir: 'conduj', producir: 'produj', traducir: 'traduj', reducir: 'reduj', deducir: 'deduj', introducir: 'introduj', aducir: 'aduj', seducir: 'seduj' };
const FULL_PRETERITE: Record<string, string[]> = {
  ser: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
  ir: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
  dar: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
  ver: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
};
const FULL_IMPERFECT: Record<string, string[]> = {
  ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
  ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
  ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
};
/** Irregular future/conditional stems. */
const FUTURE_STEM: Record<string, string> = { tener: 'tendr', poner: 'pondr', salir: 'saldr', venir: 'vendr', valer: 'valdr', poder: 'podr', saber: 'sabr', querer: 'querr', haber: 'habr', caber: 'cabr', hacer: 'har', decir: 'dir' };
const FULL_SUBJUNCTIVE: Record<string, string[]> = {
  ser: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
  estar: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
  ir: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
  saber: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
  dar: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
  haber: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
};
/** Irregular affirmative tú commands. */
const IMPERATIVE_TU: Record<string, string> = { decir: 'di', hacer: 'haz', ir: 've', poner: 'pon', salir: 'sal', ser: 'sé', tener: 'ten', venir: 'ven' };
const VOS_IMPERATIVE: Record<string, string> = { ir: 'andá', ser: 'sé' };

/** Compound verbs and the base whose irregularities they inherit. Listed explicitly: ending in -ir or -ver is not enough (vivir is not a compound of ir). */
const COMPOUND_BASE: Record<string, string> = {
  mantener: 'tener', obtener: 'tener', contener: 'tener', detener: 'tener', sostener: 'tener', entretener: 'tener', retener: 'tener', abstener: 'tener',
  suponer: 'poner', componer: 'poner', proponer: 'poner', disponer: 'poner', imponer: 'poner', oponer: 'poner', reponer: 'poner', exponer: 'poner', deponer: 'poner', posponer: 'poner', descomponer: 'poner',
  prevenir: 'venir', convenir: 'venir', intervenir: 'venir', sobrevenir: 'venir', provenir: 'venir',
  deshacer: 'hacer', rehacer: 'hacer',
  atraer: 'traer', distraer: 'traer', contraer: 'traer', sustraer: 'traer', extraer: 'traer',
  contradecir: 'decir', predecir: 'decir', bendecir: 'decir', maldecir: 'decir',
  prever: 'ver', entrever: 'ver',
  sobresalir: 'salir',
  desandar: 'andar',
};
/** Compounds whose future/conditional or tú command is regular despite the base (bendecir → bendeciré, bendice). */
const REGULAR_FUTURE = new Set(['bendecir', 'maldecir', 'predecir']);
const REGULAR_TU = new Set(['contradecir', 'predecir', 'bendecir', 'maldecir']);

/** The base verb an entry in `table` applies to: the verb itself, or the base of a listed compound (mantener → tener, prefix "man"). */
function baseOf(inf: string, table: Record<string, unknown>): { base: string; prefix: string } | null {
  if (table[inf]) return { base: inf, prefix: '' };
  const base = COMPOUND_BASE[inf];
  if (base && table[base]) return { base, prefix: inf.slice(0, -base.length) };
  return null;
}

// ── Stem helpers ──

const isVowel = (c: string) => 'aeiouáéíóú'.includes(c);
/** Last vowel index in a stem (for stem changes). */
function lastIndexOfVowel(stem: string, v: string): number {
  return stem.lastIndexOf(v);
}
/** Applies the boot change (e→ie, o→ue, e→i, u→ue) to the last matching vowel of the stem. */
function bootStem(stem: string, group: StemGroup): string {
  const map: Partial<Record<StemGroup, [string, string]>> = { 'stem-e-ie': ['e', 'ie'], 'stem-o-ue': ['o', 'ue'], 'stem-e-i': ['e', 'i'], 'stem-u-ue': ['u', 'ue'] };
  const m = map[group];
  if (!m) return stem;
  const i = lastIndexOfVowel(stem, m[0]);
  return i < 0 ? stem : stem.slice(0, i) + m[1] + stem.slice(i + 1);
}
/** The weaker -ir change used outside the boot (e→i, o→u): sentir → sint-, dormir → durm-. */
function weakIrStem(stem: string, group: StemGroup): string {
  const map: Partial<Record<StemGroup, [string, string]>> = { 'stem-e-ie': ['e', 'i'], 'stem-e-i': ['e', 'i'], 'stem-o-ue': ['o', 'u'] };
  const m = map[group];
  if (!m) return stem;
  const i = lastIndexOfVowel(stem, m[0]);
  return i < 0 ? stem : stem.slice(0, i) + m[1] + stem.slice(i + 1);
}
/** Spelling before e/i for -ar verbs (busc → busqu, pag → pagu, empez → empec, averigu → averigü). */
function spellBeforeE(stem: string): string {
  if (stem.endsWith('gu')) return stem.slice(0, -2) + 'gü';
  if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu';
  if (stem.endsWith('g')) return stem + 'u';
  if (stem.endsWith('z')) return stem.slice(0, -1) + 'c';
  return stem;
}

// ── Tenses ──

export function preterite(v: ConjugableVerb, person: number): string {
  const inf = v.inf;
  const full = baseOf(inf, FULL_PRETERITE);
  if (full) return full.prefix + FULL_PRETERITE[full.base][person];
  const strong = baseOf(inf, STRONG_PRETERITE);
  if (strong) {
    const stem = strong.prefix + STRONG_PRETERITE[strong.base];
    if (strong.base === 'hacer' && person === 2) return strong.prefix + 'hizo';
    const ends = ['e', 'iste', 'o', 'imos', 'isteis', stem.endsWith('j') ? 'eron' : 'ieron'];
    return stem + ends[person];
  }
  const type = infType(inf);
  let stem = infStem(inf);
  if (type === 'ar') {
    const ends = ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'];
    return (person === 0 ? spellBeforeE(stem) : stem) + ends[person];
  }
  // -er / -ir
  const vowelStem = isVowel(stem.slice(-1)) && !stem.endsWith('u') ? 'y' : stem.endsWith('u') && type === 'ir' ? 'uy' : '';
  if (type === 'ir' && (person === 2 || person === 5)) stem = weakIrStem(stem, v.group); // pidió, durmieron
  if (vowelStem === 'y') {
    // leer, creer, caer, oír: leí, leíste, leyó, leímos, leísteis, leyeron
    const ends = ['í', 'íste', 'yó', 'ímos', 'ísteis', 'yeron'];
    return stem + ends[person];
  }
  if (vowelStem === 'uy') {
    // construir: construí, construiste, construyó, construimos, construisteis, construyeron
    const ends = ['í', 'iste', 'yó', 'imos', 'isteis', 'yeron'];
    return stem + ends[person];
  }
  const ends = ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'];
  return stem + ends[person];
}

export function imperfect(v: ConjugableVerb, person: number): string {
  const full = baseOf(v.inf, FULL_IMPERFECT);
  if (full) return full.prefix + FULL_IMPERFECT[full.base][person];
  const stem = infStem(v.inf);
  if (infType(v.inf) === 'ar') return stem + ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'][person];
  return stem + ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'][person];
}

function futureStem(inf: string): string {
  const irr = REGULAR_FUTURE.has(inf) ? null : baseOf(inf, FUTURE_STEM);
  if (irr) return irr.prefix + FUTURE_STEM[irr.base];
  return norm(inf) === inf ? inf : norm(inf); // oír → oir + é = oiré
}
export function future(v: ConjugableVerb, person: number): string {
  return futureStem(v.inf) + ['é', 'ás', 'á', 'emos', 'éis', 'án'][person];
}
export function conditional(v: ConjugableVerb, person: number): string {
  return futureStem(v.inf) + ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'][person];
}

export function presentSubjunctive(v: ConjugableVerb, person: number): string {
  const full = baseOf(v.inf, FULL_SUBJUNCTIVE);
  if (full) return full.prefix + FULL_SUBJUNCTIVE[full.base][person];
  const type = infType(v.inf);
  const yo = v.present[0].includes(' ') ? regularPresentForms(v.inf, v.group)[0] : v.present[0]; // gustar-type verbs store "me gusta"
  const yoStem = yo.endsWith('oy') ? yo.slice(0, -2) : yo.endsWith('o') ? yo.slice(0, -1) : yo;
  const inBoot = person === 0 || person === 1 || person === 2 || person === 5;
  let stem: string;
  if (inBoot) stem = yoStem;
  else if (type === 'ir' && v.group.startsWith('stem')) stem = weakIrStem(infStem(v.inf), v.group); // durmamos, sintamos, pidamos
  else if (v.group.startsWith('stem')) stem = infStem(v.inf); // podamos, pensemos
  else stem = yoStem; // tengamos, conozcamos, hablemos
  if (type === 'ar') {
    const s = spellBeforeE(stem);
    return s + ['e', 'es', 'e', 'emos', 'éis', 'en'][person];
  }
  return stem + ['a', 'as', 'a', 'amos', 'áis', 'an'][person];
}

export function imperfectSubjunctive(v: ConjugableVerb, person: number): string {
  const ellos = preterite(v, 5); // hablaron, tuvieron, fueron, dijeron
  const stem = ellos.slice(0, -3); // habla, tuvie, fue, dije
  if (person === 3) return accentLastVowel(stem) + 'ramos';
  return stem + ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'][person];
}

/** Affirmative commands. Person 0 (yo) has none and returns ''. `vos` gives the Rioplatense tú form. */
export function imperative(v: ConjugableVerb, person: number, vos = false): string {
  if (person === 0) return '';
  if (person === 1) {
    if (vos) {
      const irr = baseOf(v.inf, VOS_IMPERATIVE);
      if (irr && !irr.prefix) return VOS_IMPERATIVE[irr.base];
      return accentLastVowel(norm(v.inf).slice(0, -1)); // hablá, comé, viví
    }
    const irr = REGULAR_TU.has(v.inf) ? null : baseOf(v.inf, IMPERATIVE_TU);
    if (irr) {
      const form = IMPERATIVE_TU[irr.base];
      // Compounds of tener, poner and venir carry a written accent: mantén, supón, prevén.
      return irr.prefix + (irr.prefix && ['tener', 'poner', 'venir'].includes(irr.base) ? accentLastVowel(form) : form);
    }
    return v.present[2]; // habla, come, piensa, pide
  }
  if (person === 4) return v.inf.slice(0, -1) + 'd'; // hablad, comed, vivid, id, oíd
  if (person === 3 && baseOf(v.inf, { ir: 1 })?.base === 'ir' && v.inf === 'ir') return 'vamos';
  return presentSubjunctive(v, person); // usted, nosotros, ustedes
}

/** A gustar-type verb in any simple tense: me gustó, me gustaba, me gustará… (3rd-person singular agreement). */
function pronominalSimple(v: ConjugableVerb, tense: SimpleTense, person: number): string {
  if (tense === 'imperative') return '';
  const third = conjugateSimple({ ...v, pronominal: false }, tense, 2);
  return `${IO_PRONOUNS[person]} ${third}`;
}

/** One of the simple tenses for any verb and person (0–5). `vos` only affects the imperative. */
export function conjugateSimple(v: ConjugableVerb, tense: SimpleTense, person: number, vos = false): string {
  if (v.pronominal) return pronominalSimple(v, tense, person);
  switch (tense) {
    case 'preterite': return preterite(v, person);
    case 'imperfect': return imperfect(v, person);
    case 'future': return future(v, person);
    case 'conditional': return conditional(v, person);
    case 'subjunctive': return presentSubjunctive(v, person);
    case 'imperfect-subjunctive': return imperfectSubjunctive(v, person);
    case 'imperative': return imperative(v, person, vos);
  }
}

// ── Present-tense generation for the wider verb bank ──

const ZCO = /(cer|cir)$/; // conocer → conozco (after a vowel)
/** Irregular yo forms that follow a pattern: -cer/-cir after a vowel → -zco; -ger/-gir → -jo; -cer after a consonant → -zo. `stem` is the boot stem (elig- for elegir). */
export function patternYo(inf: string, stem = infStem(inf)): string | null {
  if (ZCO.test(inf) && isVowel(inf[inf.length - 4])) return stem.slice(0, -1) + 'zco';
  if (/(ger|gir)$/.test(inf)) return stem.slice(0, -1) + 'jo';
  if (/cer$/.test(inf) || /cir$/.test(inf)) return stem.slice(0, -1) + 'zo'; // vencer → venzo (consonant before c)
  return null;
}
/** Gerunds that the rules do not produce. */
const GERUND_IRREGULAR: Record<string, string> = { poder: 'pudiendo', venir: 'viniendo', decir: 'diciendo', ir: 'yendo', reír: 'riendo', freír: 'friendo' };

/** Present indicative for a verb from its infinitive, stem group and (optionally) an explicit irregular yo form. */
export function regularPresentForms(inf: string, group: StemGroup, yo?: string): string[] {
  const type = infType(inf);
  const stem = infStem(inf);
  const boot = bootStem(stem, group);
  const uir = /uir$/.test(inf) && !/guir$/.test(inf); // construir → construyo (not seguir)
  const mono = stem.length <= 1; // ver → veis, dar → dais: one-syllable forms take no accent
  const ends = type === 'ar' ? ['o', 'as', 'a', 'amos', mono ? 'ais' : 'áis', 'an'] : type === 'er' ? ['o', 'es', 'e', 'emos', mono ? 'eis' : 'éis', 'en'] : ['o', 'es', 'e', 'imos', 'ís', 'en'];
  const forms = [0, 1, 2, 3, 4, 5].map((p) => {
    const inBoot = p === 0 || p === 1 || p === 2 || p === 5;
    let s = inBoot ? boot : stem;
    if (uir && inBoot) s = s + 'y';
    if (/guir$/.test(inf) && inBoot && p === 0) s = s.slice(0, -1); // sigo, consigo, distingo
    return s + ends[p];
  });
  const y = yo ?? patternYo(inf, boot);
  if (y && !/guir$/.test(inf)) forms[0] = y;
  return forms;
}

/** Gerund with the systematic irregularities (-ir stem change, vowel stems → -yendo). */
export function regularGerund(inf: string, group: StemGroup): string {
  const irr = baseOf(inf, GERUND_IRREGULAR);
  if (irr) return irr.prefix + GERUND_IRREGULAR[irr.base];
  const type = infType(inf);
  let stem = infStem(inf);
  if (type === 'ar') return stem + 'ando';
  if (type === 'ir') stem = weakIrStem(stem, group); // pidiendo, sintiendo, durmiendo
  if (isVowel(stem.slice(-1)) || /uir$/.test(inf)) return (stem.endsWith('u') && type === 'ir' ? stem : stem) + 'yendo'; // leyendo, construyendo, oyendo
  return stem + 'iendo';
}
export function regularParticiple(inf: string): string {
  const type = infType(inf);
  const stem = infStem(inf);
  if (type === 'ar') return stem + 'ado';
  return isVowel(stem.slice(-1)) ? stem + 'ído' : stem + 'ido'; // leído, oído, caído
}
