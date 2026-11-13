"""A springer spaniel's skeleton for MuJoCo, side on: real bones, joints, joint ranges and masses.

Metres, kilograms. x forward, z up. Every hinge turns about -y, so a positive angle swings the far end
of a hanging bone forward and lifts the nose. Angle 0 is the standing pose below.
Joint ranges are a dog's passive ranges (goniometry of Labradors, Jaegger et al. 2002), taken from standing.
"""
import mujoco

# joint centres standing: (x, z)
P = dict(
    spine=(0.12, 0.44), tail=(-0.09, 0.45), tail_tip=(-0.30, 0.40),
    neck=(0.43, 0.45), head=(0.55, 0.57), nose=(0.72, 0.55),
    scap=(0.34, 0.493), sho=(0.42, 0.378), elb=(0.334, 0.255), car=(0.334, 0.085), mcp=(0.339, 0.030), ftip=(0.385, 0.016),
    hip=(0.0, 0.434), sti=(0.055, 0.284), hock=(-0.017, 0.130), mtp=(-0.017, 0.030), htip=(0.030, 0.016),
)
ROOT = (0.25, 0.42)
SIDE = 0.07

# name: (range lo, hi from standing in rad, torque limit N m, servo stiffness, damping)
J = dict(
    spine=(-0.45, 0.45, 90, 500, 6), neck=(-0.8, 0.8, 25, 120, 2), head=(-0.7, 0.7, 12, 60, 1),
    scap=(-0.35, 0.35, 40, 300, 3), sho=(-0.90, 0.95, 60, 350, 4), elb=(-0.35, 1.90, 60, 350, 4), car=(-2.6, 0.30, 25, 150, 1.5),
    hip=(-0.85, 1.20, 90, 500, 6), sti=(-1.62, 0.47, 70, 400, 4), hock=(-0.17, 2.0, 60, 350, 3),
)
FORE = ['scap', 'sho', 'elb', 'car']
HIND = ['hip', 'sti', 'hock']
AXIAL = ['spine', 'neck', 'head']


def _cap(a, b, o, r, m, y=0.0, extra=''):
    return (f'<geom type="capsule" fromto="{a[0]-o[0]:.4f} {y} {a[1]-o[1]:.4f} {b[0]-o[0]:.4f} {y} {b[1]-o[1]:.4f}" '
            f'size="{r}" mass="{m}" {extra}/>')


def _hinge(name, key=None):
    lo, hi, _, _, d = J[key or name]
    return f'<joint name="{name}" type="hinge" axis="0 -1 0" range="{lo} {hi}" damping="{d}" armature="0.002"/>'


def _body(name, at, parent, y=0.0):
    return f'<body name="{name}" pos="{at[0]-parent[0]:.4f} {y} {at[1]-parent[1]:.4f}">'


def xml():
    p = P
    out = ['<mujoco model="spaniel"><compiler angle="radian"/>',
           '<option timestep="0.001" integrator="implicitfast"/>',
           '<default><geom contype="0" conaffinity="1" friction="1.0 0.005 0.0001" solref="0.006 1"/></default>',
           '<worldbody><geom name="ground" type="plane" size="50 1 0.1" contype="1" conaffinity="0"/>',
           f'<body name="thorax" pos="{ROOT[0]} 0 {ROOT[1]}">',
           '<joint name="rx" type="slide" axis="1 0 0"/><joint name="rz" type="slide" axis="0 0 1"/><joint name="ry" type="hinge" axis="0 -1 0"/>',
           _cap((0.12, 0.41), (0.40, 0.40), ROOT, 0.095, 7.0)]
    # back half, tail
    out += [_body('pelvis', p['spine'], ROOT), _hinge('spine'), _cap((0.12, 0.43), (-0.05, 0.43), p['spine'], 0.07, 4.5),
            _body('tail', p['tail'], p['spine']),
            '<joint name="tail" type="hinge" axis="0 -1 0" range="-1.2 1.2" stiffness="0.6" damping="0.03"/>',
            _cap(p['tail'], p['tail_tip'], p['tail'], 0.015, 0.15), '</body>']
    for s, y in (('l', SIDE), ('r', -SIDE)):
        out += [_body(f'femur_{s}', p['hip'], p['spine'], y), _hinge(f'hip_{s}', 'hip'), _cap(p['hip'], p['sti'], p['hip'], 0.04, 0.9),
                _body(f'tibia_{s}', p['sti'], p['hip']), _hinge(f'sti_{s}', 'sti'), _cap(p['sti'], p['hock'], p['sti'], 0.02, 0.35),
                _body(f'metat_{s}', p['hock'], p['sti']), _hinge(f'hock_{s}', 'hock'), _cap(p['hock'], p['mtp'], p['hock'], 0.014, 0.1),
                _body(f'hpaw_{s}', p['mtp'], p['hock']),
                f'<joint name="mtp_{s}" type="hinge" axis="0 -1 0" range="-0.4 1.3" stiffness="4" damping="0.08"/>',
                _cap(p['mtp'], p['htip'], p['mtp'], 0.016, 0.05), '</body></body></body></body>']
    out.append('</body>')
    # neck, head
    out += [_body('neck', p['neck'], ROOT), _hinge('neck'), _cap(p['neck'], p['head'], p['neck'], 0.045, 1.2),
            _body('head', p['head'], p['neck']), _hinge('head'), _cap(p['head'], p['nose'], p['head'], 0.05, 1.4), '</body></body>']
    for s, y in (('l', SIDE), ('r', -SIDE)):
        out += [_body(f'scap_{s}', p['scap'], ROOT, y), _hinge(f'scap_{s}', 'scap'), _cap(p['scap'], p['sho'], p['scap'], 0.03, 0.4),
                _body(f'hum_{s}', p['sho'], p['scap']), _hinge(f'sho_{s}', 'sho'), _cap(p['sho'], p['elb'], p['sho'], 0.028, 0.5),
                _body(f'rad_{s}', p['elb'], p['sho']), _hinge(f'elb_{s}', 'elb'), _cap(p['elb'], p['car'], p['elb'], 0.018, 0.25),
                _body(f'metac_{s}', p['car'], p['elb']), _hinge(f'car_{s}', 'car'), _cap(p['car'], p['mcp'], p['car'], 0.014, 0.06),
                _body(f'fpaw_{s}', p['mcp'], p['car']),
                f'<joint name="mcp_{s}" type="hinge" axis="0 -1 0" range="-0.4 1.3" stiffness="4" damping="0.08"/>',
                _cap(p['mcp'], p['ftip'], p['mcp'], 0.016, 0.05), '</body></body></body></body></body>']
    out.append('</body></worldbody><actuator>')
    for n in ACT:
        _, _, f, kp, _ = J[n.split('_')[0]]
        out.append(f'<position name="{n}" joint="{n}" kp="{kp}" forcerange="{-f} {f}"/>')
    out.append('</actuator></mujoco>')
    return '\n'.join(out)


# actuated joints, in control order
ACT = AXIAL + [f'{j}_{s}' for s in 'lr' for j in FORE] + [f'{j}_{s}' for s in 'lr' for j in HIND]
# the points a clip records, in drawing order: chains of (name, body, local point)
CHAINS = dict(
    spine=['nose', 'head', 'neck', 'spine', 'hipc', 'tail', 'tail_tip'],
    fore_l=['scap_l', 'sho_l', 'elb_l', 'car_l', 'mcp_l', 'ftip_l'], fore_r=['scap_r', 'sho_r', 'elb_r', 'car_r', 'mcp_r', 'ftip_r'],
    hind_l=['hip_l', 'sti_l', 'hock_l', 'mtp_l', 'htip_l'], hind_r=['hip_r', 'sti_r', 'hock_r', 'mtp_r', 'htip_r'],
)
_SITE = {  # point -> (body, standing position)
    'nose': ('head', P['nose']), 'head': ('head', P['head']), 'neck': ('neck', P['neck']), 'spine': ('pelvis', P['spine']),
    'hipc': ('pelvis', P['hip']), 'tail': ('tail', P['tail']), 'tail_tip': ('tail', P['tail_tip']),
}
for s in 'lr':
    _SITE.update({f'scap_{s}': (f'scap_{s}', P['scap']), f'sho_{s}': (f'hum_{s}', P['sho']), f'elb_{s}': (f'rad_{s}', P['elb']),
                  f'car_{s}': (f'metac_{s}', P['car']), f'mcp_{s}': (f'fpaw_{s}', P['mcp']), f'ftip_{s}': (f'fpaw_{s}', P['ftip']),
                  f'hip_{s}': (f'femur_{s}', P['hip']), f'sti_{s}': (f'tibia_{s}', P['sti']), f'hock_{s}': (f'metat_{s}', P['hock']),
                  f'mtp_{s}': (f'hpaw_{s}', P['mtp']), f'htip_{s}': (f'hpaw_{s}', P['htip'])})
_ORIGIN = dict(thorax=ROOT, pelvis=P['spine'], tail=P['tail'], neck=P['neck'], head=P['head'])
for s in 'lr':
    _ORIGIN.update({f'scap_{s}': P['scap'], f'hum_{s}': P['sho'], f'rad_{s}': P['elb'], f'metac_{s}': P['car'], f'fpaw_{s}': P['mcp'],
                    f'femur_{s}': P['hip'], f'tibia_{s}': P['sti'], f'metat_{s}': P['hock'], f'hpaw_{s}': P['mtp']})


def make():
    m = mujoco.MjModel.from_xml_string(xml())
    return m, mujoco.MjData(m)


def points(m, d):
    """Every recorded point's (x, z) now."""
    out = {}
    for k, (b, at) in _SITE.items():
        i = m.body(b).id; o = _ORIGIN[b]
        R = d.xmat[i].reshape(3, 3); lx, lz = at[0] - o[0], at[1] - o[1]
        out[k] = (float(d.xpos[i][0] + R[0, 0] * lx + R[0, 2] * lz), float(d.xpos[i][2] + R[2, 0] * lx + R[2, 2] * lz))
    return out


if __name__ == '__main__':
    m, d = make()
    for _ in range(1500): mujoco.mj_step(m, d)
    print('mass', sum(m.body_mass), 'root', d.qpos[:3], 'com', d.subtree_com[1])
    print({k: (round(v[0], 3), round(v[1], 3)) for k, v in points(m, d).items() if k.endswith('_l') or k in ('nose', 'hipc')})
