import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './components/Icon';
import { Toasts } from './components/ui';
import { BrandLogo } from './components/BrandLogo';
import { stopSpeaking } from './lib/speech';
import { navigate, useRoute, type RouteName } from './lib/router';
import { useStore } from './lib/store';
import { todaySeconds } from './lib/analytics';
import { weekId } from './lib/dates';
import { Onboarding, Welcome } from './screens/Onboarding';
import { Assessment, LevelChoice } from './screens/Level';
import { ProfileScreen } from './screens/Profile';
import { World } from './screens/World';
import { ScenePlayer } from './screens/ScenePlayer';
import { Verbs } from './screens/Verbs';
import { Review } from './screens/Review';
import { Progress } from './screens/Progress';
import { Teacher } from './screens/Teacher';
import { Recap } from './screens/Recap';
import { Privacy } from './screens/Privacy';
import { Arcade } from './screens/games/Arcade';
import { MetroRush } from './screens/games/MetroRush';
import { OrderUp } from './screens/games/OrderUp';
import { SwipeCheck } from './screens/games/SwipeCheck';
import { SerEstarDrop } from './screens/games/SerEstarDrop';

const NAV: { name: RouteName; label: string; es: string; icon: IconName; mobile?: boolean }[] = [
  { name: 'world', label: 'My city', es: 'Ciudad', icon: 'map', mobile: true },
  { name: 'games', label: 'Arcade', es: 'Juegos', icon: 'sparkle', mobile: true },
  { name: 'verbs', label: 'Verbs', es: 'Verbos', icon: 'dumbbell', mobile: true },
  { name: 'review', label: 'Memory', es: 'Memoria', icon: 'brain', mobile: true },
  { name: 'progress', label: 'Progress', es: 'Progreso', icon: 'chart', mobile: true },
  { name: 'teacher', label: 'Teacher', es: 'Profe', icon: 'mail' },
  { name: 'settings', label: 'Me', es: 'Tú', icon: 'user', mobile: true },
];

const LEARNING: RouteName[] = ['scene', 'verbs', 'review', 'assessment', 'game'];

function TimerPill() {
  const { timer, state } = useStore();
  const mins = Math.floor(todaySeconds(state) / 60);
  const on = timer === 'active' || timer === 'listening';
  const label = timer === 'listening' ? 'Listening' : on ? 'Studying' : timer === 'not-learning' ? 'Timer off here' : 'Paused';
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium ring-1 ring-ink/10" title="Active learning time counts only on learning screens while you’re interacting (or audio is playing)." aria-live="off">
      <span className={`h-2 w-2 rounded-full ${on ? 'bg-olive animate-pulse' : 'bg-ink/25'}`} aria-hidden />
      {label} · {mins} min today
    </span>
  );
}

function Shell({ children, route }: { children: ReactNode; route: RouteName }) {
  const active = route === 'scene' || route === 'recap' ? 'world' : route === 'privacy' ? 'settings' : route === 'game' ? 'games' : route;
  return (
    <div className="min-h-[100dvh] bg-cream">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-cream">Skip to content</a>
      {/* Desktop side rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink/5 bg-[#F4E7D3]/60 p-5 backdrop-blur lg:flex">
        <div className="mb-6"><BrandLogo variant="rail" /></div>
        <nav className="grid gap-1" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.name} onClick={() => navigate(n.name)} aria-current={active === n.name ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-medium transition ${active === n.name ? 'text-white' : 'text-ink-soft hover:bg-white/70 hover:text-ink'}`}>
              {active === n.name && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-terracotta shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative flex w-full items-center gap-3"><Icon name={n.icon} size={20} /> {n.label} <span className={`ml-auto text-xs ${active === n.name ? 'text-white/70' : 'text-ink-mute'}`}>{n.es}</span></span>
            </button>
          ))}
        </nav>
        <div className="mt-auto"><TimerPill /></div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/5 bg-cream/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <BrandLogo variant="bar" />
        <TimerPill />
      </header>

      <main id="main" className="px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-cream/90 pb-safe backdrop-blur lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.filter((n) => n.mobile).map((n) => (
            <button key={n.name} onClick={() => navigate(n.name)} aria-current={active === n.name ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 pt-2 text-[10.5px] font-semibold ${active === n.name ? 'text-terracotta' : 'text-ink-mute'}`}>
              {active === n.name && <motion.span layoutId="tab-pill" className="absolute inset-x-2 top-1 h-9 rounded-2xl bg-terracotta-50" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <span className="relative"><Icon name={n.icon} size={22} /></span>
              <span className="relative">{n.es}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  const { ready, state, setLearning } = useStore();
  const route = useRoute();

  useEffect(() => {
    setLearning(LEARNING.includes(route.name));
    stopSpeaking();
  }, [route.name, route.id, setLearning]);

  // Route guards
  useEffect(() => {
    if (!ready) return;
    const pre: RouteName[] = ['welcome', 'onboarding', 'level', 'assessment', 'dna', 'privacy'];
    if (!state.onboardingDone && !pre.includes(route.name)) navigate('welcome');
    if (state.onboardingDone && ['welcome', 'onboarding', 'level', 'dna'].includes(route.name)) navigate('world');
  }, [ready, state.onboardingDone, route.name]);

  // Surface the weekly recap once per week, on Sunday or later in the week's last days, if there's data.
  useEffect(() => {
    if (!ready || !state.onboardingDone || route.name !== 'world') return;
    const dow = new Date().getDay();
    if ((dow === 0 || dow === 6) && state.seenRecapWeek !== weekId() && todaySeconds(state) > 0) navigate('recap');
  }, [ready, route.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#F4E7D3]">
        <motion.p className="font-display text-5xl font-semibold" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>Learning with Dina</motion.p>
      </div>
    );
  }

  let screen: ReactNode;
  if (!state.onboardingDone) {
    switch (route.name) {
      case 'onboarding': screen = <Onboarding />; break;
      case 'level': screen = <LevelChoice />; break;
      case 'assessment': screen = <Assessment />; break;
      case 'dna': screen = <ProfileScreen onboarding />; break;
      case 'privacy': screen = <Privacy />; break;
      default: screen = <Welcome />;
    }
    return <><Toasts />{screen}</>;
  }

  switch (route.name) {
    case 'scene': screen = <ScenePlayer key={route.id} id={route.id ?? 'llegada'} />; break;
    case 'verbs': screen = <Verbs params={route.params} />; break;
    case 'review': screen = <Review />; break;
    case 'progress': screen = <Progress />; break;
    case 'teacher': screen = <Teacher />; break;
    case 'recap': screen = <Recap />; break;
    case 'settings': screen = <ProfileScreen />; break;
    case 'privacy': screen = <Privacy />; break;
    case 'assessment': screen = <Assessment />; break;
    case 'games': screen = <Arcade />; break;
    case 'game':
      screen = route.id === 'order' ? <OrderUp key="order" /> : route.id === 'swipe' ? <SwipeCheck key="swipe" /> : route.id === 'serestar' ? <SerEstarDrop key="serestar" /> : <MetroRush key="metro" />;
      break;
    default: screen = <World />;
  }

  return (
    <>
      <Toasts />
      <Shell route={route.name}>
        <AnimatePresence mode="wait">
          <motion.div key={route.name + (route.id ?? '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {screen}
          </motion.div>
        </AnimatePresence>
      </Shell>
    </>
  );
}
