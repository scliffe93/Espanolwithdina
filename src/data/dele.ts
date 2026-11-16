import type { Cefr } from '../types';

// ───────────────────────────────────────────────────────────────
// Exam practice in the style of the DELE (Diplomas de Español como
// Lengua Extranjera, Instituto Cervantes). These are our own tasks,
// written to the shape of the real papers: a text with three-option
// questions, a recording heard twice, and a writing task with a word
// range. They are NOT official papers and not past papers.
//
// The real exam has four parts (reading, listening, writing, speaking)
// and you pass ("apto") with 60% in each of its two groups. Speaking
// is not here: that is what lessons are for.
// ───────────────────────────────────────────────────────────────

export type DeleLevel = Extract<Cefr, 'A1' | 'A2' | 'B1' | 'B2'>;
export type DelePart = 'reading' | 'listening' | 'writing';

export interface DeleQuestion {
  q: string;
  options: [string, string, string];
  /** Index of the right option. */
  answer: 0 | 1 | 2;
  /** Why, in English, shown after checking: where the answer is in the text. */
  why: string;
}

export interface DeleTask {
  id: string;
  level: DeleLevel;
  part: DelePart;
  title: string;
  /** What the task asks, in Spanish, as an exam paper words it. */
  instructions: string;
  /** The same in English, shown smaller (and not at all at higher levels). */
  instructionsEn: string;
  /** How long the real exam allows for a task like this, in minutes. */
  minutes: number;
  /** Reading: the text. Listening: what is said (played aloud, shown only after checking). */
  text?: string;
  questions?: DeleQuestion[];
  /** Writing. */
  writing?: { prompt: string; points: string[]; minWords: number; maxWords: number; checklist: string[] };
}

/** What each paper of the real exam looks like at a level: shown on the exam page so the practice has context. */
export const DELE_FORMAT: Record<DeleLevel, { reading: string; listening: string; writing: string; speaking: string }> = {
  A1: { reading: '4 tasks · 45 min', listening: '4 tasks · 20 min', writing: '2 tasks · 25 min (a form, and a note of 20 to 30 words)', speaking: '10 min, after 10 min to prepare' },
  A2: { reading: '4 tasks · 60 min', listening: '4 tasks · 40 min', writing: '2 tasks · 45 min (60 to 70 and 70 to 80 words)', speaking: '12 min, after 12 min to prepare' },
  B1: { reading: '5 tasks · 70 min', listening: '5 tasks · 40 min', writing: '2 tasks · 60 min (100 to 120 and 130 to 150 words)', speaking: '15 min, after 15 min to prepare' },
  B2: { reading: '4 tasks · 70 min', listening: '5 tasks · 40 min', writing: '2 tasks · 80 min (150 to 180 words each)', speaking: '20 min, after 20 min to prepare' },
};

export const DELE_TASKS: DeleTask[] = [
  // ─────────── A1 ───────────
  {
    id: 'a1-reading-1', level: 'A1', part: 'reading', title: 'Un mensaje de Lucía', minutes: 10,
    instructions: 'Lea el mensaje de Lucía a su amigo Pablo. Después, elija la respuesta correcta (a, b o c).',
    instructionsEn: 'Read Lucía’s message to her friend Pablo. Then choose the right answer.',
    text: 'Hola, Pablo:\n\n¿Qué tal? Yo estoy muy bien. Ahora vivo en Valencia, en un piso pequeño cerca de la playa. Vivo con dos chicas: Marta, que es de Sevilla, y Anne, que es francesa.\n\nTrabajo en una cafetería por las mañanas, de ocho a dos. Por las tardes estudio inglés en una academia, los lunes y los miércoles. Los fines de semana no trabajo: voy a la playa o como con mis amigas.\n\n¿Vienes a Valencia en julio? En mi piso hay una habitación libre. Tú solo tienes que comprar el billete de tren.\n\nUn abrazo,\nLucía',
    questions: [
      { q: 'Lucía vive…', options: ['sola.', 'con dos chicas.', 'con su familia.'], answer: 1, why: '“Vivo con dos chicas: Marta… y Anne.”' },
      { q: 'El piso de Lucía está…', options: ['cerca de la playa.', 'en el centro.', 'al lado de la academia.'], answer: 0, why: '“…en un piso pequeño cerca de la playa.”' },
      { q: 'Lucía trabaja…', options: ['por las tardes.', 'los fines de semana.', 'por las mañanas.'], answer: 2, why: '“Trabajo en una cafetería por las mañanas, de ocho a dos.”' },
      { q: 'Lucía estudia inglés…', options: ['todos los días.', 'dos días a la semana.', 'los sábados.'], answer: 1, why: '“…los lunes y los miércoles”: two days a week.' },
      { q: 'Para ir a Valencia, Pablo tiene que…', options: ['buscar un hotel.', 'llamar a Marta.', 'comprar el billete.'], answer: 2, why: '“Tú solo tienes que comprar el billete de tren.”' },
    ],
  },
  {
    id: 'a1-listening-1', level: 'A1', part: 'listening', title: 'En la calle', minutes: 6,
    instructions: 'Va a escuchar a una mujer que pregunta por una farmacia. Escuchará la conversación dos veces. Elija la respuesta correcta.',
    instructionsEn: 'You will hear a woman asking the way to a chemist’s. You hear it twice. Choose the right answer.',
    text: 'Perdone, ¿hay una farmacia cerca de aquí? — Sí, hay una en la calle Mayor. — ¿Y está lejos? — No, está a cinco minutos. Siga todo recto y, en la segunda calle, gire a la izquierda. La farmacia está al lado del banco. — ¿Sabe si está abierta ahora? — Sí, abre a las nueve y cierra a las ocho de la tarde. — Muchas gracias. — De nada.',
    questions: [
      { q: 'La mujer busca…', options: ['un banco.', 'una farmacia.', 'un hotel.'], answer: 1, why: '“¿Hay una farmacia cerca de aquí?”' },
      { q: 'La farmacia está…', options: ['a cinco minutos.', 'muy lejos.', 'en esta calle.'], answer: 0, why: '“No, está a cinco minutos.”' },
      { q: 'En la segunda calle, la mujer tiene que girar…', options: ['a la derecha.', 'a la izquierda.', 'y volver.'], answer: 1, why: '“…en la segunda calle, gire a la izquierda.”' },
      { q: 'La farmacia cierra…', options: ['a las nueve.', 'a las dos.', 'a las ocho de la tarde.'], answer: 2, why: '“…abre a las nueve y cierra a las ocho de la tarde.”' },
    ],
  },
  {
    id: 'a1-writing-1', level: 'A1', part: 'writing', title: 'Una nota para un compañero', minutes: 12,
    instructions: 'Usted no puede ir mañana a clase de español. Escriba una nota a un compañero.',
    instructionsEn: 'You cannot go to your Spanish class tomorrow. Write a note to a classmate.',
    writing: { prompt: 'Escriba una nota a su compañero de clase.', points: ['Salude.', 'Diga que mañana no puede ir a clase y por qué.', 'Pregunte por los deberes.', 'Despídase.'], minWords: 20, maxWords: 30, checklist: ['I greeted and said goodbye.', 'I said I cannot come and gave a reason.', 'I asked about the homework.', 'It is between 20 and 30 words.'] },
  },

  // ─────────── A2 ───────────
  {
    id: 'a2-reading-1', level: 'A2', part: 'reading', title: 'El mercado del barrio', minutes: 12,
    instructions: 'Lea este texto de una revista local. Después, elija la respuesta correcta (a, b o c).',
    instructionsEn: 'Read this text from a local magazine. Then choose the right answer.',
    text: 'El mercado de San Antón cumple cien años\n\nEl mercado de nuestro barrio abrió sus puertas en 1926. Entonces era un edificio pequeño donde los vecinos compraban fruta, carne y pescado. Durante muchos años fue el centro de la vida del barrio: la gente iba todos los días, porque en las casas no había nevera.\n\nEn los años noventa mucha gente empezó a comprar en los supermercados y el mercado perdió clientes. Algunos puestos cerraron. En 2011 el ayuntamiento reformó el edificio y hoy tiene tres plantas: en la primera están los puestos de siempre, en la segunda hay bares donde se puede comer lo que se compra abajo, y en la tercera hay una terraza con vistas a la ciudad.\n\nPara celebrar el aniversario, este sábado habrá música en directo y una comida para todos los vecinos. La entrada es gratis, pero hay que reservar antes del jueves en la oficina del mercado.',
    questions: [
      { q: 'Antes, la gente iba al mercado todos los días porque…', options: ['era muy barato.', 'no tenía nevera en casa.', 'no había supermercados cerca.'], answer: 1, why: '“…la gente iba todos los días, porque en las casas no había nevera.”' },
      { q: 'En los años noventa, el mercado…', options: ['tuvo menos clientes.', 'abrió más puestos.', 'cambió de edificio.'], answer: 0, why: '“…el mercado perdió clientes. Algunos puestos cerraron.”' },
      { q: 'En la segunda planta se puede…', options: ['comprar pescado.', 'ver la ciudad.', 'comer.'], answer: 2, why: '“…en la segunda hay bares donde se puede comer lo que se compra abajo.” The view is on the third floor.' },
      { q: 'La fiesta del aniversario es…', options: ['el jueves.', 'el sábado.', 'todo el mes.'], answer: 1, why: '“…este sábado habrá música en directo…” Thursday is the deadline to book.' },
      { q: 'Para ir a la comida hay que…', options: ['pagar la entrada.', 'vivir en el barrio cien años.', 'reservar antes.'], answer: 2, why: '“La entrada es gratis, pero hay que reservar antes del jueves.”' },
    ],
  },
  {
    id: 'a2-listening-1', level: 'A2', part: 'listening', title: 'Un mensaje en el contestador', minutes: 8,
    instructions: 'Va a escuchar un mensaje que Carlos deja a su amiga Elena. Lo escuchará dos veces. Elija la respuesta correcta.',
    instructionsEn: 'You will hear a message Carlos leaves for his friend Elena. You hear it twice. Choose the right answer.',
    text: 'Hola, Elena, soy Carlos. Te llamo por lo del viernes. Al final no puedo ir al cine a las siete, porque tengo que trabajar hasta las ocho. Lo siento. ¿Qué te parece si vamos a la sesión de las diez? Antes podemos cenar algo rápido en el bar que está enfrente del cine, el de las tapas. Yo ya he comprado las entradas por internet, así que no tienes que pagar nada. Otra cosa: no voy a llevar el coche, porque está en el taller. Voy a ir en metro. Llámame esta noche y me dices si te viene bien. Un beso.',
    questions: [
      { q: 'Carlos no puede ir al cine a las siete porque…', options: ['está enfermo.', 'tiene que trabajar.', 'no tiene entradas.'], answer: 1, why: '“…tengo que trabajar hasta las ocho.”' },
      { q: 'Carlos propone ir al cine…', options: ['otro día.', 'a las ocho.', 'a las diez.'], answer: 2, why: '“¿Qué te parece si vamos a la sesión de las diez?”' },
      { q: 'Antes de la película, quieren…', options: ['cenar en un bar.', 'ir de compras.', 'tomar un café en casa.'], answer: 0, why: '“Antes podemos cenar algo rápido en el bar que está enfrente del cine.”' },
      { q: 'Las entradas…', options: ['las compra Elena.', 'se compran en el cine.', 'ya están compradas.'], answer: 2, why: '“Yo ya he comprado las entradas por internet.”' },
      { q: 'Carlos va a ir al cine…', options: ['en coche.', 'en metro.', 'andando.'], answer: 1, why: '“…no voy a llevar el coche… Voy a ir en metro.”' },
    ],
  },
  {
    id: 'a2-writing-1', level: 'A2', part: 'writing', title: 'Un correo a un amigo', minutes: 20,
    instructions: 'Un amigo español le ha escrito porque quiere visitar su ciudad el mes que viene. Escríbale un correo electrónico.',
    instructionsEn: 'A Spanish friend has written because he wants to visit your city next month. Write him an email.',
    writing: { prompt: 'Escriba un correo a su amigo.', points: ['Salude y diga que está contento por la visita.', 'Explique qué tiempo hace en su ciudad en esa época.', 'Recomiende dos lugares para visitar y diga por qué.', 'Proponga un plan para el primer día.', 'Despídase.'], minWords: 60, maxWords: 70, checklist: ['I covered all five points.', 'I used the present and “ir a” or the future for the plan.', 'I opened and closed it like an email to a friend.', 'It is between 60 and 70 words.'] },
  },

  // ─────────── B1 ───────────
  {
    id: 'b1-reading-1', level: 'B1', part: 'reading', title: 'Trabajar desde un pueblo', minutes: 15,
    instructions: 'Lea el siguiente artículo. Después, elija la respuesta correcta (a, b o c).',
    instructionsEn: 'Read the article. Then choose the right answer.',
    text: 'Del metro al huerto\n\nHace tres años, Irene Salas trabajaba en una agencia de publicidad de Madrid y tardaba una hora y media en llegar a la oficina. «Salía de casa de noche y volvía de noche», recuerda. Cuando su empresa permitió el teletrabajo, ella y su pareja decidieron probar algo que llevaban tiempo pensando: mudarse a un pueblo de Teruel de ciento veinte habitantes.\n\nEl cambio no fue tan fácil como imaginaban. La casa que alquilaron necesitaba reformas y la conexión a internet fallaba cada vez que llovía. «El primer invierno estuve a punto de volver», admite Irene. Lo que la convenció de quedarse fueron los vecinos: una señora le enseñó a cuidar el huerto y el alcalde consiguió que instalaran fibra óptica en la plaza.\n\nHoy Irene sigue trabajando para la misma agencia, aunque viaja a Madrid dos días al mes. Gana lo mismo que antes y gasta la mitad. Reconoce, sin embargo, que no es una vida para todo el mundo: el médico más cercano está a cuarenta minutos y en el pueblo no hay colegio, de modo que las familias con niños lo tienen más complicado.\n\nSu consejo para quien esté pensando en hacer lo mismo es claro: «Que pasen primero un invierno entero aquí, y que no vendan su piso hasta estar seguros».',
    questions: [
      { q: 'Irene y su pareja se fueron a vivir al pueblo…', options: ['porque perdieron su trabajo en Madrid.', 'cuando pudieron trabajar a distancia.', 'porque tenían familia allí.'], answer: 1, why: '“Cuando su empresa permitió el teletrabajo… decidieron… mudarse.”' },
      { q: 'Durante el primer invierno, Irene…', options: ['pensó en volver a Madrid.', 'dejó de trabajar.', 'compró la casa.'], answer: 0, why: '“El primer invierno estuve a punto de volver.”' },
      { q: 'Irene decidió quedarse gracias a…', options: ['su sueldo.', 'el clima.', 'la gente del pueblo.'], answer: 2, why: '“Lo que la convenció de quedarse fueron los vecinos.”' },
      { q: 'Ahora Irene…', options: ['trabaja para otra empresa.', 'gana menos que antes.', 'va a Madrid de vez en cuando.'], answer: 2, why: '“…sigue trabajando para la misma agencia, aunque viaja a Madrid dos días al mes. Gana lo mismo que antes…”' },
      { q: 'Según el texto, vivir en el pueblo es más difícil para…', options: ['las familias con hijos.', 'los jóvenes.', 'quienes no tienen coche.'], answer: 0, why: '“…en el pueblo no hay colegio, de modo que las familias con niños lo tienen más complicado.”' },
      { q: 'Irene recomienda…', options: ['vender el piso para tener dinero.', 'probar antes de tomar una decisión definitiva.', 'mudarse en verano.'], answer: 1, why: '“Que pasen primero un invierno entero aquí, y que no vendan su piso hasta estar seguros.”' },
    ],
  },
  {
    id: 'b1-listening-1', level: 'B1', part: 'listening', title: 'Un programa de radio', minutes: 10,
    instructions: 'Va a escuchar un fragmento de un programa de radio sobre un mercadillo de intercambio. Lo escuchará dos veces. Elija la respuesta correcta.',
    instructionsEn: 'You will hear part of a radio programme about a swap market. You hear it twice. Choose the right answer.',
    text: 'Buenos días y bienvenidos a «La ciudad despierta». Hoy queremos hablarles de una iniciativa que nació hace dos años en el barrio de Gracia y que ya se ha extendido a otras cinco ciudades: el mercadillo de intercambio. La idea es muy sencilla. Usted trae algo que ya no usa, puede ser un libro, una lámpara o una bicicleta, y a cambio se lleva otra cosa. No se paga nada y no se acepta dinero. Su fundadora, Nuria Ferrer, nos contaba ayer que todo empezó cuando se mudó de piso y no sabía qué hacer con tantas cosas. Colgó un cartel en el portal y, para su sorpresa, vinieron más de cuarenta vecinos. Lo que más se intercambia es ropa de niño, porque los pequeños crecen rápido, y lo que menos, los aparatos electrónicos, ya que mucha gente no se fía de que funcionen. El próximo mercadillo será el domingo quince, de diez a dos, en la plaza del Sol. Si llueve, se celebrará en el polideportivo. Los organizadores piden que los objetos estén limpios y en buen estado, y recuerdan que lo que no se intercambie se donará a una asociación del barrio.',
    questions: [
      { q: 'El mercadillo de intercambio…', options: ['existe solo en un barrio.', 'se organiza ya en varias ciudades.', 'empezó hace cinco años.'], answer: 1, why: '“…nació hace dos años… y ya se ha extendido a otras cinco ciudades.”' },
      { q: 'En el mercadillo…', options: ['se compran cosas baratas.', 'se pueden vender objetos usados.', 'se cambia una cosa por otra.'], answer: 2, why: '“…trae algo que ya no usa… y a cambio se lleva otra cosa. No se paga nada.”' },
      { q: 'Nuria tuvo la idea cuando…', options: ['cambió de casa.', 'perdió su trabajo.', 'tuvo un hijo.'], answer: 0, why: '“…todo empezó cuando se mudó de piso y no sabía qué hacer con tantas cosas.”' },
      { q: 'Lo que más se intercambia es…', options: ['libros.', 'aparatos electrónicos.', 'ropa infantil.'], answer: 2, why: '“Lo que más se intercambia es ropa de niño… y lo que menos, los aparatos electrónicos.”' },
      { q: 'Si llueve, el mercadillo…', options: ['se cancela.', 'se hace en otro lugar.', 'se cambia de día.'], answer: 1, why: '“Si llueve, se celebrará en el polideportivo.”' },
      { q: 'Los objetos que nadie se lleva…', options: ['se regalan a una asociación.', 'se tiran.', 'los guarda Nuria.'], answer: 0, why: '“…lo que no se intercambie se donará a una asociación del barrio.”' },
    ],
  },
  {
    id: 'b1-writing-1', level: 'B1', part: 'writing', title: 'Una opinión en un foro', minutes: 30,
    instructions: 'Usted ha leído en un foro esta pregunta: «¿Es mejor vivir en una ciudad grande o en un pueblo?». Escriba un comentario para el foro.',
    instructionsEn: 'You read this question on a forum: “Is it better to live in a big city or in a village?” Write a comment for the forum.',
    writing: { prompt: 'Escriba su comentario para el foro.', points: ['Diga dónde vive usted y dónde ha vivido antes.', 'Explique las ventajas y los inconvenientes de los dos lugares.', 'Cuente una experiencia personal que apoye su opinión.', 'Dé su opinión y un consejo a quien esté dudando.'], minWords: 130, maxWords: 150, checklist: ['I covered all four points.', 'I used past tenses for the experience (preterite and imperfect).', 'I gave an opinion with “creo que”, “en mi opinión” or “me parece que”.', 'I linked ideas: “sin embargo”, “además”, “por eso”.', 'It is between 130 and 150 words.'] },
  },

  // ─────────── B2 ───────────
  {
    id: 'b2-reading-1', level: 'B2', part: 'reading', title: 'La semana de cuatro días', minutes: 18,
    instructions: 'Lea el siguiente texto. Después, elija la opción correcta (a, b o c).',
    instructionsEn: 'Read the text. Then choose the right option.',
    text: 'Menos horas, ¿mismo trabajo?\n\nLa idea de trabajar cuatro días a la semana sin reducir el sueldo ha dejado de ser una extravagancia para convertirse en objeto de debate serio. Los ensayos realizados en varias empresas europeas arrojan resultados que, a primera vista, parecen demasiado buenos para ser ciertos: la productividad se mantiene o incluso aumenta, las bajas por enfermedad disminuyen y los empleados afirman sentirse menos agotados.\n\nSin embargo, conviene leer la letra pequeña. La mayoría de las compañías que participaron en estas pruebas lo hicieron de forma voluntaria, lo que hace pensar que ya partían de una cultura laboral flexible. No es lo mismo reorganizar el trabajo en una consultora, donde buena parte de las reuniones resultan prescindibles, que en un hospital o en una fábrica, donde menos horas significan sencillamente menos pacientes atendidos o menos piezas producidas, a no ser que se contrate a más personal.\n\nTampoco está claro que los beneficios perduren. Algunos expertos advierten de que el entusiasmo inicial podría explicar parte de la mejora y de que, pasado un tiempo, la presión por hacer en cuatro días lo que antes se hacía en cinco acabe generando el mismo estrés que se pretendía evitar.\n\nAun así, quienes defienden la medida insisten en que el debate de fondo no es técnico, sino social: se trata de decidir a qué queremos dedicar el tiempo que la tecnología nos ha permitido ahorrar. Si la respuesta es que a nada distinto, quizá el problema no sea el calendario.',
    questions: [
      { q: 'Según el primer párrafo, los resultados de los ensayos…', options: ['demuestran que la idea es una extravagancia.', 'son sorprendentemente positivos.', 'no han interesado a las empresas.'], answer: 1, why: '“…resultados que… parecen demasiado buenos para ser ciertos”: unexpectedly good.' },
      { q: 'El autor señala que las empresas participantes…', options: ['probablemente ya eran flexibles.', 'fueron obligadas a participar.', 'pertenecían todas al mismo sector.'], answer: 0, why: '“…lo hicieron de forma voluntaria, lo que hace pensar que ya partían de una cultura laboral flexible.”' },
      { q: 'En un hospital, trabajar menos horas…', options: ['mejoraría la atención.', 'sería fácil de organizar.', 'exigiría más trabajadores para mantener el servicio.'], answer: 2, why: '“…menos horas significan… menos pacientes atendidos… a no ser que se contrate a más personal.”' },
      { q: 'Algunos expertos temen que, con el tiempo,…', options: ['los sueldos bajen.', 'reaparezca el estrés.', 'la productividad se duplique.'], answer: 1, why: '“…la presión… acabe generando el mismo estrés que se pretendía evitar.”' },
      { q: 'Para los defensores de la medida, lo esencial es…', options: ['una cuestión de organización técnica.', 'reducir los costes de las empresas.', 'decidir cómo queremos usar nuestro tiempo.'], answer: 2, why: '“…el debate de fondo no es técnico, sino social: se trata de decidir a qué queremos dedicar el tiempo…”' },
      { q: 'El tono general del texto es…', options: ['prudente: reconoce ventajas y señala límites.', 'totalmente a favor.', 'claramente en contra.'], answer: 0, why: 'It reports the good results, then “conviene leer la letra pequeña”, and ends on an open question: balanced and cautious.' },
    ],
  },
  {
    id: 'b2-listening-1', level: 'B2', part: 'listening', title: 'Entrevista a una librera', minutes: 12,
    instructions: 'Va a escuchar un fragmento de una entrevista a la dueña de una librería. Lo escuchará dos veces. Elija la opción correcta.',
    instructionsEn: 'You will hear part of an interview with a bookshop owner. You hear it twice. Choose the right option.',
    text: 'Pues mire, cuando abrí la librería hace quince años, todo el mundo me decía que estaba loca, que el libro en papel tenía los días contados. Y reconozco que hubo momentos en los que pensé que tenían razón. Los primeros cinco años fueron durísimos; si no llega a ser por un pequeño préstamo de mi hermana, habría cerrado. Lo que cambió las cosas no fue vender más novelas, sino entender que una librería de barrio no puede competir en precio ni en rapidez con las grandes plataformas. Así que dejé de intentarlo. Empecé a organizar clubes de lectura, presentaciones, talleres para niños los sábados. Al principio venían cuatro personas, y dos eran amigas mías. Ahora hay lista de espera. La gente no viene solo a comprar un libro, que eso lo puede hacer desde el sofá; viene a que alguien le pregunte qué ha leído últimamente y le recomiende algo que no esperaba. Dicho esto, no quiero dar una imagen idílica. Los márgenes son mínimos, trabajo más horas que nunca y hay meses en los que apenas cubro gastos. Pero si me pregunta si volvería a hacerlo, le diría que sí sin dudarlo. Eso sí, empezaría por los clubes de lectura, y no por las estanterías.',
    questions: [
      { q: 'Cuando la entrevistada abrió la librería, la gente…', options: ['la animó a hacerlo.', 'pensaba que el negocio no tenía futuro.', 'no opinaba sobre el tema.'], answer: 1, why: '“…todo el mundo me decía que estaba loca, que el libro en papel tenía los días contados.”' },
      { q: 'En los primeros años, la librería no cerró gracias a…', options: ['la ayuda económica de un familiar.', 'el éxito de las novelas.', 'una subvención pública.'], answer: 0, why: '“…si no llega a ser por un pequeño préstamo de mi hermana, habría cerrado.”' },
      { q: 'La situación mejoró cuando ella…', options: ['bajó los precios.', 'empezó a vender por internet.', 'dejó de competir con las grandes plataformas.'], answer: 2, why: '“…no puede competir en precio ni en rapidez… Así que dejé de intentarlo.”' },
      { q: 'Según ella, los clientes van a la librería sobre todo para…', options: ['comprar más barato.', 'recibir un trato y un consejo personales.', 'recoger pedidos.'], answer: 1, why: '“…viene a que alguien le pregunte qué ha leído… y le recomiende algo que no esperaba.”' },
      { q: 'La entrevistada reconoce que…', options: ['el negocio sigue siendo poco rentable.', 'ahora trabaja menos.', 'piensa cerrar pronto.'], answer: 0, why: '“Los márgenes son mínimos… hay meses en los que apenas cubro gastos.”' },
      { q: 'Si empezara de nuevo,…', options: ['no abriría una librería.', 'daría prioridad a las actividades.', 'compraría más estanterías.'], answer: 1, why: '“…empezaría por los clubes de lectura, y no por las estanterías.”' },
    ],
  },
  {
    id: 'b2-writing-1', level: 'B2', part: 'writing', title: 'Una carta al director', minutes: 40,
    instructions: 'El ayuntamiento de su ciudad ha anunciado que cerrará al tráfico el centro histórico. Escriba una carta al director de un periódico local para dar su opinión.',
    instructionsEn: 'Your city council has announced it will close the historic centre to traffic. Write a letter to the editor of a local paper giving your view.',
    writing: { prompt: 'Escriba su carta al director.', points: ['Preséntese y explique por qué escribe.', 'Exponga las ventajas y los inconvenientes de la medida.', 'Dé su opinión con argumentos y un ejemplo.', 'Proponga una alternativa o una mejora.', 'Termine con una despedida formal.'], minWords: 150, maxWords: 180, checklist: ['I covered all five points.', 'The register is formal throughout (usted, no slang).', 'I used the subjunctive after opinion and wish: “no creo que”, “sería conveniente que”.', 'I used connectors: “por un lado… por otro”, “no obstante”, “en definitiva”.', 'It is between 150 and 180 words.'] },
  },
];

export const DELE_BY_ID: Record<string, DeleTask> = Object.fromEntries(DELE_TASKS.map((t) => [t.id, t]));
export const DELE_LEVELS: DeleLevel[] = ['A1', 'A2', 'B1', 'B2'];
export const PART_LABEL: Record<DelePart, { en: string; es: string; icon: 'book' | 'volume' | 'edit' }> = {
  reading: { en: 'Reading', es: 'Comprensión de lectura', icon: 'book' },
  listening: { en: 'Listening', es: 'Comprensión auditiva', icon: 'volume' },
  writing: { en: 'Writing', es: 'Expresión escrita', icon: 'edit' },
};
/** The real exam's pass mark. */
export const PASS = 0.6;
