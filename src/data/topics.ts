// What a student loves, used to make their practice personal. A teacher ticks topics on a student's profile and
// that student's verb practice then draws its example sentences, its growing sentences and some new words from
// those topics: a golfer conjugates "jugar" in "Juego al golf todos los sábados", not in a sentence about a café.
// Everything here is ordinary content in the same shapes as the rest of the app (verb examples, ladders, words),
// so marking, homework review and the memory deck treat it like any other.
import { registerLadders, type Ladder } from './ladders';
import { parseExample, type VerbExample } from './verbs';
import { registerVocab, type VocabItem } from './vocab';
import type { Interest, LearnerProfile } from '../types';

export interface Topic {
  id: string;
  /** Words that mean this topic when a student writes what they are into. */
  keywords: string[];
  label: string;
  /** A short line for the student: what their practice is about. */
  blurb: string;
  /** Present-tense example sentences by verb, with the verb in {braces}. */
  examples: Record<string, VerbExample[]>;
  ladders: Ladder[];
  words: { es: string; en: string; gender?: 'm' | 'f' }[];
}

const L = (id: string, tense: Ladder['tense'], verb: string, rungs: [string, string][]): Ladder => ({ id, tense, verb, rungs: rungs.map(([es, en]) => ({ es, en })) });

export const TOPICS: Topic[] = [
  {
    id: 'golf', keywords: ['golf', 'golfing', 'golfer'], label: 'Golf', blurb: 'the golf course',
    examples: {
      jugar: [{ es: 'Yo {juego} al golf todos los sábados.', en: 'I play golf every Saturday.', person: 0 }, { es: 'Mi amigo y yo {jugamos} dieciocho hoyos.', en: 'My friend and I play eighteen holes.', person: 3 }],
      tener: [{ es: 'Yo {tengo} unos palos de golf nuevos.', en: 'I have some new golf clubs.', person: 0 }],
      ir: [{ es: 'Nosotros {vamos} al campo de golf por la mañana.', en: 'We go to the golf course in the morning.', person: 3 }],
      querer: [{ es: 'Yo {quiero} mejorar mi hándicap.', en: 'I want to improve my handicap.', person: 0 }],
      ser: [{ es: 'El golf {es} mi deporte favorito.', en: 'Golf is my favourite sport.', person: 2 }],
      estar: [{ es: 'La pelota {está} cerca del hoyo.', en: 'The ball is near the hole.', person: 2 }],
      ganar: [{ es: 'Mi hermano siempre {gana} el torneo.', en: 'My brother always wins the tournament.', person: 2 }],
      perder: [{ es: 'Yo {pierdo} muchas pelotas en el lago.', en: 'I lose a lot of balls in the lake.', person: 0 }],
      practicar: [{ es: 'Tú {practicas} el swing cada semana.', en: 'You practise your swing every week.', person: 1 }],
      ver: [{ es: 'Nosotros {vemos} el Masters en la tele.', en: 'We watch the Masters on TV.', person: 3 }],
      necesitar: [{ es: 'Yo {necesito} un palo más largo.', en: 'I need a longer club.', person: 0 }],
      caminar: [{ es: 'Los jugadores {caminan} hasta el green.', en: 'The players walk to the green.', person: 5 }],
      llevar: [{ es: 'Yo {llevo} una gorra en el campo.', en: 'I wear a cap on the course.', person: 0 }],
      poder: [{ es: 'Tú {puedes} jugar el domingo.', en: 'You can play on Sunday.', person: 1 }],
    },
    ladders: [
      L('tp-golf-pres', 'present', 'jugar', [
        ['[Juego] al golf.', 'I play golf.'],
        ['[Los sábados] juego al golf.', 'On Saturdays I play golf.'],
        ['Los sábados juego al golf [y después como en el club].', 'On Saturdays I play golf and afterwards I eat at the club.'],
        ['Los sábados juego al golf y después como en el club [porque me gusta el ambiente].', '…and afterwards I eat at the club because I like the atmosphere.'],
        ['Los sábados juego al golf y después como en el club porque me gusta el ambiente; [sin embargo, cuando llueve me quedo en casa].', '…because I like the atmosphere; however, when it rains I stay at home.'],
      ]),
      L('tp-golf-pret', 'preterite', 'ganar', [
        ['[Gané] el torneo.', 'I won the tournament.'],
        ['[Ayer] gané el torneo.', 'Yesterday I won the tournament.'],
        ['Ayer gané el torneo, [pero perdí tres pelotas].', 'Yesterday I won the tournament, but I lost three balls.'],
        ['Ayer gané el torneo, pero perdí tres pelotas [porque hacía mucho viento].', '…but I lost three balls because it was very windy.'],
        ['Ayer gané el torneo, pero perdí tres pelotas porque hacía mucho viento; [por eso, hoy compro una caja nueva].', '…because it was very windy; that is why I am buying a new box today.'],
      ]),
      L('tp-golf-fut', 'future', 'ir', [
        ['[Iré] al campo de golf.', 'I will go to the golf course.'],
        ['[Mañana] iré al campo de golf.', 'Tomorrow I will go to the golf course.'],
        ['Mañana iré al campo de golf [y jugaré nueve hoyos].', 'Tomorrow I will go to the golf course and I will play nine holes.'],
        ['Mañana iré al campo de golf y jugaré nueve hoyos [aunque haga frío].', '…and I will play nine holes even if it is cold.'],
        ['Mañana iré al campo de golf y jugaré nueve hoyos aunque haga frío; [además, practicaré el swing antes de empezar].', '…even if it is cold; besides, I will practise my swing before starting.'],
      ]),
    ],
    words: [
      { es: 'el campo de golf', en: 'the golf course', gender: 'm' }, { es: 'el palo de golf', en: 'the golf club', gender: 'm' }, { es: 'el hoyo', en: 'the hole', gender: 'm' }, { es: 'la pelota', en: 'the ball', gender: 'f' },
      { es: 'el torneo', en: 'the tournament', gender: 'm' }, { es: 'el golpe', en: 'the stroke, the shot', gender: 'm' }, { es: 'la bandera', en: 'the flag', gender: 'f' }, { es: 'el césped', en: 'the grass', gender: 'm' },
      { es: 'el jugador', en: 'the player', gender: 'm' }, { es: 'la gorra', en: 'the cap', gender: 'f' },
    ],
  },
  {
    id: 'tennis', keywords: ['tennis', 'tenis', 'wimbledon', 'padel', 'pádel'], label: 'Tennis', blurb: 'the tennis court',
    examples: {
      jugar: [{ es: 'Yo {juego} al tenis los martes.', en: 'I play tennis on Tuesdays.', person: 0 }, { es: 'Ellos {juegan} un partido de dobles.', en: 'They are playing a doubles match.', person: 5 }],
      tener: [{ es: 'Tú {tienes} una raqueta muy buena.', en: 'You have a very good racket.', person: 1 }],
      ganar: [{ es: 'Ella {gana} el primer set.', en: 'She wins the first set.', person: 2 }],
      perder: [{ es: 'Nosotros casi nunca {perdemos} en casa.', en: 'We hardly ever lose at home.', person: 3 }],
      ver: [{ es: 'Yo {veo} Wimbledon todos los veranos.', en: 'I watch Wimbledon every summer.', person: 0 }],
      ser: [{ es: 'Mi saque {es} bastante rápido.', en: 'My serve is quite fast.', person: 2 }],
      estar: [{ es: 'La pista {está} libre a las seis.', en: 'The court is free at six.', person: 2 }],
      practicar: [{ es: 'Nosotros {practicamos} el revés con el entrenador.', en: 'We practise the backhand with the coach.', person: 3 }],
      necesitar: [{ es: 'Yo {necesito} pelotas nuevas.', en: 'I need new balls.', person: 0 }],
      querer: [{ es: 'Mi hijo {quiere} una clase de tenis.', en: 'My son wants a tennis lesson.', person: 2 }],
      ir: [{ es: 'Yo {voy} al club de tenis después del trabajo.', en: 'I go to the tennis club after work.', person: 0 }],
      correr: [{ es: 'Tú {corres} mucho en la pista.', en: 'You run a lot on the court.', person: 1 }],
      llegar: [{ es: 'La pelota {llega} muy rápido.', en: 'The ball arrives very fast.', person: 2 }],
      empezar: [{ es: 'El partido {empieza} a las cuatro.', en: 'The match starts at four.', person: 2 }],
    },
    ladders: [
      L('tp-tennis-pres', 'present', 'tener', [
        ['[Tengo] un partido de tenis.', 'I have a tennis match.'],
        ['[Más tarde] tengo un partido de tenis.', 'Later I have a tennis match.'],
        ['Más tarde tengo un partido de tenis [y después ceno con mi compañero de dobles].', 'Later I have a tennis match and afterwards I am having dinner with my doubles partner.'],
        ['Más tarde tengo un partido de tenis y después ceno con mi compañero de dobles [porque siempre jugamos juntos].', '…with my doubles partner because we always play together.'],
        ['Más tarde tengo un partido de tenis y después ceno con mi compañero de dobles porque siempre jugamos juntos; [sin embargo, hoy está un poco lesionado].', '…because we always play together; however, today he is slightly injured.'],
      ]),
      L('tp-tennis-pret', 'preterite', 'ver', [
        ['[Vi] la final de Wimbledon.', 'I watched the Wimbledon final.'],
        ['[El domingo] vi la final de Wimbledon.', 'On Sunday I watched the Wimbledon final.'],
        ['El domingo vi la final de Wimbledon [y me encantó el partido].', 'On Sunday I watched the Wimbledon final and I loved the match.'],
        ['El domingo vi la final de Wimbledon y me encantó el partido [aunque mi jugador favorito perdió].', '…and I loved the match although my favourite player lost.'],
        ['El domingo vi la final de Wimbledon y me encantó el partido aunque mi jugador favorito perdió; [por eso, quiero ver la revancha].', '…although my favourite player lost; that is why I want to watch the rematch.'],
      ]),
      L('tp-tennis-prog', 'progressive', 'practicar', [
        ['[Estoy practicando] el saque.', 'I am practising my serve.'],
        ['[Esta semana] estoy practicando el saque.', 'This week I am practising my serve.'],
        ['Esta semana estoy practicando el saque, [pero todavía fallo mucho].', 'This week I am practising my serve, but I still miss a lot.'],
        ['Esta semana estoy practicando el saque, pero todavía fallo mucho [porque lanzo la pelota demasiado bajo].', '…but I still miss a lot because I throw the ball too low.'],
        ['Esta semana estoy practicando el saque, pero todavía fallo mucho porque lanzo la pelota demasiado bajo; [además, mi entrenador dice que necesito paciencia].', '…because I throw the ball too low; besides, my coach says I need patience.'],
      ]),
    ],
    words: [
      { es: 'la raqueta', en: 'the racket', gender: 'f' }, { es: 'la pista de tenis', en: 'the tennis court', gender: 'f' }, { es: 'la red', en: 'the net', gender: 'f' }, { es: 'el saque', en: 'the serve', gender: 'm' },
      { es: 'el partido', en: 'the match', gender: 'm' }, { es: 'el revés', en: 'the backhand', gender: 'm' }, { es: 'el punto', en: 'the point', gender: 'm' }, { es: 'el entrenador', en: 'the coach', gender: 'm' },
      { es: 'el árbitro', en: 'the umpire', gender: 'm' }, { es: 'la final', en: 'the final', gender: 'f' },
    ],
  },
  {
    id: 'classic-cars', keywords: ['classic car', 'old car', 'vintage car', 'jaguar', 'e-type', 'coches', 'coche', 'motoring', 'cars', 'car'], label: 'Classic cars', blurb: 'classic cars and old Jaguars',
    examples: {
      conducir: [{ es: 'Yo {conduzco} un Jaguar antiguo.', en: 'I drive an old Jaguar.', person: 0 }],
      tener: [{ es: 'Mi vecino {tiene} un Jaguar de 1965.', en: 'My neighbour has a 1965 Jaguar.', person: 2 }],
      comprar: [{ es: 'Nosotros {compramos} piezas para el coche.', en: 'We buy parts for the car.', person: 3 }],
      ser: [{ es: 'Los coches clásicos {son} mi pasión.', en: 'Classic cars are my passion.', person: 5 }],
      estar: [{ es: 'El coche {está} en el garaje.', en: 'The car is in the garage.', person: 2 }],
      limpiar: [{ es: 'Yo {limpio} el coche los domingos.', en: 'I clean the car on Sundays.', person: 0 }],
      querer: [{ es: 'Yo {quiero} un Jaguar E-Type.', en: 'I want a Jaguar E-Type.', person: 0 }],
      ir: [{ es: 'Nosotros {vamos} a una feria de coches antiguos.', en: 'We are going to a classic car show.', person: 3 }],
      ver: [{ es: 'Tú {ves} muchos coches clásicos en la carretera.', en: 'You see a lot of classic cars on the road.', person: 1 }],
      costar: [{ es: 'Este motor {cuesta} mucho dinero.', en: 'This engine costs a lot of money.', person: 2 }],
      arreglar: [{ es: 'Mi padre {arregla} motores antiguos.', en: 'My father repairs old engines.', person: 2 }],
      necesitar: [{ es: 'El coche {necesita} ruedas nuevas.', en: 'The car needs new wheels.', person: 2 }],
      vender: [{ es: 'Ellos {venden} un Jaguar verde.', en: 'They are selling a green Jaguar.', person: 5 }],
      funcionar: [{ es: 'El motor {funciona} muy bien.', en: 'The engine works very well.', person: 2 }],
      preferir: [{ es: 'Yo {prefiero} los coches antiguos.', en: 'I prefer old cars.', person: 0 }],
    },
    ladders: [
      L('tp-cars-pres', 'present', 'conducir', [
        ['[Conduzco] un Jaguar antiguo.', 'I drive an old Jaguar.'],
        ['[Los domingos] conduzco un Jaguar antiguo.', 'On Sundays I drive an old Jaguar.'],
        ['Los domingos conduzco un Jaguar antiguo [y paro en un pueblo bonito].', 'On Sundays I drive an old Jaguar and I stop in a pretty village.'],
        ['Los domingos conduzco un Jaguar antiguo y paro en un pueblo bonito [cuando hace buen tiempo].', '…and I stop in a pretty village when the weather is good.'],
        ['Los domingos conduzco un Jaguar antiguo y paro en un pueblo bonito cuando hace buen tiempo; [sin embargo, en invierno el coche se queda en el garaje].', '…when the weather is good; however, in winter the car stays in the garage.'],
      ]),
      L('tp-cars-pret', 'preterite', 'comprar', [
        ['[Compré] un coche clásico.', 'I bought a classic car.'],
        ['[El año pasado] compré un coche clásico.', 'Last year I bought a classic car.'],
        ['El año pasado compré un coche clásico, [pero el motor no funcionaba].', 'Last year I bought a classic car, but the engine did not work.'],
        ['El año pasado compré un coche clásico, pero el motor no funcionaba [aunque el vendedor dijo que estaba perfecto].', '…but the engine did not work although the seller said it was perfect.'],
        ['El año pasado compré un coche clásico, pero el motor no funcionaba aunque el vendedor dijo que estaba perfecto; [por eso, lo llevé a un mecánico especialista].', '…although the seller said it was perfect; that is why I took it to a specialist mechanic.'],
      ]),
      L('tp-cars-imp', 'imperfect', 'tener', [
        ['Mi abuelo [tenía] un Jaguar.', 'My grandfather had a Jaguar.'],
        ['[Antes] mi abuelo tenía un Jaguar.', 'My grandfather used to have a Jaguar.'],
        ['Antes mi abuelo tenía un Jaguar [y lo limpiaba cada semana].', 'My grandfather used to have a Jaguar and he cleaned it every week.'],
        ['Antes mi abuelo tenía un Jaguar y lo limpiaba cada semana [porque era su tesoro].', '…and he cleaned it every week because it was his treasure.'],
        ['Antes mi abuelo tenía un Jaguar y lo limpiaba cada semana porque era su tesoro; [por eso, ahora me encantan los coches antiguos].', '…because it was his treasure; that is why I love old cars now.'],
      ]),
    ],
    words: [
      { es: 'el coche clásico', en: 'the classic car', gender: 'm' }, { es: 'el motor', en: 'the engine', gender: 'm' }, { es: 'el volante', en: 'the steering wheel', gender: 'm' }, { es: 'la rueda', en: 'the wheel', gender: 'f' },
      { es: 'el garaje', en: 'the garage', gender: 'm' }, { es: 'la carretera', en: 'the road', gender: 'f' }, { es: 'la pieza', en: 'the part', gender: 'f' }, { es: 'el mecánico', en: 'the mechanic', gender: 'm' },
      { es: 'la carrocería', en: 'the bodywork', gender: 'f' }, { es: 'la feria de coches', en: 'the car show', gender: 'f' },
    ],
  },
  {
    id: 'football', keywords: ['football', 'fútbol', 'futbol', 'soccer', 'premier league'], label: 'Football', blurb: 'football',
    examples: {
      jugar: [{ es: 'Nosotros {jugamos} al fútbol los domingos.', en: 'We play football on Sundays.', person: 3 }],
      ver: [{ es: 'Yo {veo} el partido con mis amigos.', en: 'I watch the match with my friends.', person: 0 }],
      ganar: [{ es: 'Mi equipo {gana} casi siempre.', en: 'My team nearly always wins.', person: 2 }],
      perder: [{ es: 'Ellos {pierden} el partido en el último minuto.', en: 'They lose the match in the last minute.', person: 5 }],
      ir: [{ es: 'Tú {vas} al estadio cada mes.', en: 'You go to the stadium every month.', person: 1 }],
      ser: [{ es: 'Yo {soy} del mismo equipo que mi padre.', en: 'I support the same team as my father.', person: 0 }],
    },
    ladders: [L('tp-football-pres', 'present', 'ver', [
      ['[Veo] el partido.', 'I watch the match.'],
      ['[Esta noche] veo el partido.', 'Tonight I am watching the match.'],
      ['Esta noche veo el partido [y ceno en el sofá].', 'Tonight I am watching the match and having dinner on the sofa.'],
      ['Esta noche veo el partido y ceno en el sofá [porque juega mi equipo].', '…and having dinner on the sofa because my team is playing.'],
      ['Esta noche veo el partido y ceno en el sofá porque juega mi equipo; [además, es la final].', '…because my team is playing; besides, it is the final.'],
    ])],
    words: [{ es: 'el equipo', en: 'the team', gender: 'm' }, { es: 'el estadio', en: 'the stadium', gender: 'm' }, { es: 'el gol', en: 'the goal', gender: 'm' }, { es: 'el portero', en: 'the goalkeeper', gender: 'm' }, { es: 'la liga', en: 'the league', gender: 'f' }, { es: 'el aficionado', en: 'the fan', gender: 'm' }],
  },
  {
    id: 'cooking', keywords: ['cooking', 'cook', 'cocinar', 'cocina', 'baking', 'food', 'recipes'], label: 'Cooking', blurb: 'cooking and food',
    examples: {
      cocinar: [{ es: 'Yo {cocino} para mi familia los viernes.', en: 'I cook for my family on Fridays.', person: 0 }],
      comprar: [{ es: 'Tú {compras} verduras en el mercado.', en: 'You buy vegetables at the market.', person: 1 }],
      probar: [{ es: 'Nosotros {probamos} una receta nueva.', en: 'We are trying a new recipe.', person: 3 }],
      necesitar: [{ es: 'La sopa {necesita} más sal.', en: 'The soup needs more salt.', person: 2 }],
      hacer: [{ es: 'Mi abuela {hace} una tortilla muy buena.', en: 'My grandmother makes a very good omelette.', person: 2 }],
      preferir: [{ es: 'Ellos {prefieren} la comida casera.', en: 'They prefer home-made food.', person: 5 }],
    },
    ladders: [L('tp-cooking-pres', 'present', 'cocinar', [
      ['[Cocino] en casa.', 'I cook at home.'],
      ['[Los viernes] cocino en casa.', 'On Fridays I cook at home.'],
      ['Los viernes cocino en casa [y pruebo una receta nueva].', 'On Fridays I cook at home and I try a new recipe.'],
      ['Los viernes cocino en casa y pruebo una receta nueva [porque me relaja].', '…and I try a new recipe because it relaxes me.'],
      ['Los viernes cocino en casa y pruebo una receta nueva porque me relaja; [sin embargo, nunca friego los platos].', '…because it relaxes me; however, I never wash the dishes.'],
    ])],
    words: [{ es: 'la receta', en: 'the recipe', gender: 'f' }, { es: 'la sartén', en: 'the frying pan', gender: 'f' }, { es: 'el horno', en: 'the oven', gender: 'm' }, { es: 'el cuchillo', en: 'the knife', gender: 'm' }, { es: 'el aceite de oliva', en: 'the olive oil', gender: 'm' }, { es: 'el ajo', en: 'the garlic', gender: 'm' }],
  },
  {
    id: 'music', keywords: ['music', 'música', 'guitar', 'piano', 'singing', 'concerts', 'gigs'], label: 'Music', blurb: 'music',
    examples: {
      escuchar: [{ es: 'Yo {escucho} música en el coche.', en: 'I listen to music in the car.', person: 0 }],
      tocar: [{ es: 'Mi hermana {toca} la guitarra.', en: 'My sister plays the guitar.', person: 2 }],
      cantar: [{ es: 'Nosotros {cantamos} en un coro.', en: 'We sing in a choir.', person: 3 }],
      ir: [{ es: 'Ellos {van} a un concierto el sábado.', en: 'They are going to a concert on Saturday.', person: 5 }],
      bailar: [{ es: 'Tú {bailas} muy bien.', en: 'You dance very well.', person: 1 }],
      querer: [{ es: 'Yo {quiero} aprender a tocar el piano.', en: 'I want to learn to play the piano.', person: 0 }],
    },
    ladders: [L('tp-music-pres', 'present', 'escuchar', [
      ['[Escucho] música.', 'I listen to music.'],
      ['[Por la mañana] escucho música.', 'In the morning I listen to music.'],
      ['Por la mañana escucho música [y canto en la ducha].', 'In the morning I listen to music and I sing in the shower.'],
      ['Por la mañana escucho música y canto en la ducha [aunque canto fatal].', '…and I sing in the shower although I sing terribly.'],
      ['Por la mañana escucho música y canto en la ducha aunque canto fatal; [por eso, mis vecinos cierran las ventanas].', '…although I sing terribly; that is why my neighbours close their windows.'],
    ])],
    words: [{ es: 'la canción', en: 'the song', gender: 'f' }, { es: 'el concierto', en: 'the concert', gender: 'm' }, { es: 'la guitarra', en: 'the guitar', gender: 'f' }, { es: 'el cantante', en: 'the singer', gender: 'm' }, { es: 'la letra', en: 'the lyrics', gender: 'f' }, { es: 'el grupo', en: 'the band', gender: 'm' }],
  },
  {
    id: 'travel', keywords: ['travel', 'travelling', 'traveling', 'viajar', 'holidays', 'trips'], label: 'Travel', blurb: 'travel',
    examples: {
      viajar: [{ es: 'Yo {viajo} a España cada verano.', en: 'I travel to Spain every summer.', person: 0 }],
      visitar: [{ es: 'Nosotros {visitamos} un pueblo diferente cada día.', en: 'We visit a different village every day.', person: 3 }],
      reservar: [{ es: 'Tú {reservas} el hotel con tiempo.', en: 'You book the hotel in good time.', person: 1 }],
      llegar: [{ es: 'El avión {llega} a las nueve.', en: 'The plane arrives at nine.', person: 2 }],
      llevar: [{ es: 'Ellos {llevan} muy poco equipaje.', en: 'They take very little luggage.', person: 5 }],
      volver: [{ es: 'Yo {vuelvo} a casa el lunes.', en: 'I come back home on Monday.', person: 0 }],
    },
    ladders: [L('tp-travel-pres', 'present', 'viajar', [
      ['[Viajo] a España.', 'I travel to Spain.'],
      ['[Cada verano] viajo a España.', 'Every summer I travel to Spain.'],
      ['Cada verano viajo a España [y visito a mis amigos].', 'Every summer I travel to Spain and I visit my friends.'],
      ['Cada verano viajo a España y visito a mis amigos [porque quiero practicar el idioma].', '…and I visit my friends because I want to practise the language.'],
      ['Cada verano viajo a España y visito a mis amigos porque quiero practicar el idioma; [además, me encanta la comida].', '…because I want to practise the language; besides, I love the food.'],
    ])],
    words: [{ es: 'el vuelo', en: 'the flight', gender: 'm' }, { es: 'el equipaje', en: 'the luggage', gender: 'm' }, { es: 'el pasaporte', en: 'the passport', gender: 'm' }, { es: 'la reserva', en: 'the booking', gender: 'f' }, { es: 'el alojamiento', en: 'the accommodation', gender: 'm' }, { es: 'el viaje', en: 'the trip', gender: 'm' }],
  },
  {
    id: 'rugby', keywords: ["rugby", "six nations"], label: 'Rugby', blurb: 'rugby',
    examples: {
      jugar: [{ es: "Yo {juego} al rugby en invierno.", en: "I play rugby in winter.", person: 0 }],
      ver: [{ es: "Nosotros {vemos} el Seis Naciones.", en: "We watch the Six Nations.", person: 3 }],
      ganar: [{ es: "Inglaterra {gana} el partido.", en: "England win the match.", person: 2 }],
      correr: [{ es: "Tú {corres} con el balón.", en: "You run with the ball.", person: 1 }],
      ser: [{ es: "El rugby {es} un deporte duro.", en: "Rugby is a tough sport.", person: 2 }],
      ir: [{ es: "Ellos {van} al estadio en tren.", en: "They go to the stadium by train.", person: 5 }],
    },
    ladders: [L('tp-rugby-pres', 'present', 'ver', [
      ["[Veo] el rugby.", "I watch the rugby."],
      ["[Los sábados] veo el rugby.", "On Saturdays I watch the rugby."],
      ["Los sábados veo el rugby [y tomo algo con mis amigos].", "On Saturdays I watch the rugby and have a drink with my friends."],
      ["Los sábados veo el rugby y tomo algo con mis amigos [cuando juega mi equipo].", "…and have a drink with my friends when my team is playing."],
      ["Los sábados veo el rugby y tomo algo con mis amigos cuando juega mi equipo; [sin embargo, casi nunca ganamos].", "…when my team is playing; however, we hardly ever win."],
    ])],
    words: [{ es: "el balón", en: "the ball", gender: 'm' }, { es: "el placaje", en: "the tackle", gender: 'm' }, { es: "el ensayo", en: "the try", gender: 'm' }, { es: "la melé", en: "the scrum", gender: 'f' }, { es: "el campo", en: "the pitch", gender: 'm' }, { es: "la camiseta", en: "the shirt", gender: 'f' }],
  },
  {
    id: 'cricket', keywords: ["cricket", "críquet"], label: 'Cricket', blurb: 'cricket',
    examples: {
      jugar: [{ es: "Nosotros {jugamos} al críquet en verano.", en: "We play cricket in summer.", person: 3 }],
      ver: [{ es: "Yo {veo} el críquet con mi padre.", en: "I watch the cricket with my father.", person: 0 }],
      ser: [{ es: "El partido {es} muy largo.", en: "The match is very long.", person: 2 }],
      ganar: [{ es: "Mi equipo {gana} hoy.", en: "My team wins today.", person: 2 }],
      llevar: [{ es: "Los jugadores {llevan} ropa blanca.", en: "The players wear white.", person: 5 }],
      empezar: [{ es: "El partido {empieza} a las once.", en: "The match starts at eleven.", person: 2 }],
    },
    ladders: [L('tp-cricket-pres', 'present', 'jugar', [
      ["[Juego] al críquet.", "I play cricket."],
      ["[En verano] juego al críquet.", "In summer I play cricket."],
      ["En verano juego al críquet [y tomo el té con el equipo].", "In summer I play cricket and have tea with the team."],
      ["En verano juego al críquet y tomo el té con el equipo [cuando no llueve].", "…and have tea with the team when it is not raining."],
      ["En verano juego al críquet y tomo el té con el equipo cuando no llueve; [por eso, en Inglaterra jugamos muy poco].", "…when it is not raining; that is why in England we play very little."],
    ])],
    words: [{ es: "el bate", en: "the bat", gender: 'm' }, { es: "el lanzador", en: "the bowler", gender: 'm' }, { es: "el bateador", en: "the batsman", gender: 'm' }, { es: "la carrera", en: "the run", gender: 'f' }, { es: "el descanso", en: "the break", gender: 'm' }, { es: "la temporada", en: "the season", gender: 'f' }],
  },
  {
    id: 'running', keywords: ["running", "run", "runner", "jogging", "marathon", "marathons", "correr"], label: 'Running', blurb: 'running',
    examples: {
      correr: [{ es: "Yo {corro} diez kilómetros los domingos.", en: "I run ten kilometres on Sundays.", person: 0 }, { es: "Tú {corres} muy rápido.", en: "You run very fast.", person: 1 }],
      salir: [{ es: "Nosotros {salimos} a correr por el parque.", en: "We go out for a run in the park.", person: 3 }],
      necesitar: [{ es: "Yo {necesito} zapatillas nuevas.", en: "I need new trainers.", person: 0 }],
      terminar: [{ es: "Ella {termina} la carrera en una hora.", en: "She finishes the race in an hour.", person: 2 }],
      descansar: [{ es: "Ellos {descansan} los lunes.", en: "They rest on Mondays.", person: 5 }],
      beber: [{ es: "Yo {bebo} mucha agua después de correr.", en: "I drink a lot of water after running.", person: 0 }],
    },
    ladders: [L('tp-running-pres', 'present', 'correr', [
      ["[Corro] por el parque.", "I run in the park."],
      ["[Por la mañana] corro por el parque.", "In the morning I run in the park."],
      ["Por la mañana corro por el parque [y después desayuno bien].", "In the morning I run in the park and afterwards I have a good breakfast."],
      ["Por la mañana corro por el parque y después desayuno bien [porque tengo mucha hambre].", "…and afterwards I have a good breakfast because I am very hungry."],
      ["Por la mañana corro por el parque y después desayuno bien porque tengo mucha hambre; [además, duermo mejor por la noche].", "…because I am very hungry; besides, I sleep better at night."],
    ])],
    words: [{ es: "la carrera", en: "the race", gender: 'f' }, { es: "las zapatillas", en: "the trainers", gender: 'f' }, { es: "el maratón", en: "the marathon", gender: 'm' }, { es: "el ritmo", en: "the pace", gender: 'm' }, { es: "la meta", en: "the finish line", gender: 'f' }, { es: "el entrenamiento", en: "the training", gender: 'm' }],
  },
  {
    id: 'cycling', keywords: ["cycling", "cycle", "bike", "bikes", "biking", "bicycle", "ciclismo", "bici", "tour de france"], label: 'Cycling', blurb: 'cycling',
    examples: {
      ir: [{ es: "Yo {voy} al trabajo en bicicleta.", en: "I go to work by bike.", person: 0 }],
      subir: [{ es: "Nosotros {subimos} la montaña en bici.", en: "We ride up the mountain.", person: 3 }],
      bajar: [{ es: "Tú {bajas} muy rápido.", en: "You come down very fast.", person: 1 }],
      llevar: [{ es: "Yo {llevo} casco siempre.", en: "I always wear a helmet.", person: 0 }],
      ver: [{ es: "Ellos {ven} el Tour de Francia.", en: "They watch the Tour de France.", person: 5 }],
      necesitar: [{ es: "La bicicleta {necesita} una cadena nueva.", en: "The bike needs a new chain.", person: 2 }],
    },
    ladders: [L('tp-cycling-pres', 'present', 'ir', [
      ["[Voy] en bicicleta.", "I go by bike."],
      ["[Los fines de semana] voy en bicicleta.", "At weekends I go by bike."],
      ["Los fines de semana voy en bicicleta [y subo una montaña].", "At weekends I go by bike and I ride up a mountain."],
      ["Los fines de semana voy en bicicleta y subo una montaña [aunque me duelen las piernas].", "…and I ride up a mountain although my legs hurt."],
      ["Los fines de semana voy en bicicleta y subo una montaña aunque me duelen las piernas; [por eso, después descanso toda la tarde].", "…although my legs hurt; that is why I rest all afternoon afterwards."],
    ])],
    words: [{ es: "la bicicleta", en: "the bicycle", gender: 'f' }, { es: "el casco", en: "the helmet", gender: 'm' }, { es: "la cadena", en: "the chain", gender: 'f' }, { es: "la cuesta", en: "the hill", gender: 'f' }, { es: "el ciclista", en: "the cyclist", gender: 'm' }, { es: "el carril bici", en: "the cycle lane", gender: 'm' }],
  },
  {
    id: 'hiking', keywords: ["hiking", "hike", "hikes", "walking", "walks", "rambling", "trekking", "senderismo", "mountains"], label: 'Walking and hiking', blurb: 'walking in the hills',
    examples: {
      caminar: [{ es: "Nosotros {caminamos} por la montaña.", en: "We walk in the mountains.", person: 3 }],
      subir: [{ es: "Yo {subo} hasta el pico.", en: "I climb up to the peak.", person: 0 }],
      llevar: [{ es: "Tú {llevas} una mochila grande.", en: "You carry a big rucksack.", person: 1 }],
      ver: [{ es: "Ellos {ven} el mar desde arriba.", en: "They see the sea from the top.", person: 5 }],
      descansar: [{ es: "Yo {descanso} junto al río.", en: "I rest by the river.", person: 0 }],
      seguir: [{ es: "El camino {sigue} por el bosque.", en: "The path carries on through the wood.", person: 2 }],
    },
    ladders: [L('tp-hiking-pres', 'present', 'caminar', [
      ["[Camino] por el campo.", "I walk in the countryside."],
      ["[Los domingos] camino por el campo.", "On Sundays I walk in the countryside."],
      ["Los domingos camino por el campo [y como un bocadillo junto al río].", "On Sundays I walk in the countryside and eat a sandwich by the river."],
      ["Los domingos camino por el campo y como un bocadillo junto al río [cuando hace sol].", "…and eat a sandwich by the river when it is sunny."],
      ["Los domingos camino por el campo y como un bocadillo junto al río cuando hace sol; [sin embargo, siempre llevo un impermeable].", "…when it is sunny; however, I always take a raincoat."],
    ])],
    words: [{ es: "la montaña", en: "the mountain", gender: 'f' }, { es: "el sendero", en: "the path", gender: 'm' }, { es: "la mochila", en: "the rucksack", gender: 'f' }, { es: "las botas", en: "the boots", gender: 'f' }, { es: "el mapa", en: "the map", gender: 'm' }, { es: "el bosque", en: "the wood", gender: 'm' }],
  },
  {
    id: 'sailing', keywords: ["sailing", "sail", "boats", "boat", "yacht", "yachts", "yachting", "vela", "navegar"], label: 'Sailing', blurb: 'sailing',
    examples: {
      ir: [{ es: "Nosotros {vamos} al puerto temprano.", en: "We go to the harbour early.", person: 3 }],
      salir: [{ es: "El barco {sale} a las ocho.", en: "The boat leaves at eight.", person: 2 }],
      tener: [{ es: "Mi amigo {tiene} un velero.", en: "My friend has a sailing boat.", person: 2 }],
      mirar: [{ es: "Yo {miro} el tiempo antes de salir.", en: "I check the weather before setting off.", person: 0 }],
      necesitar: [{ es: "Tú {necesitas} un chaleco salvavidas.", en: "You need a life jacket.", person: 1 }],
      estar: [{ es: "El mar {está} tranquilo hoy.", en: "The sea is calm today.", person: 2 }],
    },
    ladders: [L('tp-sailing-pres', 'present', 'salir', [
      ["[Salgo] en barco.", "I go out on the boat."],
      ["[En verano] salgo en barco.", "In summer I go out on the boat."],
      ["En verano salgo en barco [y como en el mar].", "In summer I go out on the boat and eat at sea."],
      ["En verano salgo en barco y como en el mar [cuando hay buen viento].", "…and eat at sea when there is a good wind."],
      ["En verano salgo en barco y como en el mar cuando hay buen viento; [sin embargo, con tormenta me quedo en el puerto].", "…when there is a good wind; however, in a storm I stay in the harbour."],
    ])],
    words: [{ es: "el barco", en: "the boat", gender: 'm' }, { es: "el velero", en: "the sailing boat", gender: 'm' }, { es: "la vela", en: "the sail", gender: 'f' }, { es: "el puerto", en: "the harbour", gender: 'm' }, { es: "el viento", en: "the wind", gender: 'm' }, { es: "la ola", en: "the wave", gender: 'f' }],
  },
  {
    id: 'motorsport', keywords: ["f1", "formula 1", "formula one", "fórmula 1", "motorsport", "motor racing", "grand prix", "motogp"], label: 'Motor racing', blurb: 'motor racing',
    examples: {
      ver: [{ es: "Yo {veo} la Fórmula 1 los domingos.", en: "I watch Formula 1 on Sundays.", person: 0 }],
      ganar: [{ es: "Mi piloto favorito {gana} la carrera.", en: "My favourite driver wins the race.", person: 2 }],
      conducir: [{ es: "Los pilotos {conducen} muy rápido.", en: "The drivers drive very fast.", person: 5 }],
      salir: [{ es: "Él {sale} en primera posición.", en: "He starts in first place.", person: 2 }],
      ser: [{ es: "El circuito {es} muy difícil.", en: "The circuit is very difficult.", person: 2 }],
      perder: [{ es: "Ellos {pierden} tiempo en boxes.", en: "They lose time in the pits.", person: 5 }],
    },
    ladders: [L('tp-motorsport-pres', 'present', 'ver', [
      ["[Veo] la carrera.", "I watch the race."],
      ["[Los domingos] veo la carrera.", "On Sundays I watch the race."],
      ["Los domingos veo la carrera [y grito delante de la tele].", "On Sundays I watch the race and shout at the TV."],
      ["Los domingos veo la carrera y grito delante de la tele [porque es muy emocionante].", "…and shout at the TV because it is very exciting."],
      ["Los domingos veo la carrera y grito delante de la tele porque es muy emocionante; [además, mi familia se ríe de mí].", "…because it is very exciting; besides, my family laughs at me."],
    ])],
    words: [{ es: "el piloto", en: "the driver", gender: 'm' }, { es: "el circuito", en: "the circuit", gender: 'm' }, { es: "la vuelta", en: "the lap", gender: 'f' }, { es: "el podio", en: "the podium", gender: 'm' }, { es: "el neumático", en: "the tyre", gender: 'm' }, { es: "la velocidad", en: "the speed", gender: 'f' }],
  },
  {
    id: 'films', keywords: ["film", "films", "movies", "movie", "cinema", "tv", "television", "series", "netflix", "cine", "películas"], label: 'Films and TV', blurb: 'films and TV',
    examples: {
      ver: [{ es: "Yo {veo} una serie cada noche.", en: "I watch a series every night.", person: 0 }, { es: "Nosotros {vemos} una película los viernes.", en: "We watch a film on Fridays.", person: 3 }],
      ir: [{ es: "Tú {vas} al cine con tus amigos.", en: "You go to the cinema with your friends.", person: 1 }],
      preferir: [{ es: "Ella {prefiere} las comedias.", en: "She prefers comedies.", person: 2 }],
      empezar: [{ es: "La película {empieza} a las nueve.", en: "The film starts at nine.", person: 2 }],
      terminar: [{ es: "La serie {termina} esta semana.", en: "The series ends this week.", person: 2 }],
    },
    ladders: [L('tp-films-pres', 'present', 'ver', [
      ["[Veo] una película.", "I watch a film."],
      ["[Esta noche] veo una película.", "Tonight I am watching a film."],
      ["Esta noche veo una película [y hago palomitas].", "Tonight I am watching a film and making popcorn."],
      ["Esta noche veo una película y hago palomitas [porque es viernes].", "…and making popcorn because it is Friday."],
      ["Esta noche veo una película y hago palomitas porque es viernes; [sin embargo, siempre me duermo antes del final].", "…because it is Friday; however, I always fall asleep before the end."],
    ])],
    words: [{ es: "la película", en: "the film", gender: 'f' }, { es: "la serie", en: "the series", gender: 'f' }, { es: "el actor", en: "the actor", gender: 'm' }, { es: "la pantalla", en: "the screen", gender: 'f' }, { es: "el final", en: "the ending", gender: 'm' }, { es: "las palomitas", en: "the popcorn", gender: 'f' }],
  },
  {
    id: 'reading', keywords: ["reading", "read", "books", "book", "novels", "literature", "leer", "libros"], label: 'Reading', blurb: 'books',
    examples: {
      leer: [{ es: "Yo {leo} antes de dormir.", en: "I read before going to sleep.", person: 0 }, { es: "Tú {lees} muchas novelas.", en: "You read a lot of novels.", person: 1 }],
      comprar: [{ es: "Nosotros {compramos} libros de segunda mano.", en: "We buy second-hand books.", person: 3 }],
      buscar: [{ es: "Yo {busco} un libro en español.", en: "I am looking for a book in Spanish.", person: 0 }],
      escribir: [{ es: "Ella {escribe} novelas de misterio.", en: "She writes mystery novels.", person: 2 }],
      terminar: [{ es: "Ellos {terminan} un libro cada semana.", en: "They finish a book every week.", person: 5 }],
    },
    ladders: [L('tp-reading-pres', 'present', 'leer', [
      ["[Leo] una novela.", "I read a novel."],
      ["[Por la noche] leo una novela.", "At night I read a novel."],
      ["Por la noche leo una novela [y tomo un té].", "At night I read a novel and have a tea."],
      ["Por la noche leo una novela y tomo un té [porque me relaja].", "…and have a tea because it relaxes me."],
      ["Por la noche leo una novela y tomo un té porque me relaja; [además, aprendo palabras nuevas].", "…because it relaxes me; besides, I learn new words."],
    ])],
    words: [{ es: "el libro", en: "the book", gender: 'm' }, { es: "la novela", en: "the novel", gender: 'f' }, { es: "el autor", en: "the author", gender: 'm' }, { es: "la página", en: "the page", gender: 'f' }, { es: "la librería", en: "the bookshop", gender: 'f' }, { es: "el capítulo", en: "the chapter", gender: 'm' }],
  },
  {
    id: 'dogs', keywords: ["dog", "dogs", "puppy", "puppies", "perro", "perros"], label: 'Dogs', blurb: 'dogs',
    examples: {
      tener: [{ es: "Yo {tengo} un perro muy cariñoso.", en: "I have a very affectionate dog.", person: 0 }],
      salir: [{ es: "Nosotros {salimos} con el perro cada mañana.", en: "We go out with the dog every morning.", person: 3 }],
      correr: [{ es: "Mi perro {corre} por la playa.", en: "My dog runs along the beach.", person: 2 }],
      dormir: [{ es: "El perro {duerme} en el sofá.", en: "The dog sleeps on the sofa.", person: 2 }],
      cuidar: [{ es: "Tú {cuidas} muy bien a tu perro.", en: "You look after your dog very well.", person: 1 }],
      querer: [{ es: "Los perros {quieren} salir.", en: "The dogs want to go out.", person: 5 }],
    },
    ladders: [L('tp-dogs-pres', 'present', 'salir', [
      ["[Salgo] con mi perro.", "I go out with my dog."],
      ["[Cada mañana] salgo con mi perro.", "Every morning I go out with my dog."],
      ["Cada mañana salgo con mi perro [y jugamos en el parque].", "Every morning I go out with my dog and we play in the park."],
      ["Cada mañana salgo con mi perro y jugamos en el parque [aunque llueva].", "…and we play in the park even if it rains."],
      ["Cada mañana salgo con mi perro y jugamos en el parque aunque llueva; [por eso, siempre llevo un paraguas].", "…even if it rains; that is why I always take an umbrella."],
    ])],
    words: [{ es: "el perro", en: "the dog", gender: 'm' }, { es: "el paseo", en: "the walk", gender: 'm' }, { es: "la correa", en: "the lead", gender: 'f' }, { es: "el veterinario", en: "the vet", gender: 'm' }, { es: "el cachorro", en: "the puppy", gender: 'm' }, { es: "el hueso", en: "the bone", gender: 'm' }],
  },
  {
    id: 'gardening', keywords: ["gardening", "garden", "gardens", "plants", "flowers", "allotment", "jardín", "jardinería"], label: 'Gardening', blurb: 'the garden',
    examples: {
      trabajar: [{ es: "Yo {trabajo} en el jardín los sábados.", en: "I work in the garden on Saturdays.", person: 0 }],
      cuidar: [{ es: "Mi madre {cuida} sus rosas.", en: "My mother looks after her roses.", person: 2 }],
      comprar: [{ es: "Nosotros {compramos} plantas en primavera.", en: "We buy plants in spring.", person: 3 }],
      necesitar: [{ es: "Las flores {necesitan} agua.", en: "The flowers need water.", person: 5 }],
      tener: [{ es: "Tú {tienes} un jardín precioso.", en: "You have a lovely garden.", person: 1 }],
      estar: [{ es: "Los tomates {están} casi listos.", en: "The tomatoes are nearly ready.", person: 5 }],
    },
    ladders: [L('tp-gardening-pres', 'present', 'trabajar', [
      ["[Trabajo] en el jardín.", "I work in the garden."],
      ["[Los sábados] trabajo en el jardín.", "On Saturdays I work in the garden."],
      ["Los sábados trabajo en el jardín [y cuido las rosas].", "On Saturdays I work in the garden and look after the roses."],
      ["Los sábados trabajo en el jardín y cuido las rosas [cuando hace buen tiempo].", "…and look after the roses when the weather is good."],
      ["Los sábados trabajo en el jardín y cuido las rosas cuando hace buen tiempo; [sin embargo, en invierno casi no salgo].", "…when the weather is good; however, in winter I hardly go out."],
    ])],
    words: [{ es: "el jardín", en: "the garden", gender: 'm' }, { es: "la flor", en: "the flower", gender: 'f' }, { es: "la planta", en: "the plant", gender: 'f' }, { es: "el árbol", en: "the tree", gender: 'm' }, { es: "la semilla", en: "the seed", gender: 'f' }, { es: "la tierra", en: "the soil", gender: 'f' }],
  },
  {
    id: 'wine', keywords: ["wine", "wines", "vino", "vineyards", "vineyard", "rioja"], label: 'Wine', blurb: 'wine',
    examples: {
      beber: [{ es: "Nosotros {bebemos} vino tinto con la cena.", en: "We drink red wine with dinner.", person: 3 }],
      probar: [{ es: "Yo {pruebo} un vino de Rioja.", en: "I am trying a Rioja wine.", person: 0 }],
      pedir: [{ es: "Tú {pides} una copa de vino blanco.", en: "You order a glass of white wine.", person: 1 }],
      preferir: [{ es: "Ellos {prefieren} el vino español.", en: "They prefer Spanish wine.", person: 5 }],
      visitar: [{ es: "Yo {visito} una bodega cada verano.", en: "I visit a winery every summer.", person: 0 }],
      abrir: [{ es: "Mi padre {abre} una botella especial.", en: "My father opens a special bottle.", person: 2 }],
    },
    ladders: [L('tp-wine-pres', 'present', 'probar', [
      ["[Pruebo] un vino nuevo.", "I try a new wine."],
      ["[Los viernes] pruebo un vino nuevo.", "On Fridays I try a new wine."],
      ["Los viernes pruebo un vino nuevo [y cocino algo rico].", "On Fridays I try a new wine and cook something tasty."],
      ["Los viernes pruebo un vino nuevo y cocino algo rico [porque me gusta descubrir bodegas pequeñas].", "…and cook something tasty because I like discovering small wineries."],
      ["Los viernes pruebo un vino nuevo y cocino algo rico porque me gusta descubrir bodegas pequeñas; [además, apunto mis favoritos en un cuaderno].", "…because I like discovering small wineries; besides, I note my favourites in a notebook."],
    ])],
    words: [{ es: "el vino tinto", en: "the red wine", gender: 'm' }, { es: "el vino blanco", en: "the white wine", gender: 'm' }, { es: "la copa", en: "the wine glass", gender: 'f' }, { es: "la botella", en: "the bottle", gender: 'f' }, { es: "la bodega", en: "the winery", gender: 'f' }, { es: "la uva", en: "the grape", gender: 'f' }],
  },
  {
    id: 'photography', keywords: ["photography", "photos", "photo", "photographs", "camera", "cameras", "fotografía", "fotos"], label: 'Photography', blurb: 'photography',
    examples: {
      sacar: [{ es: "Yo {saco} fotos de la ciudad.", en: "I take photos of the city.", person: 0 }],
      tener: [{ es: "Tú {tienes} una cámara muy buena.", en: "You have a very good camera.", person: 1 }],
      buscar: [{ es: "Nosotros {buscamos} la mejor luz.", en: "We look for the best light.", person: 3 }],
      usar: [{ es: "Ella {usa} el móvil para hacer fotos.", en: "She uses her phone to take photos.", person: 2 }],
      hacer: [{ es: "Yo {hago} fotos en blanco y negro.", en: "I take black and white photos.", person: 0 }],
      llevar: [{ es: "Ellos {llevan} la cámara a todas partes.", en: "They take the camera everywhere.", person: 5 }],
    },
    ladders: [L('tp-photography-pres', 'present', 'sacar', [
      ["[Saco] fotos.", "I take photos."],
      ["[Los fines de semana] saco fotos.", "At weekends I take photos."],
      ["Los fines de semana saco fotos [y paseo por el casco antiguo].", "At weekends I take photos and stroll around the old town."],
      ["Los fines de semana saco fotos y paseo por el casco antiguo [porque la luz es preciosa].", "…and stroll around the old town because the light is lovely."],
      ["Los fines de semana saco fotos y paseo por el casco antiguo porque la luz es preciosa; [además, después las enseño a mis amigos].", "…because the light is lovely; besides, I show them to my friends afterwards."],
    ])],
    words: [{ es: "la cámara", en: "the camera", gender: 'f' }, { es: "la foto", en: "the photo", gender: 'f' }, { es: "la luz", en: "the light", gender: 'f' }, { es: "el paisaje", en: "the landscape", gender: 'm' }, { es: "el retrato", en: "the portrait", gender: 'm' }, { es: "el objetivo", en: "the lens", gender: 'm' }],
  },
];

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
/** Every topic ladder, so a growing sentence can be found by its id wherever it is shown. */
export const TOPIC_LADDERS: Ladder[] = TOPICS.flatMap((t) => t.ladders);
/** The topics a student has, in a clean list (unknown ids dropped). */
export const topicsOf = (ids: string[] | null | undefined): Topic[] => (ids ?? []).map((id) => TOPIC_BY_ID[id]).filter(Boolean);

/** The topic's words as cards for the memory deck. */
export const topicWordId = (topic: string, i: number) => `tp-${topic}-${i + 1}`;
export const TOPIC_VOCAB: VocabItem[] = TOPICS.flatMap((t) => t.words.map((w, i) => ({ id: topicWordId(t.id, i), es: w.es, en: w.en, theme: 'everyday' as const, level: 'A1' as const, ...(w.gender ? { gender: w.gender } : {}) })));
registerVocab(TOPIC_VOCAB);
registerLadders(TOPIC_LADDERS);

/**
 * Reads what a student wrote about themselves ("I love golf, tennis and old Jaguars, and sailing") and finds the
 * topics the app has for it. The things it has no topic for come back too, so they can be written next.
 */
export function matchTopics(text: string | null | undefined): { topics: string[]; unmatched: string[] } {
  const clean = (text ?? '').toLowerCase().replace(/[.!?;:()"“”]/g, ',');
  if (!clean.trim()) return { topics: [], unmatched: [] };
  const has = (t: Topic, phrase: string) => t.keywords.some((k) => new RegExp(`(^|[^a-záéíóúñü])${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}s?($|[^a-záéíóúñü])`).test(phrase));
  const topics = TOPICS.filter((t) => has(t, clean)).map((t) => t.id);
  const filler = /^(i|i'm|im|i am|me|my|we|really|also|just|a|an|the|big|massive|huge|fan|fans|lover|of|love|loves|like|likes|enjoy|into|keen|on|especially|mainly|mostly|playing|watching|doing|going|to|lots|lot|some|old|very|much|too|as well|well|as|and|y|me gusta|me gustan|me encanta|el|la|los|las)$/;
  const unmatched = clean.split(/,|\band\b|\by\b|\bbut\b|\bplus\b|&|\n|\//).map((ph) => ph.trim().split(/\s+/).filter((w) => w && !filler.test(w)).join(' ')).filter((ph) => ph.length > 2 && ph.length <= 40 && !TOPICS.some((t) => has(t, ph)));
  return { topics, unmatched: [...new Set(unmatched)].slice(0, 8) };
}

/** For the games: the verbs a student's topics use, their example sentences by verb, and whole sentences to put in order. */
export function topicExamples(ids: string[] | null | undefined): Record<string, VerbExample[]> {
  const out: Record<string, VerbExample[]> = {};
  for (const t of topicsOf(ids)) for (const [inf, list] of Object.entries(t.examples)) out[inf] = [...(out[inf] ?? []), ...list];
  return out;
}
export const topicVerbs = (ids: string[] | null | undefined): string[] => Object.keys(topicExamples(ids));
export function topicSentences(ids: string[] | null | undefined, maxWords = 9): { es: string; en: string }[] {
  return Object.values(topicExamples(ids)).flat().map((e) => ({ es: parseExample(e).plain.replace(/[.]$/, ''), en: e.en.replace(/[.]$/, '') })).filter((x) => x.es.split(' ').length <= maxWords);
}
export const topicWordIds = (ids: string[] | null | undefined): string[] => topicsOf(ids).flatMap((t) => t.words.map((_, i) => topicWordId(t.id, i)));

/** The interests a learner picks at sign-up and on their Me page, and the practice topic each one brings. */
export const INTEREST_TOPIC: Partial<Record<Interest, string>> = {
  food: 'cooking', football: 'football', fitness: 'running', music: 'music', travel: 'travel', reading: 'reading',
  cinema: 'films', nature: 'hiking', golf: 'golf', tennis: 'tennis', 'classic-cars': 'classic-cars',
};
/** The interest that stands for a topic, when there is one (golf → golf, cooking → food). */
export const interestForTopic = (topic: string): Interest | undefined => (Object.keys(INTEREST_TOPIC) as Interest[]).find((i) => INTEREST_TOPIC[i] === topic);
/** Everything the learner chose themselves: their interests and the extra topics they tapped. */
export function ownTopics(profile: Pick<LearnerProfile, 'interests' | 'topics'> | null | undefined): string[] {
  if (!profile) return [];
  const fromInterests = (profile.interests ?? []).map((i) => INTEREST_TOPIC[i]).filter((t): t is string => !!t && !!TOPIC_BY_ID[t]);
  return [...new Set([...fromInterests, ...(profile.topics ?? []).filter((t) => TOPIC_BY_ID[t])])];
}
/**
 * The learner taps a topic: one that matches an interest is kept as that interest (so their story follows it too);
 * any other is kept in their extra topics.
 */
export function toggleOwnTopic<P extends Pick<LearnerProfile, 'interests' | 'topics'>>(profile: P, topic: string): P {
  const on = ownTopics(profile).includes(topic);
  const interest = interestForTopic(topic);
  const topics = (profile.topics ?? []).filter((t) => t !== topic);
  if (interest) {
    const had = profile.interests ?? [];
    const interests = on ? had.filter((i) => i !== interest) : [...new Set([...had, interest])];
    return { ...profile, interests, topics };
  }
  return { ...profile, topics: on ? topics : [...topics, topic] };
}
