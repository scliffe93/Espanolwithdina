import { describe, expect, it } from 'vitest';
import { spellingSlip } from '../src/lib/answer';

describe('spotting a slight spelling mistake', () => {
  it('sees a letter off in a longer word', () => {
    expect(spellingSlip('the neigbourhood', 'the neighbourhood')).toBe('spelling');
    expect(spellingSlip('yesterdey', 'yesterday')).toBe('spelling');
    expect(spellingSlip('El lunes fui al mercdo con mi vecina Carmen', 'El lunes fui al mercado con mi vecina Carmen')).toBe('spelling');
  });
  it('sees when only the accents differ', () => {
    expect(spellingSlip('hablo', 'habló')).toBe('accents');
    expect(spellingSlip('Manana', 'mañana')).toBe('spelling'); // ñ is its own letter, so this is spelling, not accents
  });
  it('does not call a short word or a different word a typo', () => {
    expect(spellingSlip('fue', 'fui')).toBe(null);
    expect(spellingSlip('the pharmacy', 'the neighbourhood')).toBe(null);
    expect(spellingSlip('', 'fui')).toBe(null);
    expect(spellingSlip('fui', undefined)).toBe(null);
  });
  it('checks each accepted answer', () => {
    expect(spellingSlip('apartmant', 'the flat / apartment')).toBe('spelling');
    expect(spellingSlip('fuimoz', 'fuimos|fueron')).toBe('spelling');
  });
  it('trusts the app when it has named the mistake', () => {
    expect(spellingSlip('hablamos', 'hablaron', 'wrong-person')).toBe(null);
    expect(spellingSlip('trabaje', 'trabajé', 'accents')).toBe('accents');
    expect(spellingSlip('trabajee', 'trabajé', 'spelling')).toBe('spelling');
  });
});
