import { describe, expect, it } from 'vitest';
import { describeImport, planFromText } from '../src/lib/platform/lessonImport';

// A lesson made from a teacher's own lesson plan: the document's shape decides the parts. Nothing is invented.
const PLAN = `El pretérito: ir y ser

Calentamiento
¿Qué hiciste el fin de semana?
¿Fuiste a algún sitio nuevo?

EXPLICACIÓN
Ir and ser have the same forms in the preterite.
The rest of the sentence tells you which verb it is.
- Fui al mercado = I went
- Fue un día genial = it was

Práctica:
1. Ayer yo ___ (ir) al mercado. [fui]
2. La película ___ (ser) muy buena. (answer: fue)
3. Nosotros ____ (ir) a la playa.
4. Ellos ___ (ser) muy amables.
Answers: fuimos, fueron

¿Ir o ser?
El sábado fuimos a la playa.
a) ir *
b) ser

Vocabulario
ayer = yesterday
anoche = last night
la semana pasada - last week

Para terminar
Escribe tres frases sobre tus últimas vacaciones.
`;

describe('a lesson from a lesson plan', () => {
  const p = planFromText(PLAN, 'file');
  it('takes the title and makes a part for each thing in the plan, in order', () => {
    expect(p.title).toBe('El pretérito: ir y ser');
    expect(p.blocks.map((b) => b.type)).toEqual(['question', 'question', 'text', 'vocab', 'gap', 'gap', 'gap', 'gap', 'choice', 'vocab', 'text']);
    expect(describeImport(p)).toBe('11 parts: 2 explanations, 2 open questions, 4 gap sentences, 1 multiple-choice question, 2 word lists.');
  });
  it('reads headings, including capitals and a trailing colon', () => {
    expect(p.blocks[0].title).toBe('Calentamiento');
    expect(p.blocks[2].title).toBe('Explicación');
    expect(p.blocks[4].title).toBe('Práctica');
    expect(p.blocks[10]).toMatchObject({ title: 'Para terminar', type: 'text' });
    // Phrases with their meaning, listed under an explanation, become a small word list of their own.
    expect(p.blocks[3]).toMatchObject({ type: 'vocab', title: 'Explicación', pairs: [{ es: 'Fui al mercado', en: 'I went' }, { es: 'Fue un día genial', en: 'it was' }] });
  });
  it('finds the answers to gap sentences however they were written', () => {
    const gaps = p.blocks.filter((b) => b.type === 'gap');
    expect(gaps.map((g) => g.answer)).toEqual(['fui', 'fue', 'fuimos', 'fueron']);
    expect(gaps[0].body).toBe('Ayer yo ___ (ir) al mercado.');
    expect(gaps[2].body).toBe('Nosotros ____ (ir) a la playa.');
    expect(p.needAnswers).toBe(0);
  });
  it('makes multiple choice from lettered options and a word list from pairs', () => {
    const choice = p.blocks.find((b) => b.type === 'choice')!;
    expect(choice).toMatchObject({ body: 'El sábado fuimos a la playa.', options: ['ir', 'ser'], answer: 'ir' });
    expect(choice.title).toBe('¿Ir o ser?');
    expect(p.blocks.find((b) => b.type === 'vocab' && b.title === 'Vocabulario')!.pairs).toEqual([{ es: 'ayer', en: 'yesterday' }, { es: 'anoche', en: 'last night' }, { es: 'la semana pasada', en: 'last week' }]);
  });
  it('keeps plain prose as it is, and says when answers are missing', () => {
    const prose = planFromText('Hoy hablamos del fin de semana.\nPrimero leemos el texto juntos.\n\nDespués: Ayer yo ___ al cine.');
    expect(prose.blocks.map((b) => b.type)).toEqual(['text', 'gap']);
    expect(prose.needAnswers).toBe(1);
    expect(prose.title).toBe('Hoy hablamos del fin de semana.');
    expect(planFromText('', 'My plan')).toMatchObject({ title: 'My plan', blocks: [] });
  });
  it('never makes more than forty parts', () => {
    expect(planFromText(Array.from({ length: 200 }, (_, i) => `¿Pregunta ${i}?`).join('\n')).blocks.length).toBe(40);
  });
});
