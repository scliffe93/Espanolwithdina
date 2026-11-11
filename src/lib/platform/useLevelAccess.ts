import type { Cefr } from '../../types';
import { usePlatform, usePlatformQuery } from './context';
import type { StudentSettings } from './types';

export interface LevelAccess {
  /** The ceiling for the person using the app right now, or null when there is none (guests, the teacher, students without a ceiling). */
  maxLevel: Cefr | null;
  loading: boolean;
  settings: StudentSettings | null;
}

/** The current actor's level ceiling. Only students have one; everyone else gets null. */
export function useLevelAccess(): LevelAccess {
  const { me } = usePlatform();
  const isStudent = me?.role === 'student';
  const q = usePlatformQuery<StudentSettings | null>((b) => (isStudent ? b.studentSettings(me!.id) : Promise.resolve(null)), [me?.id, isStudent]);
  return { maxLevel: isStudent ? (q.data?.maxLevel ?? null) : null, loading: isStudent && q.loading, settings: q.data };
}
