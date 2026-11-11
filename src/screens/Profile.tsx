import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { PageHeader, Segmented, Sheet } from '../components/ui';
import { CHARACTERS, scenesForCity } from '../data/story';
import { CITY_THEMES } from '../data/cityThemes';
import { CityPicker } from '../components/CityPicker';
import { statusLabel, useAccount } from '../lib/account';
import {
  ACTIVITIES, DIFFICULTIES, GENDER, INTERESTS, MINUTES, PROFICIENCY, REASONS, RELOCATION, SOCIAL, blankProfile, labelOf,
} from '../data/profileOptions';
import { deleteRecording, exportData, getRecording, importData, recordingCount, wipeAll } from '../lib/db';
import { navigate } from '../lib/router';
import { hasSpanishVoice, recognitionSupported, spanishVoices, speak, ttsSupported } from '../lib/speech';
import { defaultState } from '../lib/state';
import { useStore } from '../lib/store';
import { recorderSupported, playUrl } from '../hooks/useRecorder';
import { CEFR_LEVELS, SKILLS, type Cefr, type LearnerProfile, type Skill } from '../types';
import { withinLevel } from '../lib/platform/level';
import { useLevelAccess } from '../lib/platform/useLevelAccess';

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="card p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="mb-3 mt-0.5 text-sm text-ink-mute">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

function Chips<T extends string>({ options, values, onToggle, label }: { options: { value: T; label: string }[]; values: T[]; onToggle: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className="chip" aria-pressed={values.includes(o.value)} onClick={() => onToggle(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function DnaStrand({ profile }: { profile: LearnerProfile }) {
  const traits = [
    ...profile.interests.map((i) => labelOf(INTERESTS, i)),
    ...profile.reasons.map((r) => labelOf(REASONS, r)),
    `${profile.dailyMinutes} min / day`,
    CITY_THEMES[profile.city]?.varietyLabel ?? 'Spain Spanish',
  ].slice(0, 10);
  const colors = ['rgb(var(--c-primary))', '#E3A33B', 'rgb(var(--c-tertiary))', '#1F3A5F', '#D98C8C'];
  return (
    <div className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream">
      <svg className="absolute right-0 top-0 hidden h-full w-1/3 opacity-30 md:block" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => {
          const y = 10 + i * 21;
          const x = Math.sin(i * 0.7) * 50;
          return (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <line x1={100 - x} y1={y} x2={100 + x} y2={y} stroke="rgba(251,246,238,.25)" strokeWidth="2" />
              <circle cx={100 - x} cy={y} r="5" fill={colors[i % 5]} />
              <circle cx={100 + x} cy={y} r="5" fill={colors[(i + 2) % 5]} />
            </motion.g>
          );
        })}
      </svg>
      <p className="eyebrow !text-saffron-light">My Spanish DNA</p>
      <h2 className="mt-1 font-display text-3xl font-semibold">{profile.name || 'You'}</h2>
      <p className="mt-1 text-cream/70">Heading to {profile.destinationCity || 'Madrid'}{profile.destinationCountry ? `, ${profile.destinationCountry}` : ''} · {labelOf(RELOCATION, profile.relocation)}</p>
      <div className="relative mt-4 flex max-w-md flex-wrap gap-1.5">
        {traits.map((t) => <span key={t} className="rounded-full bg-cream/10 px-3 py-1 text-sm ring-1 ring-cream/15">{t}</span>)}
      </div>
      <div className="relative mt-5 grid max-w-md grid-cols-3 gap-2 sm:grid-cols-6">
        {SKILLS.map((s) => (
          <div key={s} className="rounded-2xl bg-cream/10 p-2 text-center ring-1 ring-cream/10">
            <div className="font-display text-xl font-semibold text-saffron-light">{profile.levels[s]}</div>
            <div className="text-[10px] uppercase tracking-wider text-cream/60">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoiceNoteRow({ id, label, transcript, onDelete }: { id: string; label: string; transcript?: string; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    getRecording(id).then((b) => b && setUrl((u = URL.createObjectURL(b))));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream-100 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">{label}</p>
        {transcript && <p className="truncate text-sm italic text-ink-mute">“{transcript}”</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {url && <button className="ctrl !px-2.5" onClick={() => playUrl(url)} aria-label={`Play voice note: ${label}`}><Icon name="play" size={16} /></button>}
        <button className="ctrl !px-2.5" onClick={onDelete} aria-label={`Delete voice note: ${label}`}><Icon name="trash" size={16} /></button>
      </div>
    </div>
  );
}

function VoicePicker() {
  const { state, update } = useStore();
  const region = state.profile?.region ?? 'spain';
  const [voices, setVoices] = useState(() => spanishVoices(region));
  useEffect(() => {
    const refresh = () => setVoices(spanishVoices(region));
    refresh();
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh);
  }, [region]);
  const ua = navigator.userAgent;
  const tip = /iphone|ipad|macintosh/i.test(ua)
    ? 'Tip: in iOS / macOS Settings → Accessibility → Spoken Content → Voices → Spanish, download “Mónica”, “Paulina” or “Jorge” (Enhanced/Premium) for a much more natural voice.'
    : /edg\//i.test(ua)
      ? 'Tip: Edge includes “Microsoft … Online (Natural)” Spanish voices — choose one of those.'
      : /chrome/i.test(ua)
        ? 'Tip: in Chrome, “Google español” / “Google español de Estados Unidos” are the most natural (they need an internet connection).'
        : 'Tip: voice quality depends on the voices installed on your device; Chrome, Edge and Apple devices have the most natural ones.';
  if (!ttsSupported) return null;
  return (
    <div className="grid gap-1">
      <label className="font-medium" htmlFor="voice-pick">Spanish voice</label>
      <select id="voice-pick" className="input" value={state.settings.voiceURI ?? ''} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, voiceURI: e.target.value || undefined } }))}>
        <option value="">Best available (automatic){voices[0] ? ` — ${voices[0].name}` : ''}</option>
        {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}{/natural|neural|premium|enhanced|google|siri/i.test(v.name) ? ' ★' : ''}</option>)}
      </select>
      <span className="text-xs text-ink-mute">{voices.length ? `${voices.length} Spanish voice${voices.length === 1 ? '' : 's'} on this device (★ = more natural). ` : 'No Spanish voice found on this device. '}{tip}</span>
    </div>
  );
}

function AccountSummary() {
  const acc = useAccount();
  if (!acc.configured) return <p className="text-sm text-ink-soft">Online accounts aren’t switched on for this copy of the app yet — progress is saved on this device. Use export / import below to move it.</p>;
  if (!acc.session) return <button className="btn-primary" onClick={() => navigate('account')}><Icon name="user" size={18} /> Log in or create a free account</button>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm"><b>@{acc.session.user.username}</b> · {statusLabel(acc.status, acc.lastSyncedAt).text}</p>
      <button className="btn-ghost" onClick={() => navigate('account')}>Manage account</button>
    </div>
  );
}

export function ProfileScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { state, update, replace, notify } = useStore();
  const p = state.profile ?? blankProfile();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [recCount, setRecCount] = useState<number | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    recordingCount().then(setRecCount).catch(() => setRecCount(null));
  }, [state.profile?.voiceNotes.length]);

  const set = (patch: Partial<LearnerProfile>) => update((s) => ({ ...s, profile: { ...(s.profile ?? blankProfile()), ...patch } }));
  const toggle = <K extends 'interests' | 'reasons' | 'activities' | 'difficulties' | 'socialGoals'>(k: K, v: LearnerProfile[K][number]) => {
    const arr = p[k] as string[];
    set({ [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } as Partial<LearnerProfile>);
  };
  const setSkill = (s: Skill, l: Cefr) => set({ levels: { ...p.levels, [s]: l }, levelOverridden: true });
  const access = useLevelAccess();

  const finish = () => {
    update((s) => ({ ...s, onboardingDone: true }));
    navigate(`scene/${scenesForCity(p.city)[0]?.id ?? 'llegada'}`);
  };

  const doExport = async () => {
    const blob = await exportData(state, withAudio);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `viva-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const doImport = async (f: File) => {
    try {
      const s = await importData(await f.text());
      replace(s);
      notify('Data imported', 'Your progress was restored from the backup file.');
    } catch (e) {
      notify('Import failed', (e as Error).message);
    }
  };
  const doDelete = async () => {
    await wipeAll();
    replace(defaultState());
    setConfirmDelete(false);
    navigate('welcome');
  };

  return (
    <div className={onboarding ? 'min-h-[100dvh] bg-cream-warm px-5 py-8' : ''}>
      <div className="mx-auto max-w-3xl">
        {onboarding ? (
          <div className="mb-6 flex items-center gap-4">
            <Character look={CHARACTERS.lucia.look} mood="happy" size={96} />
            <div>
              <p className="eyebrow">¡Ya te conozco un poco!</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">Here’s your Spanish DNA</h1>
              <p className="text-ink-soft">It shapes your story, vocabulary, coach and practice. Edit anything below.</p>
            </div>
          </div>
        ) : (
          <PageHeader eyebrow="Tú" title="My Spanish DNA" subtitle="Everything here personalises your story, vocabulary, practice and coach. Edit freely." />
        )}

        <DnaStrand profile={p} />

        {onboarding && (
          <motion.button initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="btn-primary mt-5 w-full py-4 text-base" onClick={finish}>
            <Icon name="plane" size={20} /> Land in {CITY_THEMES[p.city].name}
          </motion.button>
        )}

        <div className="mt-6 grid gap-4">
          <Section title="About you">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Name<input className="input mt-1" value={p.name} onChange={(e) => set({ name: e.target.value })} /></label>
              <label className="text-sm font-medium">Work<input className="input mt-1" value={p.career} onChange={(e) => set({ career: e.target.value })} /></label>
              <label className="text-sm font-medium">Destination city<input className="input mt-1" value={p.destinationCity} onChange={(e) => set({ destinationCity: e.target.value })} /></label>
              <label className="text-sm font-medium">Country<input className="input mt-1" value={p.destinationCountry} onChange={(e) => set({ destinationCountry: e.target.value })} /></label>
            </div>
            <p className="mb-2 mt-4 text-sm font-medium">How Spanish should refer to you</p>
            <Chips label="Grammatical gender" options={GENDER} values={[p.gender]} onToggle={(v) => set({ gender: v })} />
            <p className="mb-2 mt-4 text-sm font-medium">Relocation</p>
            <Chips label="Relocation" options={RELOCATION} values={[p.relocation]} onToggle={(v) => set({ relocation: v })} />
          </Section>

          <Section title="Your city" hint={`${CITY_THEMES[p.city].varietyLabel}. The city sets the story, characters, colours and the Spanish you practise (vosotros in Spain, vos in Buenos Aires, ustedes in Latin America).`}>
            <CityPicker value={p.city} onChange={(c) => set({ city: c, region: CITY_THEMES[c].variety, destinationCity: CITY_THEMES[c].name, destinationCountry: CITY_THEMES[c].country, citiesVisited: p.citiesVisited.includes(c) ? p.citiesVisited : [...p.citiesVisited, c] })} />
          </Section>

          <Section title="Skill levels" hint={`Source: ${p.levelSource === 'assessment' ? 'placement assessment' : p.levelSource === 'zero' ? 'starting from zero' : 'self-selected'}${p.levelOverridden ? ' · manually adjusted' : ''}. Each skill is tracked separately.${access.maxLevel ? ` Your teacher has set your level to ${access.maxLevel}, so higher levels are locked.` : ''}`}>
            <div className="grid gap-2">
              {SKILLS.map((s) => (
                <div key={s} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="capitalize">{s}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`${s} level`}>
                    {CEFR_LEVELS.map((l) => (
                      <button key={l} role="radio" aria-checked={p.levels[s] === l} disabled={!withinLevel(l, access.maxLevel)} onClick={() => setSkill(s, l)} className={`h-9 w-10 rounded-xl text-sm font-semibold ring-1 transition disabled:opacity-40 ${p.levels[s] === l ? 'bg-ink text-cream ring-ink' : 'ring-ink/10 hover:ring-ink/30'}`}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!onboarding && <button className="btn-soft mt-4" onClick={() => navigate('assessment')}><Icon name="refresh" size={16} /> Retake placement</button>}
          </Section>

          <Section title="Interests" hint="Shape invitations, vocabulary packs and coach suggestions.">
            <Chips label="Interests" options={INTERESTS} values={p.interests} onToggle={(v) => toggle('interests', v)} />
          </Section>
          <Section title="Why you’re learning"><Chips label="Reasons" options={REASONS} values={p.reasons} onToggle={(v) => toggle('reasons', v)} /></Section>
          <Section title="Social life" hint="Dating unlocks an extra branch in conversations with Marta."><Chips label="Social goals" options={SOCIAL} values={p.socialGoals} onToggle={(v) => toggle('socialGoals', v)} /></Section>
          <Section title="How you like to learn" hint="Used as a starting point. The app also measures which memory techniques actually improve your recall.">
            <Chips label="Activities" options={ACTIVITIES} values={p.activities} onToggle={(v) => toggle('activities', v)} />
          </Section>
          <Section title="What feels hard"><Chips label="Difficulties" options={DIFFICULTIES} values={p.difficulties} onToggle={(v) => toggle('difficulties', v)} /></Section>
          <Section title="Self-assessed proficiency"><Chips label="Proficiency" options={PROFICIENCY} values={[p.proficiencySelf]} onToggle={(v) => set({ proficiencySelf: v })} /></Section>
          <Section title="Daily goal">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Daily minutes">
              {MINUTES.map((m) => <button key={m} className="chip" role="radio" aria-checked={p.dailyMinutes === m} onClick={() => set({ dailyMinutes: m })}>{m} min</button>)}
            </div>
          </Section>

          {p.voiceNotes.length > 0 && (
            <Section title="Your voice notes" hint="Recorded during Discover. Stored only on this device.">
              <div className="grid gap-2">
                {p.voiceNotes.map((v) => (
                  <VoiceNoteRow key={v.id} id={v.id} label={v.questionId} transcript={v.transcript} onDelete={async () => {
                    await deleteRecording(v.id);
                    set({ voiceNotes: p.voiceNotes.filter((x) => x.id !== v.id) });
                  }} />
                ))}
              </div>
            </Section>
          )}

          {!onboarding && (
            <>
              <Section title="Settings">
                <div className="grid gap-4">
                  <label className="flex items-center justify-between gap-4">
                    <span><span className="font-medium">Show streaks</span><span className="block text-sm text-ink-mute">Optional. Turn off if streaks stress you out.</span></span>
                    <input type="checkbox" className="h-5 w-5 accent-terracotta" checked={state.settings.streaksEnabled} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, streaksEnabled: e.target.checked } }))} />
                  </label>
                  <label className="flex items-center justify-between gap-4">
                    <span><span className="font-medium">Sound effects &amp; vibration</span><span className="block text-sm text-ink-mute">Chimes, combos and haptics in lessons and games.</span></span>
                    <input type="checkbox" className="h-5 w-5 accent-terracotta" checked={state.settings.sound} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))} />
                  </label>
                  <label className="flex items-center justify-between gap-4">
                    <span><span className="font-medium">Guide speaks automatically</span><span className="block text-sm text-ink-mute">Characters read their lines aloud when they appear.</span></span>
                    <input type="checkbox" className="h-5 w-5 accent-terracotta" checked={state.settings.guideVoice} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, guideVoice: e.target.checked } }))} />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span><span className="font-medium">English translations</span><span className="block text-sm text-ink-mute">In conversations.</span></span>
                    <Segmented label="Translations" value={state.settings.showTranslations} onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, showTranslations: v } }))} options={[{ value: 'on-tap', label: 'On tap' }, { value: 'always', label: 'Always' }]} />
                  </div>
                  <VoicePicker />
                  <label className="grid gap-1">
                    <span className="font-medium">Speech speed: {state.settings.speechRate.toFixed(2)}×</span>
                    <input type="range" min={0.6} max={1.1} step={0.05} value={state.settings.speechRate} className="accent-terracotta" onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, speechRate: Number(e.target.value) } }))} />
                    <button className="ctrl w-fit" onClick={() => speak('Hola, ¿qué tal? Me alegro mucho de verte.', { region: p.region, rate: state.settings.speechRate })} disabled={!ttsSupported}><Icon name="play" size={16} /> Test voice</button>
                  </label>
                </div>
              </Section>

              <Section title="Your browser’s capabilities" hint="Learning with Dina uses free, built-in browser features. Support varies.">
                <ul className="grid gap-1.5 text-sm">
                  <li className="flex justify-between"><span>Speech synthesis (guide voice)</span><b>{ttsSupported ? (hasSpanishVoice() ? 'Spanish voice found' : 'Available — no Spanish voice installed') : 'Not supported'}</b></li>
                  <li className="flex justify-between"><span>Voice recording</span><b>{recorderSupported ? 'Supported' : 'Not supported'}</b></li>
                  <li className="flex justify-between"><span>Speech recognition (transcripts)</span><b>{recognitionSupported ? 'Supported' : 'Not supported — type instead'}</b></li>
                </ul>
                {recognitionSupported && <p className="mt-2 text-xs text-ink-mute">Note: in Chrome and Edge, speech recognition audio is processed by the browser vendor’s online service. Recordings themselves are stored only on this device.</p>}
              </Section>

              <Section title="Account & cloud sync" hint="Log in with a username and password to save progress online and continue on any device.">
                <AccountSummary />
              </Section>

              <Section title="Your data" hint="Learning with Dina has no servers and no account. Everything is stored in this browser (IndexedDB) on this device.">
                <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  <li>Clearing browser data, private browsing, or some storage-saving settings can erase progress. Export a backup regularly.</li>
                  <li>Progress does not sync between devices. Use export / import to move it.</li>
                  <li>{recCount ?? 0} audio recordings stored.</li>
                </ul>
                <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-terracotta" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} /> Include audio recordings in export</label>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={doExport}><Icon name="download" size={18} /> Export my data</button>
                  <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> Import backup</button>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
                  <button className="btn bg-terracotta-50 text-terracotta-dark ring-1 ring-terracotta/30 hover:bg-terracotta/10" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} /> Delete everything</button>
                </div>
              </Section>
            </>
          )}
        </div>

        {onboarding && (
          <button className="btn-primary mt-6 w-full py-4 text-base" onClick={finish}><Icon name="plane" size={20} /> Land in {CITY_THEMES[p.city].name}</button>
        )}
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete all Learning with Dina data?">
        <p className="text-ink-soft">This permanently removes your profile, progress, story, teacher details and recordings from this device. It cannot be undone. Consider exporting a backup first.</p>
        <label className="mt-4 block text-sm font-medium">Type <b>BORRAR</b> to confirm<input className="input mt-1" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} /></label>
        <button className="btn mt-4 w-full bg-terracotta-dark text-white" disabled={deleteText.trim().toUpperCase() !== 'BORRAR'} onClick={doDelete}>Delete everything</button>
      </Sheet>
    </div>
  );
}
