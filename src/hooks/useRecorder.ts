import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteRecording, getRecording, saveRecording } from '../lib/db';

export const recorderSupported =
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

function pickMime(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((t) => (window.MediaRecorder as typeof MediaRecorder).isTypeSupported?.(t));
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'denied' | 'error';

/**
 * Records audio with MediaRecorder and persists it in IndexedDB under `id`.
 * Provides playback, deletion and a live input level for visual feedback.
 */
export function useRecorder(id: string, opts: { maxMs?: number; onSaved?: () => void } = {}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number>(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const onSaved = useRef(opts.onSaved);
  onSaved.current = opts.onSaved;

  // Load an existing recording for this id
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    getRecording(id)
      .then((b) => {
        if (alive && b) {
          objUrl = URL.createObjectURL(b);
          setUrl(objUrl);
        } else if (alive) setUrl(null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [id]);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!recorderSupported) {
      setState('error');
      return;
    }
    setState('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        cleanup();
        setState('idle');
        if (blob.size > 0) {
          await saveRecording(id, blob);
          setUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(blob);
          });
          onSaved.current?.();
        }
      };
      rec.current = r;
      r.start();
      setState('recording');
      const t0 = performance.now();

      // Level meter
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtx.current = ctx;
        const src = ctx.createMediaStreamSource(s);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += (v - 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) / 40));
          const ms = performance.now() - t0;
          setElapsed(ms);
          if (opts.maxMs && ms > opts.maxMs) stop();
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* level meter is optional */
      }
    } catch (e) {
      cleanup();
      setState((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [id, cleanup, opts.maxMs, stop]);

  const remove = useCallback(async () => {
    await deleteRecording(id);
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, [id]);

  return { state, url, level, elapsed, start, stop, remove, supported: recorderSupported };
}

/** Plays an audio URL and resolves when done. */
export function playUrl(url: string): Promise<void> {
  return new Promise((res) => {
    const a = new Audio(url);
    a.onended = () => res();
    a.onerror = () => res();
    a.play().catch(() => res());
  });
}
