import { Icon } from '../components/Icon';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

export function Privacy() {
  const { state } = useStore();
  return (
    <div className={state.onboardingDone ? '' : 'min-h-[100dvh] bg-cream-warm px-5 py-8'}>
      <article className="mx-auto max-w-2xl">
        <button className="ctrl mb-6" onClick={() => navigate(state.onboardingDone ? 'settings' : 'welcome')}><Icon name="arrowLeft" size={16} /> Back</button>
        <p className="eyebrow">Privacy & how Learning with Dina works</p>
        <h1 className="mt-1 text-4xl font-semibold">Your Spanish life stays on your device</h1>
        <div className="mt-6 grid gap-4 text-ink-soft">
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">No account, no server</h2><p className="mt-1">Your profile, progress, story, teacher details and voice recordings are stored in this browser’s IndexedDB. Learning with Dina has no backend and sends none of it anywhere.</p></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">If you log in</h2><p className="mt-1">With an account, your progress, lessons, homework and feedback are saved to the Learning with Dina server so you and your teacher can see them on any device. Voice recordings stay on your device.</p></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">Notifications</h2><ul className="mt-1 list-disc space-y-1 pl-5"><li>Notifications are off until you turn them on, on each device, and you can turn them off again at any time from your account page.</li><li>Turning them on stores that device’s notification address against your account. It is used only to send you news about your lessons and homework, and is removed when you turn them off, log out or delete your account.</li><li>Messages are encrypted for your device. Apple, Google or Mozilla deliver them but cannot read them.</li></ul></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">Limits of local-only storage</h2><ul className="mt-1 list-disc space-y-1 pl-5"><li>Clearing site data, using a private window, or some browser storage clean-ups erase progress.</li><li>Progress doesn’t sync between devices or browsers. Use Export / Import in My Spanish DNA to back up or move it.</li><li>The app is designed so cloud sync can be added later as an optional feature.</li></ul></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">Speech features</h2><ul className="mt-1 list-disc space-y-1 pl-5"><li>The guide’s voice uses your browser’s built-in speech synthesis. Voice quality and accent depend on your device; some systems have no Spanish voice installed.</li><li>Recordings use your microphone via the MediaRecorder API and are saved only on this device. You can play and delete them at any time.</li><li>Speech recognition (transcripts) is available in Chrome, Edge and Safari, not Firefox. In Chrome and Edge the audio is processed by the browser vendor’s online service. Typing always works instead.</li><li>The app does not give pronunciation scores — there is no validated free method in the browser. Compare your recording with the guide by ear.</li></ul></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">Coach & AI</h2><p className="mt-1">The coach is a transparent, rules-based system: every suggestion shows the evidence behind it. No AI service is used. The architecture leaves room for optional AI features in future, which would always be opt-in.</p></section>
          <section className="card p-5"><h2 className="text-lg font-semibold text-ink">Teacher emails</h2><p className="mt-1">“Email my teacher” opens your own email app with a pre-filled draft. Nothing is sent until you press send yourself, and the PDF must be attached manually.</p></section>
        </div>
      </article>
    </div>
  );
}
