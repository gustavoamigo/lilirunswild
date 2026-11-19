// 3D models, all built from simple primitives. No model files to load.
// Every model faces +x and stands on y = 0.
import * as THREE from '../vendor/three.module.min.js';
import { STYLE } from './style.js';
import { clamp, lerp } from './util.js';
import { MOVES, GAITS, STRIDE, BONES } from './moves.js';

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
// Flat out (zoomies) she plays the simulated gallop (GAITS.gallop in moves.js) whole: legs, body, neck, head and tail.
// Its stride covers its own length; the tempo follows the ground she covers, within these shares of its own tempo.
// Walk and trot stay hand-made: on her toy-like body the simulated trot looked uncanny.
const GAL = GAITS.gallop, GALLOP_FROM = 260, TEMPO = [0.75, 1.5];
// A dog holds its head steady as it runs; the simulated one has no eyes to steady, so its neck and head swing far.
// She keeps their average carriage and this share of the swing about it.
const HEAD_KEEP = 0.35;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const NECK_MID = mean(GAL.neck), HEAD_MID = mean(GAL.head);
const HEAD = [46, 72], NECK = [37, 62];                 // the head's joint, and the root of the neck it swings about
const EAR_SEG = 9.5, EAR_G = 1500, EAR_DRAG = 14, EAR_SPRING = [16, 7, 4, 3];
// The wind of her own speed pushes the ears back: this much push (units/s²) for each unit/s the head moves, up to
// WIND_TOP. Flat out (460) it is about as strong as gravity, so they stream back at some 45°; in the car, flatter.
const EAR_WIND = 3, WIND_TOP = 1000;
// Gusts: the line the wind hangs an ear along wavers, up and down and in and out, by up to this much (radians) at full
// gallop and more in the car, mostly at the tip, in slow uneven waves
const GUST = 0.9, GUST_AT = 600;
const EAR_FLAT = [0.25, 0.6, 0.85, 1];      // for each piece of an ear, how far its flat faces her body's side rather than her head's
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _inv = new THREE.Matrix4(), _rot = new THREE.Matrix4(), _p = new THREE.Vector3(), _side = new THREE.Vector3(), _t = new THREE.Vector3(), _o = new THREE.Vector3(), Z_AXIS = new THREE.Vector3(0, 0, 1), X_AXIS = new THREE.Vector3(1, 0, 0);

// An ear's skin: a flat, rounded flap along a smooth curve through the root and the chain's four points. Its cross-section
// is an ellipse, wide across the ear and thin through it; it is narrow at the root, broadest two thirds of the way down,
// rounded off at the tip. Which way the flat faces turns from the head's side at the root to the body's side further down
// (EAR_FLAT), and the flap sits a little out from the line, as the old separate pieces did.
const EAR_K = 18, EAR_R = 12;
let earMat;
function earSkin() {
  const n = (EAR_K + 1) * EAR_R, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = [];
  for (let k = 0; k < EAR_K; k++) for (let r = 0; r < EAR_R; r++) {
    const a = k * EAR_R + r, b = k * EAR_R + (r + 1) % EAR_R, c = a + EAR_R, d = b + EAR_R;
    idx.push(a, c, b, b, c, d);
  }
  const base = new THREE.Color(EAR);
  for (let k = 0; k <= EAR_K; k++) for (let r = 0; r < EAR_R; r++) {
    const v = 0.9 + 0.12 * (1 - k / EAR_K), o = (k * EAR_R + r) * 3;          // a touch lighter at the root
    col[o] = base.r * v; col[o + 1] = base.g * v; col[o + 2] = base.b * v;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  // drawn from both sides: in a gallop the flap twists, and a one-sided surface showed holes
  const m = new THREE.Mesh(geo, earMat ||= mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide })); m.castShadow = true; m.frustumCulled = false;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
  const C = new THREE.Vector3(), T = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Zv = new THREE.Vector3();
  return {
    mesh: m,
    update(top, ends, s, bodySide) {
      curve.points[0].copy(top); for (let i = 0; i < 4; i++) curve.points[i + 1].copy(ends[i]);
      for (let k = 0; k <= EAR_K; k++) {
        const u = k / EAR_K;
        curve.getPointAt(u, C); curve.getTangentAt(u, T);
        // width and thickness along the ear, and how far out from the line
        // the root is closed off and sunk into the skull (it was an open end beside the head, which could be seen into, and a
        // gap showed between ear and head); the flap then comes out of the head and hangs clear of the collar
        const cap = Math.sqrt(Math.min(1, u / 0.07));
        const w = ((u < 0.65 ? 6 + 4.8 * Math.sin((u / 0.65) * Math.PI / 2) : 10.8 * Math.sqrt(Math.max(0, 1 - ((u - 0.65) / 0.36) ** 2))) + 0.3) * cap;
        const th = Math.max(0.8 * cap, w * 0.62), out = -3 + 9 * Math.min(1, u / 0.35) - 3 * Math.max(0, u - 0.35);
        const f = u * 3, fi = Math.min(2, Math.floor(f)), flat = EAR_FLAT[fi] + (EAR_FLAT[fi + 1] - EAR_FLAT[fi]) * (f - fi);
        Y.copy(T).negate();
        Zv.copy(Z_AXIS).lerp(bodySide, flat).normalize();
        X.crossVectors(Y, Zv); if (X.lengthSq() < 0.01) X.copy(X_AXIS); X.normalize(); Zv.crossVectors(X, Y);
        for (let r = 0; r < EAR_R; r++) {
          const a = (r / EAR_R) * Math.PI * 2, cx = Math.cos(a) * w, cz = Math.sin(a) * th + s * out, o = (k * EAR_R + r) * 3;
          pos[o] = C.x + X.x * cx + Zv.x * cz; pos[o + 1] = C.y + X.y * cx + Zv.y * cz; pos[o + 2] = C.z + X.z * cx + Zv.z * cz;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
  };
}

// The eye's surface, painted once: white, a warm brown iris (darker at its rim), a big dark pupil, two shines, and a dark
// line along the top. On a sphere's texture the front (+x) is the middle (u 0.5, v 0.5), and near it a pixel is the same
// angle across and down (512 x 256), so circles drawn there stay round on the ball.
const EYE_GEO = new THREE.SphereGeometry(1, 40, 28);
let eyeMat = null;
function eyeMaterial() {
  if (eyeMat) return eyeMat;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d'), cx = 256, cy = 128, k = 512 / (Math.PI * 2);   // pixels per radian
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 512, 256);
  const ir = 0.72 * k, iris = c.createRadialGradient(cx, cy - ir * 0.25, ir * 0.1, cx, cy, ir);
  iris.addColorStop(0, '#C8925A'); iris.addColorStop(0.65, '#8A5A2E'); iris.addColorStop(1, '#4A2C14');
  c.fillStyle = iris; c.beginPath(); c.arc(cx, cy, ir, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1A0F08'; c.beginPath(); c.arc(cx, cy, ir * 0.52, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#FFFFFF';
  c.beginPath(); c.arc(cx - ir * 0.32, cy - ir * 0.38, ir * 0.24, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + ir * 0.34, cy + ir * 0.36, ir * 0.11, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3A2416'; c.fillRect(0, 0, 512, 256 * 0.17);                          // the line along the top
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  eyeMat = surf({ map: tex, roughness: 0.25 });
  return eyeMat;
}

// A smooth shape along x (forward): at each x a cross-section ellipse, centred at height cy, half-height ry, half-width
// rz; the profile points [x, cy, ry, rz] are joined by smooth curves (Catmull-Rom) and the ends close in round caps.
// `paint(x, y, z)` gives each point's colour, so markings are part of the one surface.
const _pc = new THREE.Color();
// [cy, ry, rz] of a swept shape's cross-section at x
function profileAt(pts, x) {
  let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < x) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  const e = clamp((x - p1[0]) / (p2[0] - p1[0] || 1), 0, 1), e2 = e * e, e3 = e2 * e;
  const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * e + (2 * a - 5 * b + 4 * c - d) * e2 + (3 * b - a - 3 * c + d) * e3);
  return [1, 2, 3].map((k) => cr(p0[k], p1[k], p2[k], p3[k]));
}
function sweptGeo(pts, paint, along = 90, around = 56) {
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const at = (x) => profileAt(pts, x);
  const pos = [], col = [], idx = [], c = new THREE.Color();
  for (let a = 0; a <= along; a++) {
    // rings bunched towards the ends, where the caps curve fastest
    const t = a / along, u = (1 - Math.cos(t * Math.PI)) / 2, x = lerp(x0, x1, u);
    const [cy, ry, rz] = at(x), tip = a === 0 || a === along;    // the end rings close to a point
    for (let b = 0; b < around; b++) {
      const th = (b / around) * Math.PI * 2, y = cy + (tip ? 0 : Math.cos(th) * Math.max(ry, 0.05)), z = tip ? 0 : Math.sin(th) * Math.max(rz, 0.05);
      const p = paint(x, y, z);
      if (Array.isArray(p)) c.set(p[0]).lerp(_pc.set(p[1]), p[2]); else c.set(p);
      pos.push(x, y, z); col.push(c.r, c.g, c.b);
    }
  }
  for (let a = 0; a < along; a++) for (let b = 0; b < around; b++) {
    const p = a * around + b, q = a * around + (b + 1) % around;
    idx.push(p, q, p + around, q, q + around, p + around);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Lili's head: a domed skull, a stop below the eyes, a square muzzle, the nose at its end. Brown over each eye and ear, a
// white blaze from the nose up over the crown, freckles on the muzzle, the nose leather at the tip.
const FRECKLES = [[28, 0, 8.2], [24.5, -2.5, 9], [29, -4, 7.2], [26, 2, 8.6], [31, -1.5, 6.6]];
const HEAD_PROFILE = [
  [-13.5, 7, 0, 0], [-10, 7, 11, 12], [-3, 7, 15.5, 15], [6, 6, 15, 14.5], [13, 3, 12, 12], [18, 0.5, 9.5, 10.5],
  [24, -0.5, 8.6, 9.4], [30, 0, 7.6, 8.2], [34, 1, 6, 6.4], [37.6, 1.8, 0, 0],
];
const HEAD_GEO = sweptGeo(HEAD_PROFILE, (x, y, z) => {
  const az = Math.abs(z), soft = (d, w) => clamp(0.5 - d / w, 0, 1);                     // 1 inside, 0 outside, a soft edge w wide
  const nose = soft(Math.hypot((x - 37) / 3.2, (y - 2.5) / 4.2, az / 4.6) - 1, 0.25);     // the nose leather, at the tip
  if (nose > 0) return [x > 18 && y < -4 ? FEATHER : COAT, NOSE, Math.min(1, nose * 2)];
  let fr = 0;
  for (const [fx, fy, fz] of FRECKLES) fr = Math.max(fr, soft(Math.hypot(x - fx, y - fy, az - fz) - 1.1, 0.7));
  const blaze = 2.8 + Math.max(0, x - 4) * 0.12;                                          // the white blaze, wider down the muzzle
  const patch = Math.min(soft(blaze - az, 1.6), soft(x - 16, 3), soft(-6 - y, 2));        // brown over the eyes, cheeks and ears
  const base = x > 18 && y < -4 ? FEATHER : COAT;
  const brow = soft(Math.hypot((x - 10.5) / 2.4, (y - 15.4) / 1.2, (az - 7.6) / 3) - 1, 0.5);   // a soft lighter mark over each eye
  if (brow > 0 && patch > 0.5) return [LIVER, '#8A5A3E', Math.min(1, brow * 2)];
  return [base, LIVER, Math.min(1, Math.max(patch, fr) * 2)];
}, 220, 96);
// her tongue: flat and wide, thinner at the edges, a rounded tip, a darker groove along its middle
const TONGUE_GEO = sweptGeo([[0, 0, 0, 0], [1.5, 0, 0.9, 3.3], [8, -0.3, 0.9, 3.8], [13, -0.9, 0.8, 3.4], [15.5, -1.2, 0, 0]],
  (x, y, z) => (Math.abs(z) < 0.5 && y > -0.6 ? '#D96479' : '#F28AA0'), 40, 24);
// flat along the jaw for its first 7, then curving down over the lip (bent around a circle of radius 9), so no part of it
// goes through the jaw when it hangs out
{
  const P = TONGUE_GEO.attributes.position, R = 9, B = 7;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    if (x <= B) continue;
    const th = (x - B) / R;
    P.setXY(i, B + (R + y) * Math.sin(th), -R + (R + y) * Math.cos(th));
  }
  TONGUE_GEO.computeVertexNormals();
}
// her lower jaw: a short rounded wedge under the muzzle, opened for a bark or panting
const JAW_GEO = sweptGeo([[-1, 0, 0, 0], [2, -0.5, 3.4, 6], [10, -1, 3.6, 6.4], [17, -0.8, 2.8, 5], [20, -0.5, 0, 0]], () => FEATHER, 40, 32);

// Where an eye sits: a round eyeball of radius EYE_R behind the skin of the head, only a shallow cap (EYE_CAP) showing
// through it, as a real eye in its socket. The skin's point and its outward normal come from the head's profile; the
// ball's centre is that far in along the normal, and the iris faces along the normal, turned a little forward.
const EYE_R = 4.2, EYE_CAP = 1.6, EYE_AT = [10.5, 8.6];       // height and how far from the middle: on the front of the skull, facing forward
function eyeSocket(s) {
  const F = (px, py, pz) => { const [cy, ry, rz] = profileAt(HEAD_PROFILE, px); return ((py - cy) / ry) ** 2 + (pz / rz) ** 2 - 1; };
  // coming back from the nose, the first point of the head at that height and spacing: the front of the skull
  const y = EYE_AT[0], z = s * EYE_AT[1];
  let x = 37; while (x > 0 && F(x, y, z) > 0) x -= 0.05;
  const h = 0.01, n = new THREE.Vector3((F(x + h, y, z) - F(x - h, y, z)) / (2 * h), (F(x, y + h, z) - F(x, y - h, z)) / (2 * h), (F(x, y, z + h) - F(x, y, z - h)) / (2 * h)).normalize();
  return { at: new THREE.Vector3(x, y, z).addScaledVector(n, -(EYE_R - EYE_CAP)), look: n.clone().add(new THREE.Vector3(0.3, -0.1, 0)).normalize() };
}

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
  const body = mesh([{ geo: torsoGeo([[-2, 46.5, 34, 17.5, 16], [0, 32, 26, 6, 10], [-26, 47.5, 20, 18.5, 17], [22, 46.5, 21, 20.5, 17.5]], -45.9, 42.9), color: COAT, at: [0, 0, 0], scale: [1, 1, 1] },
    blob(LIVER, -6, 62.6, 5, 4.2, 1.8, 2.6, [0, 0.5, 0]), blob(LIVER, 1, 63, 1, 3, 1.6, 2.2, [0, 0.5, 0]),   // two small marks on her back
    blob(LIVER, -38.5, 58.5, 0, 8, 6.5, 7.5, [0, 0, -0.8])]);                                              // and a brown patch where the tail begins
  body.frustumCulled = false;
  const bodyAt = body.geometry.attributes.position, bodyN = body.geometry.attributes.normal, body0 = bodyAt.array.slice(), bodyN0 = bodyN.array.slice();
  const _mf = new THREE.Matrix4(), _mr = new THREE.Matrix4();
  // A shake is a twist about her spine that starts at the head and runs down her back to the tail: each part
  // rolls one way and the other about five times a second, the next part a little behind it. shakeAt gives the
  // roll at a place along her (0 her head, 1 the tip of her tail), sT seconds into the shake.
  const shakeAt = (sT, u) => { const q = clamp((sT - 0.4 * u) / 0.95, 0, 1); return Math.sin(Math.PI * q) ** 0.7 * Math.sin(sT * 30 - 1.9 * u); };
  function bendBody(sT) {
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
      if (sT < 1.5) {                                                               // her skin rolls round her as she shakes
        const th = -0.8 * shakeAt(sT, 0.1 + (43 - x) / 89 * 0.4), c = Math.cos(th), sn = Math.sin(th);
        const py = bodyAt.array[i + 1] - SPINE_Y, pz = bodyAt.array[i + 2], qy = bodyN.array[i + 1], qz = bodyN.array[i + 2];
        bodyAt.array[i + 1] = SPINE_Y + py * c - pz * sn; bodyAt.array[i + 2] = py * sn + pz * c + th * 4;
        bodyN.array[i + 1] = qy * c - qz * sn; bodyN.array[i + 2] = qy * sn + qz * c;
      }
    }
    bodyAt.needsUpdate = bodyN.needsUpdate = true;
  }
  g.add(body);
  // the neck, from the chest up to the head (a separate oval of feathering on the chest stood out like a lump: gone)
  foreIn.add(mesh([blob(COAT, 37, 60, 0, 13, 19, 13, [0, 0, -0.6])]));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(12.5, 3, 8, 20), mat('#E9B9B4'));
  collar.rotation.set(Math.PI / 2, 0, 0); const collarG = group(39, 62, 0, collar); collarG.rotation.z = -0.6;
  const tag = ball('#C4CAD3', 3.2, 3.2, 1.5, 49, 53, 0);

  // head
  const head = group(HEAD[0], HEAD[1], 0);
  head.scale.setScalar(1.1);
  // the head: one smooth surface from the back of the skull to the tip of the nose, its markings painted on (headGeo)
  const headMesh = new THREE.Mesh(HEAD_GEO, vc()); head.add(headMesh);
  // Her head is 42 000 triangles, more than the rest of her: drawn again for her shadow, it was most of her cost. Its
  // shadow is cast by a plain egg the size of it instead, seen by nothing else (no colour, no depth).
  const headBox = HEAD_GEO.boundingBox || (HEAD_GEO.computeBoundingBox(), HEAD_GEO.boundingBox), hs = headBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const headShadow = new THREE.Mesh(SPH_LO, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  headShadow.scale.copy(hs); headBox.getCenter(headShadow.position); headShadow.castShadow = true; head.add(headShadow);
  const eyes = [1, -1].map((s) => {
    // one eyeball, its iris, pupil, shine and the dark line along its top painted on it (eyeTexture), looking forward
    const { at, look } = eyeSocket(s);
    const ball1 = new THREE.Mesh(EYE_GEO, eyeMaterial()); ball1.scale.setScalar(EYE_R);
    ball1.quaternion.setFromUnitVectors(X_AXIS, look);  // the painted iris faces out through the skin
    const e = group(at.x, at.y, at.z, ball1);
    head.add(e); return e;
  });
  const jawMesh = new THREE.Mesh(JAW_GEO, vc()); jawMesh.castShadow = true;
  const jaw = group(12, -6, 0, jawMesh);
  const bite = new THREE.Object3D(); bite.position.set(15, 2.5, 0); jaw.add(bite);   // where what she carries is held: between her front teeth
  // the tongue: one flat, soft shape with a rounded tip and a groove down its middle, rooted at the back of the jaw; out,
  // it slides forward and hangs down over her lower lip
  const tongueMesh = new THREE.Mesh(TONGUE_GEO, vc()); tongueMesh.castShadow = true;
  const tongue = group(4, 3.2, 0, tongueMesh); jaw.add(tongue);      // lying on the jaw, not inside it (the jaw's white covered it)
  head.add(jaw);
  // ears: four soft pieces hung one from the next. They are not posed: they hang, swing and stream (swingEars).
  // Each ear is one smooth flap (earSkin) bent through the swinging chain, not separate pieces.
  const ears = [1, -1].map((s) => {
    const skin = earSkin(); head.add(skin.mesh);
    return { s, skin, ends: [0, 1, 2, 3].map(() => new THREE.Vector3()), top: new THREE.Vector3(-1, 15.5, s * 12.2), pts: null, was: null };
  });
  const tail = group(-43, 52, 0, mesh([{ ...blob(COAT, -18, 2, 0, 22, 4.4, 4.6), geo: TAIL }, blob(LIVER, -3, 3, 0, 7.5, 4.4, 4.9)]));
  foreIn.add(collarG, tag, head); rearIn.add(tail);

  // legs: three bones and a paw. Each bone hangs down from its joint, so its angle is how far it is swung forward.
  const g3 = (...parts) => merged(parts);
  const [fa, fb, fc] = FORE, [ha, hb, hc] = HIND;
  // Each bone is one smooth tapered limb (limbGeo: rounded over the joint at the top, r0 there, r1 at the far end) whose far end
  // is as thick as the next bone's top, so the joints flow into each other instead of showing as separate eggs.
  const limb = (len, r0, r1, depth = 1) => { const g = limbGeo(len, r0, r1).clone(); g.scale(depth, 1, 1); return merged([{ geo: g, color: COAT, at: [0, 0, 0], scale: [1, 1, 1] }]); };
  const boneGeo = {
    fore: [limb(fa, 7.2, 5.4), limb(fb, 5.4, 4.5), limb(fc, 4.5, 4.4)],
    hind: [limb(ha, 10.5, 6.2, 1.15), limb(hb, 6.2, 4.4), limb(hc, 4.4, 4.2)],    // a broad ham, deeper than wide
  };
  // a paw: low and rounded, toes forward, merging into the bone above
  const pawGeo = merged([blob(FEATHER, 2.5, -0.5, 0, 7.6, 4, 6.4), blob(FEATHER, -1, 1.5, 0, 5, 4, 5)]);
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

  // One moment of the simulated gallop at phase f (0 to 1, round and round), read into G.
  const G = new Float32Array(STRIDE);
  let gTail = 0, gNeck = 0, gHead = 0;   // how far it has swung her tail, neck and head up
  function stride(f) {
    const q = frac(f) * GAL.n, i = Math.floor(q) % GAL.n, i1 = (i + 1) % GAL.n, e = q - Math.floor(q);
    for (let j = 0; j < STRIDE; j++) G[j] = lerp(GAL.f[i * STRIDE + j], GAL.f[i1 * STRIDE + j], e);
    const at = (a) => lerp(a[i], a[i1], e);
    gTail = at(GAL.tail); gNeck = NECK_MID + (at(GAL.neck) - NECK_MID) * HEAD_KEEP; gHead = HEAD_MID + (at(GAL.head) - HEAD_MID) * HEAD_KEEP;
  }

  // Each ear is a little chain with weight. The head drags its top end about; the rest follows late,
  // falls under gravity and is held back by the air, so it streams out behind a run, flies up in a
  // fall (a little: see update), swings forward when she brakes and slaps about when she shakes her head.
  function swingEars(dt, jx, jy, jz, calm, fling = 0) {
    const still = 1 - calm;              // in the air: stiffer and more damped, so they ride along instead of whipping about
    head.updateWorldMatrix(true, false); _inv.copy(head.matrixWorld).invert();
    const len = EAR_SEG * _a.setFromMatrixScale(head.matrixWorld).y, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, keep = Math.exp(-h * EAR_DRAG * (1 + 0.6 * still));
    earT += dt;
    const me = head.matrixWorld.elements, side = Math.hypot(me[8], me[9], me[10]) || 1;
    const re = root.matrixWorld.elements, bodySide = _side.set(re[8], re[9], re[10]).transformDirection(_inv);   // her body's sideways, as the head sees it
    for (const e of ears) {
      const top = _a.copy(e.top).applyMatrix4(head.matrixWorld);
      if (!e.pts) { e.pts = e.ends.map((_, i) => top.clone().setY(top.y - (i + 1) * len)); e.was = e.pts.map((q) => q.clone()); e.at = top.clone(); e.wx = e.wz = 0; }
      else if (jx || jy || jz) for (let i = 0; i < 4; i++) { e.pts[i].x += jx; e.pts[i].z += jy; e.was[i].x += jx; e.was[i].z += jy; e.pts[i].y += jz; e.was[i].y += jz; }
      // how fast the head is going over the ground (a jump in position is not speed), smoothed over a few frames
      if (dt > 0 && !(jx || jy)) {
        const vx = (top.x - e.at.x) / dt, vz = (top.z - e.at.z) / dt, v = Math.hypot(vx, vz), s = v > WIND_TOP ? WIND_TOP / v : 1, kw = 1 - Math.exp(-dt * 8);
        e.wx = lerp(e.wx, vx * s, kw); e.wz = lerp(e.wz, vz * s, kw);
      }
      // the head moves a whole frame at once, but within the frame the ear's root goes there step by step: dragged
      // the whole way in the first step, the ear would take it as speed and fly forward (fast in the car)
      const prev = _p.copy(jx || jy || !e.at ? top : e.at);
      e.at.copy(top);
      const fx = -e.wx * EAR_WIND, fz = -e.wz * EAR_WIND, fl = Math.hypot(fx, EAR_G, fz), wdx = fx / fl, wdy = -EAR_G / fl, wdz = fz / fl;
      // the air lifts the ear out to its side of her, across the way she is going, whichever way her head is turned
      const ws = Math.hypot(e.wx, e.wz), hx = me[8] / side * e.s, hz = me[10] / side * e.s;
      let ox = hx, oz = hz;
      if (ws > 1) { const ux = e.wx / ws, uz = e.wz / ws, along = hx * ux + hz * uz; ox = hx - along * ux; oz = hz - along * uz; }
      const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
      // the gust now: how far the ear's line is turned up (along the wind's own up, ux uy uz) and out (ox, oz)
      const g = GUST * Math.min(1.5, ws / GUST_AT) * calm, ph = e.s * 1.7, tt = earT;
      const gu = g * (0.55 * Math.sin(tt * 6.3 + ph) + 0.3 * Math.sin(tt * 10.7 + ph * 2.1) + 0.15 * Math.sin(tt * 18.2 + ph * 3.3));
      const go = g * 0.7 * (0.6 * Math.sin(tt * 5.1 + ph * 1.3 + 1) + 0.4 * Math.sin(tt * 13.9 + ph * 0.7 + 2));
      const ux = -wdx * wdy, uy = 1 - wdy * wdy, uz = -wdz * wdy, ul = Math.hypot(ux, uy, uz) || 1;   // up, square to the line
      for (let k = 0; k < n && dt > 0; k++) {
        const tk = _t.lerpVectors(prev, top, (k + 1) / n), off = _o.subVectors(top, tk);   // the root now, and how far the head has still to go
        for (let i = 0; i < 4; i++) {
          const q = e.pts[i], w = e.was[i];
          _b.copy(q).sub(w).multiplyScalar(keep); w.copy(q); q.add(_b); q.y -= EAR_G * h * h;
          q.x -= e.wx * EAR_WIND * h * h; q.z -= e.wz * EAR_WIND * h * h;
          // the air she runs through: it lifts the ear out sideways and never lets it lie still,
          // so it flaps (slowly: a heavy ear) up, down, in and out as well as trailing
          const air = _b.length() / h, f = air * h * h * (i + 1) * 0.25 * calm, u = earT * (7 + i * 1.5) + e.s * 2 + i * 1.9;
          q.x += (ox * 1.1 + Math.sin(u * 1.3) * 1.2) * f; q.y += (0.9 + Math.sin(u) * 1.6) * f; q.z += (oz * 1.1 + Math.cos(u * 0.8) * 1.2) * f;
          // a shake throws the ears straight out from her head, and up
          if (fling > 0) { const k = fling * 5200 * h * h * (i + 1) * e.s / side; q.x += me[8] * k; q.y += me[9] * k + fling * 1500 * h * h; q.z += me[10] * k; }
          // an ear is not a string: it has some spring in it, most where it joins the head
          // towards hanging where gravity and the wind together would hang it
          const r = (i + 1) * len, gw = (i + 1) / 4 * r;    // the gust moves the tip most
          q.lerp(_b.set(tk.x + wdx * r + (ux / ul * gu + ox * go) * gw, tk.y + wdy * r + uy / ul * gu * gw, tk.z + wdz * r + (uz / ul * gu + oz * go) * gw), 1 - Math.exp(-h * EAR_SPRING[i] * (1 + 0.6 * still) * (1 - 0.8 * fling)));
        }
        for (let it = 0; it < 2; it++) for (let i = 0; i < 4; i++) {
          const q = e.pts[i], up = i ? e.pts[i - 1] : tk;
          q.sub(up).setLength(len).add(up);
          // and it does not fold flat on itself
          const up2 = i > 1 ? e.pts[i - 2] : i ? tk : null;
          if (up2 && q.distanceTo(up2) < len * 1.6) q.sub(up2).setLength(len * 1.6).add(up2);
          // it cannot pass through her head or lie inside her neck
          _b.copy(q).add(off).applyMatrix4(_inv);
          let hit = false;
          // beside her face only (her cheeks), or anywhere in a shake: otherwise behind and below the head the ear goes
          // wherever the wind and her turns take it
          if (_b.z * e.s < 11.5 && (fling > 0.01 || (_b.x > 0 && _b.x < 24 && _b.y > -8))) { _b.z = e.s * 11.5; hit = true; }
          const dx = _b.x - 4, dy = _b.y - 4, d = Math.hypot(dx, dy, _b.z);
          if (d < 15.5 && d > 0.01) { _b.set(4 + dx / d * 15.5, 4 + dy / d * 15.5, _b.z / d * 15.5); hit = true; }
          if (hit) q.copy(_b).applyMatrix4(head.matrixWorld).sub(off);
        }
      }
      // the chain in the head's own coordinates, and the flap drawn through it
      e.pts.forEach((q, i) => e.ends[i].copy(q).applyMatrix4(_inv));
      e.skin.update(e.top, e.ends, e.s, bodySide);
    }
  }

  // smoothed pose: everything eases towards its target so states blend into each other
  const P = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, rf: 30, rh: 30, wf: 0, wr: 0, wh: 0, amp: 0, gal: 0, yaw: 0, hp: 0, jaw: 0, tailUp: 0.5, wag: 0.45, wagHz: 12, y: 0, tongue: 0, bend: 0, roll: 0, flex: 0, fly: 0, wig: 0 };
  let earT = 0, shakeT = 9, gw = 0, gazeT = 0, gazeY = 0, gazeZ = 0;
  let last = -1, blink = 0, ph = 0, wagPh = 0, px = 0, py = 0, pz = 0, earCalm = 1, ph0 = 0, turn = 0, fresh = true, flying = false, flew = 0, flight = 1, pitch0 = 0;

  function update(p, t) {
    const dt = last < 0 ? 0.016 : clamp(t - last, 0, 0.05); last = t;
    const sp = p.state === 'drive' ? 0 : Math.hypot(p.vx, p.vy);
    const seated = p.state === 'drive' || p.state === 'hop';
    // wf, wr, wh: how much the front left, front right and hind paws follow a pose instead of standing on the ground
    const T = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, rf: 30, rh: 30, wf: 0, wr: 0, wh: 0, amp: p.air ? 0 : clamp(sp / 120, 0, 1) * (p.zoom ? 0.95 : 0.6), gal: p.zoom ? 1 : 0,
      yaw: p.lookYaw || 0, hp: p.lookPitch || 0, jaw: 0,
      tailUp: 0.5, wag: 0.45, wagHz: 12, y: -3 * clamp(sp / 200, 0, 1), tongue: p.zoom ? 1 : 0, bend: 0, roll: 0, flex: 0, fly: 0, wig: 0 };
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
    } else if (p.poo > 0) {                              // a poo: haunches right down, tail up, still
      T.pitch = 0.42; T.hl = T.hr = 1.0; T.rh = 22; T.wh = 1; T.y = -8; T.tailUp = 1.0; T.wag = 0; T.hp = 0.2;
    } else if (p.state === 'tug') {                      // pulling a toy: braced back on her haunches, head shaking it
      const pull = p.tug && p.tug.jerk > 0.2;             // just yanked: further back, head going faster
      T.pitch = pull ? 0.3 : 0.22; T.y = pull ? -9 : -6; T.yaw = Math.sin(t * (pull ? 20 : 16)) * 0.35; T.hp = 0.1; T.wag = 0.7; T.wagHz = 16; T.tailUp = 0.8;
    } else if (p.swim) {                                 // swimming: low in the water (what is under it is hidden by the ground), head up
      T.y = -30 + Math.sin(t * 5) * 1.5; T.pitch = 0.22; T.hp = 0.25; T.tailUp = -0.1; T.wag = 0.18; T.wagHz = 5;   // rump low, chest and head up
      // the legs keep stepping under her, out of sight below the water
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
      T.hp = -0.32; T.tailUp = 0.3; T.wag = 0; T.y = -6;
    } else if (sp < 30 && p.excited > 0) {               // a child petting her: the tail going fast, her bottom wiggling with it, the chest steady
      T.wag = 0.75; T.wagHz = 18; T.tailUp = 0.75; T.tongue = 1; T.wig = 1;
    } else if (sp < 30) { T.wag = 0.55 + (p.happy ? 0.25 : 0); T.wagHz = p.happy ? 17 : 12; if (p.puff > 0.15) T.tongue = 1; }
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
    if (grounded) { T.bend = clamp(turn * 0.07, -0.5, 0.5); T.roll = clamp(turn * sp / 4500, -0.28, 0.28); T.yaw += clamp(turn * 0.09, -0.6, 0.6); }

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
    const gl = P.gal, fast = clamp(moving / 210, 0, 1);
    // gw: how much the simulated gallop has her (flat out, on the ground, nothing else going on)
    gw = lerp(gw, grounded && p.zoom && !p.skid && !cap ? clamp((moving - GALLOP_FROM) / 80, 0, 1) : 0, k);
    const reach = lerp(16, 28, clamp(moving / 150, 0, 1)), duty = lerp(lerp(0.62, 0.36, fast), 0.3, gl);
    let rate = lerp(moving / (reach / duty), clamp(moving / GAL.len, TEMPO[0] / GAL.T, TEMPO[1] / GAL.T), gw);
    if (rate < 2.4 && worst > 7 && gw < 0.5) rate = 2.4 + worst * 0.06;            // standing awkwardly: shuffle the paws back under
    else if (moving < 12) rate = 0;
    const ph1 = ph; if (grounded) ph += rate * dt;
    for (let i = 0; i < 4; i++) {
      const L = legs[i];
      if (!grounded || L.want > 0.5) { L.lift = 0; continue; }
      if (gw > 0.5) {                                                             // the gallop has the paw: it is not on a spot
        const s = GAL.down[i][0];
        if (frac(ph1 - s) > frac(ph - s)) p.footfall = true;
        L.x = L.x0 = L.hx; L.y = L.y0 = L.hy; L.u = 1; L.lift = 0; continue;
      }
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
    p.gait = frac(ph); p.feet = legs; p.ears = ears;

    // ---- the body rides over them ----
    const a = P.amp, s2 = ph * Math.PI * 2;
    stride(ph);
    const pitch = P.pitch + lerp(gl * a * Math.cos(s2 - 1.1) * 0.13, G[0], gw);
    const bob = lerp(Math.abs(Math.sin(s2)) * 2 * a * (1 - gl) + gl * a * (2 + Math.sin(s2 + 2.6) * 4) + P.y, G[2], gw)
      - (Math.sin(P.pitch) - Math.sin(pitch0) * (1 - flew)) * 26 * P.fly;   // in the air she turns about her middle, not about her hips (from however she was tilted as she left the ground)
    const wagNow = Math.sin(wagPh += dt * P.wagHz) * P.wag;
    tilt.rotation.z = pitch; tilt.position.y = HIP_Y + bob;
    shakeT = p.shake > 0 ? shakeT + dt : 9; if (p.shake > 0 && shakeT > 8) shakeT = 0;
    const shk = shakeAt(shakeT, 0);
    // the shake takes her whole body: it rocks over her planted paws, chest first and rump after
    const roll = P.roll - shakeAt(shakeT, 0.15) * 0.2;      // against the head: as it rolls one way, her body goes the other
    lean.rotation.x = roll;
    // at a gallop the back works like a spring: it doubles up as the hind legs come through under her
    // and straightens out as she reaches forward
    const flex = P.flex + lerp(gl * a * 0.25 * Math.cos(s2 + 0.3), G[1], gw);
    const fy = -P.bend + shakeAt(shakeT, 0.3) * 0.13, ry = shakeAt(shakeT, 0.75) * 0.16 + P.bend * 0.6 + wagNow * (0.12 * (a < 0.2 ? 1 : 0) + 0.05 * P.wig);     // the whole bottom wiggles when the tail really goes, a little more when excited
    fore.rotation.y = fy; rear.rotation.y = ry; fore.rotation.z = -flex; rear.rotation.z = flex;
    bendBody(shakeT);

    const cp = Math.cos(pitch), sn = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
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
      const o = 4 + i * 4, body = pitch + (L.front ? -flex : flex), [ba, bb, bc] = L.bones;
      // ...where the simulated gallop has it: its bones' angles give the place, and the ground still stops it
      const wg = gw * (1 - L.w);
      if (wg > 0.002) {
        const t1 = G[o] + body, t2 = G[o + 1] + body;
        th = G[o + 2] + body; pawTh = G[o + 3] + body;
        const cy = sy3 - ba * Math.cos(t1) - bb * Math.cos(t2) - bc * Math.cos(th);
        fx = lerp(fx, x + ba * Math.sin(t1) + bb * Math.sin(t2) + bc * Math.sin(th), wg); fyy = lerp(fyy, Math.max(cy, PAW_Y), wg); fz = lerp(fz, sz3, wg);
      }
      L.c = lerp(L.c, cap, 1 - Math.exp(-dt * 30));
      if (L.c > 0.002) {
        const t1 = C[o] + body, t2 = C[o + 1] + body;
        th = lerp(th, C[o + 2] + body, L.c); pawTh = lerp(pawTh, C[o + 3] + body, L.c);
        L.g = lerp(L.g, (C[3] >> i) & 1, 1 - Math.exp(-dt * 60));
        const floor = PAW_Y - (p.air ? p.clear || 0 : 0), cy = sy3 - ba * Math.cos(t1) - bb * Math.cos(t2) - bc * Math.cos(th);
        fx = lerp(fx, x + ba * Math.sin(t1) + bb * Math.sin(t2) + bc * Math.sin(th), L.c); fyy = lerp(fyy, lerp(Math.max(cy, floor), floor, L.g), L.c); fz = lerp(fz, sz3, L.c);
      }
      solve(L, x, sy3, sz3, fx, fyy, fz, th, pawTh, wg + L.c - wg * L.c);
    }

    // head: follows the birds, bobs with the run, nods with each bark
    head.rotation.y = -P.yaw + shk * 0.1 + Math.sin(s2 + 1) * 0.05 * a;
    // galloping, the neck and head go as the simulated dog's did, steadied: the neck swings about its root at the collar
    head.rotation.z = P.hp + lerp(-pitch * 0.55 + Math.sin(s2 * 2 + 0.6) * 0.05 * a, gHead, gw);
    const nk = gNeck * gw, cn = Math.cos(nk), sn2 = Math.sin(nk);
    head.position.set(NECK[0] + (HEAD[0] - NECK[0]) * cn - (HEAD[1] - NECK[1]) * sn2, NECK[1] + (HEAD[0] - NECK[0]) * sn2 + (HEAD[1] - NECK[1]) * cn, 0);
    collarG.rotation.z = -0.6 + nk * 0.5;
    head.rotation.x = (p.state === 'daze' ? Math.sin(t * 9) * 0.25 : (p.tiltHead || 0) * 0.35) + shk * 1.35 + Math.sin(s2) * 0.07 * a;
    jaw.rotation.z = -Math.max(P.jaw, P.tongue * (0.3 + Math.sin(t * 15) * 0.07));
    // out, it slides forward until its bend sits at the lip (x 20); a little sway side to side as she pants
    tongue.position.x = 4 + P.tongue * 9; tongue.rotation.x = Math.sin(t * 15) * 0.06 * P.tongue; tongue.visible = P.tongue > 0.05;
    // galloping, her tail swings as the simulated one did (it hangs from a soft spring, so the run moves it), and hardly wags
    tail.rotation.z = lerp(P.tailUp, 0.3 + gTail, gw);
    tail.rotation.y = wagNow * (1 - 0.8 * gw) + P.bend * 0.8 + shakeAt(shakeT, 1) * 0.7; tail.rotation.x = shakeAt(shakeT, 0.9) * 0.6;

    blink = (t % 3.7) < 0.12 || p.state === 'daze' || shakeT < 1.25 ? 0.15 : 1;
    // the eyes move on their own: a quick glance somewhere every second or two, and ahead of the head towards what she watches
    if ((gazeT -= dt) <= 0) { gazeT = 0.7 + Math.random() * 1.8; gazeY = (Math.random() - 0.5) * 0.5; gazeZ = (Math.random() - 0.5) * 0.25; }
    const gy = clamp(gazeY + (p.lookYaw || 0) * 0.4, -0.4, 0.4), gz = gazeZ + (p.lookPitch || 0) * 0.3, kg = 1 - Math.exp(-dt * 28);
    eyes.forEach((e) => { e.scale.y = lerp(e.scale.y, blink, 0.5); e.rotation.y = lerp(e.rotation.y, gy, kg); e.rotation.z = lerp(e.rotation.z, gz, kg); });

    const sq = clamp((p.landT || 0) / 0.22, 0, 1);
    root.scale.set(1 + sq * 0.03, 1 - sq * 0.07, 1 + sq * 0.03);
    root.position.set(p.x, p.z, p.y);
    root.rotation.y = -p.heading;
    // Ears are heavy and she is not falling far: in the air her rise and fall carries them with her, and they are
    // not flapped about as they are by a run. Otherwise she takes off with them like wings.
    const air = p.air || p.state === 'hop'; earCalm = air ? 0 : lerp(earCalm, 1, 1 - Math.exp(-dt * 4));     // from the moment she leaves the ground; settling back slowly after landing, so they do not slap
    const jz = fresh0 || jumped ? 0 : (p.z - pz) * lerp(0.35, 0.7, earCalm); pz = p.z;   // in the air only a third of her rise and fall carries them: they lag and float
    swingEars(dt, jumped ? jx : 0, jumped ? jy : 0, jz, earCalm, clamp(Math.sin(Math.PI * clamp(shakeT / 0.95, 0, 1)) * 1.6, 0, 1));
  }
  return { root, update, bite };
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
// Cartoon people, hand-animated: rounded shapes, big heads (bigger still on children), and joints where people bend:
// hips, knees, ankles, waist, shoulders, elbows, neck. +x is the way they face.
// Body plans (game units; Lili's back is about 63 high): leg and arm bones, where the shoulders and neck are, the head,
// and the torso's profile ([height above the waist, half depth, half width]).
// Adults are built like the children, a size up (the owner found the children better: rounder, chunkier, a bigger head)
const ADULT = { thigh: 35, shin: 34, foot: 14, hipW: 10, shY: 49, shW: 20, upArm: 27, foreArm: 25, hand: 7, neck: 60, headR: 23, limb: 0.95,
  torso: [[0, 11.7, 17], [11.7, 11, 16.3], [24.7, 13, 18.2], [36.4, 13.7, 20], [44, 13, 20.8], [49.4, 9, 17], [53.3, 4.5, 8.5], [54.6, 2, 2.6]] };
const CHILD = { thigh: 27, shin: 26, foot: 11, hipW: 7.5, shY: 38, shW: 15.5, upArm: 21, foreArm: 19, hand: 5.5, neck: 46, headR: 19, limb: 0.72,
  torso: [[0, 9, 13], [9, 8.5, 12.5], [19, 10, 14], [28, 10.5, 15.5], [34, 10, 16], [38, 7, 13], [41, 3.5, 6.5], [42, 1.5, 2]] };
// voice (man or woman, for adults), skin, hair (colour and style: short, long, bun, curls, tails), top (colour, sleeves short or long), bottom (trousers, shorts,
// skirt), shoes; child or not
const LOOKS = [
  { kid: false, voice: 'man', skin: '#F2C29B', hair: ['#6B4226', 'short'], top: ['#5BA8E6', 'short'], bottom: ['#3C4A66', 'trousers'], shoes: '#3A2E2A' },
  { kid: false, voice: 'woman', skin: '#A86E4C', hair: ['#2B2326', 'bun'], top: ['#F28C5C', 'long'], bottom: ['#4E5E86', 'skirt'], shoes: '#5A3A2A' },
  { kid: false, voice: 'man', skin: '#F6D2B0', hair: ['#C9CBD0', 'short'], top: ['#7FB77E', 'long'], bottom: ['#6A5A48', 'trousers'], shoes: '#2E2A28' },
  { kid: true, skin: '#E8B58E', hair: ['#E3B04F', 'tails'], top: ['#F27FA8', 'short'], bottom: ['#5B7FC4', 'skirt'], shoes: '#E9545B' },
  { kid: true, skin: '#7A4E36', hair: ['#1E1A1C', 'curls'], top: ['#F2C14E', 'short'], bottom: ['#3F6E8C', 'shorts'], shoes: '#F2F2F2' },
  { kid: false, voice: 'woman', skin: '#EBC3A0', hair: ['#8B3A2A', 'long'], top: ['#4FB0A5', 'short'], bottom: ['#6B4F8C', 'trousers'], shoes: '#3A2E2A' },
  { kid: true, skin: '#C68B62', hair: ['#5A3A22', 'short'], top: ['#6FC26A', 'short'], bottom: ['#C25B4E', 'shorts'], shoes: '#3A6FC2' },
  { kid: true, skin: '#F6D2B0', hair: ['#B5482A', 'tails'], top: ['#9B6FD8', 'short'], bottom: ['#F2A33A', 'skirt'], shoes: '#4FA653' },
  { kid: true, skin: '#E8B58E', hair: ['#E8C66A', 'short'], top: ['#4FA3E0', 'long'], bottom: ['#3C4A66', 'trousers'], shoes: '#E9545B' },
  { kid: false, voice: 'woman', skin: '#F2C29B', hair: ['#D9A441', 'bun'], top: ['#E86A8E', 'long'], bottom: ['#5C6B4A', 'trousers'], shoes: '#3A2E2A' },
  { kid: true, skin: '#F6D2B0', hair: ['#8B3A2A', 'short'], top: ['#E9545B', 'short'], bottom: ['#4FA3E0', 'shorts'], shoes: '#F2F2F2' },
];
export const PERSON_LOOKS = LOOKS.length;
export const isChild = (look) => LOOKS[look % LOOKS.length].kid;
export const personVoice = (look) => (LOOKS[look % LOOKS.length].kid ? 'child' : LOOKS[look % LOOKS.length].voice);
const EYE = '#2A1C14', MOUTH = '#8A3B36';
// People are small on screen and there are many (each drawn in the shadows too): their smooth shapes have a quarter of
// the detail of Lili's (12 round, 22 along: 480 triangles each, not 1600)
const lowProfile = (pts) => profileGeo(pts, 12, 22), lowLimb = (len, r0, r1) => limbGeo(len, r0, r1, 12, 22);
export function makePerson(look) {
  const L = LOOKS[look % LOOKS.length], B = L.kid ? CHILD : ADULT, k = B.limb;
  const [top, sleeve] = L.top, [bottom, cut] = L.bottom, [hairC, hairS] = L.hair;
  const hipH = B.thigh + B.shin + 5;                    // the hip joints' height standing
  const root = new THREE.Group(), body = group(0, hipH, 0); root.add(body);
  const hips = new THREE.Group(); body.add(hips);
  const shape = (geo, color, y = 0) => ({ geo, color, at: [0, y, 0], scale: [1, 1, 1] });
  hips.add(mesh([shape(lowProfile([[-13 * k, 2, 3], [-8 * k, 10 * k, B.hipW + 6 * k], [2 * k, 12 * k, B.hipW + 8 * k], [12 * k, 11 * k, B.hipW + 6.5 * k], [16 * k, 4, 6]]), bottom)]));
  if (cut === 'skirt') hips.add(mesh([{ ...cyl(bottom, 0, -13 * k, 0, B.hipW + 11 * k, 32 * k, undefined, B.hipW + 11 * k), geo: SKIRT }]));   // wider than her hips, and flared
  // legs: hip > knee > ankle. A leg hangs down -y; turning it about z swings it forward.
  const legs = [1, -1].map((s) => {
    const shinC = cut === 'trousers' ? bottom : L.skin, thighC = cut === 'trousers' ? bottom : L.skin;
    const thigh = [shape(lowLimb(B.thigh, 10.2 * k, 7.6 * k), thighC)];
    if (cut === 'shorts') thigh.push(shape(lowLimb(B.thigh * 0.55, 11 * k, 9.8 * k), bottom));
    const foot = group(0, -B.shin, 0, mesh([blob(L.shoes, 4.5 * k, -3 * k, 0, B.foot / 2 + 3, 4.6 * k, 6.5 * k)]));
    const knee = group(0, -B.thigh, 0, mesh([shape(lowLimb(B.shin, 7.4 * k, 5.3 * k), shinC)]), foot);
    const hip = group(0, 0, s * B.hipW, mesh(thigh), knee);
    hips.add(hip); return { hip, knee, foot, s };
  });
  // the chest turns and leans about the waist
  const chest = group(0, 4, 0); hips.add(chest);
  chest.add(mesh([shape(lowProfile(B.torso), top)]));
  // arms: shoulder > elbow > hand. Swing about z (forward), then out about x.
  const arms = [1, -1].map((s) => {
    const long = sleeve === 'long';
    const hand = group(0, -B.foreArm, 0, mesh([blob(L.skin, 0.5, -B.hand * 0.6, 0, B.hand * 0.8, B.hand, B.hand * 0.65)]));
    const elbow = group(0, -B.upArm, 0, mesh([shape(lowLimb(B.foreArm, 5.5 * k + 0.6, 4.3 * k + 0.6), long ? top : L.skin)]), hand);
    const upper = [shape(lowLimb(B.upArm, 7.2 * k + 0.6, 5.7 * k + 0.6), long ? top : L.skin)];
    if (!long) upper.push(shape(lowLimb(B.upArm * 0.45, 8 * k + 0.6, 7.5 * k + 0.6), top));
    const sh = group(0, B.shY - 2, s * B.shW, mesh(upper), elbow);
    chest.add(sh); return { sh, elbow, hand, s };
  });
  // head: on a short neck; the face looks along +x
  const r = B.headR, neck = group(0, B.neck - (L.kid ? 4 : 6), 0, mesh([blob(L.skin, 0, 2, 0, 6.5 * k + 1, 9, 6.5 * k + 1)]));
  chest.add(neck);
  const head = group(0, 6, 0); neck.add(head);
  const face = [blob(L.skin, 0, r, 0, r * 0.98, r, r * 0.95),
    blob(L.skin, r * 0.97, r * 0.92, 0, r * 0.13, r * 0.12, r * 0.13),                                                               // nose
    ...[1, -1].map((s) => blob(L.skin, -r * 0.05, r * 0.95, s * r * 0.95, r * 0.16, r * 0.22, r * 0.1))];                               // ears
  if (L.kid) face.push(...[1, -1].map((s) => blob('#F2A0A0', r * 0.78, r * 0.72, s * r * 0.5, r * 0.16, r * 0.1, r * 0.16)));
  head.add(mesh(face));
  head.add(mesh(hairParts(hairC, hairS, r)));
  const eyes = [1, -1].map((s) => {
    const e = group(r * 0.86, r * 1.12, s * r * 0.34, ball(mat(EYE, { roughness: 0.3 }), r * 0.1, r * 0.14, r * 0.09, 0, 0, 0, false), ball('#ffffff', r * 0.035, r * 0.035, r * 0.035, r * 0.07, r * 0.05, s * r * 0.02, false));
    head.add(e); return e;
  });
  const brows = [1, -1].map((s) => { const b = mesh([blob(hairS === 'short' && hairC === '#C9CBD0' ? '#9A9CA2' : hairC, 0, 0, 0, r * 0.05, r * 0.035, r * 0.16)], false); b.position.set(r * 0.9, r * 1.36, s * r * 0.34); head.add(b); return b; });
  // two mouths: a smile, and an open one (for a gasp or a scream) shown in its place
  const smile = new THREE.Mesh(SMILE, mat(MOUTH)); smile.position.set(r * 0.9, r * 0.66, 0); smile.scale.setScalar(r * 0.22); smile.rotation.set(0, Math.PI / 2, Math.PI);
  const open = ball(mat(MOUTH), r * 0.06, r * 0.14, r * 0.13, r * 0.94, r * 0.62, 0, false); open.visible = false;
  head.add(smile, open);

  // smoothed pose
  const S = { y: 0, lean: 0, twist: 0, yaw: 0, roll: 0, hy: 0, hp: 0, sit: 0 };
  for (const n of ['thigh', 'knee', 'ankle', 'sh', 'out', 'elbow']) S[n + 0] = S[n + 1] = 0;
  let last = -1, ph = 0, lx = null, ly = 0, blink = 1;
  // Standing, the feet stay where they are (fh: the way they point) while the chest and head turn; past STEP_TURN they
  // step round, one foot and then the other, over STEP_T seconds. Turned as one piece, their feet slid on the ground.
  let fh = null, stepT = 0, stepFrom = 0, stepBy = 0, offX = 0, offY = 0;   // off: how far the turn about a foot has moved them
  const seed = look * 1.7;
  function update(o, t) {
    const dt = last < 0 ? 0.016 : clamp(t - last, 0, 0.05); last = t;
    const moved = lx === null ? 0 : Math.hypot(o.x - lx, o.y - ly); lx = o.x; ly = o.y;
    const T = { y: 0, lean: 0.04, twist: 0, yaw: 0, roll: 0, hy: 0, hp: 0, sit: 0 };
    for (const n of ['thigh', 'knee', 'ankle', 'sh', 'out', 'elbow']) T[n + 0] = T[n + 1] = 0;
    T.out0 = T.out1 = 0.07; T.elbow0 = T.elbow1 = 0.18; T.knee0 = T.knee1 = -0.04;
    let fast = 14;
    const run = o.state === 'scared';
    if (o.state === 'walk' || o.state === 'approach' || o.state === 'return' || run || o.pace) {
      // the walk: driven by the ground covered, a step every 0.55 leg lengths. Running away scared: longer steps, knees
      // high, leaning into it, arms up in the air
      const step = (B.thigh + B.shin) * (run ? 0.85 : 0.55);
      ph += (o.pace ? o.pace * dt : moved < 50 ? moved : 0) / (2 * step);
      const s = ph * Math.PI * 2;
      for (const [i, q] of [[0, 0], [1, Math.PI]]) {
        const a = s + q, fw = Math.sin(a);
        T['thigh' + i] = (run ? 0.6 : 0.32) * fw;
        T['knee' + i] = -(0.08 + (run ? 1.4 : 0.8) * Math.max(0, Math.cos(a + 0.35)) ** 2);           // folds as the leg swings through
        T['ankle' + i] = 0.12 * Math.max(0, -Math.cos(a - 0.4)) - 0.1 * Math.max(0, fw);              // toes off behind, heel first in front
        T['sh' + i] = run ? 2.5 + 0.35 * Math.sin(2 * a) : -0.32 * fw;                                 // the arm goes with the other leg
        T['elbow' + i] = run ? 0.35 + 0.3 * Math.sin(2 * a + 1) : 0.2 + 0.32 * Math.max(0, -fw);
        if (run) T['out' + i] = 0.55;
      }
      T.y = (run ? 3.5 : 1.6) * k * Math.cos(2 * s);         // up as the legs pass, down as a heel lands
      T.yaw = 0.09 * Math.sin(s); T.twist = -0.15 * Math.sin(s); T.roll = 0.025 * Math.cos(s);
      T.lean = run ? 0.22 : 0.07; T.hp = run ? 0.2 : 0.04;
      fast = 30;
    } else {
      // standing: weight on one leg then the other, breathing, a look about now and then
      const w = Math.sin(t * 0.55 + seed);
      T.roll = 0.035 * w; T.knee0 = -0.04 - 0.12 * Math.max(0, w); T.knee1 = -0.04 - 0.12 * Math.max(0, -w);
      T.thigh0 = 0.06 * Math.max(0, w); T.thigh1 = 0.06 * Math.max(0, -w);
      T.y = -1.5 * Math.abs(w) * k;
      T.hy = 0.45 * Math.sin(t * 0.31 + seed * 2) * Math.max(0, Math.sin(t * 0.17 + seed));
      T.hp = 0.06 * Math.sin(t * 0.23 + seed);
    }
    if (o.state === 'tug') {                                 // holding on to their toy: leaning back, both arms pulling
      T.lean = -0.3 + Math.sin(t * 16) * 0.06; T.knee0 = T.knee1 = -0.35; T.thigh0 = T.thigh1 = 0.2; T.y = -2;
      T.sh0 = T.sh1 = 1.35; T.out0 = T.out1 = 0.15; T.elbow0 = T.elbow1 = 0.15; T.hp = 0.15;
    } else if (o.holds && (o.state === 'stand' || o.state === 'walk') && !o.pace) {   // hugging their toy to their chest
      T.sh0 = T.sh1 = 0.75; T.out0 = T.out1 = 0.05; T.elbow0 = T.elbow1 = 1.5;
    }
    if (o.state === 'love') {                               // down on their haunches by her, one hand stroking her, the other on a knee
      T.thigh0 = T.thigh1 = 1.25; T.knee0 = T.knee1 = -2.1; T.ankle0 = T.ankle1 = 0;
      T.y = -(B.thigh * 0.685 + B.shin * 0.34); T.lean = 0.45; T.hp = -0.35; T.roll = 0;
      T.sh0 = 0.75 + 0.18 * Math.sin(t * 5); T.out0 = 0.15; T.elbow0 = 0.25;
      T.sh1 = 0.5; T.out1 = 0.2; T.elbow1 = 0.6;
      fast = 8;
    } else if (o.state === 'breath') {                      // stopped, hands on knees, puffing
      T.thigh0 = T.thigh1 = 0.35; T.knee0 = T.knee1 = -0.35; T.y = -3 * k + 1.2 * k * Math.sin(t * 7);
      T.lean = 0.75; T.hp = 0.45; T.sh0 = T.sh1 = 0.1; T.out0 = T.out1 = 0.12; T.elbow0 = T.elbow1 = 0.1;
      fast = 8;
    } else if (o.state === 'wobble') {                              // a dog's paws on their chest: rocked back, arms up and out
      const f = Math.sin(t * 19);
      T.lean = -0.22 + f * 0.04; T.knee0 = T.knee1 = -0.25; T.thigh0 = T.thigh1 = 0.12; T.y = -3;
      T.sh0 = 1.0 + f * 0.5; T.sh1 = 1.0 - f * 0.5; T.out0 = T.out1 = 0.6; T.elbow0 = T.elbow1 = 0.7; T.hp = 0.25;
    } else if (o.state === 'sit') {                          // bumped down onto the ground
      T.sit = 1; T.lean = -0.3; T.thigh0 = T.thigh1 = 1.45; T.knee0 = -0.5; T.knee1 = -0.9; T.ankle0 = T.ankle1 = 0.3;
      T.sh0 = T.sh1 = -0.7; T.out0 = T.out1 = 0.3; T.elbow0 = T.elbow1 = 0.1; T.hp = 0.15;
    } else if (o.state === 'hop') {                          // jumping clear
      const q = clamp(o.t / 0.45, 0, 1); T.y = Math.sin(q * Math.PI) * 46 * k;
      T.thigh0 = 0.7; T.thigh1 = 0.3; T.knee0 = T.knee1 = -1.1; T.sh0 = T.sh1 = 2.3; T.out0 = T.out1 = 0.45; T.elbow0 = T.elbow1 = 0.3;
      fast = 30;
    } else if (o.glance > 0 && !run) {                      // not bothered: a look at her and a little shrug
      T.hy += o.glanceYaw * 0.8;
      const sh = Math.max(0, Math.sin((1.4 - o.glance) / 0.6 * Math.PI)) * (o.glance > 0.8 ? 1 : 0);
      T.out0 += 0.3 * sh; T.out1 += 0.3 * sh; T.elbow0 += 0.6 * sh; T.elbow1 += 0.6 * sh;
    } else if (o.wave > 0) { T.sh0 = 2.2; T.out0 = 0.75; T.elbow0 = 0.5 + Math.sin(t * 12) * 0.35; }       // up and out to the side, not across the face
    if (fh === null) fh = o.heading;
    if (o.state !== 'stand' || o.pace) { fh = o.heading; stepT = 0; const d = Math.exp(-dt * 3); offX *= d; offY *= d; }
    else {
      if (stepT <= 0 && Math.abs(wrap(o.heading - fh)) > STEP_TURN) { stepT = STEP_T; stepFrom = fh; stepBy = wrap(o.heading - fh); }
      if (stepT > 0) {
        stepT = Math.max(0, stepT - dt);
        const u = 1 - stepT / STEP_T, lift = Math.sin(Math.min(1, (u % 0.5) * 2) * Math.PI), i = u < 0.5 ? 0 : 1;
        // turning about the foot that stays down, so it does not slide
        const h0 = fh, zp = legs[1 - i].s * B.hipW; fh = stepFrom + stepBy * (1 - Math.cos(u * Math.PI)) / 2;
        offX += zp * (Math.sin(fh) - Math.sin(h0)); offY -= zp * (Math.cos(fh) - Math.cos(h0));
        T['thigh' + i] += 0.3 * lift; T['knee' + i] -= 0.6 * lift; T.y += 1.5 * lift * k;
        fast = 30;
      }
    }
    const tw = wrap(o.heading - fh);                         // how far the chest and head are turned from the feet
    const kk = 1 - Math.exp(-dt * fast);
    for (const n in T) S[n] = n === 'y' && o.state === 'hop' ? T[n] : lerp(S[n], T[n], kk);

    body.position.y = hipH + S.y - S.sit * (hipH - 12 * k);
    hips.rotation.set(S.roll, S.yaw, 0);
    chest.rotation.set(-S.roll * 0.6, S.twist + tw * 0.6, -S.lean);
    legs.forEach((g, i) => { g.hip.rotation.z = S['thigh' + i]; g.knee.rotation.z = S['knee' + i]; g.foot.rotation.z = -S['thigh' + i] - S['knee' + i] + S['ankle' + i]; });
    arms.forEach((g, i) => { g.sh.rotation.set(-g.s * S['out' + i], 0, S['sh' + i]); g.elbow.rotation.z = S['elbow' + i]; });
    head.rotation.set(0, S.hy - S.twist - S.yaw + tw * 0.4, S.hp + S.lean * 0.6);
    blink = (t + seed) % 4.1 < 0.12 ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = lerp(e.scale.y, blink, 0.5); });
    smile.visible = !(open.visible = o.state === 'wobble' || o.state === 'hop' || o.state === 'sit' || run || o.state === 'breath' || o.state === 'tug');
    root.position.set(o.x + offX, 0, o.y + offY); root.rotation.y = -fh;
    o.feet = legs;                                           // for tests
  }
  return { root, update };
}
const STEP_TURN = 0.45, STEP_T = 0.45;
// A smooth shape from a profile: [y, half depth (x), half width (z)] from the bottom up, eased between the points. The
// torso and the limbs are each one such shape, so no joint shows as a ball and no seam as a band.
function profileGeo(pts, around = 20, along = 40) {
  const g = new THREE.SphereGeometry(1, around, along), P = g.attributes.position, y0 = pts[0][0], y1 = pts[pts.length - 1][0];
  const at = (y) => {
    let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < y) i++;
    // through the points on a smooth curve (Catmull-Rom); easing in and out of each point made a ridge at every one
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const e = clamp((y - p1[0]) / (p2[0] - p1[0] || 1), 0, 1), e2 = e * e, e3 = e2 * e;
    const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * e + (2 * a - 5 * b + 4 * c - d) * e2 + (3 * b - a - 3 * c + d) * e3);
    return [Math.max(0, cr(p0[1], p1[1], p2[1], p3[1])), Math.max(0, cr(p0[2], p1[2], p2[2], p3[2]))];
  };
  for (let i = 0; i < P.count; i++) {
    const v = P.getY(i), r = Math.sqrt(Math.max(1 - v * v, 0)), y = lerp(y0, y1, Math.acos(-clamp(v, -1, 1)) / Math.PI), [rx, rz] = at(y);
    P.setXYZ(i, r > 1e-6 ? P.getX(i) / r * rx : 0, y, r > 1e-6 ? P.getZ(i) / r * rz : 0);
  }
  g.computeVertexNormals();
  return g;
}
// a limb from its joint (y = 0) down: rounded over the joint, r0 there, r1 at the far end, len long
const limbGeo = (len, r0, r1, around, along) => profileGeo([[-len - r1 * 0.9, 0.2, 0.2], [-len - r1 * 0.55, r1 * 0.85, r1 * 0.85], [-len, r1, r1], [-len * 0.5, (r0 + r1) / 2 * 1.04, (r0 + r1) / 2 * 1.04], [0, r0, r0], [r0 * 0.6, r0 * 0.8, r0 * 0.8], [r0 * 0.95, 0.2, 0.2]], around, along);
// a cone for skirts, wider at the hem
const SKIRT = new THREE.CylinderGeometry(1, 1.4, 1, 18);
// a smile: the lower half of a thin ring
const SMILE = new THREE.TorusGeometry(1, 0.22, 6, 14, Math.PI);
function hairParts(c, style, r) {
  const cap = [blob(c, -r * 0.12, r * 1.2, 0, r * 1.02, r * 0.86, r * 1.0), blob(c, r * 0.55, r * 1.62, 0, r * 0.5, r * 0.28, r * 0.75)];
  if (style === 'short') return cap;
  if (style === 'bun') return [...cap, blob(c, -r * 0.55, r * 1.85, 0, r * 0.42)];
  if (style === 'curls') return [...cap, ...[-0.9, -0.4, 0.1, 0.55].flatMap((u) => [1, -1].map((s) => blob(c, r * u, r * (1.55 - Math.abs(u) * 0.35), s * r * 0.62, r * 0.36)))];
  if (style === 'tails') return [...cap, ...[1, -1].map((s) => blob(c, -r * 0.45, r * 0.9, s * r * 1.08, r * 0.24, r * 0.5, r * 0.24, [s * 0.5, 0, 0]))];
  return [...cap, blob(c, -r * 0.45, r * 0.6, 0, r * 0.6, r * 0.9, r * 0.95)];      // long
}

// ---------------------------------------------------------------- birds --
const BIRD = [['#8E9AAF', '#6F7B91'], ['#B9BDC6', '#8A8F9C'], ['#A08872', '#7C6654'], ['#F6F6F3', '#A3ACB8']];   // pigeons, and a seagull (3)
// A duck: on the water (the pond), or standing on the bank on orange feet (feet: the duck who asks for jobs). Colours: 0
// a drake (green head, white ring, brown chest), 1 a brown duck, 2 a white farmyard duck, bigger.
const DUCK = [['#C9B48E', '#2F7A4A', '#8A5A3C'], ['#A9825A', '#A9825A', '#8A6A4A'], ['#F6F3EA', '#F6F3EA', '#E8E2D2']];
export function makeDuck(color, feet = false) {
  const [c1, c2, c3] = DUCK[color % DUCK.length];
  const root = new THREE.Group(), bodyG = new THREE.Group(), headG = new THREE.Group(); root.add(bodyG);
  const lift = feet ? 12 : 0;
  bodyG.add(mesh([blob(c1, 0, 8 + lift, 0, 16, 9, 11), blob(c1, -15, 12 + lift, 0, 6, 4, 6, [0, 0, 0.5]), blob(c3, 4, 9 + lift, 0, 11, 7, 10),
    blob(c3, -3, 12 + lift, 9.5, 10, 4, 2.5), blob(c3, -3, 12 + lift, -9.5, 10, 4, 2.5)]));
  if (color === 0) bodyG.add(mesh([blob('#FFFFFF', 10.5, 16.5 + lift, 0, 5.4, 1.3, 5.4)], false));
  headG.position.set(11, 15 + lift, 0); bodyG.add(headG);
  headG.add(mesh([blob(c2, -1, 1, 0, 5, 7, 5), blob(c2, 2, 8, 0, 7.5), blob('#F2A33A', 10, 7, 0, 5, 1.8, 3.4), blob('#22252B', 5, 10, 4.6, 1.2), blob('#22252B', 5, 10, -4.6, 1.2)]));
  if (feet) bodyG.add(mesh([cyl('#F2A33A', 0, 6, 4, 1.4, 12), cyl('#F2A33A', 0, 6, -4, 1.4, 12), blob('#F2A33A', 3, 0.8, 4, 4.5, 0.8, 3), blob('#F2A33A', 3, 0.8, -4, 4.5, 0.8, 3)]));
  if (color === 2) root.scale.setScalar(feet ? 1.9 : 1.35);   // (the duck who asks is big, to be seen from afar)
  function update(b, t, moving) {
    // bobbing on the water, now and then a dip of the head; on land a little shuffle, looking about
    bodyG.position.y = Math.sin(t * 2.4 + b.ph) * (feet ? 0.6 : 1.4);
    bodyG.rotation.z = Math.sin(t * 1.7 + b.ph) * 0.05 - (moving ? 0.08 : 0);
    const dip = feet ? 0 : Math.max(0, Math.sin(t * 0.7 + b.ph * 2)) ** 12;
    headG.rotation.z = -dip * 1.1; headG.rotation.y = feet ? Math.sin(t * 0.9 + b.ph) * 0.6 : 0;
  }
  return { root, update };
}
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
const FOOT = { bin: 28.5, cone: 18 };
export function makeProp(kind, on) {   // on: what it lies on, where that changes its look ('sand': a heap of sand)
  const root = new THREE.Group(), tip = new THREE.Group(), spin = new THREE.Group();
  root.add(tip); tip.add(spin);
  let parts, mid = 0;
  if (kind === 'cone') parts = [box('#FF7A2E', 0, 2, 0, 36, 4, 36), { geo: CONE, color: '#FF7A2E', at: [0, 25, 0], scale: [15, 44, 15], flat: true }, cyl('#ffffff', 0, 24, 0, 11.2, 9)];
  else if (kind === 'bin') parts = [cyl('#7C8792', 0, 32, 0, 25, 62), cyl('#5D6772', 0, 65, 0, 28.5, 6), blob('#5D6772', 0, 70, 0, 6, 4, 6), cyl('#69737E', 0, 20, 0, 25.6, 4), cyl('#69737E', 0, 44, 0, 25.6, 4)];
  else if (kind === 'box') { mid = 22; parts = [box('#C99A62', 0, 0, 0, 44, 44, 44), box('#E8D2A6', 0, 0, 0, 12, 45, 45), box('#B5854E', 0, -14, 22.4, 16, 10, 1)]; }
  else if (kind === 'pot') parts = [{ geo: CONE, color: '#C9683F', at: [0, 15, 0], scale: [20, 30, 20], rot: [Math.PI, 0, 0], flat: true }, cyl('#D97B50', 0, 30, 0, 22, 6), cyl('#5A4636', 0, 32.5, 0, 18, 2),
    blob('#4FA653', 0, 42, 0, 12, 10, 12), blob('#FF7FA0', 7, 52, 3, 6.5), blob('#FFD23F', -6, 54, -4, 6), blob('#FF7FA0', -2, 50, 8, 5.5), blob('#ffffff', 2, 57, -3, 5)];
  else if (kind === 'plate') parts = [cyl('#ffffff', 0, 1.5, 0, 17, 3), cyl('#E9EDF2', 0, 3, 0, 12, 1), blob('#F6A6C1', 0, 9, 0, 9, 6.5, 9), blob('#E0453A', 0, 16, 0, 3)];
  else if (kind === 'teddy') { mid = 12; parts = [   // a teddy bear: tummy, head, ears, muzzle, arms, legs
    blob('#B5793F', 0, -2, 0, 7, 8, 6), blob('#E8C08A', 2.5, -2, 0, 4, 5, 4.5), blob('#B5793F', 0, 9, 0, 6, 5.5, 5.5),
    blob('#B5793F', -1, 14, 4, 2.2), blob('#B5793F', -1, 14, -4, 2.2), blob('#E8C08A', 5, 8, 0, 2.4, 2, 2.6), blob('#2A1C14', 6.8, 8.6, 0, 0.9),
    blob('#2A1C14', 4.6, 10.8, 2.2, 0.7), blob('#2A1C14', 4.6, 10.8, -2.2, 0.7), blob('#B5793F', 1, 0, 6.5, 2.4, 4.5, 2.4), blob('#B5793F', 1, 0, -6.5, 2.4, 4.5, 2.4),
    blob('#B5793F', 2, -9, 3.5, 3, 2.6, 2.8), blob('#B5793F', 2, -9, -3.5, 3, 2.6, 2.8)]; }
  else if (kind === 'bone') { mid = 7; parts = [   // a bone: a shaft and two knuckles at each end
    cyl('#FFFFFF', 0, 0, 0, 4, 26, [0, 0, Math.PI / 2]), blob('#FFFFFF', -14, 0, 4, 5.5), blob('#FFFFFF', -14, 0, -4, 5.5), blob('#FFFFFF', 14, 0, 4, 5.5), blob('#FFFFFF', 14, 0, -4, 5.5)]; }
  else if (kind === 'mound') {
    // A heap of dug earth with clods thrown round it and a bone sticking out of the top. Low and wide, lighter and warmer
    // than a poo, which it looked like (dark brown, and on the sand most of all); on the beach it is a heap of sand.
    const [a, b, d] = on === 'sand' ? ['#E3C27E', '#D4AE68', '#EED7A0'] : ['#A77B52', '#8E6542', '#BC9064'];
    parts = [blob(a, 0, 2, 0, 31, 11, 27), blob(b, -12, 6, 8, 13, 7, 11), blob(d, 12, 5, -7, 12, 6, 11), blob(b, 4, 8, 4, 10, 5, 9),
      ...[0, 1, 2, 3, 4, 5].map((i) => blob(i % 2 ? b : a, Math.cos(i * 1.1 + 0.4) * (36 + (i % 3) * 5), 2, Math.sin(i * 1.1 + 0.4) * (32 + (i % 2) * 6), 4 + (i % 3), 2.5, 4)),
      cyl('#FFFFFF', 6, 17, -2, 3, 20, [0, 0, 0.5]), blob('#FFFFFF', -0.5, 25, 1, 4.5), blob('#FFFFFF', 2.5, 26.5, -5, 4.5)];
  }
  else if (kind === 'sausage') { mid = 7; parts = [   // a string of sausages
    blob('#D9705A', -17, 0, 0, 9, 5.5, 5.5), blob('#D9705A', 0, 0, 0, 9, 5.5, 5.5), blob('#D9705A', 17, 0, 0, 9, 5.5, 5.5),
    blob('#B5503E', -8.5, 0, 0, 2), blob('#B5503E', 8.5, 0, 0, 2), blob('#B5503E', -26, 0, 0, 2), blob('#B5503E', 26, 0, 0, 2)]; }
  else if (kind === 'sandcastle') parts = [   // a sandcastle: a mound, a keep with battlements, two towers, a little red flag
    cyl('#E3C27E', 0, 6, 0, 26, 12, undefined, 30), cyl('#E9CF8E', 0, 19, 0, 15, 14), ...[0, 1, 2, 3].map((i) => box('#E9CF8E', Math.cos(i * 1.57) * 12, 28, Math.sin(i * 1.57) * 12, 6, 5, 6)),
    cyl('#E9CF8E', -19, 16, 6, 6, 20), cyl('#E9CF8E', 18, 15, -7, 6, 18), cyl('#8A6A4A', 0, 36, 0, 0.8, 16), box('#E2453C', 4, 41, 0, 8, 5, 0.8)];
  else if (kind === 'frisbee') { mid = 2; parts = [cyl('#E2453C', 0, 0, 0, 16, 3), cyl('#F2675D', 0, 1.7, 0, 11, 0.6), cyl('#ffffff', 0, 1.9, 0, 6, 0.4)]; }   // a red flying disc
  else if (kind === 'apple') { mid = 7; parts = [blob('#D9342B', 0, 0, 0, 8, 7.5, 8), cyl('#6E4630', 0, 8, 0, 1, 4), blob('#4FA653', 3, 9, 0, 3, 1.2, 2)]; }
  else { mid = 13; parts = [blob('#D7E84A', 0, 0, 0, 13), { geo: new THREE.TorusGeometry(12.6, 1.2, 6, 20), color: '#ffffff', at: [0, 0, 0], scale: [1, 1, 1], rot: [0.5, 0.4, 0], flat: true }]; }
  // A bin or cone falls over its base's edge (FOOT: how far that is from the middle), so it ends up lying on its side on
  // the ground; tipped about the middle, half of it went into the ground
  const foot = FOOT[kind] || 0;
  if (kind === 'teddy') { mid *= 1.7; for (const p of parts) { p.at = p.at.map((v) => v * 1.7); p.scale = p.scale.map((v) => v * 1.7); } }   // a big, huggable teddy
  tip.position.x = foot; spin.position.set(-foot, mid, 0); spin.userData.mid = mid; spin.add(mesh(parts));
  return { root, tip, spin };
}
// What is left of something that broke.
export function makeShards(kind) {
  // a cartoon poo: a soft brown swirl of three
  if (kind === 'poo') return mesh([blob('#7A4A2A', 0, 3, 0, 7, 3.5, 7), blob('#86532F', 0, 7, 0, 5, 3, 5), blob('#93603A', 0.5, 10.5, 0, 3, 2.6, 3)]);
  if (kind === 'sandcastle') {                       // a heap of sand where it stood
    const sand = []; for (let i = 0; i < 7; i++) { const a = i * 2.2, d = 6 + (i % 3) * 7; sand.push(blob(i % 2 ? '#E3C27E' : '#E9CF8E', Math.cos(a) * d, 2, Math.sin(a) * d, 9, 4, 8)); }
    return mesh(sand);
  }
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
  if (o.kind === 'stall') return merged([                // a market stall: a counter with crates, under a striped awning
    box(WOOD, 0, 46, 0, 128, 8, 60), box(WOOD2, 0, 22, 0, 120, 40, 52),
    box('#C9A06A', -38, 54, 0, 40, 10, 44), box('#C9A06A', 0, 54, 0, 40, 10, 44), box('#C9A06A', 38, 54, 0, 40, 10, 44),
    ...[-60, 60].flatMap((x) => [cyl(WOOD2, x, 70, -28, 3, 140)]),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => box(i % 2 ? '#ffffff' : '#E8B04A', -56 + i * 16, 142, -6, 16, 4, 76, [0.22, 0, 0])),
  ]);
  return null;
}
export const lampGeometry = merged([cyl('#4A5560', 0, 100, 0, 4.5, 200), cyl('#4A5560', 0, 5, 0, 10, 10), box('#4A5560', 0, 200, 14, 5, 5, 34), blob('#FFF2B8', 0, 193, 28, 12, 9, 12)]);
// A flower: a stem, a bloom and its yellow middle, in few triangles (about 90, not 350): they are tiny, and there are
// over a thousand of them, the park's meadow full.
const FLOWER_BALL = new THREE.SphereGeometry(1, 7, 5), FLOWER_STEM = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
export const flowerGeometry = (color) => merged([{ ...cyl('#4FA653', 0, 6, 0, 1.2, 12), geo: FLOWER_STEM }, { ...blob(color, 0, 13, 0, 5, 3, 5), geo: FLOWER_BALL }, { ...blob('#FFD23F', 0, 14.5, 0, 2), geo: FLOWER_BALL }]);

// A house faces south (its front door at +z) and is turned with its tile (h.dir quarter turns clockwise). Lili's home and
// the school are houses with something of their own: a round window and a red door; a clock, a double door and a flag.
export function makeHouse(h) {
  if (SHOP_SIGN[h.kind]) return makeShop(h);
  const wall = h.color, w = h.w, d = h.d, hh = h.h;
  const roofGeo = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1).rotateY(Math.PI / 4);
  const parts = [
    box(wall, 0, hh / 2, 0, w, hh, d),
    { geo: roofGeo, color: h.roof, at: [0, hh + 45, 0], scale: [w * 0.78, 90, d * 0.82], flat: true },
    box('#ffffff', w * 0.18, 78, d / 2 + 1, 76, 66, 4), box('#9FD4F2', w * 0.18, 78, d / 2 + 2.5, 64, 54, 3),
    box('#ffffff', w * 0.18, 78, d / 2 + 4, 4, 54, 2), box('#ffffff', w * 0.18, 78, d / 2 + 4, 64, 4, 2),
    box('#B9B4A8', -w * 0.22, 3, d / 2 + 22, 60, 6, 40),
  ];
  if (h.kind === 'school') {
    parts.push(box('#8A5A3C', -w * 0.22, 56, d / 2 + 1, 90, 112, 4), box('#6E4630', -w * 0.22, 56, d / 2 + 3, 3, 112, 2),
      { geo: CYL, color: '#ffffff', at: [0, hh - 40, d / 2 + 3], scale: [26, 4, 26], rot: [Math.PI / 2, 0, 0], flat: true },
      box('#2A2A30', 0, hh - 32, d / 2 + 6, 3, 18, 2), box('#2A2A30', 7, hh - 40, d / 2 + 6, 14, 3, 2),
      cyl('#C9CBD0', w * 0.42, hh + 60, d / 2 - 20, 3, hh * 0.9 + 120), box('#4FA3E0', w * 0.42 + 26, hh + 150, d / 2 - 20, 48, 32, 2));
  } else {
    parts.push(box(h.kind === 'home' ? '#D9483B' : '#8A5A3C', -w * 0.22, 46, d / 2 + 1, 44, 92, 4), blob('#FFD23F', -w * 0.22 + 14, 46, d / 2 + 4, 3));
    if (h.kind === 'home') parts.push({ geo: CYL, color: '#ffffff', at: [0, hh - 50, d / 2 + 1], scale: [24, 4, 24], rot: [Math.PI / 2, 0, 0], flat: true },
      { geo: CYL, color: '#9FD4F2', at: [0, hh - 50, d / 2 + 2.5], scale: [19, 3, 19], rot: [Math.PI / 2, 0, 0], flat: true });
  }
  if (hh > 225) for (const x of [-0.22, 0.18]) if (h.kind !== 'school' || x > 0) parts.push(box('#ffffff', w * x, 178, d / 2 + 1, 62, 52, 4), box('#9FD4F2', w * x, 178, d / 2 + 2.5, 50, 40, 3));
  const m = mesh(parts); m.position.set(h.x, 0, h.y); m.rotation.y = -(h.dir || 0) * Math.PI / 2; m.receiveShadow = true;
  return m;
}
// A shop: lower than a house, a big window showing what it sells (pictures, not words: the players cannot read), a door,
// a striped awning over the front and the same picture on a sign above. Faces south like a house.
const SHOP_SIGN = {
  butcher: (y, z) => [0, 1, 2, 3, 4].map((i) => blob('#D9786A', -30 + i * 15, y - Math.abs(i - 2) * 4, z, 8, 5, 4)),       // a string of sausages
  bakery: (y, z) => [blob('#C98A45', -16, y, z, 16, 8, 6), blob('#E0A55C', 14, y + 2, z, 14, 9, 6), blob('#B5763A', 0, y - 8, z + 2, 12, 6, 5)],   // loaves
  cafe: (y, z) => [cyl('#ffffff', 0, y, z, 13, 20), cyl('#6E4630', 0, y + 9, z, 10, 2), { geo: new THREE.TorusGeometry(7, 2.2, 6, 12), color: '#ffffff', at: [16, y, z], scale: [1, 1, 1], flat: true }],   // a cup
};
function makeShop(h) {
  const w = h.w, d = h.d, hh = h.h, f = d / 2, roofGeo = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1).rotateY(Math.PI / 4);
  const parts = [
    box(h.color, 0, hh / 2, 0, w, hh, d),
    { geo: roofGeo, color: h.roof, at: [0, hh + 30, 0], scale: [w * 0.78, 60, d * 0.82], flat: true },
    box('#ffffff', -w * 0.12, 62, f + 1, w * 0.52, 84, 4), box('#BFE3F5', -w * 0.12, 62, f + 2.5, w * 0.48, 74, 3),   // the window
    box('#8A5A3C', w * 0.32, 48, f + 1, 46, 96, 4), blob('#FFD23F', w * 0.32 - 15, 48, f + 4, 3),                     // the door
    box('#ffffff', 0, hh - 32, f + 1, 120, 44, 4),                                                                      // the sign board
    ...SHOP_SIGN[h.kind](70, f + 6), ...SHOP_SIGN[h.kind](hh - 32, f + 5),
    ...Array.from({ length: 12 }, (_, i) => box(h.awning[i % 2], -w / 2 + 14 + i * (w - 28) / 11, 122, f + 22, (w - 28) / 11 + 0.5, 4, 48, [0.35, 0, 0])),
  ];
  const m = mesh(parts); m.position.set(h.x, 0, h.y); m.rotation.y = -(h.dir || 0) * Math.PI / 2; m.receiveShadow = true;
  return m;
}
// Fixtures: solid things that stay put, facing south (turned with their tile). Lili's kennel with her bowl; the town
// square's fountain; a café table with two chairs.
export function fixtureGeometry(kind) {
  if (kind === 'kennel') return kennelGeometry;
  if (kind === 'umbrella') return merged([   // a striped beach umbrella over a towel
    cyl('#F4F2EA', 0, 70, 0, 2.5, 140), { geo: new THREE.ConeGeometry(1, 1, 8), color: '#F2675D', at: [0, 136, 0], scale: [72, 26, 72], flat: true },
    { geo: new THREE.ConeGeometry(1, 1, 8), color: '#FFF4E2', at: [0, 137, 0], scale: [44, 17, 44], rot: [0, Math.PI / 8, 0], flat: true }, blob('#F4F2EA', 0, 150, 0, 4),
    box('#4FA3E0', 46, 1, 34, 52, 2, 96), box('#ffffff', 46, 2.2, 14, 52, 0.5, 10), box('#ffffff', 46, 2.2, 54, 52, 0.5, 10),
  ]);
  if (kind === 'gatepost') return merged([   // a stone gatepost with a ball on top
    box('#C9C2B4', 0, 44, 0, 30, 88, 30), box('#B9B4A8', 0, 90, 0, 36, 6, 36), blob('#D9D3C6', 0, 104, 0, 12),
  ]);
  if (kind === 'van') return merged([   // the ice cream van: pink, its hatch and striped awning to the south, a big cone on its roof
    box('#FBD3DF', -12, 56, 0, 150, 80, 84), box('#FFF4E2', -12, 99, 0, 154, 8, 88), box('#FBD3DF', 80, 40, 0, 36, 52, 80),
    box('#BFE6F5', 99, 54, 0, 2, 22, 66), box('#BFE6F5', 80, 56, 40.6, 26, 20, 2), box('#4A2E22', -20, 64, 42.4, 72, 34, 2), box('#F7E8C8', -20, 46, 44, 80, 4, 8),
    box('#F2675D', -20, 86, 52, 80, 3, 20), box('#ffffff', -38, 86.5, 52, 12, 3, 20), box('#ffffff', -2, 86.5, 52, 12, 3, 20),
    ...[-58, 60].flatMap((x) => [-1, 1].map((s) => cyl('#2A2A2A', x, 14, s * 40, 14, 10, [Math.PI / 2, 0, 0]))),
    { geo: CONE, color: '#D9A15A', at: [-12, 124, 0], scale: [14, 36, 14], rot: [Math.PI, 0, 0], flat: true },
    blob('#F7A8C4', -12, 146, 0, 15), blob('#FFF4D6', -12, 163, 0, 12), blob('#E2453C', -12, 176, 0, 4),
  ]);
  if (kind === 'basket') return merged([   // a round wicker basket, open at the top, the dark inside showing
    cyl('#C98F4E', 0, 9, 0, 26, 18), cyl('#A8723A', 0, 5, 0, 26.4, 2), cyl('#A8723A', 0, 11, 0, 26.4, 2), cyl('#6E4428', 0, 17.6, 0, 23, 1),
    { geo: new THREE.TorusGeometry(25, 2.8, 6, 28), color: '#E0A866', at: [0, 18, 0], scale: [1, 1, 1], rot: [Math.PI / 2, 0, 0], flat: true },
  ]);
  if (kind === 'fountain') return merged([
    cyl('#C9C2B4', 0, 14, 0, 78, 28), cyl('#7EC8E8', 0, 27, 0, 68, 3), cyl('#B9B4A8', 0, 46, 0, 12, 64),
    cyl('#C9C2B4', 0, 78, 0, 30, 8), cyl('#7EC8E8', 0, 83, 0, 25, 2), blob('#BFE6F5', 0, 100, 0, 6, 16, 6), blob('#E6F6FC', 0, 90, 0, 22, 4, 22),
  ]);
  if (kind === 'cafe-table') return merged([
    cyl('#ffffff', 0, 44, 0, 22, 3), cyl('#4A5560', 0, 22, 0, 3, 44), cyl('#4A5560', 0, 1.5, 0, 12, 3),
    ...[-1, 1].flatMap((s) => [box('#3E9A6E', s * 34, 26, 0, 20, 3, 20), box('#3E9A6E', s * 43, 40, 0, 3, 30, 20), box('#4A5560', s * 34, 12, 0, 3, 24, 3)]),
  ]);
  return null;
}
// Lili's kennel, facing south like a house, and her bowl in front of it
const kennelGeometry = merged([
  box('#C8553D', 0, 26, 0, 60, 52, 56), box('#4A2E22', 0, 20, 28.5, 26, 34, 2), blob('#4A2E22', 0, 37, 28.5, 13, 13, 1),
  { geo: new THREE.CylinderGeometry(0.02, 1, 1, 4, 1).rotateY(Math.PI / 4), color: '#7A4A2A', at: [0, 70, 0], scale: [48, 36, 46], flat: true },
  cyl('#4FA3E0', 26, 4, 46, 10, 8, undefined, 8), cyl('#B98248', 26, 7, 46, 7, 2),
]);
