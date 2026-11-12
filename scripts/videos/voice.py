"""Dina's voice for the how-to videos: English spoken with an Argentinian accent.

The voice is Piper's free Argentinian voice (es_AR "daniela", trained on real Argentinian speakers). Left alone it
would read English with Spanish spelling rules, which is hard to follow. Instead each line is turned into English
sounds first, then those sounds are swapped for the nearest ones an Argentinian speaker uses (a tapped r, "d" for
"th", pure vowels, an "e" before s + consonant), and the Argentinian voice says the result. Spanish words in a line,
written as [es]hola[/es], are said as real Spanish.

Usage: voice.py <model.onnx> <lines.json> <outDir> [--level light|medium|strong]
  lines.json: {"id": "text", ...}  ->  <outDir>/<id>.wav and <outDir>/durations.json (seconds)
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
LEVELS = {'clear': CLEAR, 'light': LIGHT, 'medium': MEDIUM, 'strong': STRONG}
VOWELS = set('aeiouɪʊæʌɑɒɔəɛɜɚɝᵻɐ')
PUNCT = set(' ,.;:!?')

def accent(ph, table, level):
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
    def __init__(self, model, level='clear'):
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
        cfg = SynthesisConfig(length_scale=1.0 / speed, noise_scale=0.6, noise_w_scale=0.8)
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

if __name__ == '__main__':
    model, lines_file, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    level = sys.argv[sys.argv.index('--level') + 1] if '--level' in sys.argv else 'clear'
    speed = float(sys.argv[sys.argv.index('--speed') + 1]) if '--speed' in sys.argv else 1.0
    out.mkdir(parents=True, exist_ok=True)
    dina = Dina(model, level)
    lines = json.loads(Path(lines_file).read_text())
    durations = {k: round(dina.say(v, out / f'{k}.wav', speed), 3) for k, v in lines.items()}
    (out / 'durations.json').write_text(json.dumps(durations, indent=1))
    print(f'{len(durations)} lines, {sum(durations.values()):.0f}s of speech, accent {level}')
