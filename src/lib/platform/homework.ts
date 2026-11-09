import { useCallback, useRef } from 'react';
import { SCENE_BY_ID } from '../../data/story';
import { VERB_BY_INF } from '../../data/verbs';
import { useRoute, navigate } from '../router';
import { usePlatform } from './context';
import type { ActivityType, Homework, HomeworkActivity, HomeworkKind, HomeworkResult } from './types';

// ───────────────────────────────────────────────────────────────
// Homework ↔ the existing curriculum.
// A homework item launches a real activity with `?hw=<id>` in the URL;
// when that activity finishes it calls submit() from useHomeworkCompletion,
// which records the result and takes the student back to their homework.
// ───────────────────────────────────────────────────────────────

/** The route that performs a homework activity. */
export function homeworkRoute(h: Homework): string {
  const a = h.activity;
  const hw = `hw=${encodeURIComponent(h.id)}`;
  switch (a.kind) {
    case 'verbs': {
      const q = new URLSearchParams();
      if (a.verbs?.length) q.set('focus', a.verbs.join(','));
      q.set('tense', a.tense ?? 'present');
      q.set('start', '1');
      return `verbs?${q.toString()}&${hw}`;
    }
    case 'grammar':
      return a.mode === 'ser-estar' ? `verbs?mode=ser-estar&${hw}` : `verbs?${a.verbs?.length ? `focus=${a.verbs.join(',')}&start=1&` : ''}${hw}`;
    case 'story':
      return `scene/${a.sceneId ?? 'llegada'}?${hw}`;
    case 'listening':
      return `game/${a.game ?? 'order'}?${a.verbs?.length ? `focus=${a.verbs.join(',')}&` : ''}${hw}`;
    case 'vocabulary':
      return a.game ? `game/${a.game}?${hw}` : `review?${hw}`;
    case 'speaking':
    case 'written':
      return `homework/${h.id}`;
  }
}

/** Short, human description of what the student has to do. */
export function describeActivity(a: HomeworkActivity): string {
  switch (a.kind) {
    case 'verbs': return `Verb gym${a.verbs?.length ? `: ${a.verbs.map((v) => VERB_BY_INF[v]?.inf ?? v).join(', ')}` : ''} (${a.tense ?? 'present'})`;
    case 'grammar': return a.mode === 'ser-estar' ? 'Ser vs estar drill' : 'Grammar practice in the verb gym';
    case 'story': return `Story chapter: ${a.sceneId && SCENE_BY_ID[a.sceneId] ? `${SCENE_BY_ID[a.sceneId].titleEs} — ${SCENE_BY_ID[a.sceneId].title}` : a.sceneId ?? ''}`;
    case 'listening': return `Listening game: ${{ metro: 'Metro Rush', order: 'Order Up!', swipe: '¿Sí o no?', serestar: 'Ser o Estar', penalty: 'Penalty Shoot-out', derbi: 'The Derby Quiz', lineup: 'Line-up' }[a.game ?? 'order']}`;
    case 'vocabulary': return a.game ? `Vocabulary game: ${a.game}` : 'Memory review of the vocabulary deck';
    case 'speaking': return 'Speaking challenge (record yourself)';
    case 'written': return `Written homework${a.minWords ? ` (${a.minWords}+ words)` : ''}`;
  }
}

/** Activities Dina can assign, grouped for the assignment form. */
export const HOMEWORK_TEMPLATES: { kind: HomeworkKind; label: string; build: (p: { verbs?: string[]; sceneId?: string; game?: HomeworkActivity['game']; prompt?: string; title?: string }) => HomeworkActivity }[] = [
  { kind: 'verbs', label: 'Verb conjugation (verb gym)', build: (p) => ({ kind: 'verbs', title: p.title ?? `Verb practice: ${p.verbs?.join(', ') || 'app’s choice'}`, verbs: p.verbs ?? [], tense: 'present' }) },
  { kind: 'grammar', label: 'Grammar: ser vs estar drill', build: (p) => ({ kind: 'grammar', title: p.title ?? 'Ser or estar? drill', mode: 'ser-estar', verbs: ['ser', 'estar'] }) },
  { kind: 'vocabulary', label: 'Vocabulary: memory review', build: (p) => ({ kind: 'vocabulary', title: p.title ?? 'Review your vocabulary deck', review: true }) },
  { kind: 'listening', label: 'Listening: Order Up! game', build: (p) => ({ kind: 'listening', title: p.title ?? 'Order Up! — listen and serve', game: 'order' }) },
  { kind: 'listening', label: 'Listening: Line-up (football commentary)', build: (p) => ({ kind: 'listening', title: p.title ?? 'Line-up — listen and order the commentary', game: 'lineup' }) },
  { kind: 'verbs', label: 'Verbs: Penalty Shoot-out game', build: (p) => ({ kind: 'verbs', title: p.title ?? `Penalty Shoot-out${p.verbs?.length ? `: ${p.verbs.join(', ')}` : ''}`, game: 'penalty', verbs: p.verbs ?? [] }) },
  { kind: 'vocabulary', label: 'Vocabulary: The Derby Quiz (football words)', build: (p) => ({ kind: 'vocabulary', title: p.title ?? 'The Derby Quiz — football words of your city', game: 'derbi' }) },
  { kind: 'listening', label: 'Listening: Metro Rush game', build: (p) => ({ kind: 'listening', title: p.title ?? `Metro Rush${p.verbs?.length ? `: ${p.verbs.join(', ')}` : ''}`, game: 'metro', verbs: p.verbs ?? [] }) },
  { kind: 'story', label: 'Storyline chapter', build: (p) => ({ kind: 'story', title: p.title ?? (p.sceneId && SCENE_BY_ID[p.sceneId] ? `${SCENE_BY_ID[p.sceneId].titleEs} chapter` : 'Story chapter'), sceneId: p.sceneId }) },
  { kind: 'speaking', label: 'Speaking challenge', build: (p) => ({ kind: 'speaking', title: p.title ?? 'Speaking challenge', prompt: p.prompt ?? 'Preséntate en español: quién eres, de dónde eres y qué te gusta hacer.' }) },
  { kind: 'written', label: 'Written homework', build: (p) => ({ kind: 'written', title: p.title ?? 'Written homework', prompt: p.prompt ?? 'Escribe 6 frases sobre tu día de hoy.', minWords: 40 }) },
];

/**
 * Used by activity screens: if the current URL carries ?hw=<id>, finishing the
 * activity submits the homework. Safe to call on screens without homework.
 */
export function useHomeworkCompletion() {
  const route = useRoute();
  const { backend, bump } = usePlatform();
  const id = route.params.get('hw');
  const done = useRef<string | null>(null);
  const submit = useCallback(async (result: Omit<HomeworkResult, 'completedAt'> & { completedAt?: string }) => {
    if (!id || !backend || done.current === id) return false;
    done.current = id;
    try {
      await backend.submitHomework(id, { completedAt: new Date().toISOString(), ...result });
      bump();
      return true;
    } catch (e) {
      console.warn('homework submit failed', e);
      done.current = null;
      return false;
    }
  }, [id, backend, bump]);
  /** Records a learning event (chapter, game, practice, review) in the student's activity feed, which the teacher and admin see. No-op for guests, the teacher and homework runs (submit already logs those). */
  const log = useCallback((type: ActivityType, label: string) => {
    if (!backend || backend.actor.role !== 'student' || id) return;
    backend.logActivity(type, label).then(() => bump()).catch(() => undefined);
  }, [backend, id, bump]);
  return { homeworkId: id, isHomework: !!id && !!backend, submit, log, backToHomework: () => navigate('student/homework') };
}
