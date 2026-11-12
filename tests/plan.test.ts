import { describe, expect, it } from 'vitest';
import { followUpFor, type AdaptHomework } from '../supabase/functions/_shared/adapt';
import { dueFor, generatePlan, planWeekFor } from '../src/lib/platform/plan';
import { defaultState } from '../src/lib/state';
import type { LessonDebrief } from '../src/lib/platform/types';

const base: AdaptHomework = { id: 'h1', teacherId: 't', studentId: 's', status: 'submitted', assignedAt: '2026-11-09T10:00:00Z', dueAt: '2026-11-10T20:00:00Z', activity: { kind: 'verbs', title: 'Verb gym: querer, poder (present)', verbs: ['querer', 'poder', 'salir', 'tener'], tense: 'present' }, instructions: '', plan: { week: '2026-11-09', day: 2 } };

describe('adaptive follow-ups', () => {
  it('adds a shorter re-try two days later when the score is under 60%', () => {
    const f = followUpFor({ ...base, result: { score: 0.4, completedAt: '2026-11-10T18:00:00Z' } }, '2026-11-10T18:00:00Z', 'h1-fu');
    expect(f).not.toBeNull();
    expect(f!.plan?.adaptive).toBe('retry');
    expect(f!.activity.verbs).toHaveLength(3);
    expect(f!.dueAt).toBe('2026-11-12T18:00:00.000Z');
    expect(f!.plan?.sourceId).toBe('h1');
  });
  it('adds a stretch task in the next tense when a verb drill scores 90%+', () => {
    const f = followUpFor({ ...base, result: { score: 0.95 } }, '2026-11-10T18:00:00Z', 'x');
    expect(f?.plan?.adaptive).toBe('stretch');
    expect(f?.activity.tense).toBe('progressive');
  });
  it('respects the teacher\'s level ceiling: no stretch above it', () => {
    expect(followUpFor({ ...base, result: { score: 0.95 } }, '2026-11-10T18:00:00Z', 'x', { maxLevel: 'A1' })).toBeNull();
    expect(followUpFor({ ...base, result: { score: 0.95 } }, '2026-11-10T18:00:00Z', 'x', { maxLevel: 'A2' })?.plan?.adaptive).toBe('stretch');
    expect(followUpFor({ ...base, result: { score: 0.4 } }, '2026-11-10T18:00:00Z', 'x', { maxLevel: 'A1' })?.plan?.adaptive).toBe('retry'); // re-tries are never blocked
  });
  it('does nothing for middling scores, non-plan items, re-tries or the last tense', () => {
    expect(followUpFor({ ...base, result: { score: 0.75 } }, '2026-11-10T18:00:00Z', 'x')).toBeNull();
    expect(followUpFor({ ...base, plan: undefined, result: { score: 0.2 } }, '2026-11-10T18:00:00Z', 'x')).toBeNull();
    expect(followUpFor({ ...base, plan: { week: '2026-11-09', adaptive: 'retry' }, result: { score: 0.2 } }, '2026-11-10T18:00:00Z', 'x')).toBeNull();
    expect(followUpFor({ ...base, activity: { ...base.activity, tense: 'future-perfect' }, result: { score: 1 } }, '2026-11-10T18:00:00Z', 'x')).toBeNull();
    expect(followUpFor({ ...base, activity: { ...base.activity, tense: 'subjunctive' }, result: { score: 1 } }, '2026-11-10T18:00:00Z', 'x')?.activity.tense).toBe('pluperfect');
    expect(followUpFor({ ...base, activity: { ...base.activity, tense: 'imperfect-subjunctive' }, result: { score: 1 } }, '2026-11-10T18:00:00Z', 'x')?.activity.tense).toBe('perfect-subjunctive');
    expect(followUpFor({ ...base, activity: { ...base.activity, tense: 'perfect' }, result: { score: 1 } }, '2026-11-10T18:00:00Z', 'x')?.activity.tense).toBe('preterite');
  });
});

describe('weekly plan generator', () => {
  const debrief: LessonDebrief = { lessonDate: '2026-11-09', covered: { tenses: ['present'], verbs: ['querer', 'poder'], themes: ['Food'] }, wentWell: 'Good lesson', toFix: ['ser-estar', 'listening', 'speaking'], goals: ['Use ser/estar in speech'], minutesPerDay: 15, planWeek: '2026-11-09' };
  it('turns the debrief into real activities spread over the week', () => {
    const plan = generatePlan(debrief, null);
    const kinds = plan.map((p) => p.activity.kind);
    expect(kinds).toContain('verbs');
    expect(kinds).toContain('grammar');
    expect(kinds).toContain('listening');
    expect(kinds).toContain('speaking');
    expect(plan.length).toBeLessThanOrEqual(7);
    expect(plan.every((p) => p.day >= 1 && p.day <= 7)).toBe(true);
    expect(plan.find((p) => p.activity.kind === 'verbs')?.activity.verbs).toEqual(['querer', 'poder']);
    expect(plan.find((p) => p.activity.kind === 'speaking')?.activity.prompt).toMatch(/Food/);
  });
  it('uses the student data: next storyline chapter and football interest', () => {
    const s = defaultState();
    s.profile = { ...(s.profile ?? ({} as never)), city: 'madrid', region: 'spain', interests: ['football'], dailyMinutes: 15, levels: { vocabulary: 'A1', grammar: 'A1', reading: 'A1', listening: 'A1', speaking: 'A1', verbs: 'A1' } } as never;
    const plan = generatePlan({ ...debrief, toFix: ['vocabulary', 'listening'] }, s);
    expect(plan.some((p) => p.activity.kind === 'story')).toBe(true);
    expect(plan.some((p) => p.activity.game === 'derbi')).toBe(true);
    expect(plan.some((p) => p.activity.game === 'lineup')).toBe(true);
  });
  it('plans the coming week when the lesson is late in the week', () => {
    expect(planWeekFor(Date.UTC(2026, 10, 10, 12))).toBe('2026-11-09'); // Tuesday → this week
    expect(planWeekFor(Date.UTC(2026, 10, 13, 12))).toBe('2026-11-16'); // Friday → next week
    expect(dueFor('2026-11-09', 3, Date.UTC(2026, 10, 8, 12)).slice(0, 10)).toBe('2026-11-11');
    expect(dueFor('2026-11-09', 1, Date.UTC(2026, 10, 9, 22)).slice(0, 10)).toBe('2026-11-10'); // never already overdue
  });
});
