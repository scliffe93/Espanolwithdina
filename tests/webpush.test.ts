import { describe, expect, it } from 'vitest';
import { fakePhone } from './helpers/phone';
import { b64u, encryptPayload, generateVapidKeys, unb64u, validEndpoint, vapidAuthorization } from '../supabase/functions/_shared/webpush';

const enc = new TextEncoder();
describe('web push encryption (RFC 8291)', () => {
  it('reproduces the RFC 8291 Appendix A test vector byte for byte', async () => {
    const body = await encryptPayload(enc.encode('When I grow up, I want to be a watermelon'),
      { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
      { salt: unb64u('DGv6ra1nlYgDCS1FRnbzlw'), privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', publicKey: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8' });
    expect(b64u(body)).toBe('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
  });
  it('a phone can decrypt what the server encrypts, and every message is different', async () => {
    const phone = await fakePhone();
    const msg = JSON.stringify({ title: 'Deberes nuevos', body: 'Verbos: ser y estar ¡ánimo!' });
    const a = await encryptPayload(enc.encode(msg), phone.keys);
    const b = await encryptPayload(enc.encode(msg), phone.keys);
    expect(await phone.read(a)).toBe(msg);
    expect(b64u(a)).not.toBe(b64u(b));
    expect(b64u(a)).not.toContain(b64u(enc.encode('Deberes')).slice(0, 8));
    await expect(encryptPayload(enc.encode('x'), { p256dh: 'AAAA', auth: phone.keys.auth })).rejects.toThrow();
  });
});

describe('VAPID', () => {
  it('signs a token the push service can verify with the public key', async () => {
    const keys = await generateVapidKeys();
    const now = Date.UTC(2026, 10, 12, 12);
    const header = await vapidAuthorization('https://web.push.apple.com/abc/def', { ...keys, subject: 'https://example.org/' }, now);
    const m = header.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/)!;
    expect(m[4]).toBe(keys.publicKey);
    expect(JSON.parse(new TextDecoder().decode(unb64u(m[2])))).toEqual({ aud: 'https://web.push.apple.com', exp: now / 1000 + 43200, sub: 'https://example.org/' });
    const pub = await crypto.subtle.importKey('raw', unb64u(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(m[3]), enc.encode(`${m[1]}.${m[2]}`))).toBe(true);
  });
  it('only accepts real push services as endpoints', () => {
    expect(validEndpoint('https://web.push.apple.com/QOx')).toBe(true);
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(validEndpoint('http://web.push.apple.com/x')).toBe(false);
    expect(validEndpoint('https://evil.example/push.apple.com')).toBe(false);
    expect(validEndpoint('https://push.apple.com.evil.example/x')).toBe(false);
    expect(validEndpoint('https://10.0.0.1/x')).toBe(false);
    expect(validEndpoint('not a url')).toBe(false);
  });
});
