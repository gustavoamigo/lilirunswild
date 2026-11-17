"""Make the clips of everything the game says out loud (see "The voice" in docs/tech.md).

The lines are the `say:` and `praise:` of every job in missions/ and the game's own (`SAY` and `PRAISE` in
src/main.js). Each becomes sounds/voice/<its words>.mp3, said by Kokoro (a speech model that runs on this machine,
set up in ~/lili-voice), and sounds/voice/lines.json lists the file of each line. Clips of lines no longer said are
removed. Run it again after changing or adding a line.

  ~/lili-voice/.venv/bin/python tools/voice.py [--voice=af_heart] [--speed=0.9] [--out=DIR] [--only=N] [--check]

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


def lines():
  out = []
  with open(f'{ROOT}/missions/list.txt') as f:
    jobs = [s.strip() for s in f if s.strip() and not s.startswith('#')]
  for name in jobs:
    with open(f'{ROOT}/missions/{name}.md') as f:
      head = f.read().split('---')[1]
    out += re.findall(r'^\s*(?:say|praise):\s*"([^"]+)"', head, re.M)
  with open(f'{ROOT}/src/main.js') as f:
    src = f.read()
  for const in ('SAY', 'PRAISE'):
    body = re.search(rf'^const {const} = [\[{{](.*?)[\]}}];', src, re.M | re.S)
    if not body: sys.exit(f'src/main.js: no {const}')
    out += re.findall(r"'([^']+)'", body.group(1))
  return list(dict.fromkeys(out))


def slug(text):
  return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60].strip('-')


NUMBERS = {'1': 'one', '2': 'two', '3': 'three', '5': 'five', '10': 'ten'}


def words(text):                                         # as the recognizer would write them: no marks, "3" for "three"
  return [NUMBERS.get(w, w) for w in re.sub(r'[^a-z0-9 ]+', ' ', text.lower().replace('lili', 'lily')).split()]


def make(out, todo, voice, speed):
  import numpy as np
  from kokoro import KPipeline
  pipe = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')
  os.makedirs(out, exist_ok=True)
  table = {}
  for text in todo:
    said = text
    for a, b in SPOKEN.items(): said = said.replace(a, b)
    x = np.concatenate([r.audio.numpy() for r in pipe(said, voice=voice, speed=speed)])
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
    print(f'{len(x) / RATE:5.2f} s  {name}.mp3', flush=True)
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
  todo = lines()
  only = arg('only')
  if only: todo = todo[:int(only)]
  if '--check' in sys.argv: check(out, todo)
  else: make(out, todo, arg('voice', 'af_heart'), float(arg('speed', '0.9')))


if __name__ == '__main__':
  main()
