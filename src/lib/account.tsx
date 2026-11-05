import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../types';
import { ApiError, api, cloudConfigured, loadSession, saveSession, type Session } from './cloud';
import { GUEST_KEY, accountKey, deleteKey, deleteSyncMeta, hasKey, loadState, loadSyncMeta, saveState, saveSyncMeta, type SyncMeta } from './db';
import { hasProgress, mergeStates } from './merge';
import { defaultState, migrate } from './state';
import { blankProfile } from '../data/profileOptions';
import { useStore } from './store';

// ───────────────────────────────────────────────────────────────
// Accounts + automatic cloud sync.
//
// • Progress is ALWAYS saved locally first (IndexedDB), then uploaded.
// • Uploads name the server version they were based on; if another
//   device saved in between, the server refuses (409) and returns its
//   copy, which is merged here (see merge.ts) and uploaded again.
// • Offline: changes stay "pending" and upload when the connection returns.
// • "Synced" is only shown after the server confirms the write.
// ───────────────────────────────────────────────────────────────

export type SyncStatus = 'local-only' | 'synced' | 'pending' | 'syncing' | 'offline' | 'error' | 'reauth';

interface AccountValue {
  configured: boolean;
  session: Session | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  message: string | null;
  welcome: { firstName: string; isNew: boolean } | null;
  dismissWelcome: () => void;
  /** A freshly issued recovery code that must be shown (and acknowledged) before anything else. */
  recoveryCode: string | null;
  acknowledgeRecoveryCode: () => void;
  guestHasProgress: boolean;
  register: (o: { username: string; password: string; firstName: string; remember: boolean; bringGuest: boolean }) => Promise<string>;
  login: (o: { username: string; password: string; remember: boolean; bringGuest: boolean }) => Promise<void>;
  recover: (o: { username: string; recoveryCode: string; newPassword: string; remember: boolean }) => Promise<string>;
  logout: (o?: { force?: boolean; forgetDevice?: boolean }) => Promise<'ok' | 'unsynced'>;
  changePassword: (current: string, next: string) => Promise<void>;
  newRecoveryCode: (password: string) => Promise<string>;
  deleteAccount: (password: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<AccountValue | null>(null);
const MIN_INTERVAL = 20_000; // at most one upload every 20 s while studying
const DEBOUNCE = 3_000;

export function AccountProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [session, setSession] = useState<Session | null>(() => (cloudConfigured ? loadSession() : null));
  const [status, setStatus] = useState<SyncStatus>(cloudConfigured && loadSession() ? 'pending' : 'local-only');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<AccountValue['welcome']>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const pendingWelcome = useRef<AccountValue['welcome']>(null);
  const [guestHasProgress, setGuestHasProgress] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const meta = useRef<SyncMeta>({ version: 0, dirty: false, lastSyncedAt: null });
  const changeCounter = useRef(0);
  const pushing = useRef<Promise<void> | null>(null);
  const timer = useRef<number>();
  const lastPush = useRef(0);
  const storeRef = useRef(store);
  storeRef.current = store;

  const setMeta = useCallback(async (m: Partial<SyncMeta>) => {
    meta.current = { ...meta.current, ...m };
    const s = sessionRef.current;
    if (s) await saveSyncMeta(s.user.id, meta.current).catch(() => undefined);
    if (m.lastSyncedAt !== undefined) setLastSyncedAt(m.lastSyncedAt);
  }, []);

  const refreshGuestFlag = useCallback(async () => {
    const g = await loadState(GUEST_KEY);
    setGuestHasProgress(hasProgress(g) && !g.linkedTo);
  }, []);
  useEffect(() => { refreshGuestFlag(); }, [refreshGuestFlag]);

  // ── push / pull ─────────────────────────────────────────────
  const push = useCallback(async (keepalive = false): Promise<void> => {
    if (pushing.current) return pushing.current;
    const s = sessionRef.current;
    if (!s) return;
    const run = (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!meta.current.dirty) { setStatus('synced'); return; }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return; }
        setStatus('syncing');
        const counterAtSend = changeCounter.current;
        const snapshot = storeRef.current.getState();
        try {
          const r = await api.putProgress(s.token, snapshot, meta.current.version, keepalive);
          lastPush.current = Date.now();
          const stillDirty = changeCounter.current !== counterAtSend;
          await setMeta({ version: r.version, dirty: stillDirty, lastSyncedAt: Date.now() });
          setMessage(null);
          if (!stillDirty) { setStatus('synced'); return; }
        } catch (e) {
          const err = e as ApiError;
          if (err.status === 409 && err.data) {
            // Another device saved first: merge its copy with ours, then upload the result.
            const remote = migrate(err.data.data as AppState);
            const merged = mergeStates(storeRef.current.getState(), remote);
            storeRef.current.replace(merged, { silent: true });
            await setMeta({ version: Number(err.data.version) || 0, dirty: true });
            continue;
          }
          if (err.status === 401) { setStatus('reauth'); setMessage('Your session has ended. Log in again to keep syncing — your progress is safe on this device.'); return; }
          if (err.status === 0) { setStatus('offline'); return; }
          setStatus('error');
          setMessage(err.message);
          return;
        }
      }
    })();
    pushing.current = run;
    try { await run; } finally { pushing.current = null; }
  }, [setMeta]);

  const schedulePush = useCallback(() => {
    window.clearTimeout(timer.current);
    const wait = Math.max(DEBOUNCE, lastPush.current + MIN_INTERVAL - Date.now());
    timer.current = window.setTimeout(() => { push(); }, wait);
  }, [push]);

  const pull = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const remote = await api.getProgress(s.token);
      if (remote.data && remote.version > meta.current.version) {
        const merged = mergeStates(storeRef.current.getState(), migrate(remote.data as AppState));
        storeRef.current.replace(merged, { silent: true });
        const localHadChanges = meta.current.dirty;
        await setMeta({ version: remote.version, dirty: localHadChanges || JSON.stringify(merged) !== JSON.stringify(migrate(remote.data as AppState)), lastSyncedAt: Date.now() });
      }
      if (meta.current.dirty) await push();
      else { setStatus('synced'); if (!lastSyncedAt) setLastSyncedAt(Date.now()); }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) { setStatus('reauth'); setMessage('Your session has ended. Log in again to keep syncing — your progress is safe on this device.'); }
      else if (err.status === 0) setStatus(meta.current.dirty ? 'offline' : 'offline');
      else { setStatus('error'); setMessage(err.message); }
    }
  }, [push, setMeta, lastSyncedAt]);

  // Every local change marks the account copy as needing upload.
  useEffect(() => store.subscribe(() => {
    if (!sessionRef.current) return;
    changeCounter.current++;
    if (!meta.current.dirty) setMeta({ dirty: true });
    setStatus((st) => (st === 'syncing' ? st : navigator.onLine === false ? 'offline' : 'pending'));
    schedulePush();
  }), [store, setMeta, schedulePush]);

  // On start (remembered session): load sync metadata, then pull + push.
  useEffect(() => {
    if (!store.ready || !session) return;
    (async () => {
      meta.current = await loadSyncMeta(session.user.id);
      setLastSyncedAt(meta.current.lastSyncedAt);
      await pull();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, session?.user.id]);

  // Reconnect / tab focus / leaving the page.
  useEffect(() => {
    const online = () => { if (sessionRef.current) pull(); };
    const offline = () => { if (sessionRef.current) setStatus('offline'); };
    const vis = () => {
      if (!sessionRef.current) return;
      if (document.visibilityState === 'hidden' && meta.current.dirty) push(true);
      if (document.visibilityState === 'visible') pull();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', vis);
    const iv = window.setInterval(() => { if (sessionRef.current && meta.current.dirty && navigator.onLine) push(); }, 30_000);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', vis);
      window.clearInterval(iv);
    };
  }, [pull, push]);

  // ── account actions ─────────────────────────────────────────
  const adopt = useCallback(async (s: Session, state: AppState, m: SyncMeta) => {
    saveSession(s);
    setSession(s);
    sessionRef.current = s;
    meta.current = m;
    await saveSyncMeta(s.user.id, m);
    await storeRef.current.switchStorage(accountKey(s.user.id), state);
    setLastSyncedAt(m.lastSyncedAt);
    setStatus(m.dirty ? 'pending' : 'synced');
  }, []);

  const linkGuest = useCallback(async (userId: string) => {
    const g = await loadState(GUEST_KEY);
    await saveState({ ...g, linkedTo: userId }, GUEST_KEY);
    await refreshGuestFlag();
  }, [refreshGuestFlag]);

  const register: AccountValue['register'] = async ({ username, password, firstName, remember, bringGuest }) => {
    const r = await api.register(username, password, firstName, remember);
    const s: Session = { token: r.token, user: r.user, remember, expiresAt: r.expiresAt };
    const guest = await loadState(GUEST_KEY);
    let state: AppState;
    if (bringGuest && hasProgress(guest)) {
      state = { ...guest, linkedTo: undefined }; // a copy — the device's guest progress is never deleted
      await linkGuest(r.user.id);
    } else {
      state = { ...defaultState(), profile: { ...blankProfile(), name: firstName } };
    }
    await adopt(s, state, { version: 0, dirty: true, lastSyncedAt: null });
    setRecoveryCode(r.recoveryCode!);
    pendingWelcome.current = { firstName: r.user.firstName, isNew: true }; // greet after the code is saved
    push();
    return r.recoveryCode!;
  };

  const signInWith = async (r: { token: string; expiresAt: string; user: Session['user'] }, remember: boolean, bringGuest: boolean, isNew = false, deferWelcome = false) => {
    const s: Session = { token: r.token, user: r.user, remember, expiresAt: r.expiresAt };
    const remote = await api.getProgress(s.token);
    const key = accountKey(r.user.id);
    const cached = (await hasKey(key)) ? await loadState(key) : null;
    const cachedMeta = await loadSyncMeta(r.user.id);
    let state: AppState | null = remote.data ? migrate(remote.data as AppState) : null;
    let dirty = false;
    if (cached && hasProgress(cached)) {
      // This device already had this learner's copy (maybe with offline changes): merge, never overwrite.
      state = state ? mergeStates(cached, state) : cached;
      dirty = cachedMeta.dirty || !remote.data;
    }
    if (bringGuest) {
      const guest = await loadState(GUEST_KEY);
      if (hasProgress(guest)) {
        state = state ? mergeStates(state, { ...guest, linkedTo: undefined }) : { ...guest, linkedTo: undefined };
        dirty = true;
        await linkGuest(r.user.id);
      }
    }
    if (!state) { state = { ...defaultState(), profile: { ...blankProfile(), name: r.user.firstName } }; dirty = true; }
    await adopt(s, state, { version: remote.version, dirty, lastSyncedAt: Date.now() });
    if (dirty) await push();
    if (deferWelcome) pendingWelcome.current = { firstName: r.user.firstName, isNew };
    else setWelcome({ firstName: r.user.firstName, isNew });
  };

  const login: AccountValue['login'] = async ({ username, password, remember, bringGuest }) => {
    const r = await api.login(username, password, remember);
    await signInWith(r, remember, bringGuest);
  };

  const recover: AccountValue['recover'] = async ({ username, recoveryCode, newPassword, remember }) => {
    const r = await api.recover(username, recoveryCode, newPassword, remember);
    await signInWith(r, remember, false, false, true);
    setRecoveryCode(r.recoveryCode!);
    return r.recoveryCode!;
  };

  const logout: AccountValue['logout'] = async ({ force = false, forgetDevice } = {}) => {
    const s = sessionRef.current;
    if (!s) return 'ok';
    window.clearTimeout(timer.current);
    if (meta.current.dirty) await push();
    if (meta.current.dirty && !force) return 'unsynced';
    try { await api.logout(s.token); } catch { /* offline: the token simply expires */ }
    const forget = forgetDevice ?? !s.remember;
    if (forget && !meta.current.dirty) {
      // Shared device: remove this learner's local copy (it is safely in the cloud).
      await deleteKey(accountKey(s.user.id)).catch(() => undefined);
      await deleteSyncMeta(s.user.id).catch(() => undefined);
    }
    saveSession(null);
    sessionRef.current = null;
    meta.current = { version: 0, dirty: false, lastSyncedAt: null };
    // Switch to the device's guest copy BEFORE showing the signed-out screen, so the form doesn't remount mid-typing.
    await storeRef.current.switchStorage(GUEST_KEY, await loadState(GUEST_KEY));
    setSession(null);
    setStatus('local-only');
    setLastSyncedAt(null);
    setMessage(null);
    await refreshGuestFlag();
    return 'ok';
  };

  const changePassword = async (current: string, next: string) => {
    if (!sessionRef.current) throw new ApiError(401, 'unauthorised', 'Please log in.');
    await api.changePassword(sessionRef.current.token, current, next);
  };

  const newRecoveryCode = async (password: string) => {
    if (!sessionRef.current) throw new ApiError(401, 'unauthorised', 'Please log in.');
    return (await api.newRecoveryCode(sessionRef.current.token, password)).recoveryCode;
  };

  const deleteAccount = async (password: string) => {
    const s = sessionRef.current;
    if (!s) return;
    await api.deleteAccount(s.token, password);
    // The online account is gone; keep a local copy as the device's guest progress only if the guest slot is empty.
    const local = storeRef.current.getState();
    const guest = await loadState(GUEST_KEY);
    if (!hasProgress(guest)) await saveState({ ...local, linkedTo: undefined }, GUEST_KEY);
    await deleteKey(accountKey(s.user.id)).catch(() => undefined);
    await deleteSyncMeta(s.user.id).catch(() => undefined);
    saveSession(null);
    sessionRef.current = null;
    await storeRef.current.switchStorage(GUEST_KEY, await loadState(GUEST_KEY));
    setSession(null);
    setStatus('local-only');
    await refreshGuestFlag();
  };

  const syncNow = async () => {
    if (!sessionRef.current) return;
    await pull();
    if (meta.current.dirty) await push();
  };

  const value = useMemo<AccountValue>(
    () => ({
      configured: cloudConfigured, session, status, lastSyncedAt, message, welcome, guestHasProgress,
      dismissWelcome: () => setWelcome(null),
      recoveryCode,
      acknowledgeRecoveryCode: () => {
        setRecoveryCode(null);
        if (pendingWelcome.current) { setWelcome(pendingWelcome.current); pendingWelcome.current = null; }
      },
      register, login, recover, logout, changePassword, newRecoveryCode, deleteAccount, syncNow,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, status, lastSyncedAt, message, welcome, guestHasProgress, recoveryCode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount outside AccountProvider');
  return v;
}

export function statusLabel(st: SyncStatus, last: number | null): { text: string; tone: 'ok' | 'wait' | 'warn' | 'off' } {
  const ago = last ? relTime(last) : '';
  switch (st) {
    case 'synced': return { text: `Saved to your account${ago ? ` · ${ago}` : ''}`, tone: 'ok' };
    case 'syncing': return { text: 'Saving to your account…', tone: 'wait' };
    case 'pending': return { text: 'Saved on this device · uploading soon', tone: 'wait' };
    case 'offline': return { text: 'Offline · saved on this device, not yet synced', tone: 'warn' };
    case 'error': return { text: 'Sync paused · will retry', tone: 'warn' };
    case 'reauth': return { text: 'Log in again to sync', tone: 'warn' };
    default: return { text: 'Saved on this device only', tone: 'off' };
  }
}

function relTime(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}
