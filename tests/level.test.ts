import { describe, expect, it } from 'vitest';
import { DemoBackend, type DemoStorage } from '../src/lib/platform/backend';
import { buildWorkspace, DEMO_PEOPLE } from '../src/lib/platform/demoSeed';
import { settingsId, withinLevel } from '../src/lib/platform/level';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type PlatformData } from '../src/lib/platform/types';
import { buildSession, pickVerbs } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';
import { VERBS, VERB_BY_INF } from '../src/data/verbs';

function memoryStorage(data: PlatformData): DemoStorage & { saved: PlatformData } {
  const s = { saved: data, loadData: async () => s.saved, saveData: async (d: PlatformData) => { s.saved = d; }, loadStudentState: async () => null };
  return s;
}
const dina = DEMO_PEOPLE.find((p) => p.id === DEMO_TEACHER_ID)!;
const sam = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.sam)!;
const anneka = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.anneka)!;

describe('level ceiling helpers', () => {
  it('compares CEFR levels and treats no ceiling as open', () => {
    expect(withinLevel('A1', 'A2')).toBe(true);
    expect(withinLevel('B1', 'A2')).toBe(false);
    expect(withinLevel('C2', null)).toBe(true);
    expect(withinLevel('C2', 'C2')).toBe(true);
    expect(settingsId('abc')).toBe('student-abc');
  });
  it('never lets the app pick verbs above the ceiling, but keeps the teacher\'s explicit verbs', () => {
    const state = defaultState();
    const picked = pickVerbs(state, 'present', 40, Date.now(), 'A1');
    expect(picked.length).toBeGreaterThan(5);
    expect(picked.every((inf) => VERB_BY_INF[inf].level === 'A1')).toBe(true);
    expect(VERBS.some((v) => v.level === 'A2')).toBe(true); // the ceiling actually removed something
    const session = buildSession({ state, tense: 'present', maxLevel: 'A1', rng: () => 0.42 });
    for (const ex of session) if ('verb' in ex) expect(VERB_BY_INF[ex.verb].level).toBe('A1');
    const focused = buildSession({ state, tense: 'present', focus: ['conocer'], maxLevel: 'A1', rng: () => 0.42 });
    expect(focused.some((ex) => 'verb' in ex && ex.verb === 'conocer')).toBe(true);
  });
});

describe('student settings in the demo workspace', () => {
  it('the teacher sets a ceiling, the student reads their own, nobody else\'s', async () => {
    const storage = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, storage.saved, storage);
    expect(await teacher.studentSettings(sam.id)).toBeNull();
    const saved = await teacher.saveStudentSettings({ studentId: sam.id, maxLevel: 'A2', note: 'Exam in June ' });
    expect(saved).toMatchObject({ id: settingsId(sam.id), studentId: sam.id, teacherId: dina.id, maxLevel: 'A2', note: 'Exam in June' });
    const again = await teacher.saveStudentSettings({ studentId: sam.id, maxLevel: null });
    expect(again.maxLevel).toBeNull();
    expect(again.note).toBeUndefined();
    expect(storage.saved.students).toHaveLength(1); // one row per student
    const asSam = new DemoBackend(sam, storage.saved, storage);
    expect((await asSam.studentSettings(sam.id))?.maxLevel).toBeNull();
    await expect(asSam.studentSettings(anneka.id)).rejects.toThrow(/own/);
    await expect(asSam.saveStudentSettings({ studentId: sam.id, maxLevel: 'C2' })).rejects.toThrow(/teacher/);
  });
  it('no stretch task is added above the ceiling', async () => {
    const storage = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 10, 12));
    await teacher.saveStudentSettings({ studentId: anneka.id, maxLevel: 'A1' });
    const [hw] = await teacher.assignHomework({ studentIds: [anneka.id], activity: { kind: 'verbs', title: 'Verb gym: tener (present)', verbs: ['tener'], tense: 'present' }, instructions: '', dueAt: '2026-11-12T20:00:00.000Z', plan: { week: '2026-11-09', day: 2 } });
    const student = new DemoBackend(anneka, storage.saved, storage, () => Date.UTC(2026, 10, 11, 12));
    await student.submitHomework(hw.id, { completedAt: '2026-11-11T12:00:00.000Z', score: 1, attempts: 10, correct: 10 });
    expect(storage.saved.homework.some((h) => h.plan?.adaptive === 'stretch')).toBe(false);
    // Without a ceiling the same result earns a stretch task in the next tense.
    await teacher.saveStudentSettings({ studentId: anneka.id, maxLevel: null });
    const teacher2 = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 10, 12));
    const [hw2] = await teacher2.assignHomework({ studentIds: [anneka.id], activity: { kind: 'verbs', title: 'Verb gym: poder (present)', verbs: ['poder'], tense: 'present' }, instructions: '', dueAt: '2026-11-12T20:00:00.000Z', plan: { week: '2026-11-09', day: 3 } });
    const student2 = new DemoBackend(anneka, storage.saved, storage, () => Date.UTC(2026, 10, 11, 12));
    await student2.submitHomework(hw2.id, { completedAt: '2026-11-11T12:00:00.000Z', score: 1, attempts: 10, correct: 10 });
    expect(storage.saved.homework.some((h) => h.plan?.adaptive === 'stretch' && h.activity.tense === 'progressive')).toBe(true);
  });
});
