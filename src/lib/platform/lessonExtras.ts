// The extras that travel with a lesson: the whiteboard, the student's own notes, and the words and verbs the
// teacher banks for the student afterwards. They are kept as blocks of the lesson with reserved ids ("sys-…"), so
// they are saved, shared and shown with it, and need nothing new on the server. They are never listed as parts.
import type { LessonBlock } from './types';
import { VERB_BY_INF } from '../../data/verbs';
import { AMBIGUOUS_FORMS, formIndex } from '../material';
import { VOCAB, acceptedAnswers, vocabKey } from '../../data/vocab';
import type { StudentSettings } from './types';
import { allowedVerbs } from './level';
import { VERB_BLOCKS } from '../../data/blocks';

export const SYS = { board: 'sys-board', ink: 'sys-ink-', notes: 'sys-notes', words: 'sys-words', verbs: 'sys-verbs', summary: 'sys-summary' } as const;
export const isSystem = (b: { id: string }) => b.id.startsWith('sys-');
/** The teaching parts of a lesson: everything except the extras. */
export const partsOf = <T extends { id: string }>(blocks: T[]): T[] => blocks.filter((b) => !isSystem(b));

/** One pen stroke: a colour, a width and its points on a 1000 × 600 board. */
export interface Stroke { c: number; w: number; pts: [number, number][] }
export interface Board { text: string; strokes: Stroke[]; open: boolean }
export const BOARD_W = 1000, BOARD_H = 600;
const INK_ROOM = 3800; // characters of strokes one block may hold
const MAX_INK_BLOCKS = 10;

const packStroke = (s: Stroke) => `${s.c}${s.w}:${s.pts.map(([x, y]) => `${Math.round(x).toString(36)}.${Math.round(y).toString(36)}`).join(' ')}`;
function unpackStroke(t: string): Stroke | null {
  const m = t.match(/^(\d)(\d):(.+)$/); if (!m) return null;
  const pts = m[3].split(' ').map((p) => p.split('.').map((n) => parseInt(n, 36)) as [number, number]).filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)));
  return pts.length ? { c: Number(m[1]), w: Number(m[2]), pts } : null;
}

/** The whiteboard of a lesson, read back from its blocks. */
export function boardOf(blocks: LessonBlock[]): Board {
  const b = blocks.find((x) => x.id === SYS.board);
  const strokes = blocks.filter((x) => x.id.startsWith(SYS.ink)).sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true })).flatMap((x) => x.body.split('\n')).map(unpackStroke).filter((s): s is Stroke => !!s);
  return { text: b?.body ?? '', strokes, open: !!b?.open };
}

/** The lesson with its whiteboard replaced. Returns how many strokes did not fit, so the screen can say so. */
export function withBoard(blocks: LessonBlock[], board: Board): { blocks: LessonBlock[]; dropped: number } {
  const rest = blocks.filter((x) => x.id !== SYS.board && !x.id.startsWith(SYS.ink));
  const packed = board.strokes.map(packStroke);
  const pages: string[] = []; let cur = ''; let dropped = 0;
  for (const s of packed) {
    if (s.length > INK_ROOM) { dropped++; continue; }
    if (cur && cur.length + 1 + s.length > INK_ROOM) { pages.push(cur); cur = s; } else cur = cur ? `${cur}\n${s}` : s;
  }
  if (cur) pages.push(cur);
  if (pages.length > MAX_INK_BLOCKS) { dropped += pages.slice(MAX_INK_BLOCKS).join('\n').split('\n').length; pages.length = MAX_INK_BLOCKS; }
  const empty = !board.text.trim() && pages.length === 0;
  const extra: LessonBlock[] = empty ? [] : [
    { id: SYS.board, type: 'text', title: 'Pizarra · Whiteboard', body: board.text.slice(0, 3900), ...(board.open ? { open: true } : {}) },
    ...pages.map((body, i) => ({ id: `${SYS.ink}${i + 1}`, type: 'text' as const, title: 'ink', body, ...(board.open ? { open: true } : {}) })),
  ];
  return { blocks: [...rest, ...extra], dropped };
}

/** The lesson with a place for the student's own notes (added once, open to them from the start). */
export function withNotes(blocks: LessonBlock[]): LessonBlock[] {
  return blocks.some((b) => b.id === SYS.notes) ? blocks : [...blocks, { id: SYS.notes, type: 'question', title: 'Mis apuntes · My notes', body: '', open: true }];
}

export interface BankItem { es: string; en: string }
/** The words and verbs the teacher has banked from this lesson. */
export function bankOf(blocks: LessonBlock[]): { words: BankItem[]; verbs: BankItem[] } {
  const pairs = (id: string) => (blocks.find((b) => b.id === id)?.pairs ?? []).filter((p) => p.es.trim());
  return { words: pairs(SYS.words), verbs: pairs(SYS.verbs) };
}
export function withBank(blocks: LessonBlock[], bank: { words: BankItem[]; verbs: BankItem[] }): LessonBlock[] {
  const rest = blocks.filter((b) => b.id !== SYS.words && b.id !== SYS.verbs);
  const clean = (l: BankItem[]) => l.map((p) => ({ es: p.es.trim(), en: p.en.trim() })).filter((p, i, a) => p.es && a.findIndex((x) => x.es.toLowerCase() === p.es.toLowerCase()) === i).slice(0, 40);
  const words = clean(bank.words), verbs = clean(bank.verbs);
  return [...rest,
    ...(words.length ? [{ id: SYS.words, type: 'vocab' as const, title: 'Banco de palabras · Word bank', body: '', pairs: words, open: true }] : []),
    ...(verbs.length ? [{ id: SYS.verbs, type: 'vocab' as const, title: 'Banco de verbos · Verb bank', body: '', pairs: verbs, open: true }] : []),
  ];
}

/**
 * What a lesson offers to release to the student: its word-list pairs, the "word = meaning" lines written on the
 * whiteboard or in the notes, and any verb the app knows that was used there, in whatever form ("fuimos" offers ir).
 * `notes` is the teacher's notes and, when she has them, the student's. Nothing is released until she ticks it.
 */
export function bankCandidates(blocks: LessonBlock[], notes: string[] = []): { words: BankItem[]; verbs: BankItem[] } {
  const written = [boardOf(blocks).text, ...notes].filter(Boolean).join('\n');
  const fromWriting = written.split('\n').map((l) => l.replace(/^\s*[•\-*]\s*/, '').match(/^\s*(.{1,48}?)\s*(?:=|→|–|—)\s*(.{1,70})\s*$/)).filter(Boolean).map((m) => ({ es: m![1].trim(), en: m![2].trim() }));
  const fromParts = partsOf(blocks).filter((b) => b.type === 'vocab').flatMap((b) => b.pairs ?? []).filter((p) => p.es.trim() && p.en.trim());
  const all = [...fromParts, ...fromWriting].filter((p, i, a) => a.findIndex((x) => x.es.toLowerCase() === p.es.toLowerCase()) === i);
  const bare = (s: string) => s.toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, '').replace(/[¿?¡!.,;:…]/g, '').trim();
  const verbNames = new Set<string>();
  for (const p of all) if (VERB_BY_INF[bare(p.es)]) verbNames.add(bare(p.es));
  // Verbs used in the writing, as infinitives or in a conjugated form. Words that only look like a verb form
  // ("como", "para", "una") are left out, and so is anything short enough to be a coincidence.
  const index = formIndex();
  for (const w of written.toLowerCase().split(/[^a-záéíóúñü]+/)) {
    if (w.length < 3) continue;
    if (VERB_BY_INF[w]) { verbNames.add(w); continue; }
    if (LIKE_GUSTAR[w] && VERB_BY_INF[LIKE_GUSTAR[w]]) { verbNames.add(LIKE_GUSTAR[w]); continue; }
    if (w.length < 4 || AMBIGUOUS_FORMS.has(w) || NOT_VERBS.has(w)) continue;
    const hits = index.get(w); if (!hits) continue;
    const infs = [...new Set(hits.map((h) => h.inf))];
    if (infs.length <= 2) for (const inf of infs) verbNames.add(inf); // "fui" is ir and ser: offer both
  }
  const verbs = [...verbNames].sort().map((v) => ({ es: v, en: VERB_BY_INF[v].en.split(' (')[0] }));
  return { words: all.filter((p) => !verbNames.has(bare(p.es))), verbs };
}
/** Verbs used mostly in the third person ("me gusta", "me duele"), which the form index may not carry. */
const LIKE_GUSTAR: Record<string, string> = { gusta: 'gustar', gustan: 'gustar', gustó: 'gustar', gustaba: 'gustar', gustaría: 'gustar', encanta: 'encantar', encantan: 'encantar', interesa: 'interesar', interesan: 'interesar', duele: 'doler', duelen: 'doler', importa: 'importar', parece: 'parecer' };
const NOT_VERBS = new Set(['una', 'unas', 'unos', 'este', 'esta', 'estas', 'estos', 'casa', 'casas', 'cocina', 'camino', 'traje', 'cuento', 'calle', 'habla', 'vista', 'visto', 'dicho', 'hecho', 'puesto', 'vuelta', 'ayuda', 'compra', 'visita', 'llamada', 'salida', 'entrada', 'comida', 'bebida', 'vida', 'nombre', 'siento', 'vaya', 'mira', 'oye', 'venga', 'toma', 'anda', 'dale']);

/** The teacher's summary of the lesson, published to the student when the lesson ends. */
export const summaryOf = (blocks: LessonBlock[]): string => blocks.find((b) => b.id === SYS.summary && b.open)?.body ?? '';
export function withSummary(blocks: LessonBlock[], text: string): LessonBlock[] {
  const rest = blocks.filter((b) => b.id !== SYS.summary);
  // A prompt the teacher left unfilled ("What went well:") is not sent.
  const body = text.split('\n').filter((l) => !/^[^:]{3,40}:\s*$/.test(l.trim())).join('\n').trim();
  return body ? [...rest, { id: SYS.summary, type: 'text', title: 'Resumen · Lesson summary', body: body.slice(0, 3900), open: true }] : rest;
}

/**
 * A first draft of the summary, from what the lesson held and how it went: what was covered, the words and verbs,
 * and (for one student) how many answers were right. The teacher reads it, changes it and decides whether to send it.
 */
export function draftSummary(blocks: LessonBlock[], answers?: Record<string, { correct?: boolean }>): string {
  const parts = partsOf(blocks);
  const stages = [...new Set(parts.map((b) => b.title.match(/^\d{1,2}\/\d{1,2}\s+(.+?)(?:\s+·\s+\d+\s+min)?$/)?.[1]).filter(Boolean))] as string[];
  const words = [...new Set(parts.filter((b) => b.type === 'vocab').flatMap((b) => b.pairs ?? []).map((p) => p.es.trim()).filter(Boolean))].slice(0, 12);
  const bank = bankOf(blocks);
  const marked = parts.filter((b) => b.type === 'gap' || b.type === 'choice');
  const answered = marked.filter((b) => answers?.[b.id]);
  const right = answered.filter((b) => answers?.[b.id]?.correct === true).length;
  const lines = [
    stages.length ? `Today we worked through: ${stages.join(', ')}.` : `Today we worked through ${parts.length} part${parts.length === 1 ? '' : 's'}.`,
    words.length ? `Words and phrases: ${words.join(', ')}.` : '',
    bank.verbs.length ? `Verbs to keep: ${bank.verbs.map((v) => v.es).join(', ')}.` : '',
    answers && answered.length ? `You answered ${answered.length} task${answered.length === 1 ? '' : 's'} and got ${right} right.` : '',
    'What went well: ',
    'To work on before next time: ',
  ];
  return lines.filter(Boolean).join('\n');
}

/** The banked verbs the app can release into a student's verb gym (the ones it knows). */
export const releasableVerbs = (verbs: BankItem[]): string[] => [...new Set(verbs.map((v) => v.es.trim().toLowerCase()).filter((v) => !!VERB_BY_INF[v]))];

/** The slice of a student's settings that a release touches, and how to save it. */
export interface ReleaseTarget {
  studentSettings(studentId: string): Promise<StudentSettings | null>;
  saveStudentSettings(input: { studentId: string; maxLevel: StudentSettings['maxLevel']; note?: string; stepped?: boolean; unlocked?: string[]; verified?: StudentSettings['verified']; notYet?: StudentSettings['notYet']; sentence?: number; verbs?: string[] }): Promise<StudentSettings>;
}
/**
 * Releases verbs into each student's account. A student on gradual release only practises the verbs their teacher
 * has released, so the chosen ones are added to that list; everything else in their settings is carried over.
 * A student who is not on gradual release already has every verb, so nothing changes for them.
 * Returns how many students had verbs added.
 */
export async function releaseVerbsTo(backend: ReleaseTarget, studentIds: string[], verbs: BankItem[]): Promise<number> {
  const infs = releasableVerbs(verbs); if (!infs.length) return 0;
  let changed = 0;
  for (const studentId of [...new Set(studentIds)]) {
    const s = await backend.studentSettings(studentId);
    if (!s?.stepped) continue;
    const have = allowedVerbs(s) ?? new Set<string>(); const add = infs.filter((v) => !have.has(v)); if (!add.length) continue;
    // A student with nothing released yet practises the first block by default: keep it when single verbs arrive.
    const hasVerbBlock = (s.unlocked ?? []).some((id) => VERB_BLOCKS.some((b) => b.id === id));
    const unlocked = hasVerbBlock || (s.verbs ?? []).length ? s.unlocked : [...(s.unlocked ?? []), VERB_BLOCKS[0].id];
    await backend.saveStudentSettings({ studentId, maxLevel: s.maxLevel, note: s.note, stepped: s.stepped, unlocked, verified: s.verified, notYet: s.notYet, sentence: s.sentence, verbs: [...(s.verbs ?? []), ...add] });
    changed++;
  }
  return changed;
}
/** The app's own vocabulary cards that match banked words, so they can go into the student's memory deck. */
export function deckKeysFor(words: BankItem[]): string[] {
  const bare = (x: string) => x.toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, '').replace(/[¿?¡!.,;:…]/g, '').trim();
  const want = new Set(words.map((w) => bare(w.es)).filter(Boolean));
  const out: string[] = [];
  for (const v of VOCAB) if (acceptedAnswers(v.es).some((a) => want.has(bare(a)))) out.push(vocabKey(v.id));
  return out;
}
