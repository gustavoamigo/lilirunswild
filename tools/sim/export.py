"""Turn the captures in out/ into what the game plays: src/moves.js.

The game's Lili is not the simulated skeleton's shape (her body is longer for her legs), so positions do not
carry over. Angles do. Each frame holds how her body is tilted and bent, how far her hips have sunk, which paws
are down, and for each leg the angle of its three bones and its paw, measured against the half of the body the
leg hangs from. At a stand every body value is zero and the leg angles are those of the standing skeleton.

    python export.py
"""
import json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
STEP = 2                     # every second frame: 50 a second
UNITS = 84.3                 # game units to a metre, by hip height
LEGS = [('fore', 'l', ['sho', 'elb', 'car', 'mcp', 'ftip'], 'fpaw'), ('fore', 'r', ['sho', 'elb', 'car', 'mcp', 'ftip'], 'fpaw'),
        ('hind', 'l', ['hip', 'sti', 'hock', 'mtp', 'htip'], 'hpaw'), ('hind', 'r', ['hip', 'sti', 'hock', 'mtp', 'htip'], 'hpaw')]


def move(case, gait=False):
  d = json.load(open(f'{HERE}/out/{case}.json'))
  if gait:                     # a stride starts anywhere, so it is measured against the standing skeleton: the leap's first frame
    d0 = json.load(open(f'{HERE}/out/stand.json'))
    d['frames'] = [[v for k in d['keys'] for v in d0['frames'][0][d0['keys'].index(k) * 2:][:2]]] + d['frames']; d['on'] = [d0['on'][0]] + d['on']
  F = np.array(d['frames']).reshape(len(d['frames']), -1, 2)
  at = lambda k: F[:, d['keys'].index(k)]
  up = lambda a, b: np.unwrap(np.arctan2(b[:, 1] - a[:, 1], b[:, 0] - a[:, 0]))        # how far a forward-pointing piece is tipped nose up
  down = lambda a, b: np.unwrap(np.arctan2(b[:, 0] - a[:, 0], a[:, 1] - b[:, 1]))      # how far a hanging bone is swung forward
  thorax, pelvis = up(at('spine'), at('neck')), up(at('hipc'), at('spine'))
  thorax, pelvis = thorax - thorax[0], pelvis - pelvis[0]
  cols = [(thorax + pelvis) / 2, (pelvis - thorax) / 2, (at('hipc')[:, 1] - at('hipc')[0, 1]) * UNITS,
          [sum(1 << i for i, (_, s, _, paw) in enumerate(LEGS) if f'{paw}_{s}' in on) for on in d['on']]]
  for end, s, chain, _ in LEGS:
    body = thorax if end == 'fore' else pelvis
    p = [at(f'{k}_{s}') for k in chain]
    cols += [down(p[i], p[i + 1]) - body for i in range(3)]
    toe = up(p[3], p[4])
    cols.append(toe - toe[0] - body)
  if gait:
    f = np.array(cols).T[1:]; n = len(f)
    # the tail hangs from a spring in the simulation and nothing drives it: how far it swings up against the pelvis
    # is what her running does to it
    tail = up(at('tail_tip'), at('tail')) - pelvis; tail = -(tail - tail[0])[1:]
    f[:, [0, 1]] = (f[:, [0, 1]] + np.pi) % (2 * np.pi) - np.pi
    if case == 'trot':
      # A trot's second half is its first half with left and right changed over. The simulated one is nearly so,
      # not exactly (one diagonal lands a little later and tips her further), and in the game the difference
      # reads as a limp. So each half is averaged with the other half, sides changed over.
      h = n // 2; g = np.roll(f, -h, axis=0).copy(); g[:, 4:8], g[:, 8:12], g[:, 12:16], g[:, 16:20] = g[:, 8:12].copy(), g[:, 4:8].copy(), g[:, 16:20].copy(), g[:, 12:16].copy()
      bits = f[:, 3].astype(int); gb = g[:, 3].astype(int); gb = ((gb & 1) << 1) | ((gb & 2) >> 1) | ((gb & 4) << 1) | ((gb & 8) >> 1)
      f = (f + g) / 2; f[:, 3] = bits | gb; tail = (tail + np.roll(tail, -h)) / 2
    down = []                  # for each paw: where in the stride it comes down, and for what share of it it stays
    for i in range(4):
      on = [(int(v) >> i) & 1 for v in f[:, 3]]
      runs = [(a, next(k for k in range(1, n + 1) if not (on[(a + k) % n] or on[(a + k + 1) % n]))) for a in range(n) if on[a] and not (on[a - 1] or on[a - 2])]
      a, k = max(runs, key=lambda r: r[1]); down.append([round(a / n, 3), round(k / n, 3)])
    return dict(dt=d['dt'], n=n, T=round(d['info']['T'], 3), v=round(float(d['info']['v']), 2), down=down, tail=[round(float(v), 3) for v in tail],
                f=[int(v) if j == 3 else round(float(v), 3) for row in f for j, v in enumerate(row)])
  f = np.array(cols).T[::STEP]
  return dict(dt=d['dt'] * STEP, takeoff=round(d['info']['takeoff'], 3), land=round(d['info']['land'], 3), n=len(f),
              f=[int(v) if j == 3 else round(float(v), 3) for row in f for j, v in enumerate(row)])


def bones():
  import dog
  P, L = dog.P, lambda a, b: math.dist(dog.P[a], dog.P[b])
  return dict(fore=[L('sho', 'elb'), L('elb', 'car'), L('car', 'mcp')], hind=[L('hip', 'sti'), L('sti', 'hock'), L('hock', 'mtp')],
              foreDrop=P['sho'][1] - P['mcp'][1], hindDrop=P['hip'][1] - P['mtp'][1],
              foreBack=P['sho'][0] - P['mcp'][0], hindBack=P['hip'][0] - P['mtp'][0])


if __name__ == '__main__':
  out = ['// Written by tools/sim/export.py from the simulated skeleton (tools/sim). Do not edit: run it again.',
         '// Each frame is STRIDE numbers: tilt, bend of the back, sink of the hips, paws down (a bit each: fl fr hl hr),',
         '// then for each leg the angles of its three bones and its paw against the body. See docs/tech.md.',
         'export const STRIDE = 20;',
         f'export const BONES = {json.dumps({k: [round(x, 4) for x in v] if isinstance(v, list) else round(v, 4) for k, v in bones().items()})};   // metres, standing',
         'export const MOVES = {']
  for case in ('stand', 'high'):
    m = move(case)
    out.append(f'  {case}: {json.dumps(m, separators=(",", ":"))},')
  out.append('};')
  out += ['// One stride of each gait, to be played round and round. down: for each paw (fl fr hl hr), where in the stride',
          '// it comes down and for what share of the stride it stays. T: seconds a stride took, v: metres a second.',
          '// tail: how far the tail has swung up from where it hangs at a stand, each frame.',
          'export const GAITS = {']
  for case in ('trot', 'gallop'):
    out.append(f'  {case}: {json.dumps(move(case, True), separators=(",", ":"))},')
  out.append('};')
  open(f'{HERE}/../../src/moves.js', 'w').write('\n'.join(out) + '\n')
  print('wrote src/moves.js')
