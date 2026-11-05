import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { HelpMeRemember, type MemorySource } from './HelpMeRemember';
import { useSay } from '../hooks/useSpeech';
import { playUrl, useRecorder } from '../hooks/useRecorder';
import { useStore, mediaEnd, mediaStart } from '../lib/store';
import { addSpeakingAttempt } from '../lib/state';
import { recognitionSupported, recognize, speakable, ttsSupported } from '../lib/speech';
import { normalize, stripAccents } from '../lib/answer';

/** Word overlap between what the recogniser heard and the target — shown as words, never as a "score". */
function wordMatch(target: string, heard: string): { word: string; heard: boolean }[] {
  const h = new Set(stripAccents(normalize(heard)).split(' '));
  return target.split(/\s+/).map((w) => ({ word: w, heard: h.has(stripAccents(normalize(w))) }));
}

export function SpeakControls({
  es,
  en,
  grammar,
  memory,
  recordId,
  autoShowMeaning,
  compact,
}: {
  es: string;
  en: string;
  grammar?: string;
  memory?: MemorySource;
  recordId: string;
  autoShowMeaning?: boolean;
  compact?: boolean;
}) {
  const say = useSay();
  const { update, state } = useStore();
  const [panel, setPanel] = useState<'none' | 'meaning' | 'grammar' | 'memory' | 'try'>(autoShowMeaning ? 'meaning' : 'none');
  const [heard, setHeard] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const recRef = useRef<{ stop(): void } | null>(null);
  const rec = useRecorder(recordId, { maxMs: 20_000, onSaved: () => update((s) => addSpeakingAttempt(s)) });
  const spoken = speakable(es);
  const lang = state.profile?.region === 'mexico' ? 'es-MX' : 'es-ES';

  useEffect(() => {
    setPanel(autoShowMeaning ? 'meaning' : 'none');
    setHeard(null);
  }, [es, autoShowMeaning]);

  const toggle = (p: typeof panel) => setPanel((cur) => (cur === p ? 'none' : p));

  const startTry = async () => {
    setHeard(null);
    mediaStart();
    await rec.start();
    if (recognitionSupported) {
      recRef.current = recognize(lang, (alts) => setHeard(alts[0] ?? ''), () => (recRef.current = null));
    }
  };
  const stopTry = () => {
    rec.stop();
    recRef.current?.stop();
    mediaEnd();
  };

  const compare = async () => {
    if (!rec.url) return;
    setComparing(true);
    mediaStart();
    await say(spoken);
    await new Promise((r) => setTimeout(r, 350));
    await playUrl(rec.url);
    mediaEnd();
    setComparing(false);
  };

  const playMine = async () => {
    if (!rec.url) return;
    mediaStart();
    await playUrl(rec.url);
    mediaEnd();
  };

  return (
    <div className={compact ? '' : 'mt-3'}>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Speaking tools">
        <button className="ctrl" onClick={() => say(spoken)} disabled={!ttsSupported}><Icon name="replay" size={16} /> Listen again</button>
        <button className="ctrl" onClick={() => say(spoken, { slow: true })} disabled={!ttsSupported}><Icon name="slow" size={16} /> Slow it down</button>
        <button className="ctrl" aria-expanded={panel === 'meaning'} onClick={() => toggle('meaning')}><Icon name="translate" size={16} /> What does that mean?</button>
        {grammar && <button className="ctrl" aria-expanded={panel === 'grammar'} onClick={() => toggle('grammar')}><Icon name="book" size={16} /> Explain the grammar</button>}
        {memory && <button className="ctrl" aria-expanded={panel === 'memory'} onClick={() => toggle('memory')}><Icon name="bulb" size={16} /> Help me remember</button>}
        <button className="ctrl" aria-expanded={panel === 'try'} onClick={() => toggle('try')}><Icon name="mic" size={16} /> Let me try</button>
        {rec.url && (
          <button className="ctrl" onClick={compare} disabled={comparing}><Icon name="compare" size={16} /> {comparing ? 'Comparing…' : 'Compare pronunciation'}</button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {panel !== 'none' && (
          <motion.div key={panel} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl bg-white/80 p-4 text-[15px] ring-1 ring-ink/5">
              {panel === 'meaning' && <p><span className="eyebrow mr-2">English</span>{en}</p>}
              {panel === 'grammar' && grammar && <p><span className="eyebrow mr-2">Grammar</span>{grammar}</p>}
              {panel === 'memory' && memory && <HelpMeRemember source={memory} compact />}
              {panel === 'try' && (
                <div>
                  {!rec.supported ? (
                    <p className="text-ink-soft">Recording isn’t supported in this browser. Try reading the line aloud, then tap Listen again to compare by ear.</p>
                  ) : (
                    <>
                      <p className="mb-3 text-ink-soft">Say: <span className="font-semibold text-ink">{es}</span></p>
                      <div className="flex flex-wrap items-center gap-2">
                        {rec.state === 'recording' ? (
                          <button className="btn-primary !py-2.5" onClick={stopTry}>
                            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
                            Stop ({Math.ceil(rec.elapsed / 1000)}s)
                          </button>
                        ) : (
                          <button className="btn-primary !py-2.5" onClick={startTry} disabled={rec.state === 'requesting'}><Icon name="mic" size={18} /> {rec.url ? 'Record again' : 'Record'}</button>
                        )}
                        {rec.state === 'recording' && (
                          <div className="flex h-8 items-end gap-0.5" aria-hidden>
                            {Array.from({ length: 12 }).map((_, i) => (
                              <span key={i} className="w-1 rounded-full bg-terracotta" style={{ height: `${8 + rec.level * 24 * (0.5 + Math.abs(Math.sin(i + rec.elapsed / 120)) / 2)}px` }} />
                            ))}
                          </div>
                        )}
                        {rec.url && rec.state !== 'recording' && (
                          <>
                            <button className="ctrl" onClick={playMine}><Icon name="play" size={16} /> Play mine</button>
                            <button className="ctrl" onClick={compare} disabled={comparing}><Icon name="compare" size={16} /> Guide, then me</button>
                            <button className="ctrl" onClick={() => { rec.remove(); setHeard(null); }}><Icon name="trash" size={16} /> Delete</button>
                          </>
                        )}
                      </div>
                      {rec.state === 'denied' && <p className="mt-2 text-sm text-terracotta-dark">Microphone access was blocked. Allow it in your browser’s site settings to record.</p>}
                      {rec.state === 'error' && <p className="mt-2 text-sm text-terracotta-dark">Couldn’t start recording on this device.</p>}
                      {heard !== null && heard !== '' && (
                        <div className="mt-3 rounded-xl bg-cream-100 p-3 text-sm">
                          <p className="eyebrow mb-1">Your browser’s speech recogniser heard</p>
                          <p className="mb-2 italic">“{heard}”</p>
                          <p className="flex flex-wrap gap-1">
                            {wordMatch(es, heard).map((w, i) => (
                              <span key={i} className={`rounded-md px-1.5 py-0.5 ${w.heard ? 'bg-olive/15 text-olive' : 'bg-ink/5 text-ink-mute'}`}>{w.word}</span>
                            ))}
                          </p>
                          <p className="mt-2 text-xs text-ink-mute">Green words were recognised. This is not a pronunciation score — recognisers vary by browser, accent and microphone. Use Compare to judge by ear.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
