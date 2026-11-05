import { describe, expect, it } from 'vitest';
import { defaultState, emptyDay, recordAttempt, completeScene } from '../src/lib/state';
import { mergeStates, hasProgress } from '../src/lib/merge';
import { blankProfile } from '../src/data/profileOptions';

const T0 = Date.UTC(2026, 10, 6, 9);

function base() {
  const s = defaultState();
  return { ...s, profile: { ...blankProfile(), name: 'Sam' }, onboardingDone: true, meta: { profileAt: T0 } };
}

describe('mergeStates — combining two devices without losing learning', () => {
  it('unites story progress and keeps the strongest relationships', () => {
    const phone = completeScene(base(), 'llegada', 0.8, { lucia: 5 }, {}, T0);
    const laptop = completeScene(base(), 'piso', 0.9, { carmen: 10 }, {}, T0 + 1000);
    const m = mergeStates(phone, laptop);
    expect(m.story.completedScenes.sort()).toEqual(['llegada', 'piso']);
    expect(m.story.relationships).toMatchObject({ lucia: 15, carmen: 20 });
  });

  it('keeps the most recently reviewed SRS card and never double-counts a day', () => {
    const a = recordAttempt(base(), { key: 'verb:ser|present|0', grade: 2, exerciseType: 'type', verb: 'ser', tense: 'present' }, T0);
    const b = recordAttempt(recordAttempt(base(), { key: 'verb:ser|present|0', grade: 2, exerciseType: 'type', verb: 'ser', tense: 'present' }, T0 + 5000), { key: 'verb:ser|present|0', grade: 0, exerciseType: 'type', verb: 'ser', tense: 'present', mistake: { expected: 'soy', given: 'es', category: 'person-agreement', context: 'x' } }, T0 + 9000);
    const m = mergeStates(a, b);
    expect(m.srs['verb:ser|present|0'].lastSeen).toBe(T0 + 9000);
    const day = Object.values(m.days)[0];
    expect(day.exercisesAttempted).toBe(2); // max(1, 2), not 3
    expect(day.mistakes).toHaveLength(1);
  });

  it('takes the most recently edited profile, settings and teacher', () => {
    const a = { ...base(), teacher: { name: 'Dina', email: 'dina@example.com' }, meta: { profileAt: T0, teacherAt: T0 + 10 } };
    const b = { ...base(), profile: { ...blankProfile(), name: 'Samantha' }, teacher: { name: '', email: '' }, meta: { profileAt: T0 + 20, teacherAt: T0 } };
    const m = mergeStates(a, b);
    expect(m.profile!.name).toBe('Samantha');
    expect(m.teacher.email).toBe('dina@example.com');
  });

  it('is symmetric for learning data', () => {
    const a = completeScene(recordAttempt(base(), { key: 'vocab:llave', grade: 2, exerciseType: 'review-vocab' }, T0), 'llegada', 1, {}, {}, T0);
    const b = completeScene(recordAttempt(base(), { key: 'vocab:piso', grade: 1, exerciseType: 'review-vocab' }, T0 + 1), 'cafe', 1, {}, {}, T0 + 1);
    const ab = mergeStates(a, b), ba = mergeStates(b, a);
    expect(ab.story.completedScenes.sort()).toEqual(ba.story.completedScenes.sort());
    expect(Object.keys(ab.srs).sort()).toEqual(Object.keys(ba.srs).sort());
    expect(ab.days).toEqual(ba.days);
  });

  it('detects whether a device has any real progress', () => {
    expect(hasProgress(defaultState())).toBe(false);
    expect(hasProgress({ ...defaultState(), days: { '2026-11-06': { ...emptyDay('2026-11-06'), activeSeconds: 30 } } })).toBe(true);
  });
});
