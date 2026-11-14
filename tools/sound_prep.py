"""Bring a generated sound from ~/stable-audio/out into sounds/ (see "Generated sounds" in docs/tech.md).

Mono, the silence before and after trimmed, a short fade at the end, peak at -1 dB. A loop (--loop) is not trimmed:
its end is crossfaded into its start so it repeats without a click.

  ~/stable-audio/.venv/bin/python tools/sound_prep.py <seed> <name> [--loop] [--keep S]

<seed> picks the file (the number at the end of its name); <name> is the file written, sounds/<name>.wav.
--keep S keeps at most S seconds after trimming.
"""
import glob, os, sys
import numpy as np
import soundfile as sf

OUT = os.path.expanduser('~/stable-audio/out')
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
  seed, name = sys.argv[1], sys.argv[2]
  loop = '--loop' in sys.argv
  keep = next((float(a[7:]) for a in sys.argv if a.startswith('--keep=')), None)
  files = glob.glob(f'{OUT}/*_{seed}.wav')
  if len(files) != 1: sys.exit(f'{len(files)} files with seed {seed}')
  x, sr = sf.read(files[0]); x = x.mean(1) if x.ndim > 1 else x
  if loop:
    n = int(0.15 * sr)                                   # crossfade the last 0.15 s into the first
    fade = np.linspace(0, 1, n)
    x = np.concatenate([x[n:-n], x[-n:] * (1 - fade) + x[:n] * fade])
  else:
    env = np.abs(x) > np.abs(x).max() * 10 ** (-40 / 20)   # louder than -40 dB below the peak
    a, b = np.argmax(env), len(x) - np.argmax(env[::-1])
    x = x[max(0, a - int(0.01 * sr)):min(len(x), b + int(0.05 * sr))]
    if keep: x = x[:int(keep * sr)]
    n = min(len(x), int(0.03 * sr)); x[-n:] *= np.linspace(1, 0, n)
  x = x / np.abs(x).max() * 10 ** (-1 / 20)
  path = f'{HERE}/../sounds/{name}.wav'
  sf.write(path, x, sr, subtype='PCM_16')
  print(f'{os.path.basename(files[0])} -> sounds/{name}.wav, {len(x) / sr:.2f} s')


if __name__ == '__main__':
  main()
