// 3D models, all built from simple primitives. No model files to load.
// Every model faces +x and stands on y = 0.
import * as THREE from '../vendor/three.module.min.js';
import { STYLE } from './style.js';
import { clamp, lerp } from './util.js';
import { MOVES, STRIDE, BONES } from './moves.js';

const SPH = new THREE.SphereGeometry(1, 24, 16);
const SPH_LO = new THREE.SphereGeometry(1, 12, 9);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CONE = new THREE.CylinderGeometry(0.42, 1, 1, 16);
// One skin for Lili's tail (the tip is at -x): it thins towards the tip, and the feathering is the same surface drawn down
// into a fringe underneath, deepest in the middle. Two shapes laid together showed as two tails.
const TAIL = (() => {
  const g = new THREE.SphereGeometry(1, 24, 16), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), t = (x + 1) / 2, thin = 0.5 + 0.5 * Math.sqrt(t), fringe = y < 0 ? 1 + 1.7 * Math.sin(Math.PI * Math.min(1, t * 1.15)) : 1;
    P.setXYZ(i, x, y * thin * fringe, P.getZ(i) * thin * (y < 0 ? 1 - 0.45 * -y : 1));
  }
  g.computeVertexNormals();
  return g;
})();
// One skin for Lili's body, from rump to chest. It is the outline of the egg shapes it replaces (each [x, y, rx, ry, rz]),
// smoothed along her length so that there is no crease where one ended and the next began.
function torsoGeo(eggs, x0, x1) {
  const N = 80, top = [], bot = [], wid = [];
  for (let i = 0; i <= N; i++) {
    const x = lerp(x0, x1, i / N); let t = -1e9, b = 1e9, w = 0;
    for (const [cx, cy, rx, ry, rz] of eggs) { const u = (x - cx) / rx; if (Math.abs(u) < 1) { const k = Math.sqrt(1 - u * u); t = Math.max(t, cy + ry * k); b = Math.min(b, cy - ry * k); w = Math.max(w, rz * k); } }
    if (t < b) throw new Error('torsoGeo: nothing covers x = ' + x);
    top.push(t); bot.push(b); wid.push(w);
  }
  const smooth = (a) => a.map((_, i) => { let v = 0, n = 0; for (let j = -7; j <= 7; j++) { const q = a[clamp(i + j, 0, N)], k = 8 - Math.abs(j); v += q * k; n += k; } return v / n; });
  const T = smooth(top), B = smooth(bot), W = smooth(wid), at = (a, f) => { const i = Math.min(N - 1, Math.floor(f * N)), e = f * N - i; return lerp(a[i], a[i + 1], e); };
  const g = new THREE.SphereGeometry(1, 28, 40), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    // the sphere's poles lie along her length; each ring of it becomes one slice of her
    const a = P.getY(i), f = (a + 1) / 2, r = Math.sqrt(Math.max(1 - a * a, 1e-6)), ends = Math.min(1, r * 2.2);
    const mid = (at(T, f) + at(B, f)) / 2, half = (at(T, f) - at(B, f)) / 2;
    P.setXYZ(i, lerp(x0, x1, f), mid + half * ends * P.getX(i) / r, -at(W, f) * ends * P.getZ(i) / r);   // mirrored, so that the faces still point outwards
  }
  g.computeVertexNormals();
  return g;
}
const matCache = new Map();
// One material factory for the whole game, so the art style can be switched in one place.
let toonRamp;
export function surf(o) {
  if (STYLE.kind === 'toon') {
    if (!toonRamp) { toonRamp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat); toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true; }
    const { roughness, metalness, ...rest } = o;
    return new THREE.MeshToonMaterial({ ...rest, gradientMap: toonRamp });
  }
  return new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });
}
export function mat(color, o) {
  if (o) return surf({ color, ...o });
  if (!matCache.has(color)) matCache.set(color, surf({ color }));
  return matCache.get(color);
}
const VC = () => mat('#ffffff', { vertexColors: true });
let vcMat; const vc = () => (vcMat ||= VC());

function ball(color, sx, sy, sz, x, y, z, shadow = true) {
  const m = new THREE.Mesh(SPH, typeof color === 'string' ? mat(color) : color);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = shadow;
  return m;
}

// Merge several primitive shapes into one mesh with per-vertex colours (one draw call).
// Each shape is shaded a little darker underneath and lighter on top, with a gentle mottle,
// so nothing looks like flat plastic.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _c = new THREE.Color();
function merged(parts) {
  const pos = [], nor = [], col = [];
  for (const p of parts) {
    _q.setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0])));
    _m.compose(new THREE.Vector3(...p.at), _q, new THREE.Vector3(...p.scale));
    const src = (p.geo || SPH_LO).clone().toNonIndexed();
    src.computeBoundingBox();
    const y0 = src.boundingBox.min.y, yr = src.boundingBox.max.y - y0 || 1;
    const ly = Array.from({ length: src.attributes.position.count }, (_, i) => (src.attributes.position.getY(i) - y0) / yr);
    const g = src.applyMatrix4(_m), P = g.attributes.position;
    pos.push(...P.array); nor.push(...g.attributes.normal.array);
    _c.set(p.color);
    const flat = p.flat ? 0.5 : 1;
    for (let i = 0; i < P.count; i++) {
      const h = Math.sin(Math.round(P.getX(i)) * 12.9898 + Math.round(P.getY(i)) * 78.233 + Math.round(P.getZ(i)) * 37.719) * 43758.5453;
      const k = 1 - 0.13 * flat + 0.26 * flat * ly[i] + ((h - Math.floor(h)) - 0.5) * 0.09 * flat;
      col.push(Math.min(1, _c.r * k), Math.min(1, _c.g * k), Math.min(1, _c.b * k));
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const blob = (color, x, y, z, r, ry = r, rz = r, rot) => ({ color, at: [x, y, z], scale: [r, ry, rz], rot });
const box = (color, x, y, z, w, h, d, rot) => ({ geo: BOX, color, at: [x, y, z], scale: [w, h, d], rot, flat: true });
const cyl = (color, x, y, z, r, h, rot, r2 = r) => ({ geo: CYL, color, at: [x, y, z], scale: [r, h, r2], rot, flat: true });
function mesh(parts, shadow = true) { const m = new THREE.Mesh(merged(parts), vc()); m.castShadow = shadow; return m; }
function group(x, y, z, ...kids) { const g = new THREE.Group(); g.position.set(x, y, z); if (kids.length) g.add(...kids); return g; }

// ------------------------------------------------------------------ dog --
// Lili, a liver and white spaniel: white all over but for the brown sides of her head, long brown ears, a domed head, feathered legs and a tail
// that never stops. The body is built round the hips: the whole front swings up and down
// about them (rearing up to greet someone, bowing to play, sitting to drive), and the spine
// bends sideways in the middle when turning.
//
// Her legs have a dog's bones, in the proportions of the simulated skeleton (tools/sim): upper arm, forearm and
// pastern in front; thigh, shin and the long bone below the hock behind. So the elbow sits back under her chest,
// the knee forward under her flank, and the hock points backwards above the paw.
//
// On the ground the legs are not animated, they are solved. Each paw has a place on the ground. While it
// stands there it does not move, whatever the body does above it; when its turn comes it is
// lifted and put down ahead of where its shoulder is going. So the paws never slide, the
// stride always matches the ground covered, and a turn on the spot is walked round.
// white with a little warmth, so that she does not burn out in the sun; the feathering is whiter still
const COAT = '#F1ECE3', FEATHER = '#FFFDF8', LIVER = '#5E3829', EAR = '#4C2B20', NOSE = '#7E5146';
const HIP_X = -26, HIP_Y = 36, SPINE_X = -2, SPINE_Y = 46;
const PAW_Y = 4.4, LEG_Y = 36.6;                        // a standing paw's middle is this high; shoulder and hip joints, this high
// The skeleton's bones, scaled so that each leg stands as tall as hers does (her legs are short for her body).
const FORE_K = (LEG_Y - PAW_Y) / BONES.foreDrop, HIND_K = (LEG_Y - PAW_Y) / BONES.hindDrop;
const FORE = BONES.fore.map((v) => v * FORE_K), HIND = BONES.hind.map((v) => v * HIND_K);
// fl fr hl hr: where each leg joins the body (jx), and where its paw stands when at rest (px): behind the joint,
// because the upper arm slopes back from the shoulder
const leg = (px, back, jz, front) => ({ jx: px + back, px, jy: LEG_Y, jz, front, bones: front ? FORE : HIND, rest: Math.atan2(-back, LEG_Y - PAW_Y), len: Math.hypot(back, LEG_Y - PAW_Y) });
const LEGS = [leg(24, BONES.foreBack * FORE_K, 10.5, true), leg(24, BONES.foreBack * FORE_K, -10.5, true), leg(HIP_X - BONES.hindBack * HIND_K, BONES.hindBack * HIND_K, 11.5), leg(HIP_X - BONES.hindBack * HIND_K, BONES.hindBack * HIND_K, -11.5)];
const wrap = (a) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
// when in the stride each paw comes down (a fraction of the cycle). Trot: diagonal pairs together.
// Gallop: the two hind paws, then the two front paws, then all four in the air.
const TROT_AT = [0, 0.5, 0.5, 0], GALLOP_AT = [0.5, 0.62, 1.0, 0.1];
const frac = (v) => v - Math.floor(v);
const EAR_SEG = 9.5, EAR_G = 1500, EAR_DRAG = 4.5, EAR_SPRING = [16, 7, 4, 3];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _inv = new THREE.Matrix4(), _rot = new THREE.Matrix4(), Z_AXIS = new THREE.Vector3(0, 0, 1), X_AXIS = new THREE.Vector3(1, 0, 0);

export function makeDog() {
  const root = new THREE.Group();                       // position + heading (+ landing squash)
  const lean = new THREE.Group();                       // rolls into a turn
  const tilt = group(HIP_X, HIP_Y, 0);                  // swings about the hips
  const g = group(-HIP_X, -HIP_Y, 0);                   // everything inside is in plain model coordinates
  const fore = group(SPINE_X, SPINE_Y, 0), rear = group(SPINE_X, SPINE_Y, 0);   // the two ends of the spine, hinged in the middle of the back
  const foreIn = group(-SPINE_X, -SPINE_Y, 0), rearIn = group(-SPINE_X, -SPINE_Y, 0);
  fore.add(foreIn); rear.add(rearIn); g.add(fore, rear); tilt.add(g); lean.add(tilt); root.add(lean);

  // Her body is one skin. Its rump end is carried by the rear of the spine and its chest end by the front, and it
  // bends smoothly between them (bendBody).
  const body = mesh([{ geo: torsoGeo([[-2, 45, 34, 19, 17.5], [0, 29, 26, 7, 11], [-26, 46, 20, 20, 18.5], [22, 45, 21, 22, 19]], -45.9, 42.9), color: COAT, at: [0, 0, 0], scale: [1, 1, 1] }]);
  body.frustumCulled = false;
  const bodyAt = body.geometry.attributes.position, bodyN = body.geometry.attributes.normal, body0 = bodyAt.array.slice(), bodyN0 = bodyN.array.slice();
  const _mf = new THREE.Matrix4(), _mr = new THREE.Matrix4();
  function bendBody() {
    fore.updateMatrix(); rear.updateMatrix(); foreIn.updateMatrix(); rearIn.updateMatrix();
    const F = _mf.multiplyMatrices(fore.matrix, foreIn.matrix).elements, R = _mr.multiplyMatrices(rear.matrix, rearIn.matrix).elements;
    for (let i = 0; i < body0.length; i += 3) {
      const x = body0[i], y = body0[i + 1], z = body0[i + 2], nx = bodyN0[i], ny = bodyN0[i + 1], nz = bodyN0[i + 2];
      const u = clamp((x + 26) / 48, 0, 1), w = u * u * (3 - 2 * u), v = 1 - w;      // 0 at the hips, 1 at the shoulders
      bodyAt.array[i] = (R[0] * x + R[4] * y + R[8] * z + R[12]) * v + (F[0] * x + F[4] * y + F[8] * z + F[12]) * w;
      bodyAt.array[i + 1] = (R[1] * x + R[5] * y + R[9] * z + R[13]) * v + (F[1] * x + F[5] * y + F[9] * z + F[13]) * w;
      bodyAt.array[i + 2] = (R[2] * x + R[6] * y + R[10] * z + R[14]) * v + (F[2] * x + F[6] * y + F[10] * z + F[14]) * w;
      bodyN.array[i] = (R[0] * nx + R[4] * ny + R[8] * nz) * v + (F[0] * nx + F[4] * ny + F[8] * nz) * w;
      bodyN.array[i + 1] = (R[1] * nx + R[5] * ny + R[9] * nz) * v + (F[1] * nx + F[5] * ny + F[9] * nz) * w;
      bodyN.array[i + 2] = (R[2] * nx + R[6] * ny + R[10] * nz) * v + (F[2] * nx + F[6] * ny + F[10] * nz) * w;
    }
    bodyAt.needsUpdate = bodyN.needsUpdate = true;
  }
  g.add(body, mesh([blob(LIVER, -6, 62.6, 5, 4.2, 1.8, 2.6, [0, 0.5, 0]), blob(LIVER, 1, 63, 1, 3, 1.6, 2.2, [0, 0.5, 0])]));   // two small marks on her back
  rearIn.add(mesh([blob(LIVER, -38.5, 58.5, 0, 8, 6.5, 7.5, [0, 0, -0.8])]));   // and a brown patch where the tail begins
  foreIn.add(mesh([blob(FEATHER, 37, 39, 0, 9, 14, 12), blob(COAT, 37, 60, 0, 13, 19, 13, [0, 0, -0.6])]));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(12.5, 3, 8, 20), mat('#E9B9B4'));
  collar.rotation.set(Math.PI / 2, 0, 0); const collarG = group(39, 62, 0, collar); collarG.rotation.z = -0.6;
  const tag = ball('#C4CAD3', 3.2, 3.2, 1.5, 49, 53, 0);

  // head
  const head = group(46, 72, 0);
  head.scale.setScalar(1.1);
  head.add(mesh([
    blob(COAT, 4, 4, 0, 16, 15, 15), blob(COAT, 2, 12, 0, 11, 9, 11),
    blob(COAT, 22, -1, 0, 13, 8.5, 9), blob(FEATHER, 20, -6, 5, 9, 5.5, 5), blob(FEATHER, 20, -6, -5, 9, 5.5, 5),
    blob(NOSE, 34.5, 2.5, 0, 4.5, 3.8, 5.2),
    // the brown is a patch over each eye and ear, with a white blaze left between them from her nose to the back of her head
    ...[1, -1].flatMap((s) => [blob(LIVER, 3, 5, s * 7.5, 15.5, 14.5, 9.5), blob(LIVER, 1, 12, s * 6.5, 10.5, 8, 6),
      blob(LIVER, 28, 0, s * 8.2, 1.3, 1.3, 1), blob(LIVER, 24.5, -2.5, s * 9, 1.1, 1.1, 1), blob(LIVER, 29, -4, s * 7.2, 1, 1, 1)]),   // freckles
  ]));
  const eyes = [1, -1].map((s) => {
    const e = group(14.5, 8, s * 9.6, ball(mat('#2A1C14', { roughness: 0.25 }), 3.7, 3.9, 3.2, 0, 0, 0, false), ball('#ffffff', 1.1, 1.1, 1.1, 2.4, 1.6, s * 0.9, false));
    head.add(e); return e;
  });
  const brows = [1, -1].map((s) => { const b = mesh([blob(EAR, 0, 0, 0, 5, 1.6, 4)], false); b.position.set(13.5, 13.4, s * 8.5); head.add(b); return b; });
  const jaw = group(12, -6, 0, mesh([blob(FEATHER, 9, -1.5, 0, 10, 3.6, 6.5)], false));
  const tongue = ball('#F58CA0', 7, 1.6, 4.2, 13, -0.2, 0, false); jaw.add(tongue);
  head.add(jaw);
  // ears: four soft pieces hung one from the next. They are not posed: they hang, swing and stream (swingEars).
  const ears = [1, -1].map((s) => {
    const segs = [[8, 4.4], [9.5, 5.2], [10.5, 5.8], [8.5, 5]].map(([w, th], i) => { const m = mesh([blob(EAR, i === 3 ? 2 : 0, -EAR_SEG / 2, s * (1 + i * 0.5), w, EAR_SEG * 1.05, th)]); head.add(m); return m; });
    return { s, segs, top: new THREE.Vector3(-1, 11, s * 13.5), pts: null, was: null };
  });
  const tail = group(-43, 52, 0, mesh([{ ...blob(COAT, -18, 2, 0, 22, 4.4, 4.6), geo: TAIL }, blob(LIVER, -3, 3, 0, 7.5, 4.4, 4.9)]));
  foreIn.add(collarG, tag, head); rearIn.add(tail);

  // legs: three bones and a paw. Each bone hangs down from its joint, so its angle is how far it is swung forward.
  const g3 = (...parts) => merged(parts);
  const [fa, fb, fc] = FORE, [ha, hb, hc] = HIND;
  const boneGeo = {
    fore: [g3(blob(COAT, 0, -fa / 2, 0, 6.8, fa * 0.68, 7.2)), g3(blob(COAT, 0, -fb / 2, 0, 5.4, fb * 0.62, 5.6), blob(FEATHER, -4.4, -fb / 2, 0, 4.4, fb * 0.56, 4)), g3(blob(COAT, 0, -fc / 2, 0, 4.6, fc * 0.95, 4.9))],
    hind: [g3(blob(COAT, -1.5, -ha / 2, 0, 10, ha * 0.78, 8.6)), g3(blob(COAT, 0, -hb / 2, 0, 5.8, hb * 0.64, 6), blob(FEATHER, -3.6, -hb * 0.45, 0, 4.4, hb * 0.5, 4.2)), g3(blob(COAT, 0, -hc / 2, 0, 4.2, hc * 0.72, 4.6), blob(FEATHER, -3, -hc / 2, 0, 3.4, hc * 0.6, 3.6))],
  };
  const pawGeo = merged([blob(FEATHER, 3, 0, 0, 8.6, 4.4, 7.4)]);
  const part = (geo) => { const m = new THREE.Mesh(geo, vc()); m.castShadow = true; return m; };
  const legs = LEGS.map((L) => {
    const [a, b, c] = L.bones, geo = boneGeo[L.front ? 'fore' : 'hind'];
    const paw = group(0, -c, 0, part(pawGeo)), low = group(0, -b, 0, part(geo[2]), paw), mid = group(0, -a, 0, part(geo[1]), low), up = group(0, 0, 0, part(geo[0]), mid);
    const at = new THREE.Group(); at.add(up); root.add(at);
    // x, y: where the paw stands, in map coordinates. u: how far through its step it is (1 = standing).
    // c: how much the leg is following a captured move; g: how firmly that move has this paw on the ground.
    return { ...L, at, up, mid, low, paw, x: 0, y: 0, x0: 0, y0: 0, hx: 0, hy: 0, u: 1, w: 0, lift: 0, c: 0, g: 0 };
  });
  // Put the leg between its joint and its paw. Three bones can do that in many ways, so the lowest one is given:
  // by rule on the ground (it leans with the leg, the pastern folds back as a forepaw is lifted, the hock sinks
  // towards the ground as a hind leg is folded), or by a captured move (th, pawTh, and w: how much they count).
  // The other two then have one answer, with the elbow behind and the knee in front.
  function solve(L, sx, sy, sz, fx, fy, fz, th, pawTh, w) {
    const [a, b, c] = L.bones, dx = fx - sx, dy = fy - sy, dz = fz - sz;
    const rx = Math.atan2(-dz, Math.max(-dy, 1)), q = -dy * Math.cos(rx) - dz * Math.sin(rx);   // the leg works in a plane, swung out sideways to reach the paw
    const D = Math.max(Math.hypot(dx, q), 1), beta = Math.atan2(dx, q);
    let t3 = L.front ? 0.09 + 0.7 * (beta - L.rest) - L.lift * 0.9 : 0.7 * (beta - L.rest) + 1.5 * clamp(1 - D / L.len, 0, 1);
    t3 = lerp(t3, th, w);
    // ...as far as the other two can reach the top of it
    const m = (D * D + c * c - (a + b - 0.05) ** 2) / (2 * c * D);
    if (m > -1) { const most = Math.acos(Math.min(m, 1)); t3 = beta + clamp(wrap(t3 - beta), -most, most); }
    const kx = dx - c * Math.sin(t3), kq = q - c * Math.cos(t3), d = clamp(Math.hypot(kx, kq), Math.abs(a - b) + 0.5, a + b - 0.04);
    const t1 = Math.atan2(kx, kq) + Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * (L.front ? -1 : 1);
    const t2 = Math.atan2(kx - a * Math.sin(t1), kq - a * Math.cos(t1));
    L.at.position.set(sx, sy, sz); L.at.rotation.set(rx, 0, 0);
    L.up.rotation.z = t1; L.mid.rotation.z = t2 - t1; L.low.rotation.z = t3 - t2;
    L.paw.rotation.z = lerp(-L.lift * 0.7, pawTh, w) - t3;
  }
  // One moment of a captured move, read into C (src/moves.js says what is in it).
  const C = new Float32Array(STRIDE);
  function sample(m, t) {
    const f = clamp(t / m.dt, 0, m.n - 1.001), i = Math.floor(f), e = f - i, o = i * STRIDE;
    for (let j = 0; j < STRIDE; j++) C[j] = j === 3 ? m.f[o + 3] : lerp(m.f[o + j], m.f[o + STRIDE + j], e);
  }

  // Each ear is a little chain with weight. The head drags its top end about; the rest follows late,
  // falls under gravity and is held back by the air, so it streams out behind a run, flies up in a
  // fall (a little: see update), swings forward when she brakes and slaps about when she shakes her head.
  function swingEars(dt, jx, jy, jz, calm) {
    head.updateWorldMatrix(true, false); _inv.copy(head.matrixWorld).invert();
    const len = EAR_SEG * _a.setFromMatrixScale(head.matrixWorld).y, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, keep = Math.exp(-h * EAR_DRAG);
    earT += dt;
    const me = head.matrixWorld.elements, side = Math.hypot(me[8], me[9], me[10]) || 1;
    for (const e of ears) {
      const top = _a.copy(e.top).applyMatrix4(head.matrixWorld);
      if (!e.pts) { e.pts = e.segs.map((_, i) => top.clone().setY(top.y - (i + 1) * len)); e.was = e.pts.map((q) => q.clone()); }
      else if (jx || jy || jz) for (let i = 0; i < 4; i++) { e.pts[i].x += jx; e.pts[i].z += jy; e.was[i].x += jx; e.was[i].z += jy; e.pts[i].y += jz; e.was[i].y += jz; }
      for (let k = 0; k < n && dt > 0; k++) {
        for (let i = 0; i < 4; i++) {
          const q = e.pts[i], w = e.was[i];
          _b.copy(q).sub(w).multiplyScalar(keep); w.copy(q); q.add(_b); q.y -= EAR_G * h * h;
          // the air she runs through: it lifts the ear out sideways and never lets it lie still,
          // so it flaps up, down, in and out as well as trailing
          const air = _b.length() / h, f = air * h * h * (i + 1) * 0.25 * calm, u = earT * (17 + i * 3) + e.s * 2 + i * 1.9;
          q.x += (me[8] / side * e.s * 1.1 + Math.sin(u * 1.3) * 1.2) * f; q.y += (me[9] / side * e.s * 1.1 + 0.9 + Math.sin(u) * 1.6) * f; q.z += (me[10] / side * e.s * 1.1 + Math.cos(u * 0.8) * 1.2) * f;
          // an ear is not a string: it has some spring in it, most where it joins the head
          q.lerp(_b.set(top.x, top.y - (i + 1) * len, top.z), 1 - Math.exp(-h * EAR_SPRING[i]));
        }
        for (let it = 0; it < 2; it++) for (let i = 0; i < 4; i++) {
          const q = e.pts[i], up = i ? e.pts[i - 1] : top;
          q.sub(up).setLength(len).add(up);
          // and it does not fold flat on itself
          const up2 = i > 1 ? e.pts[i - 2] : i ? top : null;
          if (up2 && q.distanceTo(up2) < len * 1.6) q.sub(up2).setLength(len * 1.6).add(up2);
          // it cannot pass through her head or lie inside her neck
          _b.copy(q).applyMatrix4(_inv);
          let hit = false;
          if (_b.z * e.s < 11.5) { _b.z = e.s * 11.5; hit = true; }
          const dx = _b.x - 4, dy = _b.y - 4, d = Math.hypot(dx, dy, _b.z);
          if (d < 15.5 && d > 0.01) { _b.set(4 + dx / d * 15.5, 4 + dy / d * 15.5, _b.z / d * 15.5); hit = true; }
          if (hit) q.copy(_b).applyMatrix4(head.matrixWorld);
        }
      }
      let from = e.top;
      e.segs.forEach((m, i) => {
        const to = _b.copy(e.pts[i]).applyMatrix4(_inv);
        _y.copy(from).sub(to).normalize();
        _x.crossVectors(_y, Z_AXIS); if (_x.lengthSq() < 0.01) _x.copy(X_AXIS); _x.normalize(); _z.crossVectors(_x, _y);
        m.position.copy(from); m.quaternion.setFromRotationMatrix(_rot.makeBasis(_x, _y, _z));
        from = m.userData.end = (m.userData.end || new THREE.Vector3()).copy(to);
      });
    }
  }

  // smoothed pose: everything eases towards its target so states blend into each other
  const P = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, rf: 30, rh: 30, wf: 0, wr: 0, wh: 0, amp: 0, gal: 0, yaw: 0, hp: 0, jaw: 0, tailUp: 0.5, wag: 0.45, wagHz: 12, y: 0, tongue: 0, bend: 0, roll: 0, flex: 0, shk: 0, fly: 0 };
  let earT = 0;
  let last = -1, blink = 0, ph = 0, wagPh = 0, px = 0, py = 0, pz = 0, earCalm = 1, ph0 = 0, turn = 0, fresh = true, flying = false, flew = 0, flight = 1, pitch0 = 0;

  function update(p, t) {
    const dt = last < 0 ? 0.016 : clamp(t - last, 0, 0.05); last = t;
    const sp = p.state === 'drive' ? 0 : Math.hypot(p.vx, p.vy);
    const seated = p.state === 'drive' || p.state === 'hop';
    // wf, wr, wh: how much the front left, front right and hind paws follow a pose instead of standing on the ground
    const T = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, rf: 30, rh: 30, wf: 0, wr: 0, wh: 0, amp: p.air ? 0 : clamp(sp / 240, 0, 1) * (p.zoom ? 0.95 : 0.6), gal: p.zoom ? 1 : 0,
      yaw: p.lookYaw || 0, hp: p.lookPitch || 0, jaw: 0,
      tailUp: 0.5, wag: 0.45, wagHz: 12, y: -3 * clamp(sp / 400, 0, 1), tongue: p.zoom ? 1 : 0, bend: 0, roll: 0, flex: 0, shk: 0, fly: 0 };
    const paddle = Math.sin(t * 17);
    if (p.skid && !p.air) {                              // brakes on: front legs braced out ahead, haunches down, all four paws sliding
      T.pitch = 0.2; T.y = -10; T.fl = 0.62; T.fr = 0.78; T.rf = 34; T.hl = 0.75; T.hr = 0.55; T.rh = 26; T.wf = T.wr = T.wh = 1;
      T.flex = 0.2; T.tailUp = 1.1; T.wag = 0.1; T.hp = -0.25; T.tongue = 1; T.amp = 0;
    } else if (p.air && !seated) {                       // a leap is played from a capture, below
      T.tailUp = 0.2; T.y = 0; T.fly = 1;
    } else if (p.state === 'hop') {                      // the hop into the car: front legs folded, hind legs trailing, then under her
      const up = clamp(p.vz / 450, -1, 1), dn = Math.max(0, -up), under = clamp((dn - 0.45) / 0.5, 0, 1);
      T.pitch = up * 0.3; T.fl = lerp(0.7, 1.5, dn); T.fr = T.fl - 0.12; T.rf = lerp(18, 34, clamp(dn * 1.6, 0, 1));
      T.hl = up > 0 ? lerp(-1.4, -0.95, up) : lerp(-1.4, 0.15, under); T.hr = T.hl + 0.12; T.rh = lerp(34, 24, under);
      T.wf = T.wr = T.wh = 1; T.tailUp = 0.2; T.y = 0; T.flex = lerp(-0.15, 0.14, under);
    } else if (p.spring > 0 && p.spring < 0.11 && !p.still) {
      // the last of a running run-up: haunches down under her, back doubled up, and her front end already coming off the ground
      T.pitch = 0.32; T.fl = 0.65; T.fr = 0.5; T.rf = 22; T.wf = T.wr = 1; T.y = -9; T.flex = 0.22; T.tailUp = 0.1;
    } else if (p.state === 'paws') {                     // up on the hind legs, paws going like mad
      T.pitch = 0.98; T.fl = 0.25 + paddle * 0.4; T.fr = 0.25 - paddle * 0.4; T.rf = 26; T.wf = T.wr = 1; T.wag = 0.8; T.wagHz = 18; T.tongue = 1; T.hp = -0.45;
    } else if (p.state === 'drive') {                    // sitting at the wheel
      const k = clamp(Math.abs(p.carV || 0) / 800, 0, 1);
      T.pitch = 0.62; T.hl = T.hr = 1.35; T.rh = 24; T.fl = 0.42 + (p.carSteer || 0) * 0.3; T.fr = 0.42 - (p.carSteer || 0) * 0.3; T.wf = T.wr = T.wh = 1;
      T.tongue = k > 0.35 ? 1 : 0; T.hp = -0.5; T.wag = 0.3 + k * 0.4; T.wagHz = 15; T.tailUp = -0.2; T.y = 0;
    } else if (p.state === 'daze') {                     // flat on the tummy seeing stars
      T.fl = T.fr = 1.35; T.hl = T.hr = -1.35; T.rf = T.rh = 33; T.wf = T.wr = T.wh = 1; T.y = -20; T.yaw = Math.sin(t * 13) * 0.35; T.hp = 0.1; T.wag = 0.05; T.tailUp = 0;
    } else if (p.bow > 0) {                              // play bow: elbows down, bottom up, a slow wide wag. "Come on then!"
      T.pitch = -0.4; T.fl = T.fr = 1.5; T.rf = 30; T.wf = T.wr = 1; T.wag = 0.95; T.wagHz = 11; T.hp = 0.5; T.tailUp = 0.9;
    } else if (p.point > 0.5) {                          // a bird! One paw up, tail out straight, stock still
      T.fr = 0.55; T.rf = 21; T.wr = 1; T.wag = 0.02; T.tailUp = -0.1; T.pitch = -0.04;
    } else if (p.shake > 0) {                            // a good shake: the head twists one way and the other, and the twist runs down her back
      T.shk = 1; T.hp = 0.12; T.tailUp = 0.3; T.wag = 0.1; T.y = -2;
    } else if (sp < 30) { T.wag = 0.55 + (p.happy ? 0.25 : 0); T.wagHz = p.happy ? 17 : 12; }
    if (p.barkT > 0) { T.jaw = 0.75; T.hp += 0.3; }
    if (p.spring > 0 && !p.still) T.gal = 1;              // a run-up is bounds, not a trot
    // ---- a captured move (tools/sim): the long leap, or the high jump when there is something to get up onto ----
    // From a stand she plays all of it: she sinks, drives off her hind legs and goes. From a run only the flight.
    // The flight is stretched to how long she is really in the air: `u` runs from take-off to landing.
    const move = MOVES[p.high ? 'high' : 'stand'];
    let cap = 0;
    if (p.air && !seated) {
      if (!flying) { flew = 0; flight = p.flight || Math.max(2 * (p.eta || 0), 0.3); pitch0 = P.pitch; }
      flew = clamp(1 - (p.eta || 0) / flight, flew, Math.min(1, flew + dt * 5));
      sample(move, lerp(move.takeoff, move.land, flew)); cap = 1;
      T.pitch = C[0] * (p.still ? 1 : 0.7); T.flex = C[1];             // off a run she goes flatter than off a stand
    } else if (p.spring > 0 && p.still) {
      sample(move, move.takeoff - p.spring); cap = 1;
      T.pitch = C[0]; T.flex = C[1]; T.y = C[2]; T.tailUp = 0.2;
    }
    flying = p.air && !seated;
    if (p.landT > 0 && !p.air && p.state === 'idle' && !p.skid) {   // landing: the forelegs take it, nose still down, and she bounds on
      const k = p.landT / 0.22; T.pitch -= 0.22 * k; T.y -= 7 * k; T.flex += 0.2 * k; T.gal = 1;
    }

    // ---- turning: the spine bends into the turn, the head leads it, and at speed the body leans in ----
    const ch = Math.cos(p.heading), sh = Math.sin(p.heading);
    if (fresh) ph0 = p.heading;
    let dh = (p.heading - ph0) % (Math.PI * 2); if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
    ph0 = p.heading;
    turn = lerp(turn, dt > 0 ? clamp(dh / dt, -12, 12) : turn, 1 - Math.exp(-dt * 10));
    const grounded = !p.air && !seated && p.state !== 'daze';
    if (grounded) { T.bend = clamp(turn * 0.07, -0.5, 0.5); T.roll = clamp(turn * sp / 9000, -0.28, 0.28); T.yaw += clamp(turn * 0.09, -0.6, 0.6); }

    const k = 1 - Math.exp(-dt * 14), ks = 1 - Math.exp(-dt * 7), kc = cap ? 1 - Math.exp(-dt * 45) : k;   // a capture is followed closely: it is already smooth
    for (const n in T) P[n] = lerp(P[n], T[n], n === 'gal' || n === 'tongue' || n === 'wagHz' ? ks : n === 'pitch' || n === 'flex' || n === 'y' ? kc : k);

    // ---- the paws ----
    // A jump in position (into the car, the studio floor wrapping round) carries the paws along.
    const jx = p.x - px, jy = p.y - py; px = p.x; py = p.y;
    const fresh0 = fresh, jumped = fresh || Math.hypot(jx, jy) > 150;
    let moving = 0, worst = 0;
    for (const L of legs) {
      const hx = p.x + L.px * ch - L.jz * sh, hy = p.y + L.px * sh + L.jz * ch;       // where it would stand at rest
      if (fresh) { L.x0 = L.x = L.hx = hx; L.y0 = L.y = L.hy = hy; }
      else if (jumped) { L.x += jx; L.y += jy; L.x0 += jx; L.y0 += jy; L.hx += jx; L.hy += jy; }
      L.vx = dt > 0 ? (hx - L.hx) / dt : 0; L.vy = dt > 0 ? (hy - L.hy) / dt : 0; L.hx = hx; L.hy = hy;
      moving += Math.hypot(L.vx, L.vy) / 4;
      L.want = L.front ? (L.jz > 0 ? T.wf : T.wr) : T.wh;
      L.w = lerp(L.w, L.want, k);
      if (L.want > 0.5 || !grounded) { L.x = hx; L.y = hy; L.u = 1; }             // off the ground: it will come down under the body
      L.off = Math.hypot(L.x - hx, L.y - hy);
      if (L.u >= 1) worst = Math.max(worst, L.off);
    }
    fresh = false;
    // The stride: how far a paw stays down, what share of the cycle that is, and so how long one cycle is.
    // The cycle is driven by the ground the paws have to cover, never by the clock.
    const gl = P.gal, fast = clamp(moving / 420, 0, 1);
    const reach = lerp(20, 36, clamp(moving / 300, 0, 1)), duty = lerp(lerp(0.62, 0.36, fast), 0.3, gl);
    let rate = moving / (reach / duty);
    if (rate < 2.4 && worst > 7) rate = 2.4 + worst * 0.06;                        // standing awkwardly: shuffle the paws back under
    else if (moving < 12) rate = 0;
    if (grounded) ph += rate * dt;
    for (let i = 0; i < 4; i++) {
      const L = legs[i];
      if (!grounded || L.want > 0.5) { L.lift = 0; continue; }
      const f = frac(ph - lerp(TROT_AT[i], GALLOP_AT[i], gl));
      if (L.u >= 1 && ((f >= duty && f < duty + (1 - duty) * 0.5 && (L.off > 7 || moving > 40)) || L.off > 44)) { L.u = 0; L.x0 = L.x; L.y0 = L.y; }
      if (L.u < 1) {
        L.u = Math.min(1, L.u + Math.max(rate / (1 - duty), moving < 90 ? 8 : 0) * dt);   // coming to a stop: no paw is left hanging
        // it comes down ahead of the shoulder by half of what the shoulder will cover while it stands
        const lead = rate > 0 ? Math.min(duty / rate * 0.5, 0.2) : 0;
        const e = L.u * L.u * (3 - 2 * L.u);
        L.x = lerp(L.x0, L.hx + L.vx * lead, e); L.y = lerp(L.y0, L.hy + L.vy * lead, e);
        if (L.u >= 1 && moving > 60) p.footfall = true;
      }
      L.lift = L.u < 1 ? Math.sin(L.u * Math.PI) : 0;
    }
    p.gait = frac(ph); p.feet = legs;

    // ---- the body rides over them ----
    const a = P.amp, s2 = ph * Math.PI * 2;
    const pitch = P.pitch + gl * a * Math.cos(s2 - 1.1) * 0.13;
    const bob = Math.abs(Math.sin(s2)) * 2 * a * (1 - gl) + gl * a * (2 + Math.sin(s2 + 2.6) * 4) + P.y
      - (Math.sin(P.pitch) - Math.sin(pitch0) * (1 - flew)) * 26 * P.fly;   // in the air she turns about her middle, not about her hips (from however she was tilted as she left the ground)
    const wagNow = Math.sin(wagPh += dt * P.wagHz) * P.wag;
    tilt.rotation.z = pitch; tilt.position.y = HIP_Y + bob;
    const shk = P.shk * Math.sin(t * 30), shkBody = P.shk * Math.sin(t * 30 - 1.2);
    lean.rotation.x = P.roll + shkBody * 0.1;
    // at a gallop the back works like a spring: it doubles up as the hind legs come through under her
    // and straightens out as she reaches forward
    const flex = P.flex + gl * a * 0.25 * Math.cos(s2 + 0.3);
    const fy = -P.bend, ry = P.bend * 0.6 + wagNow * 0.12 * (a < 0.2 ? 1 : 0);     // the whole bottom wiggles when the tail really goes
    fore.rotation.y = fy; rear.rotation.y = ry + shkBody * 0.09; fore.rotation.z = -flex; rear.rotation.z = flex;
    bendBody();

    const cp = Math.cos(pitch), sn = Math.sin(pitch), cr = Math.cos(P.roll), sr = Math.sin(P.roll);
    for (let i = 0; i < 4; i++) {
      const L = legs[i], yw = L.front ? fy : ry, cy = Math.cos(yw), sy = Math.sin(yw);
      // the joint: carried by the spine's bend, the swing about the hips and the lean, in that order
      const fa = L.front ? -flex : flex, x0 = L.jx - SPINE_X, y0 = L.jy - SPINE_Y, xr = x0 * Math.cos(fa) - y0 * Math.sin(fa), yr = SPINE_Y + x0 * Math.sin(fa) + y0 * Math.cos(fa);
      let x = SPINE_X + xr * cy + L.jz * sy, y = yr + bob, z = -xr * sy + L.jz * cy;
      if (L.front) { const rx = x - HIP_X, ry2 = yr - HIP_Y; x = HIP_X + rx * cp - ry2 * sn; y = HIP_Y + rx * sn + ry2 * cp + bob; }
      const sy3 = y * cr - z * sr, sz3 = y * sr + z * cr;
      // the paw: on its spot on the ground...
      const dx = L.x - p.x, dy = L.y - p.y, step = lerp(4, 9, fast) + gl * 3;
      let fx = dx * ch + dy * sh, fz = -dx * sh + dy * ch, fyy = PAW_Y + L.lift * step;
      // ...or held in a pose
      if (L.w > 0.002) {
        const ang = (L.front ? (L.jz > 0 ? P.fl : P.fr) + pitch : (L.jz > 0 ? P.hl : P.hr)), r = L.front ? P.rf : P.rh;
        let py2 = sy3 - Math.cos(ang) * r; if (!seated) py2 = Math.max(py2, PAW_Y - (p.air ? p.clear || 0 : 0));   // no paw goes through the ground: leaving it, the hind paws are the last to lift; landing, the forepaws are down first
        fx = lerp(fx, x - L.jx + L.px + Math.sin(ang) * r, L.w); fyy = lerp(fyy, py2, L.w); fz = lerp(fz, sz3, L.w);
      }
      // ...or where a captured move has it: the bones' angles give the place, and the ground still stops it
      let th = 0, pawTh = 0;
      L.c = lerp(L.c, cap, 1 - Math.exp(-dt * 30));
      if (L.c > 0.002) {
        const o = 4 + i * 4, body = pitch + (L.front ? -flex : flex), [ba, bb, bc] = L.bones, t1 = C[o] + body, t2 = C[o + 1] + body;
        th = C[o + 2] + body; pawTh = C[o + 3] + body;
        L.g = lerp(L.g, (C[3] >> i) & 1, 1 - Math.exp(-dt * 60));
        const floor = PAW_Y - (p.air ? p.clear || 0 : 0), cy = sy3 - ba * Math.cos(t1) - bb * Math.cos(t2) - bc * Math.cos(th);
        fx = lerp(fx, x + ba * Math.sin(t1) + bb * Math.sin(t2) + bc * Math.sin(th), L.c); fyy = lerp(fyy, lerp(Math.max(cy, floor), floor, L.g), L.c); fz = lerp(fz, sz3, L.c);
      }
      solve(L, x, sy3, sz3, fx, fyy, fz, th, pawTh, L.c);
    }

    // head: follows the birds, bobs with the run, nods with each bark
    head.rotation.y = -P.yaw + shk * 0.12 + Math.sin(s2 + 1) * 0.05 * a;
    head.rotation.z = P.hp - pitch * 0.55 + Math.sin(s2 * 2 + 0.6) * 0.05 * a;
    head.rotation.x = (p.state === 'daze' ? Math.sin(t * 9) * 0.25 : (p.tiltHead || 0) * 0.35) + shk * 0.8 + Math.sin(s2) * 0.07 * a;
    jaw.rotation.z = -Math.max(P.jaw, P.tongue * (0.3 + Math.sin(t * 15) * 0.07));
    tongue.scale.x = 4 + P.tongue * 6; tongue.position.x = 9 + P.tongue * 7; tongue.visible = P.tongue > 0.05 || P.jaw > 0.2;
    tail.rotation.z = P.tailUp;
    tail.rotation.y = wagNow + P.bend * 0.8 + P.shk * Math.sin(t * 30 - 2.4) * 0.5;

    blink = (t % 3.7) < 0.12 || p.state === 'daze' || P.shk > 0.3 ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = lerp(e.scale.y, blink, 0.5); });
    brows.forEach((b, i) => { b.rotation.x = (i ? -1 : 1) * (p.point > 0.5 ? 0.5 : 0.15); b.position.y = 13.4 + (p.barkT > 0 || p.point > 0.5 ? 1.5 : 0); });

    const sq = clamp((p.landT || 0) / 0.22, 0, 1);
    root.scale.set(1 + sq * 0.03, 1 - sq * 0.07, 1 + sq * 0.03);
    root.position.set(p.x, p.z, p.y);
    root.rotation.y = -p.heading;
    // Ears are heavy and she is not falling far: most of her rise and fall carries them with her, and in the air
    // they are not flapped about as they are by a run. Otherwise she takes off with them like wings.
    const air = p.air || p.state === 'hop'; earCalm = lerp(earCalm, air ? 0.2 : 1, 1 - Math.exp(-dt * 12));
    const jz = fresh0 || jumped ? 0 : (p.z - pz) * 0.7; pz = p.z;
    swingEars(dt, jumped ? jx : 0, jumped ? jy : 0, jz, earCalm);
  }
  return { root, update };
}

// ------------------------------------------------------------------ car --
// A little red open-top roadster with one seat in the middle: his.
// where he sits (along the car from its middle, and how high), and how big the car is for bumping into things
export const CAR = { seatX: -24, seatY: 38, half: 95, r: 72 };
export function makeCar() {
  const RED = '#E5463C', RED2 = '#C73A32', CHROME = '#D8DCE4', TYRE = '#2B2D33';
  const root = new THREE.Group(), bodyG = new THREE.Group();
  root.add(bodyG);
  bodyG.add(mesh([
    box(RED, 0, 38, 0, 300, 34, 140),
    box(RED, 98, 58, 0, 110, 14, 132), blob(RED, 150, 42, 0, 22, 21, 68), blob(RED, 96, 62, 0, 62, 9, 62),
    box(RED, -112, 60, 0, 84, 18, 132), blob(RED, -152, 44, 0, 20, 23, 68), blob(RED, -112, 67, 0, 46, 8, 62),
    box(RED2, -8, 63, 66, 122, 18, 9), box(RED2, -8, 63, -66, 122, 18, 9),
    box('#4A3A30', -8, 56.5, 0, 122, 2, 124),
    box('#C89460', -66, 76, 0, 14, 40, 96), box('#C89460', -40, 60, 0, 46, 8, 96), blob('#C89460', -66, 97, 0, 9, 7, 46),
    box(CHROME, 162, 27, 0, 12, 11, 146), box(CHROME, -162, 27, 0, 12, 11, 146),
    box('#33363E', 163, 44, 0, 6, 12, 60),
    blob('#FFF6C8', 164, 48, 46, 9, 12, 13), blob('#FFF6C8', 164, 48, -46, 9, 12, 13),
    blob('#A8201C', -167, 50, 48, 6, 8, 11), blob('#A8201C', -167, 50, -48, 6, 8, 11),
    cyl('#33363E', 30, 70, 0, 2.5, 26, [0, 0, -1.0]),
    blob(RED2, 100, 30, 70, 38, 30, 8), blob(RED2, -100, 30, 70, 38, 30, 8), blob(RED2, 100, 30, -70, 38, 30, 8), blob(RED2, -100, 30, -70, 38, 30, 8),
  ]));
  const glass = new THREE.Mesh(BOX, surf({ color: '#BFE6FF', transparent: true, opacity: 0.45 }));
  glass.scale.set(4, 38, 122); glass.position.set(47, 84, 0); glass.rotation.z = 0.32; bodyG.add(glass);
  bodyG.add(mesh([box(CHROME, 47, 103, 0, 5, 4, 126, [0, 0, 0.32]), box(CHROME, 41, 84, 62, 5, 40, 4, [0, 0, 0.32]), box(CHROME, 41, 84, -62, 5, 40, 4, [0, 0, 0.32])], false));
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(13, 2.6, 8, 20), mat('#33363E'));
  const steer = group(20, 80, 0, wheelRim); steer.rotation.set(0, Math.PI / 2, 0); steer.rotation.order = 'YXZ'; bodyG.add(steer);
  const wheelGeo = merged([cyl(TYRE, 0, 0, 0, 27, 22, [Math.PI / 2, 0, 0]), cyl(CHROME, 0, 0, 0, 13, 24, [Math.PI / 2, 0, 0]), box(TYRE, 0, 0, 0, 5, 22, 25)]);
  const wheels = [[100, 72], [100, -72], [-100, 72], [-100, -72]].map(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, vc()); w.castShadow = true; const gw = group(x, 27, z, w); root.add(gw); return { g: gw, w, front: x > 0 };
  });
  let roll = 0;
  function update(c, t, dt) {
    root.position.set(c.x, 0, c.y); root.rotation.y = -c.heading;
    roll += (c.v * dt) / 27;
    for (const w of wheels) { w.w.rotation.z = -roll; if (w.front) w.g.rotation.y = -c.steer * 0.5; }
    wheelRim.rotation.z = -c.steer * 1.6;
    // the body leans out of a bend, dips under braking and shudders after a bump
    c.lean = lerp(c.lean || 0, clamp(c.steer * c.v / 900, -1, 1) * 0.09, 1 - Math.exp(-dt * 6));
    bodyG.rotation.x = c.lean + (c.bump > 0 ? Math.sin(t * 50) * 0.04 * c.bump : 0);
    bodyG.rotation.z = (c.bump > 0 ? Math.sin(t * 43) * 0.03 * c.bump : 0) + (c.on ? Math.sin(t * 38) * 0.004 : 0);
    bodyG.position.y = c.on ? Math.sin(t * 31) * 0.5 : 0;
  }
  return { root, update };
}

// --------------------------------------------------------------- people --
const LOOKS = [
  { shirt: '#5BA8E6', legs: '#3C4A66', hair: '#6B4226', skin: '#F2C29B' },
  { shirt: '#F28C5C', legs: '#5C6B4A', hair: '#2B2326', skin: '#C98E66' },
  { shirt: '#B48BE0', legs: '#4A4A58', hair: '#E3C06A', skin: '#F6D2B0' },
];
export function makePerson(look) {
  const L = LOOKS[look % LOOKS.length];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legGeo = merged([cyl(L.legs, 0, -42, 0, 9.5, 84), blob('#3A2E2A', 5, -88, 0, 14, 6.5, 9.5)]);
  const armGeo = merged([cyl(L.shirt, 0, -17, 0, 7.5, 34), cyl(L.skin, 0, -46, 0, 5.5, 28), blob(L.skin, 0, -62, 0, 7.5)]);
  const part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, vc()); m.castShadow = true; return group(x, y, z, m); };
  const legs = [part(legGeo, 0, 94, 11), part(legGeo, 0, 94, -11)];
  const arms = [part(armGeo, 0, 160, 31), part(armGeo, 0, 160, -31)];
  const top = group(0, 94, 0, mesh([
    blob(L.shirt, 0, 38, 0, 21, 42, 28), blob(L.legs, 0, 4, 0, 19, 14, 25),
    blob(L.skin, 0, 82, 0, 8, 10, 8),
    blob(L.skin, 0, 100, 0, 21, 23, 21), blob(L.hair, -4, 107, 0, 22, 19, 22.5), blob(L.skin, 21, 98, 0, 3.5, 3.5, 3.5),
    blob('#2A1C14', 19, 103, 8, 2.6, 3.2, 2.6), blob('#2A1C14', 19, 103, -8, 2.6, 3.2, 2.6),
    blob('#C4605A', 19.5, 91, 0, 2.5, 2, 6),
  ]));
  arms.forEach((a) => { a.position.y = 66; top.add(a); });
  body.add(top, ...legs);
  const S = { legA: 0, legB: 0, armA: 0, armB: 0, lean: 0, y: 0, sit: 0, out: 0 };
  function update(o, t) {
    const T = { legA: 0, legB: 0, armA: 0, armB: 0, lean: 0, y: 0, sit: 0, out: 0.06 };
    const sw = Math.sin(t * 7 + o.seed);
    if (o.state === 'walk') { T.legA = sw * 0.5; T.legB = -sw * 0.5; T.armA = -sw * 0.4; T.armB = sw * 0.4; }
    else if (o.state === 'wobble') { const f = Math.sin(t * 19); T.lean = 0.16 + f * 0.05; T.armA = 1.0 + f * 0.7; T.armB = 1.0 - f * 0.7; T.out = 0.7; T.legA = 0.12; T.legB = -0.2; }
    else if (o.state === 'sit') { T.sit = 1; T.lean = 0.2; T.armA = T.armB = -0.7; T.out = 0.35; }
    else if (o.state === 'hop') { const k = clamp(o.t / 0.45, 0, 1); T.y = Math.sin(k * Math.PI) * 46; T.armA = T.armB = 2.4; T.out = 0.5; T.legA = 0.5; T.legB = -0.4; }
    else if (o.wave > 0) { T.armA = 2.7 + Math.sin(t * 12) * 0.35; T.out = 0.3; }
    for (const n in T) S[n] = lerp(S[n], T[n], n === 'y' ? 1 : 0.22);
    body.position.y = S.y - S.sit * 80;
    top.rotation.z = S.lean;
    legs[0].rotation.z = S.legA + S.sit * 1.45; legs[1].rotation.z = S.legB + S.sit * 1.5;
    arms[0].rotation.z = S.armA; arms[1].rotation.z = S.armB;
    arms[0].rotation.x = -S.out; arms[1].rotation.x = S.out;
    root.position.set(o.x, 0, o.y); root.rotation.y = -o.heading;
  }
  return { root, update };
}

// ---------------------------------------------------------------- birds --
const BIRD = [['#8E9AAF', '#6F7B91'], ['#B9BDC6', '#8A8F9C'], ['#A08872', '#7C6654']];
export function makeBird(color) {
  const [c1, c2] = BIRD[color % BIRD.length];
  const root = new THREE.Group(), bodyG = new THREE.Group(); root.add(bodyG);
  bodyG.add(mesh([blob(c1, 0, 12, 0, 13, 9, 9), blob(c1, 10, 21, 0, 6.5), blob('#F2A33A', 17.5, 20, 0, 4, 1.8, 1.8), blob(c2, -15, 12, 0, 9, 2.5, 5), blob('#22252B', 13, 23, 4.5, 1.3), blob('#22252B', 13, 23, -4.5, 1.3), blob('#7BC8A4', 6, 16, 0, 5.5, 4, 6)]));
  const wings = [1, -1].map((s) => { const w = group(-1, 16, s * 6, mesh([blob(c2, -2, 0, s * 11, 9, 1.6, 12)], false)); bodyG.add(w); return w; });
  function update(b, t, air) {
    const fold = air ? Math.sin(t * 27 + b.ph) * 0.95 - 0.1 : 1.25;
    wings[0].rotation.x = fold; wings[1].rotation.x = -fold;
    // on the ground: peck, peck, look about
    const peck = air ? 0 : Math.max(0, Math.sin(t * 2.6 + b.ph * 3)) ** 6;
    bodyG.rotation.z = air ? 0.15 : -peck * 0.75;
    bodyG.position.y = air ? 0 : Math.abs(Math.sin(t * 5 + b.ph)) * (peck > 0.05 ? 0 : 1.5);
  }
  return { root, update };
}

// ---------------------------------------------------------------- props --
// Each prop is root (place, facing) > tip (falls over about its foot) > spin (tumbles about its middle).
export function makeProp(kind) {
  const root = new THREE.Group(), tip = new THREE.Group(), spin = new THREE.Group();
  root.add(tip); tip.add(spin);
  let parts, mid = 0;
  if (kind === 'cone') parts = [box('#FF7A2E', 0, 2, 0, 36, 4, 36), { geo: CONE, color: '#FF7A2E', at: [0, 25, 0], scale: [15, 44, 15], flat: true }, cyl('#ffffff', 0, 24, 0, 11.2, 9)];
  else if (kind === 'bin') parts = [cyl('#7C8792', 0, 32, 0, 25, 62), cyl('#5D6772', 0, 65, 0, 28.5, 6), blob('#5D6772', 0, 70, 0, 6, 4, 6), cyl('#69737E', 0, 20, 0, 25.6, 4), cyl('#69737E', 0, 44, 0, 25.6, 4)];
  else if (kind === 'box') { mid = 22; parts = [box('#C99A62', 0, 0, 0, 44, 44, 44), box('#E8D2A6', 0, 0, 0, 12, 45, 45), box('#B5854E', 0, -14, 22.4, 16, 10, 1)]; }
  else if (kind === 'pot') parts = [{ geo: CONE, color: '#C9683F', at: [0, 15, 0], scale: [20, 30, 20], rot: [Math.PI, 0, 0], flat: true }, cyl('#D97B50', 0, 30, 0, 22, 6), cyl('#5A4636', 0, 32.5, 0, 18, 2),
    blob('#4FA653', 0, 42, 0, 12, 10, 12), blob('#FF7FA0', 7, 52, 3, 6.5), blob('#FFD23F', -6, 54, -4, 6), blob('#FF7FA0', -2, 50, 8, 5.5), blob('#ffffff', 2, 57, -3, 5)];
  else if (kind === 'plate') parts = [cyl('#ffffff', 0, 1.5, 0, 17, 3), cyl('#E9EDF2', 0, 3, 0, 12, 1), blob('#F6A6C1', 0, 9, 0, 9, 6.5, 9), blob('#E0453A', 0, 16, 0, 3)];
  else { mid = 13; parts = [blob('#D7E84A', 0, 0, 0, 13), { geo: new THREE.TorusGeometry(12.6, 1.2, 6, 20), color: '#ffffff', at: [0, 0, 0], scale: [1, 1, 1], rot: [0.5, 0.4, 0], flat: true }]; }
  spin.position.y = mid; spin.add(mesh(parts));
  return { root, tip, spin };
}
// What is left of something that broke.
export function makeShards(kind) {
  const c = kind === 'pot' ? ['#C9683F', '#D97B50', '#5A4636', '#4FA653', '#FF7FA0'] : kind === 'bin' ? ['#F4E9B0', '#ffffff', '#8FB7E0', '#E8B04A', '#C9D1D9'] : ['#ffffff', '#E9EDF2', '#F6A6C1', '#ffffff', '#E0453A'];
  const parts = [], wide = kind === 'bin' ? 2.4 : 1;
  for (let i = 0; i < 9; i++) { const a = i * 2.4, d = (6 + ((i * 7) % 5) * 5) * wide; parts.push(box(c[i % c.length], Math.cos(a) * d, 1.8, Math.sin(a) * d, 9 - (i % 3) * 2, 3, 6 + (i % 2) * 3, [0, a, 0.25])); }
  if (kind === 'bin') parts.push(blob('#F2D24A', 14, 3, -8, 9, 3, 4, [0, 0.6, 0]), blob('#7A4A2A', -16, 3, 10, 5, 3, 5));
  if (kind === 'pot') parts.push(blob('#5A4636', 0, 1, 0, 20, 2.5, 16));
  return mesh(parts);
}

// ------------------------------------------------------------- scenery --
const CANOPY = [['#4FA653', '#6CC06A', '#96DB8A'], ['#57B56B', '#74CF82', '#9BE39C'], ['#3FA36A', '#5CC088', '#86DBA6'], ['#62B84A', '#82D160', '#A9E684']];
const canopyGeo = new Map();
export function canopyGeometry(hue) {
  if (!canopyGeo.has(hue)) {
    const [d, m, l] = CANOPY[hue % CANOPY.length];
    canopyGeo.set(hue, merged([
      blob(d, -50, 168, 0, 56), blob(d, 50, 168, 0, 56), blob(d, 0, 165, -34, 58),
      blob(m, 0, 222, 0, 68), blob(m, 0, 162, 32, 60), blob(l, -20, 262, 22, 30), blob(l, 30, 215, 44, 17),
    ]));
  }
  return canopyGeo.get(hue);
}
export const trunkGeometry = new THREE.CylinderGeometry(14, 19, 140, 10).translate(0, 70, 0);

export function platformGeometry(o) {
  const WOOD = '#B98248', WOOD2 = '#9A6A3A';
  if (o.kind === 'bench') return merged([
    box(WOOD, 0, 39, 0, 122, 6, 44), box(WOOD, 0, 62, -20, 122, 26, 5), box(WOOD2, -48, 19, 0, 7, 38, 38), box(WOOD2, 48, 19, 0, 7, 38, 38),
    box(WOOD2, -48, 56, -20, 6, 40, 6), box(WOOD2, 48, 56, -20, 6, 40, 6),
  ]);
  if (o.kind === 'table') return merged([
    cyl('#E0453A', 0, 56, 0, o.r, 7), cyl('#ffffff', 0, 52, 0, o.r + 3, 3), cyl(WOOD2, 0, 27, 0, 11, 54), cyl(WOOD2, 0, 3, 0, 40, 6),
    ...[0, 1, 2, 3, 4, 5].map((i) => blob('#ffffff', Math.cos(i * 1.047) * (o.r - 16), 60, Math.sin(i * 1.047) * (o.r - 16), 9, 0.6, 9)),
  ]);
  return null;
}
export const lampGeometry = merged([cyl('#4A5560', 0, 100, 0, 4.5, 200), cyl('#4A5560', 0, 5, 0, 10, 10), box('#4A5560', 0, 200, 14, 5, 5, 34), blob('#FFF2B8', 0, 193, 28, 12, 9, 12)]);
export const flowerGeometry = (color) => merged([cyl('#4FA653', 0, 6, 0, 1.2, 12), blob(color, 0, 13, 0, 5, 3, 5), blob('#FFD23F', 0, 14.5, 0, 2)]);

export function makeHouse(h) {
  const wall = h.color, w = h.w, d = h.d, hh = h.h;
  const roofGeo = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1).rotateY(Math.PI / 4);
  const parts = [
    box(wall, 0, hh / 2, 0, w, hh, d),
    { geo: roofGeo, color: h.roof, at: [0, hh + 45, 0], scale: [w * 0.78, 90, d * 0.82], flat: true },
    box('#8A5A3C', -w * 0.22, 46, d / 2 + 1, 44, 92, 4), blob('#FFD23F', -w * 0.22 + 14, 46, d / 2 + 4, 3),
    box('#ffffff', w * 0.18, 78, d / 2 + 1, 76, 66, 4), box('#9FD4F2', w * 0.18, 78, d / 2 + 2.5, 64, 54, 3),
    box('#ffffff', w * 0.18, 78, d / 2 + 4, 4, 54, 2), box('#ffffff', w * 0.18, 78, d / 2 + 4, 64, 4, 2),
    box('#B9B4A8', -w * 0.22, 3, d / 2 + 22, 60, 6, 40),
  ];
  if (hh > 225) for (const x of [-0.22, 0.18]) parts.push(box('#ffffff', w * x, 178, d / 2 + 1, 62, 52, 4), box('#9FD4F2', w * x, 178, d / 2 + 2.5, 50, 40, 3));
  const m = mesh(parts); m.position.set(h.x, 0, h.y); m.receiveShadow = true;
  return m;
}
