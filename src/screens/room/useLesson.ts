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
  // One request at a time, in order: a check-in and an answer never overlap.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef(0);

  const take = useCallback((r: { plan: LessonPlan; work: LessonWork | null; now: string }) => { setPlan(r.plan); setWork(r.work); setNow(Date.parse(r.now) || Date.now()); live.current = r.plan.live.on; setError(null); setLoaded(true); }, []);
  const sync = useCallback(async () => {
    if (!backend || !id || waiting.current > 0) return; // something is already on its way: no need to ask again
    waiting.current++;
    const run = queue.current.then(async () => {
      try { take(await backend.syncLesson(id)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach the lesson.'); setLoaded(true); } finally { waiting.current--; }
    });
    queue.current = run;
    await run;
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
    waiting.current++;
    const run = queue.current.then(async () => {
      try { take(await backend.syncLesson(id, { blockId, value })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your answer.'); } finally { waiting.current--; }
    });
    queue.current = run;
    await run;
  }, [backend, id, take]);

  return { plan, work, now, error, loaded, answer, sync };
}

/**
 * For a group lesson: the other students' answers. The teacher's screen asks for each copy of the lesson in turn,
 * every couple of seconds while it is open, and keeps the latest answers of each.
 */
export function useGroupWork(lessonIds: string[], active: boolean) {
  const { backend } = usePlatform();
  const [works, setWorks] = useState<Record<string, { work: LessonWork | null; now: number }>>({});
  const key = lessonIds.join(',');
  useEffect(() => {
    if (!backend || !lessonIds.length) return;
    let stop = false; let timer: number | undefined;
    const loop = async () => {
      if (stop) return;
      if (document.visibilityState === 'visible') {
        const got = await Promise.all(lessonIds.map((id) => backend.syncLesson(id).then((r) => [id, { work: r.work, now: Date.parse(r.now) || Date.now() }] as const).catch(() => null)));
        if (!stop) setWorks((w) => ({ ...w, ...Object.fromEntries(got.filter(Boolean) as [string, { work: LessonWork | null; now: number }][]) }));
      }
      timer = window.setTimeout(loop, active ? 2500 : 6000);
    };
    void loop();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [backend, key, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return works;
}
