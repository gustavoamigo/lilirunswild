// 3D models, all built from simple primitives. No model files to load.
// Every model faces +x and stands on y = 0.
import * as THREE from '../vendor/three.module.min.js';
import { STYLE } from './style.js';
import { clamp, lerp } from './util.js';

const SPH = new THREE.SphereGeometry(1, 24, 16);
const SPH_LO = new THREE.SphereGeometry(1, 12, 9);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CONE = new THREE.CylinderGeometry(0.42, 1, 1, 16);
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
// A golden English cocker spaniel: long curly ears, a domed head, feathered legs and a tail
// that never stops. He is built round his hips: the whole front of him swings up and down
// about them (rearing up to greet someone, bowing to play, sitting to drive).
const COAT = '#D9A05B', EAR = '#B5753A', FEATHER = '#EFCB96', DARK = '#2B2024';
const HIP_X = -26, HIP_Y = 36;

export function makeDog() {
  const root = new THREE.Group();                       // position + heading (+ landing squash)
  const tilt = group(HIP_X, HIP_Y, 0);                  // swings about the hips
  const g = group(-HIP_X, -HIP_Y, 0);                   // everything inside is in plain model coordinates
  tilt.add(g);

  const torso = mesh([
    blob(COAT, 22, 45, 0, 21, 22, 19), blob(COAT, -2, 45, 0, 34, 19, 17.5), blob(COAT, -26, 46, 0, 20, 20, 18.5),
    blob(FEATHER, 37, 39, 0, 9, 14, 12), blob(FEATHER, 0, 29, 0, 26, 7, 11),
    blob(COAT, 37, 60, 0, 13, 19, 13, [0, 0, -0.6]),
  ]);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(12.5, 3, 8, 20), mat('#E0453A'));
  collar.rotation.set(Math.PI / 2, 0, 0); const collarG = group(39, 62, 0, collar); collarG.rotation.z = -0.6;
  const tag = ball('#FFD23F', 3.2, 3.2, 1.5, 49, 53, 0);

  // head
  const head = group(46, 72, 0);
  head.scale.setScalar(1.1);
  head.add(mesh([
    blob(COAT, 4, 4, 0, 16, 15, 15), blob(COAT, 2, 12, 0, 11, 9, 11),
    blob(COAT, 22, -1, 0, 13, 8.5, 9), blob(FEATHER, 20, -6, 5, 9, 5.5, 5), blob(FEATHER, 20, -6, -5, 9, 5.5, 5),
    blob(DARK, 34.5, 2.5, 0, 4.5, 3.8, 5.2),
  ]));
  const eyes = [1, -1].map((s) => {
    const e = group(14.5, 8, s * 9.6, ball(mat('#2A1C14', { roughness: 0.25 }), 3.7, 3.9, 3.2, 0, 0, 0, false), ball('#ffffff', 1.1, 1.1, 1.1, 2.4, 1.6, s * 0.9, false));
    head.add(e); return e;
  });
  const brows = [1, -1].map((s) => { const b = mesh([blob(EAR, 0, 0, 0, 5, 1.6, 4)], false); b.position.set(13.5, 13.4, s * 8.5); head.add(b); return b; });
  const jaw = group(12, -6, 0, mesh([blob(FEATHER, 9, -1.5, 0, 10, 3.6, 6.5)], false));
  const tongue = ball('#F58CA0', 7, 1.6, 4.2, 13, -0.2, 0, false); jaw.add(tongue);
  head.add(jaw);
  const ears = [1, -1].map((s) => {
    const e = group(-1, 11, s * 13.5, mesh([blob(EAR, 0, -13, s * 2, 8.5, 17, 4.6), blob(EAR, 1, -22, s * 3, 9.5, 12, 5.6), blob(EAR, -1, -30, s * 3.5, 11, 9.5, 6.2), blob(EAR, 4, -33, s * 3, 7, 6, 5)]));
    head.add(e); return e;
  });

  // legs: pivots at the shoulders and hips
  const legGeo = (hind) => merged([
    hind ? blob(COAT, -1, -6, 0, 10.5, 14, 8.5) : blob(COAT, 0, -8, 0, 7.8, 13, 7.6),
    blob(COAT, 1, -22, 0, 6, 11, 6), blob(FEATHER, -5, -17, 0, 5, 12, 4.4),
    blob(FEATHER, 3, -32.2, 0, 8.6, 4.4, 7.4),
  ]);
  const fGeo = legGeo(false), hGeo = legGeo(true);
  const leg = (geo, x, z) => { const m = new THREE.Mesh(geo, vc()); m.castShadow = true; return group(x, 36.6, z, m); };
  const fl = leg(fGeo, 24, 10.5), fr = leg(fGeo, 24, -10.5), hl = leg(hGeo, HIP_X, 11.5), hr = leg(hGeo, HIP_X, -11.5);

  const tail = group(-43, 52, 0, mesh([blob(COAT, -8, 2, 0, 11, 4.4, 4.4), blob(FEATHER, -10, -2, 0, 9, 6, 2.8), blob(FEATHER, -17, 2, 0, 5, 4, 3)]));

  g.add(torso, collarG, tag, head, fl, fr, tail);
  // the hind legs hang from the hips but do not swing with the body, so his feet stay put when he rears up
  const hips = group(HIP_X, HIP_Y, 0); hl.position.set(0, 0.6, 11.5); hr.position.set(0, 0.6, -11.5); hips.add(hl, hr);
  root.add(tilt, hips);

  // smoothed pose: everything eases towards its target so states blend into each other
  const P = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, amp: 0, gal: 0, earBack: 0, earOut: 0, yaw: 0, hp: 0, jaw: 0, tailUp: 0.5, wag: 0.45, wagHz: 11, y: 0, tongue: 0, lift: 0 };
  let last = -1, blink = 0;

  function update(p, t) {
    const dt = last < 0 ? 0.016 : clamp(t - last, 0, 0.05); last = t;
    const sp = p.state === 'drive' ? 0 : Math.hypot(p.vx, p.vy);
    const T = { pitch: 0, fl: 0, fr: 0, hl: 0, hr: 0, amp: p.air ? 0 : clamp(sp / 240, 0, 1) * (p.zoom ? 0.95 : 0.6), gal: p.zoom ? 1 : 0,
      earBack: clamp(sp / 640, 0, 1) * 1.1, earOut: clamp(sp / 640, 0, 1) * 0.5, yaw: p.lookYaw || 0, hp: p.lookPitch || 0, jaw: 0,
      tailUp: 0.5, wag: 0.45, wagHz: 11, y: 0, tongue: p.zoom ? 1 : 0, lift: 0 };
    const paddle = Math.sin(t * 17);
    if (p.air) {                                         // a flying leap: front legs reach, hind legs trail, ears fly
      const up = clamp(p.vz / 500, -1, 1);
      T.pitch = up * 0.34; T.fl = 1.2 - up * 0.2; T.fr = 1.05 - up * 0.2; T.hl = -1.05; T.hr = -0.9;
      T.earBack = 0.9; T.earOut = 1.25; T.tailUp = 0.2; T.tongue = 1;
    } else if (p.state === 'paws') {                     // up on his hind legs, paws going like mad
      T.pitch = 0.98; T.fl = 0.25 + paddle * 0.4; T.fr = 0.25 - paddle * 0.4; T.wag = 0.8; T.wagHz = 24; T.tongue = 1; T.hp = -0.45; T.earOut = 0.3;
    } else if (p.state === 'drive') {                    // sitting at the wheel
      const k = clamp(Math.abs(p.carV || 0) / 800, 0, 1);
      T.pitch = 0.62; T.hl = T.hr = 1.35; T.fl = 0.42 + (p.carSteer || 0) * 0.3; T.fr = 0.42 - (p.carSteer || 0) * 0.3;
      T.earBack = k * 1.25; T.earOut = k * 0.7; T.tongue = k > 0.35 ? 1 : 0; T.hp = -0.5; T.wag = 0.3 + k * 0.4; T.wagHz = 16; T.tailUp = -0.2;
    } else if (p.state === 'daze') {                     // flat on his tummy seeing stars
      T.fl = T.fr = 1.35; T.hl = T.hr = -1.35; T.y = -20; T.yaw = Math.sin(t * 13) * 0.35; T.hp = 0.1; T.wag = 0.05; T.earOut = 0.5; T.tailUp = 0;
    } else if (p.bow > 0) {                              // play bow: elbows down, bottom up, "come on then!"
      T.pitch = -0.4; T.fl = T.fr = 1.5; T.wag = 0.8; T.wagHz = 20; T.hp = 0.5; T.tailUp = 0.9;
    } else if (p.point > 0.5) {                          // a bird! One paw up, tail out straight, stock still
      T.fr = 0.75; T.lift = 1; T.wag = 0.02; T.tailUp = -0.1; T.pitch = -0.04;
    } else if (sp < 30) { T.wag = 0.55 + (p.happy ? 0.25 : 0); T.wagHz = p.happy ? 20 : 11; }
    if (p.barkT > 0) { T.jaw = 0.75; T.hp += 0.3; }
    const k = 1 - Math.exp(-dt * 14), ks = 1 - Math.exp(-dt * 7);
    for (const n in T) P[n] = lerp(P[n], T[n], n === 'gal' || n === 'tongue' ? ks : k);

    // the running cycle rides on top of the pose: a trot (diagonal pairs) that blends into a bounding gallop
    const ph = p.stride || 0, a = P.amp, s = Math.sin(ph), gl = P.gal;
    const cyc = (trot, gallop) => lerp(trot, gallop, gl) * a;
    const pitch = P.pitch + gl * a * Math.sin(ph + 1.0) * 0.14;
    tilt.rotation.z = pitch;
    fl.rotation.z = P.fl + cyc(s, Math.sin(ph) * 1.15) * 0.95;
    fr.rotation.z = P.fr + cyc(-s, Math.sin(ph - 0.55) * 1.15) * 0.95;
    hl.rotation.z = P.hl + cyc(-s, Math.sin(ph + 2.7) * 1.1) * 0.95;
    hr.rotation.z = P.hr + cyc(s, Math.sin(ph + 2.2) * 1.1) * 0.95;
    fr.position.y = 36.6 + P.lift * 5; fr.position.x = 24 + P.lift * 3;
    const bob = Math.abs(s) * 2.5 * a * (1 - gl) + gl * a * (3 + Math.sin(ph + 0.4) * 5) + P.y;
    tilt.position.y = HIP_Y + bob; hips.position.y = HIP_Y + bob;
    // lying flat (daze): the hind legs go flat too
    hips.rotation.z = 0;

    // head: follows the birds, bobs with the run, nods with each bark
    head.rotation.y = -P.yaw;
    head.rotation.z = P.hp - pitch * 0.55 + Math.sin(ph * 2 + 0.6) * 0.05 * a;
    head.rotation.x = p.state === 'daze' ? Math.sin(t * 9) * 0.25 : (p.tiltHead || 0) * 0.35;
    jaw.rotation.z = -Math.max(P.jaw, P.tongue * (0.3 + Math.sin(t * 15) * 0.07));
    tongue.scale.x = 4 + P.tongue * 6; tongue.position.x = 9 + P.tongue * 7; tongue.visible = P.tongue > 0.05 || P.jaw > 0.2;
    // ears: stream back and flap in the wind, fly up in a jump, swing with the trot
    const flap = Math.sin(t * 21) * 0.14 * clamp(P.earBack, 0, 1) + Math.sin(ph * 2) * 0.16 * a;
    ears.forEach((e, i) => {
      const side = i ? 1 : -1;
      e.rotation.z = -P.earBack - flap * 0.6;
      e.rotation.x = side * (0.1 + P.earOut + flap * (i ? 1 : -1) * 0.5 + (p.landT > 0 ? p.landT * 2 : 0));
    });
    tail.rotation.z = P.tailUp;
    tail.rotation.y = Math.sin(t * P.wagHz) * P.wag;
    // his whole bottom wiggles when the tail really goes
    hips.rotation.y = Math.sin(t * P.wagHz) * P.wag * 0.12 * (a < 0.2 ? 1 : 0);

    blink = (t % 3.7) < 0.12 || p.state === 'daze' ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = lerp(e.scale.y, blink, 0.5); });
    brows.forEach((b, i) => { b.rotation.x = (i ? -1 : 1) * (p.point > 0.5 ? 0.5 : 0.15); b.position.y = 13.4 + (p.barkT > 0 || p.point > 0.5 ? 1.5 : 0); });

    const sq = clamp((p.landT || 0) / 0.22, 0, 1);
    root.scale.set(1 + sq * 0.12, 1 - sq * 0.26, 1 + sq * 0.12);
    root.position.set(p.x, p.z, p.y);
    root.rotation.y = -p.heading;
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
