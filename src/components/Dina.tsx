import { motion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

// ───────────────────────────────────────────────────────────────
// Dina — the tutor behind "Learning with Dina".
// A stylised, adult illustration (not a portrait): dark-brown hair
// with a loose side-swept fringe, warm brown eyes, broad friendly
// smile, black knit top with a cream crochet shoulder and a thin
// cord bracelet. Pure SVG, animated with Motion.
// ───────────────────────────────────────────────────────────────

export type DinaExpression = 'smile' | 'beam';

const SKIN = '#EBC3A2';
const SKIN_SHADE = '#D49E7D';
const SKIN_DEEP = '#C0866A';
const HAIR = '#3A2319';
const HAIR_LIGHT = '#5E3B28';
const HAIR_SHINE = '#7A4E35';
const IRIS = '#6B4127';
const TOP = '#211D1B';
const LACE = '#E8DCC4';

/** Irregular, natural blinking (off when motion is reduced). */
function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setClosed(true);
        window.setTimeout(() => setClosed(false), 120);
        if (Math.random() < 0.18) window.setTimeout(() => { setClosed(true); window.setTimeout(() => setClosed(false), 100); }, 280);
        loop();
      }, 2600 + Math.random() * 3600);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [enabled]);
  return closed;
}

function useMouth(speaking: boolean) {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    if (!speaking) { setOpen(0); return; }
    const iv = window.setInterval(() => setOpen(Math.random() < 0.15 ? 0.15 : 0.4 + Math.random() * 0.6), 120);
    return () => window.clearInterval(iv);
  }, [speaking]);
  return open;
}

export function DinaArt({
  expression = 'smile',
  speaking = false,
  waving = false,
  animate = true,
  size = 120,
  className,
  title = 'Dina, your Spanish tutor',
}: {
  expression?: DinaExpression;
  speaking?: boolean;
  waving?: boolean;
  animate?: boolean;
  size?: number;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const blink = useBlink(animate);
  const mouth = useMouth(speaking);
  const beam = expression === 'beam' || speaking;
  const eyeSquint = beam ? 0.78 : 1;

  return (
    <svg viewBox="0 0 160 170" width={size} height={(size * 170) / 160} className={className} role="img" aria-label={title} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`face-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#F5D6BC" />
          <stop offset="1" stopColor={SKIN} />
        </linearGradient>
        <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={HAIR_LIGHT} />
          <stop offset="0.5" stopColor={HAIR} />
          <stop offset="1" stopColor="#2A1811" />
        </linearGradient>
        <radialGradient id={`iris-${uid}`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#9A6440" />
          <stop offset="1" stopColor={IRIS} />
        </radialGradient>
        <pattern id={`lace-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill={LACE} />
          <circle cx="2.5" cy="2.5" r="1.05" fill="#BFB091" />
        </pattern>
      </defs>

      {/* Back hair: soft, glossy, shoulder length with a gentle wave at the ends */}
      <path d="M46 76 C41 44 59 23 81 23 C106 23 122 44 117 77 C119 96 123 116 119 134 C121 142 114 148 106 145 C109 138 104 134 101 128 L100 120 L61 120 L59 128 C56 134 51 138 54 145 C46 148 39 142 41 134 C37 116 42 96 46 76 Z" fill={`url(#hair-${uid})`} />

      {/* Petite shoulders: black knit top with the cream crochet shoulder */}
      <path d="M26 172 C30 147 52 132 80 131 C108 132 130 147 134 172 Z" fill={TOP} />
      <path d="M100 134 C114 137 125 147 130 165 L121 169 C117 155 108 146 96 141 Z" fill={`url(#lace-${uid})`} />
      <path d="M100 134 C114 137 125 147 130 165" fill="none" stroke="#CDBE9F" strokeWidth="1" strokeDasharray="1.6 1.6" />
      <path d="M67 132 C72 141 88 141 93 132" fill="none" stroke="#3B3532" strokeWidth="1.6" />

      {/* Slim neck */}
      <path d="M71 104 L71 132 C76 138 84 138 89 132 L89 104 Z" fill={SKIN_SHADE} />
      <path d="M71 110 C76 116 84 116 89 110 L89 104 L71 104 Z" fill={SKIN_DEEP} opacity=".3" />

      {/* Head group: gentle tilt */}
      <motion.g
        style={{ originX: '80px', originY: '118px' }}
        animate={animate ? (speaking ? { rotate: [0, 2, -1.5, 1, 0] } : { rotate: [0, -1.6, 0, 1.4, 0] }) : undefined}
        transition={{ duration: speaking ? 2.2 : 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Heart-shaped face with a delicate chin */}
        <path d="M55 73 C55 50 66 37 80 37 C94 37 105 50 105 73 C105 94 96 111 80 116 C64 111 55 94 55 73 Z" fill={`url(#face-${uid})`} />

        {/* Tiny gold earrings */}
        <circle cx="55.5" cy="88" r="1.9" fill="#D4AF5A" />
        <circle cx="104.5" cy="88" r="1.9" fill="#D4AF5A" />

        {/* Side strands framing the face */}
        <path d="M55 58 C48 78 48 100 53 122 C56 110 58 92 59 76 Z" fill={HAIR} />
        <path d="M105 56 C112 80 113 102 109 124 C105 110 103 92 102 76 Z" fill={HAIR} />

        {/* Crown + soft side-swept fringe */}
        <path d="M52 68 C49 43 64 29 85 29 C104 29 117 44 111 70 C108 57 101 48 92 45 C84 43 76 45 70 49 C63 54 56 61 52 68 Z" fill={`url(#hair-${uid})`} />
        <path d="M67 47 C80 45 97 50 105 63 C107 67 108 70 107 74 C102 66 95 60 86 57 C78 55 72 52 67 47 Z" fill={HAIR} />
        <path d="M71 40 C81 35 95 36 103 44" fill="none" stroke={HAIR_SHINE} strokeWidth="1.8" strokeLinecap="round" opacity=".45" />
        <path d="M80 50 C89 52 98 57 103 64" fill="none" stroke={HAIR_SHINE} strokeWidth="1.1" strokeLinecap="round" opacity=".35" />

        {/* Soft, slim brows */}
        <motion.g animate={{ y: beam ? -1 : 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          <path d="M62.5 65.5 Q69 61.8 75.5 64" stroke={HAIR} strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <path d="M84.5 64 Q91 61.8 97.5 65.5" stroke={HAIR} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* Large almond eyes with lashes */}
        {[69.5, 90.5].map((x, i) => {
          const flick = i === 0 ? -1 : 1;
          return (
            <g key={x} style={{ transformOrigin: `${x}px 73.5px`, transform: `scaleY(${blink ? 0.08 : eyeSquint})`, transition: 'transform 90ms' }}>
              <path d={`M${x - 6.2} 73.8 Q${x} 67.6 ${x + 6.2} 73.8 Q${x} 78.4 ${x - 6.2} 73.8 Z`} fill="#FFFDF8" />
              <circle cx={x + 0.3} cy="73.6" r="3.5" fill={`url(#iris-${uid})`} />
              <circle cx={x + 0.3} cy="73.6" r="1.6" fill="#1C110B" />
              <circle cx={x + 1.6} cy="72.3" r="1" fill="#fff" />
              <circle cx={x - 1} cy="74.9" r="0.45" fill="#fff" opacity=".8" />
              <path d={`M${x - 6.6} 73.8 Q${x} 67 ${x + 6.6} 73.8`} stroke="#22140D" strokeWidth="1.7" fill="none" strokeLinecap="round" />
              <path d={`M${x + 6.2 * flick} 73.2 l${1.4 * flick} -2.1`} stroke="#22140D" strokeWidth="1.1" strokeLinecap="round" />
            </g>
          );
        })}
        <path d="M64 78.6 Q69.5 80.6 75 78.6" stroke={SKIN_DEEP} strokeWidth=".8" fill="none" opacity={beam ? 0.5 : 0.25} />
        <path d="M85 78.6 Q90.5 80.6 96 78.6" stroke={SKIN_DEEP} strokeWidth=".8" fill="none" opacity={beam ? 0.5 : 0.25} />

        {/* Small, refined nose */}
        <path d="M80.5 77 Q79.4 86 81.6 88.4 Q80.6 89.8 78.2 89.2" stroke={SKIN_DEEP} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".7" />

        {/* Rosy cheeks */}
        <ellipse cx="64" cy="88" rx="6" ry="3.6" fill="#EE8E86" opacity={beam ? 0.32 : 0.22} />
        <ellipse cx="96" cy="88" rx="6" ry="3.6" fill="#EE8E86" opacity={beam ? 0.32 : 0.22} />

        {/* Mouth: rosy lips */}
        {speaking && mouth > 0.1 ? (
          <g>
            <path d={`M69 97.5 Q80 ${101 + mouth * 9} 91 97.5 Q80 ${99.5 + mouth * 2} 69 97.5 Z`} fill="#7A2C2E" />
            <path d="M71 98 Q80 100.6 89 98 L88.6 99.6 Q80 102.2 71.4 99.6 Z" fill="#FFFDF8" />
            <path d="M69 97.5 Q74 95.4 77.5 96.4 Q80 95.6 82.5 96.4 Q86 95.4 91 97.5" stroke="#C8606A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        ) : beam ? (
          <g>
            {/* broad, open smile */}
            <path d="M66.5 96.5 Q80 115 93.5 96.5 Q80 99.8 66.5 96.5 Z" fill="#7A2C2E" />
            <path d="M69 97.2 Q80 100.8 91 97.2 L90.1 101.2 Q80 105.6 69.9 101.2 Z" fill="#FFFDF8" />
            <ellipse cx="80" cy="107.6" rx="6" ry="2" fill="#D7707A" />
            <path d="M66.5 96.5 Q72 94 77 95.2 Q80 94.2 83 95.2 Q88 94 93.5 96.5" stroke="#C8606A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M71.5 109.4 Q80 113 88.5 109.4" stroke="#D7707A" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            {/* sweet, friendly smile */}
            <path d="M68.5 97 Q80 107 91.5 97 Q80 99.6 68.5 97 Z" fill="#7A2C2E" />
            <path d="M70.6 97.6 Q80 100.4 89.4 97.6 L88.7 99.6 Q80 102.6 71.3 99.6 Z" fill="#FFFDF8" />
            <path d="M68.5 97 Q73.5 94.8 77.5 95.8 Q80 95 82.5 95.8 Q86.5 94.8 91.5 97" stroke="#C8606A" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <path d="M73 104.2 Q80 106.8 87 104.2" stroke="#D7707A" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".85" />
          </g>
        )}
      </motion.g>

      {/* Dainty wave */}
      {waving && (
        <motion.g
          style={{ originX: '128px', originY: '170px' }}
          initial={animate ? { y: 36, opacity: 0, rotate: 0 } : false}
          animate={animate ? { y: 0, opacity: 1, rotate: [0, 10, -5, 10, -3, 0] } : { y: 0, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        >
          <path d="M120 174 C122 160 125 149 130 139" stroke={TOP} strokeWidth="12" strokeLinecap="round" fill="none" />
          <path d="M124.5 143.5 L135 140.5" stroke="#8A5A3A" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="132.5" cy="130.5" rx="6.8" ry="7.8" fill={SKIN} />
          {[-4.6, -1.6, 1.4, 4.4].map((dx, i) => (
            <rect key={i} x={132.5 + dx - 1.4} y={118 - (i === 1 || i === 2 ? 2.2 : 0)} width="2.8" height="10" rx="1.4" fill={SKIN} />
          ))}
          <rect x="124" y="126" width="2.8" height="7.5" rx="1.4" fill={SKIN} transform="rotate(-38 125.4 129.7)" />
        </motion.g>
      )}
    </svg>
  );
}

/** Greeting the learner hears/sees when tapping Dina (agrees with the learner's gender). */
export function dinaGreeting(gender: 'm' | 'f' | 'x' | undefined): { es: string; en: string } {
  return gender === 'm'
    ? { es: '¡Hola! ¡Bienvenido a Learning with Dina!', en: 'Hi! Welcome to Learning with Dina!' }
    : { es: '¡Hola! ¡Bienvenida a Learning with Dina!', en: 'Hi! Welcome to Learning with Dina!' };
}
