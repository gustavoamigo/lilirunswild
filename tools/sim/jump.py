"""Find a jump for the skeleton in dog.py and record it.

The dog is driven by joint targets through servos with a real dog's torque limits, so what she does has to be
physically possible: she needs the ground to push on, turns in the air only as the take-off set her turning, and has
to catch herself on landing. The targets are knots over time; a cross-entropy search moves them until the leap has the
asked height and speed, lands on its paws and costs the least effort.

  python jump.py stand            # search, write out/stand.json and out/stand.png
"""
import json, sys, os
import numpy as np
import mujoco
from multiprocessing import Pool
import dog

GROUPS = dog.FORE + dog.HIND + dog.AXIAL                      # one target curve each; left and right legs share theirs
NJ = len(GROUPS)
LO = np.array([dog.J[g][0] for g in GROUPS]); HI = np.array([dog.J[g][1] for g in GROUPS])
CTRL_DT = 0.002

# what is asked of each leap: v0 the speed she arrives with, vx the speed she leaves the ground with, rise of her middle,
# crouch how far her middle must sink first (a high jump is wound up from low down), tip how far she may rear (radians)
CASES = dict(
    stand=dict(v0=0.0, vx=2.6, rise=0.26, T=1.55),
    high=dict(v0=0.0, vx=2.2, rise=0.62, T=1.95, crouch=0.13, tip=1.25),
)

def prior(case):
    """A first guess: gather, lift the front, drive off the hind legs, tuck, reach, catch. Rows are knots."""
    #        scap   sho    elb    car    hip    sti    hock  spine  neck   head
    k = [
        (0.20, [0.00, -0.25, 0.55, 0.00,  0.55, -0.75, 0.65,  0.15, -0.30, 0.10]),   # gather: sink, hind paws under
        (0.10, [0.05, -0.10, 0.35, 0.05,  0.70, -0.90, 0.75,  0.10,  0.00, 0.10]),   # forelegs push the front up
        (0.11, [0.00, -0.30, 1.30, -1.3, -0.60,  0.30, -0.1, -0.20,  0.20, 0.00]),   # hind legs drive, forelegs fold
        (0.14, [0.00, -0.30, 1.50, -1.6, -0.70,  0.10, 0.20, -0.15,  0.10, 0.00]),   # flight: hind legs trail
        (0.14, [0.15,  0.40, 0.60, -0.6,  0.10, -0.80, 0.80,  0.05,  0.00, 0.10]),   # reach with the forelegs
        (0.12, [0.20,  0.60, -0.1, 0.10,  0.70, -1.10, 1.00,  0.25, -0.10, 0.10]),   # forelegs down, hind legs coming under
        (0.12, [-0.1, -0.20, 0.50, 0.10,  0.90, -0.90, 0.80,  0.30, -0.10, 0.00]),   # forelegs give, hind paws land ahead
        (0.16, [0.00,  0.00, 0.20, 0.00,  0.40, -0.50, 0.40,  0.10,  0.00, 0.00]),   # rise
        (0.25, [0.00,  0.00, 0.00, 0.00,  0.00,  0.00, 0.00,  0.00,  0.00, 0.00]),   # stand
    ]
    if CASES[case].get('crouch'):
        k[0] = (0.34, [0.00, -0.50, 1.05, 0.05,  1.00, -1.40, 1.30,  0.25, -0.40, 0.20])   # right down on her haunches, chest low
        k[1] = (0.12, [0.05, -0.20, 0.50, 0.05,  1.05, -1.45, 1.35,  0.15,  0.00, 0.10])
    return np.concatenate([np.log([r[0] for r in k]), np.array([r[1] for r in k]).ravel(), [0.03, 0.03]])

NK = 9
NP = NK + NK * NJ + 2

def targets(x, T):
    """The target angle of every group at every control tick."""
    dt = np.exp(np.clip(x[:NK], np.log(0.06), np.log(0.5))); t = np.concatenate([[0], np.cumsum(dt)])
    v = np.vstack([np.zeros(NJ), np.clip(x[NK:NK + NK * NJ].reshape(NK, NJ), LO, HI)])
    ts = np.arange(0, T, CTRL_DT); out = np.empty((len(ts), NJ))
    m = np.gradient(v, t, axis=0); m[0] = 0; m[-1] = 0                          # Catmull-Rom tangents
    i = np.clip(np.searchsorted(t, ts, side='right') - 1, 0, NK - 1)
    h = (t[i + 1] - t[i])[:, None]; s = np.clip((ts - t[i])[:, None] / h, 0, 1)
    out = (2*s**3 - 3*s**2 + 1) * v[i] + (s**3 - 2*s**2 + s) * h * m[i] + (-2*s**3 + 3*s**2) * v[i+1] + (s**3 - s**2) * h * m[i+1]
    out[ts >= t[-1]] = v[-1]
    return np.clip(out, LO, HI), np.clip(x[-2:], 0, 0.08)

_M = None
def model():
    global _M
    if _M is None:
        m, d = dog.make()
        gi = {g: i for i, g in enumerate(GROUPS)}
        col = np.array([gi[a.split('_')[0]] for a in dog.ACT])
        lag = np.array([1 if a.endswith('_r') else 0 for a in dog.ACT]) * np.array([1 if a.split('_')[0] in dog.FORE else 2 if a.split('_')[0] in dog.HIND else 0 for a in dog.ACT])
        paws = {m.geom_bodyid[g]: n for g in range(m.ngeom) for n in [m.body(m.geom_bodyid[g]).name] if n[:4] in ('fpaw', 'hpaw')}
        soft = {m.geom_bodyid[g] for g in range(m.ngeom) if m.body(m.geom_bodyid[g]).name[:5] in ('metac', 'metat')}
        for _ in range(800): mujoco.mj_step(m, d)                               # settle onto her paws
        _M = (m, d, col, lag, paws, soft, d.qpos.copy(), float(d.subtree_com[1][2]))
    return _M

def rollout(x, case, record=False):
    m, d, col, lag, paws, soft, q0, z0 = model()
    c = CASES[case]; tg, delay = targets(x, c['T'])
    mujoco.mj_resetData(m, d); d.qpos[:] = q0; d.qvel[0] = c['v0']; mujoco.mj_forward(m, d)
    n = len(tg); sub = int(round(CTRL_DT / m.opt.timestep))
    shift = np.array([0, int(delay[0] / CTRL_DT), int(delay[1] / CTRL_DT)])[lag]
    effort = 0.0; bad = 0.0; tip = 0.0; low = z0; air0 = air1 = None; apex = 0.0; vx_off = 0.0; frames = []; first = None; down = []
    for k in range(n):
        d.ctrl[:] = tg[np.maximum(k - shift, 0), col]
        for _ in range(sub): mujoco.mj_step(m, d)
        on = set()
        for i in range(d.ncon):
            b = m.geom_bodyid[d.contact[i].geom2] or m.geom_bodyid[d.contact[i].geom1]
            if b in paws: on.add(paws[b])
            elif b not in soft: bad += 1
        effort += float(np.sum((d.actuator_force / m.actuator_forcerange[:, 1]) ** 2)) * CTRL_DT
        com = d.subtree_com[1]; tip += max(0.0, abs(d.qpos[2]) - c.get('tip', 0.75)) * CTRL_DT
        if air0 is None: low = min(low, float(com[2]))
        if not on:
            if air0 is None and k * CTRL_DT > 0.2: air0 = k; vx_off = float(d.subtree_linvel[1][0]) if False else float(d.qvel[0])
            if air0 is not None and air1 is None: apex = max(apex, com[2] - z0)
        elif air0 is not None and air1 is None and (k - air0) * CTRL_DT > 0.08:
            air1 = k; first = sorted(on)
        if record: frames.append((dog.points(m, d), sorted(on), float(d.qpos[2]), [float(v) for v in com]))
        down.append(len(on))
    pitch, vend = float(d.qpos[2]), d.qvel[:3].copy()
    J = 0.02 * effort + 0.05 * bad + 40 * tip + 3000 * max(0.0, c.get('crouch', 0) - (z0 - low)) ** 2
    if air0 is None or air1 is None: J += 50 + 20 * (c['rise'] - apex) ** 2
    else:
        J += 120 * (apex - c["rise"]) ** 2 + 2.0 * (vx_off - c['vx']) ** 2
        if not all(p.startswith('fpaw') for p in first): J += 3                 # a dog lands on her forepaws
    J += 6 * pitch ** 2 + 20 * (d.subtree_com[1][2] - z0) ** 2 + 0.3 * vend[0] ** 2 + 2 * vend[1] ** 2 + 0.3 * vend[2] ** 2
    J += 2 * (4 - down[-1])                                                      # and ends on all four
    kn = x[NK:NK + NK * NJ].reshape(NK, NJ); J += 0.01 * float(np.sum(np.diff(kn, axis=0) ** 2))
    info = dict(J=J, apex=apex, vx=vx_off, takeoff=None if air0 is None else air0 * CTRL_DT, land=None if air1 is None else air1 * CTRL_DT,
                first=first, crouch=z0 - low, bad=bad, effort=effort, pitch_end=pitch, v_end=float(vend[0]))
    return (J, info, frames) if record else J

def _cost(a): return rollout(a[0], a[1])

def search(case, gens=120, pop=192, seed=0, x0=None):
    rng = np.random.default_rng(seed)
    mu = prior(case) if x0 is None else x0.copy()
    sig = np.concatenate([np.full(NK, 0.15), np.full(NK * NJ, 0.18), [0.01, 0.01]])
    best, bx = 1e9, mu.copy()
    with Pool(16) as pool:
        for g in range(gens):
            xs = mu + sig * rng.standard_normal((pop, NP)); xs[0] = mu; xs[1] = bx
            Js = np.array(pool.map(_cost, [(x, case) for x in xs], chunksize=4))
            o = np.argsort(Js); el = xs[o[:pop // 8]]
            if Js[o[0]] < best: best, bx = Js[o[0]], xs[o[0]].copy()
            mu = 0.5 * mu + 0.5 * el.mean(0); sig = np.maximum(0.6 * sig + 0.4 * el.std(0), 0.01)
            if g % 10 == 0 or g == gens - 1: print(g, round(float(Js[o[0]]), 3), round(best, 3), flush=True)
    return bx

def strip(frames, path, every=25, cols=8, w=260, h=330, sc=230):
    from PIL import Image, ImageDraw
    fs = frames[::every]; rows = (len(fs) + cols - 1) // cols
    im = Image.new('RGB', (cols * w, rows * h), '#F4F1EA'); dr = ImageDraw.Draw(im)
    for n, (pt, on, pitch, com) in enumerate(fs):
        ox, oy = (n % cols) * w + w * 0.45 - com[0] * sc, (n // cols) * h + h - 20
        P = lambda k: (ox + pt[k][0] * sc, oy - pt[k][1] * sc)
        dr.line([(n % cols) * w, oy, (n % cols) * w + w, oy], fill='#9AA', width=1)
        for name, ch in dog.CHAINS.items():
            colr = '#B9B0A4' if name.endswith('_r') else '#5E3829'
            dr.line([P(k) for k in ch], fill=colr, width=4 if name == 'spine' else 3)
            for k in ch: dr.ellipse([P(k)[0] - 2.5, P(k)[1] - 2.5, P(k)[0] + 2.5, P(k)[1] + 2.5], fill='#222')
        dr.text(((n % cols) * w + 4, (n // cols) * h + 4), f'{n * every * CTRL_DT:.2f}s', fill='#555')
    im.save(path)

if __name__ == '__main__':
    case = sys.argv[1]; gens = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    here = os.path.dirname(os.path.abspath(__file__)); os.makedirs(here + '/out', exist_ok=True)
    f = f'{here}/out/{case}.npy'
    x0 = np.load(f) if os.path.exists(f) and '--fresh' not in sys.argv else None
    x = search(case, gens, x0=x0) if gens > 0 else (x0 if x0 is not None else prior(case))
    np.save(f, x)
    J, info, frames = rollout(x, case, True); print(info)
    strip(frames, f'{here}/out/{case}.png')
    keys = sorted(frames[0][0])
    json.dump(dict(dt=CTRL_DT * 5, case=case, info=info, chains=dog.CHAINS, keys=keys,
                   frames=[[round(v, 3) for k in keys for v in pt[k]] for pt, on, pitch, com in frames[::5]],
                   on=[on for pt, on, pitch, com in frames[::5]]), open(f'{here}/out/{case}.json', 'w'))
