// Growing sentences. Each ladder starts with a short sentence and adds to it one step at a time: first the verb,
// then a time word, then a second idea joined with y / pero, then a reason or a contrast (porque, aunque, cuando),
// then a linking phrase (sin embargo, por eso, además). The part in [square brackets] is what the student adds at
// that step; everything else is already on the screen. How far up a ladder a student climbs is their sentence
// level (1 to 5), which follows their CEFR level unless the teacher sets it.
import type { Cefr } from '../types';
import type { Tense } from './verbs';

export interface Rung { es: string; en: string }
export interface Ladder { id: string; tense: Tense; verb: string; rungs: Rung[] }

export const SENTENCE_STEPS: { level: number; label: string; adds: string; example: string }[] = [
  { level: 1, label: 'Short sentences', adds: 'the verb', example: 'Como en casa.' },
  { level: 2, label: 'With a time word', adds: 'hoy, ahora, ya, más tarde, ayer', example: 'Hoy como en casa.' },
  { level: 3, label: 'Two ideas joined', adds: 'y, pero', example: 'Hoy como en casa y ceno pronto.' },
  { level: 4, label: 'With a reason or a contrast', adds: 'porque, aunque, cuando', example: 'Hoy como en casa y ceno pronto porque tengo sueño.' },
  { level: 5, label: 'Linked sentences', adds: 'sin embargo, por eso, además', example: '…; sin embargo, mañana salgo con mis amigos.' },
];

/** The sentence level a student starts at for their CEFR level, until the teacher sets one. */
export function sentenceLevelFor(level: Cefr | null | undefined): number {
  return level === 'A1' ? 2 : level === 'A2' ? 3 : level === 'B1' ? 4 : level ? 5 : 2;
}

export const LADDERS: Ladder[] = [
  { id: 'pres-comer', tense: 'present', verb: 'comer', rungs: [
    { es: '[Como] en casa.', en: 'I eat at home.' },
    { es: '[Hoy] como en casa.', en: 'Today I eat at home.' },
    { es: 'Hoy como en casa [y ceno pronto].', en: 'Today I eat at home and I have dinner early.' },
    { es: 'Hoy como en casa y ceno pronto [porque tengo sueño].', en: 'Today I eat at home and I have dinner early because I am sleepy.' },
    { es: 'Hoy como en casa y ceno pronto porque tengo sueño; [sin embargo, mañana salgo con mis amigos].', en: '…because I am sleepy; however, tomorrow I am going out with my friends.' },
  ] },
  { id: 'pres-vivir', tense: 'present', verb: 'vivir', rungs: [
    { es: '[Vivo] en Madrid.', en: 'I live in Madrid.' },
    { es: '[Ahora] vivo en Madrid.', en: 'Now I live in Madrid.' },
    { es: 'Ahora vivo en Madrid, [pero trabajo en Toledo].', en: 'Now I live in Madrid, but I work in Toledo.' },
    { es: 'Ahora vivo en Madrid, pero trabajo en Toledo [aunque está lejos].', en: 'Now I live in Madrid, but I work in Toledo although it is far.' },
    { es: 'Ahora vivo en Madrid, pero trabajo en Toledo aunque está lejos; [por eso, tomo el tren cada día].', en: '…although it is far; that is why I take the train every day.' },
  ] },
  { id: 'pres-tener', tense: 'present', verb: 'tener', rungs: [
    { es: '[Tengo] una clase de español.', en: 'I have a Spanish class.' },
    { es: '[Más tarde] tengo una clase de español.', en: 'Later I have a Spanish class.' },
    { es: 'Más tarde tengo una clase de español [y después quedo con una amiga].', en: 'Later I have a Spanish class and afterwards I am meeting a friend.' },
    { es: 'Más tarde tengo una clase de español y después quedo con una amiga [porque queremos ir al cine].', en: '…and afterwards I am meeting a friend because we want to go to the cinema.' },
    { es: 'Más tarde tengo una clase de español y después quedo con una amiga porque queremos ir al cine; [además, ya tengo las entradas].', en: '…because we want to go to the cinema; besides, I already have the tickets.' },
  ] },
  { id: 'prog-estudiar', tense: 'progressive', verb: 'estudiar', rungs: [
    { es: '[Estoy estudiando] español.', en: 'I am studying Spanish.' },
    { es: '[Ahora mismo] estoy estudiando español.', en: 'Right now I am studying Spanish.' },
    { es: 'Ahora mismo estoy estudiando español [y mi hermano está cocinando].', en: 'Right now I am studying Spanish and my brother is cooking.' },
    { es: 'Ahora mismo estoy estudiando español y mi hermano está cocinando [porque esta noche vienen unos amigos].', en: '…and my brother is cooking because some friends are coming tonight.' },
    { es: 'Ahora mismo estoy estudiando español y mi hermano está cocinando porque esta noche vienen unos amigos; [sin embargo, todavía no estamos poniendo la mesa].', en: '…because some friends are coming tonight; however, we are not laying the table yet.' },
  ] },
  { id: 'prog-trabajar', tense: 'progressive', verb: 'trabajar', rungs: [
    { es: '[Estoy trabajando] en casa.', en: 'I am working at home.' },
    { es: '[Hoy] estoy trabajando en casa.', en: 'Today I am working at home.' },
    { es: 'Hoy estoy trabajando en casa, [pero mi jefe está viajando].', en: 'Today I am working at home, but my boss is travelling.' },
    { es: 'Hoy estoy trabajando en casa, pero mi jefe está viajando [aunque está lloviendo mucho].', en: '…but my boss is travelling although it is raining a lot.' },
    { es: 'Hoy estoy trabajando en casa, pero mi jefe está viajando aunque está lloviendo mucho; [por eso, estamos hablando por teléfono].', en: '…although it is raining a lot; that is why we are talking on the phone.' },
  ] },
  { id: 'perf-terminar', tense: 'perfect', verb: 'terminar', rungs: [
    { es: '[He terminado] el trabajo.', en: 'I have finished the work.' },
    { es: '[Ya] he terminado el trabajo.', en: 'I have already finished the work.' },
    { es: 'Ya he terminado el trabajo [y he llamado a mi madre].', en: 'I have already finished the work and I have called my mother.' },
    { es: 'Ya he terminado el trabajo y he llamado a mi madre [porque hoy ha sido su cumpleaños].', en: '…and I have called my mother because today has been her birthday.' },
    { es: 'Ya he terminado el trabajo y he llamado a mi madre porque hoy ha sido su cumpleaños; [sin embargo, todavía no he comprado el regalo].', en: '…because today has been her birthday; however, I have not bought the present yet.' },
  ] },
  { id: 'pret-ir', tense: 'preterite', verb: 'ir', rungs: [
    { es: '[Fui] al mercado.', en: 'I went to the market.' },
    { es: '[Ayer] fui al mercado.', en: 'Yesterday I went to the market.' },
    { es: 'Ayer fui al mercado [y compré fruta].', en: 'Yesterday I went to the market and I bought fruit.' },
    { es: 'Ayer fui al mercado y compré fruta [porque no tenía nada en casa].', en: '…and I bought fruit because I had nothing at home.' },
    { es: 'Ayer fui al mercado y compré fruta porque no tenía nada en casa; [después, cené con mis vecinos].', en: '…because I had nothing at home; afterwards, I had dinner with my neighbours.' },
  ] },
  { id: 'pret-viajar', tense: 'preterite', verb: 'viajar', rungs: [
    { es: '[Viajé] a Sevilla.', en: 'I travelled to Seville.' },
    { es: '[El año pasado] viajé a Sevilla.', en: 'Last year I travelled to Seville.' },
    { es: 'El año pasado viajé a Sevilla, [pero no visité la catedral].', en: 'Last year I travelled to Seville, but I did not visit the cathedral.' },
    { es: 'El año pasado viajé a Sevilla, pero no visité la catedral [porque llegué muy tarde].', en: '…but I did not visit the cathedral because I arrived very late.' },
    { es: 'El año pasado viajé a Sevilla, pero no visité la catedral porque llegué muy tarde; [por eso, volví en primavera].', en: '…because I arrived very late; that is why I went back in spring.' },
  ] },
  { id: 'impf-vivir', tense: 'imperfect', verb: 'vivir', rungs: [
    { es: '[Vivía] en un pueblo.', en: 'I used to live in a village.' },
    { es: '[Antes] vivía en un pueblo.', en: 'Before, I used to live in a village.' },
    { es: 'Antes vivía en un pueblo [y jugaba en la calle].', en: 'Before, I used to live in a village and I used to play in the street.' },
    { es: 'Antes vivía en un pueblo y jugaba en la calle [cuando hacía buen tiempo].', en: '…and I used to play in the street when the weather was good.' },
    { es: 'Antes vivía en un pueblo y jugaba en la calle cuando hacía buen tiempo; [sin embargo, en invierno casi siempre leía en casa].', en: '…when the weather was good; however, in winter I almost always read at home.' },
  ] },
  { id: 'fut-viajar', tense: 'future', verb: 'viajar', rungs: [
    { es: '[Viajaré] a México.', en: 'I will travel to Mexico.' },
    { es: '[El próximo año] viajaré a México.', en: 'Next year I will travel to Mexico.' },
    { es: 'El próximo año viajaré a México [y visitaré a mi prima].', en: 'Next year I will travel to Mexico and I will visit my cousin.' },
    { es: 'El próximo año viajaré a México y visitaré a mi prima [porque vive allí desde hace años].', en: '…and I will visit my cousin because she has lived there for years.' },
    { es: 'El próximo año viajaré a México y visitaré a mi prima porque vive allí desde hace años; [además, aprenderé a cocinar con ella].', en: '…because she has lived there for years; besides, I will learn to cook with her.' },
  ] },
  { id: 'cond-vivir', tense: 'conditional', verb: 'vivir', rungs: [
    { es: '[Viviría] cerca del mar.', en: 'I would live near the sea.' },
    { es: '[Con más dinero] viviría cerca del mar.', en: 'With more money I would live near the sea.' },
    { es: 'Con más dinero viviría cerca del mar [y trabajaría menos].', en: 'With more money I would live near the sea and I would work less.' },
    { es: 'Con más dinero viviría cerca del mar y trabajaría menos [aunque echaría de menos la ciudad].', en: '…and I would work less although I would miss the city.' },
    { es: 'Con más dinero viviría cerca del mar y trabajaría menos aunque echaría de menos la ciudad; [por eso, volvería a menudo].', en: '…although I would miss the city; that is why I would come back often.' },
  ] },
  { id: 'subj-venir', tense: 'subjunctive', verb: 'venir', rungs: [
    { es: 'Quiero que [vengas] a la fiesta.', en: 'I want you to come to the party.' },
    { es: '[Mañana] quiero que vengas a la fiesta.', en: 'Tomorrow I want you to come to the party.' },
    { es: 'Mañana quiero que vengas a la fiesta [y que traigas a tu hermana].', en: 'Tomorrow I want you to come to the party and to bring your sister.' },
    { es: 'Mañana quiero que vengas a la fiesta y que traigas a tu hermana [aunque llegue tarde].', en: '…and to bring your sister even if she arrives late.' },
    { es: 'Mañana quiero que vengas a la fiesta y que traigas a tu hermana aunque llegue tarde; [además, espero que lo pasemos muy bien].', en: '…even if she arrives late; besides, I hope we have a great time.' },
  ] },
];

/** A rung split into what is already there, the part to add, and what follows. */
export function parseRung(r: Rung): { before: string; add: string; after: string; plain: string } {
  const m = r.es.match(/^(.*)\[(.+)\](.*)$/);
  if (!m) return { before: r.es, add: '', after: '', plain: r.es };
  return { before: m[1], add: m[2], after: m[3], plain: m[1] + m[2] + m[3] };
}

export const LADDER_BY_ID: Record<string, Ladder> = Object.fromEntries(LADDERS.map((l) => [l.id, l]));
export const laddersFor = (tense: Tense) => LADDERS.filter((l) => l.tense === tense);
