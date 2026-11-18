// What a student loves, used to make their practice personal. A teacher ticks topics on a student's profile and
// that student's verb practice then draws its example sentences, its growing sentences and some new words from
// those topics: a golfer conjugates "jugar" in "Juego al golf todos los sábados", not in a sentence about a café.
// Everything here is ordinary content in the same shapes as the rest of the app (verb examples, ladders, words),
// so marking, homework review and the memory deck treat it like any other.
import { registerLadders, type Ladder } from './ladders';
import type { VerbExample } from './verbs';
import { registerVocab, type VocabItem } from './vocab';

export interface Topic {
  id: string;
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
    id: 'golf', label: 'Golf', blurb: 'the golf course',
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
    id: 'tennis', label: 'Tennis', blurb: 'the tennis court',
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
    id: 'classic-cars', label: 'Classic cars', blurb: 'classic cars and old Jaguars',
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
    id: 'football', label: 'Football', blurb: 'football',
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
    id: 'cooking', label: 'Cooking', blurb: 'cooking and food',
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
    id: 'music', label: 'Music', blurb: 'music',
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
    id: 'travel', label: 'Travel', blurb: 'travel',
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
