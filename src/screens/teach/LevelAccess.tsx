import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { useStore } from '../../lib/store';
import { CEFR_LEVELS, type Cefr } from '../../types';
import { ReleaseBlocks } from './ReleaseBlocks';
import { ErrorText, useAction } from './shared';

/** The teacher's level ceiling for one student: the highest level of work they can open on their own. */
export function LevelAccess({ studentId, name }: { studentId: string; name: string }) {
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
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: level || null, note, stepped: q.data?.stepped, unlocked: q.data?.unlocked }));
    if (saved) {
      q.reload();
      notify('Level access saved', saved.maxLevel ? `${name} can open work up to ${saved.maxLevel}.` : `${name} can open everything.`);
      setEditing(false);
    }
  };

  /** Saves a change to the gradual-release blocks, keeping the ceiling and note as they are. */
  const saveRelease = async (patch: { stepped: boolean; unlocked: string[] }, message: string) => {
    if (!backend) return;
    const saved = await run(() => backend.saveStudentSettings({ studentId, maxLevel: current, note: q.data?.note, ...patch }));
    if (saved) { notify('Saved', message); q.reload(); }
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-cream-100 p-3 text-sm" data-testid="level-access">
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
