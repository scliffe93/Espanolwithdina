// ───────────────────────────────────────────────────────────────
// Web Push, framework-free (WebCrypto only; runs in Deno and Node).
//
//  • Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188).
//  • Sender identity: VAPID (RFC 8292), an ES256 JWT signed with the
//    server's P-256 key. The private key lives only in a server secret.
//
// The push service (Apple, Google, Mozilla) only ever sees ciphertext;
// the phone decrypts it and the service worker shows the notification.
// ───────────────────────────────────────────────────────────────

export interface PushSubscription { endpoint: string; p256dh: string; auth: string }
export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

const enc = new TextEncoder();
export function b64u(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
}
const concat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

/** A P-256 private key (32-byte `d`, base64url) plus its uncompressed public point, as a JWK. */
function privateJwk(d: string, publicKey: Uint8Array): JsonWebKey {
  return { kty: 'EC', crv: 'P-256', d, x: b64u(publicKey.slice(1, 33)), y: b64u(publicKey.slice(33, 65)), ext: true };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** Encrypts a message for one subscription (RFC 8291). `fixed` pins the salt and sender key, for the RFC test vector only. */
export async function encryptPayload(plaintext: Uint8Array, sub: Pick<PushSubscription, 'p256dh' | 'auth'>, fixed?: { salt: Uint8Array; privateKey: string; publicKey: string }): Promise<Uint8Array> {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length < 16) throw new Error('Bad subscription keys.');
  let asPrivate: CryptoKey, asPublic: Uint8Array;
  if (fixed) {
    asPublic = unb64u(fixed.publicKey);
    asPrivate = await crypto.subtle.importKey('jwk', privateJwk(fixed.privateKey, asPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2])))); // 0x02 = last record
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, cipher); // header: salt, record size 4096, key id = sender public key
}

/** The VAPID Authorization header for one push service origin. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowMs: number): Promise<string> {
  const publicKey = unb64u(vapid.publicKey);
  const key = await crypto.subtle.importKey('jwk', privateJwk(vapid.privateKey, publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: vapid.subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

/** Sends one notification. Returns the push service's HTTP status (0 = network failure or timeout). 404/410 mean the subscription is gone. */
export async function sendPush(sub: PushSubscription, message: unknown, vapid: VapidKeys, opts: { fetch?: typeof fetch; now?: number; ttl?: number; timeoutMs?: number } = {}): Promise<number> {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
    const res = await (opts.fetch ?? fetch)(sub.endpoint, {
      method: 'POST',
      headers: { authorization: await vapidAuthorization(sub.endpoint, vapid, opts.now ?? Date.now()), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(opts.ttl ?? 86_400), urgency: 'normal' },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
    });
    await res.body?.cancel().catch(() => undefined);
    return res.status;
  } catch {
    return 0;
  }
}

/** Only real push services may be stored as endpoints, so the server can never be pointed at an arbitrary URL. */
export const PUSH_HOSTS = ['push.apple.com', 'fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];
export function validEndpoint(endpoint: string, hosts: string[] = PUSH_HOSTS): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && endpoint.length <= 1000 && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Generates a VAPID key pair (run once; the private half goes into a server secret). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), privateKey: jwk.d! };
}
