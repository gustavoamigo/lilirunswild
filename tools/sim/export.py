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


def move(case):
  d = json.load(open(f'{HERE}/out/{case}.json'))
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
  open(f'{HERE}/../../src/moves.js', 'w').write('\n'.join(out) + '\n')
  print('wrote src/moves.js')
