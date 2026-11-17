import { uid } from './backend';
import { planFromText, type ImportedPlan } from './lessonImport';
import type { LessonBlock } from './types';
import type { Cefr } from '../../types';

// ───────────────────────────────────────────────────────────────
// A classroom lesson plan, composed into a lesson for two on a screen.
//
// Plans are written for a teacher in front of a class: a table of
// key phrases, a timed procedure of instructions to the teacher,
// printable worksheets with an answer key, cut-out role-play cards.
// This reads the plan for what it asks the learner to DO and builds
// the lesson from that, stage by stage and in the plan's own order:
//   • each timed stage becomes a run of activities sized to its minutes
//   • the phrase table becomes cards to hear, then quick checks
//   • questions the teacher is told to ask become speaking turns,
//     each with the words to start the answer
//   • worksheet exercises go where the procedure uses them, marked
//     from the answer key
//   • a writing task is released a step at a time
//   • role-play cards become rounds for two people
//   • everything written for the teacher (timings, board work,
//     pronunciation notes) goes to her own notes
// It follows rules and invents no Spanish: every phrase the student
// sees comes from the plan. Only the short instructions are added,
// in English, Spanish or both according to the student's level.
// A plan with none of these features is read the plain way.
// ───────────────────────────────────────────────────────────────

/** The language of the instructions: English, Spanish with English beside it, or Spanish alone. */
export type Wording = 'en' | 'both' | 'es';
export const WORDING_LABEL: Record<Wording, string> = { en: 'English', both: 'Spanish with English beside it', es: 'Spanish only' };
/** The wording that suits a level: beginners read English, A2 sees both, B1 and above work in Spanish. */
export const wordingFor = (level: Cefr | null | undefined): Wording => (!level || level === 'A1' ? 'en' : level === 'A2' ? 'both' : 'es');

// Every instruction the builder adds, in both languages. The Spanish is plain and addressed to one person (tú).
const P = {
  summary: ['Lesson summary', 'Resumen de la clase'],
  canDo: ['By the end you can:', 'Al final puedes:'],
  plan: ['How the lesson goes:', 'Así va la clase:'],
  sayAloud: ['Say each word aloud. What do you think it means?', 'Di cada palabra en voz alta. ¿Qué crees que significa?'],
  pickTwo: ['Choose two of the words and write what they mean.', 'Elige dos palabras y escribe qué significan.'],
  keyPhrases: ['Key phrases. Tap a card to hear it, then say it.', 'Frases clave. Toca una tarjeta para escucharla y repítela.'],
  nowYou: ['Now you. Say it about yourself:', 'Ahora tú. Dilo sobre ti:'],
  startWith: ['Start with:', 'Empieza con:'],
  meaning: ['What does it mean?', '¿Qué significa?'],
  inSpanish: ['How do you say it in Spanish?', '¿Cómo se dice en español?'],
  reply: ['Choose the right reply.', 'Elige la respuesta correcta.'],
  readAloud: ['Read the finished conversation aloud with your teacher, then swap roles.', 'Lee la conversación en voz alta con tu profesora y luego cambia de papel.'],
  aboutYou: ['Write about yourself.', 'Escribe sobre ti.'],
  step: ['Step', 'Paso'],
  together: ['Now put it all together and say it aloud.', 'Ahora júntalo todo y dilo en voz alta.'],
  round: ['Round', 'Ronda'],
  youAre: ['You are:', 'Eres:'],
  teacherIs: ['Your teacher is:', 'Tu profesora es:'],
  findOut: ['Greet your teacher and find out who she is.', 'Saluda a tu profesora y descubre quién es.'],
  inCharacter: ['Answer as your character:', 'Responde como tu personaje:'],
  fullSentence: ['Answer in a full sentence:', 'Responde con una frase completa:'],
  oneThing: ['Write one thing you can say in Spanish now.', 'Escribe una cosa que ya sabes decir en español.'],
  grammar: ['Grammar', 'Gramática'],
} as const;
type PhraseKey = keyof typeof P;
const render = (k: PhraseKey, w: Wording) => (w === 'en' ? P[k][0] : w === 'es' ? P[k][1] : `${P[k][1]} · ${P[k][0]}`);

/** Rewrites the instructions of a lesson in another wording. The Spanish of the plan itself is never touched. */
export function reword(blocks: LessonBlock[], to: Wording): LessonBlock[] {
  const forms = (Object.keys(P) as PhraseKey[]).flatMap((k) => (['both', 'en', 'es'] as Wording[]).map((w) => [render(k, w), render(k, to)] as const)).sort((a, b) => b[0].length - a[0].length);
  const swap = (s: string) => {
    // Replace through placeholders so one phrase's replacement is never matched again by another's.
    const done: string[] = [];
    let out = s;
    for (const [from, target] of forms) if (from !== target && out.includes(from)) { out = out.split(from).join(`\u0001${done.length}\u0002`); done.push(target); }
    else if (from === target && out.includes(from)) { out = out.split(from).join(`\u0001${done.length}\u0002`); done.push(target); }
    return out.replace(/\u0001(\d+)\u0002/g, (_, n) => done[Number(n)]);
  };
  return blocks.map((b) => ({ ...b, title: swap(b.title), body: swap(b.body) }));
}

export interface PlanStage { title: string; minutes: number; parts: number }
export interface AdaptedPlan extends ImportedPlan {
  /** The teacher's own notes: the timed procedure and other lines written for her, never shown to the student. */
  notes: string;
  /** In short sentences, what was done to the plan, for the review. */
  adapted: string[];
  /** The level the plan says it is for, when it says. */
  level?: Cefr;
  /** The planned length in minutes, when the plan gives timings. */
  minutes?: number;
  stages: PlanStage[];
  wording: Wording;
}

const bid = () => `b-${uid().slice(0, 8)}`;
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const EXERCISE = /^(?:Exercise|Ejercicio|Activity|Actividad|Task|Tarea|Part|Parte)\s+([A-Z]|\d{1,2})\s*[:.–-]\s*(.*)$/i;
const STAGE = /^(?:(\d{1,3})\s*[–-]\s*(\d{1,3})\s*MIN\w*\.?\s*)?(?:Stage|Step|Phase|Etapa|Paso|Fase)\s+(\d{1,2})\s*[:.–-]\s*(.*)$/i;
const KEY = /^(?:Answer Key|Answers|Key|Respuestas|Soluciones|Clave)\b[^:]*:\s*(.+)$/i;
const CARD = /^(?:Tarjeta|Card|Ficha|Role ?card)\s+(\d{1,2})\b/i;
const FORM = /^(?:Nombre|Name|Fecha|Date|Classmate|Compañer[oa]|Student|Alumn[oa])\b[^:]*(?:\d+\s*)?:.*_{3,}/i;
const LABEL = /^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ &/-]{1,28}(?:\s*\([^)]{1,14}\))?):\s+(.+)$/;
const BLANK = /_{2,}|\t/;

/** Does this text have the features of a class plan with worksheets? */
export function looksLikeClassPlan(text: string): boolean {
  const lines = text.split('\n');
  const hits = [lines.some((l) => EXERCISE.test(l.trim())), lines.some((l) => STAGE.test(l.trim().replace(/\t/g, ' '))), lines.some((l) => KEY.test(l.trim())), lines.filter((l) => l.includes('\t')).length >= 3, lines.filter((l) => CARD.test(l.trim())).length >= 2];
  return hits.filter(Boolean).length >= 2;
}

/** "Ex A: 1-c, 2-d | Ex B: Hola, llamas" → { A: ['1-c', '2-d'], B: ['Hola', 'llamas'] } */
function answerKeys(line: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of line.split(/\s*[|;]\s*|\s{2,}(?=Ex)/)) {
    const m = part.match(/^(?:Ex(?:ercise|ercicio)?\.?|Activity|Part)?\s*([A-Z]|\d{1,2})\s*[:.)-]\s*(.+)$/i);
    if (m) out[m[1].toUpperCase()] = m[2].split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  }
  return out;
}

interface Pair { es: string; en: string }
/** Splits a phrase cell and its meaning cell into pairs when they list the same number of items. */
function pairsFrom(es: string, en: string): Pair[] {
  for (const sep of [/\s+—\s+|\s+–\s+/, /\s+\/\s+/]) {
    const a = es.split(sep).map(tidy).filter(Boolean), b = en.split(sep).map(tidy).filter(Boolean);
    if (a.length > 1 && a.length === b.length) return a.flatMap((x, i) => pairsFrom(x, b[i]));
  }
  return [{ es: tidy(es), en: tidy(en) }];
}

/** A sentence whose blanks were tabs or rules, written with ___ and tidy punctuation. */
function withBlanks(line: string): string {
  return line.replace(/\[\s*_{2,}\s*\]/g, '').replace(/_{2,}/g, '\t').split('\t').map((c) => c.trim()).join(' ___ ')
    .replace(/([¡¿])\s+___/g, '$1___').replace(/___\s+([!?.,;:])/g, '___$1').replace(/\s+/g, ' ').trim();
}
const quoted = (s: string) => [...s.matchAll(/["“”«]([^"“”«»]{3,160})["“”»]/g)].map((m) => tidy(m[1]));
const isQuestion = (s: string) => /¿/.test(s) || /\?\s*$/.test(s);
/** A fixed reorder, so the right answer is not always first and the result is the same every time. */
const turn = <T,>(list: T[], by: number) => list.map((_, i) => list[(i + by) % list.length]);

interface Stage { no: number; title: string; minutes: number; lines: string[]; questions: string[]; models: string[]; grammar: string[]; board: string[]; uses: string[]; wrap: boolean; play: boolean }

export function adaptPlan(raw: string, fallbackTitle = 'Lesson', wording?: Wording): AdaptedPlan {
  const text = raw.replace(/\r\n?/g, '\n').split(/^[ \t#=*-]*(?:end of (?:the )?lesson|fin de (?:la )?clase)[ \t=*-]*$/im)[0];
  if (!looksLikeClassPlan(text)) { const p = planFromText(raw, fallbackTitle); return { ...p, notes: '', adapted: [], stages: [], wording: wording ?? 'en' }; }

  const lines = text.split('\n').map((l) => l.replace(/[ ]+$/, ''));
  const notes: string[] = [];
  const adapted: string[] = [];
  const say = (s: string) => { if (!adapted.includes(s)) adapted.push(s); };
  let title = '';
  let level: Cefr | undefined;
  let keys: Record<string, string[]> = {};
  for (const l of lines) { const m = l.trim().match(KEY); if (m && /[A-Z0-9]\s*[:.)-]/i.test(m[1])) keys = { ...keys, ...answerKeys(m[1]) }; }

  // ── 1. Read the document into what it holds. ──
  type Section = { kind: 'head' | 'exercise' | 'stage' | 'cards'; title: string; id?: string; from?: number; to?: number; lines: string[] };
  const sections: Section[] = [{ kind: 'head', title: '', lines: [] }];
  for (const line of lines) {
    const t = line.trim(); const flat = t.replace(/\t/g, ' ');
    if (KEY.test(t)) continue;
    const ex = t.match(EXERCISE), st = flat.match(STAGE);
    if (/^#\s+/.test(t)) { const h = t.replace(/^#\s+/, ''); if (!title) title = h; sections.push({ kind: 'head', title: h, lines: [] }); }
    else if (ex) sections.push({ kind: 'exercise', id: ex[1].toUpperCase(), title: tidy(`${t.split(/[:.–-]/)[0]}: ${ex[2]}`), lines: [] });
    else if (st) sections.push({ kind: 'stage', title: tidy(st[4]), id: st[3], from: st[1] ? Number(st[1]) : undefined, to: st[2] ? Number(st[2]) : undefined, lines: [] });
    else if (CARD.test(t) && sections[sections.length - 1].kind !== 'cards') sections.push({ kind: 'cards', title: 'Role play', lines: [line] });
    else sections[sections.length - 1].lines.push(line);
  }

  const goals: string[] = [];
  const pairs: Pair[] = [];
  const qa: { q: string; a: string }[] = []; // question and its answer pattern, from rows like "¿…? — Me llamo..."
  const stages: Stage[] = [];
  const cards: string[] = [];
  const exercises: { id: string; title: string; blocks: (w: Wording, label: string) => LessonBlock[] }[] = [];

  for (const s of sections) {
    const body = s.lines.filter((l) => l.trim());

    if (s.kind === 'stage') {
      const joined: string[] = [];
      for (const l of body) { if (LABEL.test(l.trim()) || !joined.length) joined.push(l.trim()); else joined[joined.length - 1] += ` ${l.trim()}`; }
      const minutes = s.from !== undefined && s.to !== undefined ? Math.max(0, s.to - s.from) : 0;
      notes.push(`${minutes ? `${s.from}–${s.to} min · ` : ''}${s.title}`, ...joined.map((l) => `• ${l}`), '');
      const st: Stage = { no: stages.length + 1, title: s.title, minutes, lines: joined, questions: [], models: [], grammar: [], board: [], uses: [], wrap: /wrap|exit|close|closing|plenary|cierre|despedida|final/i.test(s.title), play: /role ?play|mingle|communicative|comunicativ|juego de rol|cards?\b/i.test(`${s.title} ${joined.join(' ')}`) };
      for (const l of joined) {
        const m = l.match(LABEL); const label = m?.[1] ?? '', rest = m?.[2] ?? l;
        const board = rest.match(/(?:on the board|en la pizarra)[^:]*:\s*([^.]+?(?:,\s*[^.,]+){2,})\./i);
        if (board) st.board.push(...board[1].split(/\s*,\s*/).map(tidy).filter(Boolean));
        if (/^grammar|^gram[aá]tica|^language focus/i.test(label)) st.grammar.push(tidy(rest.replace(/^(?:briefly\s+)?(?:contrast|explain|review|introduce|present|show|highlight)\s+/i, '')).replace(/^./, (c) => c.toUpperCase()));
        for (const q of quoted(rest)) { if (isQuestion(q)) { if (!st.questions.includes(q)) st.questions.push(q); } else if (q.split(' ').length >= 4) st.models.push(q.replace(/\[[^\]]+\]/g, '___')); }
        for (const u of rest.matchAll(/Exercises?\s+([A-Z])(?:\s*(?:,|and|&|y)\s*([A-Z]))?(?:\s*(?:,|and|&|y)\s*([A-Z]))?/g)) st.uses.push(...[u[1], u[2], u[3]].filter(Boolean) as string[]);
      }
      stages.push(st);
      continue;
    }

    if (s.kind === 'cards') {
      let cur: string[] | null = null; const all: string[][] = [];
      for (const l of body.flatMap((x) => x.split('\t'))) {
        const t = l.trim();
        if (CARD.test(t)) { cur = []; all.push(cur); continue; }
        const m = t.match(/^([^:]{2,20}):\s*(.+)$/);
        if (cur && m && !/^goal|^objetivo|^meta/i.test(m[1])) cur.push(tidy(m[2]));
      }
      cards.push(...all.filter((c) => c.length).map((c) => c.join(', ')));
      continue;
    }

    if (s.kind === 'exercise') {
      const key = keys[s.id ?? ''] ?? [];
      const rows = body.filter((l) => !FORM.test(l.trim()));
      let from = rows.length && !BLANK.test(rows[0]) && !/^\s*\d+[.)]/.test(rows[0]) ? 1 : 0;
      while (from > 0 && from < rows.length && !BLANK.test(rows[from]) && !/^\s*\d+[.)]/.test(rows[from]) && !/[•|]/.test(rows[from]) && !/^[^:]{2,20}:\s/.test(rows[from].trim())) from++;
      const work = rows.slice(from);

      // Matching: numbered items on one side, lettered answers on the other.
      const items: { n: string; text: string }[] = [], options: { letter: string; text: string }[] = [];
      for (const l of work) for (const cell of l.split('\t').map((c) => c.trim())) {
        const it = cell.match(/^(\d{1,2})[.)]\s+(.+)$/), op = cell.match(/^([a-h])[.)]\s+(.+)$/);
        if (op) options.push({ letter: op[1], text: tidy(op[2]) }); else if (it) items.push({ n: it[1], text: tidy(it[2].replace(/\[\s*_*\s*\]/g, '')) });
      }
      if (items.length >= 2 && options.length >= 2) {
        const want = Object.fromEntries(key.map((k) => k.match(/^(\d{1,2})\s*[-–:.=)]\s*([a-h])$/i)).filter(Boolean).map((m) => [m![1], m![2].toLowerCase()]));
        exercises.push({ id: s.id!, title: s.title, blocks: (_w, label) => items.map((it) => ({ id: bid(), type: 'choice' as const, title: label, body: it.text, options: options.slice(0, 6).map((o) => o.text), answer: options.find((o) => o.letter === want[it.n])?.text ?? '' })) });
        say('The matching exercise became multiple choice, marked from your answer key.');
        continue;
      }

      const boxLine = work.find((l) => !BLANK.test(l) && l.split(/\s*[•|]\s*/).filter(Boolean).length >= 3 && l.split(/\s*[•|]\s*/).every((w) => w.trim().split(' ').length <= 3));
      const box = boxLine ? boxLine.split(/\s*[•|]\s*/).map(tidy).filter(Boolean) : [];
      const gapLines = work.filter((l) => l !== boxLine && BLANK.test(l));
      if (gapLines.length) {
        const answers = key.filter((k) => !/^\d{1,2}\s*[-–]\s*[a-h]$/i.test(k));
        if (!answers.length && !box.length) {
          // Nothing to mark against: the student writes about themselves, one sentence at a time, then says it all.
          const sentences = gapLines.map((l) => withBlanks(l.replace(/^\s*\d{1,2}[.)]\s*/, '')));
          exercises.push({ id: s.id!, title: s.title, blocks: (w, label) => [
            ...sentences.map((sen, i) => ({ id: bid(), type: 'question' as const, title: label, body: `${render('aboutYou', w)} ${render('step', w)} ${i + 1}/${sentences.length + 1}\n${sen}` })),
            { id: bid(), type: 'question' as const, title: label, body: `${render('together', w)} ${render('step', w)} ${sentences.length + 1}/${sentences.length + 1}\n${sentences.join(' ')}` },
          ] });
          say('The writing task is released a step at a time, then put together.');
        } else {
          const made: { sentence: string; answer: string }[] = []; const done: string[] = []; let n = 0;
          for (const l of work.filter((x) => x !== boxLine)) {
            if (!BLANK.test(l)) { done.push(l.trim()); continue; }
            const cells = l.replace(/_{2,}/g, '\t').split('\t').map((c) => c.trim());
            const mine = cells.slice(0, -1).map(() => answers[n++] ?? '');
            const line = (fill: (i: number) => string) => cells.map((c, i) => (i < cells.length - 1 ? `${c} ${fill(i)} ` : c)).join('').replace(/\s+/g, ' ').replace(/\s+([!?.,;:])/g, '$1').replace(/([¡¿])\s+/g, '$1').trim();
            // One part for each blank: earlier blanks on the line are filled in, later ones wait their turn.
            mine.forEach((ans, k) => made.push({ sentence: line((i) => (i < k ? mine[i] || '…' : i === k ? '___' : '…')), answer: ans }));
            done.push(line((i) => mine[i] || '___'));
          }
          exercises.push({ id: s.id!, title: s.title, blocks: (w, label) => [
            ...made.map((g) => (box.length ? { id: bid(), type: 'choice' as const, title: label, body: g.sentence, options: box.slice(0, 6), answer: box.find((x) => x.toLowerCase() === g.answer.toLowerCase()) ?? '' } : { id: bid(), type: 'gap' as const, title: label, body: g.sentence, answer: g.answer })),
            ...(answers.length && done.length >= 3 ? [{ id: bid(), type: 'text' as const, title: label, body: `${render('readAloud', w)}\n\n${done.join('\n')}` }] : []),
          ] });
          say(box.length ? 'The fill-in-the-blanks exercise became multiple choice from the word box, marked from your answer key, and ends with the conversation to read aloud.' : 'The fill-in-the-blanks exercise became gap sentences, marked from your answer key.');
        }
        continue;
      }
      const p = planFromText([s.title, '', ...work].join('\n'), s.title);
      if (p.blocks.length) exercises.push({ id: s.id!, title: s.title, blocks: (_w, label) => p.blocks.map((b) => ({ ...b, id: bid(), title: label })) });
      continue;
    }

    // A headed section: the phrase table, the plan's details, or lines for the teacher.
    const table = body.filter((l) => l.includes('\t')).map((l) => l.split('\t').map((c) => c.trim()));
    const header = table.find((r) => r.some((c) => /english|ingl[eé]s|meaning|significado|translation/i.test(c)) && r.length >= 2);
    if (header) {
      const esCol = Math.max(0, header.findIndex((c) => /spanish|espa[nñ]ol|expression|phrase|word|palabra|frase/i.test(c)));
      const enCol = header.findIndex((c) => /english|ingl[eé]s|meaning|significado|translation/i.test(c));
      const noteCol = header.findIndex((c, i) => i !== esCol && i !== enCol && /note|usage|pronunciation|nota|uso/i.test(c));
      const rows = table.filter((r) => r !== header && r[esCol] && r[enCol]);
      for (const r of rows) {
        const got = pairsFrom(r[esCol], r[enCol]);
        pairs.push(...got);
        if (/\s[—–]\s/.test(r[esCol]) && got.length === 2 && isQuestion(got[0].es)) qa.push({ q: got[0].es, a: got[1].es });
      }
      // Pronunciation and usage notes are for the teacher to say, not for the screen.
      const tips = noteCol >= 0 ? rows.filter((r) => r[noteCol]).map((r) => `• ${r[esCol]}: ${r[noteCol]}`) : [];
      if (tips.length) notes.push('Pronunciation and usage', ...tips, '');
      continue;
    }
    for (const l of body) {
      const cells = l.split('\t').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2 && cells.length % 2 === 0 && cells.filter((_, i) => i % 2 === 0).every((c) => /:$/.test(c))) {
        for (let i = 0; i < cells.length; i += 2) {
          if (/objective|aim|goal|outcome|objetivo|can do/i.test(cells[i])) goals.push(...cells[i + 1].split(/;\s*/).map((g) => g.replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase())));
          else { notes.push(`${cells[i]} ${cells[i + 1]}`); const lv = /level|nivel/i.test(cells[i]) ? cells[i + 1].match(/\b([ABC][12])\b/) : null; if (lv) level = lv[1] as Cefr; }
        }
      } else if (!FORM.test(l.trim())) notes.push(l.replace(/\t/g, ' ').trim());
    }
    notes.push('');
  }

  // ── 2. Compose the lesson, stage by stage, in the chosen wording. ──
  const w: Wording = wording ?? wordingFor(level);
  const T = (k: PhraseKey) => render(k, w);
  const blocks: LessonBlock[] = [];
  const flow: Stage[] = stages.length ? stages : [{ no: 1, title: title || 'Lesson', minutes: 0, lines: [], questions: [], models: [], grammar: [], board: [], uses: [], wrap: false, play: cards.length > 0 }];
  const total = flow.reduce((n, s) => n + s.minutes, 0);
  const short = (t: string) => tidy(t.split(/\s+[—–-]\s+/)[0]).slice(0, 40);
  const label = (s: Stage) => `${s.no}/${flow.length} ${short(s.title)}${s.minutes ? ` · ${s.minutes} min` : ''}`;
  const out: PlanStage[] = [];
  const usedEx = new Set<string>();
  const present = flow.find((s) => /present|model|introduc|input|presentaci/i.test(s.title)) ?? flow.find((s) => s.models.length || s.grammar.length) ?? flow[Math.min(1, flow.length - 1)];
  const practice = flow.find((s) => s.uses.length) ?? flow.find((s) => /practice|pr[aá]ctica|worksheet|controlled/i.test(s.title)) ?? present;
  const play = flow.find((s) => s.play && !s.wrap) ?? flow[flow.length - 1];
  const allQuestions = [...new Set([...qa.map((x) => x.q), ...flow.flatMap((s) => s.questions)])];
  const starter = (q: string) => qa.find((x) => x.q === q)?.a;

  if (goals.length || flow.length > 1) {
    blocks.push({ id: bid(), type: 'text', title: T('summary'), body: [
      ...(goals.length ? [T('canDo'), ...goals.map((g) => `• ${g}`)] : []),
      ...(flow.length > 1 ? ['', T('plan'), ...flow.map((s) => `${s.no}. ${short(s.title)}${s.minutes ? ` · ${s.minutes} min` : ''}`)] : []),
    ].join('\n').trim() });
  }

  for (const s of flow) {
    const at = blocks.length; const L = label(s);
    const push = (b: Omit<LessonBlock, 'id' | 'title'>) => blocks.push({ id: bid(), title: L, ...b } as LessonBlock);

    if (s.board.length) {
      push({ type: 'vocab', body: T('sayAloud'), pairs: s.board.slice(0, 12).map((x) => ({ es: x, en: '' })) });
      push({ type: 'question', body: T('pickTwo') });
      say('The warm-up words on the board became cards to say aloud, with a question.');
    }

    if (s === present) {
      if (pairs.length >= 2) { push({ type: 'vocab', body: T('keyPhrases'), pairs: pairs.slice(0, 40) }); say(`The table of phrases became ${pairs.length} cards to hear and repeat.`); }
      for (const m of s.models.slice(0, 1)) push({ type: 'question', body: `${T('nowYou')}\n${m}` });
      for (const g of s.grammar) push({ type: 'text', body: `${T('grammar')}\n${g}` });
      // Each question the teacher is to ask becomes a speaking turn, with the words to start the answer.
      for (const q of allQuestions.slice(0, 4)) push({ type: 'question', body: `${q}${starter(q) ? `\n${T('startWith')} ${starter(q)}` : ''}` });
      if (allQuestions.length) say('The questions you are told to ask became speaking turns, each with the words to start the answer.');
      // Quick checks made from the plan's own phrases, as many as the stage has time for.
      const room = Math.max(2, Math.min(6, Math.round((s.minutes || 9) / 3)));
      const checks: Omit<LessonBlock, 'id' | 'title'>[] = [];
      qa.forEach((x, i) => { const opts = turn([...new Set([x.a, ...qa.filter((y) => y !== x).map((y) => y.a), ...pairs.filter((p) => !isQuestion(p.es) && !qa.some((y) => y.a === p.es)).map((p) => p.es)])].slice(0, 4), i + 1); if (opts.length >= 3) checks.push({ type: 'choice', body: `${T('reply')}\n${x.q}`, options: opts, answer: x.a }); });
      const plain = pairs.filter((p) => !qa.some((x) => x.q === p.es || x.a === p.es));
      plain.forEach((p, i) => {
        const others = plain.filter((x) => x !== p);
        if (others.length < 2) return;
        const pick = turn(others, i).slice(0, 3);
        checks.push(i % 2 === 0 ? { type: 'choice', body: `${T('meaning')}\n${p.es}`, options: turn([p.en, ...pick.map((x) => x.en)], i + 1), answer: p.en } : { type: 'choice', body: `${T('inSpanish')}\n${p.en}`, options: turn([p.es, ...pick.map((x) => x.es)], i + 2), answer: p.es });
      });
      // Spread them: replies first, then meanings from across the list.
      const chosen = [...checks.filter((c) => c.body.startsWith(T('reply'))), ...checks.filter((c) => !c.body.startsWith(T('reply'))).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / room)) === 0)].slice(0, room);
      chosen.forEach(push);
      if (chosen.length) say(`${chosen.length} quick checks were made from the plan’s own phrases, to fit the time of the stage.`);
    }

    if (s === practice || s.uses.length) {
      const mine = s.uses.length ? exercises.filter((e) => s.uses.includes(e.id)) : [];
      const rest = s === practice ? exercises.filter((e) => !usedEx.has(e.id) && !mine.includes(e) && !flow.some((o) => o !== s && o.uses.includes(e.id))) : [];
      for (const e of [...mine, ...rest]) { if (usedEx.has(e.id)) continue; usedEx.add(e.id); blocks.push(...e.blocks(w, L)); }
    }

    if (s === play && cards.length >= 2) {
      // Rounds for two: the student takes a card, the teacher another from a different one, then they change.
      const rounds = Math.max(2, Math.min(4, Math.floor(cards.length / 2), Math.round((s.minutes || 10) / 5)));
      const tail = (c: string) => c.split(', ').slice(1).join();
      for (let r = 0; r < rounds; r++) {
        const me = cards[(r * 2) % cards.length];
        const her = cards.find((c, i) => i > (r * 2) % cards.length && tail(c) !== tail(me)) ?? cards.find((c) => c !== me && tail(c) !== tail(me)) ?? cards[(r * 2 + 1) % cards.length];
        push({ type: 'text', body: `${T('round')} ${r + 1}/${rounds}\n${T('youAre')} ${me}\n${T('teacherIs')} ${her}\n${T('findOut')}` });
        if (allQuestions.length) push({ type: 'question', body: `${T('inCharacter')} ${T('round')} ${r + 1}/${rounds}\n${allQuestions.slice(0, 3).join('\n')}` });
      }
      say(`The ${cards.length} role-play cards became ${rounds} rounds for the two of you.`);
    }

    if (s.wrap) {
      if (s.questions.length || allQuestions.length) push({ type: 'question', body: `${T('fullSentence')}\n${(s.questions.length ? s.questions : allQuestions).slice(0, 3).join('\n')}` });
      push({ type: 'question', body: T('oneThing') });
    }
    out.push({ title: short(s.title), minutes: s.minutes, parts: blocks.length - at });
  }
  // Exercises no stage called for still belong in the lesson.
  for (const e of exercises) if (!usedEx.has(e.id)) { usedEx.add(e.id); blocks.push(...e.blocks(w, e.title)); }

  if (notes.some((n) => n.trim())) say('The timings, board work and pronunciation notes went into your own notes. Your student never sees them.');
  const kept = blocks.slice(0, 60);
  const counts = { text: 0, question: 0, choice: 0, gap: 0, vocab: 0 } as ImportedPlan['counts'];
  for (const b of kept) counts[b.type]++;
  return {
    title: (title || fallbackTitle).slice(0, 120), blocks: kept, counts, needAnswers: kept.filter((b) => (b.type === 'gap' || b.type === 'choice') && !b.answer).length,
    notes: notes.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000), adapted, level, minutes: total || undefined, stages: out, wording: w,
  };
}

/** The stage a part belongs to, read from its heading ("2/5 Presentation · 14 min"). */
export function stageOf(title: string): { no: number; of: number; name: string; minutes: number } | null {
  const m = title.match(/^(\d{1,2})\/(\d{1,2})\s+(.+?)(?:\s+·\s+(\d{1,3})\s+min)?$/);
  return m ? { no: Number(m[1]), of: Number(m[2]), name: m[3], minutes: m[4] ? Number(m[4]) : 0 } : null;
}
