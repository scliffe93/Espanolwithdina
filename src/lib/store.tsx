import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../types';
import { ACHIEVEMENTS, newlyUnlocked, type AchievementDef } from './achievements';
import { GUEST_KEY, accountKey, hasKey, loadState, saveState } from './db';
import { api, cloudConfigured, loadSession } from './cloud';
import { migrate } from './state';
import { onSpeakingChange, setPreferredVoice } from './speech';
import { addActiveSeconds, defaultState } from './state';
import { creditFor, timerStatus, type TimerStatus } from './timeTracker';
import { applyCityTheme } from '../data/cityThemes';
import { setActiveVariety } from '../data/verbs';
import { confetti, setSoundEnabled, sfx } from './fx';

// ── Media activity (speech, playback, recording) keeps the timer alive ──
let mediaCount = 0;
let ttsSpeaking = false;
onSpeakingChange((s) => (ttsSpeaking = s));
export function mediaStart() {
  mediaCount++;
}
export function mediaEnd() {
  mediaCount = Math.max(0, mediaCount - 1);
}
const mediaActive = () => ttsSpeaking || mediaCount > 0;

interface Toast {
  id: number;
  kind: 'achievement' | 'info';
  title: string;
  body?: string;
  achievement?: AchievementDef;
}

interface StoreValue {
  state: AppState;
  ready: boolean;
  update: (fn: (s: AppState) => AppState) => void;
  /** Replace the whole state. `silent` = came from sync, don't schedule another upload. */
  replace: (s: AppState, opts?: { silent?: boolean }) => void;
  /** Switch which local copy is active (guest vs an account) and show `s`. */
  switchStorage: (key: string, s: AppState) => Promise<void>;
  storageKey: () => string;
  getState: () => AppState;
  subscribe: (fn: (s: AppState) => void) => () => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  notify: (title: string, body?: string) => void;
  timer: TimerStatus;
  setLearning: (on: boolean) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timer, setTimer] = useState<TimerStatus>('not-learning');
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimer = useRef<number>();
  const toastId = useRef(0);
  const learning = useRef(false);
  const keyRef = useRef(GUEST_KEY);
  const listeners = useRef(new Set<(s: AppState) => void>());

  useEffect(() => {
    (async () => {
      // A remembered account session opens that learner's own local copy.
      const session = cloudConfigured ? loadSession() : null;
      let s: AppState;
      if (session) {
        keyRef.current = accountKey(session.user.id);
        if (await hasKey(keyRef.current)) s = await loadState(keyRef.current);
        else {
          // No local copy on this device yet (e.g. storage was cleared): fetch from the cloud if possible.
          try {
            const remote = await api.getProgress(session.token);
            s = migrate(remote.data as AppState | null);
          } catch {
            s = migrate(null);
          }
        }
      } else s = await loadState(GUEST_KEY);
      setState(s);
      setReady(true);
    })();
  }, []);

  // City theme, Spanish variety and sound follow the learner's settings.
  const city = state.profile?.city ?? 'madrid';
  const region = state.profile?.region ?? 'spain';
  if (typeof document !== 'undefined' && document.documentElement.dataset.city !== city) applyCityTheme(city);
  setActiveVariety(region);
  setSoundEnabled(state.settings.sound);
  setPreferredVoice(state.settings.voiceURI || null);

  const persist = useCallback((s: AppState) => {
    window.clearTimeout(saveTimer.current);
    const key = keyRef.current;
    saveTimer.current = window.setTimeout(() => saveState(s, key).catch((e) => console.warn('Learning with Dina: local save failed', e)), 400);
  }, []);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { ...t, id }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
  }, []);

  const update = useCallback(
    (fn: (s: AppState) => AppState) => {
      setState((prev) => {
        let next = fn(prev);
        if (next === prev) return prev;
        // Remember when each editable section changed, so devices can be merged safely.
        const now = Date.now();
        const meta = { ...(next.meta ?? {}), changedAt: now };
        if (next.profile !== prev.profile) meta.profileAt = now;
        if (next.settings !== prev.settings) meta.settingsAt = now;
        if (next.teacher !== prev.teacher) meta.teacherAt = now;
        next = { ...next, meta };
        if (next.onboardingDone) {
          const unlocked = newlyUnlocked(next);
          if (unlocked.length) {
            const now = Date.now();
            next = { ...next, achievements: [...next.achievements, ...unlocked.map((a) => ({ id: a.id, at: now }))] };
            queueMicrotask(() => { sfx.coin(); confetti({ count: 70, y: 80 }); unlocked.forEach((a) => pushToast({ kind: 'achievement', title: a.title, body: a.description, achievement: a })); });
          }
        }
        persist(next);
        const snapshot = next;
        queueMicrotask(() => listeners.current.forEach((l) => l(snapshot)));
        return next;
      });
    },
    [persist, pushToast],
  );

  const replace = useCallback(
    (s: AppState, opts: { silent?: boolean } = {}) => {
      setState(s);
      stateRef.current = s;
      persist(s);
      if (!opts.silent) queueMicrotask(() => listeners.current.forEach((l) => l(s)));
    },
    [persist],
  );

  const switchStorage = useCallback(async (key: string, s: AppState) => {
    window.clearTimeout(saveTimer.current);
    await saveState(stateRef.current, keyRef.current).catch(() => undefined); // flush the outgoing copy first
    keyRef.current = key;
    stateRef.current = s;
    setState(s);
    await saveState(s, key);
  }, []);

  // ── Active learning timer ─────────────────────────────────────────
  useEffect(() => {
    let lastInteraction = Date.now();
    let prevTick = Date.now();
    let pendingMs = 0;
    let listeningMs = 0;
    const mark = () => (lastInteraction = Date.now());
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'pointermove'] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    const flush = () => {
      const secs = Math.floor(pendingMs / 1000);
      if (secs <= 0) return;
      const listenSecs = Math.min(secs, Math.floor(listeningMs / 1000));
      pendingMs -= secs * 1000;
      listeningMs = Math.max(0, listeningMs - listenSecs * 1000);
      // Split so listening seconds are tracked separately but counted once.
      update((s) => {
        let n = s;
        if (listenSecs) n = addActiveSeconds(n, listenSecs, true);
        if (secs - listenSecs) n = addActiveSeconds(n, secs - listenSecs, false);
        return n;
      });
    };

    const iv = window.setInterval(() => {
      const now = Date.now();
      const signals = {
        now,
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
        lastInteraction,
        mediaActive: mediaActive(),
        learningContext: learning.current && !!stateRef.current.onboardingDone,
      };
      const st = timerStatus(signals);
      const credit = creditFor(prevTick, signals);
      prevTick = now;
      pendingMs += credit;
      if (st === 'listening') listeningMs += credit;
      setTimer(st);
      if (pendingMs >= 5000) flush();
    }, 1000);

    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearInterval(iv);
      evs.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [update]);

  // Flush state on unload as a best effort.
  useEffect(() => {
    const on = () => saveState(stateRef.current, keyRef.current).catch(() => undefined);
    window.addEventListener('pagehide', on);
    return () => window.removeEventListener('pagehide', on);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      update,
      replace,
      switchStorage,
      storageKey: () => keyRef.current,
      getState: () => stateRef.current,
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      toasts,
      dismissToast: (id) => setToasts((ts) => ts.filter((t) => t.id !== id)),
      notify: (title, body) => pushToast({ kind: 'info', title, body }),
      timer,
      setLearning: (on) => (learning.current = on),
    }),
    [state, ready, update, replace, switchStorage, toasts, pushToast, timer],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

export { ACHIEVEMENTS };
