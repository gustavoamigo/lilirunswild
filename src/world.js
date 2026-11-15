// The town is built from tiles laid on a map (world/map.txt, world/tiles/*.js; docs/open-world-design.md): each tile is a
// 400 x 400 square of town holding its ground and everything on it, in its own coordinates (x east, y south, 0 to 400).
// buildTown turns and places each tile and gathers what is on them into the lists the rest of the game works from.
import { rng } from './util.js';

export const TILE = 400;
// The size of the town and how far she can go: set from the map by loadTown.
export let W = 0, H = 0;
export const BOUNDS = { x0: 0, y0: 0, x1: 0, y1: 0 };
// Roads: half the asphalt's width, and each pavement's. Park paths: half their width.
export const ROAD_HALF = 110, WALK = 70, PATH_HALF = 42;

// A shape of the ground (a tile's `ground` entry) as a line [x0, y0, x1, y1] or { arc: [cx, cy, r, a0, a1] }:
// how far a point is from it.
function shapeDist(g, x, y) {
  if (Array.isArray(g)) {
    const [ax, ay, bx, by] = g, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }
  const [cx, cy, r, a0, a1] = g.arc;
  let a = Math.atan2(y - cy, x - cx); while (a < a0) a += Math.PI * 2;
  return a <= a1 ? Math.abs(Math.hypot(x - cx, y - cy) - r) : Infinity;
}
// A rounded rectangle [x0, y0, x1, y1, r] (it may reach beyond the tile): is the point inside it?
export function inRound([x0, y0, x1, y1, r], x, y) {
  return Math.hypot(Math.max(x0 + r - x, x - (x1 - r), 0), Math.max(y0 + r - y, y - (y1 - r), 0)) <= r;
}
// What is underfoot at a point of a tile, in its own coordinates: 'road' | 'walk' | 'water' | 'path' | 'sand' | 'grass'
export function tileSurface(def, x, y) {
  let s = 'grass';
  for (const g of def.ground || []) if (g.water && inRound(g.water, x, y)) return 'water';
  for (const g of def.ground || []) {
    if (g.road) { const d = shapeDist(g.road, x, y); if (d < ROAD_HALF) return 'road'; if (d < ROAD_HALF + WALK) s = 'walk'; }
    if (s === 'grass' && g.path && shapeDist(g.path, x, y) < PATH_HALF) s = 'path';
    if (s === 'grass' && g.plaza && Math.hypot(x - g.plaza[0], y - g.plaza[1]) < g.plaza[2]) s = 'path';
    if (s === 'grass' && g.sand && Math.hypot(x - g.sand[0], y - g.sand[1]) < g.sand[2]) s = 'sand';
    if (s === 'grass' && g.beach && inRound(g.beach, x, y)) s = 'sand';
    if (s === 'grass' && g.pave && x >= g.pave[0] && x <= g.pave[2] && y >= g.pave[1] && y <= g.pave[3]) s = 'walk';
  }
  return s;
}
// A tile turned `rot` quarter turns clockwise: where its point (x, y) ends up, still in tile coordinates, and back.
export function turn(rot, x, y) { for (let k = 0; k < (rot & 3); k++) [x, y] = [TILE - y, x]; return [x, y]; }
export function unturn(rot, x, y) { for (let k = 0; k < (rot & 3); k++) [x, y] = [y, TILE - x]; return [x, y]; }

// Read the map, every tile it names, and who is in town (world/people.js).
export async function loadTown() {
  const text = await (await fetch(new URL('../world/map.txt', import.meta.url))).text();
  const legend = {}, rows = [];
  let bounds = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+)\s*=\s*(\S+)$/);
    if (m) legend[m[1]] = m[2];
    else if (line.startsWith('bounds')) bounds = line.split(/\s+/).slice(1).map(Number);
    else rows.push(line.split(/\s+/));
  }
  const defs = {};
  for (const name of new Set(Object.values(legend))) defs[name] = (await import(new URL(`../world/tiles/${name}.js`, import.meta.url))).default;
  const tiles = [];
  rows.forEach((row, r) => row.forEach((cell, c) => {
    const m = cell.match(/^(.+?)(>>|>|<)?$/), name = legend[m[1]];
    if (!name) throw new Error(`world/map.txt: no tile for "${m[1]}"`);
    tiles.push({ col: c, row: r, name, def: defs[name], rot: { '>': 1, '>>': 2, '<': 3 }[m[2]] || 0 });
  }));
  W = Math.max(...rows.map((r) => r.length)) * TILE; H = rows.length * TILE;
  [BOUNDS.x0, BOUNDS.y0, BOUNDS.x1, BOUNDS.y1] = bounds || [0, 0, W, H];
  const pop = (await import(new URL('../world/people.js', import.meta.url))).default;
  return buildTown(tiles, pop);
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
  apple: { r: 8, h: 14, tough: 0, fly: 1.4, pop: 240, drag: 1.0, rolls: true },
};

// how big each kind of fixture is (its radius as an obstacle), and the shops' colours: walls, roof, awning stripes
const FIXTURE_R = { kennel: 34, fountain: 78, 'cafe-table': 30 };
const SHOP = {
  butcher: { color: '#F4F1EA', roof: '#8A5A44', awning: ['#D9483B', '#ffffff'] },
  bakery: { color: '#F7E1B5', roof: '#B5483A', awning: ['#9A6A3A', '#F6EBC8'] },
  cafe: { color: '#CFE8E0', roof: '#5E7C99', awning: ['#3E9A6E', '#ffffff'] },
};
export function buildTown(tiles, pop) {
  const obstacles = [], platforms = [], props = [], trees = [], lamps = [], houses = [], flowers = [], flocks = [], people = [], spots = [];
  const prop = (kind, x, y, z = 0) => { const o = { kind, x, y, z, home: { x, y, z }, vx: 0, vy: 0, vz: 0, tip: 0, roll: 0, dir: 0, rest: true, gone: false, wob: 0, messed: false }; props.push(o); return o; };
  const HOUSE = ['#F7D9A8', '#F4B6A6', '#BFE0F2', '#F6E7A1', '#D8C4EE', '#C9E8B8'], ROOF = ['#C8553D', '#8A5A44', '#5E7C99', '#B5483A'];
  let car = null, table = null;

  for (const t of tiles) {
    const d = t.def, x0 = t.col * TILE, y0 = t.row * TILE, R = rng(t.col * 7919 + t.row * 104729 + 17);
    t.seed = t.col * 7919 + t.row * 104729;
    // what stands on this tile and does not move: built and dropped with it as she comes and goes (scene.js)
    const own = t.things = { trees: [], lamps: [], houses: [], plats: [], fixtures: [] };
    // a point of the tile, in town coordinates
    const at = (x, y) => { const [u, v] = turn(t.rot, x, y); return [x0 + u, y0 + v]; };
    for (const [x, y] of d.lamps || []) { const [X, Y] = at(x, y), o = { kind: 'lamp', x: X, y: Y, r: 9, wob: 0 }; lamps.push({ x: X, y: Y }); own.lamps.push(o); obstacles.push(o); }
    for (const [kind, x, y, z] of d.props || []) { const [X, Y] = at(x, y); prop(kind, X, Y, z || 0); }
    for (const [x, y] of d.trees || []) {
      const [X, Y] = at(x, y), tr = { x: X, y: Y, s: 0.9 + R() * 0.35, hue: (R() * 4) | 0, seed: R() * 6, wob: 0 };
      trees.push(tr); own.trees.push(tr); obstacles.push({ kind: 'tree', x: X, y: Y, r: 22 * tr.s, tree: tr });
    }
    for (const [x, y] of d.benches || []) {
      const [ax, ay] = at(x - 52, y), [bx, by] = at(x + 52, y);
      const o = { kind: 'bench', ax, ay, bx, by, r: 24, h: 42, wob: 0, dir: t.rot }; platforms.push(o); own.plats.push(o);
    }
    if (d.table) {
      const [X, Y] = at(...d.table);
      table = { kind: 'table', ax: X, ay: Y, bx: X, by: Y, r: 76, h: 60, wob: 0 }; platforms.push(table); own.plats.push(table);
      for (let i = 0; i < 4; i++) { const a = 0.6 + i * 1.57; prop('plate', X + Math.cos(a) * 42, Y + Math.sin(a) * 42, table.h); }
    }
    // buildings face south on their tile (front door that side) and turn with it; solid, as a row of circles along them
    const building = (b, x, y) => {
      const [X, Y] = at(x, y);
      Object.assign(b, { x: X, y: Y, dir: t.rot }); houses.push(b); own.houses.push(b);
      const [ux, uy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][t.rot], n = Math.ceil(b.w / b.d) + 1;
      for (let i = 0; i < n; i++) { const s = (i / (n - 1) - 0.5) * (b.w - b.d); obstacles.push({ kind: 'house', x: X + ux * s, y: Y + uy * s, r: b.d / 2 }); }
    };
    if (d.house) building({ kind: 'house', w: 250 + R() * 100, d: 170, h: 190 + R() * 80, color: HOUSE[(t.col * 3 + t.row) % HOUSE.length], roof: ROOF[(R() * ROOF.length) | 0] }, d.house[0], d.house[1] - R() * 30);
    if (d.home) building({ kind: 'home', w: 300, d: 180, h: 240, color: '#FFF4E2', roof: '#C8553D' }, ...d.home);
    if (d.school) building({ kind: 'school', w: 380, d: 220, h: 250, color: '#F6D365', roof: '#B5483A' }, ...d.school);
    if (d.shop) building({ kind: d.shop[0], w: 340, d: 150, h: 175, ...SHOP[d.shop[0]] }, d.shop[1], d.shop[2]);
    // fixtures: solid things that stay put, each a model of its kind (scene.js), facing south and turned with the tile
    for (const [kind, x, y] of d.fixtures || []) { const [X, Y] = at(x, y), o = { kind, x: X, y: Y, dir: t.rot, r: FIXTURE_R[kind] }; own.fixtures.push(o); obstacles.push(o); }
    // market stalls: counters she can jump onto, west to east
    for (const [x, y] of d.stalls || []) {
      const [ax, ay] = at(x - 60, y), [bx, by] = at(x + 60, y), o = { kind: 'stall', ax, ay, bx, by, r: 30, h: 58, wob: 0, dir: t.rot };
      platforms.push(o); own.plats.push(o);
    }
    for (const [x, y] of d.birds || []) {
      const [X, Y] = at(x, y), i = flocks.length;
      flocks.push({ x: X, y: Y, h: 0, state: 'ground', t: 0, seed: i * 2.3,
        birds: Array.from({ length: 5 }, (_, k) => ({ ox: Math.cos(k * 1.3 + i) * (28 + k * 9), oy: Math.sin(k * 1.3 + i) * (22 + k * 7), ph: R() * 6, face: R() * 6, color: k % 3 })) });
    }
    for (const [tag, x, y] of d.spots || []) { const [X, Y] = at(x, y); spots.push({ tag, x: X, y: Y }); }
    // flowers: on the tile's grass, clear of trees and furniture
    for (let i = 0, n = 0; i < 200 && n < (d.flowers || 0); i++) {
      const x = 15 + R() * 370, y = 15 + R() * 370;
      if (tileSurface(d, x, y) !== 'grass' || (d.trees || []).some(([a, b]) => Math.hypot(a - x, b - y) < 40) || (d.table && Math.hypot(d.table[0] - x, d.table[1] - y) < 90)) continue;
      const [X, Y] = at(x, y); flowers.push({ x: X, y: Y, c: (R() * 4) | 0, s: 0.8 + R() * 0.6 }); n++;
    }
  }
  // People and the car are placed on the map, not on tiles (world/people.js): [col, row, x, y] is a map square and a place in it
  const place = ([col, row, x, y]) => [col * TILE + x, row * TILE + y];
  const FACING = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 };
  { const [x, y] = place(pop.car.at); car = { x, y, heading: FACING[pop.car.facing] || 0 }; }
  for (const p of pop.people) {
    const o = { look: p.look, nature: p.nature, heading: FACING[p.facing] || 0, state: 'stand', t: 0, cool: 0, walk: null, seed: people.length * 2 };
    if (p.walk) { const [a, b] = p.walk.map(place); o.walk = { ax: a[0], ay: a[1], bx: b[0], by: b[1], dir: 1 }; [o.x, o.y] = a; o.state = 'walk'; }
    else [o.x, o.y] = place(p.at);
    people.push(o);
  }
  // The parked car is a thing he can jump onto (and so into). Its line is moved with the car.
  const carPlat = { kind: 'car', ax: 0, ay: 0, bx: 0, by: 0, r: 66, h: 64, wob: 0 };
  platforms.push(carPlat);

  // the tile at a point, and what is underfoot there
  const tileAt = (x, y) => tiles.find((t) => t.col === Math.floor(x / TILE) && t.row === Math.floor(y / TILE));
  const surfaceAt = (x, y) => { const t = tileAt(x, y); if (!t) return 'grass'; const [u, v] = unturn(t.rot, x - t.col * TILE, y - t.row * TILE); return tileSurface(t.def, u, v); };
  // Is this a free bit of open ground (nothing solid within `room`)?
  const freeSpot = (x, y, room = 60) => x > BOUNDS.x0 + room && x < BOUNDS.x1 - room && y > BOUNDS.y0 + room && y < BOUNDS.y1 - room
    && obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + room) && platforms.every((o) => platDist(o, x, y) > o.r + room);
  // Where a scared flock comes down: on the grass of a park tile, well away from whatever scared it.
  const park = tiles.filter((t) => t.def.park);
  const start = spots.find((s) => s.tag === 'start') || { x: W / 2, y: H / 2 };
  const birdSpot = (avoid) => {
    for (let far = 900; far > 200; far -= 100) for (let i = 0; i < 40; i++) {
      const t = park[(Math.random() * park.length) | 0], x = t.col * TILE + 60 + Math.random() * 280, y = t.row * TILE + 60 + Math.random() * 280;
      if (surfaceAt(x, y) === 'grass' && freeSpot(x, y, 90) && avoid.every((a) => Math.hypot(a.x - x, a.y - y) > far)) return { x, y };
    }
    return { x: start.x, y: start.y };
  };

  return { start: { x: start.x, y: start.y }, tiles, spots, obstacles, platforms, props, trees, lamps, houses, flowers, flocks, people, car, carPlat, table, freeSpot, birdSpot, surfaceAt };
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
