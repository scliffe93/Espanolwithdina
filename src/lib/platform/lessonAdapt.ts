import { uid } from './backend';
import { planFromText, type ImportedPlan } from './lessonImport';
import type { LessonBlock } from './types';

// ───────────────────────────────────────────────────────────────
// A classroom lesson plan, adapted for the lesson room.
//
// Many plans are written for a teacher in front of a class: a
// table of key phrases, a timed procedure full of instructions to
// the teacher, printable worksheets with an answer key, cut-out
// role-play cards. Read line by line that gives a lesson of plain
// explanations the teacher then has to rework. This reads the plan
// by what each part is for and turns it into things the student
// does on their own screen:
//   • the phrase table        → a word list
//   • a matching exercise     → multiple choice, answers from the key
//   • blanks with a word box  → multiple choice from the box
//   • "write about yourself"  → open questions
//   • questions the teacher is told to ask → speaking prompts
//   • role-play cards         → a role play for two
//   • the procedure itself    → the teacher's own notes
// It follows rules and invents nothing. A plan with none of these
// features is read the plain way (lessonImport.ts).
// ───────────────────────────────────────────────────────────────

export interface AdaptedPlan extends ImportedPlan {
  /** The teacher's own notes: the timed procedure and other lines written for her, never shown to the student. */
  notes: string;
  /** In short sentences, what was done to the plan, for the review. */
  adapted: string[];
}

const bid = () => `b-${uid().slice(0, 8)}`;
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const EXERCISE = /^(?:Exercise|Ejercicio|Activity|Actividad|Task|Tarea|Part|Parte)\s+([A-Z]|\d{1,2})\s*[:.–-]\s*(.*)$/i;
const STAGE = /^(?:(\d{1,3}\s*[–-]\s*\d{1,3})\s*MIN\w*\.?\s*)?(?:Stage|Step|Phase|Etapa|Paso|Fase)\s+(\d{1,2})\s*[:.–-]\s*(.*)$/i;
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

/** Splits a phrase cell and its meaning cell into pairs when they list the same number of items. */
function pairsFrom(es: string, en: string): { es: string; en: string }[] {
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

export function adaptPlan(raw: string, fallbackTitle = 'Lesson'): AdaptedPlan {
  const text = raw.replace(/\r\n?/g, '\n').split(/^[ \t#=*-]*(?:end of (?:the )?lesson|fin de (?:la )?clase)[ \t=*-]*$/im)[0];
  if (!looksLikeClassPlan(text)) { const p = planFromText(raw, fallbackTitle); return { ...p, notes: '', adapted: [] }; }

  const lines = text.split('\n').map((l) => l.replace(/[ ]+$/, ''));
  const blocks: LessonBlock[] = [];
  const last: LessonBlock[] = []; // the wrap-up, kept for the end whatever its place in the document
  const notes: string[] = [];
  const adapted: string[] = [];
  const say = (s: string) => { if (!adapted.includes(s)) adapted.push(s); };
  let title = '';
  let keys: Record<string, string[]> = {};
  for (const l of lines) { const m = l.trim().match(KEY); if (m && /[A-Z0-9]\s*[:.)-]/i.test(m[1])) keys = { ...keys, ...answerKeys(m[1]) }; }
  const asked: string[] = []; // every question the teacher is told to ask, once

  // The document in sections: a heading (larger type, "Exercise A:", "Stage 1:", a role-play card) and its lines.
  type Section = { kind: 'head' | 'exercise' | 'stage' | 'cards'; title: string; id?: string; lines: string[] };
  const sections: Section[] = [{ kind: 'head', title: '', lines: [] }];
  for (const line of lines) {
    const t = line.trim(); const flat = t.replace(/\t/g, ' ');
    if (KEY.test(t)) continue;
    const ex = t.match(EXERCISE), st = flat.match(STAGE);
    if (/^#\s+/.test(t)) { const h = t.replace(/^#\s+/, ''); if (!title) title = h; sections.push({ kind: 'head', title: h, lines: [] }); }
    else if (ex) sections.push({ kind: 'exercise', id: ex[1].toUpperCase(), title: tidy(`${t.split(/[:.–-]/)[0]}: ${ex[2]}`), lines: [] });
    else if (st) sections.push({ kind: 'stage', title: tidy(st[3]), id: st[1] ? st[1].replace(/\s/g, '') : undefined, lines: [] });
    else if (CARD.test(t) && sections[sections.length - 1].kind !== 'cards') sections.push({ kind: 'cards', title: 'Role play', lines: [line] });
    else sections[sections.length - 1].lines.push(line);
  }

  for (const s of sections) {
    const body = s.lines.filter((l) => l.trim());
    if (!body.length && s.kind !== 'stage') continue;

    if (s.kind === 'stage') {
      // Written for the teacher: it goes to her notes. What it tells her to say or ask becomes something on screen.
      const joined: string[] = [];
      for (const l of body) { if (LABEL.test(l.trim()) || !joined.length) joined.push(l.trim()); else joined[joined.length - 1] += ` ${l.trim()}`; }
      notes.push(`${s.id ? `${s.id} min · ` : ''}${s.title}`, ...joined.map((l) => `• ${l}`), '');
      const wrap = /wrap|exit|close|closing|plenary|cierre|despedida|final/i.test(s.title);
      const here: string[] = [];
      for (const l of joined) {
        const m = l.match(LABEL); const label = m?.[1] ?? '', rest = m?.[2] ?? l;
        const board = rest.match(/(?:on the board|en la pizarra)[^:]*:\s*([^.]+?(?:,\s*[^.,]+){2,})\./i);
        if (board) { blocks.push({ id: bid(), type: 'question', title: s.title, body: `Read these aloud. What do you think they mean?\n${tidy(board[1])}` }); say('The warm-up words on the board became a question on screen.'); }
        if (/^grammar|^gram[aá]tica|^language focus/i.test(label)) { blocks.push({ id: bid(), type: 'text', title: label, body: tidy(rest.replace(/^(?:briefly\s+)?(?:contrast|explain|review|introduce|present|show|highlight)\s+/i, '')).replace(/^./, (c) => c.toUpperCase()) }); say('The grammar point became an explanation.'); }
        for (const q of quoted(rest)) {
          if (isQuestion(q)) { if (!here.includes(q)) here.push(q); }
          else if (q.split(' ').length >= 4 && /^model|^present/i.test(label)) { blocks.push({ id: bid(), type: 'text', title: 'Listen and repeat', body: q.replace(/\[[^\]]+\]/g, '…') }); }
        }
      }
      if (wrap && here.length) last.push({ id: bid(), type: 'question', title: s.title, body: `Answer in a full sentence:\n${here.join('\n')}` });
      else for (const q of here) if (!asked.includes(q)) { asked.push(q); blocks.push({ id: bid(), type: 'question', title: 'Speaking', body: q }); }
      if (here.length) say('The questions you are told to ask became speaking prompts.');
      continue;
    }

    if (s.kind === 'cards') {
      const cards: string[][] = []; let cur: string[] | null = null;
      for (const l of body.flatMap((x) => x.split('\t'))) {
        const t = l.trim();
        if (CARD.test(t)) { cur = []; cards.push(cur); continue; }
        const m = t.match(/^([^:]{2,20}):\s*(.+)$/);
        if (cur && m && !/^goal|^objetivo|^meta/i.test(m[1])) cur.push(tidy(m[2]));
      }
      const people = cards.filter((c) => c.length).map((c) => c.join(', '));
      if (people.length >= 2) {
        // For two people: the student takes one identity, the teacher another from a different card.
        const other = people.find((p) => p.split(', ').slice(1).join() !== people[0].split(', ').slice(1).join()) ?? people[1];
        blocks.push({ id: bid(), type: 'text', title: 'Role play', body: `You are: ${people[0]}.\nYour teacher is: ${other}.\nGreet each other and find out who the other person is. Then swap and try another:\n${people.filter((p) => p !== people[0] && p !== other).slice(0, 4).map((p) => `• ${p}`).join('\n')}` });
        if (asked.length) blocks.push({ id: bid(), type: 'question', title: 'Role play: answer as your character', body: asked.slice(0, 3).join('\n') });
        say(`The ${people.length} role-play cards became a role play for the two of you.`);
      }
      continue;
    }

    if (s.kind === 'exercise') {
      const key = keys[s.id ?? ''] ?? [];
      const rows = body.filter((l) => !FORM.test(l.trim()));
      const instruction = rows.length && !BLANK.test(rows[0]) && !/^\s*\d+[.)]/.test(rows[0]) ? rows[0].trim() : '';
      // The instruction may wrap onto a second line.
      let from = instruction ? 1 : 0;
      let hint = instruction;
      while (hint && from < rows.length && !BLANK.test(rows[from]) && !/^\s*\d+[.)]/.test(rows[from]) && !/[•|]/.test(rows[from]) && !/^[^:]{2,20}:\s/.test(rows[from].trim())) { hint += ` ${rows[from].trim()}`; from++; }
      const work = rows.slice(from);

      // Matching: numbered items on one side, lettered answers on the other.
      const items: { n: string; text: string }[] = [], options: { letter: string; text: string }[] = [];
      for (const l of work) for (const cell of l.split('\t').map((c) => c.trim())) {
        const it = cell.match(/^(\d{1,2})[.)]\s+(.+)$/), op = cell.match(/^([a-h])[.)]\s+(.+)$/);
        if (op) options.push({ letter: op[1], text: tidy(op[2]) }); else if (it) items.push({ n: it[1], text: tidy(it[2].replace(/\[\s*_*\s*\]/g, '')) });
      }
      if (items.length >= 2 && options.length >= 2) {
        const want = Object.fromEntries(key.map((k) => k.match(/^(\d{1,2})\s*[-–:.=)]\s*([a-h])$/i)).filter(Boolean).map((m) => [m![1], m![2].toLowerCase()]));
        for (const it of items) blocks.push({ id: bid(), type: 'choice', title: s.title, body: it.text, options: options.slice(0, 6).map((o) => o.text), answer: options.find((o) => o.letter === want[it.n])?.text ?? '' });
        say('The matching exercise became multiple choice, with the answers from your key.');
        continue;
      }

      // A word box: the words to choose from.
      const boxLine = work.find((l) => !BLANK.test(l) && l.split(/\s*[•|]\s*/).filter(Boolean).length >= 3 && l.split(/\s*[•|]\s*/).every((w) => w.trim().split(' ').length <= 3));
      const box = boxLine ? boxLine.split(/\s*[•|]\s*/).map(tidy).filter(Boolean) : [];
      const gapLines = work.filter((l) => l !== boxLine && BLANK.test(l));
      const plain = work.filter((l) => l !== boxLine && !BLANK.test(l));
      if (gapLines.length) {
        const answers = key.filter((k) => !/^\d{1,2}\s*[-–]\s*[a-h]$/i.test(k));
        let n = 0; const done: string[] = [];
        if (!answers.length && !box.length) {
          // Nothing to mark against: the student writes their own answer.
          blocks.push({ id: bid(), type: 'question', title: s.title, body: `${hint ? `${hint.split(/,\s*then\b/i)[0].replace(/\.$/, '')}.\n` : ''}${gapLines.map((l) => withBlanks(l.replace(/^\s*\d{1,2}[.)]\s*/, ''))).join('\n')}` });
          say('The “write about yourself” exercise became an open question.');
        } else {
          for (const l of work.filter((x) => x !== boxLine)) {
            if (!BLANK.test(l)) { done.push(l.trim()); continue; }
            const cells = l.replace(/_{2,}/g, '\t').split('\t').map((c) => c.trim());
            const mine = cells.slice(0, -1).map(() => answers[n++] ?? '');
            // One part for each blank: earlier blanks on the line are filled in, later ones wait their turn.
            const line = (fill: (i: number) => string) => cells.map((c, i) => (i < cells.length - 1 ? `${c} ${fill(i)} ` : c)).join('').replace(/\s+/g, ' ').replace(/\s+([!?.,;:])/g, '$1').replace(/([¡¿])\s+/g, '$1').trim();
            // One part for each blank: earlier blanks on the line are filled in, later ones wait their turn.
            mine.forEach((ans, k) => {
              const sentence = line((i) => (i < k ? mine[i] || '…' : i === k ? '___' : '…'));
              blocks.push(box.length ? { id: bid(), type: 'choice', title: s.title, body: sentence, options: box.slice(0, 6), answer: box.find((w) => w.toLowerCase() === ans.toLowerCase()) ?? '' } : { id: bid(), type: 'gap', title: s.title, body: sentence, answer: ans });
            });
            done.push(line((i) => mine[i] || '___'));
          }
          if (answers.length && done.length >= 3) blocks.push({ id: bid(), type: 'text', title: `${s.title}: read it aloud`, body: `Read the finished conversation aloud together, then swap roles.\n\n${done.join('\n')}` });
          say(box.length ? 'The fill-in-the-blanks exercise became multiple choice from the word box, with the answers from your key.' : 'The fill-in-the-blanks exercise became gap sentences, with the answers from your key.');
        }
        continue;
      }
      // Anything else in an exercise is read the plain way.
      const p = planFromText([s.title, '', ...plain].join('\n'), s.title);
      blocks.push(...p.blocks.map((b) => ({ ...b, title: b.title || s.title })));
      continue;
    }

    // A headed section: a table of phrases, the plan's details, or ordinary text.
    const table = body.filter((l) => l.includes('\t')).map((l) => l.split('\t').map((c) => c.trim()));
    const header = table.find((r) => r.some((c) => /english|ingl[eé]s|meaning|significado|translation/i.test(c)) && r.length >= 2);
    if (header) {
      const esCol = Math.max(0, header.findIndex((c) => /spanish|espa[nñ]ol|expression|phrase|word|palabra|frase/i.test(c)));
      const enCol = header.findIndex((c) => /english|ingl[eé]s|meaning|significado|translation/i.test(c));
      const noteCol = header.findIndex((c, i) => i !== esCol && i !== enCol && /note|usage|pronunciation|nota|uso/i.test(c));
      const rows = table.filter((r) => r !== header && r[esCol] && r[enCol]);
      const pairs = rows.flatMap((r) => pairsFrom(r[esCol], r[enCol]));
      if (pairs.length >= 2) {
        blocks.push({ id: bid(), type: 'vocab', title: s.title.replace(/^\d+[.)]\s*/, ''), body: '', pairs: pairs.slice(0, 40) });
        const tips = noteCol >= 0 ? rows.filter((r) => r[noteCol]).map((r) => `• ${r[esCol]}: ${r[noteCol]}`) : [];
        if (tips.length) blocks.push({ id: bid(), type: 'text', title: 'Pronunciation and usage', body: tips.join('\n') });
        say(`The table of phrases became a word list of ${pairs.length}${tips.length ? ', with its notes as an explanation' : ''}.`);
        continue;
      }
    }
    // "Label: ⇥ value" rows are the plan's details. The aims are for the student too; the rest is for the teacher.
    const rest: string[] = [];
    for (const l of body) {
      const cells = l.split('\t').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2 && cells.length % 2 === 0 && cells.filter((_, i) => i % 2 === 0).every((c) => /:$/.test(c))) {
        for (let i = 0; i < cells.length; i += 2) {
          if (/objective|aim|goal|outcome|objetivo|can do/i.test(cells[i])) blocks.unshift({ id: bid(), type: 'text', title: 'Today’s goals', body: cells[i + 1].split(/;\s*/).map((g) => `• ${g.replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase())}`).join('\n') });
          else notes.push(`${cells[i]} ${cells[i + 1]}`);
        }
      } else if (FORM.test(l.trim())) { /* a name and date line for a printed sheet */ }
      else if (s.title !== title && s.title && /\b(?:teacher|students?|learners?|classmates?|hand ?out|cut along|printable|distribute|worksheet|whiteboard)\b/i.test(l) && !/\?\s*$/.test(l)) notes.push(l.replace(/\t/g, ' ').trim());
      else rest.push(l);
    }
    if (s.title === title || !s.title) notes.unshift(...rest.map((l) => l.replace(/\t/g, ' ').trim()).filter(Boolean), '');
    else if (rest.some((l) => l.trim())) { const p = planFromText([s.title, '', ...rest].join('\n'), s.title); blocks.push(...p.blocks); }
  }
  blocks.push(...last);
  if (notes.length) say('The timed procedure and the lines written for you went into your own notes. Your student never sees them.');

  const kept = blocks.slice(0, 60);
  const counts = { text: 0, question: 0, choice: 0, gap: 0, vocab: 0 } as ImportedPlan['counts'];
  for (const b of kept) counts[b.type]++;
  return { title: (title || fallbackTitle).slice(0, 120), blocks: kept, counts, needAnswers: kept.filter((b) => (b.type === 'gap' || b.type === 'choice') && !b.answer).length, notes: notes.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000), adapted };
}
