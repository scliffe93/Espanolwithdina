import { describe, expect, it } from 'vitest';
import { DemoBackend, type DemoStorage } from '../src/lib/platform/backend';
import { buildWorkspace, DEMO_PEOPLE } from '../src/lib/platform/demoSeed';
import { allowedPacks, allowedVerbs } from '../src/lib/platform/level';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type PlatformData } from '../src/lib/platform/types';
import { BLOCK_BY_ID, CONTENT_BLOCKS, STARTER_BLOCKS, VERB_BLOCKS, WORD_BLOCKS, nextBlock } from '../src/data/blocks';
import { VERBS, VERB_BY_INF } from '../src/data/verbs';
import { VOCAB_PACKS } from '../src/data/vocabPacks';
import { buildSession, pickVerbs } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';

function memoryStorage(data: PlatformData): DemoStorage & { saved: PlatformData } {
  const s = { saved: data, loadData: async () => s.saved, saveData: async (d: PlatformData) => { s.saved = d; }, loadStudentState: async () => null };
  return s;
}
const dina = DEMO_PEOPLE.find((p) => p.id === DEMO_TEACHER_ID)!;
const sam = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.sam)!;

describe('content blocks', () => {
  it('cover every verb and every pack exactly once, in level order', () => {
    const verbs = VERB_BLOCKS.flatMap((b) => b.items);
    expect(verbs.length).toBe(VERBS.length);
    expect(new Set(verbs).size).toBe(VERBS.length);
    for (const b of VERB_BLOCKS) { expect(b.items.length).toBeGreaterThan(0); expect(b.items.length).toBeLessThanOrEqual(12); for (const inf of b.items) expect(VERB_BY_INF[inf].level).toBe(b.level); }
    expect(WORD_BLOCKS.map((b) => b.id)).toEqual(VOCAB_PACKS.map((p) => p.id));
    expect(new Set(CONTENT_BLOCKS.map((b) => b.id)).size).toBe(CONTENT_BLOCKS.length);
    expect(VERB_BLOCKS[0].level).toBe('A1');
    expect(STARTER_BLOCKS.every((id) => BLOCK_BY_ID[id])).toBe(true);
  });
  it('nextBlock walks the sequence and ends with null', () => {
    expect(nextBlock([], 'verbs')!.id).toBe(VERB_BLOCKS[0].id);
    expect(nextBlock([VERB_BLOCKS[0].id], 'verbs')!.id).toBe(VERB_BLOCKS[1].id);
    expect(nextBlock([WORD_BLOCKS[0].id], 'words')!.id).toBe(WORD_BLOCKS[1].id);
    expect(nextBlock(VERB_BLOCKS.map((b) => b.id), 'verbs')).toBeNull();
  });
});

describe('gradual release', () => {
  it('is off unless the teacher turns it on', () => {
    expect(allowedVerbs(null)).toBeNull();
    expect(allowedVerbs({ unlocked: [VERB_BLOCKS[0].id] })).toBeNull();
    expect(allowedPacks({ stepped: false })).toBeNull();
  });
  it('limits practice to released blocks and never leaves it empty', () => {
    const two = allowedVerbs({ stepped: true, unlocked: [VERB_BLOCKS[0].id, VERB_BLOCKS[1].id, WORD_BLOCKS[0].id] })!;
    expect([...two].sort()).toEqual([...VERB_BLOCKS[0].items, ...VERB_BLOCKS[1].items].sort());
    expect([...allowedVerbs({ stepped: true, unlocked: [] })!]).toEqual(VERB_BLOCKS[0].items);
    expect([...allowedPacks({ stepped: true, unlocked: [VERB_BLOCKS[0].id, WORD_BLOCKS[2].id, 'gone'] })!]).toEqual([WORD_BLOCKS[2].id]);
    expect(allowedPacks({ stepped: true })!.size).toBe(0);
  });
  it('sessions only pick released verbs, but keep the teacher\'s explicit ones', () => {
    const state = defaultState();
    const allowed = allowedVerbs({ stepped: true, unlocked: [VERB_BLOCKS[0].id] })!;
    const picked = pickVerbs(state, 'present', 40, Date.now(), null, allowed);
    expect(picked.length).toBe(VERB_BLOCKS[0].items.length);
    expect(picked.every((inf) => allowed.has(inf))).toBe(true);
    for (const ex of buildSession({ state, tense: 'present', allowed, rng: () => 0.42 })) if ('verb' in ex) expect(allowed.has(ex.verb)).toBe(true);
    const outside = VERBS.find((v) => !allowed.has(v.inf))!.inf;
    expect(buildSession({ state, tense: 'present', focus: [outside], allowed, rng: () => 0.42 }).some((ex) => 'verb' in ex && ex.verb === outside)).toBe(true);
  });
  it('the teacher saves released blocks and the student reads them', async () => {
    const store = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, store.saved, store);
    await teacher.saveStudentSettings({ studentId: sam.id, maxLevel: 'A2', note: 'slow and steady', stepped: true, unlocked: [...STARTER_BLOCKS, STARTER_BLOCKS[0]] });
    const mine = await new DemoBackend(sam, store.saved, store).studentSettings(sam.id);
    expect(mine).toMatchObject({ maxLevel: 'A2', note: 'slow and steady', stepped: true, unlocked: STARTER_BLOCKS });
    await teacher.saveStudentSettings({ studentId: sam.id, maxLevel: 'A2', stepped: false, unlocked: STARTER_BLOCKS });
    const off = await teacher.studentSettings(sam.id);
    expect(off!.stepped).toBeUndefined();
    expect(off!.unlocked).toEqual(STARTER_BLOCKS); // kept, so turning it back on resumes where they were
    await expect(new DemoBackend(sam, store.saved, store).saveStudentSettings({ studentId: sam.id, maxLevel: null, stepped: false })).rejects.toThrow();
  });
});
