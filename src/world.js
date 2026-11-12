// The town: a fixed, seeded layout. A ring road round a park, with things to knock over,
// people to greet, birds to chase and one car to borrow.
import { rng } from './util.js';

export const W = 3600, H = 2800;
// How far he can go: just past the outer pavement.
export const BOUNDS = { x0: 270, y0: 390, x1: 3330, y1: 2610 };
// The road is a ring (a rounded rectangle). ROAD.half is half the width of the asphalt,
// ROAD.walk the width of the pavement on each side.
export const ROAD = { cx: 1800, cy: 1500, hx: 1300, hy: 880, corner: 240, half: 110, walk: 70 };
export const PARK = { x0: 690, y0: 810, x1: 2910, y1: 2190 };
export const PLAZA = { x: 1800, y: 1500, r: 150 };

// Signed distance to the middle line of the road: negative inside the ring (park side).
export function roadDist(x, y) {
  const qx = Math.abs(x - ROAD.cx) - (ROAD.hx - ROAD.corner), qy = Math.abs(y - ROAD.cy) - (ROAD.hy - ROAD.corner);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - ROAD.corner;
}
// What is underfoot: 'road' | 'walk' | 'path' | 'grass'
export function surfaceAt(x, y) {
  const d = Math.abs(roadDist(x, y));
  if (d < ROAD.half) return 'road';
  if (d < ROAD.half + ROAD.walk) return 'walk';
  if (roadDist(x, y) < 0 && (Math.abs(y - PLAZA.y) < 42 || Math.abs(x - PLAZA.x) < 42 || Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r)) return 'path';
  return 'grass';
}

// Things with a flat top that he can jump onto: a line with a radius (a point, if both ends are the same).
export function nearestOn(o, x, y) {
  const dx = o.bx - o.ax, dy = o.by - o.ay, l2 = dx * dx + dy * dy;
  const k = l2 ? Math.max(0, Math.min(1, ((x - o.ax) * dx + (y - o.ay) * dy) / l2)) : 0;
  return [o.ax + dx * k, o.ay + dy * k];
}
export function platDist(o, x, y) { const [cx, cy] = nearestOn(o, x, y); return Math.hypot(x - cx, y - cy); }
export const STEP = 14;      // how far below a top the feet may be and still count as "on it"

// What can be knocked about. `tough`: below this speed he only shoves it; `fly`/`pop`: how far and how
// high it goes; `mess`: counts on the mess counter the first time.
export const KINDS = {
  cone:  { r: 20, h: 46, tough: 120, fly: 1.1, pop: 260, drag: 2.2, tips: true, mess: true },
  bin:   { r: 30, h: 72, tough: 460, fly: 0.6, pop: 130, drag: 3.2, tips: true, spills: true, mess: true },
  box:   { r: 27, h: 44, tough: 60, fly: 1.3, pop: 320, drag: 2.0, tumbles: true, mess: true },
  pot:   { r: 23, h: 40, tough: 240, breaks: true, mess: true },
  plate: { r: 18, h: 10, tough: 0, fly: 1.2, pop: 240, drag: 1.2, fragile: true, mess: true },
  ball:  { r: 13, h: 26, tough: 0, fly: 1.5, pop: 300, drag: 0.7, rolls: true },
};

export function buildTown() {
  const R = rng(20261112);
  const obstacles = [], platforms = [], props = [], trees = [], lamps = [], houses = [], flowers = [];
  const prop = (kind, x, y, z = 0) => { const o = { kind, x, y, z, home: { x, y, z }, vx: 0, vy: 0, vz: 0, tip: 0, roll: 0, dir: 0, rest: true, gone: false, wob: 0, messed: false }; props.push(o); return o; };

  // ---- park furniture ----
  const bench = (x, y) => platforms.push({ kind: 'bench', ax: x - 52, ay: y, bx: x + 52, by: y, r: 24, h: 42, wob: 0 });
  bench(1500, 1385); bench(2100, 1385); bench(1280, 1615);
  const table = { kind: 'table', ax: 1150, ay: 1850, bx: 1150, by: 1850, r: 76, h: 60, wob: 0 };
  platforms.push(table);
  for (let i = 0; i < 4; i++) { const a = 0.6 + i * 1.57; prop('plate', table.ax + Math.cos(a) * 42, table.ay + Math.sin(a) * 42, table.h); }

  for (let i = 0; i < 7; i++) prop('pot', 1960 + i * 62, 1590);
  prop('ball', 1900, 1700); prop('ball', 1560, 1250);

  // ---- street things ----
  for (let i = 0; i < 6; i++) prop('cone', 1560 + i * 74, 2350 + (i % 2) * 34);
  for (const [x, y] of [[745, 865], [2855, 865], [745, 2135], [2855, 2135], [1700, 775], [2400, 2225]]) prop('bin', x, y);
  // a stack of parcels on the pavement, one on top
  prop('box', 1180, 470); prop('box', 1238, 474); prop('box', 1209, 472, 44); prop('box', 1300, 466);
  prop('box', 2700, 2530); prop('box', 2756, 2526);
  for (const [x, y] of [[1000, 775], [1800, 775], [2600, 775], [1000, 2225], [1800, 2225], [2600, 2225], [655, 1500], [2945, 1500]]) { lamps.push({ x, y }); obstacles.push({ kind: 'lamp', x, y, r: 9, wob: 0 }); }

  // ---- trees: seeded, kept off the paths, the plaza and the furniture ----
  const clear = (x, y, room) => surfaceAt(x, y) === 'grass' && Math.abs(y - PLAZA.y) > 110 && Math.abs(x - PLAZA.x) > 110 && Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.r + 90
    && platforms.every((o) => platDist(o, x, y) > o.r + room) && props.every((o) => Math.hypot(o.x - x, o.y - y) > room) && trees.every((t) => Math.hypot(t.x - x, t.y - y) > 250);
  for (let i = 0; i < 600 && trees.length < 15; i++) {
    const x = PARK.x0 + 90 + R() * (PARK.x1 - PARK.x0 - 180), y = PARK.y0 + 90 + R() * (PARK.y1 - PARK.y0 - 180);
    if (!clear(x, y, 150) || Math.hypot(x - 1800, y - 1560) < 260) continue;
    const t = { x, y, s: 0.9 + R() * 0.35, hue: (R() * 4) | 0, seed: R() * 6, wob: 0 };
    trees.push(t); obstacles.push({ kind: 'tree', x, y, r: 22 * t.s, tree: t });
  }
  for (let i = 0; i < 2000 && flowers.length < 150; i++) {
    const x = PARK.x0 + R() * (PARK.x1 - PARK.x0), y = PARK.y0 + R() * (PARK.y1 - PARK.y0);
    if (surfaceAt(x, y) === 'grass') flowers.push({ x, y, c: (R() * 4) | 0, s: 0.8 + R() * 0.6 });
  }

  // ---- houses: a row along the far (north) side, beyond where he can go, so they never hide him ----
  const HOUSE = ['#F7D9A8', '#F4B6A6', '#BFE0F2', '#F6E7A1', '#D8C4EE', '#C9E8B8'], ROOF = ['#C8553D', '#8A5A44', '#5E7C99', '#B5483A'];
  for (let i = 0, x = 330; x < W - 300; i++) {
    const w = 250 + R() * 110;
    houses.push({ x: x + w / 2, y: 215 - R() * 30, w, d: 170, h: 190 + R() * 80, color: HOUSE[i % HOUSE.length], roof: ROOF[(R() * ROOF.length) | 0] });
    x += w + 50 + R() * 50;
  }

  const car = { x: 1500, y: 668, heading: 0 };
  // The parked car is a thing he can jump onto (and so into). Its line is moved with the car.
  const carPlat = { kind: 'car', ax: 0, ay: 0, bx: 0, by: 0, r: 66, h: 64, wob: 0 };
  platforms.push(carPlat);

  const flocks = [[1120, 1160], [2460, 1180], [2250, 1960]].map(([x, y], i) => ({
    x, y, h: 0, state: 'ground', t: 0, seed: i * 2.3,
    birds: Array.from({ length: 5 }, (_, k) => ({ ox: Math.cos(k * 1.3 + i) * (28 + k * 9), oy: Math.sin(k * 1.3 + i) * (22 + k * 7), ph: R() * 6, face: R() * 6, color: k % 3 })),
  }));
  const people = [
    { look: 0, x: 1300, y: 1500, heading: 0, state: 'walk', t: 0, cool: 0, walk: { x0: 900, x1: 2700, y: 1500, dir: 1 }, seed: 0 },
    { look: 1, x: 2300, y: 775, heading: Math.PI / 2, state: 'stand', t: 0, cool: 0, walk: null, seed: 2 },
    { look: 2, x: 1420, y: 2228, heading: -Math.PI / 2, state: 'stand', t: 0, cool: 0, walk: null, seed: 4 },
  ];

  // Is this a free bit of open ground (nothing solid within `room`)?
  const freeSpot = (x, y, room = 60) => x > BOUNDS.x0 + room && x < BOUNDS.x1 - room && y > BOUNDS.y0 + room && y < BOUNDS.y1 - room
    && obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + room) && platforms.every((o) => platDist(o, x, y) > o.r + room);
  // Where a scared flock comes down: on the grass, well away from whatever scared it.
  const birdSpot = (avoid) => {
    for (let far = 900; far > 200; far -= 100) for (let i = 0; i < 40; i++) {
      const x = PARK.x0 + 120 + Math.random() * (PARK.x1 - PARK.x0 - 240), y = PARK.y0 + 120 + Math.random() * (PARK.y1 - PARK.y0 - 240);
      if (freeSpot(x, y, 90) && avoid.every((a) => Math.hypot(a.x - x, a.y - y) > far)) return { x, y };
    }
    return { x: PLAZA.x, y: PLAZA.y };
  };

  return { start: { x: 1800, y: 1600 }, obstacles, platforms, props, trees, lamps, houses, flowers, flocks, people, car, carPlat, table, freeSpot, birdSpot };
}

// Slide something round out of anything solid. Returns what it hit hardest into, as
// { nx, ny, o } (the way out, and the thing), or null if it touched nothing.
export function pushOut(world, p, rad) {
  let hit = null;
  for (const o of world.obstacles) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), min = o.r + rad;
    if (d >= min) continue;
    if (d < 0.001) { p.x += min; hit = { nx: 1, ny: 0, o }; continue; }
    p.x = o.x + (dx / d) * min; p.y = o.y + (dy / d) * min; hit = { nx: dx / d, ny: dy / d, o };
  }
  // benches, the table and the car are solid from the side, but not once he is up on top
  const z = p.z || 0;
  for (const o of world.platforms) {
    if (o.off || z >= o.h - STEP) continue;
    const [cx, cy] = nearestOn(o, p.x, p.y), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy), min = o.r + rad - 4;
    if (d >= min) continue;
    if (d < 0.001) { p.y += min; hit = { nx: 0, ny: 1, o }; continue; }
    p.x = cx + (dx / d) * min; p.y = cy + (dy / d) * min; hit = { nx: dx / d, ny: dy / d, o };
  }
  const B = BOUNDS;
  if (p.x < B.x0 + rad) { p.x = B.x0 + rad; hit = hit || { nx: 1, ny: 0, o: null }; }
  if (p.x > B.x1 - rad) { p.x = B.x1 - rad; hit = hit || { nx: -1, ny: 0, o: null }; }
  if (p.y < B.y0 + rad) { p.y = B.y0 + rad; hit = hit || { nx: 0, ny: 1, o: null }; }
  if (p.y > B.y1 - rad) { p.y = B.y1 - rad; hit = hit || { nx: 0, ny: -1, o: null }; }
  return hit;
}

// The highest flat top under a point that feet at height z can stand on (0 = the ground).
export function floorAt(world, x, y, z) {
  let h = 0, on = null;
  for (const o of world.platforms) if (!o.off && o.h > h && z >= o.h - STEP && platDist(o, x, y) < o.r) { h = o.h; on = o; }
  return [h, on];
}
