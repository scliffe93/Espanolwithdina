import { describe, expect, it } from 'vitest';
import { GRAMMAR_DRILLS, GRAMMAR_MODES, type GrammarMode } from '../src/data/grammar';
import { PACK_ITEMS, VOCAB_PACKS } from '../src/data/vocabPacks';
import { VOCAB, VOCAB_BY_ID } from '../src/data/vocab';
import { ASSESSMENT } from '../src/data/assessment';
import { buildSession } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';
import { generatePlan } from '../src/lib/platform/plan';
import { describeActivity, homeworkRoute, HOMEWORK_TEMPLATES } from '../src/lib/platform/homework';
import { CEFR_LEVELS } from '../src/types';

describe('grammar drills', () => {
  it('every item is well formed: answer among unique options, English, reason and level', () => {
    for (const [mode, items] of Object.entries(GRAMMAR_DRILLS)) {
      expect(items.length, mode).toBeGreaterThanOrEqual(16);
      for (const it of items) {
        expect(it.options, `${mode}: ${it.before} ___ ${it.after}`).toContain(it.answer);
        expect(new Set(it.options).size).toBe(it.options.length);
        expect(it.en.length).toBeGreaterThan(5);
        expect(it.why.length).toBeGreaterThan(5);
        expect(CEFR_LEVELS).toContain(it.level);
        expect(it.before.length + it.after.length).toBeGreaterThan(3);
      }
    }
    expect(GRAMMAR_MODES.map((m) => m.id)).toEqual(['ser-estar', 'por-para', 'pret-imp', 'subjunctive', 'conditional']);
  });
  it('builds sessions for each drill within the level ceiling', () => {
    const state = defaultState();
    for (const mode of ['por-para', 'pret-imp', 'subjunctive', 'conditional'] as GrammarMode[]) {
      const ex = buildSession({ state, tense: 'present', mode, length: 12, rng: () => 0.5 });
      expect(ex.length).toBeGreaterThan(0);
      expect(ex.every((e) => e.kind === 'grammar' && e.mode === mode)).toBe(true);
    }
    const a1 = buildSession({ state, tense: 'present', mode: 'conditional', maxLevel: 'A1', rng: () => 0.5 });
    expect(a1).toEqual([]); // nothing at A1 in the if-sentences drill
    const b2 = buildSession({ state, tense: 'present', mode: 'conditional', maxLevel: 'B2', length: 30, rng: () => 0.5 });
    expect(b2.every((e) => e.kind === 'grammar' && e.item.level !== 'C1')).toBe(true);
    expect(buildSession({ state, tense: 'present', mode: 'ser-estar', rng: () => 0.5 }).some((e) => e.kind === 'serEstar')).toBe(true);
  });
  it('is reachable from homework templates, routes and the plan generator', () => {
    const tpl = HOMEWORK_TEMPLATES.filter((t) => t.kind === 'grammar');
    expect(tpl.length).toBe(5);
    const a = tpl[1].build({});
    expect(a.mode).toBe('por-para');
    expect(homeworkRoute({ id: 'x', teacherId: 't', studentId: 's', activity: a, instructions: '', assignedAt: '', dueAt: '', status: 'assigned' })).toBe('verbs?mode=por-para&hw=x');
    expect(describeActivity(a)).toBe('Por vs para drill');
    const plan = generatePlan({ lessonDate: '2026-11-09', covered: { tenses: ['preterite'], verbs: ['ir'], themes: [] }, wentWell: 'ok', toFix: ['prepositions', 'tense-choice'], goals: [], minutesPerDay: 15, planWeek: '2026-11-09' }, null);
    expect(plan.some((p) => p.activity.kind === 'grammar' && p.activity.mode === 'por-para')).toBe(true);
    expect(plan.some((p) => p.activity.kind === 'grammar' && p.activity.mode === 'pret-imp')).toBe(true);
  });
});

describe('word packs', () => {
  it('fifteen packs of ten words from A1 to C2, all registered in the bank', () => {
    expect(VOCAB_PACKS.length).toBe(15);
    for (const level of CEFR_LEVELS) expect(VOCAB_PACKS.some((p) => p.level === level), level).toBe(true);
    for (const p of VOCAB_PACKS) {
      expect(p.ids.length).toBe(10);
      for (const id of p.ids) {
        expect(VOCAB_BY_ID[id], `${p.id}: ${id}`).toBeDefined();
        expect(VOCAB_BY_ID[id].level).toBe(p.level);
        expect(VOCAB_BY_ID[id].es.length).toBeGreaterThan(1);
        expect(VOCAB_BY_ID[id].en.length).toBeGreaterThan(1);
      }
    }
    expect(new Set(PACK_ITEMS.map((i) => i.id)).size).toBe(PACK_ITEMS.length);
    expect(VOCAB.length).toBeGreaterThan(230);
  });
  it('can be assigned as homework and joins the plan when vocabulary needs work', () => {
    const tpl = HOMEWORK_TEMPLATES.find((t) => t.label.includes('word pack'))!;
    const a = tpl.build({ pack: 'b1-tramites' });
    expect(a.pack).toBe('b1-tramites');
    expect(describeActivity(a)).toBe('Word pack: Paperwork and renting (B1)');
    expect(homeworkRoute({ id: 'h', teacherId: 't', studentId: 's', activity: a, instructions: '', assignedAt: '', dueAt: '', status: 'assigned' })).toBe('review?pack=b1-tramites&hw=h');
    const s = defaultState();
    s.profile = { ...(s.profile ?? ({} as never)), city: 'madrid', region: 'spain', interests: [], dailyMinutes: 15, levels: { vocabulary: 'B1', grammar: 'A2', reading: 'A2', listening: 'A2', speaking: 'A1', verbs: 'A2' } } as never;
    const plan = generatePlan({ lessonDate: '2026-11-09', covered: { tenses: ['present'], verbs: ['ir'], themes: [] }, wentWell: 'ok', toFix: ['vocabulary'], goals: [], minutesPerDay: 15, planWeek: '2026-11-09' }, s);
    const packItem = plan.find((p) => p.activity.pack);
    expect(packItem?.activity.pack?.startsWith('b1-')).toBe(true);
  });
});

describe('placement up to C2', () => {
  it('has C1 and C2 questions in every assessed skill', () => {
    for (const skill of ['vocabulary', 'grammar', 'verbs', 'reading', 'listening']) {
      expect(ASSESSMENT.some((q) => q.skill === skill && (q.level === 'C1' || q.level === 'C2')), skill).toBe(true);
    }
    for (const q of ASSESSMENT) expect(q.options[q.answer], q.id).toBeDefined();
  });
});
