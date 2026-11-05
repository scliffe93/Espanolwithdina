// Active-learning time logic (pure, unit-tested). The React hook in
// useActiveTimer.ts feeds it real browser signals once per second.

export interface ActivitySignals {
  now: number;
  visible: boolean; // document.visibilityState === 'visible'
  focused: boolean; // document.hasFocus()
  lastInteraction: number; // epoch ms of last pointer / key / scroll / touch
  mediaActive: boolean; // speech synthesis, recording or playback in progress
  learningContext: boolean; // on a learning screen (scene, practice, review, assessment)
}

/** Seconds without input before we stop counting (unless audio is playing). */
export const IDLE_AFTER_MS = 45_000;
/** Ignore huge gaps (sleep / throttled timers) — never credit more than this per tick. */
export const MAX_TICK_MS = 2_000;

export type TimerStatus = 'active' | 'listening' | 'idle' | 'hidden' | 'not-learning';

export function timerStatus(s: ActivitySignals): TimerStatus {
  if (!s.learningContext) return 'not-learning';
  if (!s.visible) return 'hidden';
  if (s.mediaActive) return 'listening';
  if (!s.focused) return 'idle';
  if (s.now - s.lastInteraction > IDLE_AFTER_MS) return 'idle';
  return 'active';
}

/** Milliseconds to credit for the interval since the previous tick. */
export function creditFor(prevTick: number, s: ActivitySignals): number {
  const status = timerStatus(s);
  if (status !== 'active' && status !== 'listening') return 0;
  return Math.max(0, Math.min(MAX_TICK_MS, s.now - prevTick));
}
