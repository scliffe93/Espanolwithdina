import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { DinaArt } from './Dina';
import { Icon } from './Icon';
import { useAccount } from '../lib/account';
import { navigate } from '../lib/router';
import { resumeTarget } from '../lib/resume';
import { speak } from '../lib/speech';
import { useStore } from '../lib/store';

/** Personal greeting after signing in, straight back to the last unfinished activity. */
export function WelcomeBack() {
  const { welcome, dismissWelcome } = useAccount();
  const { state } = useStore();
  const greeting = welcome ? (welcome.isNew ? `¡Bienvenido a bordo, ${welcome.firstName}!` : `¡Hola de nuevo, ${welcome.firstName}!`) : '';
  const fem = state.profile?.gender === 'f' || state.profile?.gender === 'x' || !state.profile;
  const text = welcome?.isNew ? greeting.replace('Bienvenido', fem ? 'Bienvenida' : 'Bienvenido') : greeting;
  useEffect(() => {
    if (welcome) speak(text, { region: 'argentina', rate: 0.95, auto: true }).catch(() => undefined);
  }, [welcome, text]);
  const target = state.onboardingDone ? resumeTarget(state) : { href: 'onboarding', label: 'Set up your Spanish life with Lucía' };
  return (
    <AnimatePresence>
      {welcome && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={text}>
          <motion.div initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative w-full max-w-md overflow-hidden rounded-4xl bg-cream p-6 text-center shadow-lift">
            <div className="mx-auto w-fit"><DinaArt size={130} expression="beam" waving /></div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-terracotta" lang="es">{text}</h2>
            <p className="mt-1 text-ink-soft">{welcome.isNew ? 'Your account is ready — your progress now saves automatically.' : 'Welcome back to your Spanish adventure.'}</p>
            <button className="btn-primary mt-5 w-full py-4 text-base" autoFocus onClick={() => { dismissWelcome(); navigate(target.href); }} data-testid="welcome-continue">
              <Icon name="play" size={18} filled /> Continue learning
            </button>
            <p className="mt-2 text-sm text-ink-mute">{target.label}</p>
            <button className="mt-3 text-sm font-medium text-ink-soft underline" onClick={() => { dismissWelcome(); navigate(state.onboardingDone ? 'journey' : 'onboarding'); }}>{state.onboardingDone ? 'See my learning journey' : 'Start'}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
