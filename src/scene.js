// The 3D view. Game logic lives on a flat map (x east, y south, z = height); here map y becomes
// three.js z and height becomes three.js y. The camera never turns: it looks north, from above
// and behind, and slides after whoever it is following.
import * as THREE from '../vendor/three.module.min.js';
import { STYLE } from './style.js';
import { W, H, BOUNDS, TILE } from './world.js';
import { paintTile } from './ground.js';
import { makeWater, WATER_Y } from './water.js';
let water = null;
import * as M from './models.js';
import { clamp, lerp, rng } from './util.js';

export const view = { w: 1, h: 1, dpr: 1 };
// The studio (?studio) looks at him from close by. It still never turns: only how far and how high.
export const studioCam = { dist: 420, elev: 0.3 };
const FOV = 42, CAM_UP = 500, CAM_BACK = 700;
// Haze only softens the horizon. It is measured from the camera, so it backs off as the camera does (in the car,
// on a tall screen): otherwise the town she is driving through goes grey.
const FOG_NEAR = 2600, FOG_FAR = 6200;
let renderer, scene, camera, sun, world;
let fit = 1, zoom = 1;
const camAim = new THREE.Vector3();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _mx = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
// how something she carries hangs from her mouth: its middle `y` below her teeth, turned `rz` (the teddy by its head,
// the string of sausages by one end)
const HANG = { teddy: { y: -19.6, rz: 0 }, sausage: { y: -29, rz: Math.PI / 2 }, frisbee: { y: -14, rz: Math.PI / 2 } };
// and how it lies in a tug of war, stretched along `axis`: the teddy on its side with its head towards her
const TUG = { teddy: { rz: -Math.PI / 2, axis: 'y' }, sausage: { rz: 0, axis: 'x' } };

let dog, car;
// Swimming: her waterline is the lake's surface, and she pushes the water as she goes (src/water.js), which makes her
// ripples and wake. She casts no shadow while swimming (on the water it made her look as if she lay on top of it).
let swimming = false;
// A splash's crown: a sheet of water that shoots up round where she landed, flaring out, then falls back into the water.
const CROWN_T = 0.8;
let crownGeo = null;
const crowns = [];
function crown(x, y) {
  if (!crownGeo) {
    // one sheet of water: an open ring that flares outward as it rises, its rim drawn up into points
    const g = new THREE.CylinderGeometry(1, 1, 1, 48, 6, true).translate(0, 0.5, 0), P = g.attributes.position;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x);
      const rim = 0.65 + 0.35 * Math.pow(Math.abs(Math.cos(a * 4.5 + Math.sin(a * 3) * 0.6)), 3);   // uneven points
      const r = 1 + 0.55 * y * y;
      P.setXYZ(k, x * r, y * rim, z * r);
    }
    g.computeVertexNormals(); crownGeo = g;
  }
  const mat = M.surf({ color: '#F2FBFF', transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const m = new THREE.Mesh(crownGeo, mat); m.position.set(x, 10, y); m.renderOrder = 2; scene.add(m);
  crowns.push({ m, mat, t: 0 });
}
function updateCrowns(dt) {
  for (let i = crowns.length - 1; i >= 0; i--) {
    const c = crowns[i]; c.t += dt;
    const u = c.t / CROWN_T;
    if (u >= 1) { scene.remove(c.m); c.mat.dispose(); crowns.splice(i, 1); continue; }
    c.m.scale.set(24 + u * 30, 70 * Math.sin(Math.min(1, u * 1.15) * Math.PI) + 2, 24 + u * 30);   // up fast, falling back as it spreads
    c.mat.opacity = 0.95 * (1 - u * u);
  }
}
function updateSwim(p, t) {
  if (!!p.swim !== swimming) { swimming = !!p.swim; dog.root.traverse((o) => { if (o.isMesh) o.castShadow = !swimming; }); }
  if (!swimming || !water) return;
  const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 110), hx = Math.cos(p.heading), hy = Math.sin(p.heading);
  // her chest, paddling: pushing the water up and down in rhythm (a steady push would pile it into a mound), harder as she goes
  water.push(p.x + hx * 34, p.y + hy * 34, 10, (0.1 + 0.2 * sp) * Math.sin(t * 6));
  if (p.splashed) { water.push(p.x + hx * 30, p.y + hy * 30, 18, p.splashed); p.splashed = 0; }   // how hard: set by what splashed
  if (p.crown) { crown(p.x, p.y); p.crown = 0; }
}
const trees = [], lamps = [], plats = [], props = [], people = [], birds = [], debris = [], animals = [];

export function initScene(canvas, w) {
  world = w;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(STYLE.bg);
  scene.fog = new THREE.Fog(STYLE.bg, FOG_NEAR, FOG_FAR);          // placeCamera moves it out with the camera
  camera = new THREE.PerspectiveCamera(FOV, 1, 20, 16000);

  scene.add(new THREE.HemisphereLight(STYLE.hemi[0], STYLE.hemi[1], STYLE.hemi[2]));
  sun = new THREE.DirectionalLight(STYLE.sun[0], STYLE.sun[1]);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -1300; sc.right = 1300; sc.top = 1300; sc.bottom = -1300; sc.near = 100; sc.far = 4000;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 2;
  scene.add(sun, sun.target);

  // ---- ground: endless plain grass, with the painted town laid on top ----
  const far = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), M.surf(world.studio ? { map: studioFloor() } : { color: '#9BD770' }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -1, H / 2); far.receiveShadow = true; scene.add(far);
  if (world.studio) {
    dog = M.makeDog(); scene.add(dog.root); car = { update() {} };
    for (const o of world.people) { const m = M.makePerson(o.look); scene.add(m.root); people.push({ o, m }); }
    resize(); return;
  }
  vc = M.surf({ color: '#ffffff', vertexColors: true });
  streamTiles(world.start.x, world.start.y, true);

  // ---- the hedge round the edge of town, and the flowers in the park ----
  // Each is drawn as instances of one shape, a batch for each CHUNK square of town: one batch for all of town is always
  // drawn whole, wherever the camera looks (with the park, that was 440 000 triangles a frame, most of them far away).
  const CHUNK = 1600, chunked = (items, make) => {
    const by = new Map();
    for (const it of items) { const k = `${Math.floor(it[0] / CHUNK)},${Math.floor(it[1] / CHUNK)}`; if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
    for (const list of by.values()) { const im = make(list); im.computeBoundingSphere(); scene.add(im); }
  };
  const R = rng(7), spots = [];
  for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 62) spots.push([x, BOUNDS.y0 - 34], [x, BOUNDS.y1 + 34]);
  for (let y = BOUNDS.y0; y <= BOUNDS.y1; y += 62) spots.push([BOUNDS.x0 - 34, y], [BOUNDS.x1 + 34, y]);
  for (let i = spots.length - 1; i >= 0; i--) if (world.surfaceAt(spots[i][0], spots[i][1]) === 'water') spots.splice(i, 1);   // no hedge in the sea
  const bush = new THREE.SphereGeometry(1, 10, 7), hedgeMat = M.surf({ color: '#ffffff' }), col = new THREE.Color();
  chunked(spots.map(([x, y]) => [x + (R() - 0.5) * 14, y + (R() - 0.5) * 14, 40 + R() * 14, 34 + R() * 16, ['#3F9A55', '#4FA653', '#5CB563'][(R() * 3) | 0]]), (list) => {
    const hedge = new THREE.InstancedMesh(bush, hedgeMat, list.length);
    list.forEach(([x, y, r, h, c], i) => { _mx.compose(_v.set(x, 18, y), _q.identity(), _s.set(r, h, r)); hedge.setMatrixAt(i, _mx); hedge.setColorAt(i, col.set(c)); });
    hedge.castShadow = true; hedge.receiveShadow = true; hedge.userData.kind = 'hedge'; return hedge;
  });
  ['#FF7FA0', '#FFD23F', '#ffffff', '#B48BE0'].forEach((c, k) => {
    const geo = M.flowerGeometry(c);
    chunked(world.flowers.filter((f) => f.c === k).map((f) => [f.x, f.y, f.s]), (list) => {
      const im = new THREE.InstancedMesh(geo, vc, list.length);
      list.forEach(([x, y, s], i) => { _mx.compose(_v.set(x, 0, y), _q.identity(), _s.setScalar(s)); im.setMatrixAt(i, _mx); });
      im.userData.kind = 'flowers'; return im;
    });
  });

  for (const o of world.props) { const m = M.makeProp(o.kind, world.surfaceAt(o.x, o.y)); m.root.userData.kind = o.kind; scene.add(m.root); props.push({ o, ...m }); }
  for (const o of world.people) { const m = M.makePerson(o.look); scene.add(m.root); people.push({ o, m }); }
  for (const f of world.flocks) for (const b of f.birds) { const m = f.kind === 'duck' ? M.makeDuck(b.color) : M.makeBird(b.color); m.root.userData.kind = f.kind || 'bird'; scene.add(m.root); birds.push({ f, b, m }); }
  for (const a of world.animals) { const m = M.makeDuck(2, true); scene.add(m.root); animals.push({ a, m }); }   // (a duck is the only one yet)
  car = M.makeCar(); scene.add(car.root);
  dog = M.makeDog(); scene.add(dog.root);
  water = makeWater(world, renderer); if (water) scene.add(...water.meshes);
  resize();
}

// ---- the town is built a few tiles at a time around the camera, and dropped behind it ----
// Each tile's ground, trees, lamps, benches, tables and stalls, buildings and fixtures are built when it comes near and dropped when
// it is far (the tile's `things`, see buildTown). People, birds, props and the car move about, so they are always there.
let vc;
const built = new Map(), tileGeo = new THREE.PlaneGeometry(TILE, TILE), houses = [];
function buildTile(t) {
  const objs = [], mats = [], add = (m) => { scene.add(m); objs.push(m); return m; };
  const tex = new THREE.CanvasTexture(paintTile(t));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const gm = M.surf({ map: tex }); mats.push(gm);
  const ground = add(new THREE.Mesh(tileGeo, gm));
  ground.rotation.x = -Math.PI / 2; ground.position.set((t.col + 0.5) * TILE, 0, (t.row + 0.5) * TILE); ground.receiveShadow = true;
  // trees: the leaves fade when they would hide whoever the camera follows
  for (const tr of t.things.trees) {
    const g = add(new THREE.Group()); g.userData.kind = 'tree'; g.position.set(tr.x, 0, tr.y); g.scale.setScalar(tr.s); g.rotation.y = tr.seed;
    const trunk = new THREE.Mesh(M.trunkGeometry, M.mat('#B98248')); trunk.castShadow = true;
    const leafMat = M.surf({ color: '#ffffff', vertexColors: true, transparent: true }); mats.push(leafMat);
    const leaves = new THREE.Mesh(M.canopyGeometry(tr.hue), leafMat); leaves.castShadow = true;
    g.add(trunk, leaves); trees.push({ t: tr, g, leaves, leafMat, faded: false, tile: t });
  }
  for (const o of t.things.lamps) { const m = add(new THREE.Mesh(M.lampGeometry, vc)); m.castShadow = true; m.position.set(o.x, 0, o.y); lamps.push({ o, m, tile: t }); }
  for (const o of t.things.plats) {
    const m = add(new THREE.Mesh(M.platformGeometry(o), vc)); m.castShadow = true; m.receiveShadow = true;
    m.position.set((o.ax + o.bx) / 2, 0, (o.ay + o.by) / 2); m.rotation.y = -(o.dir || 0) * Math.PI / 2; plats.push({ o, m, tile: t });
  }
  // houses: each its own see-through-able material, so it can fade when it stands in front of her
  for (const h of t.things.houses) {
    const m = add(M.makeHouse(h)), mat = M.surf({ color: '#ffffff', vertexColors: true, transparent: true }); mats.push(mat);
    m.material = mat; m.castShadow = true; houses.push({ h, m, mat, tile: t });
  }
  for (const o of t.things.fixtures) { const m = add(new THREE.Mesh(M.fixtureGeometry(o.kind), vc)); m.castShadow = true; m.receiveShadow = true; m.position.set(o.x, 0, o.y); m.rotation.y = -o.dir * Math.PI / 2; }
  built.set(t, { objs, mats, tex });
}
function dropTile(t) {
  const b = built.get(t);
  for (const m of b.objs) scene.remove(m);
  for (const m of b.mats) m.dispose();
  b.tex.dispose(); built.delete(t);
  for (const list of [trees, lamps, plats, houses]) for (let i = list.length - 1; i >= 0; i--) if (list[i].tile === t) list.splice(i, 1);
}
// Build the tiles near (x, y), nearest first, a couple a frame (all at once when `now`); drop those well out of sight.
// The camera looks north, so more is seen ahead of it than behind; further back (driving, ?zoom), more of both.
function streamTiles(x, y, now) {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE), side = Math.ceil(3 * zoom * fit), ahead = Math.ceil(4 * zoom * fit), behind = Math.ceil(2 * zoom * fit);
  const near = (t, m) => Math.abs(t.col - c) <= side + m && t.row >= r - ahead - m && t.row <= r + behind + m;
  for (const t of [...built.keys()]) if (!near(t, 2)) dropTile(t);
  const want = world.tiles.filter((t) => !built.has(t) && near(t, 0)).sort((a, b) => Math.hypot(a.col - c, a.row - r) - Math.hypot(b.col - c, b.row - r));
  for (const t of now ? want : want.slice(0, 2)) buildTile(t);
}

// How much is drawn, lowered on a slow device (main.js watches how long frames take): dpr is the most 3D pixels drawn per
// screen pixel (a tablet's screen has 2, four times the pixels of 1), shadow 'soft' (2048, soft edges), 'hard' (1024)
// or 'off'. The overlay keeps the screen's own sharpness: it is cheap.
let dprMax = 2, shadowAt = 'soft';
export function setQuality({ dpr, shadow }) {
  if (dpr && dpr !== dprMax) { dprMax = dpr; resize(); }
  if (shadow && shadow !== shadowAt) {
    shadowAt = shadow;
    renderer.shadowMap.enabled = sun.castShadow = shadow !== 'off';
    renderer.shadowMap.type = shadow === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const n = shadow === 'soft' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== n) { sun.shadow.mapSize.set(n, n); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });   // the shaders are built for the shadow kind
  }
}
export function resize() {
  view.w = window.innerWidth; view.h = window.innerHeight; view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(Math.min(view.dpr, dprMax)); renderer.setSize(view.w, view.h, false);
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

// a plain floor with a line every 100 and a darker one every 400, so strides and sliding feet can be measured by eye
function studioFloor() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'), u = 512 / 400;
  c.fillStyle = '#DCE8D2'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i ? 'rgba(70,100,80,.22)' : 'rgba(50,80,60,.5)';
    const w = i ? 2 : 4; c.fillRect(i * 100 * u - w / 2, 0, w, 512); c.fillRect(0, i * 100 * u - w / 2, 512, w);
    if (!i) { c.fillRect(512 - w / 2, 0, w, 512); c.fillRect(0, 512 - w / 2, 512, w); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(40, 40);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function placeCamera() {
  if (world.studio) {
    const D = studioCam.dist * fit, e = studioCam.elev;
    camera.position.set(camAim.x, 45 + D * Math.sin(e), camAim.z + D * Math.cos(e));
    camera.lookAt(camAim.x, 45, camAim.z);
    camera.updateMatrixWorld();
    sun.position.set(camAim.x + STYLE.sunAt[0], STYLE.sunAt[1], camAim.z + STYLE.sunAt[2]);
    sun.target.position.copy(camAim);
    return;
  }
  const d = fit * zoom;
  camera.position.set(camAim.x, CAM_UP * d, camAim.z + CAM_BACK * d);
  scene.fog.near = FOG_NEAR * d; scene.fog.far = FOG_FAR * d;
  camera.lookAt(camAim.x, 30, camAim.z - 70 * d);
  camera.updateMatrixWorld();
  sun.position.set(camAim.x + STYLE.sunAt[0], STYLE.sunAt[1], camAim.z + STYLE.sunAt[2]);
  sun.target.position.copy(camAim);
}
export function snapCamera(f) { camAim.set(f.x, 0, f.y); zoom = f.zoom || 1; placeCamera(); }

// what the last frame drew (the ?fps overlay and tests): draw calls, triangles, and the pixels drawn per screen pixel
// the heaviest things in the scene by triangles (for finding what to make lighter); parts: Lili's meshes instead
export function heaviest(n = 12, parts = false) {
  if (parts) {
    const out = []; dog.root.traverse((q) => { if (q.isMesh) out.push({ t: Math.round((q.geometry.index ? q.geometry.index.count : q.geometry.attributes.position.count) / 3), shadow: q.castShadow, y: Math.round(q.getWorldPosition(_v).y - dog.root.position.y) }); });
    return out.sort((a, b) => b.t - a.t).slice(0, n);
  }
  const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const rows = scene.children.map((o) => { let t = 0, m = 0; o.traverse((q) => { if (q.isMesh && q.visible) { t += tri(q.geometry); m++; } }); return { t: Math.round(t), m, at: [Math.round(o.position.x), Math.round(o.position.z)], kind: o.userData.kind || o.type }; });
  return rows.sort((a, b) => b.t - a.t).slice(0, n);
}
// triangles in the scene by kind of thing (labelled where made), the visible ones; within: only those within r of (x, y)
export function byKind(x, y, r = 1e9) {
  const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3, out = {};
  for (const o of scene.children) {
    if (Math.hypot(o.position.x - x, o.position.z - y) > r) continue;
    let t = 0; o.traverse((q) => { if (q.isMesh && q.visible) t += tri(q.geometry) * (q.isInstancedMesh ? q.count : 1); });
    const k = o.userData.kind || (o.isMesh ? 'mesh' : o.type); out[k] = (out[k] || 0) + Math.round(t);
  }
  return out;
}
export const stats = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, dpr: renderer.getPixelRatio(), objects: scene.children.length });
export function render(G, dt) {
  const t = G.t, f = G.focus;
  // ---- camera: a little ahead of where he is going, further back the faster he goes ----
  if (world.studio) {                                  // locked on, so he runs on the spot and the floor slides by
    camAim.set(f.x, 0, f.y); placeCamera();
    dog.update(G.dog, t);
    for (const e of people) e.m.update(e.o, t);
    renderer.render(scene, camera);
    return;
  }
  const k = 1 - Math.exp(-dt * 4);
  camAim.x = lerp(camAim.x, f.x + f.vx * 0.3, k); camAim.z = lerp(camAim.z, f.y + f.vy * 0.3, k);
  zoom = lerp(zoom, f.zoom || 1, 1 - Math.exp(-dt * 2));
  placeCamera();

  dog.update(G.dog, t); updateSwim(G.dog, t); updateCrowns(dt); if (water) water.update(t, dt, G.dog.x, G.dog.y);
  car.update(G.car, t, dt);
  streamTiles(camAim.x, camAim.z);

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
  // ---- and so do houses standing between the camera and her ----
  for (const e of houses) {
    const h = e.h, dy = h.y - f.y, front = dy > -60 && dy < 700 * fit * zoom && Math.abs(h.x - f.x) < Math.max(h.w, h.d) / 2 + 170;
    e.mat.opacity = lerp(e.mat.opacity, front ? 0.25 : 1, 1 - Math.exp(-dt * 9));
    e.mat.depthWrite = e.mat.opacity > 0.9;
  }
  for (const e of lamps) {
    const o = e.o;
    if (!o.fallen) { e.m.rotation.set(0, 0, Math.sin(t * 30) * (o.wob || 0) * 0.06); continue; }
    // knocked down by the car: it tips over its base away from the car, faster and faster, and bounces once on the ground
    o.fallT += dt;
    const down = 0.55, a = o.fallT < down ? (Math.PI / 2) * (o.fallT / down) ** 2 : Math.PI / 2 - 0.12 * Math.abs(Math.sin((o.fallT - down) * 14)) * Math.exp(-(o.fallT - down) * 7);
    e.m.rotation.set(0, -o.fallDir, -a);
  }
  for (const e of plats) { e.m.rotation.z = Math.sin(t * 34) * e.o.wob * 0.03; e.m.position.y = Math.abs(Math.sin(t * 34)) * e.o.wob * 2; }

  for (const e of props) {
    const o = e.o;
    e.root.visible = !o.gone; if (o.gone) continue;
    e.root.position.set(o.x, o.z, o.y); e.root.rotation.y = -o.dir;
    if (o.kind === 'bone' && !o.carried) { e.root.position.y = o.z + 12 + Math.sin(t * 3 + o.x) * 5; e.root.rotation.y = t * 1.6 + o.x; }   // a bone to find: it turns and bobs, to be seen
    e.tip.rotation.z = -o.tip + Math.sin(t * 28) * o.wob * 0.12;
    e.spin.rotation.z = -o.roll;
    const hang = o.carried && HANG[o.kind], pull = !hang && o.tugged && TUG[o.kind];
    if (hang) {                                      // in her mouth: hung from between her teeth, swinging (carryAt in main.js)
      dog.bite.getWorldPosition(e.root.position);
      e.root.rotation.set(o.swingS || 0, -o.dir, o.swingF || 0, 'YXZ');
      e.spin.position.y = hang.y; e.spin.rotation.z = hang.rz; e.spin.scale.set(1, 1, 1); e.spin.userData.posed = true;
    } else if (pull) {                               // in a tug of war: lying along the pull, stretched between them
      e.root.rotation.set(0, -o.dir, 0, 'XYZ'); e.spin.position.y = 0; e.spin.rotation.z = pull.rz;
      e.spin.scale.set(1, 1, 1); e.spin.scale[pull.axis] = o.stretch || 1; e.spin.userData.posed = true;
    } else if (e.spin.userData.posed) {
      e.root.rotation.set(0, -o.dir, 0, 'XYZ'); e.spin.position.y = e.spin.userData.mid; e.spin.scale.set(1, 1, 1); e.spin.userData.posed = false;
    }
  }
  // what is left behind: broken pots and plates, spilt rubbish
  for (let i = debris.length; i < G.debris.length; i++) {
    const d = G.debris[i], m = M.makeShards(d.kind);
    m.position.set(d.x, d.z || 0, d.y); m.rotation.y = d.dir; m.receiveShadow = true; scene.add(m); debris.push(m);
  }
  for (let i = 0; i < debris.length; i++) debris[i].visible = !G.debris[i].gone;   // tidied away (the game never takes one out of the list)
  for (const e of people) e.m.update(e.o, t);
  for (const e of birds) {
    const { f: fl, b, m } = e;
    if (fl.kind === 'duck') {                      // sitting on the water, all facing the way the flock paddles
      m.root.position.set(fl.x + b.ox, WATER_Y - 5, fl.y + b.oy); m.root.rotation.y = -(fl.dir + Math.sin(t * 0.5 + b.ph) * 0.35); m.update(b, t, !!fl.to);
      continue;
    }
    const air = fl.state !== 'ground';
    const spread = air ? 1 + Math.min(1, fl.t) * 0.8 : 1;
    m.root.position.set(fl.x + b.ox * spread, fl.h + (air ? Math.sin(t * 6 + b.ph) * 14 + b.ph * 6 : 0), fl.y + b.oy * spread);
    m.root.rotation.y = -(air ? fl.dir + Math.sin(t * 2 + b.ph) * 0.25 : b.face + Math.floor(t * 0.4 + b.ph) * 1.7);
    m.update(b, t, air);
  }
  for (const { a, m } of animals) { m.root.position.set(a.x, 0, a.y); m.root.rotation.y = -a.heading; m.update({ ph: a.seed }, t, false); }
  renderer.render(scene, camera);
}
