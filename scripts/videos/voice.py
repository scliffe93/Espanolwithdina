"""Dina's voice for the how-to videos: English spoken with a Spanish accent.

The voice is a real Spanish one (Piper's free "claude" voice, trained on a native Spanish speaker). Left alone it
would read English with Spanish spelling rules, which is hard to follow. Instead each line is first turned into
English sounds, then every sound is swapped for the one a Spanish speaker would use (a tapped r, five pure vowels,
b for v, d for "th", "es" before s + consonant), and the Spanish voice says the result. Because the voice only says
sounds it knows, the accent is genuine and the words stay clear. Spanish words in a line, written as
[es]hola[/es], are said as real Spanish.

Usage: voice.py <model.onnx> <lines.json> <outDir> [--level spanish|native|clear] [--speed 1.0] [--speaker N]
  lines.json: {"id": "text", ...}  ->  <outDir>/<id>.wav, <outDir>/bark.wav and <outDir>/durations.json (seconds)
"""
import json, re, sys, wave
from pathlib import Path
import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig
from piper.phonemize_espeak import EspeakPhonemizer

LIGHT = {'ɾ': 't', 'ɹ': 'ɾ', 'ɫ': 'l', 'ː': '', 'ɚ': 'eɾ', 'ɝ': 'eɾ', 'ɜ': 'e', 'ᵻ': 'i', 'ɐ': 'a', 'ɪ': 'i', 'ʊ': 'u', 'æ': 'a', 'ʌ': 'a', 'ɑ': 'a', 'ɒ': 'o', 'ɔ': 'o', 'ə': 'e', 'ɛ': 'e', 'ʔ': '', '̩': '', 'ɡ': 'ɡ'}
MEDIUM = {**LIGHT, 'ð': 'd', 'θ': 't', 'z': 's', 'ʒ': 'ʃ'}
STRONG = {**MEDIUM, 'v': 'b', 'h': 'x'}
# The clearest of the four, and the one the videos use.
# No tapped r here: an English-trained voice only knows that sound as the quick American "t" (so "here" came out as
# "hit"). What is left is what such a voice can say cleanly: d and t for "th", s for z, a clear t, and "es" before s + consonant.
CLEAR = {'ɾ': 't', 'ɫ': 'l', 'ð': 'd', 'θ': 't', 'z': 's', 'ʊ': 'u'}
# Spanish sounds an English-trained voice has never met, swapped for its nearest ones.
ES_FOR_ENGLISH_VOICE = {'β': 'b', 'ɣ': 'ɡ', 'x': 'h', 'ɲ': 'nj', 'ʝ': 'j', 'r': 'ɹ', 'ɾ': 'ɹ', 'ʎ': 'j', 'o': 'oʊ', 'a': 'ɑ', 'e': 'ɛ'}
# For a real Spanish voice: every English sound becomes the one a Spanish speaker would use, so the voice only ever says
# sounds it knows. This is what gives a true (generic) Spanish accent: tapped r, five pure vowels, b for v, a soft j for h.
NATIVE = {'ɾ': 't', 'ɹ': 'ɾ', 'ɫ': 'l', 'ː': '', 'ʔ': '', '̩': '', 'ɚ': 'eɾ', 'ɝ': 'eɾ', 'ɜ': 'e', 'ᵻ': 'i', 'ɐ': 'a', 'ɪ': 'i', 'ʊ': 'u', 'æ': 'a', 'ʌ': 'a', 'ɑ': 'a', 'ɒ': 'o', 'ɔ': 'o', 'ə': 'e', 'ɛ': 'e',
          'ð': 'd', 'θ': 's', 'z': 's', 'v': 'b', 'h': 'x', 'ʃ': 'tʃ', 'ʒ': 'ʝ', 'ŋ': 'n'}
# The one the videos use, with a real Spanish voice: a generic Spanish accent that stays easy to follow. It keeps
# "sh" and the English "j", which a listener needs, and takes the rest from NATIVE.
SPANISH = {**NATIVE, 'ʃ': 'ʃ', 'ʒ': 'ʒ'}
# For a voice from Spain: the same, but "th" stays as the Castilian z sound, which that voice has.
CASTILIAN = {**SPANISH, 'θ': 'θ'}
LEVELS = {'clear': CLEAR, 'light': LIGHT, 'medium': MEDIUM, 'strong': STRONG, 'native': NATIVE, 'spanish': SPANISH, 'castilian': CASTILIAN}
VOWELS = set('aeiouɪʊæʌɑɒɔəɛɜɚɝᵻɐ')
PUNCT = set(' ,.;:!?')

def accent(ph, table, level):
    if level == 'native': ph = list(''.join(ph).replace('dʒ', 'ʝ'))
    if level in ('native', 'spanish', 'castilian'): ph = list(''.join(ph).replace('ŋɡ', 'nɡ'))
    out = []
    for i, p in enumerate(ph):
        # "estart", "espanish": Spanish has no word-initial s + consonant.
        if level != 'light' and p == 's':
            j = i - 1
            while j >= 0 and ph[j] in 'ˈˌ': j -= 1
            start = j < 0 or ph[j] in PUNCT
            k = i + 1
            if start and k < len(ph) and ph[k] not in VOWELS and ph[k] not in PUNCT and ph[k] not in 'ˈˌ': out.append('e')
        out.extend(table.get(p, p))
    return out

class Dina:
    def __init__(self, model, level='spanish', speaker=None):
        self.speaker = speaker
        self.noise, self.noise_w = 0.6, 0.8  # how much the tone and the timing vary; lower is steadier
        self.voice = PiperVoice.load(model)
        self.es = 'es-419'  # Spanish words are always phonemized as Latin American Spanish
        self.native_spanish = str(self.voice.config.espeak_voice).startswith('es')
        self.ph = EspeakPhonemizer()
        self.level, self.table = level, LEVELS[level]
        self.ids = self.voice.config.phoneme_id_map
        self.rate = self.voice.config.sample_rate

    def phonemes(self, text):
        """[(phonemes of one sentence)] with [es]…[/es] spans said as Spanish."""
        parts = re.split(r'\[es\](.*?)\[/es\]', text)
        flat = []
        for n, part in enumerate(parts):
            if not part.strip(): continue
            spanish = n % 2 == 1
            for sent in self.ph.phonemize(self.es if spanish else 'en-us', part):
                seq = sent if spanish else accent(sent, self.table, self.level)
                if spanish and not self.native_spanish: seq = [q for p in seq for q in ES_FOR_ENGLISH_VOICE.get(p, p)]
                if spanish and seq and seq[-1] in '.':  # a Spanish word inside an English sentence does not end it
                    seq = seq[:-1] + ([' '] if n < len(parts) - 1 and parts[n + 1].strip() and parts[n + 1].lstrip()[0] not in ',.;:!?' else [])
                flat.extend(seq)
                if not spanish: flat.append(' ')
        text_ph = ''.join(flat)
        text_ph = re.sub(r'\s+([,.;:!?])', r'\1', text_ph)
        return [list(s.strip()) for s in re.findall(r'[^.!?]+[.!?]?', text_ph) if s.strip()]

    def say(self, text, path, speed=1.0):
        cfg = SynthesisConfig(length_scale=1.0 / speed, noise_scale=self.noise, noise_w_scale=self.noise_w, **({'speaker_id': self.speaker} if self.speaker is not None else {}))
        chunks = []
        for sent in self.phonemes(text):
            sent = [p for p in sent if p in self.ids]
            audio = self.voice.phoneme_ids_to_audio(self.voice.phonemes_to_ids(sent), cfg)
            a = np.asarray(audio).reshape(-1)
            if a.dtype != np.int16: a = (np.clip(a, -1, 1) * 32767).astype(np.int16)
            chunks += [a, np.zeros(int(self.rate * 0.22), dtype=np.int16)]
        pcm = np.concatenate(chunks[:-1]) if chunks else np.zeros(1, dtype=np.int16)
        with wave.open(str(path), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(self.rate); w.writeframes(pcm.tobytes())
        return len(pcm) / self.rate

def bark(path, rate=22050):
    """Toby's bark: two quick yips from a small dog, made from scratch (no recording is used)."""
    rng = np.random.default_rng(7)
    def yip(dur, f_start, f_end, gain):
        n = int(rate * dur); t = np.arange(n) / rate
        f0 = f_start * (f_end / f_start) ** (t / dur) * (1 + 0.02 * np.sin(2 * np.pi * 38 * t))
        phase = 2 * np.pi * np.cumsum(f0) / rate
        tone = np.zeros(n)
        for k in range(1, 12):
            fk = f0 * k
            # a bright, slightly nasal mouth shape: energy around 1.3 kHz and 2.9 kHz
            shape = 0.25 + np.exp(-((fk - 1300) / 420) ** 2) + 0.7 * np.exp(-((fk - 2900) / 600) ** 2)
            tone += shape / k ** 0.6 * np.sin(k * phase + rng.uniform(0, 6.28))
        noise = rng.normal(0, 1, n); noise = np.convolve(noise, np.ones(4) / 4, mode='same') - np.convolve(noise, np.ones(40) / 40, mode='same')
        env = np.minimum(1, t / 0.006) * np.exp(-np.maximum(0, t - dur * 0.45) / (dur * 0.2))
        y = (tone / np.max(np.abs(tone)) + 0.22 * noise / np.max(np.abs(noise))) * env
        return np.tanh(1.6 * y) * gain
    gap = np.zeros(int(rate * 0.085))
    y = np.concatenate([np.zeros(int(rate * 0.02)), yip(0.12, 820, 560, 0.8), gap, yip(0.14, 900, 540, 1.0), np.zeros(int(rate * 0.05))])
    pcm = (y / np.max(np.abs(y)) * 0.62 * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm.tobytes())

if __name__ == '__main__':
    model, lines_file, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    level = sys.argv[sys.argv.index('--level') + 1] if '--level' in sys.argv else 'spanish'
    speed = float(sys.argv[sys.argv.index('--speed') + 1]) if '--speed' in sys.argv else 1.0
    out.mkdir(parents=True, exist_ok=True)
    bark(out / 'bark.wav')
    speaker = int(sys.argv[sys.argv.index('--speaker') + 1]) if '--speaker' in sys.argv else None
    dina = Dina(model, level, speaker)
    if '--steady' in sys.argv: dina.noise, dina.noise_w = 0.42, 0.55  # calm and even, like a phone assistant
    lines = json.loads(Path(lines_file).read_text())
    durations = {k: round(dina.say(v, out / f'{k}.wav', speed), 3) for k, v in lines.items()}
    (out / 'durations.json').write_text(json.dumps(durations, indent=1))
    print(f'{len(durations)} lines, {sum(durations.values()):.0f}s of speech, accent {level}')
