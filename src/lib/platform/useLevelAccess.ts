import { useMemo } from 'react';
import type { Cefr } from '../../types';
import { usePlatform, usePlatformQuery } from './context';
import { allowedPacks, allowedVerbs, overallLevel } from './level';
import { useStore } from '../store';
import type { StudentSettings } from './types';
import { sentenceLevelFor } from '../../data/ladders';

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
  /** How long sentences get in practice, 1 to 5: the teacher's setting, else what suits the level. */
  sentence: number;
}

/** The current actor's level ceiling. Only students have one; everyone else gets null. */
export function useLevelAccess(): LevelAccess {
  const { me } = usePlatform();
  const isStudent = me?.role === 'student';
  const q = usePlatformQuery<StudentSettings | null>((b) => (isStudent ? b.studentSettings(me!.id) : Promise.resolve(null)), [me?.id, isStudent]);
  const s = isStudent ? q.data : null;
  const key = `${s?.stepped ? 1 : 0}|${(s?.unlocked ?? []).join(',')}`;
  const verbs = useMemo(() => allowedVerbs(s), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const packs = useMemo(() => allowedPacks(s), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { state } = useStore();
  const level = s?.maxLevel ?? s?.verified?.level ?? overallLevel(state.profile?.levels);
  return { maxLevel: s?.maxLevel ?? null, loading: isStudent && q.loading, settings: q.data, verbs, packs, level, sentence: s?.sentence ?? sentenceLevelFor(level) };
}
