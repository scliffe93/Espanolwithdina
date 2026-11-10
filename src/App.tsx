import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './components/Icon';
import { Toasts } from './components/ui';
import { BrandLogo } from './components/BrandLogo';
import { SyncBadge } from './components/SyncBadge';
import { WelcomeBack } from './components/WelcomeBack';
import { Account } from './screens/Account';
import { Journey } from './screens/Journey';
import { resumeLabel } from './lib/resume';
import { usePlatform } from './lib/platform/context';
import { Demo } from './screens/Demo';
import { Guide } from './screens/Guide';
import { Admin } from './screens/Admin';
import { TeacherApp } from './screens/teach/TeacherApp';
import { HomeworkRunner, StudentApp } from './screens/student/StudentApp';
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
import { Penalty } from './screens/games/Penalty';
import { Derbi } from './screens/games/Derbi';
import { LineUp } from './screens/games/LineUp';

type NavItem = { name: RouteName; label: string; es: string; icon: IconName; mobile?: boolean; sub?: string };
const TEACHER_NAV: NavItem[] = [
  { name: 'teach', label: 'Today', es: 'Hoy', icon: 'home', mobile: true },
  { name: 'teach', sub: 'calendar', label: 'Calendar', es: 'Agenda', icon: 'calendar', mobile: true },
  { name: 'teach', sub: 'students', label: 'Students', es: 'Alumnos', icon: 'user', mobile: true },
  { name: 'teach', sub: 'homework', label: 'Homework', es: 'Deberes', icon: 'book', mobile: true },
  { name: 'teach', sub: 'invoices', label: 'Invoices', es: 'Facturas', icon: 'mail' },
  { name: 'demo', label: 'Switch person', es: 'Cambiar', icon: 'refresh', mobile: true },
  { name: 'account', label: 'Account', es: 'Cuenta', icon: 'settings', mobile: true },
  { name: 'guide', label: 'How to use', es: 'Guía', icon: 'book' },
];
const NAV: NavItem[] = [
  { name: 'world', label: 'My city', es: 'Ciudad', icon: 'map', mobile: true },
  { name: 'games', label: 'Arcade', es: 'Juegos', icon: 'sparkle', mobile: true },
  { name: 'verbs', label: 'Verbs', es: 'Verbos', icon: 'dumbbell', mobile: true },
  { name: 'review', label: 'Memory', es: 'Memoria', icon: 'brain', mobile: true },
  { name: 'journey', label: 'My journey', es: 'Mi camino', icon: 'star', mobile: true },
  { name: 'progress', label: 'Statistics', es: 'Progreso', icon: 'chart' },
  { name: 'teacher', label: 'Teacher', es: 'Profe', icon: 'mail' },
  { name: 'settings', label: 'Me', es: 'Tú', icon: 'user', mobile: true },
];

const LEARNING: RouteName[] = ['scene', 'verbs', 'review', 'assessment', 'game', 'homework'];
const RESUMABLE: RouteName[] = ['scene', 'verbs', 'review', 'game'];

function TimerPill({ compact }: { compact?: boolean }) {
  const { timer, state } = useStore();
  const mins = Math.floor(todaySeconds(state) / 60);
  const on = timer === 'active' || timer === 'listening';
  const label = timer === 'listening' ? 'Listening' : on ? 'Studying' : timer === 'not-learning' ? 'Timer off here' : 'Paused';
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium ring-1 ring-ink/10" title="Active learning time counts only on learning screens while you’re interacting (or audio is playing)." aria-live="off">
      <span className={`h-2 w-2 rounded-full ${on ? 'bg-olive animate-pulse' : 'bg-ink/25'}`} aria-hidden />
      {compact ? `${mins} min` : `${label} · ${mins} min today`}
    </span>
  );
}

function DemoPill() {
  const { demoActor, me } = usePlatform();
  if (!demoActor || !me) return null;
  return (
    <button onClick={() => navigate('demo')} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-saffron px-3 py-1.5 text-xs font-bold text-ink shadow-soft" title="Prototype demonstration — switch between Dina, Sam and Anneka" data-testid="demo-pill">
      <Icon name="sparkle" size={13} /> Demo · {me.firstName} · Switch <Icon name="refresh" size={12} />
    </button>
  );
}

function Shell({ children, route, routeId }: { children: ReactNode; route: RouteName; routeId?: string }) {
  const { me, demoActor } = usePlatform();
  const teacher = me?.role === 'teacher' || me?.role === 'admin';
  const items = teacher ? [...TEACHER_NAV.filter((n) => (n.name === 'demo' ? !!demoActor : n.name === 'account' ? !demoActor : true)), ...(me?.role === 'admin' ? [{ name: 'admin' as RouteName, label: 'Admin', es: 'Administración', icon: 'shield' as IconName, mobile: true }] : [])] : me?.role === 'student' ? [{ name: 'student' as RouteName, label: 'My lessons', es: 'Clases', icon: 'calendar' as IconName, mobile: true }, ...(demoActor ? [{ name: 'demo' as RouteName, label: 'Switch person', es: 'Cambiar', icon: 'refresh' as IconName, mobile: true }] : []), { name: 'guide' as RouteName, label: 'How to use', es: 'Guía', icon: 'book' as IconName }, ...NAV.filter((n) => n.name !== 'progress' && n.name !== 'teacher')] : [...NAV, { name: 'home' as RouteName, label: 'Lessons with Dina', es: 'Clases', icon: 'calendar' as IconName, mobile: true }];
  const sub = routeId?.split('/')[0];
  const isActive = (n: NavItem) => {
    if (teacher) return route === 'teach' ? (n.name === 'teach' && (n.sub ?? '') === (sub && ['calendar', 'students', 'homework', 'invoices'].includes(sub) ? sub : sub === 'student' ? 'students' : '')) : n.name === route;
    const a = route === 'scene' || route === 'recap' ? 'world' : route === 'privacy' || route === 'account' ? 'settings' : route === 'game' ? 'games' : route === 'progress' ? 'journey' : route === 'homework' ? 'student' : route;
    return a === n.name;
  };
  const go = (n: NavItem) => navigate(n.sub ? `${n.name}/${n.sub}` : n.name);
  return (
    <div className="min-h-[100dvh] bg-cream">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-cream">Skip to content</a>
      {/* Desktop side rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink/5 bg-[#F4E7D3]/60 p-5 backdrop-blur lg:flex">
        <div className="mb-6"><BrandLogo variant="rail" /></div>
        <nav className="grid gap-1" aria-label="Main">
          {items.map((n) => (
            <button key={`${n.name}/${n.sub ?? ''}`} onClick={() => go(n)} aria-current={isActive(n) ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-medium transition ${isActive(n) ? 'text-white' : 'text-ink-soft hover:bg-white/70 hover:text-ink'}`}>
              {isActive(n) && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-terracotta shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative flex w-full items-center gap-3"><Icon name={n.icon} size={20} /> {n.label} <span className={`ml-auto text-xs ${isActive(n) ? 'text-white/70' : 'text-ink-mute'}`}>{n.es}</span></span>
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-2"><DemoPill /><SyncBadge />{!teacher && <TimerPill />}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/5 bg-cream/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <BrandLogo variant="bar" />
        <div className="flex min-w-0 items-center gap-1.5"><DemoPill /><SyncBadge compact />{!teacher && <TimerPill compact />}</div>
      </header>

      <main id="main" className="px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-cream/90 pb-safe backdrop-blur lg:hidden" aria-label="Main">
        <div className={`mx-auto grid max-w-lg ${items.filter((n) => n.mobile).length <= 5 ? 'grid-cols-5' : items.filter((n) => n.mobile).length === 6 ? 'grid-cols-6' : 'grid-cols-7'}`}>
          {items.filter((n) => n.mobile).map((n) => (
            <button key={`${n.name}/${n.sub ?? ''}`} onClick={() => go(n)} aria-current={isActive(n) ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 pt-2 text-[10.5px] font-semibold ${isActive(n) ? 'text-terracotta' : 'text-ink-mute'}`}>
              {isActive(n) && <motion.span layoutId="tab-pill" className="absolute inset-x-2 top-1 h-9 rounded-2xl bg-terracotta-50" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
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
  const { ready, state, setLearning, update } = useStore();
  const route = useRoute();

  useEffect(() => {
    setLearning(LEARNING.includes(route.name));
    stopSpeaking();
  }, [route.name, route.id, setLearning]);

  // Remember the last learning activity for "Continue learning" on any device.
  useEffect(() => {
    if (!ready || !state.onboardingDone || !RESUMABLE.includes(route.name)) return;
    const label = resumeLabel(route.name, route.id, route.params);
    if (!label) return;
    const href = `${route.name}${route.id ? `/${route.id}` : ''}${route.params.toString() ? `?${route.params.toString()}` : ''}`;
    update((s) => (s.resume?.route === href ? s : { ...s, resume: { route: href, label, at: Date.now() } }));
  }, [ready, state.onboardingDone, route.name, route.id, route.params, update]);

  // Route guards
  useEffect(() => {
    if (!ready) return;
    const pre: RouteName[] = ['home', 'guide', 'admin', 'welcome', 'onboarding', 'level', 'assessment', 'dna', 'privacy', 'account', 'demo', 'teach', 'student', 'homework'];
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
      case 'account': screen = <Account />; break;
      case 'demo': screen = <Demo showDemo />; break;
      case 'home': screen = <Demo />; break;
      case 'guide': screen = <Guide />; break;
      case 'admin': case 'teach': case 'student': case 'homework':
        // The platform can be used before onboarding (Dina and the admin have no learner profile of their own).
        return <><Toasts /><WelcomeBack /><Shell route={route.name} routeId={route.id}>{route.name === 'admin' ? <Admin /> : <PlatformScreen route={route.name} id={route.id} params={route.params} />}</Shell></>;
      default: screen = <Welcome />;
    }
    return <><Toasts /><WelcomeBack />{screen}</>;
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
    case 'demo': screen = <Demo showDemo />; break;
    case 'home': screen = <Demo />; break;
    case 'guide': screen = <Guide />; break;
    case 'admin': screen = <Admin />; break;
    case 'teach': case 'student': case 'homework': screen = <PlatformScreen route={route.name} id={route.id} params={route.params} />; break;
    case 'account': screen = <Account />; break;
    case 'journey': screen = <Journey />; break;
    case 'game':
      screen = route.id === 'order' ? <OrderUp key="order" /> : route.id === 'swipe' ? <SwipeCheck key="swipe" /> : route.id === 'serestar' ? <SerEstarDrop key="serestar" /> : route.id === 'penalty' ? <Penalty key="penalty" /> : route.id === 'derbi' ? <Derbi key="derbi" /> : route.id === 'lineup' ? <LineUp key="lineup" /> : <MetroRush key="metro" />;
      break;
    default: screen = <World />;
  }

  return (
    <>
      <Toasts />
      <WelcomeBack />
      <Shell route={route.name} routeId={route.id}>
        <AnimatePresence mode="wait">
          <motion.div key={route.name + (route.id ?? '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {screen}
          </motion.div>
        </AnimatePresence>
      </Shell>
    </>
  );
}

/** Teacher / student platform screens, guarded by role. */
function PlatformScreen({ route, id, params }: { route: RouteName; id?: string; params: URLSearchParams }) {
  const { me, ready } = usePlatform();
  if (!ready) return null;
  if (!me) return <Demo />;
  if (route === 'teach') {
    if (me.role !== 'teacher' && me.role !== 'admin') return <StudentApp page="home" params={params} />;
    const [page, ...rest] = (id ?? '').split('/');
    return <TeacherApp page={page || undefined} id={rest.join('/') || undefined} params={params} />;
  }
  if (route === 'homework') {
    if (!id) return <StudentApp page="homework" params={params} />;
    return <HomeworkRunner id={id} />;
  }
  if (me.role === 'teacher' || me.role === 'admin') return <TeacherApp page={id} params={params} />;
  return <StudentApp page={id} params={params} />;
}
