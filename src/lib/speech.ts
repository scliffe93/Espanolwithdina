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
export function pickVoice(region: Region): SpeechSynthesisVoice | undefined {
  const voices = loadVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  const want: Record<Region, string[]> = {
    spain: ['es-es'],
    mexico: ['es-mx', 'es-us', 'es-419'],
    argentina: ['es-ar', 'es-uy', 'es-419', 'es-us', 'es-mx'],
    colombia: ['es-co', 'es-419', 'es-us', 'es-mx'],
  };
  const order = want[region] ?? ['es-es'];
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    const idx = order.indexOf(lang);
    let s = idx >= 0 ? 20 - idx * 3 : 0;
    if (/google|natural|neural|premium|enhanced|siri/i.test(v.name)) s += 3;
    if (v.localService) s += 1;
    return s;
  };
  return voices.sort((a, b) => score(b) - score(a))[0];
}

export function hasSpanishVoice(): boolean {
  return loadVoices().some((v) => v.lang.toLowerCase().startsWith('es'));
}

export interface SpeakOptions {
  region: Region;
  rate?: number;
  onBoundary?: (charIndex: number) => void;
  lang?: string;
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
export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  if (!ttsSupported || !text.trim()) return;
  const synth = window.speechSynthesis;
  const gen = ++generation;
  const wasBusy = synth.speaking || synth.pending;
  synth.cancel();
  // Chrome may drop an utterance queued immediately after cancel().
  if (wasBusy) await new Promise((r) => setTimeout(r, 60));
  await voicesReady();
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
