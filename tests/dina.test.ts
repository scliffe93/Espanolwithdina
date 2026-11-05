import { describe, expect, it } from 'vitest';
import { dinaGreeting } from '../src/components/Dina';
import { chunkText } from '../src/lib/speech';

describe('Dina greeting', () => {
  it('uses the requested greeting, agreeing with the learner where known', () => {
    expect(dinaGreeting('f').es).toBe('¡Hola! ¡Bienvenida a Learning with Dina!');
    expect(dinaGreeting(undefined).es).toBe('¡Hola! ¡Bienvenida a Learning with Dina!');
    expect(dinaGreeting('x').es).toBe('¡Hola! ¡Bienvenida a Learning with Dina!');
    expect(dinaGreeting('m').es).toBe('¡Hola! ¡Bienvenido a Learning with Dina!');
  });
});

describe('speech chunking (prevents long utterances being cut off)', () => {
  it('keeps short text whole', () => {
    expect(chunkText('¡Hola! ¡Bienvenida a Learning with Dina!')).toEqual(['¡Hola! ¡Bienvenida a Learning with Dina!']);
  });
  it('splits long text at sentence boundaries without losing words', () => {
    const long = 'Primera frase bastante larga para la prueba. '.repeat(8) + '¿Y una pregunta al final?';
    const chunks = chunkText(long, 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(120);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(long.trim().replace(/\s+/g, ' '));
  });
});
