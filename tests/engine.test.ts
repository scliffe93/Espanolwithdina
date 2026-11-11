import { describe, expect, it } from 'vitest';
import { checkAnswer, classifyVerbError, normalize, stripAccents } from '../src/lib/answer';
import { VERB_BY_INF } from '../src/data/verbs';
import { newCard, review, mastery } from '../src/lib/srs';
import { scoreAssessment } from '../src/lib/assessmentScore';
import { ASSESSMENT } from '../src/data/assessment';
import { creditFor, timerStatus, IDLE_AFTER_MS } from '../src/lib/timeTracker';
import { acceptedAnswers } from '../src/data/vocab';

describe('answer checking', () => {
  it('ignores case and punctuation but not ñ', () => {
    expect(normalize('¿Hablas?')).toBe('hablas');
    expect(stripAccents('mañana está')).toBe('mañana esta');
    expect(checkAnswer('HABLO', ['hablo'])).toBe('correct');
    expect(checkAnswer('estas', ['estás'])).toBe('accent');
    expect(checkAnswer('ano', ['año'])).toBe('wrong');
    expect(checkAnswer('', ['x'])).toBe('wrong');
  });

  it('accepts vocab without articles and either gender', () => {
    const acc = acceptedAnswers('el vecino / la vecina');
    expect(checkAnswer('vecina', acc)).toBe('correct');
    expect(checkAnswer('el vecino', acc)).toBe('correct');
    expect(checkAnswer('izquierda', acceptedAnswers('a la izquierda'))).toBe('correct');
  });

  it('diagnoses conjugation errors', () => {
    expect(classifyVerbError(VERB_BY_INF.querer, 'present', 0, 'quero')).toBe('stem-change');
    expect(classifyVerbError(VERB_BY_INF.tener, 'present', 0, 'teno')).toBe('irregular-yo');
    expect(classifyVerbError(VERB_BY_INF.hablar, 'present', 0, 'hablas')).toBe('person-agreement');
    expect(classifyVerbError(VERB_BY_INF.estar, 'present', 1, 'estas')).toBe('accents');
    expect(classifyVerbError(VERB_BY_INF.hablar, 'perfect', 0, 'estoy hablado')).toBe('auxiliary');
    expect(classifyVerbError(VERB_BY_INF.dormir, 'present', 2, 'dorme')).toBe('stem-change');
  });
});

describe('spaced repetition', () => {
  it('grows intervals on success and resets on failure', () => {
    const t0 = 1_700_000_000_000;
    let c = newCard('x', t0);
    c = review(c, 2, t0);
    expect(c.intervalDays).toBe(1);
    c = review(c, 2, t0 + 86_400_000);
    expect(c.intervalDays).toBe(3);
    c = review(c, 2, t0 + 4 * 86_400_000);
    expect(c.intervalDays).toBeGreaterThanOrEqual(7);
    expect(mastery(c)).toBe('mastered');
    c = review(c, 0, t0 + 12 * 86_400_000);
    expect(c.intervalDays).toBe(0);
    expect(c.lapses).toBe(1);
  });
});

describe('assessment scoring', () => {
  it('all correct → top levels; none correct → A1', () => {
    const all = Object.fromEntries(ASSESSMENT.map((q) => [q.id, q.answer]));
    expect(scoreAssessment(all).levels.grammar).toBe('C2');
    expect(scoreAssessment(all).levels.vocabulary).toBe('C2');
    expect(scoreAssessment(all).overall).toBe('C2');
    const none = Object.fromEntries(ASSESSMENT.map((q) => [q.id, (q.answer + 1) % q.options.length]));
    const r = scoreAssessment(none);
    expect(r.overall).toBe('A1');
    expect(r.correct).toBe(0);
  });
});

describe('active time tracking', () => {
  const base = { now: 10_000, visible: true, focused: true, lastInteraction: 9_000, mediaActive: false, learningContext: true };
  it('counts only when visible, focused, recently interacted and on a learning screen', () => {
    expect(timerStatus(base)).toBe('active');
    expect(creditFor(9_000, base)).toBe(1_000);
    expect(creditFor(9_000, { ...base, visible: false })).toBe(0);
    expect(creditFor(9_000, { ...base, learningContext: false })).toBe(0);
    expect(creditFor(9_000, { ...base, focused: false })).toBe(0);
    expect(creditFor(9_000, { ...base, now: 9_000 + IDLE_AFTER_MS + 2_000 })).toBe(0);
  });
  it('keeps counting during genuine listening without input', () => {
    const s = { ...base, now: 200_000, lastInteraction: 0, mediaActive: true };
    expect(timerStatus(s)).toBe('listening');
    expect(creditFor(199_000, s)).toBe(1_000);
  });
  it('never credits large gaps (sleep / throttling)', () => {
    expect(creditFor(0, { ...base, now: 60_000, lastInteraction: 59_000 })).toBe(2_000);
  });
});

import { render } from '../src/lib/template';
describe('dialogue templating', () => {
  it('renders gender agreement and names', () => {
    expect(render('¡{g:Bienvenido|Bienvenida}, {name}!', { name: 'Sam', gender: 'f' })).toBe('¡Bienvenida, Sam!');
    expect(render('Estoy {g:cansado|cansada}', { name: 'Sam', gender: 'x' })).toBe('Estoy cansado/a');
    expect(render('Estoy {g:cansado|cansada}', { name: 'Sam', gender: 'x' }, 'speech')).toBe('Estoy cansado');
    expect(render('{g:el nuevo vecino|la nueva vecina}', { name: '', gender: 'x' })).toBe('el nuevo vecino / la nueva vecina');
  });
});
