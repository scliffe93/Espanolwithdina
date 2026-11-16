import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '../../lib/platform/context';
import type { LessonPlan, LessonWork } from '../../lib/platform/types';

/**
 * Keeps a device in step with a lesson. It asks the server for the lesson every couple of seconds while the page is
 * open and visible (faster while the lesson is running). For the student that same call says "I am here".
 * `plan` is what the server last sent; the teacher's screens keep their own copy and only take `work` from here.
 */
export function useLesson(id: string | undefined) {
  const { backend } = usePlatform();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [work, setWork] = useState<LessonWork | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const live = useRef(false);
  const busy = useRef(false);

  const take = useCallback((r: { plan: LessonPlan; work: LessonWork | null; now: string }) => { setPlan(r.plan); setWork(r.work); setNow(Date.parse(r.now) || Date.now()); live.current = r.plan.live.on; setError(null); setLoaded(true); }, []);
  const sync = useCallback(async () => {
    if (!backend || !id || busy.current) return;
    busy.current = true;
    try { take(await backend.syncLesson(id)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach the lesson.'); setLoaded(true); } finally { busy.current = false; }
  }, [backend, id, take]);

  useEffect(() => {
    if (!backend || !id) return;
    let stop = false; let timer: number | undefined;
    const loop = async () => {
      if (stop) return;
      if (document.visibilityState === 'visible') await sync();
      timer = window.setTimeout(loop, live.current ? 2000 : 5000);
    };
    void loop();
    const wake = () => { if (document.visibilityState === 'visible') void sync(); };
    document.addEventListener('visibilitychange', wake);
    return () => { stop = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
  }, [backend, id, sync]);

  /** The student answers a block. The screen shows it at once; the server's verdict follows. */
  const answer = useCallback(async (blockId: string, value: string) => {
    if (!backend || !id) return;
    setWork((w) => (w ? { ...w, answers: { ...w.answers, [blockId]: { value, at: new Date().toISOString(), ...(w.answers[blockId]?.correct !== undefined ? {} : {}) } } } : w));
    try { take(await backend.syncLesson(id, { blockId, value })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your answer.'); }
  }, [backend, id, take]);

  return { plan, work, now, error, loaded, answer, sync };
}
