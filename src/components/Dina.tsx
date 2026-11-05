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
          <stop offset="0" stopColor="#F2CFB1" />
          <stop offset="1" stopColor={SKIN} />
        </linearGradient>
        <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={HAIR_LIGHT} />
          <stop offset="0.55" stopColor={HAIR} />
          <stop offset="1" stopColor="#2A1811" />
        </linearGradient>
        <pattern id={`lace-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={LACE} />
          <circle cx="3" cy="3" r="1.3" fill="#B9AA8C" />
        </pattern>
      </defs>

      {/* Back hair (shoulder length, falls behind the shoulders) */}
      <path d="M43 74 C38 42 58 21 83 21 C110 21 126 43 121 76 C123 96 127 118 122 140 C118 150 108 152 102 146 L100 122 L60 122 L57 148 C49 152 39 146 37 132 C35 114 41 94 43 74 Z" fill={`url(#hair-${uid})`} />

      {/* Shoulders: black knit top + cream crochet shoulder */}
      <path d="M14 172 C18 144 44 128 80 127 C116 128 142 144 146 172 Z" fill={TOP} />
      <path d="M103 131 C120 134 134 145 140 166 L129 170 C124 154 113 143 98 139 Z" fill={`url(#lace-${uid})`} />
      <path d="M103 131 C120 134 134 145 140 166" fill="none" stroke="#CDBE9F" strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M64 129 C70 140 90 140 96 129" fill="none" stroke="#3B3532" strokeWidth="2" />

      {/* Neck */}
      <path d="M68 102 L68 131 C74 138 86 138 92 131 L92 102 Z" fill={SKIN_SHADE} />
      <path d="M68 112 C74 118 86 118 92 112 L92 104 L68 104 Z" fill={SKIN_DEEP} opacity=".35" />

      {/* Head group: gentle tilt */}
      <motion.g
        style={{ originX: '80px', originY: '118px' }}
        animate={animate ? (speaking ? { rotate: [0, 2, -1.5, 1, 0] } : { rotate: [0, -1.6, 0, 1.4, 0] }) : undefined}
        transition={{ duration: speaking ? 2.2 : 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Face */}
        <path d="M52 74 C52 49 64 35 80 35 C97 35 109 49 109 74 C109 97 99 116 80 119 C61 116 52 97 52 74 Z" fill={`url(#face-${uid})`} />
        {/* Jaw shadow */}
        <path d="M60 100 C66 112 73 117 80 119 C87 117 94 112 100 100 C94 110 87 114 80 114 C73 114 66 110 60 100 Z" fill={SKIN_SHADE} opacity=".18" />

        {/* Side strands framing the face */}
        <path d="M52 58 C45 78 45 100 50 124 C54 112 56 92 57 76 Z" fill={HAIR} />
        <path d="M108 56 C116 80 117 104 112 126 C107 112 105 92 104 76 Z" fill={HAIR} />

        {/* Crown + side-swept fringe (sweeps from her right to her left) */}
        <path d="M49 68 C46 42 62 27 85 27 C106 27 119 43 113 70 C110 56 102 47 92 44 C84 42 76 44 70 48 C62 53 54 60 49 68 Z" fill={`url(#hair-${uid})`} />
        <path d="M66 46 C80 44 98 49 107 63 C110 68 111 72 110 76 C104 66 96 60 86 57 C78 55 72 52 66 46 Z" fill={HAIR} />
        <path d="M70 41 C80 36 94 37 102 44" fill="none" stroke={HAIR_SHINE} strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
        <path d="M78 51 C88 52 98 57 104 65" fill="none" stroke={HAIR_SHINE} strokeWidth="1.1" strokeLinecap="round" opacity=".3" />

        {/* Eyebrows (natural, gently arched) */}
        <motion.g animate={{ y: beam ? -1.2 : 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          <path d="M61 66 Q68 61.5 76 64.5" stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M86 64.5 Q94 61.5 101 66" stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* Eyes: warm brown, smiling */}
        {[69, 93].map((x) => (
          <g key={x} style={{ transformOrigin: `${x}px 74px`, transform: `scaleY(${blink ? 0.08 : eyeSquint})`, transition: 'transform 90ms' }}>
            <ellipse cx={x} cy="74" rx="5.6" ry="3.9" fill="#FFFDF8" />
            <circle cx={x + 0.4} cy="74" r="3.1" fill={IRIS} />
            <circle cx={x + 0.4} cy="74" r="1.4" fill="#1C110B" />
            <circle cx={x + 1.6} cy="72.8" r="0.9" fill="#fff" />
            <path d={`M${x - 5.8} 73 Q${x} 68.6 ${x + 5.8} 73`} stroke="#2A1A12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        ))}
        {/* Smile creases under the eyes */}
        <path d="M63 79.5 Q69 82 75 79.5" stroke={SKIN_DEEP} strokeWidth="1" fill="none" opacity={beam ? 0.7 : 0.35} />
        <path d="M87 79.5 Q93 82 99 79.5" stroke={SKIN_DEEP} strokeWidth="1" fill="none" opacity={beam ? 0.7 : 0.35} />

        {/* Nose */}
        <path d="M81 76 Q79 87 82.5 90 Q81 92.2 77.5 91" stroke={SKIN_DEEP} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />

        {/* Cheeks */}
        <ellipse cx="64" cy="90" rx="6" ry="4" fill="#E58A70" opacity={beam ? 0.28 : 0.16} />
        <ellipse cx="98" cy="90" rx="6" ry="4" fill="#E58A70" opacity={beam ? 0.28 : 0.16} />

        {/* Mouth */}
        {speaking && mouth > 0.1 ? (
          <g>
            <path d={`M67 99 Q81 ${103 + mouth * 11} 95 99 Q81 ${101 + mouth * 2} 67 99 Z`} fill="#7A2C27" />
            <path d="M69.5 99.6 Q81 102.8 92.5 99.6 L92 101.4 Q81 104.6 70 101.4 Z" fill="#FFFDF8" />
            <path d="M67 99 Q81 97 95 99" stroke="#B4554C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        ) : beam ? (
          <g>
            {/* broad, open, toothy smile */}
            <path d="M63.5 97.5 Q81 120 98.5 97.5 Q81 101.5 63.5 97.5 Z" fill="#7A2C27" />
            <path d="M66.5 98.4 Q81 102.6 95.5 98.4 L94.4 103.2 Q81 108.4 67.6 103.2 Z" fill="#FFFDF8" />
            <ellipse cx="81" cy="111" rx="8" ry="2.6" fill="#C8615A" />
            <path d="M63.5 97.5 Q81 95.4 98.5 97.5" stroke="#B4554C" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <path d="M70 113.4 Q81 117.4 92 113.4" stroke="#C0665B" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".8" />
          </g>
        ) : (
          <g>
            {/* friendly smile, teeth just showing */}
            <path d="M66 98.5 Q81 111 96 98.5 Q81 101.5 66 98.5 Z" fill="#7A2C27" />
            <path d="M68.5 99.2 Q81 102.4 93.5 99.2 L92.6 101.8 Q81 105.4 69.4 101.8 Z" fill="#FFFDF8" />
            <path d="M66 98.5 Q81 96.8 96 98.5" stroke="#B4554C" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M72 107.6 Q81 110.4 90 107.6" stroke="#C0665B" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".7" />
          </g>
        )}
      </motion.g>

      {/* Friendly wave */}
      {waving && (
        <motion.g
          style={{ originX: '138px', originY: '172px' }}
          initial={animate ? { y: 40, opacity: 0, rotate: 0 } : false}
          animate={animate ? { y: 0, opacity: 1, rotate: [0, 12, -6, 12, -4, 0] } : { y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        >
          <path d="M126 176 C128 160 132 146 138 134" stroke={TOP} strokeWidth="17" strokeLinecap="round" fill="none" />
          <path d="M131 140 L145 136" stroke="#8A5A3A" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="141" cy="124" rx="10" ry="11.5" fill={SKIN} />
          {[-7, -2.4, 2.2, 6.6].map((dx, i) => (
            <rect key={i} x={140 + dx - 2.2} y={107 - (i === 1 || i === 2 ? 3 : 0)} width="4.4" height="14" rx="2.2" fill={SKIN} />
          ))}
          <rect x="128.5" y="118" width="4.4" height="11" rx="2.2" fill={SKIN} transform="rotate(-38 130 123)" />
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
