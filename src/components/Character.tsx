import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import type { CharacterLook } from '../data/story';

export type Mood = 'idle' | 'happy' | 'thinking' | 'wave' | 'surprised' | 'listening';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Natural, irregular blinking. */
function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setClosed(true);
        window.setTimeout(() => setClosed(false), 130);
        // occasional double blink
        if (Math.random() < 0.2) window.setTimeout(() => { setClosed(true); window.setTimeout(() => setClosed(false), 110); }, 300);
        loop();
      }, 2200 + Math.random() * 3800);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [enabled]);
  return closed;
}

/** Mouth openness while speaking — varies like syllables. */
function useMouth(speaking: boolean, slow: boolean) {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    if (!speaking) {
      setOpen(0);
      return;
    }
    const iv = window.setInterval(() => setOpen(Math.random() < 0.18 ? 0.1 : 0.35 + Math.random() * 0.65), slow ? 200 : 115);
    return () => window.clearInterval(iv);
  }, [speaking, slow]);
  return open;
}

export function Character({
  look,
  speaking = false,
  mood = 'idle',
  size = 200,
  framed = true,
  label,
  className,
}: {
  look: CharacterLook;
  speaking?: boolean;
  mood?: Mood;
  size?: number;
  framed?: boolean;
  label?: string;
  className?: string;
}) {
  const reduced = !!useReducedMotion();
  const blink = useBlink(true);
  const mouth = useMouth(speaking, reduced);
  const uid = useId().replace(/:/g, '');
  const skinShadow = shade(look.skin, -0.09);
  const hairDark = shade(look.hair, -0.08);
  const browRaise = mood === 'surprised' ? -5 : mood === 'happy' || mood === 'wave' ? -2 : mood === 'thinking' ? -3 : 0;
  const smile = mood === 'happy' || mood === 'wave' ? 1 : mood === 'thinking' ? 0.2 : 0.6;
  const eyesY = mood === 'thinking' ? -2 : 0;
  const eyesX = mood === 'thinking' ? 3 : 0;

  const isBun = look.hairStyle === 'bun' || look.hairStyle === 'grey-bun';

  return (
    <motion.svg
      role="img"
      aria-label={label ?? 'Animated character'}
      viewBox="0 0 200 220"
      width={size}
      height={(size * 220) / 200}
      className={className}
      initial={false}
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={shade(look.accent, 0.28)} />
          <stop offset="100%" stopColor={look.accent} />
        </radialGradient>
        <linearGradient id={`face-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(look.skin, 0.04)} />
          <stop offset="100%" stopColor={skinShadow} />
        </linearGradient>
        <clipPath id={`frame-${uid}`}>
          <circle cx="100" cy="110" r="100" />
        </clipPath>
      </defs>

      {framed && <circle cx="100" cy="110" r="100" fill={`url(#bg-${uid})`} opacity={0.9} />}

      <g clipPath={framed ? `url(#frame-${uid})` : undefined}>
        <motion.g
          animate={reduced ? undefined : { y: [0, -1.6, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Back hair */}
          {look.hairStyle === 'long' && (
            <path d="M54 96 C48 52 78 34 100 34 C126 34 154 52 146 100 L152 176 C140 190 118 184 114 164 L86 164 C82 184 60 190 48 176 Z" fill={hairDark} />
          )}
          {isBun && <circle cx="100" cy={look.hairStyle === 'grey-bun' ? 42 : 38} r={look.hairStyle === 'grey-bun' ? 15 : 19} fill={hairDark} />}

          {/* Shoulders & shirt */}
          <path d="M22 230 C26 186 60 168 100 168 C140 168 174 186 178 230 Z" fill={look.shirt} />
          <path d="M82 168 C88 182 112 182 118 168" fill="none" stroke={shade(look.shirt, -0.12)} strokeWidth="3" />
          {/* Neck */}
          <path d="M86 132 L86 168 C92 176 108 176 114 168 L114 132 Z" fill={skinShadow} />

          {/* Head group: nods while speaking, tilts while thinking */}
          <motion.g
            style={{ originX: '100px', originY: '140px' }}
            animate={
              reduced
                ? undefined
                : speaking
                  ? { rotate: [0, 1.2, -0.8, 0.6, 0], y: [0, 0.8, 0, 0.6, 0] }
                  : mood === 'thinking'
                    ? { rotate: 4 }
                    : mood === 'listening'
                      ? { rotate: -3 }
                      : { rotate: 0 }
            }
            transition={speaking ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
          >
            {/* Ears */}
            <ellipse cx="60" cy="102" rx="7" ry="10" fill={skinShadow} />
            <ellipse cx="140" cy="102" rx="7" ry="10" fill={skinShadow} />
            {look.earrings && (
              <>
                <circle cx="60" cy="116" r="3.2" fill={look.accent === '#1F3A5F' ? '#E3A33B' : '#F2C66E'} />
                <circle cx="140" cy="116" r="3.2" fill={look.accent === '#1F3A5F' ? '#E3A33B' : '#F2C66E'} />
              </>
            )}
            {/* Face */}
            <path d="M60 92 C60 60 78 46 100 46 C122 46 140 60 140 92 C140 120 126 142 100 142 C74 142 60 120 60 92 Z" fill={`url(#face-${uid})`} />

            {/* Beard */}
            {look.beard && (
              <path d="M64 108 C66 132 82 146 100 146 C118 146 134 132 136 108 C130 124 118 128 100 128 C82 128 70 124 64 108 Z" fill={look.hair} opacity="0.92" />
            )}

            {/* Front hair */}
            {look.hairStyle === 'long' && (
              <path d="M58 96 C56 58 80 42 104 43 C128 44 146 62 142 98 C136 76 118 62 96 64 C80 66 66 78 58 96 Z" fill={look.hair} />
            )}
            {isBun && (
              <path d="M59 92 C57 60 80 44 100 44 C122 44 143 60 141 92 C134 70 118 58 100 58 C82 58 66 70 59 92 Z" fill={look.hair} />
            )}
            {look.hairStyle === 'short' && (
              <path d="M60 86 C58 56 82 42 102 42 C124 42 143 56 140 86 C134 68 120 60 100 60 C84 60 68 66 60 86 Z" fill={look.hair} />
            )}
            {look.hairStyle === 'curly' && (
              <g fill={look.hair}>
                {[[66, 74, 12], [76, 60, 13], [92, 52, 13], [108, 51, 13], [124, 58, 13], [135, 72, 12], [84, 66, 10], [116, 64, 10], [100, 62, 9]].map(([x, y, r], i) => (
                  <circle key={i} cx={x} cy={y} r={r} />
                ))}
              </g>
            )}

            {/* Brows */}
            <motion.g animate={{ y: browRaise }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <path d="M76 86 Q84 81 92 85" stroke={shade(look.hair === '#CFCAC4' ? '#8F8780' : look.hair, -0.05)} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M108 85 Q116 81 124 86" stroke={shade(look.hair === '#CFCAC4' ? '#8F8780' : look.hair, -0.05)} strokeWidth="3" fill="none" strokeLinecap="round" />
            </motion.g>

            {/* Eyes */}
            <g transform={`translate(${eyesX} ${eyesY})`}>
              {[84, 116].map((x) => (
                <g key={x} style={{ transformOrigin: `${x}px 100px`, transform: `scaleY(${blink ? 0.08 : 1})`, transition: 'transform 70ms' }}>
                  <ellipse cx={x} cy="100" rx="4.3" ry="5.2" fill="#2A1F1A" />
                  <circle cx={x + 1.4} cy="98.2" r="1.3" fill="#fff" opacity="0.85" />
                </g>
              ))}
            </g>

            {/* Glasses */}
            {look.glasses && (
              <g fill="none" stroke="#3A302B" strokeWidth="2">
                <rect x="72" y="91" width="24" height="18" rx="7" />
                <rect x="104" y="91" width="24" height="18" rx="7" />
                <path d="M96 99 Q100 96 104 99" />
              </g>
            )}

            {/* Nose */}
            <path d="M100 103 Q97 114 101 116" stroke={shade(look.skin, -0.2)} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
            {/* Cheeks */}
            <circle cx="76" cy="115" r="6" fill="#E07A55" opacity={mood === 'happy' ? 0.22 : 0.12} />
            <circle cx="124" cy="115" r="6" fill="#E07A55" opacity={mood === 'happy' ? 0.22 : 0.12} />

            {/* Mouth */}
            {speaking && mouth > 0.05 ? (
              <g>
                <ellipse cx="100" cy="126" rx={7 + mouth * 2} ry={1.5 + mouth * 5} fill="#5A2621" />
                <ellipse cx="100" cy={126 + mouth * 2.5} rx={4 + mouth} ry={mouth * 2} fill="#C46A63" opacity="0.8" />
              </g>
            ) : mood === 'surprised' ? (
              <ellipse cx="100" cy="126" rx="5" ry="6" fill="#5A2621" />
            ) : (
              <path
                d={`M89 124 Q100 ${124 + 7 * smile} 111 124`}
                stroke="#8A3B32"
                strokeWidth="2.6"
                fill={smile > 0.8 ? '#fff' : 'none'}
                strokeLinecap="round"
              />
            )}
          </motion.g>

          {/* Gestures */}
          {mood === 'wave' && (
            <motion.g
              style={{ originX: '160px', originY: '205px' }}
              initial={{ rotate: 0, y: 30, opacity: 0 }}
              animate={reduced ? { y: 0, opacity: 1 } : { rotate: [0, 14, -6, 14, 0], y: 0, opacity: 1 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            >
              <path d="M150 230 L156 182" stroke={look.shirt} strokeWidth="16" strokeLinecap="round" />
              <ellipse cx="158" cy="172" rx="11" ry="13" fill={look.skin} />
              {[-6, -2, 2, 6].map((dx, i) => (
                <rect key={i} x={154 + dx} y={154 - (i === 1 || i === 2 ? 4 : 0)} width="4.5" height="14" rx="2.2" fill={look.skin} />
              ))}
            </motion.g>
          )}
          {mood === 'thinking' && (
            <motion.g initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
              <path d="M70 230 C72 190 92 160 106 150" stroke={look.shirt} strokeWidth="16" strokeLinecap="round" fill="none" />
              <ellipse cx="108" cy="146" rx="9" ry="8" fill={look.skin} />
            </motion.g>
          )}
        </motion.g>
      </g>
    </motion.svg>
  );
}
