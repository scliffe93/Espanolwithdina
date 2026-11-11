import { describe, expect, it } from 'vitest';
import { AMBIGUOUS_FORMS, analyseText, buildMaterialItems, dictationScore, formIndex, promptFor, splitSentences } from '../src/lib/material';

const TEXT = `Mi semana en Madrid

El lunes fui al mercado con mi vecina Carmen. Compramos fruta, pan y un poco de queso.
Por la tarde trabajé en casa y después cené con mis amigos en un bar de Lavapiés.
El martes no pude salir porque llovía mucho. Leí un libro y escuché música toda la tarde.
Ahora vivo en un piso pequeño cerca del metro. Me gusta mucho el barrio.
• Lista de la compra
MADRID 2026
¿Quieres venir a Madrid el año que viene? Creo que te gustará.`;

describe('sentences and verb forms', () => {
  it('splits sentences and drops headings, bullets and fragments', () => {
    const s = splitSentences(TEXT);
    expect(s[0]).toBe('El lunes fui al mercado con mi vecina Carmen.');
    expect(s.some((x) => /Lista de la compra/.test(x))).toBe(false);
    expect(s.some((x) => x === 'MADRID 2026')).toBe(false);
    expect(s.some((x) => x.startsWith('¿Quieres venir'))).toBe(true);
    expect(s.length).toBeGreaterThanOrEqual(8);
  });
  it('indexes every tense of the bank and finds forms, including two-word ones', () => {
    const idx = formIndex();
    expect(idx.get('fui')?.map((h) => h.inf).sort()).toEqual(['ir', 'ser']);
    expect(idx.get('compramos')?.some((h) => h.inf === 'comprar' && (h.tense === 'present' || h.tense === 'preterite'))).toBe(true);
    expect(idx.get('he hablado')?.[0]).toMatchObject({ inf: 'hablar', tense: 'perfect', person: 0 });
    expect(idx.get('mantuvo')?.[0]).toMatchObject({ inf: 'mantener', tense: 'preterite', person: 2 });
    expect(idx.get('llovía')?.[0]).toMatchObject({ inf: 'llover', tense: 'imperfect' });
    expect(idx.size).toBeGreaterThan(15000);
  });
  it('analyses the text: verbs, tenses and vocabulary', () => {
    const a = analyseText(TEXT);
    expect(a.words).toBeGreaterThan(60);
    const infs = a.verbs.map((v) => v.inf);
    expect(infs).toEqual(expect.arrayContaining(['comprar', 'trabajar', 'cenar', 'poder', 'llover', 'leer', 'escuchar', 'vivir', 'querer', 'creer']));
    expect(infs.includes('ir') || infs.includes('ser')).toBe(true); // fui is both
    expect(a.sentences[0].hits[0].analyses.map((h) => h.inf).sort()).toEqual(['ir', 'ser']);
    expect(a.tenses.map((t) => t.id)).toEqual(expect.arrayContaining(['preterite', 'imperfect', 'present', 'future']));
    expect(a.vocab.some((v) => v.item.id === 'mercado' || /mercado|barrio|metro|piso/.test(v.item.es))).toBe(true);
    expect(AMBIGUOUS_FORMS.has('como')).toBe(true);
  });
});

describe('exercise building', () => {
  it('builds gap-fills on the document\'s own sentences with the answer among the options', () => {
    const a = analyseText(TEXT);
    const items = buildMaterialItems(a, { count: 8, kinds: ['cloze'], tenses: ['preterite'], rng: () => 0.3 });
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const it of items) {
      expect(it.kind).toBe('cloze');
      if (it.kind !== 'cloze') continue;
      expect(it.tense).toBe('preterite');
      expect(it.options).toContain(it.answer);
      expect(new Set(it.options).size).toBe(it.options.length);
      expect(it.options.length).toBeGreaterThanOrEqual(2);
      expect(promptFor(it)).toContain('___');
      expect(`${it.before} ${it.answer} ${it.after}`.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(10);
    }
    const sentences = new Set(items.map((i) => promptFor(i)));
    expect(sentences.size).toBe(items.length); // one gap per sentence
  });
  it('mixes kinds, respects the count and appends the teacher\'s questions', () => {
    const a = analyseText(TEXT);
    const items = buildMaterialItems(a, { count: 10, kinds: ['cloze', 'build', 'dictation', 'vocab'], questions: ['¿Qué compró el lunes?', ' '], rng: () => 0.42 });
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds.has('cloze') && kinds.has('build') && kinds.has('dictation')).toBe(true);
    expect(items.filter((i) => i.kind !== 'question').length).toBeLessThanOrEqual(10);
    expect(items[items.length - 1]).toEqual({ kind: 'question', prompt: '¿Qué compró el lunes?' });
    const build = items.find((i) => i.kind === 'build');
    if (build && build.kind === 'build') expect([...build.tiles].sort()).toEqual(build.sentence.split(/\s+/).sort());
  });
  it('keeps gap-fill verbs within the student\'s level ceiling', () => {
    const a = analyseText('Ayer mantuvimos la calma y hablamos con el director. Luego comimos juntos.');
    const items = buildMaterialItems(a, { count: 5, kinds: ['cloze'], maxLevel: 'A1', rng: () => 0.1 });
    expect(items.every((i) => i.kind === 'cloze' && i.inf !== 'mantener')).toBe(true);
    expect(items.some((i) => i.kind === 'cloze' && (i.inf === 'hablar' || i.inf === 'comer'))).toBe(true);
  });
  it('scores dictation leniently on accents and punctuation', () => {
    expect(dictationScore('el lunes fui al mercado con mi vecina carmen', 'El lunes fui al mercado con mi vecina Carmen.').ok).toBe(true);
    expect(dictationScore('el lunes fui al mercado', 'El lunes fui al mercado con mi vecina Carmen.').ok).toBe(false);
    expect(dictationScore('', 'x').ok).toBe(false);
  });
});
