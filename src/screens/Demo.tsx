import { motion } from 'motion/react';
import { useState } from 'react';
import { DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { PageHeader, Sheet } from '../components/ui';
import { useAccount } from '../lib/account';
import { usePlatform, type DemoActor } from '../lib/platform/context';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

const ROLES: { actor: Exclude<DemoActor, null>; name: string; role: string; blurb: string; to: string; tone: string }[] = [
  { actor: 'dina', name: 'Dina', role: 'Teacher', blurb: 'Today’s lessons, calendar, both students, homework to review.', to: 'teach', tone: 'bg-terracotta text-white' },
  { actor: 'sam', name: 'Sam', role: 'Student · Madrid · A2', blurb: 'His next lesson, homework, feedback from Dina and learning journey.', to: 'student', tone: 'bg-azul text-white' },
  { actor: 'anneka', name: 'Anneka', role: 'Student · Valencia · A1', blurb: 'Her next lesson, homework, feedback from Dina and learning journey.', to: 'student', tone: 'bg-olive text-white' },
];

/** Prototype landing: open the platform as Dina, Sam or Anneka without a password. */
export function Demo() {
  const { switchDemo, resetDemo, demoActor, demoAvailable } = usePlatform();
  const account = useAccount();
  const { state } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const enter = async (actor: Exclude<DemoActor, null>, to: string) => {
    setBusy(actor);
    await switchDemo(actor);
    setBusy(null);
    navigate(to);
  };

  return (
    <div className={state.onboardingDone || demoActor ? '' : 'min-h-[100dvh] bg-cream-warm px-5 py-8'}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Prototype · demonstration mode" title="Try the teaching platform" subtitle="Open Dina’s teacher dashboard or either student’s dashboard — no password needed in the demo. Everything you change (lessons, homework, completed work) is saved on this device so you can switch between them and see the updates." />
        {!demoAvailable && (
          <div className="card mb-4 p-4 text-sm">You’re signed in as <b>@{account.session?.user.username}</b>. The demo uses separate, fictional accounts — log out from your account page to open it.</div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <motion.button key={r.actor} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} disabled={!demoAvailable || !!busy} onClick={() => enter(r.actor, r.to)} className={`relative overflow-hidden rounded-4xl p-5 text-left shadow-lift disabled:opacity-50 ${r.tone}`} data-testid={`demo-${r.actor}`}>
              {r.actor === 'dina' && <span className="absolute -right-2 -top-2 opacity-90"><DinaArt size={88} expression="beam" animate={false} /></span>}
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{r.role}</p>
              <p className="mt-1 font-display text-4xl font-semibold">{r.name}</p>
              <p className="mt-2 max-w-[22ch] text-sm opacity-90">{r.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">{busy === r.actor ? 'Opening…' : demoActor === r.actor ? 'Continue' : 'Open'} <Icon name="arrowRight" size={14} /></span>
            </motion.button>
          ))}
        </div>
        <div className="card mt-5 p-5 text-sm text-ink-soft">
          <p><b className="text-ink">About the demonstration data.</b> Dina, Sam and Anneka are fictional. Their lessons, homework and feedback are sample data, and their learning statistics are computed from sample study sessions replayed through the app’s real tracking — so every number on the dashboards is genuinely calculated, just over invented activity. Real learner accounts are kept completely separate and never see demo data.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="ctrl" onClick={() => setConfirmReset(true)}><Icon name="refresh" size={15} /> Reset demo data</button>
            {demoActor && <button className="ctrl" onClick={async () => { await switchDemo(null); navigate(state.onboardingDone ? 'world' : 'welcome'); }}><Icon name="x" size={15} /> Leave the demo</button>}
          </div>
        </div>
      </div>
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset the demonstration?">
        <p className="text-ink-soft">Sam’s and Anneka’s progress, all demo lessons, homework and feedback go back to the original sample data. Your own real progress is not affected.</p>
        <button className="btn-primary mt-4" onClick={async () => { await resetDemo(); setConfirmReset(false); }}>Reset demo data</button>
      </Sheet>
    </div>
  );
}
