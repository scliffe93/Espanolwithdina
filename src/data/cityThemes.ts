import type { Region } from '../types';
import type { CityId } from './storyTypes';

// ───────────────────────────────────────────────────────────────
// City identities: palette (re-themes the whole app), skyline
// landmarks, map geography, transit style and local menu.
// Palettes take inspiration from each city's famous colours.
// ───────────────────────────────────────────────────────────────

export interface Palette {
  primary: string; primaryDark: string; primaryLight: string; primary50: string;
  secondary: string; secondaryLight: string; secondary50: string;
  tertiary: string; tertiaryLight: string; tertiary50: string;
  deep: string; deepLight: string; deep50: string;
  rose: string; rose50: string;
  bg: string; bg100: string; bg200: string; bgWarm: string;
}

export type Landmark =
  | 'metropolis' | 'alcala' | 'torres-kio' | 'palacio'
  | 'sagrada' | 'glories' | 'montjuic' | 'w-hotel'
  | 'giralda' | 'torre-oro' | 'setas' | 'plaza-espana'
  | 'angel' | 'latino' | 'bellas-artes' | 'volcano'
  | 'obelisco' | 'congreso' | 'puente-mujer' | 'caminito'
  | 'coltejer' | 'metrocable' | 'comuna-houses' | 'andes'
  | 'serranos' | 'miguelete' | 'hemisferic' | 'palau-arts';

export interface FoodItem { id: string; es: string; en: string; icon: string; /** with article, singular */ one?: string; /** plural noun phrase */ pl?: string }

export interface CityTheme {
  id: CityId;
  name: string;
  country: string;
  variety: Region;
  varietyLabel: string;
  voice: string; // preferred speech-synthesis locale
  tagline: string;
  greeting: { es: string; en: string };
  vibe: string;
  flag: string[]; // stripes, top→bottom (or left→right when flagVertical)
  flagVertical?: boolean;
  palette: Palette;
  sky: { day: [string, string]; dusk: [string, string]; night: [string, string] };
  landmarks: Landmark[];
  map: {
    water?: { kind: 'river' | 'sea'; path: string; width?: number; /** A former riverbed turned park (Valencia's Turia) is drawn green. */ asPark?: boolean };
    /** A second body of water (e.g. a sea alongside a river). */
    water2?: { kind: 'river' | 'sea'; path: string; width?: number };
    mountains: 'sierra' | 'volcanoes' | 'valley' | 'coastal-hills' | 'none';
    park: { cx: number; cy: number; rx: number; ry: number; name: string };
    cable?: boolean;
  };
  pattern: 'tiles' | 'trencadis' | 'azulejo' | 'papel' | 'fileteado' | 'flores' | 'naranjas';
  transit: { name: string; style: 'train' | 'cable'; colors: string[] };
  foods: FoodItem[];
  available: boolean;
}

const p = (o: Palette) => o;

export const CITY_THEMES: Record<CityId, CityTheme> = {
  madrid: {
    id: 'madrid', name: 'Madrid', country: 'España', variety: 'spain', varietyLabel: 'Spain Spanish', voice: 'es-ES',
    tagline: 'Late nights, sunny terraces, and the city that never sleeps.',
    greeting: { es: '¡Bienvenido a Madrid!', en: 'Welcome to Madrid!' },
    vibe: 'Terracotta rooftops, golden light, café terraces',
    flag: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'],
    palette: p({ primary: '#C2593A', primaryDark: '#963F26', primaryLight: '#E07A55', primary50: '#FBEDE6', secondary: '#E3A33B', secondaryLight: '#F2C66E', secondary50: '#FDF4E2', tertiary: '#5E7149', tertiaryLight: '#8DA46F', tertiary50: '#EEF2E8', deep: '#1F3A5F', deepLight: '#3C6A9E', deep50: '#E7EEF6', rose: '#D98C8C', rose50: '#FAEDEC', bg: '#FBF6EE', bg100: '#F6EEE1', bg200: '#EFE3CF', bgWarm: '#F4E7D3' }),
    sky: { day: ['#8EC1E6', '#F7E6CD'], dusk: ['#E5866A', '#F8D3A8'], night: ['#1B2A44', '#3D4A66'] },
    landmarks: ['palacio', 'alcala', 'metropolis', 'torres-kio'],
    map: { water: { kind: 'river', path: 'M150 640 C170 560 120 500 160 430 C200 360 140 300 190 220 C210 190 200 180 210 170' }, mountains: 'sierra', park: { cx: 715, cy: 390, rx: 85, ry: 70, name: 'Retiro' } },
    pattern: 'tiles',
    transit: { name: 'Metro', style: 'train', colors: ['#1F8BCF', '#E2231A', '#F5D300', '#7AC143'] },
    foods: [
      { id: 'cafe', es: 'café con leche', en: 'white coffee', icon: '☕', one: 'un café con leche', pl: 'cafés con leche' },
      { id: 'cana', es: 'caña', en: 'small beer', icon: '🍺', one: 'una caña', pl: 'cañas' },
      { id: 'tortilla', es: 'tortilla', en: 'Spanish omelette', icon: '🥚', one: 'un pincho de tortilla', pl: 'pinchos de tortilla' },
      { id: 'churros', es: 'churros', en: 'churros', icon: '🥖', one: 'una ración de churros', pl: 'raciones de churros' },
      { id: 'croqueta', es: 'croqueta', en: 'croquette', icon: '🧆', one: 'una croqueta', pl: 'croquetas' },
      { id: 'agua', es: 'agua', en: 'water', icon: '💧', one: 'un agua', pl: 'aguas' },
      { id: 'bocadillo', es: 'bocadillo de calamares', en: 'squid sandwich', icon: '🥪', one: 'un bocadillo de calamares', pl: 'bocadillos de calamares' },
      { id: 'vermut', es: 'vermut', en: 'vermouth', icon: '🍷', one: 'un vermut', pl: 'vermuts' },
    ],
    available: true,
  },
  valencia: {
    id: 'valencia', name: 'Valencia', country: 'España', variety: 'spain', varietyLabel: 'Spain Spanish (Valencian flavour)', voice: 'es-ES',
    tagline: 'Orange groves, the Turia gardens, paella on Sundays and the sea ten minutes away.',
    greeting: { es: '¡Bienvenido a Valencia!', en: 'Welcome to Valencia!' },
    vibe: 'Valencia orange, Mediterranean blue, Turia green, white Calatrava curves',
    flag: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'],
    palette: p({ primary: '#E07A2B', primaryDark: '#B35A17', primaryLight: '#F09A55', primary50: '#FDF0E6', secondary: '#F2C530', secondaryLight: '#F8DA6E', secondary50: '#FEF8DF', tertiary: '#4E8F63', tertiaryLight: '#7DB58C', tertiary50: '#E8F3EB', deep: '#1C5A8A', deepLight: '#3C80B4', deep50: '#E6EFF6', rose: '#D94F6B', rose50: '#FBE7EC', bg: '#FBF8F1', bg100: '#F6F0E2', bg200: '#EEE4CF', bgWarm: '#F7EBD9' }),
    sky: { day: ['#78BFEA', '#FBF1DF'], dusk: ['#F28C5A', '#F9D9A5'], night: ['#13243E', '#2F4A6A'] },
    landmarks: ['serranos', 'miguelete', 'hemisferic', 'palau-arts'],
    map: {
      water: { kind: 'river', path: 'M120 200 C240 260 330 250 460 300 C560 340 620 420 690 470 C740 510 790 540 860 560', width: 34, asPark: true },
      water2: { kind: 'sea', path: 'M900 160 L1000 160 L1000 640 L870 640 C850 520 870 400 850 300 C840 240 870 200 900 160 Z' },
      mountains: 'none',
      park: { cx: 300, cy: 560, rx: 110, ry: 45, name: 'Albufera' },
    },
    pattern: 'naranjas',
    transit: { name: 'Metrovalencia', style: 'train', colors: ['#E31E24', '#F6A800', '#007A3D', '#0096D6'] },
    foods: [
      { id: 'horchata', es: 'horchata con fartons', en: 'tiger-nut milk with sweet buns', icon: '🥛', one: 'una horchata con fartons', pl: 'horchatas con fartons' },
      { id: 'paella', es: 'paella valenciana', en: 'Valencian paella', icon: '🥘', one: 'una paella valenciana', pl: 'paellas valencianas' },
      { id: 'agua-valencia', es: 'agua de Valencia', en: 'orange & cava cocktail', icon: '🍹', one: 'un agua de Valencia', pl: 'aguas de Valencia' },
      { id: 'cafe-tiempo', es: 'café del tiempo', en: 'iced coffee with lemon', icon: '☕', one: 'un café del tiempo', pl: 'cafés del tiempo' },
      { id: 'clochinas', es: 'clóchinas', en: 'Valencian mussels', icon: '🦪', one: 'una ración de clóchinas', pl: 'raciones de clóchinas' },
      { id: 'esgarraet', es: 'esgarraet', en: 'roasted pepper & salt cod', icon: '🫑', one: 'un esgarraet', pl: 'esgarraets' },
      { id: 'bunuelo', es: 'buñuelo de calabaza', en: 'pumpkin fritter', icon: '🍩', one: 'un buñuelo de calabaza', pl: 'buñuelos de calabaza' },
      { id: 'agua', es: 'agua', en: 'water', icon: '💧', one: 'un agua', pl: 'aguas' },
    ],
    available: true,
  },
  barcelona: {
    id: 'barcelona', name: 'Barcelona', country: 'España', variety: 'spain', varietyLabel: 'Spain Spanish', voice: 'es-ES',
    tagline: 'Gaudí mosaics, the Mediterranean and long beach evenings.',
    greeting: { es: '¡Bienvenida a Barcelona!', en: 'Welcome to Barcelona!' },
    vibe: 'Trencadís mosaics, sea blue, Mediterranean light',
    flag: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'],
    palette: p({ primary: '#1D6FB8', primaryDark: '#124E85', primaryLight: '#4A92D4', primary50: '#E6F0FA', secondary: '#F2B530', secondaryLight: '#F8D272', secondary50: '#FEF6E0', tertiary: '#1E9E8F', tertiaryLight: '#5CC4B7', tertiary50: '#E3F5F2', deep: '#16324F', deepLight: '#2D5B85', deep50: '#E5ECF3', rose: '#E86F5A', rose50: '#FCEBE7', bg: '#F7F8F4', bg100: '#EEF1EA', bg200: '#E2E8DE', bgWarm: '#EAF1F4' }),
    sky: { day: ['#6FB6EA', '#EAF4F7'], dusk: ['#F08D6E', '#FBD7A9'], night: ['#0F2238', '#2A4566'] },
    landmarks: ['montjuic', 'sagrada', 'glories', 'w-hotel'],
    map: { water: { kind: 'sea', path: 'M0 640 L0 600 C220 560 420 590 620 520 C780 460 900 420 1000 360 L1000 640 Z' }, mountains: 'coastal-hills', park: { cx: 270, cy: 470, rx: 90, ry: 55, name: 'Montjuïc' } },
    pattern: 'trencadis',
    transit: { name: 'Metro', style: 'train', colors: ['#E2231A', '#9B4F96', '#2BA640', '#F7A600'] },
    foods: [
      { id: 'cortado', es: 'cortado', en: 'espresso with a dash of milk', icon: '☕', one: 'un cortado', pl: 'cortados' },
      { id: 'pan-tomate', es: 'pan con tomate', en: 'bread with tomato', icon: '🍅', one: 'un pan con tomate', pl: 'panes con tomate' },
      { id: 'croqueta', es: 'croqueta', en: 'croquette', icon: '🧆', one: 'una croqueta', pl: 'croquetas' },
      { id: 'clara', es: 'clara', en: 'shandy', icon: '🍺', one: 'una clara', pl: 'claras' },
      { id: 'vermut', es: 'vermut', en: 'vermouth', icon: '🍷', one: 'un vermut', pl: 'vermuts' },
      { id: 'bravas', es: 'patatas bravas', en: 'spicy potatoes', icon: '🥔', one: 'una ración de bravas', pl: 'raciones de bravas' },
      { id: 'agua', es: 'agua con gas', en: 'sparkling water', icon: '💧', one: 'un agua con gas', pl: 'aguas con gas' },
      { id: 'ensaimada', es: 'ensaimada', en: 'spiral pastry', icon: '🥐', one: 'una ensaimada', pl: 'ensaimadas' },
    ],
    available: true,
  },
  sevilla: {
    id: 'sevilla', name: 'Sevilla', country: 'España', variety: 'spain', varietyLabel: 'Spain Spanish (Andalusian flavour)', voice: 'es-ES',
    tagline: 'Orange trees, azulejos, flamenco and tapas until midnight.',
    greeting: { es: '¡Bienvenido a Sevilla!', en: 'Welcome to Sevilla!' },
    vibe: 'Albero ochre, almagra red, azulejo blue, whitewashed walls',
    flag: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'],
    palette: p({ primary: '#B23A2B', primaryDark: '#86281D', primaryLight: '#D2604F', primary50: '#FAEAE6', secondary: '#E3A21A', secondaryLight: '#F2C55C', secondary50: '#FDF3DC', tertiary: '#3F7D3A', tertiaryLight: '#6FA866', tertiary50: '#EAF3E7', deep: '#1B4F8C', deepLight: '#3A73B8', deep50: '#E5EEF8', rose: '#E58A54', rose50: '#FCEEE4', bg: '#FCF8EF', bg100: '#F8EFDB', bg200: '#F1E1BF', bgWarm: '#F6E6C3' }),
    sky: { day: ['#7CC0EE', '#FBEFD6'], dusk: ['#EE7B4F', '#F9CF95'], night: ['#1C2445', '#463F66'] },
    landmarks: ['torre-oro', 'giralda', 'setas', 'plaza-espana'],
    map: { water: { kind: 'river', path: 'M380 640 C360 560 300 520 330 440 C360 360 310 300 340 230 C360 190 350 180 360 170', width: 30 }, mountains: 'none', park: { cx: 560, cy: 560, rx: 110, ry: 50, name: 'María Luisa' } },
    pattern: 'azulejo',
    transit: { name: 'Metro', style: 'train', colors: ['#2E9A47', '#E2231A', '#F2B530'] },
    foods: [
      { id: 'tinto-verano', es: 'tinto de verano', en: 'red wine with lemonade', icon: '🍷', one: 'un tinto de verano', pl: 'tintos de verano' },
      { id: 'cana', es: 'caña', en: 'small beer', icon: '🍺', one: 'una caña', pl: 'cañas' },
      { id: 'montadito', es: 'montadito', en: 'mini sandwich', icon: '🥪', one: 'un montadito', pl: 'montaditos' },
      { id: 'salmorejo', es: 'salmorejo', en: 'cold tomato soup', icon: '🍅', one: 'un salmorejo', pl: 'salmorejos' },
      { id: 'espinacas', es: 'espinacas con garbanzos', en: 'spinach with chickpeas', icon: '🥬', one: 'una tapa de espinacas con garbanzos', pl: 'tapas de espinacas con garbanzos' },
      { id: 'pescaito', es: 'pescado frito', en: 'fried fish', icon: '🐟', one: 'una ración de pescado frito', pl: 'raciones de pescado frito' },
      { id: 'aceitunas', es: 'aceitunas', en: 'olives', icon: '🫒', one: 'una tapa de aceitunas', pl: 'tapas de aceitunas' },
      { id: 'agua', es: 'agua', en: 'water', icon: '💧', one: 'un agua', pl: 'aguas' },
    ],
    available: true,
  },
  cdmx: {
    id: 'cdmx', name: 'Ciudad de México', country: 'México', variety: 'mexico', varietyLabel: 'Mexican Spanish', voice: 'es-MX',
    tagline: 'Tacos al pastor, jacarandas, murals and a 20-million-person heartbeat.',
    greeting: { es: '¡Bienvenido a la CDMX!', en: 'Welcome to Mexico City!' },
    vibe: 'Rosa mexicano, cobalt blue, marigold, jacaranda purple',
    flag: ['#006847', '#FFFFFF', '#CE1126'], flagVertical: true,
    palette: p({ primary: '#D6247A', primaryDark: '#A3165B', primaryLight: '#EC5C9E', primary50: '#FCE7F1', secondary: '#F29A1A', secondaryLight: '#F8C064', secondary50: '#FEF1DC', tertiary: '#13896F', tertiaryLight: '#46B79C', tertiary50: '#E1F4EF', deep: '#1D3F9E', deepLight: '#3D63C9', deep50: '#E6ECFA', rose: '#8E5AC8', rose50: '#F2EAFB', bg: '#FDF7F4', bg100: '#FAEDE7', bg200: '#F4DCD2', bgWarm: '#FBE4EC' }),
    sky: { day: ['#7DB7E8', '#FBE7EF'], dusk: ['#E9677F', '#FAC58E'], night: ['#20163F', '#4A2D66'] },
    landmarks: ['volcano', 'latino', 'angel', 'bellas-artes'],
    map: { mountains: 'volcanoes', park: { cx: 250, cy: 420, rx: 110, ry: 75, name: 'Chapultepec' } },
    pattern: 'papel',
    transit: { name: 'Metro', style: 'train', colors: ['#E6007E', '#0072BC', '#B5A642', '#00A651'] },
    foods: [
      { id: 'pastor', es: 'taco al pastor', en: 'al pastor taco', icon: '🌮', one: 'un taco al pastor', pl: 'tacos al pastor' },
      { id: 'quesadilla', es: 'quesadilla', en: 'quesadilla', icon: '🫓', one: 'una quesadilla', pl: 'quesadillas' },
      { id: 'horchata', es: 'agua de horchata', en: 'rice drink', icon: '🥛', one: 'un agua de horchata', pl: 'aguas de horchata' },
      { id: 'jamaica', es: 'agua de jamaica', en: 'hibiscus drink', icon: '🌺', one: 'un agua de jamaica', pl: 'aguas de jamaica' },
      { id: 'tamal', es: 'tamal', en: 'tamale', icon: '🫔', one: 'un tamal', pl: 'tamales' },
      { id: 'cafe-olla', es: 'café de olla', en: 'spiced coffee', icon: '☕', one: 'un café de olla', pl: 'cafés de olla' },
      { id: 'elote', es: 'elote', en: 'corn on the cob', icon: '🌽', one: 'un elote', pl: 'elotes' },
      { id: 'pan-dulce', es: 'concha', en: 'sweet bread bun', icon: '🍞', one: 'una concha', pl: 'conchas' },
    ],
    available: true,
  },
  buenosaires: {
    id: 'buenosaires', name: 'Buenos Aires', country: 'Argentina', variety: 'argentina', varietyLabel: 'Rioplatense Spanish (vos)', voice: 'es-AR',
    tagline: 'Tango, mate, café culture and the bright tin houses of La Boca.',
    greeting: { es: '¡Bienvenido a Buenos Aires, che!', en: 'Welcome to Buenos Aires!' },
    vibe: 'Celeste sky, Caminito yellow, tango red',
    flag: ['#74ACDF', '#FFFFFF', '#74ACDF'],
    palette: p({ primary: '#2C6FB7', primaryDark: '#1D4F86', primaryLight: '#5B97D6', primary50: '#E5EFFA', secondary: '#F6B40E', secondaryLight: '#F9CF5B', secondary50: '#FEF5DA', tertiary: '#2E8B57', tertiaryLight: '#5DB383', tertiary50: '#E4F3EA', deep: '#1C1C2A', deepLight: '#3C3C55', deep50: '#EAEAF0', rose: '#C8102E', rose50: '#FBE5E8', bg: '#F7F9FC', bg100: '#ECF2F9', bg200: '#DCE7F3', bgWarm: '#E4EEF8' }),
    sky: { day: ['#74ACDF', '#EEF5FB'], dusk: ['#E1765E', '#F7C997'], night: ['#121A33', '#2E3A5E'] },
    landmarks: ['caminito', 'congreso', 'obelisco', 'puente-mujer'],
    map: { water: { kind: 'sea', path: 'M560 160 C700 200 820 170 1000 165 L1000 640 L900 640 C860 520 820 420 760 340 C700 260 620 210 560 160 Z' }, mountains: 'none', park: { cx: 520, cy: 290, rx: 95, ry: 60, name: 'Bosques de Palermo' } },
    pattern: 'fileteado',
    transit: { name: 'Subte', style: 'train', colors: ['#00AEEF', '#E30613', '#0067B1', '#009B3A'] },
    foods: [
      { id: 'medialuna', es: 'medialuna', en: 'croissant', icon: '🥐', one: 'una medialuna', pl: 'medialunas' },
      { id: 'cortado', es: 'cortado', en: 'espresso with milk', icon: '☕', one: 'un cortado', pl: 'cortados' },
      { id: 'empanada', es: 'empanada', en: 'empanada', icon: '🥟', one: 'una empanada', pl: 'empanadas' },
      { id: 'submarino', es: 'submarino', en: 'hot milk with chocolate', icon: '🍫', one: 'un submarino', pl: 'submarinos' },
      { id: 'alfajor', es: 'alfajor', en: 'dulce de leche cookie', icon: '🍪', one: 'un alfajor', pl: 'alfajores' },
      { id: 'tostado', es: 'tostado', en: 'toasted sandwich', icon: '🥪', one: 'un tostado', pl: 'tostados' },
      { id: 'agua', es: 'agua sin gas', en: 'still water', icon: '💧', one: 'un agua sin gas', pl: 'aguas sin gas' },
      { id: 'malbec', es: 'copa de malbec', en: 'glass of malbec', icon: '🍷', one: 'una copa de malbec', pl: 'copas de malbec' },
    ],
    available: true,
  },
  medellin: {
    id: 'medellin', name: 'Medellín', country: 'Colombia', variety: 'colombia', varietyLabel: 'Colombian Spanish (paisa)', voice: 'es-CO',
    tagline: 'The city of eternal spring — flowers, mountains, cable cars and salsa.',
    greeting: { es: '¡Bienvenido a Medellín, pues!', en: 'Welcome to Medellín!' },
    vibe: 'Lush green valley, orchid magenta, Colombian yellow',
    flag: ['#FCD116', '#FCD116', '#003893', '#CE1126'],
    palette: p({ primary: '#2D8A4E', primaryDark: '#1D6438', primaryLight: '#55AE72', primary50: '#E6F4EA', secondary: '#F5C518', secondaryLight: '#F9DA67', secondary50: '#FEF8DC', tertiary: '#C2307A', tertiaryLight: '#DE6BA6', tertiary50: '#FBE7F1', deep: '#173A5E', deepLight: '#2F6194', deep50: '#E5ECF4', rose: '#E8644A', rose50: '#FCEAE5', bg: '#F7FAF4', bg100: '#EDF4E6', bg200: '#DDEAD2', bgWarm: '#E8F2DF' }),
    sky: { day: ['#86C3EA', '#F1F8E8'], dusk: ['#E88A5A', '#F7D59B'], night: ['#122437', '#2E4A52'] },
    landmarks: ['andes', 'comuna-houses', 'coltejer', 'metrocable'],
    map: { water: { kind: 'river', path: 'M470 640 C480 560 450 500 490 430 C530 360 480 300 520 230 C540 190 530 180 540 170', width: 18 }, mountains: 'valley', park: { cx: 640, cy: 470, rx: 70, ry: 45, name: 'Parque Arví' }, cable: true },
    pattern: 'flores',
    transit: { name: 'Metrocable', style: 'cable', colors: ['#2D8A4E', '#F5C518', '#173A5E'] },
    foods: [
      { id: 'tinto', es: 'tinto', en: 'black coffee', icon: '☕', one: 'un tinto', pl: 'tintos' },
      { id: 'arepa', es: 'arepa con quesito', en: 'arepa with fresh cheese', icon: '🫓', one: 'una arepa con quesito', pl: 'arepas con quesito' },
      { id: 'bunuelo', es: 'buñuelo', en: 'cheese fritter', icon: '🧀', one: 'un buñuelo', pl: 'buñuelos' },
      { id: 'pandebono', es: 'pandebono', en: 'cheese bread', icon: '🥯', one: 'un pandebono', pl: 'pandebonos' },
      { id: 'lulo', es: 'jugo de lulo', en: 'lulo juice', icon: '🍹', one: 'un jugo de lulo', pl: 'jugos de lulo' },
      { id: 'mora', es: 'jugo de mora', en: 'blackberry juice', icon: '🫐', one: 'un jugo de mora', pl: 'jugos de mora' },
      { id: 'empanada', es: 'empanada', en: 'empanada', icon: '🥟', one: 'una empanada', pl: 'empanadas' },
      { id: 'perico', es: 'perico', en: 'coffee with a splash of milk', icon: '🥛', one: 'un perico', pl: 'pericos' },
    ],
    available: true,
  },
};

export const CITY_ORDER: CityId[] = ['madrid', 'valencia', 'barcelona', 'sevilla', 'cdmx', 'buenosaires', 'medellin'];

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
}

/** Writes the city palette into CSS custom properties consumed by Tailwind tokens. */
export function applyCityTheme(id: CityId) {
  const t = CITY_THEMES[id] ?? CITY_THEMES.madrid;
  const pal = t.palette;
  const vars: Record<string, string> = {
    '--c-primary': pal.primary, '--c-primary-dark': pal.primaryDark, '--c-primary-light': pal.primaryLight, '--c-primary-50': pal.primary50,
    '--c-secondary': pal.secondary, '--c-secondary-light': pal.secondaryLight, '--c-secondary-50': pal.secondary50,
    '--c-tertiary': pal.tertiary, '--c-tertiary-light': pal.tertiaryLight, '--c-tertiary-50': pal.tertiary50,
    '--c-deep': pal.deep, '--c-deep-light': pal.deepLight, '--c-deep-50': pal.deep50,
    '--c-rose': pal.rose, '--c-rose-50': pal.rose50,
    '--c-bg': pal.bg, '--c-bg-100': pal.bg100, '--c-bg-200': pal.bg200, '--c-bg-warm': pal.bgWarm,
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, hexToRgb(v));
  root.dataset.city = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pal.primary);
}
