import type { AppState } from '../types';
import { SCENE_BY_ID } from '../data/story';

const doneChapter = (s: AppState, ch: number) => s.story.completedScenes.some((id) => SCENE_BY_ID[id]?.chapter === ch);
import { allVerbMastery, currentStreak, thisWeek, totalActiveSeconds } from './analytics';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: 'plane' | 'key' | 'cup' | 'heart' | 'mic' | 'flame' | 'book' | 'brain' | 'star' | 'clock' | 'bow';
  check: (s: AppState) => boolean;
}

const allDays = (s: AppState) => Object.values(s.days);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'arrived', title: '¡Ya estoy aquí!', description: 'Completed your arrival in a new city.', icon: 'plane', check: (s) => doneChapter(s, 1) },
  { id: 'keys', title: 'Las llaves', description: 'Got the keys to your new home.', icon: 'key', check: (s) => doneChapter(s, 2) },
  { id: 'regular', title: 'Un café, como siempre', description: 'Ordered like a local and made a friend.', icon: 'cup', check: (s) => doneChapter(s, 3) },
  { id: 'nomad', title: 'Trotamundos', description: 'Completed a chapter in two different cities.', icon: 'plane', check: (s) => new Set(s.story.completedScenes.map((id) => SCENE_BY_ID[id]?.city).filter(Boolean)).size >= 2 },
  { id: 'arcade', title: 'Rey del arcade', description: 'Scored 1,000+ in any arcade game.', icon: 'star', check: (s) => Object.values(s.games ?? {}).some((g) => g.best >= 1000) },
  { id: 'polite', title: 'Muy educado', description: 'Chose usted with an older neighbour.', icon: 'bow', check: (s) => s.story.flags.register === 'usted' },
  { id: 'friend', title: 'Primera amistad', description: 'Reached a strong relationship (60+) with a character.', icon: 'heart', check: (s) => Object.values(s.story.relationships).some((r) => r >= 60) },
  { id: 'first-words', title: 'Primeras palabras', description: 'Answered 25 exercises correctly.', icon: 'star', check: (s) => allDays(s).reduce((a, d) => a + d.exercisesCorrect, 0) >= 25 },
  { id: 'verbs-5', title: 'Cinco verbos', description: 'Reached "familiar" on 5 verbs in the present tense.', icon: 'book', check: (s) => allVerbMastery(s, 'present', s.profile?.region).filter((v) => v.level === 'familiar' || v.level === 'mastered').length >= 5 },
  { id: 'verbs-master', title: 'Maestro del presente', description: 'Mastered 10 present-tense verbs (across all persons).', icon: 'book', check: (s) => allVerbMastery(s, 'present', s.profile?.region).filter((v) => v.level === 'mastered').length >= 10 },
  { id: 'voice', title: 'Tu voz', description: 'Recorded yourself speaking 10 times.', icon: 'mic', check: (s) => allDays(s).reduce((a, d) => a + d.speakingAttempts, 0) >= 10 },
  { id: 'memory', title: 'Memoria de elefante', description: 'Recalled 10 items after a delay of 12+ hours.', icon: 'brain', check: (s) => allDays(s).reduce((a, d) => a + d.retentionCorrect, 0) >= 10 },
  { id: 'hour', title: 'Una hora de español', description: 'Spent 60 active minutes learning.', icon: 'clock', check: (s) => totalActiveSeconds(s) >= 3600 },
  { id: 'streak-3', title: 'Tres días seguidos', description: 'Studied on 3 consecutive days.', icon: 'flame', check: (s) => currentStreak(s) >= 3 },
  { id: 'week-4', title: 'Constancia', description: 'Studied on 4 days in one week.', icon: 'flame', check: (s) => thisWeek(s).studyDays >= 4 },
];

export function newlyUnlocked(state: AppState): AchievementDef[] {
  const have = new Set(state.achievements.map((a) => a.id));
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(state));
}
