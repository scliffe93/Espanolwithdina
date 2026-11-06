import { useEffect, useState } from 'react';

// Minimal hash router — works on any static host without rewrites.

export type RouteName =
  | 'welcome' | 'onboarding' | 'level' | 'assessment' | 'dna'
  | 'world' | 'scene' | 'verbs' | 'review' | 'progress' | 'teacher' | 'recap' | 'settings' | 'privacy' | 'games' | 'game' | 'account' | 'journey' | 'demo' | 'teach' | 'student' | 'homework';

export interface ParsedRoute {
  name: RouteName;
  params: URLSearchParams;
  id?: string;
}

export function parseHash(hash: string): ParsedRoute {
  const [path, q] = hash.replace(/^#\/?/, '').split('?');
  const [name, ...rest] = path.split('/');
  const id = rest.length ? rest.join('/') : undefined;
  return { name: (name || 'world') as RouteName, id, params: new URLSearchParams(q ?? '') };
}

export function navigate(to: string) {
  const next = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): ParsedRoute {
  const [r, setR] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setR(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
