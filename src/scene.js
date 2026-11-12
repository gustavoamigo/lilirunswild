// The 3D view. Game logic lives on a flat map (x east, y south, z = height); here map y becomes
// three.js z and height becomes three.js y. The camera never turns: it looks north, from above
// and behind, and slides after whoever it is following.
import * as THREE from '../vendor/three.module.min.js';
import { STYLE } from './style.js';
import { W, H, BOUNDS } from './world.js';
import { paintGround } from './ground.js';
import * as M from './models.js';
import { clamp, lerp, rng } from './util.js';

export const view = { w: 1, h: 1, dpr: 1 };
const FOV = 42, CAM_UP = 500, CAM_BACK = 700;
let renderer, scene, camera, sun, world;
let fit = 1, zoom = 1;
const camAim = new THREE.Vector3();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _mx = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

let dog, car;
const trees = [], lamps = [], plats = [], props = [], people = [], birds = [], debris = [];

export function initScene(canvas, w) {
  world = w;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(STYLE.bg);
  scene.fog = new THREE.Fog(STYLE.bg, 1700, 3900);
  camera = new THREE.PerspectiveCamera(FOV, 1, 20, 6000);

  scene.add(new THREE.HemisphereLight(STYLE.hemi[0], STYLE.hemi[1], STYLE.hemi[2]));
  sun = new THREE.DirectionalLight(STYLE.sun[0], STYLE.sun[1]);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -1300; sc.right = 1300; sc.top = 1300; sc.bottom = -1300; sc.near = 100; sc.far = 4000;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 2;
  scene.add(sun, sun.target);

  // ---- ground: endless plain grass, with the painted town laid on top ----
  const far = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), M.surf({ color: '#9BD770' }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -1, H / 2); far.receiveShadow = true; scene.add(far);
  const res = renderer.capabilities.maxTextureSize >= 4096 ? 1 : 0.66;
  const tex = new THREE.CanvasTexture(paintGround(world, res));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), M.surf({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true; scene.add(ground);

  const vc = M.surf({ color: '#ffffff', vertexColors: true });
  // ---- trees: the leaves fade when they would hide whoever the camera follows ----
  for (const t of world.trees) {
    const g = new THREE.Group(); g.position.set(t.x, 0, t.y); g.scale.setScalar(t.s); g.rotation.y = t.seed;
    const trunk = new THREE.Mesh(M.trunkGeometry, M.mat('#B98248')); trunk.castShadow = true;
    const leafMat = M.surf({ color: '#ffffff', vertexColors: true, transparent: true });
    const leaves = new THREE.Mesh(M.canopyGeometry(t.hue), leafMat); leaves.castShadow = true;
    g.add(trunk, leaves); scene.add(g);
    trees.push({ t, g, leaves, leafMat, faded: false });
  }
  for (const l of world.lamps) {
    const m = new THREE.Mesh(M.lampGeometry, vc); m.castShadow = true; m.position.set(l.x, 0, l.y); scene.add(m);
    lamps.push({ o: world.obstacles.find((o) => o.kind === 'lamp' && o.x === l.x && o.y === l.y), m });
  }
  for (const o of world.platforms) {
    const geo = M.platformGeometry(o); if (!geo) continue;
    const m = new THREE.Mesh(geo, vc); m.castShadow = true; m.receiveShadow = true;
    m.position.set((o.ax + o.bx) / 2, 0, (o.ay + o.by) / 2); scene.add(m); plats.push({ o, m });
  }
  for (const h of world.houses) scene.add(M.makeHouse(h));

  // ---- the hedge round the edge of town, and the flowers in the park ----
  const R = rng(7), spots = [];
  for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 62) spots.push([x, BOUNDS.y0 - 34], [x, BOUNDS.y1 + 34]);
  for (let y = BOUNDS.y0; y <= BOUNDS.y1; y += 62) spots.push([BOUNDS.x0 - 34, y], [BOUNDS.x1 + 34, y]);
  const hedge = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), M.surf({ color: '#ffffff' }), spots.length);
  const col = new THREE.Color();
  spots.forEach(([x, y], i) => {
    const r = 40 + R() * 14;
    _mx.compose(_v.set(x + (R() - 0.5) * 14, 18, y + (R() - 0.5) * 14), _q.identity(), _s.set(r, 34 + R() * 16, r));
    hedge.setMatrixAt(i, _mx); hedge.setColorAt(i, col.set(['#3F9A55', '#4FA653', '#5CB563'][(R() * 3) | 0]));
  });
  hedge.castShadow = true; hedge.receiveShadow = true; scene.add(hedge);
  ['#FF7FA0', '#FFD23F', '#ffffff', '#B48BE0'].forEach((c, k) => {
    const list = world.flowers.filter((f) => f.c === k);
    const im = new THREE.InstancedMesh(M.flowerGeometry(c), vc, list.length);
    list.forEach((f, i) => { _mx.compose(_v.set(f.x, 0, f.y), _q.identity(), _s.setScalar(f.s)); im.setMatrixAt(i, _mx); });
    scene.add(im);
  });

  for (const o of world.props) { const m = M.makeProp(o.kind); scene.add(m.root); props.push({ o, ...m }); }
  for (const o of world.people) { const m = M.makePerson(o.look); scene.add(m.root); people.push({ o, m }); }
  for (const f of world.flocks) for (const b of f.birds) { const m = M.makeBird(b.color); scene.add(m.root); birds.push({ f, b, m }); }
  car = M.makeCar(); scene.add(car.root);
  dog = M.makeDog(); scene.add(dog.root);
  resize();
}

export function resize() {
  view.w = window.innerWidth; view.h = window.innerHeight; view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(view.dpr); renderer.setSize(view.w, view.h, false);
  camera.aspect = view.w / view.h;
  // on a tall, narrow screen the camera backs off so there is still room to see where he is going
  fit = clamp(1.3 / camera.aspect, 1, 2.1);
  camera.updateProjectionMatrix();
}

// world point (x, height, z) -> [screenX, screenY, pixels per world unit, in front of the camera]
export function project(x, h, z) {
  _v.set(x, h, z);
  const d = _v.distanceTo(camera.position);
  _v.project(camera);
  return [(_v.x * 0.5 + 0.5) * view.w, (-_v.y * 0.5 + 0.5) * view.h, view.h / (2 * Math.tan((FOV * Math.PI) / 360) * d), _v.z < 1];
}
// the spot on the ground (map x, y) under a point on the screen
export function screenToGround(sx, sy, h = 0) {
  _a.set((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1, 0.5).unproject(camera).sub(camera.position);
  if (_a.y >= -1e-4) return null;
  const k = (h - camera.position.y) / _a.y;
  return { x: camera.position.x + _a.x * k, y: camera.position.z + _a.z * k };
}

function placeCamera() {
  const d = fit * zoom;
  camera.position.set(camAim.x, CAM_UP * d, camAim.z + CAM_BACK * d);
  camera.lookAt(camAim.x, 30, camAim.z - 70 * d);
  camera.updateMatrixWorld();
  sun.position.set(camAim.x + STYLE.sunAt[0], STYLE.sunAt[1], camAim.z + STYLE.sunAt[2]);
  sun.target.position.copy(camAim);
}
export function snapCamera(f) { camAim.set(f.x, 0, f.y); zoom = f.zoom || 1; placeCamera(); }

export function render(G, dt) {
  const t = G.t, f = G.focus;
  // ---- camera: a little ahead of where he is going, further back the faster he goes ----
  const k = 1 - Math.exp(-dt * 4);
  camAim.x = lerp(camAim.x, f.x + f.vx * 0.3, k); camAim.z = lerp(camAim.z, f.y + f.vy * 0.3, k);
  zoom = lerp(zoom, f.zoom || 1, 1 - Math.exp(-dt * 2));
  placeCamera();

  dog.update(G.dog, t);
  car.update(G.car, t, dt);

  // ---- leaves between the camera and him go see-through ----
  _a.copy(camera.position); _b.set(f.x, 40, f.y).sub(_a);
  const len2 = _b.lengthSq();
  for (const e of trees) {
    const s = e.t.s;
    _v.set(e.t.x, 200 * s, e.t.y).sub(_a);
    const u = clamp(_v.dot(_b) / len2, 0, 1);
    const d = _v.addScaledVector(_b, -u).length();
    // ... and so do the ones standing right in front of the camera, which would fill the screen
    const front = e.t.y - f.y - 250 * fit * zoom;
    e.faded = d < 112 * s + (e.faded ? 85 : 40) || front > (e.faded ? -40 : 0);
    e.leafMat.opacity = lerp(e.leafMat.opacity, e.faded ? 0.12 : 1, 1 - Math.exp(-dt * 9));
    e.leaves.castShadow = true;
    e.leafMat.depthWrite = e.leafMat.opacity > 0.9;
    const w = e.t.wob;
    e.leaves.rotation.z = Math.sin(t * 19) * w * 0.07; e.leaves.rotation.x = Math.cos(t * 16) * w * 0.05;
  }
  for (const e of lamps) e.m.rotation.z = Math.sin(t * 30) * (e.o.wob || 0) * 0.06;
  for (const e of plats) { e.m.rotation.z = Math.sin(t * 34) * e.o.wob * 0.03; e.m.position.y = Math.abs(Math.sin(t * 34)) * e.o.wob * 2; }

  for (const e of props) {
    const o = e.o;
    e.root.visible = !o.gone; if (o.gone) continue;
    e.root.position.set(o.x, o.z, o.y); e.root.rotation.y = -o.dir;
    e.tip.rotation.z = -o.tip + Math.sin(t * 28) * o.wob * 0.12;
    e.spin.rotation.z = -o.roll;
  }
  // what is left behind: broken pots and plates, spilt rubbish
  for (let i = debris.length; i < G.debris.length; i++) {
    const d = G.debris[i], m = M.makeShards(d.kind);
    m.position.set(d.x, 0, d.y); m.rotation.y = d.dir; m.receiveShadow = true; scene.add(m); debris.push(m);
  }
  for (const e of people) e.m.update(e.o, t);
  for (const e of birds) {
    const { f: fl, b, m } = e, air = fl.state !== 'ground';
    const spread = air ? 1 + Math.min(1, fl.t) * 0.8 : 1;
    m.root.position.set(fl.x + b.ox * spread, fl.h + (air ? Math.sin(t * 6 + b.ph) * 14 + b.ph * 6 : 0), fl.y + b.oy * spread);
    m.root.rotation.y = -(air ? fl.dir + Math.sin(t * 2 + b.ph) * 0.25 : b.face + Math.floor(t * 0.4 + b.ph) * 1.7);
    m.update(b, t, air);
  }
  renderer.render(scene, camera);
}
