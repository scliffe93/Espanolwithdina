import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Segmented, Sheet } from '../../components/ui';
import { CITY_THEMES } from '../../data/cityThemes';
import { SCENES, scenesForCity, type CityId, type Scene } from '../../data/story';
import { TENSES, VERBS, type Tense } from '../../data/verbs';
import { usePlatform, type AppState } from '../../lib/platform/context';
import { HOMEWORK_TEMPLATES, describeActivity } from '../../lib/platform/homework';
import { fmtDateTime, zoneLabel, zonedToUtcIso } from '../../lib/platform/time';
import { HOMEWORK_KIND_LABEL, type Homework, type HomeworkActivity, type Person } from '../../lib/platform/types';
import { useStore } from '../../lib/store';
import { shiftDate, todayIn } from './calendarMath';
import { ErrorText, Field, StudentPicker, ZoneSelect, nameOf, useAction } from './shared';

type VocabVia = 'review' | 'swipe' | 'serestar' | 'order' | 'metro';
const VOCAB_VIA: { value: VocabVia; label: string }[] = [
  { value: 'review', label: 'Memory review' },
  { value: 'swipe', label: '¿Sí o no? game' },
  { value: 'serestar', label: 'Ser o Estar game' },
  { value: 'order', label: 'Order Up! game' },
  { value: 'metro', label: 'Metro Rush game' },
];

/** Assign one of the app's real activities as homework to one or both students. */
export function HomeworkAssignForm({ open, onClose, people, progress, initialStudentIds, viewZone, onAssigned }: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  progress: Record<string, AppState | null>;
  initialStudentIds?: string[];
  viewZone: string;
  onAssigned?: (items: Homework[]) => void;
}) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const { run, busy, error, setError } = useAction();
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [tpl, setTpl] = useState(0);
  const [verbs, setVerbs] = useState<string[]>([]);
  const [verbQuery, setVerbQuery] = useState('');
  const [tense, setTense] = useState<Tense>('present');
  const [sceneId, setSceneId] = useState('');
  const [vocabVia, setVocabVia] = useState<VocabVia>('review');
  const [prompt, setPrompt] = useState('');
  const [minWords, setMinWords] = useState(40);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [dueZone, setDueZone] = useState(viewZone);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('20:00');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStudentIds(initialStudentIds?.length ? initialStudentIds : people.map((p) => p.id).slice(0, 1));
    setTpl(0);
    setVerbs([]);
    setVerbQuery('');
    setTense('present');
    setSceneId('');
    setVocabVia('review');
    setPrompt('');
    setMinWords(40);
    setTitle('');
    setTitleTouched(false);
    setInstructions('');
    setDueZone(viewZone);
    setDueDate(shiftDate(todayIn(viewZone), 3));
    setDueTime('20:00');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const template = HOMEWORK_TEMPLATES[tpl];
  const kind = template.kind;
  const wantsVerbs = kind === 'verbs' || (kind === 'listening' && template.label.includes('Metro'));
  const wantsPrompt = kind === 'speaking' || kind === 'written';

  // Story chapters: the selected students' cities (fall back to every chapter).
  const sceneGroups = useMemo(() => {
    const cities = [...new Set(studentIds.map((id) => progress[id]?.profile?.city).filter((c): c is CityId => !!c))];
    return cities.length ? cities.map((c) => ({ label: CITY_THEMES[c].name, scenes: scenesForCity(c) })) : [{ label: 'All chapters', scenes: SCENES }];
  }, [studentIds, progress]);
  const sceneOptions = useMemo(() => sceneGroups.flatMap((g) => g.scenes), [sceneGroups]);
  const effectiveScene = sceneOptions.some((s) => s.id === sceneId) ? sceneId : (sceneOptions[0]?.id ?? '');

  const activity: HomeworkActivity = useMemo(() => {
    let a = template.build({
      verbs: verbs.length ? verbs : undefined,
      sceneId: kind === 'story' ? effectiveScene || undefined : undefined,
      prompt: prompt.trim() || undefined,
      title: titleTouched && title.trim() ? title.trim() : undefined,
    });
    if (a.kind === 'verbs') a = { ...a, tense };
    if (a.kind === 'written') a = { ...a, minWords: minWords > 0 ? minWords : undefined };
    if (a.kind === 'vocabulary' && vocabVia !== 'review') a = { ...a, review: undefined, game: vocabVia };
    return a;
  }, [template, kind, verbs, effectiveScene, prompt, title, titleTouched, tense, minWords, vocabVia]);

  const dueAt = useMemo(() => {
    if (!dueDate || !dueTime) return '';
    try {
      return zonedToUtcIso(dueDate, dueTime, dueZone);
    } catch {
      return '';
    }
  }, [dueDate, dueTime, dueZone]);

  const q = verbQuery.trim().toLowerCase();
  const verbMatches = useMemo(() => VERBS.filter((v) => !verbs.includes(v.inf) && (!q || v.inf.includes(q) || v.en.toLowerCase().includes(q))).slice(0, q ? 16 : 10), [q, verbs]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend) return;
    if (!studentIds.length) return setError('Choose at least one student.');
    if (!activity.title.trim()) return setError('Give the homework a title.');
    if (kind === 'story' && !activity.sceneId) return setError('Choose a story chapter.');
    if (wantsPrompt && !activity.prompt?.trim()) return setError('Write the prompt the student should answer.');
    if (!dueAt) return setError('Choose a deadline.');
    if (new Date(dueAt).getTime() < Date.now()) return setError('The deadline is in the past — pick a later date or time.');
    const items = await run(() => backend.assignHomework({ studentIds, activity, instructions: instructions.trim(), dueAt }), people, dueZone);
    if (items) {
      notify('Homework assigned', `${activity.title} · ${items.map((h) => nameOf(people, h.studentId)).join(' & ')}`);
      onAssigned?.(items);
      onClose();
    }
  };

  const sceneDoneBy = (s: Scene) => studentIds.filter((id) => progress[id]?.story.completedScenes.includes(s.id)).map((id) => nameOf(people, id));

  return (
    <Sheet open={open} onClose={onClose} title="Assign homework" wide>
      <form className="grid gap-5 lg:grid-cols-[1.2fr_1fr]" onSubmit={submit} noValidate>
        <div className="grid gap-4">
          <div className="grid gap-1 text-sm font-medium">
            <span>Who</span>
            <StudentPicker people={people} value={studentIds} onChange={setStudentIds} multiple label="Students" />
          </div>
          <Field id="hw-template" label="Activity">
            <select id="hw-template" className="input" value={tpl} onChange={(e) => setTpl(Number(e.target.value))}>
              {HOMEWORK_TEMPLATES.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}
            </select>
            <span className="text-xs font-normal text-ink-mute">{HOMEWORK_KIND_LABEL[kind]} — the student does it inside the app and the result comes back to you.</span>
          </Field>

          {wantsVerbs && (
            <div className="grid gap-2">
              <Field id="hw-verb-search" label={kind === 'verbs' ? 'Verbs to drill (leave empty to let the app choose)' : 'Verbs for the game (optional)'}>
                <input id="hw-verb-search" className="input" placeholder="Search: tener, to want…" value={verbQuery} onChange={(e) => setVerbQuery(e.target.value)} autoComplete="off" />
              </Field>
              {verbs.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Chosen verbs">
                  {verbs.map((v) => (
                    <li key={v}><button type="button" className="chip" aria-pressed="true" aria-label={`Remove ${v}`} onClick={() => setVerbs(verbs.filter((x) => x !== v))}>{v} <Icon name="x" size={12} /></button></li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Verbs">
                {verbMatches.map((v) => (
                  <button key={v.inf} type="button" className="chip !py-1.5" onClick={() => { setVerbs([...verbs, v.inf]); setVerbQuery(''); }} title={v.en}>{v.inf} <span className="text-xs text-ink-mute">{v.en.split(' (')[0]}</span></button>
                ))}
                {!verbMatches.length && <span className="text-xs text-ink-mute">No verb matches “{verbQuery}”.</span>}
              </div>
              {kind === 'verbs' && (
                <div className="grid gap-1 text-sm font-medium">
                  <span>Tense</span>
                  <Segmented label="Tense" value={tense} onChange={setTense} options={TENSES.map((t) => ({ value: t.id, label: t.label }))} />
                </div>
              )}
            </div>
          )}

          {kind === 'story' && (
            <Field id="hw-scene" label="Story chapter">
              <select id="hw-scene" className="input" value={effectiveScene} onChange={(e) => setSceneId(e.target.value)}>
                {sceneGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.scenes.map((s) => <option key={s.id} value={s.id}>Chapter {s.chapter}: {s.titleEs} — {s.title}{sceneDoneBy(s).length ? ` (done by ${sceneDoneBy(s).join(' & ')})` : ''}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}

          {kind === 'vocabulary' && (
            <Field id="hw-vocab-via" label="Practise with">
              <select id="hw-vocab-via" className="input" value={vocabVia} onChange={(e) => setVocabVia(e.target.value as VocabVia)}>
                {VOCAB_VIA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}

          {wantsPrompt && (
            <>
              <Field id="hw-prompt" label={kind === 'speaking' ? 'What should they talk about? (in Spanish)' : 'Writing prompt (in Spanish)'}>
                <textarea id="hw-prompt" className="input min-h-[84px]" placeholder={template.build({}).prompt} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={600} />
              </Field>
              {kind === 'written' && (
                <Field id="hw-minwords" label="Minimum words">
                  <input id="hw-minwords" type="number" min={0} max={1000} step={10} className="input" value={minWords} onChange={(e) => setMinWords(Number(e.target.value))} />
                </Field>
              )}
            </>
          )}

          <Field id="hw-title" label="Title the student sees">
            <div className="flex gap-2">
              <input id="hw-title" className="input" value={titleTouched ? title : activity.title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} maxLength={100} />
              {titleTouched && <button type="button" className="ctrl shrink-0" onClick={() => { setTitle(''); setTitleTouched(false); }}>Reset</button>}
            </div>
          </Field>
          <Field id="hw-instructions" label="Instructions" hint="Shown on the student’s homework page.">
            <textarea id="hw-instructions" aria-describedby="hw-instructions-hint" className="input min-h-[84px]" placeholder="e.g. Aim for 80%+ and note the sentences you miss." value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={800} />
          </Field>
        </div>

        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="hw-due-date" label="Deadline"><input id="hw-due-date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></Field>
            <Field id="hw-due-time" label="Time"><input id="hw-due-time" type="time" step={300} className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required /></Field>
          </div>
          <ZoneSelect id="hw-due-zone" value={dueZone} onChange={setDueZone} label="Deadline time zone" />

          <div className="rounded-2xl bg-cream-100 p-4 text-sm" aria-live="polite">
            <p className="eyebrow mb-1">Preview</p>
            <p className="font-semibold">{activity.title}</p>
            <p className="text-ink-soft">{describeActivity(activity)}</p>
            {activity.prompt && <p className="mt-1 italic text-ink-soft">“{activity.prompt}”</p>}
            <p className="mt-2 text-ink-mute">For {studentIds.length ? studentIds.map((id) => nameOf(people, id)).join(' & ') : '—'}</p>
            {dueAt && <p className="text-ink-mute">Due {fmtDateTime(dueAt, dueZone)} · {zoneLabel(dueZone)}{dueZone !== viewZone ? ` (= ${fmtDateTime(dueAt, viewZone)} in ${zoneLabel(viewZone)})` : ''}</p>}
          </div>
          <ErrorText error={error} />
          <button type="submit" className="btn-primary" disabled={busy}><Icon name="send" size={16} /> {busy ? 'Assigning…' : `Assign to ${studentIds.length === 1 ? nameOf(people, studentIds[0]) : `${studentIds.length} students`}`}</button>
        </div>
      </form>
    </Sheet>
  );
}
