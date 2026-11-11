import { describe, expect, it } from 'vitest';
import { DemoBackend, type DemoStorage } from '../src/lib/platform/backend';
import { buildWorkspace, DEMO_PEOPLE } from '../src/lib/platform/demoSeed';
import { markLabel, markedSlips, segmentsWithCorrections, verdictFor } from '../src/lib/platform/marking';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type Homework, type PlatformData } from '../src/lib/platform/types';

function memoryStorage(data: PlatformData): DemoStorage & { saved: PlatformData } {
  const s = { saved: data, loadData: async () => s.saved, saveData: async (d: PlatformData) => { s.saved = d; }, loadStudentState: async () => null };
  return s;
}
const dina = DEMO_PEOPLE.find((p) => p.id === DEMO_TEACHER_ID)!;
const sam = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.sam)!;
const anneka = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.anneka)!;

describe('corrections laid over the student text', () => {
  it('splits the text into plain and highlighted segments, first match wins, case-insensitive fallback', () => {
    const text = 'Hola, estoy de Londres. Me gusta Madrid y estoy contento.';
    const segs = segmentsWithCorrections(text, [{ quote: 'estoy de Londres', correction: 'soy de Londres' }, { quote: 'ME GUSTA', correction: 'me gusta' }, { quote: 'not here', correction: 'x' }]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.correction).map((s) => s.text)).toEqual(['estoy de Londres', 'Me gusta']);
    expect(segmentsWithCorrections('abc', [])).toEqual([{ text: 'abc' }]);
  });
  it('labels a mark from the grade first, then the score', () => {
    expect(markLabel({ at: '', grade: 'B+', score: 0.5 })).toBe('B+');
    expect(markLabel({ at: '', score: 0.724 })).toBe('72%');
    expect(markLabel({ at: '' })).toBeNull();
    expect(markLabel(undefined)).toBeNull();
  });
});

const hw = (over: Partial<Homework>): Homework => ({ id: 'h', teacherId: dina.id, studentId: sam.id, activity: { kind: 'verbs', title: 't' }, instructions: '', assignedAt: '2026-11-09T10:00:00.000Z', dueAt: '2026-11-12T20:00:00.000Z', status: 'reviewed', ...over });

describe('slips for the next debrief', () => {
  it('counts the teacher\'s tagged corrections and the app\'s diagnoses, honouring overrides and the time window', () => {
    const list: Homework[] = [
      hw({ id: 'a', result: { completedAt: '2026-11-10T10:00:00.000Z', items: [{ prompt: 'yo + tener', given: 'teno', expected: 'tengo', correct: false, category: 'irregular-yo' }, { prompt: 'tú + hablar', given: 'habla', expected: 'hablas', correct: false, category: 'person-agreement' }, { prompt: 'él + ser', given: 'es', correct: true }] }, marking: { at: '', items: [{ index: 1, ok: true }] } }),
      hw({ id: 'b', activity: { kind: 'written', title: 'w' }, result: { completedAt: '2026-11-11T10:00:00.000Z', text: 'Yo estoy de Londres y tengo 30 años.' }, marking: { at: '', corrections: [{ quote: 'estoy de Londres', correction: 'soy de Londres', category: 'ser-estar' }, { quote: 'tengo', correction: 'tengo', category: 'ser-estar' }] } }),
      hw({ id: 'old', result: { completedAt: '2026-10-01T10:00:00.000Z', items: [{ prompt: 'x', given: 'y', correct: false, category: 'accents' }] } }),
    ];
    const slips = markedSlips(list, '2026-11-01T00:00:00.000Z');
    expect(slips.map((s) => [s.tag, s.count])).toEqual([['ser-estar', 2], ['irregular-verbs', 1]]); // the overridden item and the old homework do not count
    expect(slips[0].examples[0]).toBe('estoy de Londres → soy de Londres');
    expect(verdictFor(list[0], 1)).toBe(true);
    expect(verdictFor(list[0], 0)).toBe(false);
    expect(verdictFor(list[0], 9)).toBeUndefined();
  });
});

describe('marking in the demo workspace', () => {
  it('the teacher saves a mark, notes and corrections; the student reads them; nobody else', async () => {
    const storage = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 10, 12));
    const [h] = await teacher.assignHomework({ studentIds: [sam.id], activity: { kind: 'written', title: 'Mi semana', prompt: 'Escribe sobre tu semana.', minWords: 20 }, instructions: '', dueAt: '2026-11-12T20:00:00.000Z' });
    const student = new DemoBackend(sam, storage.saved, storage, () => Date.UTC(2026, 10, 11, 12));
    await student.submitHomework(h.id, { completedAt: '2026-11-11T12:00:00.000Z', text: 'Yo estoy de Londres.', summary: '4 words' });
    const teacher2 = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 11, 18));
    const reviewed = await teacher2.reviewHomework(h.id, '¡Buen trabajo!', { score: 0.7, grade: 'B', corrections: [{ quote: 'estoy de Londres', correction: 'soy de Londres', category: 'ser-estar', note: 'origin takes ser' }] });
    expect(reviewed.status).toBe('reviewed');
    expect(reviewed.marking).toMatchObject({ score: 0.7, grade: 'B', at: '2026-11-11T18:00:00.000Z' });
    expect(reviewed.marking?.corrections?.[0].category).toBe('ser-estar');
    const mine = (await new DemoBackend(sam, storage.saved, storage).homework()).find((x) => x.id === h.id)!;
    expect(markLabel(mine.marking)).toBe('B');
    expect((await new DemoBackend(anneka, storage.saved, storage).homework()).some((x) => x.id === h.id)).toBe(false);
    await expect(student.reviewHomework(h.id, 'no', { score: 1 })).rejects.toThrow(/teacher/);
    // Feedback without marking keeps the previous marking.
    const again = await teacher2.reviewHomework(h.id, 'Updated note');
    expect(again.marking?.grade).toBe('B');
  });
});
