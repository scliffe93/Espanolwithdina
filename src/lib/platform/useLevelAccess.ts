import { useMemo } from 'react';
import type { Cefr } from '../../types';
import { usePlatform, usePlatformQuery } from './context';
import { allowedPacks, allowedVerbs } from './level';
import type { StudentSettings } from './types';

export interface LevelAccess {
  /** The ceiling for the person using the app right now, or null when there is none (guests, the teacher, students without a ceiling). */
  maxLevel: Cefr | null;
  loading: boolean;
  settings: StudentSettings | null;
  /** Gradual release: the verbs and word packs the teacher has released, or null when there is no restriction. */
  verbs: Set<string> | null;
  packs: Set<string> | null;
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
  return { maxLevel: s?.maxLevel ?? null, loading: isStudent && q.loading, settings: q.data, verbs, packs };
}
