import type { SVGProps } from 'react';

// Hand-drawn 24px stroke icon set (no external dependency).
const PATHS: Record<string, string> = {
  play: 'M7 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L8.5 4.64A1 1 0 0 0 7 5.5Z',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  slow: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l2.5 2.5',
  translate: 'M4 5h8M8 3v2m2.5 0c-.8 4-3.3 7-6.5 8.5M6 9c1 2 3 3.5 5 4.5M13 21l4-9 4 9m-6.8-3h5.6',
  book: 'M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 21h13',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3',
  compare: 'M8 4v16M16 4v16M4 8h8M12 16h8',
  stop: 'M7 7h10v10H7z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  arrowRight: 'M5 12h14m-5-6 6 6-6 6',
  arrowLeft: 'M19 12H5m5-6-6 6 6 6',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  dumbbell: 'M6 7v10M3 9v6m15-8v10m3-8v6M6 12h12',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3.5 3.5C9 8 9 6 9 5c-2 2-3 5-3 10a6 6 0 0 0 6 6Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
  plane: 'M10.5 21l1.5-6 6.5 1.5L21 15l-9-5V5a1.5 1.5 0 0 0-3 0v5l-7 4 1 1.5 6-1.5-.5 4.5L6 20l.5 1h4Z',
  key: 'M14 10a4 4 0 1 0-3.9 4.9L8 17l2 2-1 1 1 1 2-2 1-1-.9-.9A4 4 0 0 0 14 10Zm2.5-2.5h.01',
  cup: 'M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8Zm13 1h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2m4-2v2m4-2v2',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  bow: 'M12 5a2 2 0 1 0 0-.01M8 21l1-9 3 2 3-2 1 9M9 12l-3-2m9 2 3-2',
  volume: 'M4 9v6h4l5 4V5L8 9H4Zm12 .5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10',
  volumeOff: 'M4 9v6h4l5 4V5L8 9H4Zm12 1 5 5m0-5-5 5',
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4v-9Z',
  chat: 'M5 5h14v10H9l-4 4V5Z',
  pause: 'M8 5v14m8-14v14',
  keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  refresh: 'M20 11a8 8 0 0 0-14.7-4.3M4 4v4h4m-4 5a8 8 0 0 0 14.7 4.3M20 20v-4h-4',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, filled, ...rest }: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
