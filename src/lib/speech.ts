import type { Region } from '../types';

// Browser speech synthesis (free, on-device or OS-provided voices).
// Voice quality and availability vary by browser and operating system.

type Listener = (speaking: boolean) => void;
const listeners = new Set<Listener>();
let speakingNow = false;
let voicesCache: SpeechSynthesisVoice[] = [];

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function setSpeaking(v: boolean) {
  speakingNow = v;
  listeners.forEach((l) => l(v));
}

export function onSpeakingChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isSpeaking(): boolean {
  return speakingNow;
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

if (ttsSupported) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

/** Picks the best Spanish voice for the region, preferring higher-quality voices. */
const VOICE_PREFERENCE: Record<Region, string[]> = {
  spain: ['es-es'],
  mexico: ['es-mx', 'es-us', 'es-419'],
  argentina: ['es-ar', 'es-uy', 'es-419', 'es-us', 'es-mx'],
  colombia: ['es-co', 'es-419', 'es-us', 'es-mx'],
};

/** Higher = more natural / better match. Online "natural" voices beat the robotic defaults. */
function voiceScore(v: SpeechSynthesisVoice, order: string[]): number {
  const lang = v.lang.toLowerCase().replace('_', '-');
  const idx = order.indexOf(lang);
  let s = idx >= 0 ? 20 - idx * 3 : lang.startsWith('es') ? 2 : 0;
  const n = v.name.toLowerCase();
  if (/natural|neural|premium|enhanced|siri/.test(n)) s += 8;
  if (/google/.test(n)) s += 6;
  if (/mónica|monica|paulina|jorge|juan|diego|lucía|lucia|elvira|alvaro|dalia|abril|elena|sabina|laura|pablo|helena/.test(n)) s += 3;
  if (/espeak|compact|novelty|bad news|zarvox|whisper|bubbles|cellos|trinoids|good news|jester|organ|superstar|wobble/.test(n)) s -= 15;
  if (v.localService && !/google/.test(n)) s += 1;
  return s;
}

/** Picks the best Spanish voice for the region (or the learner's chosen voice). */
export function pickVoice(region: Region): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  if (preferredVoiceURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI);
    if (chosen) return chosen;
  }
  const order = VOICE_PREFERENCE[region] ?? ['es-es'];
  return voices.filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => voiceScore(b, order) - voiceScore(a, order))[0];
}

let preferredVoiceURI: string | null = null;
/** Set from settings: a voice the learner chose in the voice picker. */
export function setPreferredVoice(uri: string | null) {
  preferredVoiceURI = uri;
}

/** All Spanish voices on this device, best first (for the settings picker). */
export function spanishVoices(region: Region = 'spain'): SpeechSynthesisVoice[] {
  const order = VOICE_PREFERENCE[region] ?? ['es-es'];
  return loadVoices().filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => voiceScore(b, order) - voiceScore(a, order));
}

// Browsers refuse to speak until the page has received a tap or key press, and
// iOS requires speak() to be called inside that gesture. We remember whether a
// gesture has happened, "unlock" the engine on the first one, and replay the
// line that was waiting (e.g. a character's opening line) at that moment.
let interacted = false;
let pendingAuto: { text: string; opts: SpeakOptions } | null = null;
export function hasInteracted(): boolean {
  return interacted;
}
if (typeof window !== 'undefined') {
  const unlock = () => {
    interacted = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, unlock, true));
    if (ttsSupported) {
      try {
        const synth = window.speechSynthesis;
        if (synth.paused) synth.resume();
        if (!synth.speaking && !pendingAuto) synth.speak(new SpeechSynthesisUtterance(' ')); // warms the engine (silent)
      } catch { /* ignore */ }
      if (pendingAuto) { const p = pendingAuto; pendingAuto = null; speak(p.text, p.opts); }
    }
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));
}

export function hasSpanishVoice(): boolean {
  return loadVoices().some((v) => v.lang.toLowerCase().startsWith('es'));
}

export interface SpeakOptions {
  region: Region;
  rate?: number;
  onBoundary?: (charIndex: number) => void;
  lang?: string;
  /** The app started this (not a tap). Before the first user gesture it is held and played on that gesture. */
  auto?: boolean;
}

// Keep live utterances referenced: Chrome can garbage-collect an utterance
// mid-sentence, which silently cuts speech off and never fires onend.
const live = new Set<SpeechSynthesisUtterance>();
let generation = 0;
const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
const isChromeDesktop = typeof navigator !== 'undefined' && /chrome|chromium|edg\//i.test(navigator.userAgent) && !isAndroid;

/** Waits briefly for voices to load (they arrive asynchronously in Chrome/Safari). */
function voicesReady(timeout = 1200): Promise<void> {
  if (!ttsSupported || loadVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { window.speechSynthesis.removeEventListener?.('voiceschanged', done); res(); };
    window.speechSynthesis.addEventListener?.('voiceschanged', done);
    setTimeout(done, timeout);
  });
}

/** Splits long text at sentence/clause boundaries — long utterances get cut off in some engines. */
export function chunkText(text: string, max = 180): string[] {
  const t = text.trim();
  if (t.length <= max) return [t];
  const parts = t.match(/[^.!?¡¿;:]+[.!?;:]*|[¡¿][^.!?]+[.!?]*/g) ?? [t];
  const out: string[] = [];
  let cur = '';
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if ((cur + ' ' + p).trim().length > max && cur) { out.push(cur); cur = p; }
    else cur = (cur + ' ' + p).trim();
  }
  if (cur) out.push(cur);
  return out;
}

function speakOne(text: string, opts: SpeakOptions, voice: SpeechSynthesisVoice | undefined, gen: number): Promise<void> {
  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    if (gen !== generation) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = opts.lang ?? voice?.lang ?? regionLang(opts.region);
    u.rate = opts.rate ?? 0.95;
    u.pitch = 1;
    live.add(u);
    let finished = false;
    let keepAlive: number | undefined;
    let safety: number | undefined; // declared first: some engines fire onerror synchronously
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearInterval(keepAlive);
      window.clearTimeout(safety);
      live.delete(u);
      resolve();
    };
    u.onstart = () => setSpeaking(true);
    u.onend = done;
    u.onerror = done;
    if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex);
    if (synth.paused) synth.resume(); // Safari can be left paused after interruptions
    synth.speak(u);
    // Desktop Chrome stops long utterances after ~15 s unless nudged.
    if (isChromeDesktop) keepAlive = window.setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10_000);
    // Safety net: resolve even if the engine never fires onstart/onend (estimated duration + margin).
    const est = Math.max(3500, (text.length * 85) / (u.rate || 1) + 2500);
    safety = window.setTimeout(function check() {
      if (synth.speaking && gen === generation) { window.setTimeout(check, 1500); return; }
      done();
    }, est);
  });
}

/** Speaks text; resolves when finished (or immediately if unsupported). Never hangs. */
export function speak(text: string, opts: SpeakOptions): Promise<void> {
  if (!ttsSupported || !text.trim()) return Promise.resolve();
  const synth = window.speechSynthesis;
  const gen = ++generation;
  if (!interacted && opts.auto) {
    // Browsers won't play this yet; keep the latest automatic line for the first tap.
    pendingAuto = { text, opts };
    return Promise.resolve();
  }
  pendingAuto = null;
  const wasBusy = synth.speaking || synth.pending;
  synth.cancel();
  const voicesLoaded = loadVoices().length > 0;
  const isApple = /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
  // Start synchronously whenever we can: iOS only honours speak() inside the tap that triggered it.
  const needDelay = wasBusy && isChromeDesktop && !isApple;
  const run = async () => {
    if (needDelay) await new Promise((r) => setTimeout(r, 60)); // Chrome drops an utterance queued right after cancel()
    if (!voicesLoaded) await voicesReady();
    if (gen !== generation) return;
    const voice = opts.lang ? undefined : pickVoice(opts.region);
    try {
      for (const chunk of chunkText(text)) {
        if (gen !== generation) break;
        await speakOne(chunk, opts, voice, gen);
      }
    } finally {
      if (gen === generation) setSpeaking(false);
    }
  };
  if (!needDelay && voicesLoaded) {
    // Fast path: the first utterance is queued before this function returns (keeps the gesture context).
    const voice = opts.lang ? undefined : pickVoice(opts.region);
    const chunks = chunkText(text);
    const first = speakOne(chunks[0], opts, voice, gen);
    return (async () => {
      try {
        await first;
        for (const chunk of chunks.slice(1)) {
          if (gen !== generation) break;
          await speakOne(chunk, opts, voice, gen);
        }
      } finally {
        if (gen === generation) setSpeaking(false);
      }
    })();
  }
  return run();
}

export function stopSpeaking() {
  generation++;
  if (ttsSupported) window.speechSynthesis.cancel();
  setSpeaking(false);
}

// ── Speech recognition (Chrome, Edge, Safari; not Firefox) ──────────

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => RecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => RecognitionLike) | undefined;
}

export const recognitionSupported = !!recognitionCtor();

export interface RecognitionHandle {
  stop(): void;
}

/**
 * Transcribes one utterance. Returns alternatives so callers can match
 * against expected answers. Note: in Chrome, audio is processed by the
 * browser vendor's speech service.
 */
export function recognize(
  lang: string,
  onResult: (alternatives: string[], isFinal: boolean) => void,
  onEnd: (error?: string) => void,
): RecognitionHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang;
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.continuous = false;
  let err: string | undefined;
  r.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    const alts = Array.from({ length: res.length }, (_, i) => res[i].transcript);
    onResult(alts, res.isFinal);
  };
  r.onerror = (e) => {
    err = e.error;
  };
  r.onend = () => onEnd(err);
  try {
    r.start();
  } catch {
    return null;
  }
  return { stop: () => r.stop() };
}

/** Text for speech: resolves "o/a" display forms to a single spoken form. */
export function speakable(text: string): string {
  return text.replace(/(\w+)o\/a\b/g, '$1o').replace(/\s*\/\s*/g, ', ');
}

/** BCP-47 tag for recognition / synthesis in a variety. */
export function regionLang(region: Region): string {
  return { spain: 'es-ES', mexico: 'es-MX', argentina: 'es-AR', colombia: 'es-CO' }[region] ?? 'es-ES';
}
