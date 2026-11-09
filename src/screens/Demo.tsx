import { motion } from 'motion/react';
import { useState } from 'react';
import { DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { PageHeader, Sheet } from '../components/ui';
import { useAccount } from '../lib/account';
import { cloudConfigured, forgetAccount, knownAccounts, type KnownAccount } from '../lib/cloud';
import { usePlatform, type DemoActor } from '../lib/platform/context';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

const ROLES: { actor: Exclude<DemoActor, null>; name: string; role: string; blurb: string; to: string; tone: string }[] = [
  { actor: 'dina', name: 'Dina', role: 'Teacher', blurb: 'Today’s lessons, calendar, both students, homework to review.', to: 'teach', tone: 'bg-terracotta text-white' },
  { actor: 'sam', name: 'Sam', role: 'Student · Madrid · A2', blurb: 'His next lesson, homework, feedback from Dina and learning journey.', to: 'student', tone: 'bg-azul text-white' },
  { actor: 'anneka', name: 'Anneka', role: 'Student · Valencia · A1', blurb: 'Her next lesson, homework, feedback from Dina and learning journey.', to: 'student', tone: 'bg-olive text-white' },
];

/**
 * The front page: continue as whoever is signed in, pick a person who has used this device,
 * create an account or log in, learn without an account, or try the demonstration.
 */
export function Demo() {
  const { switchDemo, resetDemo, demoActor, demoAvailable } = usePlatform();
  const account = useAccount();
  const { state } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [known, setKnown] = useState<KnownAccount[]>(() => knownAccounts());

  const enter = async (actor: Exclude<DemoActor, null>, to: string) => {
    setBusy(actor);
    await switchDemo(actor);
    setBusy(null);
    navigate(to);
  };

  const role = account.session?.user.role;
  const signedIn = !!account.session;
  const others = known.filter((k) => k.username.toLowerCase() !== account.session?.user.username.toLowerCase());
  const standalone = !state.onboardingDone && !demoActor && !role;

  return (
    <div className={standalone ? 'min-h-[100dvh] bg-cream-warm px-5 py-8' : ''}>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <PageHeader eyebrow="Clases con Dina" title="Lessons with Dina" subtitle={cloudConfigured ? 'Your lessons, homework and feedback, saved to your account and ready on every device.' : 'Online accounts aren’t configured for this copy of the app yet, so the platform runs as a demonstration on this device.'} />
          </div>
          <div className="hidden shrink-0 sm:block" aria-hidden><DinaArt size={120} expression="beam" /></div>
        </div>

        {signedIn && (
          <section className="card mb-4 flex flex-wrap items-center gap-4 p-5" data-testid="platform-signed-in">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Signed in as @{account.session?.user.username}{role === 'teacher' ? ' · teacher' : role === 'student' ? ' · student' : ''}</p>
              <p className="text-ink-soft">{role === 'teacher' ? 'Your real students, lessons and homework.' : role ? 'Your next lesson, homework and Dina’s feedback.' : 'Checking your account…'}</p>
            </div>
            {role && <button className="btn-primary" onClick={() => navigate(role === 'teacher' ? 'teach' : 'student')} data-testid="continue-signed-in">{role === 'teacher' ? 'Open the teacher dashboard' : 'Open my lessons'} <Icon name="arrowRight" size={16} /></button>}
            <button className="ctrl" onClick={() => navigate('account')}>Account</button>
          </section>
        )}

        {cloudConfigured && (
          <section className="card mb-4 p-5">
            <h2 className="eyebrow mb-3">{others.length ? 'Who is this?' : 'Teacher and students'}</h2>
            {others.length > 0 && (
              <ul className="mb-4 grid gap-2 sm:grid-cols-2" data-testid="known-accounts">
                {others.map((k) => (
                  <li key={k.username} className="flex items-center gap-3 rounded-2xl bg-cream-100 p-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-xl font-semibold text-white ${k.role === 'teacher' ? 'bg-terracotta' : 'bg-azul'}`} aria-hidden>{k.firstName.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{k.firstName} <span className="font-normal text-ink-mute">@{k.username}</span></p>
                      <p className="text-xs text-ink-mute">{k.role === 'teacher' ? 'Teacher' : 'Student'} · enter password to continue</p>
                    </div>
                    <button type="button" className="btn-dark !py-2" onClick={() => navigate(`account?user=${encodeURIComponent(k.username)}`)} data-testid={`known-${k.username}`}>Log in <Icon name="arrowRight" size={14} /></button>
                    <button type="button" className="ctrl !px-2" aria-label={`Forget ${k.firstName} on this device`} title="Forget on this device" onClick={() => { forgetAccount(k.username); setKnown(knownAccounts()); }}><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => navigate('account?mode=register')} data-testid="create-account"><Icon name="user" size={16} /> Create a new account</button>
              <button className="btn-ghost" onClick={() => navigate('account?mode=login')} data-testid="log-in">Log in</button>
            </div>
            <p className="mt-3 text-xs text-ink-mute">Students: use the username and password Dina gave you, or create an account and Dina will see you in her list. Your learning progress syncs too.</p>
          </section>
        )}

        <section className="card mb-6 flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Learn on your own</p>
            <p className="text-ink-soft">Choose your city and start the storyline, verbs and games without an account. You can add one later and keep your progress.</p>
          </div>
          <button className="ctrl" onClick={() => navigate(state.onboardingDone ? 'world' : 'welcome')} data-testid="learn-solo">{state.onboardingDone ? 'Back to my city' : 'Start learning'} <Icon name="arrowRight" size={14} /></button>
        </section>

        {!demoAvailable && !demoActor && (
          <div className="card mb-4 p-4 text-sm">The demonstration uses separate, fictional accounts (Dina, Sam and Anneka) — log out from your account page to open it.</div>
        )}
        {(demoAvailable || demoActor) && <>
        <h2 className="eyebrow mb-3">Try the demonstration — no password needed</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <motion.button key={r.actor} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} disabled={!demoAvailable || !!busy} onClick={() => enter(r.actor, r.to)} className={`relative overflow-hidden rounded-4xl p-5 text-left shadow-lift disabled:opacity-50 ${r.tone}`} data-testid={`demo-${r.actor}`}>
              {r.actor === 'dina' && <span className="absolute -right-2 -top-2 opacity-90"><DinaArt size={88} expression="beam" animate={false} /></span>}
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{r.role}</p>
              <p className="mt-1 font-display text-4xl font-semibold">{r.name}</p>
              <p className="mt-2 max-w-[22ch] text-sm opacity-90">{r.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">{busy === r.actor ? 'Opening…' : demoActor === r.actor ? 'Continue' : demoActor ? `Switch to ${r.name}` : 'Open'} <Icon name="arrowRight" size={14} /></span>
            </motion.button>
          ))}
        </div>
        <div className="card mt-5 p-5 text-sm text-ink-soft">
          <p><b className="text-ink">About the demonstration data.</b> Dina, Sam and Anneka are fictional. Their lessons, homework and feedback are sample data, and their learning statistics are computed from sample study sessions replayed through the app’s real tracking — so every number on the dashboards is genuinely calculated, just over invented activity. Real accounts are kept completely separate and never see demo data.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="ctrl" onClick={() => setConfirmReset(true)}><Icon name="refresh" size={15} /> Reset demo data</button>
            {demoActor && <button className="ctrl" onClick={async () => { await switchDemo(null); navigate('home'); }}><Icon name="x" size={15} /> Leave the demo</button>}
          </div>
        </div>
        </>}
      </div>
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset the demonstration?">
        <p className="text-ink-soft">Sam’s and Anneka’s progress, all demo lessons, homework and feedback go back to the original sample data. Your own real progress is not affected.</p>
        <button className="btn-primary mt-4" onClick={async () => { await resetDemo(); setConfirmReset(false); }}>Reset demo data</button>
      </Sheet>
    </div>
  );
}
