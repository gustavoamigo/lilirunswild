"""Find a steady gait for the skeleton in dog.py and record one stride of it.

As in jump.py she is driven by joint targets through servos with a dog's strength. Here each joint's target is a
repeating curve (a mean and a few harmonics over the stride), and the four legs run the same curve at different
points of the stride: that offset is what makes a trot a trot and a gallop a gallop. A cross-entropy search moves the
curves until she keeps the asked speed for several strides without falling, each stride like the one before, for the
least effort.

  python gait.py trot             # search, write out/trot.json and out/trot.png
"""
import json, sys, os
import numpy as np
import mujoco
from multiprocessing import Pool
import dog
from jump import model, strip, CTRL_DT, GROUPS, NJ, LO, HI

H = 3                                # harmonics
NC = 1 + 2 * H                       # numbers per curve
STRIDES = 7                          # simulated; the first WARM do not count
WARM = 3

# v the speed asked for (m/s), T a first guess at the stride time, lag where each leg is in the stride (fl fr hl hr),
# free whether the search may move those, axial how many times the back and neck repeat in a stride, duty the share
# of the stride a paw may spend on the ground, Tmin the shortest stride allowed, bounce how far her middle should rise and fall (m, standard deviation;
# without it she is asked to stay level)
CASES = dict(
    trot=dict(v=2.4, T=0.42, lag=[0.0, 0.5, 0.5, 0.0], free=False, axial=2, duty=(0.25, 0.5), Tmin=0.36, bounce=0.015),
    gallop=dict(v=5.5, T=0.36, lag=[0.5, 0.62, 0.0, 0.12], free=True, axial=1, duty=(0.15, 0.45), Tmin=0.32),
)

# --v=3.5 asks for another speed, so a hard gait can be reached in steps from an easier one (worker processes read
# the same command line); --from=trot starts from another case's result
for _a in sys.argv:
    if _a.startswith('--v='):
        for _k in CASES.values(): _k['v'] = float(_a[4:])

def prior(case):
    #               scap   sho    elb    car    hip    sti    hock  spine  neck   head
    c = np.zeros((NC, NJ))
    if case == 'trot':
        c[0] = [0.00,  0.00,  0.25, -0.30,  0.05, -0.30,  0.30,  0.00,  0.00, 0.00]     # mean
        c[1] = [0.10,  0.32,  0.00,  0.00,  0.34,  0.00,  0.00,  0.00,  0.00, 0.00]     # cos: forward as the paw comes down
        c[2] = [0.00,  0.00, -0.35,  0.45,  0.00,  0.35, -0.30,  0.00,  0.00, 0.00]     # sin: folded as it swings through
    else:
        c[0] = [0.00,  0.05,  0.35, -0.40,  0.15, -0.40,  0.40,  0.05,  0.05, 0.00]
        c[1] = [0.18,  0.55,  0.00,  0.00,  0.65,  0.00,  0.00,  0.28,  0.00, 0.00]
        c[2] = [0.00,  0.00, -0.50,  0.60,  0.00,  0.50, -0.45,  0.00,  0.00, 0.00]
    k = CASES[case]
    return np.concatenate([c.ravel(), [np.log(k['T'])], k['lag']])

NP = NC * NJ + 5
_FORE = np.array([g in dog.FORE for g in GROUPS]); _HIND = np.array([g in dog.HIND for g in GROUPS])

def curves(x, case):
    k = CASES[case]
    c = x[:NC * NJ].reshape(NC, NJ); T = float(np.exp(np.clip(x[NC * NJ], np.log(k.get('Tmin', 0.25)), np.log(0.8))))
    lag = np.array(k['lag']) if not k['free'] else np.concatenate([[x[-4]], [x[-4] + np.clip(x[-3] - x[-4], 0.03, 0.5)], [0.0], [np.clip(x[-1], 0.03, 0.5)]])
    return c, T, lag

def angle(c, ph, col):
    """Target of the joints in columns col at stride phase ph (arrays of the same length)."""
    out = c[0, col].copy()
    for h in range(1, H + 1): out += c[2 * h - 1, col] * np.cos(2 * np.pi * h * ph) + c[2 * h, col] * np.sin(2 * np.pi * h * ph)
    return np.clip(out, LO[col], HI[col])

_A = None
def acts():
    global _A
    if _A is None:
        gi = {g: i for i, g in enumerate(GROUPS)}
        col = np.array([gi[a.split('_')[0]] for a in dog.ACT])
        # which leg's clock each actuator runs on: 0 fl, 1 fr, 2 hl, 3 hr, 4 the back and neck
        leg = np.array([4 if '_' not in a else (0 if a.split('_')[0] in dog.FORE else 2) + (a.endswith('_r')) for a in dog.ACT])
        _A = (col, leg)
    return _A

def rollout(x, case, record=False):
    m, d, _, _, paws, soft, q0, z0 = model()
    col, leg = acts(); k = CASES[case]; c, T, lag = curves(x, case)
    off = np.concatenate([lag, [lag[2]]])[leg]; mul = np.where(leg == 4, k['axial'], 1)
    mujoco.mj_resetData(m, d); d.qpos[:] = q0; d.qvel[0] = k['v']; mujoco.mj_forward(m, d)
    per = int(round(T / CTRL_DT)); n = per * STRIDES; sub = int(round(CTRL_DT / m.opt.timestep))
    effort = bad = tilt = bob = slip = 0.0; marks = []; frames = []; zs = []; fell = None; duty = np.zeros(4); names = ['fpaw_l', 'fpaw_r', 'hpaw_l', 'hpaw_r']
    for i in range(n):
        ph = (i / per + off) * mul
        ramp = min(1.0, i / (0.5 * per))                                        # ease in from standing
        d.ctrl[:] = ramp * angle(c, ph, col)
        for _ in range(sub): mujoco.mj_step(m, d)
        on = set()
        for j in range(d.ncon):
            b = m.geom_bodyid[d.contact[j].geom2] or m.geom_bodyid[d.contact[j].geom1]
            if b in paws: on.add(paws[b])
            elif b not in soft: bad += 1
        com = d.subtree_com[1]
        if com[2] < 0.62 * z0 or abs(d.qpos[2]) > 0.9: fell = i; break
        if i >= per * WARM:
            effort += float(np.sum((d.actuator_force / m.actuator_forcerange[:, 1]) ** 2)) * CTRL_DT
            tilt += d.qpos[2] ** 2 * CTRL_DT; bob += (com[2] - z0) ** 2 * CTRL_DT; zs.append(com[2])
            for j, nm in enumerate(names): duty[j] += nm in on
        if i % per == 0: marks.append((i, d.qpos[0], np.concatenate([d.qpos[1:], 0.05 * d.qvel]).copy()))
        if record and i >= per * (STRIDES - 2) and i < per * (STRIDES - 1): frames.append((dog.points(m, d), sorted(on), float(d.qpos[2]), [float(v) for v in com]))
    if fell is not None:
        J = 200 + 400 * (1 - fell / n)
        return (J, dict(J=J, fell=fell * CTRL_DT), frames) if record else J
    marks.append((n, d.qpos[0], np.concatenate([d.qpos[1:], 0.05 * d.qvel]).copy()))
    tt = (STRIDES - WARM) * T; v = (marks[-1][1] - marks[WARM][1]) / tt
    vs = [(marks[j + 1][1] - marks[j][1]) / T for j in range(WARM, STRIDES)]
    rep = float(np.mean([np.sum((marks[j + 1][2] - marks[j][2]) ** 2) for j in range(WARM, STRIDES)]))
    duty /= per * (STRIDES - WARM)
    J = 8 * (v - k['v']) ** 2 + 4 * float(np.var(vs)) + 3 * rep + 0.03 * effort / tt + 0.1 * bad + 30 * tilt / tt
    if 'bounce' in k: J += 400 * (np.mean(zs) - z0) ** 2 + 1e4 * (np.std(zs) - k['bounce']) ** 2       # stands tall, with a spring
    else: J += 400 * bob / tt
    J += 40 * float(np.sum(np.maximum(0, k['duty'][0] - duty) ** 2 + np.maximum(0, duty - k['duty'][1]) ** 2))       # every paw works, none drags
    J += 0.02 * float(np.sum(x[NC:NC * NJ] ** 2))
    info = dict(J=J, v=v, T=T, lag=[round(float(a), 3) for a in lag], rep=rep, effort=effort / tt, bad=bad, tilt=tilt / tt, duty=[round(float(a), 2) for a in duty], bounce=float(np.std(zs)))
    return (J, info, frames) if record else J

def _cost(a): return rollout(a[0], a[1])

def search(case, gens=150, pop=192, seed=0, x0=None):
    rng = np.random.default_rng(seed)
    mu = prior(case) if x0 is None else x0.copy()
    sig = np.concatenate([np.full(NJ, 0.08), np.full(2 * NJ, 0.1), np.full((NC - 3) * NJ, 0.04), [0.08], np.full(4, 0.04)])
    best, bx = 1e9, mu.copy()
    with Pool(16) as pool:
        for g in range(gens):
            xs = mu + sig * rng.standard_normal((pop, NP)); xs[0] = mu; xs[1] = bx
            Js = np.array(pool.map(_cost, [(x, case) for x in xs], chunksize=4))
            o = np.argsort(Js); el = xs[o[:pop // 8]]
            if Js[o[0]] < best: best, bx = Js[o[0]], xs[o[0]].copy()
            mu = 0.5 * mu + 0.5 * el.mean(0); sig = np.maximum(0.6 * sig + 0.4 * el.std(0), 0.006)
            if g % 10 == 0 or g == gens - 1: print(g, round(float(Js[o[0]]), 3), round(best, 3), flush=True)
    return bx

if __name__ == '__main__':
    case = sys.argv[1]; gens = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    here = os.path.dirname(os.path.abspath(__file__)); os.makedirs(here + '/out', exist_ok=True)
    f = f'{here}/out/{case}.npy'
    x0 = np.load(f) if os.path.exists(f) and '--fresh' not in sys.argv else None
    for a in sys.argv:
        if a.startswith('--from='): x0 = np.load(f'{here}/out/{a[7:]}.npy'); x0[-4:] = CASES[case]['lag']
    x = search(case, gens, x0=x0) if gens > 0 else (x0 if x0 is not None else prior(case))
    np.save(f, x)
    J, info, frames = rollout(x, case, True); print(info)
    if frames:
        strip(frames, f'{here}/out/{case}.png', every=max(1, len(frames) // 16))
        keys = sorted(frames[0][0])
        json.dump(dict(dt=CTRL_DT * 5, case=case, loop=True, info=info, chains=dog.CHAINS, keys=keys,
                       frames=[[round(v, 3) for k in keys for v in pt[k]] for pt, on, pitch, com in frames[::5]],
                       on=[on for pt, on, pitch, com in frames[::5]]), open(f'{here}/out/{case}.json', 'w'))
