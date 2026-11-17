import { describe, expect, it } from 'vitest';
import { SYS, bankCandidates, bankOf, boardOf, isSystem, partsOf, withBank, withBoard, withNotes, type Stroke } from '../src/lib/platform/lessonExtras';
import { allowedVerbs } from '../src/lib/platform/level';
import { VERB_BLOCKS } from '../src/data/blocks';
import { cleanPlan, studentView, type LessonBlock } from '../supabase/functions/_shared/lesson';

const parts: LessonBlock[] = [
  { id: 'q1abc', type: 'question', title: '', body: '¿Qué hiciste ayer?' },
  { id: 'v1abc', type: 'vocab', title: '', body: '', pairs: [{ es: 'ayer', en: 'yesterday' }, { es: 'comer', en: 'to eat' }] },
];
const stroke = (n: number, c = 1): Stroke => ({ c, w: 3, pts: Array.from({ length: n }, (_, i) => [i * 7 % 1000, (i * 13) % 600] as [number, number]) });

describe('the extras that travel with a lesson', () => {
  it('keeps a whiteboard of text and pen strokes through the server’s cleaning, exactly', () => {
    const board = { text: 'ir → to go\nfui, fuiste, fue', strokes: [stroke(40), stroke(12, 2)], open: false };
    const { blocks, dropped } = withBoard(parts, board);
    expect(dropped).toBe(0);
    const stored = cleanPlan({ title: 'x', blocks }).blocks; // what the server would keep
    expect(boardOf(stored)).toEqual(board);
    expect(partsOf(stored).map((b) => b.id)).toEqual(['q1abc', 'v1abc']);
    expect(stored.filter(isSystem).every((b) => b.body.length <= 4000)).toBe(true);
  });
  it('spreads a long drawing over several blocks and says when it will not all fit', () => {
    const many = Array.from({ length: 60 }, () => stroke(60));
    const kept = withBoard(parts, { text: '', strokes: many, open: false });
    expect(kept.dropped).toBe(0);
    expect(kept.blocks.filter((b) => b.id.startsWith(SYS.ink)).length).toBeGreaterThan(1);
    expect(boardOf(cleanPlan({ title: 'x', blocks: kept.blocks }).blocks).strokes).toHaveLength(60);
    const tooMany = withBoard(parts, { text: '', strokes: Array.from({ length: 400 }, () => stroke(60)), open: false });
    expect(tooMany.dropped).toBeGreaterThan(0);
    expect(tooMany.blocks.length).toBeLessThanOrEqual(60);
  });
  it('removes the board when it is wiped, and never shows it to the student until it is published', () => {
    const { blocks } = withBoard(parts, { text: 'hola', strokes: [stroke(5)], open: false });
    const plan = { id: 'l', studentId: 's', teacherId: 't', title: 'x', notes: '', date: '', blocks: blocks.map((b) => (isSystem(b) ? b : { ...b, open: true })), live: { on: true, current: null }, createdAt: '', updatedAt: '' };
    expect(studentView(plan, null).blocks.some(isSystem)).toBe(false);
    const published = withBoard(plan.blocks, { ...boardOf(plan.blocks), open: true }).blocks;
    expect(boardOf(studentView({ ...plan, blocks: published }, null).blocks).text).toBe('hola');
    expect(withBoard(blocks, { text: ' ', strokes: [], open: false }).blocks.some(isSystem)).toBe(false);
  });
  it('gives the student a place for notes, once, open from the start', () => {
    const once = withNotes(parts); const twice = withNotes(once);
    expect(once.filter((b) => b.id === SYS.notes)).toHaveLength(1); expect(twice).toHaveLength(once.length);
    expect(once.find((b) => b.id === SYS.notes)).toMatchObject({ type: 'question', open: true });
  });
  it('offers the lesson’s words and verbs for the bank, and banks only what the teacher keeps', () => {
    const withB = withBoard(parts, { text: 'la playa = the beach\nHoy vamos a hablar y vivir', strokes: [], open: false }).blocks;
    const c = bankCandidates(withB);
    expect(c.words).toEqual([{ es: 'ayer', en: 'yesterday' }, { es: 'la playa', en: 'the beach' }]);
    expect(c.verbs.map((v) => v.es).sort()).toEqual(['comer', 'hablar', 'vivir']);
    const banked = withBank(withB, { words: [c.words[1], c.words[1]], verbs: [c.verbs[0]] });
    expect(bankOf(banked)).toEqual({ words: [{ es: 'la playa', en: 'the beach' }], verbs: [c.verbs[0]] });
    expect(bankOf(withBank(banked, { words: [], verbs: [] }))).toEqual({ words: [], verbs: [] });
    expect(partsOf(banked).map((b) => b.id)).toEqual(['q1abc', 'v1abc']);
  });
});

describe('releasing verbs one by one', () => {
  it('adds single verbs to the released blocks', () => {
    const first = VERB_BLOCKS[0], second = VERB_BLOCKS[1];
    const some = second.items.slice(0, 3);
    const allowed = allowedVerbs({ stepped: true, unlocked: [first.id], verbs: some })!;
    for (const v of first.items) expect(allowed.has(v)).toBe(true);
    for (const v of some) expect(allowed.has(v)).toBe(true);
    expect(allowed.has(second.items[5])).toBe(false);
    expect(allowedVerbs({ stepped: false, verbs: some })).toBeNull();
    expect([...allowedVerbs({ stepped: true, unlocked: [], verbs: ['comer'] })!]).toEqual(['comer']);
  });
});
