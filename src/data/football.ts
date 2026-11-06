import type { Region } from '../types';
import type { CityId } from './storyTypes';

// ───────────────────────────────────────────────────────────────
// Football in each city: the clubs, their grounds and the words fans
// really use. Drives the football games (penalty shoot-out, derby quiz,
// line-up) so the Spanish a learner practises is the Spanish they will
// hear in the stands of the city they live in.
// ───────────────────────────────────────────────────────────────

export interface Club {
  name: string;
  short: string;
  nickname: string;
  stadium: string;
  /** [primary, secondary] kit colours. */
  colors: [string, string];
  founded: number;
}

export interface CityFootball {
  clubs: Club[];
  /** The local derby, e.g. "el derbi madrileño". */
  derby: string;
  derbyEn: string;
}

export const FOOTBALL: Record<CityId, CityFootball> = {
  madrid: {
    clubs: [
      { name: 'Real Madrid', short: 'el Madrid', nickname: 'los Blancos', stadium: 'el Santiago Bernabéu', colors: ['#ffffff', '#00529f'], founded: 1902 },
      { name: 'Atlético de Madrid', short: 'el Atleti', nickname: 'los Colchoneros', stadium: 'el Metropolitano', colors: ['#cb3524', '#272e61'], founded: 1903 },
    ],
    derby: 'el derbi madrileño', derbyEn: 'the Madrid derby',
  },
  valencia: {
    clubs: [
      { name: 'Valencia CF', short: 'el Valencia', nickname: 'los Che', stadium: 'Mestalla', colors: ['#ffffff', '#f18e00'], founded: 1919 },
      { name: 'Levante UD', short: 'el Levante', nickname: 'los Granotas', stadium: 'el Ciutat de València', colors: ['#1f3b8a', '#9b1b30'], founded: 1909 },
    ],
    derby: 'el derbi valenciano', derbyEn: 'the Valencia derby',
  },
  barcelona: {
    clubs: [
      { name: 'FC Barcelona', short: 'el Barça', nickname: 'los Culés', stadium: 'el Camp Nou', colors: ['#a50044', '#004d98'], founded: 1899 },
      { name: 'RCD Espanyol', short: 'el Espanyol', nickname: 'los Periquitos', stadium: 'el RCDE Stadium', colors: ['#0072bb', '#ffffff'], founded: 1900 },
    ],
    derby: 'el derbi barcelonés', derbyEn: 'the Barcelona derby',
  },
  sevilla: {
    clubs: [
      { name: 'Sevilla FC', short: 'el Sevilla', nickname: 'los Nervionenses', stadium: 'el Sánchez-Pizjuán', colors: ['#ffffff', '#d8161e'], founded: 1890 },
      { name: 'Real Betis', short: 'el Betis', nickname: 'los Verdiblancos', stadium: 'el Benito Villamarín', colors: ['#0b9e4a', '#ffffff'], founded: 1907 },
    ],
    derby: 'el gran derbi sevillano', derbyEn: 'the Seville derby',
  },
  cdmx: {
    clubs: [
      { name: 'Club América', short: 'el América', nickname: 'las Águilas', stadium: 'el Estadio Azteca', colors: ['#fff200', '#0a2240'], founded: 1916 },
      { name: 'Pumas UNAM', short: 'los Pumas', nickname: 'los Universitarios', stadium: 'el Estadio Olímpico Universitario', colors: ['#1f3f80', '#c8a951'], founded: 1954 },
    ],
    derby: 'el clásico capitalino', derbyEn: 'the Mexico City derby',
  },
  buenosaires: {
    clubs: [
      { name: 'Boca Juniors', short: 'Boca', nickname: 'los Xeneizes', stadium: 'la Bombonera', colors: ['#0033a0', '#ffd100'], founded: 1905 },
      { name: 'River Plate', short: 'River', nickname: 'los Millonarios', stadium: 'el Monumental', colors: ['#ffffff', '#e2001a'], founded: 1901 },
    ],
    derby: 'el Superclásico', derbyEn: 'the Superclásico (Boca v River)',
  },
  medellin: {
    clubs: [
      { name: 'Atlético Nacional', short: 'el Nacional', nickname: 'los Verdolagas', stadium: 'el Atanasio Girardot', colors: ['#00a651', '#ffffff'], founded: 1947 },
      { name: 'Independiente Medellín', short: 'el Medellín', nickname: 'el Poderoso', stadium: 'el Atanasio Girardot', colors: ['#e2001a', '#0d2a6c'], founded: 1913 },
    ],
    derby: 'el clásico paisa', derbyEn: 'the Medellín derby',
  },
};

/** The words that differ by region: Spain says "penalti", Latin America "penal"; Argentina has "la hinchada" and "el arquero". */
export function footballWords(region: Region) {
  const latam = region !== 'spain';
  return {
    penalty: latam ? 'el penal' : 'el penalti',
    fans: region === 'argentina' || region === 'colombia' ? 'la hinchada' : 'la afición',
    keeper: region === 'argentina' || region === 'colombia' ? 'el arquero' : 'el portero',
    corner: region === 'mexico' ? 'el tiro de esquina' : 'el córner',
    offside: region === 'mexico' ? 'fuera de lugar' : 'fuera de juego',
    shirt: region === 'mexico' ? 'la playera' : 'la camiseta',
    derbyWord: region === 'spain' ? 'el derbi' : 'el clásico',
    extraTime: region === 'argentina' ? 'el alargue' : latam ? 'el tiempo extra' : 'la prórroga',
  };
}

/** Commentary sentences for the line-up game, built from the city's clubs. `_` marks the word chunks the learner orders. */
export function commentarySentences(city: CityId, region: Region): { es: string; en: string }[] {
  const f = FOOTBALL[city];
  const [a, b] = f.clubs;
  const w = footballWords(region);
  return [
    { es: `${cap(a.short)} juega el domingo en ${a.stadium}`, en: `${a.name} play on Sunday at ${a.stadium.replace(/^(el|la) /, '')}` },
    { es: `${cap(w.fans)} canta durante todo el partido`, en: 'The fans sing through the whole match' },
    { es: `${cap(w.keeper)} para ${w.penalty} en el último minuto`, en: 'The keeper saves the penalty in the last minute' },
    { es: 'Marcamos un gol de cabeza en el minuto noventa', en: 'We score a header in the ninetieth minute' },
    { es: '¿Vamos al estadio o lo vemos en el bar?', en: 'Shall we go to the stadium or watch it in the bar?' },
    { es: 'El árbitro saca tarjeta amarilla al delantero', en: 'The referee shows the striker a yellow card' },
    { es: `Empatamos a uno contra ${b.short}`, en: `We draw one all against ${b.name}` },
    { es: `Hoy es ${f.derby} y toda la ciudad está nerviosa`, en: `Today is ${f.derbyEn} and the whole city is nervous` },
    { es: `${cap(b.nickname)} ganan dos a cero en ${b.stadium}`, en: `${b.name} win two nil at ${b.stadium.replace(/^(el|la) /, '')}` },
    { es: `Mi vecino tiene una entrada de sobra para ${a.stadium}`, en: `My neighbour has a spare ticket for ${a.stadium.replace(/^(el|la) /, '')}` },
    { es: `Después del partido tomamos algo cerca del estadio`, en: 'After the match we have a drink near the stadium' },
    { es: `El entrenador cambia al delantero en la segunda parte`, en: 'The coach substitutes the striker in the second half' },
  ];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
