import { describe, expect, it } from 'vitest';
import { bestHeard } from '../src/screens/Verbs';
import { checkAnswer } from '../src/lib/answer';

// Saying an answer in the verb gym: what the phone heard is tidied before it is checked.
describe('a spoken answer', () => {
  it('drops the pronoun, capitals and punctuation people and phones add', () => {
    expect(bestHeard(['Yo hablo.'], 'hablo')).toBe('hablo');
    expect(bestHeard(['Nosotros hemos hablado'], 'hemos hablado')).toBe('hemos hablado');
    expect(bestHeard(['¿Tú quieres?'], 'quieres')).toBe('quieres');
  });
  it('uses whichever of the phone’s guesses is right', () => {
    expect(bestHeard(['a blow', 'hablo', 'habló'], 'hablo')).toBe('hablo');
    expect(bestHeard(['hablo', 'habló'], 'habló')).toBe('habló');
  });
  it('keeps a wrong answer wrong', () => {
    const heard = bestHeard(['yo hablas'], 'hablo');
    expect(heard).toBe('hablas');
    expect(checkAnswer(heard, ['hablo'])).toBe('wrong');
  });
  it('copes with silence', () => { expect(bestHeard([], 'hablo')).toBe(''); });
});
