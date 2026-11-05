import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { CITY_THEMES, type CityTheme, type Landmark } from '../data/cityThemes';
import type { CityId } from '../data/storyTypes';

export type SkyMode = 'day' | 'dusk' | 'night';

export function skyModeFor(hour = new Date().getHours()): SkyMode {
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

/** Draws one landmark silhouette with its base at (x, base). */
function LandmarkShape({ id, x, base, t, night }: { id: Landmark; x: number; base: number; t: CityTheme; night: boolean }) {
  const P = t.palette;
  const ink = night ? '#0E1424' : P.deep;
  const gold = P.secondary;
  const lit = night ? P.secondaryLight : '#FFFFFF';
  const win = (wx: number, wy: number, w = 6, h = 8) => <rect x={wx} y={wy} width={w} height={h} rx="1" fill={lit} opacity={night ? 0.85 : 0.35} />;
  const g = (children: ReactNode) => <g transform={`translate(${x} ${base})`}>{children}</g>;
  switch (id) {
    case 'palacio':
      return g(<>
        <rect x="-120" y="-70" width="240" height="70" fill={ink} />
        <rect x="-130" y="-78" width="260" height="10" fill={ink} />
        <path d="M-30 -78 L0 -100 L30 -78 Z" fill={ink} />
        {Array.from({ length: 11 }).map((_, i) => <rect key={i} x={-110 + i * 21} y="-60" width="7" height="44" rx="3" fill={lit} opacity={night ? 0.7 : 0.18} />)}
      </>);
    case 'alcala':
      return g(<>
        <rect x="-90" y="-95" width="180" height="95" fill={ink} />
        <rect x="-96" y="-106" width="192" height="12" fill={ink} />
        <path d="M-30 -106 L0 -126 L30 -106 Z" fill={ink} />
        {[-60, 0, 60].map((ax) => <path key={ax} d={`M${ax - 16} 0 L${ax - 16} -46 A16 16 0 0 1 ${ax + 16} -46 L${ax + 16} 0 Z`} fill={night ? '#26304A' : P.deepLight} opacity="0.55" />)}
      </>);
    case 'metropolis':
      return g(<>
        <rect x="-38" y="-150" width="76" height="150" fill={ink} />
        <path d="M-40 -150 A40 34 0 0 1 40 -150 Z" fill={gold} />
        <rect x="-3" y="-200" width="6" height="18" fill={gold} />
        <circle cx="0" cy="-205" r="6" fill={gold} />
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <g key={`${r}${c}`}>{win(-24 + c * 18, -130 + r * 30)}</g>))}
      </>);
    case 'torres-kio':
      return g(<>
        <path d="M-90 0 L-60 -210 L-20 -210 L-50 0 Z" fill={ink} />
        <path d="M90 0 L60 -210 L20 -210 L50 0 Z" fill={ink} />
      </>);
    case 'sagrada':
      return g(<>
        {[[-70, 190], [-40, 240], [-12, 300], [16, 280], [44, 230], [72, 180]].map(([sx, h], i) => (
          <g key={i}>
            <path d={`M${sx - 13} 0 L${sx - 13} ${-h + 40} Q${sx} ${-h - 10} ${sx + 13} ${-h + 40} L${sx + 13} 0 Z`} fill={ink} />
            <circle cx={sx} cy={-h + 6} r="6" fill={i % 2 ? gold : P.primaryLight} />
          </g>
        ))}
        <rect x="-90" y="-80" width="180" height="80" fill={ink} />
        <path d="M-20 -80 L0 -120 L20 -80 Z" fill={ink} />
      </>);
    case 'glories':
      return g(<>
        <path d="M-40 0 L-40 -170 Q-40 -240 0 -250 Q40 -240 40 -170 L40 0 Z" fill={night ? '#203A66' : P.deepLight} />
        {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={-34 + (i % 4) * 18} y={-200 + Math.floor(i / 4) * 55} width="8" height="40" fill={i % 3 ? P.primaryLight : P.rose} opacity={night ? 0.9 : 0.6} />)}
      </>);
    case 'montjuic':
      return g(<>
        <path d="M-180 0 Q-100 -140 0 -150 Q100 -140 180 0 Z" fill={night ? '#1C3A34' : P.tertiary} opacity=".85" />
        <rect x="-30" y="-178" width="60" height="30" fill={ink} />
        {[-30, -15, 0, 15].map((cx) => <rect key={cx} x={cx} y="-186" width="8" height="8" fill={ink} />)}
      </>);
    case 'w-hotel':
      return g(<path d="M-40 0 Q-30 -150 30 -220 Q20 -120 40 0 Z" fill={night ? '#36507A' : P.deepLight} opacity=".9" />);
    case 'giralda':
      return g(<>
        <rect x="-26" y="-210" width="52" height="210" fill={ink} />
        <rect x="-22" y="-250" width="44" height="40" fill={ink} />
        <rect x="-16" y="-275" width="32" height="25" fill={ink} />
        <path d="M-10 -275 Q0 -300 10 -275 Z" fill={ink} />
        <path d="M-2 -300 L-2 -320 L8 -318 Z" fill={gold} />
        {[0, 1, 2, 3, 4].map((r) => win(-4, -195 + r * 36, 8, 14))}
        {[-12, 4].map((wx) => <path key={wx} d={`M${wx} -218 l0 -16 a4 4 0 0 1 8 0 l0 16 z`} fill={lit} opacity={night ? 0.8 : 0.3} />)}
      </>);
    case 'torre-oro':
      return g(<>
        <rect x="-40" y="-90" width="80" height="90" fill={P.secondary} />
        <rect x="-28" y="-130" width="56" height="40" fill={P.secondary} />
        <rect x="-16" y="-150" width="32" height="20" fill={P.secondary} />
        <path d="M-16 -150 Q0 -175 16 -150 Z" fill={gold} />
        {[-36, -18, 0, 18].map((cx) => <rect key={cx} x={cx} y="-98" width="12" height="8" fill={P.secondary} />)}
        {[-20, 8].map((wx) => win(wx, -70, 10, 16))}
      </>);
    case 'setas':
      return g(<>
        {[-80, -10, 60].map((px) => <rect key={px} x={px} y="-90" width="22" height="90" fill={night ? '#3A3550' : '#E9DCC1'} />)}
        <path d="M-130 -90 Q-90 -150 -40 -120 Q0 -160 40 -120 Q90 -150 130 -95 L130 -80 L-130 -80 Z" fill={night ? '#4A4566' : '#F4EAD3'} stroke={P.secondary} strokeWidth="2" />
        {Array.from({ length: 13 }).map((_, i) => <line key={i} x1={-120 + i * 20} y1="-82" x2={-120 + i * 20} y2="-135" stroke={P.secondary} strokeWidth="1.5" opacity=".7" />)}
      </>);
    case 'plaza-espana':
      return g(<>
        <path d="M-150 0 L-150 -50 Q0 -110 150 -50 L150 0 Z" fill={night ? '#5A3027' : P.primary} />
        <rect x="-160" y="-150" width="28" height="150" fill={night ? '#5A3027' : P.primary} />
        <rect x="132" y="-150" width="28" height="150" fill={night ? '#5A3027' : P.primary} />
        <path d="M-160 -150 L-146 -175 L-132 -150 Z M132 -150 L146 -175 L160 -150 Z" fill={P.deep} />
        {Array.from({ length: 9 }).map((_, i) => <path key={i} d={`M${-100 + i * 25} -10 l0 -22 a6 6 0 0 1 12 0 l0 22 z`} fill={P.deepLight} opacity=".6" />)}
      </>);
    case 'angel':
      return g(<>
        <rect x="-40" y="-30" width="80" height="30" fill={ink} />
        <rect x="-10" y="-230" width="20" height="200" fill={ink} />
        <rect x="-16" y="-238" width="32" height="10" fill={ink} />
        <path d="M0 -270 L-22 -250 L-6 -246 L0 -238 L6 -246 L22 -250 Z" fill={gold} />
        <circle cx="0" cy="-272" r="5" fill={gold} />
      </>);
    case 'latino':
      return g(<>
        <rect x="-40" y="-220" width="80" height="220" fill={ink} />
        <rect x="-30" y="-250" width="60" height="30" fill={ink} />
        <rect x="-18" y="-270" width="36" height="20" fill={ink} />
        <rect x="-2" y="-320" width="4" height="50" fill={ink} />
        {Array.from({ length: 18 }).map((_, i) => win(-30 + (i % 3) * 22, -205 + Math.floor(i / 3) * 32, 14, 6))}
      </>);
    case 'bellas-artes':
      return g(<>
        <rect x="-110" y="-80" width="220" height="80" fill={night ? '#D9D2C4' : '#F2EDE3'} />
        <path d="M-50 -80 Q0 -170 50 -80 Z" fill={P.secondary} />
        <path d="M-30 -80 Q0 -140 30 -80 Z" fill={P.secondaryLight} opacity=".6" />
        <circle cx="0" cy="-168" r="7" fill={gold} />
        {Array.from({ length: 7 }).map((_, i) => <rect key={i} x={-95 + i * 30} y="-66" width="10" height="56" rx="3" fill={night ? '#B9B0A0' : '#DCD3C3'} />)}
      </>);
    case 'volcano':
      return g(<>
        <path d="M-320 0 L-60 -230 Q0 -250 60 -230 L320 0 Z" fill={night ? '#2A2340' : '#9A8FB5'} opacity=".75" />
        <path d="M-60 -230 Q0 -250 60 -230 L95 -200 Q60 -185 40 -205 Q15 -180 -10 -200 Q-35 -180 -60 -200 L-95 -200 Z" fill="#FFFFFF" opacity=".92" />
      </>);
    case 'obelisco':
      return g(<>
        <path d="M-18 0 L-12 -260 L0 -285 L12 -260 L18 0 Z" fill={night ? '#E8E2D4' : '#F4F1EA'} stroke={P.deep} strokeWidth="2" />
        <rect x="-3" y="-240" width="6" height="10" fill={P.deep} opacity=".5" />
      </>);
    case 'congreso':
      return g(<>
        <rect x="-120" y="-80" width="240" height="80" fill={night ? '#C9C0AE' : '#EFE7D6'} />
        <rect x="-40" y="-120" width="80" height="40" fill={night ? '#C9C0AE' : '#EFE7D6'} />
        <path d="M-45 -120 Q0 -215 45 -120 Z" fill={P.tertiary} />
        <rect x="-4" y="-225" width="8" height="18" fill={P.tertiary} />
        {Array.from({ length: 8 }).map((_, i) => <rect key={i} x={-100 + i * 28} y="-70" width="9" height="60" fill={night ? '#A79C88' : '#D6CCB8'} />)}
      </>);
    case 'puente-mujer':
      return g(<>
        <rect x="-170" y="-20" width="340" height="10" fill={ink} />
        <path d="M-40 -10 L40 -200 L48 -196 L-30 -10 Z" fill={ink} />
        {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={36 - i * 4} y1={-190 + i * 20} x2={-150 + i * 18} y2="-18" stroke={ink} strokeWidth="1.5" />)}
      </>);
    case 'caminito':
      return g(<>
        {[P.secondary, P.rose, P.primary, P.tertiary, P.deepLight, P.secondaryLight].map((c, i) => (
          <g key={i} transform={`translate(${-150 + i * 50} 0)`}>
            <rect x="0" y={-70 - (i % 2) * 22} width="48" height={70 + (i % 2) * 22} fill={c} />
            <path d={`M-4 ${-70 - (i % 2) * 22} L24 ${-92 - (i % 2) * 22} L52 ${-70 - (i % 2) * 22} Z`} fill={i % 2 ? P.deep : P.primaryDark} />
            {win(8, -55, 12, 14)}{win(28, -55, 12, 14)}
          </g>
        ))}
      </>);
    case 'coltejer':
      return g(<>
        <path d="M-35 0 L-35 -220 L0 -300 L35 -220 L35 0 Z" fill={ink} />
        <path d="M-35 -220 L0 -300 L35 -220 Z" fill={night ? '#2E4A6E' : P.deepLight} />
        {Array.from({ length: 14 }).map((_, i) => win(-24 + (i % 2) * 30, -205 + Math.floor(i / 2) * 28, 18, 8))}
      </>);
    case 'metrocable':
      return null; // drawn as an animated overlay
    case 'comuna-houses':
      return g(<>
        {Array.from({ length: 22 }).map((_, i) => {
          const col = i % 6, row = Math.floor(i / 6);
          const colors = [P.secondary, P.primary, P.rose, P.tertiary, P.deepLight, '#FFFFFF'];
          return <rect key={i} x={-160 + col * 46 + row * 22} y={-40 - row * 34 - col * 6} width="38" height="30" fill={colors[(i * 7) % 6]} opacity={night ? 0.75 : 0.95} />;
        })}
      </>);
    case 'andes':
      return null; // part of the mountain layer
    case 'serranos':
      // Torres de Serranos: twin crenellated gothic towers flanking a gate
      return g(<>
        {[-70, 70].map((tx) => (
          <g key={tx}>
            <path d={`M${tx - 34} 0 L${tx - 30} -160 L${tx + 30} -160 L${tx + 34} 0 Z`} fill={night ? '#B9AE9A' : '#E8DCC3'} />
            <path d={`M${tx - 30} -160 L${tx - 30} -176 L${tx - 18} -176 L${tx - 18} -166 L${tx - 6} -166 L${tx - 6} -176 L${tx + 6} -176 L${tx + 6} -166 L${tx + 18} -166 L${tx + 18} -176 L${tx + 30} -176 L${tx + 30} -160 Z`} fill={night ? '#B9AE9A' : '#E8DCC3'} />
            <path d={`M${tx - 8} -60 l0 -26 a8 8 0 0 1 16 0 l0 26 z`} fill={night ? '#5A5147' : '#C9B89A'} />
            <path d={`M${tx - 6} -120 l0 -18 a6 6 0 0 1 12 0 l0 18 z`} fill={night ? '#5A5147' : '#C9B89A'} />
          </g>
        ))}
        <rect x="-40" y="-100" width="80" height="100" fill={night ? '#A99E8B' : '#DDD0B5'} />
        <path d="M-22 0 L-22 -56 A22 22 0 0 1 22 -56 L22 0 Z" fill={night ? '#3A3430' : '#8F8371'} />
        <path d="M-40 -100 L-40 -112 L-28 -112 L-28 -104 L-14 -104 L-14 -112 L0 -112 L0 -104 L14 -104 L14 -112 L28 -112 L28 -104 L40 -104 L40 -100 Z" fill={night ? '#A99E8B' : '#DDD0B5'} />
      </>);
    case 'miguelete':
      // El Miguelete: octagonal gothic bell tower with a belfry on top
      return g(<>
        <path d="M-34 0 L-30 -230 L30 -230 L34 0 Z" fill={night ? '#B9AE9A' : '#E6D9BE'} />
        <path d="M-30 -230 L-30 -248 L30 -248 L30 -230 Z" fill={night ? '#A99E8B' : '#D9CAA8'} />
        <path d="M-14 -248 L-14 -286 L14 -286 L14 -248 Z" fill={night ? '#A99E8B' : '#D9CAA8'} />
        <path d="M-8 -282 l0 -14 a8 8 0 0 1 16 0 l0 14 z" fill={night ? '#5A5147' : '#9C8E74'} />
        <path d="M-3 -286 L-3 -300 L8 -298 Z" fill={gold} />
        {[-70, -120, -170].map((y) => <path key={y} d={`M-8 ${y} l0 -22 a8 8 0 0 1 16 0 l0 22 z`} fill={night ? '#5A5147' : '#C0AF8E'} />)}
        <path d="M-24 -12 L-24 -226 M24 -12 L24 -226" stroke={night ? '#8E8471' : '#CDBE9E'} strokeWidth="2" />
      </>);
    case 'hemisferic':
      // L'Hemisfèric: the white eye-shaped planetarium over its reflecting pool
      return g(<>
        <ellipse cx="0" cy="-6" rx="150" ry="14" fill={night ? '#2A4A6E' : P.deepLight} opacity=".55" />
        <path d="M-120 -30 Q0 -120 120 -30 Q0 -4 -120 -30 Z" fill={night ? '#DCE3E8' : '#FFFFFF'} />
        <path d="M-100 -36 Q0 -100 100 -36 Q0 -14 -100 -36 Z" fill={night ? '#3C6A9E' : '#9CC8E8'} opacity=".75" />
        {Array.from({ length: 11 }).map((_, i) => <line key={i} x1={-100 + i * 20} y1={-36 - Math.sin((i / 10) * Math.PI) * 58} x2={-100 + i * 20} y2={-14 - Math.sin((i / 10) * Math.PI) * 6} stroke="#fff" strokeWidth="1.5" opacity=".7" />)}
        <path d="M-120 -30 Q0 -120 120 -30" fill="none" stroke={night ? '#F2EAD3' : '#FFFFFF'} strokeWidth="5" />
      </>);
    case 'palau-arts':
      // Palau de les Arts: Calatrava's helmet/feather silhouette
      return g(<>
        <path d="M-130 0 Q-110 -150 10 -190 Q110 -200 150 -120 L140 -118 Q100 -160 30 -150 Q-70 -120 -90 0 Z" fill={night ? '#DCE3E8' : '#FFFFFF'} />
        <path d="M-90 0 Q-70 -120 30 -150 Q100 -160 140 -118 Q90 -110 40 -100 Q-30 -80 -40 0 Z" fill={night ? '#2E4E74' : P.deepLight} opacity=".8" />
        <path d="M-150 -40 Q-60 -220 120 -205 Q140 -200 150 -190 Q0 -200 -140 -30 Z" fill={night ? '#F2EAD3' : '#FFFFFF'} />
        <ellipse cx="0" cy="-6" rx="160" ry="12" fill={night ? '#2A4A6E' : P.deepLight} opacity=".45" />
      </>);
  }
}

/**
 * Layered, animated skyline for a city. Pure SVG, tinted by the city palette
 * and time of day. Used in the welcome screen, city picker and home hero.
 */
export function CitySkyline({ city, mode = skyModeFor(), height = 260, compact = false, className = '' }: { city: CityId; mode?: SkyMode; height?: number; compact?: boolean; className?: string }) {
  const t = CITY_THEMES[city];
  const P = t.palette;
  const reduced = useReducedMotion();
  const night = mode === 'night';
  const [top, bottom] = t.sky[mode];
  const lm = t.landmarks.filter((l) => l !== 'metrocable' && l !== 'andes' && l !== 'volcano');
  const positions = [190, 470, 760, 1010];
  const base = 360;
  const sea = t.map.water?.kind === 'sea';
  const uid = `${city}-${mode}-${compact ? 'c' : 'f'}`;

  return (
    <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" className={className} style={{ height, width: '100%', display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient>
        <radialGradient id={`sun-${uid}`}><stop offset="0" stopColor={night ? '#FFF8E6' : '#FFF4D0'} /><stop offset="1" stopColor={night ? '#FFF8E6' : P.secondary} stopOpacity={night ? 0.9 : 1} /></radialGradient>
      </defs>
      <rect width="1200" height="400" fill={`url(#sky-${uid})`} />
      {night && Array.from({ length: 40 }).map((_, i) => (
        <motion.circle key={i} cx={(i * 211) % 1200} cy={(i * 37) % 170 + 8} r={i % 5 ? 1.2 : 2} fill="#fff" animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }} transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.13 }} />
      ))}
      <motion.circle cx={night ? 980 : 1000} cy={night ? 80 : 95} r={night ? 34 : 52} fill={`url(#sun-${uid})`} animate={reduced ? undefined : { scale: [1, 1.05, 1] }} transition={{ duration: 6, repeat: Infinity }} style={{ transformOrigin: '1000px 95px' }} />
      {!night && !reduced && [0, 1, 2].map((i) => (
        <motion.g key={i} initial={{ x: -250 + i * 420 }} animate={{ x: [-250 + i * 420, 1350] }} transition={{ duration: 70 + i * 20, repeat: Infinity, ease: 'linear', delay: -i * 25 }}>
          <ellipse cx="0" cy={70 + i * 30} rx="70" ry="17" fill="#fff" opacity=".8" />
          <ellipse cx="40" cy={60 + i * 30} rx="42" ry="18" fill="#fff" opacity=".8" />
        </motion.g>
      ))}
      {/* birds */}
      {!reduced && !night && (
        <motion.g animate={{ x: [0, 900], y: [0, -40] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
          {[0, 1, 2].map((i) => <path key={i} d={`M${120 + i * 26} ${150 + (i % 2) * 10} q6 -7 12 0 q6 -7 12 0`} stroke={P.deep} strokeWidth="2" fill="none" opacity=".6" />)}
        </motion.g>
      )}

      {/* far layer: mountains */}
      {t.map.mountains === 'sierra' && <path d="M0 260 L120 200 L230 240 L360 170 L480 235 L620 180 L760 240 L900 175 L1040 230 L1200 190 L1200 400 L0 400 Z" fill={night ? '#26324C' : '#B7C3D2'} opacity=".75" />}
      {t.map.mountains === 'coastal-hills' && <path d="M0 250 Q200 170 380 220 Q560 160 760 230 Q960 180 1200 240 L1200 400 L0 400 Z" fill={night ? '#1F3540' : P.tertiaryLight} opacity=".55" />}
      {(t.map.mountains === 'valley' || t.landmarks.includes('andes')) && (
        <>
          <path d="M0 140 Q120 120 260 200 Q380 270 520 300 L0 400 Z" fill={night ? '#173028' : P.tertiary} opacity=".55" />
          <path d="M1200 120 Q1060 120 930 200 Q800 270 660 300 L1200 400 Z" fill={night ? '#173028' : P.tertiary} opacity=".55" />
          <path d="M0 220 Q180 200 340 280 L0 400 Z" fill={night ? '#1E3A31' : P.primary} opacity=".55" />
          <path d="M1200 210 Q1020 200 880 280 L1200 400 Z" fill={night ? '#1E3A31' : P.primary} opacity=".55" />
        </>
      )}
      {t.landmarks.includes('volcano') && <LandmarkShape id="volcano" x={300} base={300} t={t} night={night} />}

      {/* mid layer: generic city */}
      {Array.from({ length: 26 }).map((_, i) => {
        const h = 50 + ((i * 53) % 90);
        return <rect key={i} x={i * 48 - 10} y={base - h} width="44" height={h} fill={night ? '#1A2238' : P.deep} opacity={night ? 0.65 : 0.18} />;
      })}
      {t.landmarks.includes('comuna-houses') && <LandmarkShape id="comuna-houses" x={180} base={300} t={t} night={night} />}

      {/* landmarks */}
      {lm.map((l, i) => <LandmarkShape key={l} id={l} x={positions[i] ?? 600} base={base} t={t} night={night} />)}

      {/* metrocable overlay */}
      {t.landmarks.includes('metrocable') && (
        <g>
          <line x1="560" y1="330" x2="1180" y2="150" stroke={night ? '#9AA8C0' : P.deep} strokeWidth="2" />
          {[0, 1, 2].map((i) => (
            <motion.g key={i} initial={{ x: 0, y: 0 }} animate={reduced ? undefined : { x: [0, 620], y: [0, -180] }} transition={{ duration: 14, repeat: Infinity, ease: 'linear', delay: -i * 4.6 }}>
              <line x1="560" y1="330" x2="560" y2="344" stroke={P.deep} strokeWidth="2" />
              <rect x="546" y="344" width="28" height="22" rx="5" fill={P.secondary} />
              <rect x="550" y="349" width="20" height="8" rx="2" fill="#fff" opacity=".8" />
            </motion.g>
          ))}
        </g>
      )}

      {/* water / ground */}
      {sea ? (
        <>
          <rect x="0" y={base} width="1200" height={400 - base} fill={night ? '#1C3556' : P.deepLight} />
          {!reduced && [0, 1].map((i) => (
            <motion.path key={i} d={`M0 ${base + 12 + i * 14} q30 -6 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0`} stroke="#fff" strokeWidth="2" fill="none" opacity=".35" animate={{ x: [0, -60] }} transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear' }} />
          ))}
        </>
      ) : (
        <rect x="0" y={base} width="1200" height={400 - base} fill={night ? '#151B2C' : P.primary} opacity={night ? 1 : 0.9} />
      )}
      {night && Array.from({ length: 30 }).map((_, i) => <rect key={i} x={(i * 97) % 1200} y={base - 20 - ((i * 31) % 80)} width="4" height="5" fill={P.secondaryLight} opacity=".8" />)}
    </svg>
  );
}

/** Small flag made of stripes (works everywhere, unlike flag emoji on Windows). */
export function Flag({ city, size = 18 }: { city: CityId; size?: number }) {
  const t = CITY_THEMES[city];
  const n = t.flag.length;
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 30 20" className="inline-block shrink-0 rounded-[3px] ring-1 ring-ink/10" aria-hidden preserveAspectRatio="none">
      {t.flag.map((c, i) => (t.flagVertical
        ? <rect key={i} x={(i * 30) / n} y="0" width={30 / n + 0.2} height="20" fill={c} />
        : <rect key={i} x="0" y={(i * 20) / n} width="30" height={20 / n + 0.2} fill={c} />))}
    </svg>
  );
}
