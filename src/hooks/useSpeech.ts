import { useCallback, useEffect, useState } from 'react';
import { onSpeakingChange, speak, stopSpeaking, isSpeaking } from '../lib/speech';
import { useStore } from '../lib/store';

export function useTtsSpeaking(): boolean {
  const [s, setS] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setS), []);
  return s;
}

/** Speak Spanish in the learner's region voice and preferred rate. */
export function useSay() {
  const { state } = useStore();
  const region = state.profile?.region ?? 'spain';
  const rate = state.settings.speechRate;
  return useCallback(
    (text: string, opts: { slow?: boolean; rate?: number } = {}) => speak(text, { region, rate: opts.rate ?? (opts.slow ? 0.6 : rate) }),
    [region, rate],
  );
}

export { stopSpeaking };
