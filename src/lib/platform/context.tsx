import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../../types';
import { useAccount } from '../account';
import { GUEST_KEY, hasKey, loadState, saveState } from '../db';
import { migrate } from '../state';
import { useStore } from '../store';
import { DemoBackend, type DemoStorage, type PlatformBackend } from './backend';
import { createCloudBackend } from './cloudBackend';
import { DEMO_PEOPLE, buildAnneka, buildSam, buildWorkspace } from './demoSeed';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type Person, type PlatformData } from './types';

// ───────────────────────────────────────────────────────────────
// PlatformProvider — who is using the teaching platform right now.
//
// Demo mode (the prototype): Dina, Sam or Anneka, chosen with a switcher
// and no password. Sam's and Anneka's learning progress are separate
// AppState copies in IndexedDB ("state:demo:sam", "state:demo:anneka");
// while you "are" Sam, the whole app runs on Sam's copy, so completing a
// chapter or a game as Sam is recorded exactly as it would be for a real
// learner. Dina has no learner copy: her screens read the students' copies.
//
// Cloud mode: a real signed-in account whose server role is student or
// teacher uses the cloud backend. Demo and real data never mix.
// ───────────────────────────────────────────────────────────────

export type DemoActor = 'dina' | 'sam' | 'anneka' | null;

const DEMO_DATA_KEY = 'demo:platform';
export const demoStateKey = (id: string) => `state:demo:${id === DEMO_STUDENT_IDS.sam ? 'sam' : 'anneka'}`;
const ACTOR_LS_KEY = 'lwd-demo-actor';

export const DEMO_ACTOR_IDS: Record<Exclude<DemoActor, null>, string> = { dina: DEMO_TEACHER_ID, sam: DEMO_STUDENT_IDS.sam, anneka: DEMO_STUDENT_IDS.anneka };

interface PlatformValue {
  /** The backend for the current actor, or null when nobody is using the platform. */
  backend: PlatformBackend | null;
  /** The current person (demo actor or signed-in account with a role). */
  me: Person | null;
  demoActor: DemoActor;
  demoAvailable: boolean;
  /** Enter the demo as Dina, Sam or Anneka (null = leave the demo). */
  switchDemo: (actor: DemoActor) => Promise<void>;
  /** Wipe the demo workspace and students back to the seeded sample data. */
  resetDemo: () => Promise<void>;
  /** Bump to make dashboards refetch after a mutation. */
  version: number;
  bump: () => void;
  ready: boolean;
}

const Ctx = createContext<PlatformValue | null>(null);

function readActor(): DemoActor {
  try {
    const v = localStorage.getItem(ACTOR_LS_KEY);
    return v === 'dina' || v === 'sam' || v === 'anneka' ? v : null;
  } catch {
    return null;
  }
}

async function loadDemoData(): Promise<PlatformData | null> {
  const { openDB } = await import('idb');
  const db = await openDB('viva', 1);
  return ((await db.get('kv', DEMO_DATA_KEY)) as PlatformData | undefined) ?? null;
}
async function saveDemoData(d: PlatformData) {
  const { openDB } = await import('idb');
  const db = await openDB('viva', 1);
  await db.put('kv', d, DEMO_DATA_KEY);
}

/** Creates the sample students and workspace the first time the demo is opened. */
export async function ensureDemoSeeded(now = Date.now()): Promise<PlatformData> {
  let data = await loadDemoData();
  if (!data) {
    data = buildWorkspace(now);
    await saveDemoData(data);
  }
  if (!(await hasKey(demoStateKey(DEMO_STUDENT_IDS.sam)))) await saveState(buildSam(now), demoStateKey(DEMO_STUDENT_IDS.sam));
  if (!(await hasKey(demoStateKey(DEMO_STUDENT_IDS.anneka)))) await saveState(buildAnneka(now), demoStateKey(DEMO_STUDENT_IDS.anneka));
  return data;
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const account = useAccount();
  const [demoActor, setDemoActor] = useState<DemoActor>(() => (account.session ? null : readActor()));
  const [demoData, setDemoData] = useState<PlatformData | null>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const storeRef = useRef(store);
  storeRef.current = store;
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Live student copies: when the demo actor is a student, the app's store runs on their copy,
  // so dashboards must read the store (fresh) rather than IndexedDB (saved with a short delay).
  const demoStorage = useMemo<DemoStorage>(() => ({
    loadData: loadDemoData,
    saveData: async (d) => { await saveDemoData(d); },
    loadStudentState: async (id) => {
      const key = demoStateKey(id);
      if (storeRef.current.storageKey() === key) return storeRef.current.getState();
      return (await hasKey(key)) ? migrate(await loadState(key)) : null;
    },
  }), []);

  // Boot: if a demo actor was remembered, seed (if needed) and switch the store onto their copy.
  useEffect(() => {
    if (!store.ready) return;
    (async () => {
      if (demoActor && !account.session) {
        const data = await ensureDemoSeeded();
        setDemoData(data);
        const id = DEMO_ACTOR_IDS[demoActor];
        if (demoActor !== 'dina') {
          const key = demoStateKey(id);
          if (store.storageKey() !== key) await store.switchStorage(key, migrate(await loadState(key)));
        }
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready]);

  const switchDemo = useCallback(async (actor: DemoActor) => {
    const st = storeRef.current;
    if (actor) {
      const data = await ensureDemoSeeded();
      setDemoData(data);
      const id = DEMO_ACTOR_IDS[actor];
      const key = actor === 'dina' ? GUEST_KEY : demoStateKey(id);
      if (st.storageKey() !== key) await st.switchStorage(key, migrate(await loadState(key)));
      try { localStorage.setItem(ACTOR_LS_KEY, actor); } catch { /* ignore */ }
    } else {
      if (st.storageKey() !== GUEST_KEY) await st.switchStorage(GUEST_KEY, migrate(await loadState(GUEST_KEY)));
      try { localStorage.removeItem(ACTOR_LS_KEY); } catch { /* ignore */ }
    }
    setDemoActor(actor);
    bump();
  }, [bump]);

  const resetDemo = useCallback(async () => {
    const { openDB } = await import('idb');
    const db = await openDB('viva', 1);
    await db.delete('kv', DEMO_DATA_KEY);
    await db.delete('kv', demoStateKey(DEMO_STUDENT_IDS.sam));
    await db.delete('kv', demoStateKey(DEMO_STUDENT_IDS.anneka));
    const data = await ensureDemoSeeded();
    setDemoData(data);
    const st = storeRef.current;
    const cur = st.storageKey();
    if (cur.startsWith('state:demo:')) await st.switchStorage(cur, migrate(await loadState(cur)));
    bump();
  }, [bump]);

  // A real sign-in leaves the demo.
  useEffect(() => {
    if (account.session && demoActor) switchDemo(null);
  }, [account.session, demoActor, switchDemo]);

  const value = useMemo<PlatformValue>(() => {
    let backend: PlatformBackend | null = null;
    let me: Person | null = null;
    if (account.session?.user.role) {
      me = { id: account.session.user.id, username: account.session.user.username, firstName: account.session.user.firstName, role: account.session.user.role };
      backend = createCloudBackend(account.session, me);
    } else if (demoActor && demoData) {
      me = DEMO_PEOPLE.find((p) => p.id === DEMO_ACTOR_IDS[demoActor]) ?? null;
      if (me) backend = new DemoBackend(me, demoData, demoStorage);
    }
    return { backend, me, demoActor, demoAvailable: !account.session, switchDemo, resetDemo, version, bump, ready };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.session, demoActor, demoData, version, ready, switchDemo, resetDemo, bump]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatform(): PlatformValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlatform outside PlatformProvider');
  return v;
}

/** Fetches with the backend and refetches whenever the platform version bumps. */
export function usePlatformQuery<T>(fn: (b: PlatformBackend) => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const { backend, version } = usePlatform();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!backend) { setData(null); setLoading(false); return; }
    setLoading(true);
    fn(backend).then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => alive && setError((e as Error).message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, version, tick, ...deps]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export type { AppState };
