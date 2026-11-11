import { TENSES, VERBS, VERB_BY_INF, conjugate, type Tense, type Verb } from '../data/verbs';
import { VOCAB, type VocabItem } from '../data/vocab';
import type { Cefr } from '../types';
import { formOptions, shuffle, tokenize, type Rng } from './exercises';
import { levenshtein, normalize, stripAccents } from './answer';
import { withinLevel } from './platform/level';

// ───────────────────────────────────────────────────────────────
// Homework from a teacher's own material. The text is split into
// sentences, every verb form the app knows (all tenses of the whole
// bank) is spotted, vocabulary from the app's bank is matched, and
// exercises are built from the document's own sentences: gap-fills on
// the verbs, sentence building, dictation, vocabulary meaning, plus the
// teacher's open questions. Pure functions; the UI and the runner use
// them. Nothing is sent to any service.
// ───────────────────────────────────────────────────────────────

export interface FormHit { inf: string; tense: Tense; person: number }
export interface SentenceAnalysis { text: string; tokens: string[]; hits: { index: number; span: number; form: string; analyses: FormHit[] }[] }
export interface VocabHit { item: VocabItem; sentence: number }
export interface MaterialAnalysis {
  words: number;
  sentences: SentenceAnalysis[];
  /** Verbs found, most frequent first, with the tenses they appear in. */
  verbs: { inf: string; en: string; count: number; tenses: Tense[] }[];
  /** How many hits per tense. */
  tenses: { id: Tense; label: string; count: number }[];
  vocab: VocabHit[];
}

export type MaterialItem =
  | { kind: 'cloze'; before: string; after: string; answer: string; options: string[]; inf: string; tense: Tense; person: number; en: string }
  | { kind: 'build'; sentence: string; tiles: string[] }
  | { kind: 'dictation'; sentence: string }
  | { kind: 'vocab'; es: string; en: string; options: string[]; id: string }
  | { kind: 'question'; prompt: string };
export type MaterialKind = MaterialItem['kind'];
export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = { cloze: 'Fill the gap (verbs)', build: 'Build the sentence', dictation: 'Dictation', vocab: 'Vocabulary meaning', question: 'Teacher’s question' };

export interface MaterialSet {
  /** The document's name or the teacher's title. */
  title: string;
  /** The first lines, for the student's context (never the whole document). */
  excerpt: string;
  source: 'pdf' | 'docx' | 'txt' | 'paste';
  words: number;
  items: MaterialItem[];
}

// ── Form index: every surface form the app can conjugate → analyses ──

let FORM_INDEX: Map<string, FormHit[]> | null = null;
/** Built once, lazily: ~20k forms across the bank and the ten tenses, lower-case, accents kept. */
export function formIndex(): Map<string, FormHit[]> {
  if (FORM_INDEX) return FORM_INDEX;
  const idx = new Map<string, FormHit[]>();
  for (const v of VERBS) {
    for (const t of TENSES) {
      for (let p = 0; p < 6; p++) {
        let form = '';
        try { form = conjugate(v, t.id, p, 'spain'); } catch { continue; }
        if (!form) continue;
        const key = form.toLowerCase();
        const list = idx.get(key) ?? [];
        if (!list.some((h) => h.inf === v.inf && h.tense === t.id && h.person === p)) list.push({ inf: v.inf, tense: t.id, person: p });
        idx.set(key, list);
      }
    }
  }
  FORM_INDEX = idx;
  return idx;
}

/** Forms that are usually something else in a text (nouns, prepositions, adverbs), so they are never gap-fill targets. */
export const AMBIGUOUS_FORMS = new Set(['como', 'para', 'nada', 'vino', 'trabajo', 'estudio', 'cambio', 'paso', 'juego', 'pago', 'cuenta', 'cena', 'era', 'sobre', 'entre', 'baja', 'bajo', 'muestra', 'prueba', 'pregunta', 'compra', 'carga', 'firma', 'visita', 'viaje', 'gasto', 'uso', 'ayuda', 'duda', 'lucha', 'forma', 'apoyo', 'medida', 'canto', 'baile', 'cocina', 'camino', 'grito', 'saludo', 'habla', 'puesto', 'hecho', 'dicho', 'visto', 'escrito', 'vuelta', 'vista', 'salida', 'llamada', 'mira', 'lista', 'cola', 'seca', 'parte', 'cruce', 'meta', 'manda', 'ande', 'sea', 'fuera', 'cuesta', 'costa', 'volar', 'deje', 'espera', 'falta', 'fin', 'vale', 've', 'di', 'sal', 'sé', 'ten', 'pon', 'haz', 'ven', 'mando', 'parado', 'quedo', 'resto', 'toca', 'tocar', 'marca', 'plantea', 'entrada', 'subida', 'bajada']);

const SENTENCE_SPLIT = /(?<=[.!?…])\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ0-9])/;
const WORD = /^[a-záéíóúñü]+$/i;

/** Splits text into sentences worth using: 4 to 24 words, not headings, lists or page furniture. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    for (const s of line.split(SENTENCE_SPLIT)) {
      const t = s.trim().replace(/^[•\-–*\d.)]+\s*/, '');
      const words = t.split(/\s+/).filter((w) => /[a-záéíóúñü]/i.test(w));
      if (words.length < 4 || words.length > 24) continue;
      if (t === t.toUpperCase() && words.length < 8) continue; // headings
      if (!/[.!?…]$/.test(t) && words.length < 6) continue; // fragments
      out.push(t);
    }
  }
  return out;
}

const cleanToken = (w: string) => w.replace(/^[¿¡«"“(\[]+|[.,;:!?…»"”)\]]+$/g, '').toLowerCase();

/** Finds every known verb form in a sentence (one- and two-word forms). */
export function analyseSentence(text: string): SentenceAnalysis {
  const idx = formIndex();
  const tokens = tokenize(text);
  const clean = tokens.map(cleanToken);
  const hits: SentenceAnalysis['hits'] = [];
  for (let i = 0; i < clean.length; i++) {
    if (!WORD.test(clean[i])) continue;
    const two = i + 1 < clean.length ? `${clean[i]} ${clean[i + 1]}` : '';
    const h2 = two ? idx.get(two) : undefined;
    if (h2) { hits.push({ index: i, span: 2, form: two, analyses: h2 }); i++; continue; }
    const h1 = idx.get(clean[i]);
    if (h1) hits.push({ index: i, span: 1, form: clean[i], analyses: h1 });
  }
  return { text, tokens, hits };
}

/** Vocabulary bank items whose Spanish appears in the sentence (article-free match on the head words). */
function vocabIn(sentence: SentenceAnalysis, seen: Set<string>): VocabItem[] {
  const words = sentence.tokens.map(cleanToken);
  const joined = ' ' + words.join(' ') + ' ';
  const out: VocabItem[] = [];
  for (const v of VOCAB) {
    if (seen.has(v.id)) continue;
    const head = v.es.replace(/^(el|la|los|las|un|una|unos|unas|a la|a el|al|todo)\s+/i, '').toLowerCase();
    if (head.length < 3) continue;
    if (joined.includes(' ' + head + ' ')) { out.push(v); seen.add(v.id); }
  }
  return out;
}

export function analyseText(text: string): MaterialAnalysis {
  const sentences = splitSentences(text).map(analyseSentence);
  const verbs = new Map<string, { count: number; tenses: Set<Tense> }>();
  const tenses = new Map<Tense, number>();
  for (const s of sentences) {
    for (const h of s.hits) {
      if (AMBIGUOUS_FORMS.has(h.form)) continue;
      const a = h.analyses[0];
      const v = verbs.get(a.inf) ?? { count: 0, tenses: new Set<Tense>() };
      v.count++;
      v.tenses.add(a.tense);
      verbs.set(a.inf, v);
      tenses.set(a.tense, (tenses.get(a.tense) ?? 0) + 1);
    }
  }
  const seen = new Set<string>();
  const vocab: VocabHit[] = [];
  sentences.forEach((s, i) => { for (const item of vocabIn(s, seen)) vocab.push({ item, sentence: i }); });
  const words = text.split(/\s+/).filter((w) => /[a-záéíóúñü]/i.test(w)).length;
  return {
    words,
    sentences,
    verbs: [...verbs.entries()].map(([inf, v]) => ({ inf, en: VERB_BY_INF[inf]?.en ?? '', count: v.count, tenses: [...v.tenses] })).sort((a, b) => b.count - a.count),
    tenses: TENSES.map((t) => ({ id: t.id, label: t.label, count: tenses.get(t.id) ?? 0 })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count),
    vocab,
  };
}

export interface BuildOptions {
  count: number;
  kinds: MaterialKind[];
  /** Only gap-fill forms in these tenses (empty = any). */
  tenses?: Tense[];
  /** The student's level ceiling: verbs above it are not gap-fill targets. */
  maxLevel?: Cefr | null;
  questions?: string[];
  rng?: Rng;
}

const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Builds a varied set from the analysis: gap-fills first (the lesson's verbs), then sentences to build, dictation and vocabulary, then the teacher's questions. */
export function buildMaterialItems(a: MaterialAnalysis, opts: BuildOptions): MaterialItem[] {
  const rng = opts.rng ?? Math.random;
  const kinds = new Set(opts.kinds);
  const wantTenses = new Set(opts.tenses ?? []);
  const items: MaterialItem[] = [];
  const usedSentences = new Set<number>();

  // Gap-fill candidates: one target per sentence, preferring the chosen tenses, verbs with a known level within the ceiling, and unambiguous forms.
  const cloze: MaterialItem[] = [];
  if (kinds.has('cloze')) {
    const cands: { s: number; score: number; hit: SentenceAnalysis['hits'][number]; a: FormHit }[] = [];
    a.sentences.forEach((s, si) => {
      for (const hit of s.hits) {
        if (AMBIGUOUS_FORMS.has(hit.form)) continue;
        const an = hit.analyses.find((x) => wantTenses.size === 0 || wantTenses.has(x.tense)) ?? null;
        if (!an) continue;
        const verb = VERB_BY_INF[an.inf];
        if (!verb || !withinLevel(verb.level, opts.maxLevel ?? null)) continue;
        if (an.tense === 'imperative' && an.person === 0) continue;
        let score = 1;
        if (wantTenses.has(an.tense)) score += 2;
        if (/[áéíóú]/.test(hit.form) || hit.span === 2) score += 1; // clearly verbal
        if (s.tokens.length >= 6 && s.tokens.length <= 16) score += 1;
        if (verb.examples.length) score += 0.5; // the curated verbs have better distractors
        cands.push({ s: si, score, hit, a: an });
      }
    });
    cands.sort((x, y) => y.score - x.score || rng() - 0.5);
    for (const c of cands) {
      if (usedSentences.has(c.s)) continue;
      const verb = VERB_BY_INF[c.a.inf] as Verb;
      const s = a.sentences[c.s];
      const before = s.tokens.slice(0, c.hit.index).join(' ');
      const after = s.tokens.slice(c.hit.index + c.hit.span).join(' ');
      const raw = s.tokens.slice(c.hit.index, c.hit.index + c.hit.span).join(' ');
      const answer = raw.replace(/^[¿¡«"“(\[]+|[.,;:!?…»"”)\]]+$/g, '');
      const lead = raw.match(/^[¿¡«"“(\[]+/)?.[0] ?? '';
      const trail = raw.match(/[.,;:!?…»"”)\]]+$/)?.[0] ?? '';
      const options = shuffle([...new Set([answer, ...formOptions(verb, c.a.tense, c.a.person, 'spain', rng, 4).map((o) => (answer[0] === answer[0].toUpperCase() && answer[0] !== answer[0].toLowerCase() ? capFirst(o) : o)).filter((o) => o.toLowerCase() !== answer.toLowerCase())])].slice(0, 4), rng);
      cloze.push({ kind: 'cloze', before: (before + (lead ? ' ' + lead : '')).trim(), after: (trail + ' ' + after).trim(), answer, options, inf: verb.inf, tense: c.a.tense, person: c.a.person, en: verb.en });
      usedSentences.add(c.s);
      if (cloze.length >= Math.ceil(opts.count * (kinds.size === 1 ? 1 : 0.5))) break;
    }
  }
  items.push(...cloze);

  const others: MaterialItem[] = [];
  const quota = Math.max(1, Math.round((opts.count - cloze.length) / Math.max(1, [...kinds].filter((k) => k !== 'cloze' && k !== 'question').length)));
  // Sentences not used by a gap-fill first, then any sentence: a short text should still give a full set.
  const order = (min: number, max: number) => {
    const fits = (i: number) => a.sentences[i].tokens.length >= min && a.sentences[i].tokens.length <= max;
    const unused = shuffle(a.sentences.map((_, i) => i).filter((i) => !usedSentences.has(i) && fits(i)), rng);
    const used = shuffle(a.sentences.map((_, i) => i).filter((i) => usedSentences.has(i) && fits(i)), rng);
    return [...unused, ...used];
  };
  const taken = new Set<number>();
  if (kinds.has('build')) {
    let n = 0;
    for (const i of order(5, 10)) {
      if (taken.has(i)) continue;
      const s = a.sentences[i];
      others.push({ kind: 'build', sentence: s.text, tiles: shuffle(s.tokens, rng) });
      taken.add(i);
      if (++n >= quota) break;
    }
  }
  if (kinds.has('dictation')) {
    let n = 0;
    for (const i of order(4, 12)) {
      if (taken.has(i)) continue;
      others.push({ kind: 'dictation', sentence: a.sentences[i].text });
      taken.add(i);
      if (++n >= quota) break;
    }
  }
  if (kinds.has('vocab') && a.vocab.length) {
    const pool = shuffle(a.vocab.map((v) => v.item), rng);
    let n = 0;
    for (const v of pool) {
      const distractors = shuffle(VOCAB.filter((x) => x.id !== v.id && x.theme === v.theme).map((x) => x.en), rng).slice(0, 3);
      while (distractors.length < 3) distractors.push(VOCAB[Math.floor(rng() * VOCAB.length)].en);
      others.push({ kind: 'vocab', es: v.es, en: v.en, options: shuffle([v.en, ...new Set(distractors.filter((d) => d !== v.en))].slice(0, 4), rng), id: v.id });
      if (++n >= quota) break;
    }
  }
  items.push(...shuffle(others, rng));
  const trimmed = items.slice(0, opts.count);
  for (const q of opts.questions ?? []) if (q.trim()) trimmed.push({ kind: 'question', prompt: q.trim() });
  return trimmed;
}

/** The student's typed sentence against the original: accents and punctuation forgiven, up to 15% of the letters wrong. */
export function dictationScore(given: string, expected: string): { ok: boolean; similarity: number } {
  const g = stripAccents(normalize(given));
  const e = stripAccents(normalize(expected));
  if (!g) return { ok: false, similarity: 0 };
  const d = levenshtein(g, e);
  const similarity = 1 - d / Math.max(g.length, e.length);
  return { ok: similarity >= 0.85, similarity };
}

/** Human line for an item in result lists and the teacher's answer sheet. */
export function promptFor(item: MaterialItem): string {
  switch (item.kind) {
    case 'cloze': return `${item.before} ___ ${item.after}`.replace(/\s+/g, ' ').trim();
    case 'build': return `Build: ${item.sentence}`;
    case 'dictation': return `Dictation: ${item.sentence}`;
    case 'vocab': return `Meaning of “${item.es}”`;
    case 'question': return `Q: ${item.prompt}`;
  }
}
