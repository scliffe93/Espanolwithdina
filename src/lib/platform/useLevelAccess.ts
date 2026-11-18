import { useMemo } from 'react';
import type { Cefr } from '../../types';
import { usePlatform, usePlatformQuery } from './context';
import { allowedPacks, allowedVerbs, overallLevel } from './level';
import { useStore } from '../store';
import type { StudentSettings } from './types';
import { sentenceLevelFor } from '../../data/ladders';
import { matchTopics } from '../../data/topics';

const EMPTY: string[] = [];

export interface LevelAccess {
  /** The ceiling for the person using the app right now, or null when there is none (guests, the teacher, students without a ceiling). */
  maxLevel: Cefr | null;
  loading: boolean;
  settings: StudentSettings | null;
  /** Gradual release: the verbs and word packs the teacher has released, or null when there is no restriction. */
  verbs: Set<string> | null;
  packs: Set<string> | null;
  /** The level this person is working at: the teacher's ceiling, else the level she last confirmed, else their own. Games and the app's language follow it. */
  level: Cefr;
  /** Where that level comes from: the teacher set it, the teacher confirmed a move up, or the learner's own profile. */
  levelFrom: 'teacher' | 'confirmed' | 'own';
  /** How long sentences get in practice, 1 to 5: the teacher's setting, else what suits the level. */
  sentence: number;
  /** What the student loves: their practice sentences come from these topics. */
  topics: string[];
}

/** The current actor's level ceiling. Only students have one; everyone else gets null. */
export function useLevelAccess(): LevelAccess {
  const { me } = usePlatform();
  const isStudent = me?.role === 'student';
  const q = usePlatformQuery<StudentSettings | null>((b) => (isStudent ? b.studentSettings(me!.id) : Promise.resolve(null)), [me?.id, isStudent]);
  const s = isStudent ? q.data : null;
  const key = `${s?.stepped ? 1 : 0}|${(s?.unlocked ?? []).join(',')}|${(s?.verbs ?? []).join(',')}`;
  const verbs = useMemo(() => allowedVerbs(s), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const packs = useMemo(() => allowedPacks(s), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { state } = useStore();
  // What the student loves: the teacher's ticks, plus whatever the app recognises in the student's own words.
  const likes = state.profile?.likes ?? '';
  const topicKey = `${(s?.topics ?? []).join(',')}|${likes}`;
  const topics = useMemo(() => { const all = [...new Set([...(s?.topics ?? []), ...matchTopics(likes).topics])]; return all.length ? all : EMPTY; }, [topicKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const level = s?.maxLevel ?? s?.verified?.level ?? overallLevel(state.profile?.levels);
  return { maxLevel: s?.maxLevel ?? null, loading: isStudent && q.loading, settings: q.data, verbs, packs, level, levelFrom: s?.maxLevel ? 'teacher' : s?.verified?.level ? 'confirmed' : 'own', topics, sentence: s?.sentence ?? sentenceLevelFor(level) };
}
