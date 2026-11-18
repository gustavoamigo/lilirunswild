"""Make the clips of everything the game says out loud (see "The voice" in docs/tech.md).

The lines are the `say:` and `praise:` of every job in missions/ and the game's own (`SAY` and `PRAISE` in
src/main.js). Each becomes sounds/voice/<its words>.mp3, said by Kokoro (a speech model that runs on this machine,
set up in ~/lili-voice), and sounds/voice/lines.json lists the file of each line. A job's own `say:` is said by
whoever asks for it (its `from:`, with their `voice` in world/people.js); everything else by the narrator. A child's
voice is an adult one of the model raised in pitch, formants with it (`kid:<voice>:<factor>`). Clips of lines no
longer said are removed. Run it again after changing or adding a line.

  ~/lili-voice/.venv/bin/python tools/voice.py [--voice=af_bella (the narrator)] [--speed=0.9] [--out=DIR] [--only=N] [--check]

--out=DIR writes somewhere else (to compare voices); --only=N makes the first N lines only.
--check does not make anything: a speech recognizer writes down what each clip says and the lines that differ from
their words are listed (nobody can listen to them from a script).
"""
import glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RATE = 24000
SPOKEN = {'Lili': 'Lily'}                                # how a word is written for the model, where it would say it wrong


def arg(name, default=None):
  return next((a[len(name) + 3:] for a in sys.argv if a.startswith(f'--{name}=')), default)


def askers():
  with open(f'{ROOT}/world/people.js') as f:
    return dict(re.findall(r"id: '([\w-]+)', voice: '([^']+)'", f.read()))


def lines(narrator):
  """[(words, voice)]: who says what."""
  out, who = [], askers()
  with open(f'{ROOT}/missions/list.txt') as f:
    jobs = [s.strip() for s in f if s.strip() and not s.startswith('#')]
  for name in jobs:
    with open(f'{ROOT}/missions/{name}.md') as f:
      head = f.read().split('---')[1]
    asker = re.search(r'^from:\s*([\w-]+)', head, re.M)
    if asker and asker.group(1) not in who: sys.exit(f'{name}: no one called {asker.group(1)} in world/people.js')
    top = re.search(r'^say:\s*"([^"]+)"', head, re.M)
    if top: out.append((top.group(1), who[asker.group(1)] if asker else narrator))
    out += [(t, narrator) for t in re.findall(r'^\s+say:\s*"([^"]+)"', head, re.M)]
    out += [(t, narrator) for t in re.findall(r'^\s*praise:\s*"([^"]+)"', head, re.M)]
  with open(f'{ROOT}/src/main.js') as f:
    src = f.read()
  for const in ('SAY', 'PRAISE'):
    body = re.search(rf'^const {const} = [\[{{](.*?)[\]}}];', src, re.M | re.S)
    if not body: sys.exit(f'src/main.js: no {const}')
    out += [(t, narrator) for t in re.findall(r"'([^']+)'", body.group(1))]
  out = list(dict.fromkeys(out))
  twice = {t for t, _ in out if sum(1 for q, _ in out if q == t) > 1}
  if twice: sys.exit(f'said in two voices: {twice}')
  return out


def slug(text):
  return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60].strip('-')


NUMBERS = {'1': 'one', '2': 'two', '3': 'three', '5': 'five', '10': 'ten'}


def words(text):                                         # as the recognizer would write them: no marks, "3" for "three"
  return [NUMBERS.get(w, w) for w in re.sub(r'[^a-z0-9 ]+', ' ', text.lower().replace('lili', 'lily')).split()]


def shift(x, k):                                         # higher by k, formants with it (a smaller person)
  import numpy as np
  y = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-af', f'rubberband=pitch={k}:formant=shifted',
                      '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-'], input=x.astype('float32').tobytes(), capture_output=True, check=True).stdout
  return np.frombuffer(y, dtype=np.float32).copy()


def make(out, todo, speed):
  import numpy as np
  from kokoro import KPipeline
  pipes = {}
  os.makedirs(out, exist_ok=True)
  table = {}
  for text, spec in todo:
    voice, k = (spec.split(':')[1], float(spec.split(':')[2])) if spec.startswith('kid:') else (spec, 1)
    pipe = pipes.get(voice[0]) or pipes.setdefault(voice[0], KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M'))
    said = text
    for a, b in SPOKEN.items(): said = said.replace(a, b)
    x = np.concatenate([r.audio.numpy() for r in pipe(said, voice=voice, speed=speed)])
    if k != 1: x = shift(x, k)
    loud = np.flatnonzero(np.abs(x) > 0.02)              # the silence before and after goes
    x = x[max(0, loud[0] - RATE // 50):loud[-1] + RATE // 10]
    x = x * (0.16 / np.sqrt(np.mean(x[np.abs(x) > 0.02] ** 2)))   # every line as loud as the next
    x = x * min(1, 0.89 / np.abs(x).max())
    n = RATE // 25; x[-n:] *= np.linspace(1, 0, n)
    name = slug(text)
    if name in table.values(): sys.exit(f'two lines would be the same file: {name}')
    table[text] = name
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-b:a', '48k', f'{out}/{name}.mp3'],
                   input=x.astype('float32').tobytes(), check=True)
    print(f'{len(x) / RATE:5.2f} s  {spec:20} {name}.mp3', flush=True)
  for f in glob.glob(f'{out}/*.mp3'):
    if os.path.basename(f)[:-4] not in table.values(): os.remove(f); print('removed', os.path.basename(f))
  with open(f'{out}/lines.json', 'w') as f:
    json.dump(table, f, indent=1); f.write('\n')


def check(out, todo):
  import numpy as np
  from faster_whisper import WhisperModel
  ear = WhisperModel('small.en', device='cpu', compute_type='int8')
  with open(f'{out}/lines.json') as f:
    table = json.load(f)
  todo = [t for t, _ in todo]
  bad = [t for t in todo if t not in table] + [t for t in table if t not in todo]
  for text in bad: print('NOT IN STEP WITH THE GAME:', text)
  for text, name in table.items():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{out}/{name}.mp3', '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    heard = ' '.join(s.text.strip() for s in ear.transcribe(x, beam_size=5)[0])
    same = words(heard) == words(text)
    if not same: bad.append(text)
    print(f"{'ok  ' if same else 'DIFF'} {len(x) / 16000:5.2f} s peak {np.abs(x).max():.2f} | {text} | {heard}", flush=True)
  print(f'{len(table)} clips, {len(bad)} to look at')


def main():
  out = arg('out', f'{ROOT}/sounds/voice')
  todo = lines(arg('voice', 'af_bella'))
  only = arg('only')
  if only: todo = todo[:int(only)]
  if '--check' in sys.argv: check(out, todo)
  else: make(out, todo, float(arg('speed', '0.9')))


if __name__ == '__main__':
  main()
