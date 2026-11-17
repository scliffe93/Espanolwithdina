import { describe, expect, it } from 'vitest';
import { adaptPlan, looksLikeClassPlan } from '../src/lib/platform/lessonAdapt';
import { layoutPdfItems } from '../src/lib/pdfLayout';

// A classroom plan as the PDF reader gives it: table cells and blanks arrive as tabs.
const PLAN = [
  '# Spanish A1 — Lesson 3: Food and Drink',
  '',
  'Level:\tA1\tDuration:\t45 Minutes',
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

describe('adapting a classroom plan', () => {
  const p = adaptPlan(PLAN);
  const of = (type: string) => p.blocks.filter((b) => b.type === type);
  it('recognises a class plan and leaves an ordinary one to the plain reader', () => {
    expect(looksLikeClassPlan(PLAN)).toBe(true);
    const plain = adaptPlan('El pretérito\n\nCalentamiento\n¿Qué hiciste ayer?\n\nPráctica:\nAyer yo ___ al cine. [fui]\n');
    expect(plain.adapted).toEqual([]); expect(plain.notes).toBe('');
    expect(plain.blocks.map((b) => b.type)).toEqual(['question', 'gap']);
  });
  it('takes the title and gives the aims to the student', () => {
    expect(p.title).toBe('Spanish A1 — Lesson 3: Food and Drink');
    expect(p.blocks[0]).toMatchObject({ type: 'text', title: 'Today’s goals' });
    expect(p.blocks[0].body).toContain('• Order a drink politely');
  });
  it('turns the phrase table into a word list, splitting cells that list several', () => {
    const v = of('vocab')[0];
    expect(v.pairs).toEqual([{ es: 'el pan', en: 'bread' }, { es: 'el agua', en: 'water' }, { es: '¿Qué quieres?', en: 'What do you want?' }, { es: 'Quiero...', en: 'I want...' }, { es: 'la cuenta', en: 'the bill' }]);
    expect(of('text').some((b) => b.title === 'Pronunciation and usage' && /Agua takes el/.test(b.body))).toBe(true);
  });
  it('turns matching into multiple choice with the answers from the key', () => {
    const a = of('choice').filter((b) => /Exercise A/.test(b.title));
    expect(a.map((b) => [b.body, b.answer])).toEqual([['el pan', 'bread'], ['el agua', 'water'], ['la cuenta', 'the bill']]);
    expect(a[0].options).toEqual(['water', 'the bill', 'bread']);
  });
  it('turns blanks with a word box into multiple choice, one part for each blank', () => {
    const b = of('choice').filter((x) => /Exercise B/.test(x.title));
    expect(b.map((x) => [x.body, x.answer])).toEqual([
      ['Camarero: ¿Qué ___?', 'quieres'],
      ['Ana: ___ un café, por ….', 'quiero'],
      ['Ana: Quiero un café, por ___.', 'favor'],
      ['Ana: La ___, por favor.', 'cuenta'],
    ]);
    expect(b.every((x) => x.options!.length === 4)).toBe(true);
    expect(of('text').some((x) => /read it aloud/.test(x.title) && /Camarero: ¿Qué quieres\?/.test(x.body) && /¡Claro!/.test(x.body))).toBe(true);
  });
  it('makes an open question of a personal exercise and leaves no answer missing', () => {
    expect(of('question').some((b) => /Exercise C/.test(b.title) && /Hoy quiero ___\./.test(b.body))).toBe(true);
    expect(p.needAnswers).toBe(0);
  });
  it('makes speaking prompts, a warm-up and a grammar note from the procedure, and keeps the procedure for the teacher', () => {
    expect(of('question').some((b) => b.title === 'Speaking' && b.body === '¿Qué quieres?')).toBe(true);
    expect(of('question').some((b) => /menú, café, tomate, limón, sal/.test(b.body))).toBe(true);
    expect(of('text').some((b) => b.title === 'Grammar Spotlight' && /^Quiero \(I want\)/.test(b.body))).toBe(true);
    expect(of('text').some((b) => b.title === 'Listen and repeat' && /Quiero un café con leche/.test(b.body))).toBe(true);
    expect(p.notes).toMatch(/0–5 min · Warm-Up — Menu Words/);
    expect(p.notes).toMatch(/Duration: 45 Minutes/);
    expect(p.blocks.every((b) => !/Board Setup|Ask learners|Exit Check/.test(b.body))).toBe(true);
    expect(p.blocks[p.blocks.length - 1]).toMatchObject({ type: 'question', title: 'Wrap-Up' });
  });
  it('makes a role play for two from the cards and drops the name-and-date line', () => {
    const r = of('text').find((b) => b.title === 'Role play')!;
    expect(r.body).toMatch(/You are: Marta, un té\./); expect(r.body).toMatch(/Your teacher is: Luis, un zumo\./);
    expect(p.blocks.every((b) => !/Fecha|_{5,}/.test(b.body))).toBe(true);
    expect(p.adapted.length).toBeGreaterThanOrEqual(6);
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
