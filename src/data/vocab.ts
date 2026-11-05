import type { Interest, Region } from '../types';

// Vocabulary bank. `mx` gives the Mexican Spanish form where it differs.
// Memory aids: `origin` is real etymology; `trick`, `visual` and `story`
// are invented memory devices and are labelled as such in the UI.

export type VocabTheme = 'arrival' | 'home' | 'cafe' | 'social' | 'everyday' | Interest;

export interface VocabItem {
  id: string;
  es: string;
  mx?: string;
  /** Argentina (Río de la Plata). */
  ar?: string;
  /** Colombia. */
  co?: string;
  en: string;
  theme: VocabTheme;
  level: 'A1' | 'A2' | 'B1';
  gender?: 'm' | 'f';
  origin?: string;
  trick?: string;
  visual?: string;
  story?: string;
  regionNote?: string;
}

export const VOCAB: VocabItem[] = [
  // Arrival
  { id: 'aeropuerto', es: 'el aeropuerto', en: 'the airport', theme: 'arrival', level: 'A1', gender: 'm', origin: 'Aero- (air) + puerto (port, from Latin portus) — literally "air port".', visual: 'A port where planes dock instead of ships.' },
  { id: 'maleta', es: 'la maleta', en: 'the suitcase', theme: 'arrival', level: 'A1', gender: 'f', trick: '"MAL-ETA": a suitcase that arrives late has a bad (mal) ETA.', visual: 'A battered suitcase spinning alone on the carousel.' },
  { id: 'billete', es: 'el billete', mx: 'el boleto', ar: 'el boleto', co: 'el tiquete', en: 'the ticket', theme: 'arrival', level: 'A1', gender: 'm', trick: 'A BILL you pay to travel.', regionNote: 'Spain: billete. Mexico & Argentina: boleto (Argentina: pasaje for planes and coaches). Colombia: tiquete (also boleto).' },
  { id: 'salida', es: 'la salida', en: 'the exit', theme: 'arrival', level: 'A1', gender: 'f', origin: 'From salir, "to go out" (Latin salire, "to jump").', visual: 'The green SALIDA sign glowing over the metro stairs.' },
  { id: 'llegadas', es: 'las llegadas', en: 'arrivals', theme: 'arrival', level: 'A1', gender: 'f', origin: 'From llegar, "to arrive".' },
  { id: 'andén', es: 'el andén', en: 'the platform', theme: 'arrival', level: 'A2', gender: 'm', trick: '"AND THEN" you wait on the platform.' },
  { id: 'izquierda', es: 'a la izquierda', en: 'on the left', theme: 'arrival', level: 'A1', trick: 'The long, awkward word goes with your awkward hand: IZQUIERDA = left (for most people!).', visual: 'Your left hand clumsily writing the long word IZQUIERDA.' },
  { id: 'derecha', es: 'a la derecha', en: 'on the right', theme: 'arrival', level: 'A1', origin: 'From Latin directus, "straight / right" — English "direct".' },
  { id: 'todo-recto', es: 'todo recto', mx: 'todo derecho', ar: 'todo derecho', co: 'todo derecho', en: 'straight ahead', theme: 'arrival', level: 'A1', origin: 'Recto from Latin rectus, "straight" — English "rectangle".', regionNote: 'Spain: todo recto. Latin America: todo derecho / derecho.' },
  { id: 'taxi', es: 'el taxi', en: 'the taxi', theme: 'arrival', level: 'A1', gender: 'm' },
  { id: 'pasaporte', es: 'el pasaporte', en: 'the passport', theme: 'arrival', level: 'A1', gender: 'm' },
  { id: 'movil', es: 'el móvil', mx: 'el celular', ar: 'el celular', co: 'el celular', en: 'the mobile phone', theme: 'arrival', level: 'A1', gender: 'm', trick: 'A MOBILE is MÓVIL — it moves with you.', regionNote: 'Spain: móvil. Latin America: celular.' },

  // Home
  { id: 'piso', es: 'el piso', mx: 'el departamento', ar: 'el departamento', co: 'el apartamento', en: 'the flat / apartment', theme: 'home', level: 'A1', gender: 'm', regionNote: 'Spain: piso. Mexico & Argentina: departamento. Colombia: apartamento.', trick: 'Your PISO is on a floor (piso also means floor).' },
  { id: 'vecino', es: 'el vecino / la vecina', en: 'the neighbour', theme: 'home', level: 'A1', origin: 'From Latin vicinus — English "vicinity".', trick: 'Neighbours live in your VICINITY.' },
  { id: 'llave', es: 'la llave', en: 'the key', theme: 'home', level: 'A1', gender: 'f', trick: 'Don\'t LEAVE without your LLAVE.' },
  { id: 'alquiler', es: 'el alquiler', mx: 'la renta', ar: 'el alquiler', co: 'el arriendo', en: 'the rent', theme: 'home', level: 'A2', gender: 'm', regionNote: 'Spain & Argentina: alquiler. Mexico: renta. Colombia: arriendo.', origin: 'From Arabic al-kirā\', "the hire" — one of many Arabic-origin words beginning al-.' },
  { id: 'escalera', es: 'la escalera', en: 'the stairs', theme: 'home', level: 'A1', gender: 'f', origin: 'From Latin scala — English "scale", "escalator".' },
  { id: 'ascensor', es: 'el ascensor', en: 'the lift / elevator', theme: 'home', level: 'A1', gender: 'm', origin: 'From Latin ascendere — English "ascend".' },
  { id: 'cocina', es: 'la cocina', en: 'the kitchen', theme: 'home', level: 'A1', gender: 'f', origin: 'From Latin coquina — related to English "cook" and "kitchen".' },
  { id: 'ventana', es: 'la ventana', en: 'the window', theme: 'home', level: 'A1', gender: 'f', origin: 'From Latin ventus, "wind" — English "vent", "ventilate".' },
  { id: 'ruido', es: 'el ruido', en: 'the noise', theme: 'home', level: 'A2', gender: 'm', trick: 'Noise at 3 am is RUDE: RUIDO.' },
  { id: 'portal', es: 'el portal', en: 'the building entrance', theme: 'home', level: 'A2', gender: 'm', origin: 'From Latin porta, "gate" — English "portal".' },

  // Café
  { id: 'cafe-con-leche', es: 'un café con leche', en: 'a white coffee', theme: 'cafe', level: 'A1', origin: 'Leche from Latin lac, lactis — English "lactose".' },
  { id: 'cafe-solo', es: 'un café solo', en: 'an espresso', theme: 'cafe', level: 'A1', trick: 'SOLO = alone: coffee all on its own.' },
  { id: 'cortado', es: 'un cortado', en: 'an espresso with a dash of milk', theme: 'cafe', level: 'A1', origin: 'From cortar, "to cut" — the milk "cuts" the coffee.' },
  { id: 'cuenta', es: 'la cuenta', en: 'the bill', theme: 'cafe', level: 'A1', gender: 'f', origin: 'From contar, "to count" — English "count", "account".' },
  { id: 'tostada', es: 'la tostada', en: 'toast', theme: 'cafe', level: 'A1', gender: 'f', origin: 'From tostar, "to toast" (Latin tostus).' },
  { id: 'zumo', es: 'el zumo', mx: 'el jugo', ar: 'el jugo', co: 'el jugo', en: 'the juice', theme: 'cafe', level: 'A1', gender: 'm', regionNote: 'Spain: zumo. Mexico and Latin America: jugo.', trick: 'ZUM-ZUM goes the juicer.' },
  { id: 'camarero', es: 'el camarero / la camarera', mx: 'el mesero / la mesera', ar: 'el mozo / la moza', co: 'el mesero / la mesera', en: 'the waiter / waitress', theme: 'cafe', level: 'A1', regionNote: 'Spain: camarero. Mexico & Colombia: mesero. Argentina: mozo / moza.' },
  { id: 'terraza', es: 'la terraza', en: 'the outdoor seating area', theme: 'cafe', level: 'A1', gender: 'f', origin: 'From Latin terra, "earth" — English "terrace".' },
  { id: 'propina', es: 'la propina', en: 'the tip', theme: 'cafe', level: 'A2', gender: 'f', trick: 'A PRO leaves a PROPINA.' },
  { id: 'para-llevar', es: 'para llevar', en: 'to take away', theme: 'cafe', level: 'A1' },

  // Social
  { id: 'quedar', es: 'quedar', en: 'to meet up (arrange to meet)', theme: 'social', level: 'A2', trick: '"Quedamos a las ocho" — QUEue up DAte: arrange to meet.' },
  { id: 'amigo', es: 'el amigo / la amiga', en: 'the friend', theme: 'social', level: 'A1', origin: 'From Latin amicus — English "amicable".' },
  { id: 'cita', es: 'la cita', en: 'the date / appointment', theme: 'social', level: 'A2', gender: 'f', trick: 'A date in the CITY: CITA.' },
  { id: 'guay', es: 'guay', mx: 'padre / chido', ar: 'copado / copada', co: 'chévere / bacano', en: 'cool, great (informal)', theme: 'social', level: 'A2', regionNote: 'Spain: guay. Mexico: padre, chido. Argentina: copado. Colombia: chévere, bacano. All informal.' },
  { id: 'vale', es: 'vale', mx: 'va / sale', ar: 'dale', co: 'listo / de una', en: 'OK, sure', theme: 'social', level: 'A1', regionNote: 'Spain: vale. Mexico: va, sale. Argentina: dale. Colombia: listo, de una.', origin: 'From valer, "to be worth" — Latin valere, English "valid".' },
  { id: 'encantado', es: 'encantado / encantada', en: 'pleased to meet you', theme: 'social', level: 'A1', origin: 'Literally "enchanted" — English "enchanted".' },
  { id: 'tapas', es: 'las tapas', en: 'small shared plates', theme: 'social', level: 'A1', gender: 'f', origin: 'From tapar, "to cover" — popular accounts say bread or ham once covered a drink.' },
  { id: 'cerveza', es: 'la cerveza', en: 'the beer', theme: 'social', level: 'A1', gender: 'f', regionNote: 'In Spain, una caña is a small draught beer. In Mexico, chela is informal for beer.' },

  // Everyday
  { id: 'gracias', es: 'gracias', en: 'thank you', theme: 'everyday', level: 'A1', origin: 'From Latin gratia — English "gratitude", "grace".' },
  { id: 'perdon', es: 'perdón', en: 'sorry / excuse me', theme: 'everyday', level: 'A1', origin: 'From Late Latin perdonare (per + donare, "to give completely") — same root as English "pardon".' },
  { id: 'ordenador', es: 'el ordenador', mx: 'la computadora', ar: 'la computadora', co: 'el computador', en: 'the computer', theme: 'everyday', level: 'A1', regionNote: 'Spain: ordenador. Mexico & Argentina: computadora. Colombia: computador.', trick: 'It puts your files in ORDER: ordenador.' },
  { id: 'coche', es: 'el coche', mx: 'el carro', ar: 'el auto', co: 'el carro', en: 'the car', theme: 'everyday', level: 'A1', gender: 'm', regionNote: 'Spain: coche. Mexico & Colombia: carro. Argentina: auto.', origin: 'Coche shares its origin with English "coach" (from Kocs, a Hungarian town).' },
  { id: 'autobus', es: 'el autobús', mx: 'el camión', ar: 'el colectivo', co: 'el bus / la buseta', en: 'the bus', theme: 'everyday', level: 'A1', gender: 'm', regionNote: 'Spain: autobús. Mexico City: camión. Argentina: colectivo. Colombia: bus, buseta.' },
  { id: 'patata', es: 'la patata', mx: 'la papa', ar: 'la papa', co: 'la papa', en: 'the potato', theme: 'everyday', level: 'A1', gender: 'f', regionNote: 'Spain: patata. Mexico: papa.' },
  { id: 'gafas', es: 'las gafas', mx: 'los lentes', ar: 'los anteojos', co: 'las gafas', en: 'glasses', theme: 'everyday', level: 'A2', regionNote: 'Spain & Colombia: gafas. Mexico: lentes. Argentina: anteojos.' },
  { id: 'farmacia', es: 'la farmacia', en: 'the pharmacy', theme: 'everyday', level: 'A1', gender: 'f' },

  // Interest packs
  { id: 'partido', es: 'el partido', en: 'the match', theme: 'football', level: 'A1', gender: 'm', trick: 'A match is a PARTY: partido.' },
  { id: 'equipo', es: 'el equipo', en: 'the team', theme: 'football', level: 'A1', gender: 'm', trick: 'A team is EQUIPPED to win.' },
  { id: 'gol', es: 'el gol', en: 'the goal', theme: 'football', level: 'A1', gender: 'm' },
  { id: 'gimnasio', es: 'el gimnasio', mx: 'el gimnasio / el gym', ar: 'el gimnasio', co: 'el gimnasio', en: 'the gym', theme: 'fitness', level: 'A1', gender: 'm', origin: 'From Greek gymnasion, via Latin — English "gymnasium".' },
  { id: 'entrenar', es: 'entrenar', en: 'to train / work out', theme: 'fitness', level: 'A2', trick: 'Get on the TRAIN to TRAIN.' },
  { id: 'correr', es: 'correr', en: 'to run', theme: 'fitness', level: 'A1', origin: 'From Latin currere — English "current", "courier".' },
  { id: 'receta', es: 'la receta', en: 'the recipe (also: prescription)', theme: 'food', level: 'A2', gender: 'f', origin: 'From Latin recepta, "received" — same root as English "recipe" and "receipt".' },
  { id: 'mercado', es: 'el mercado', en: 'the market', theme: 'food', level: 'A1', gender: 'm', origin: 'From Latin mercatus — English "market", "merchant".' },
  { id: 'rico', es: 'rico / rica', en: 'tasty (of food)', theme: 'food', level: 'A1', trick: 'RICH food is RICO.' },
  { id: 'concierto', es: 'el concierto', en: 'the concert', theme: 'music', level: 'A1', gender: 'm' },
  { id: 'cancion', es: 'la canción', en: 'the song', theme: 'music', level: 'A1', gender: 'f', origin: 'From Latin cantio — English "chant".' },
  { id: 'museo', es: 'el museo', en: 'the museum', theme: 'art', level: 'A1', gender: 'm' },
  { id: 'cuadro', es: 'el cuadro', en: 'the painting', theme: 'art', level: 'A2', gender: 'm', trick: 'Paintings hang in a sQUARE (cuadro) frame.', origin: 'From Latin quadrus, "square".' },
  { id: 'exposicion', es: 'la exposición', en: 'the exhibition', theme: 'art', level: 'A2', gender: 'f' },
  { id: 'reunion', es: 'la reunión', en: 'the meeting', theme: 'tech', level: 'A2', gender: 'f', trick: 'A meeting is a RE-UNION of colleagues.' },
  { id: 'pantalla', es: 'la pantalla', en: 'the screen', theme: 'tech', level: 'A2', gender: 'f', trick: 'You PANT at your screen all day.' },
  { id: 'aplicacion', es: 'la aplicación / la app', en: 'the app', theme: 'tech', level: 'A1', gender: 'f' },
  { id: 'viaje', es: 'el viaje', en: 'the trip', theme: 'travel', level: 'A1', gender: 'm', origin: 'From Latin viaticum, provisions for a journey (via = road) — English "voyage".' },
  { id: 'playa', es: 'la playa', en: 'the beach', theme: 'travel', level: 'A1', gender: 'f', trick: 'You PLAY on the PLAYA.' },
  { id: 'marcha', es: 'la marcha', en: 'nightlife, going out (Spain, informal)', theme: 'nightlife', level: 'B1', gender: 'f', regionNote: 'Spain: ir de marcha. Mexico: ir de fiesta / ir al antro.' },
  { id: 'discoteca', es: 'la discoteca', mx: 'el antro', ar: 'el boliche', co: 'la discoteca', en: 'the club', theme: 'nightlife', level: 'A2', regionNote: 'Spain & Colombia: discoteca. Mexico: antro. Argentina: boliche.' },
  { id: 'libro', es: 'el libro', en: 'the book', theme: 'reading', level: 'A1', gender: 'm', origin: 'From Latin liber — English "library".', trick: 'Watch out: librería = bookshop, biblioteca = library.' },
  { id: 'pelicula', es: 'la película', en: 'the film', theme: 'cinema', level: 'A1', gender: 'f', origin: 'Literally "little skin / film" — from Latin pellicula.' },
  { id: 'montana', es: 'la montaña', en: 'the mountain', theme: 'nature', level: 'A1', gender: 'f' },
  { id: 'parque', es: 'el parque', en: 'the park', theme: 'nature', level: 'A1', gender: 'm' },
];

export const VOCAB_BY_ID: Record<string, VocabItem> = Object.fromEntries(VOCAB.map((v) => [v.id, v]));

/** Adds city-specific vocabulary to the bank (called once per city story at load). */
export function registerVocab(items: VocabItem[] = []) {
  for (const v of items) {
    if (VOCAB_BY_ID[v.id]) continue;
    VOCAB.push(v);
    VOCAB_BY_ID[v.id] = v;
  }
}

/** The form to teach for this learner's region. */
export function vocabForm(item: VocabItem, region: Region): string {
  if (region === 'mexico') return item.mx ?? item.es;
  if (region === 'argentina') return item.ar ?? item.es;
  if (region === 'colombia') return item.co ?? item.es;
  return item.es;
}

/** Strips article / gendered alternatives for answer checking: "el vecino / la vecina" → ["vecino", "vecina"]. */
export function acceptedAnswers(form: string): string[] {
  const parts = form.split('/').map((p) => p.replace(/\(.*?\)/g, '').trim());
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    out.add(p.replace(/^(el|la|los|las|un|una|a la|al)\s+/i, ''));
  }
  return [...out].filter(Boolean);
}

export function vocabKey(id: string): string {
  return `vocab:${id}`;
}
