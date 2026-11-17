import { describe, expect, it } from 'vitest';
import { adaptPlan, looksLikeClassPlan, reword, stageOf, wordingFor } from '../src/lib/platform/lessonAdapt';
import { layoutPdfItems } from '../src/lib/pdfLayout';

// A classroom plan as the PDF reader gives it: table cells and blanks arrive as tabs.
const PLAN = [
  '# Spanish A1 — Lesson 3: Food and Drink',
  '',
  'CEFR Level:\tA1\tDuration:\t45 Minutes',
  'Learning Objectives:\tOrder a drink politely; name five foods.',
  '',
  '# 1. Key Phrases',
  '',
  'Spanish Expression\tEnglish Meaning\tUsage Note',
  'el pan / el agua\tbread / water\tAgua takes el but is feminine.',
  '¿Qué quieres? — Quiero...\tWhat do you want? — I want...\tQuiero comes from querer.',
  'la cuenta\tthe bill\tAsk with por favor.',
  '',
  '# 2. Lesson Procedure',
  '',
  '0–5 MINS\tStage 1: Warm-Up — Menu Words',
  'Board Setup: Write five words on the board: menú, café, tomate, limón, sal.',
  'Task: Ask learners to read them aloud.',
  '',
  '5–20 MINS\tStage 2: Presentation',
  'Modeling: Say "Quiero un café con leche, por favor." slowly.',
  'Grammar Spotlight: Briefly contrast quiero (I want) and quieres (you want).',
  'Drill: Ask "¿Qué quieres?" around the class.',
  '',
  '40–45 MINS\tStage 3: Wrap-Up',
  'Exit Check: Ask each student "¿Qué quieres beber?" at the door.',
  '',
  '# Student Worksheet',
  '',
  'Nombre (Name): ____________\tFecha (Date): ________',
  '',
  'Exercise A: Match the Word to the Meaning',
  'Write the matching letter.',
  '1. el pan\t[ ___ ]\ta. water',
  '2. el agua\t[ ___ ]\tb. the bill',
  '3. la cuenta\t[ ___ ]\tc. bread',
  '',
  'Exercise B: Complete the Order',
  'Fill in the blanks using the words from the box.',
  'quiero • favor • cuenta • quieres',
  'Camarero: ¿Qué\t?',
  'Ana:\tun café, por\t.',
  'Ana: La\t, por favor.',
  'Camarero: ¡Claro!',
  '',
  'Exercise C: Your Turn',
  'Complete the sentence with your real information.',
  '1. Hoy quiero\t.',
  '',
  'Answer Key (Teacher Reference): Ex A: 1-c, 2-a, 3-b | Ex B: quieres, Quiero, favor, cuenta',
  '',
  'Tarjeta 1 (Card 1)',
  'Nombre: Marta',
  'Pedido: un té',
  'Goal: Order it!',
  '',
  'Tarjeta 2 (Card 2)',
  'Nombre: Luis',
  'Pedido: un zumo',
  'Goal: Order it!',
].join('\n');

describe('building a lesson from a classroom plan', () => {
  const p = adaptPlan(PLAN);
  const of = (type: string) => p.blocks.filter((b) => b.type === type);
  const inStage = (n: number) => p.blocks.filter((b) => stageOf(b.title)?.no === n);
  it('recognises a class plan and leaves an ordinary one to the plain reader', () => {
    expect(looksLikeClassPlan(PLAN)).toBe(true);
    const plain = adaptPlan('El pretérito\n\nCalentamiento\n¿Qué hiciste ayer?\n\nPráctica:\nAyer yo ___ al cine. [fui]\n');
    expect(plain.adapted).toEqual([]); expect(plain.notes).toBe(''); expect(plain.stages).toEqual([]);
    expect(plain.blocks.map((b) => b.type)).toEqual(['question', 'gap']);
  });
  it('reads the title, the level and the timings, and opens with a summary', () => {
    expect(p.title).toBe('Spanish A1 — Lesson 3: Food and Drink');
    expect(p.level).toBe('A1'); expect(p.wording).toBe('en');
    expect(p.minutes).toBe(25);
    expect(p.stages.map((s) => [s.title, s.minutes])).toEqual([['Warm-Up', 5], ['Presentation', 15], ['Wrap-Up', 5]]);
    expect(p.blocks[0]).toMatchObject({ type: 'text', title: 'Lesson summary' });
    expect(p.blocks[0].body).toContain('• Order a drink politely');
    expect(p.blocks[0].body).toContain('2. Presentation · 15 min');
  });
  it('follows the stages in order, every part carrying its stage and minutes', () => {
    const order = p.blocks.map((b) => stageOf(b.title)?.no ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(stageOf(inStage(2)[0].title)).toEqual({ no: 2, of: 3, name: 'Presentation', minutes: 15 });
    expect(inStage(1).length).toBeGreaterThan(0); expect(inStage(3).length).toBeGreaterThan(0);
  });
  it('makes the warm-up words into cards to say aloud', () => {
    expect(inStage(1)[0]).toMatchObject({ type: 'vocab' });
    expect(inStage(1)[0].pairs!.map((x) => x.es)).toEqual(['menú', 'café', 'tomate', 'limón', 'sal']);
  });
  it('turns the phrase table into cards, splitting cells that list several, and keeps the usage notes for the teacher', () => {
    const v = inStage(2).find((b) => b.type === 'vocab')!;
    expect(v.pairs).toEqual([{ es: 'el pan', en: 'bread' }, { es: 'el agua', en: 'water' }, { es: '¿Qué quieres?', en: 'What do you want?' }, { es: 'Quiero...', en: 'I want...' }, { es: 'la cuenta', en: 'the bill' }]);
    expect(p.blocks.every((b) => !/Agua takes el/.test(b.body))).toBe(true);
    expect(p.notes).toMatch(/Agua takes el but is feminine/);
  });
  it('makes a speaking turn of each question, with the words to start the answer', () => {
    expect(inStage(2).some((b) => b.type === 'question' && b.body === '¿Qué quieres?\nStart with: Quiero...')).toBe(true);
    expect(inStage(2).some((b) => b.type === 'question' && /Now you\. Say it about yourself:\nQuiero un café con leche/.test(b.body))).toBe(true);
    expect(inStage(2).some((b) => b.type === 'text' && /^Grammar\nQuiero \(I want\)/.test(b.body))).toBe(true);
  });
  it('makes quick checks from the plan’s own phrases, each with its answer among the options', () => {
    const checks = inStage(2).filter((b) => b.type === 'choice' && /Choose the right reply|What does it mean|How do you say it/.test(b.body));
    expect(checks.length).toBeGreaterThanOrEqual(2);
    for (const c of checks) { expect(c.options).toContain(c.answer); expect(new Set(c.options).size).toBe(c.options!.length); }
    expect(checks.some((c) => c.body === 'Choose the right reply.\n¿Qué quieres?' && c.answer === 'Quiero...')).toBe(true);
  });
  it('turns matching into multiple choice with the answers from the key', () => {
    const a = of('choice').filter((b) => ['el pan', 'el agua', 'la cuenta'].includes(b.body));
    expect(a.map((b) => [b.body, b.answer])).toEqual([['el pan', 'bread'], ['el agua', 'water'], ['la cuenta', 'the bill']]);
    expect(a[0].options).toEqual(['water', 'the bill', 'bread']);
  });
  it('turns blanks with a word box into multiple choice, one part for each blank, then the conversation to read', () => {
    const b = of('choice').filter((x) => /^(Camarero|Ana):/.test(x.body));
    expect(b.map((x) => [x.body, x.answer])).toEqual([
      ['Camarero: ¿Qué ___?', 'quieres'],
      ['Ana: ___ un café, por ….', 'quiero'],
      ['Ana: Quiero un café, por ___.', 'favor'],
      ['Ana: La ___, por favor.', 'cuenta'],
    ]);
    expect(of('text').some((x) => /Read the finished conversation aloud/.test(x.body) && /Camarero: ¿Qué quieres\?/.test(x.body) && /¡Claro!/.test(x.body))).toBe(true);
  });
  it('releases a personal writing task a step at a time and leaves no answer missing', () => {
    const steps = of('question').filter((b) => /Step \d\/2/.test(b.body));
    expect(steps.map((b) => b.body)).toEqual(['Write about yourself. Step 1/2\nHoy quiero ___.', 'Now put it all together and say it aloud. Step 2/2\nHoy quiero ___.']);
    expect(p.needAnswers).toBe(0);
  });
  it('makes rounds for two from the cards and ends with the wrap-up', () => {
    const rounds = of('text').filter((b) => /^Round \d\/\d/.test(b.body));
    expect(rounds.length).toBeGreaterThanOrEqual(1);
    expect(rounds[0].body).toMatch(/You are: Marta, un té/); expect(rounds[0].body).toMatch(/Your teacher is: Luis, un zumo/);
    const lastTwo = p.blocks.slice(-2);
    expect(lastTwo[0].body).toBe('Answer in a full sentence:\n¿Qué quieres beber?');
    expect(lastTwo[1].body).toBe('Write one thing you can say in Spanish now.');
  });
  it('keeps everything written for the teacher out of the lesson', () => {
    expect(p.blocks.every((b) => !/Board Setup|Ask learners|Exit Check|Fecha|_{5,}|Duration/.test(`${b.title} ${b.body}`))).toBe(true);
    expect(p.notes).toMatch(/0–5 min · Warm-Up — Menu Words/);
    expect(p.notes).toMatch(/Duration: 45 Minutes/);
  });
  it('writes the instructions in the wording asked for, and can change it later without touching the Spanish', () => {
    const es = adaptPlan(PLAN, 'Lesson', 'es'), both = adaptPlan(PLAN, 'Lesson', 'both');
    expect(es.blocks[0].title).toBe('Resumen de la clase');
    expect(es.blocks.some((b) => b.body === '¿Qué quieres?\nEmpieza con: Quiero...')).toBe(true);
    expect(both.blocks.some((b) => b.body === '¿Qué quieres?\nEmpieza con: · Start with: Quiero...')).toBe(true);
    const strip = (bs: typeof p.blocks) => bs.map((b) => [b.type, b.title, b.body, b.answer, b.options]);
    expect(strip(reword(p.blocks, 'es'))).toEqual(strip(es.blocks));
    expect(strip(reword(reword(p.blocks, 'both'), 'en'))).toEqual(strip(p.blocks));
    expect(wordingFor('A1')).toBe('en'); expect(wordingFor('A2')).toBe('both'); expect(wordingFor('B1')).toBe('es'); expect(wordingFor(null)).toBe('en');
  });
});

describe('reading the shape of a PDF page', () => {
  const item = (str: string, x: number, y: number, width = str.length * 5, height = 10) => ({ str, transform: [1, 0, 0, 1, x, y], width, height });
  it('joins a table row into one line with a tab between cells, however the cells wrap', () => {
    const lines = layoutPdfItems([
      item('Buenos días / Buenas', 60, 390), item('tardes', 60, 376),
      item('Good morning / Good', 230, 390), item('afternoon', 230, 376),
      item('Note the', 400, 397), item(' ', 440, 397, 4, 0), item('h', 444, 397), item('is silent', 400, 383),
      item('Hola', 60, 340), item(' ', 80, 340, 150, 0), item('Hello', 230, 340),
    ]);
    expect(lines.filter(Boolean)).toEqual(['Buenos días / Buenas tardes\tGood morning / Good afternoon\tNote the h is silent', 'Hola\tHello']);
  });
  it('marks a drawn blank as a tab, keeps a list as separate lines and marks larger type as a heading', () => {
    const lines = layoutPdfItems([
      item('My Lesson', 60, 700, 80, 18),
      item('Carlos:', 60, 600), item(' ', 95, 600, 4, 0), item('Me', 99, 600), item(' ', 110, 600, 130, 0), item('Carlos.', 240, 600),
      item('ayer = yesterday', 60, 580), item('anoche = last night', 60, 566), item('•', 60, 500),
    ]);
    expect(lines.filter(Boolean)).toEqual(['# My Lesson', 'Carlos: Me\tCarlos.', 'ayer = yesterday', 'anoche = last night']);
  });
});
