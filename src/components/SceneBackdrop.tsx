import { motion, useReducedMotion } from 'motion/react';

// Illustrated backdrops for each location (pure SVG, no image assets).

export function SceneBackdrop({ id }: { id: string }) {
  const reduced = useReducedMotion();
  if (id === 'llegada') {
    return (
      <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs><linearGradient id="ap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#CFE3F1" /><stop offset="1" stopColor="#F4E7D3" /></linearGradient></defs>
        <rect width="800" height="400" fill="url(#ap)" />
        {/* T4 undulating bamboo ceiling */}
        <path d="M0 40 C100 10 200 70 300 40 C400 10 500 70 600 40 C700 10 760 50 800 40 L800 0 L0 0 Z" fill="#D9A15E" />
        {Array.from({ length: 30 }).map((_, i) => <path key={i} d={`M${i * 28} 0 L${i * 28 + 10} 46`} stroke="#B97D3F" strokeWidth="2" opacity=".5" />)}
        {/* coloured pillars like T4 */}
        {['#E3A33B', '#E07A55', '#C2593A', '#D98C8C', '#8DA46F'].map((c, i) => (
          <path key={i} d={`M${80 + i * 160} 400 L${95 + i * 160} 60 L${110 + i * 160} 60 L${125 + i * 160} 400 Z`} fill={c} opacity=".9" />
        ))}
        {/* big windows */}
        <rect x="0" y="120" width="800" height="150" fill="#ffffff" opacity=".35" />
        {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={i * 100} y="120" width="3" height="150" fill="#fff" opacity=".7" />)}
        {!reduced && (
          <motion.path d="M-80 200 l40 -8 l10 -18 l8 0 l-4 18 l22 -4 l5 -9 l6 0 l-3 12 l-3 12 l-6 0 l-5 -7 l-22 3 l4 18 l-8 0 l-10 -18 l-40 -6 z" fill="#1F3A5F" opacity=".6" animate={{ x: [0, 1000], y: [0, -60] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} />
        )}
        {/* departures board */}
        <rect x="520" y="70" width="220" height="44" rx="6" fill="#1E1B18" />
        <text x="535" y="98" fill="#F2C66E" fontFamily="monospace" fontSize="15">LLEGADAS · ARRIVALS</text>
        <rect y="330" width="800" height="70" fill="#E9DCC7" />
      </svg>
    );
  }
  if (id === 'piso') {
    return (
      <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="800" height="400" fill="#F0D6B5" />
        {/* facade with balconies */}
        {[0, 1, 2, 3].map((col) => [0, 1].map((row) => (
          <g key={`${col}-${row}`} transform={`translate(${70 + col * 180} ${40 + row * 140})`}>
            <rect width="80" height="110" rx="4" fill="#5E7149" opacity=".85" />
            <rect x="6" y="6" width="32" height="98" fill="#7E9467" />
            <rect x="42" y="6" width="32" height="98" fill="#7E9467" />
            <rect x="-14" y="90" width="108" height="6" fill="#2E2A27" />
            {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={-12 + i * 12} y="96" width="2" height="22" fill="#2E2A27" />)}
            <rect x="-14" y="116" width="108" height="4" fill="#2E2A27" />
            {[0, 1, 2, 3].map((i) => (
              <motion.g key={i} animate={reduced ? undefined : { rotate: [0, 3, 0] }} transition={{ duration: 3 + i, repeat: Infinity }} style={{ originX: `${i * 26 + 4}px`, originY: '92px' }}>
                <circle cx={i * 26 + 4} cy="84" r="9" fill="#5E7149" />
                <circle cx={i * 26} cy="80" r="4" fill="#C2593A" />
                <circle cx={i * 26 + 8} cy="82" r="4" fill="#D98C8C" />
              </motion.g>
            ))}
          </g>
        )))}
        {/* azulejo street sign */}
        <g transform="translate(330 300)">
          <rect width="140" height="42" rx="4" fill="#FBF6EE" stroke="#1F3A5F" strokeWidth="3" />
          <text x="70" y="27" textAnchor="middle" fill="#1F3A5F" fontFamily="Georgia, serif" fontSize="15" fontStyle="italic">Lavapiés</text>
        </g>
        <rect y="355" width="800" height="45" fill="#C9B497" />
      </svg>
    );
  }
  // café
  return (
    <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="800" height="400" fill="#E7C9A2" />
      {/* tiled wall */}
      <rect y="210" width="800" height="120" fill="#FBF6EE" />
      {Array.from({ length: 40 }).map((_, i) => (
        <g key={i} transform={`translate(${i * 20} 210)`}>
          {[0, 1, 2, 3, 4, 5].map((r) => <rect key={r} x="1" y={r * 20 + 1} width="18" height="18" fill={(i + r) % 2 ? '#1F3A5F' : '#3C6A9E'} opacity=".18" />)}
        </g>
      ))}
      {/* chalkboard */}
      <rect x="70" y="50" width="230" height="130" rx="8" fill="#2E2A27" stroke="#8A5A2B" strokeWidth="8" />
      <text x="185" y="85" textAnchor="middle" fill="#FBF6EE" fontFamily="Georgia, serif" fontSize="20" fontStyle="italic">Desayunos</text>
      <text x="90" y="115" fill="#FBF6EE" fontFamily="Georgia, serif" fontSize="14">Café con leche ....... 1,80</text>
      <text x="90" y="138" fill="#FBF6EE" fontFamily="Georgia, serif" fontSize="14">Tostada con tomate .. 2,40</text>
      <text x="90" y="161" fill="#FBF6EE" fontFamily="Georgia, serif" fontSize="14">Zumo de naranja ..... 2,50</text>
      {/* espresso machine */}
      <g transform="translate(520 120)">
        <rect width="170" height="90" rx="10" fill="#B9BEC4" />
        <rect x="10" y="10" width="150" height="20" rx="4" fill="#C2593A" />
        {[30, 80, 130].map((x) => <rect key={x} x={x} y="50" width="14" height="22" rx="3" fill="#2E2A27" />)}
        {!reduced && [0, 1].map((i) => (
          <motion.path key={i} d={`M${60 + i * 50} 0 C${50 + i * 50} -20 ${70 + i * 50} -30 ${60 + i * 50} -50`} stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".6" animate={{ y: [0, -12], opacity: [0.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.1 }} />
        ))}
      </g>
      {/* hanging lights */}
      {[200, 400, 600].map((x) => (
        <g key={x}><line x1={x} y1="0" x2={x} y2="30" stroke="#2E2A27" strokeWidth="2" /><path d={`M${x - 18} 44 Q${x} 22 ${x + 18} 44 Z`} fill="#E3A33B" /><circle cx={x} cy="46" r="6" fill="#FDF4E2" /></g>
      ))}
      {/* bar counter */}
      <rect y="300" width="800" height="100" fill="#8A5A2B" />
      <rect y="300" width="800" height="12" fill="#6E4520" />
    </svg>
  );
}
