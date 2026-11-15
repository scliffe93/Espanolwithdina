import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { useStore } from '../../lib/store';
import { CEFR_LEVELS, type AppState, type Cefr } from '../../types';
import { levelReadiness, shouldSuggest } from '../../lib/levelUp';
import { overallLevel } from '../../lib/platform/level';
import { ReleaseBlocks } from './ReleaseBlocks';
import { ErrorText, useAction } from './shared';

/** The teacher's level ceiling for one student: the highest level of work they can open on their own. */
export function LevelAccess({ studentId, name, state }: { studentId: string; name: string; state?: AppState | null }) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const { run, busy, error, setError } = useAction();
  const q = usePlatformQuery((b) => b.studentSettings(studentId), [studentId]);
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState<Cefr | ''>('');
  const [note, setNote] = useState('');
  const current = q.data?.maxLevel ?? null;
  useEffect(() => { setLevel(q.data?.maxLevel ?? ''); setNote(q.data?.note ?? ''); }, [q.data?.maxLevel, q.data?.note]);

  const save = async () => {
    if (!backend) return;
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: level || null, note, stepped: q.data?.stepped, unlocked: q.data?.unlocked, verified: q.data?.verified, notYet: q.data?.notYet }));
    if (saved) {
      q.reload();
      notify('Level access saved', saved.maxLevel ? `${name} can open work up to ${saved.maxLevel}.` : `${name} can open everything.`);
      setEditing(false);
    }
  };

  /** Saves a change to the gradual-release blocks, keeping the ceiling and note as they are. */
  const saveRelease = async (patch: { stepped: boolean; unlocked: string[] }, message: string) => {
    if (!backend) return;
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: current, note: q.data?.note, verified: q.data?.verified, notYet: q.data?.notYet, ...patch }));
    if (saved) { notify('Saved', message); q.reload(); }
  };

  // The app's suggestion: it weighs the student's own practice and proposes; the teacher decides.
  const working: Cefr = current ?? q.data?.verified?.level ?? overallLevel(state?.profile?.levels);
  const ready = state && q.data !== undefined ? levelReadiness(state, working) : null;
  const suggest = !!ready && shouldSuggest(ready, q.data?.notYet);
  const [showWhy, setShowWhy] = useState(false);
  const moveUp = async () => {
    if (!backend || !ready?.next) return;
    const at = new Date().toISOString();
    // A student with a ceiling has it raised; one without keeps everything open and just has the new level recorded.
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: current ? ready.next : null, note: q.data?.note, stepped: q.data?.stepped, unlocked: q.data?.unlocked, verified: { level: ready.next!, at } }));
    if (saved) { q.reload(); notify(`${name} moved up to ${ready.next}`, 'They will see it in their app, with the new games and tenses open.'); }
  };
  const notYet = async () => {
    if (!backend || !ready) return;
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: current, note: q.data?.note, stepped: q.data?.stepped, unlocked: q.data?.unlocked, verified: q.data?.verified, notYet: { level: ready.level, at: new Date().toISOString() } }));
    if (saved) { q.reload(); notify('Not yet', `The app will not suggest it again for three weeks.`); }
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-cream-100 p-3 text-sm" data-testid="level-access">
      {ready?.next && (
        <div className={`mb-3 rounded-2xl p-3 ring-1 ${suggest ? 'bg-olive-50 ring-olive/40' : 'bg-white ring-ink/5'}`} data-testid="level-suggestion" data-ready={suggest}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1">
              <span className="eyebrow mr-2 !text-[10px]">{suggest ? 'Suggested by the app' : `Working at ${working}`}</span>
              {suggest ? <><b>{name} looks ready to move up from {ready.level} to {ready.next}.</b> You decide.</> : <span className="text-ink-soft">{ready.summary}</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="ctrl !py-1.5" onClick={() => setShowWhy(!showWhy)} aria-expanded={showWhy}>{showWhy ? 'Hide the evidence' : 'See the evidence'}</button>
              {suggest && <button type="button" className="btn-dark !py-1.5" disabled={busy} onClick={moveUp} data-testid="level-approve"><Icon name="check" size={14} /> Move up to {ready.next}</button>}
              {suggest && <button type="button" className="ctrl !py-1.5" disabled={busy} onClick={notYet} data-testid="level-not-yet">Not yet</button>}
            </div>
          </div>
          {showWhy && (
            <ul className="mt-3 grid gap-1.5 border-t border-ink/10 pt-3">
              {ready.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.met ? 'bg-olive text-white' : 'bg-white text-ink-mute ring-1 ring-ink/15'}`}>{c.met && <Icon name="check" size={12} />}</span>
                  <span><b>{c.label}</b> <span className="text-ink-mute">· {c.detail}</span></span>
                </li>
              ))}
              {!suggest && ready.next && <li className="mt-1"><button type="button" className="ctrl !py-1.5" disabled={busy} onClick={moveUp}>Move up to {ready.next} anyway</button></li>}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="eyebrow mr-2 !text-[10px]">Level access</span>
          {q.loading && !q.data ? 'Loading…' : current ? <>Can open work up to <b data-testid="level-ceiling">{current}</b></> : <>No ceiling: <b data-testid="level-ceiling">everything</b> is open</>}
          {q.data?.note ? <span className="text-ink-mute"> · {q.data.note}</span> : null}
        </p>
        {!editing && <button type="button" className="ctrl !py-1.5" onClick={() => { setError(null); setEditing(true); }} data-testid="level-edit"><Icon name="edit" size={14} /> Change</button>}
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium">Can open up to
            <select className="input !w-40" value={level} onChange={(e) => setLevel(e.target.value as Cefr | '')} data-testid="level-select">
              <option value="">No ceiling</option>
              {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">Note (optional)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. GCSE in June: stay on A2 until then" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-dark !py-2" disabled={busy} onClick={save} data-testid="level-save">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ctrl" onClick={() => { setEditing(false); setLevel(current ?? ''); setNote(q.data?.note ?? ''); }}>Cancel</button>
          </div>
          <p className="text-xs text-ink-mute sm:col-span-3">Tenses, verbs and self-chosen levels above the ceiling are hidden in {name}’s app. Homework you assign always opens, whatever the ceiling.</p>
          <div className="sm:col-span-3"><ErrorText error={error} /></div>
        </div>
      )}
      {!(q.loading && !q.data) && <ReleaseBlocks name={name} settings={q.data ?? null} busy={busy} onSave={saveRelease} />}
      {!editing && <ErrorText error={error} />}
    </div>
  );
}
