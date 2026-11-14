// The ground of one tile, painted into a picture laid flat under it: grass, then its sandy paths and plaza, then its
// roads with their pavements (the shapes in the tile's `ground`, see world/tiles/). What runs across tile edges is
// placed so the edges do not show: the grass patches by their place in town, the road's dashes a whole number of
// times along each tile.
import * as Art from './art.js';
import { TILE, ROAD_HALF, WALK, PATH_HALF, tileSurface } from './world.js';

const GRASS = '#9BD770';
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// the grass patches near a tile: two in each 300-unit square of town, the same whichever tile paints them
function patches(x0, y0) {
  const out = [];
  for (let i = Math.floor((x0 - 300) / 300); i <= Math.floor((x0 + TILE + 300) / 300); i++)
    for (let j = Math.floor((y0 - 300) / 300); j <= Math.floor((y0 + TILE + 300) / 300); j++) {
      const r = seeded(((i * 73856093) ^ (j * 19349663)) & 0x7fffffff || 1);
      for (let k = 0; k < 2; k++) out.push({ x: (i + r()) * 300, y: (j + r()) * 300, rx: 90 + r() * 170, ry: 50 + r() * 90, light: r() < 0.5 });
    }
  return out;
}
// trace a ground shape: a line [x0, y0, x1, y1] or { arc: [cx, cy, r, a0, a1] }
function trace(c, g) {
  c.beginPath();
  if (Array.isArray(g)) { c.moveTo(g[0], g[1]); c.lineTo(g[2], g[3]); } else c.arc(g.arc[0], g.arc[1], g.arc[2], g.arc[3], g.arc[4]);
}
const length = (g) => (Array.isArray(g) ? Math.hypot(g[2] - g[0], g[3] - g[1]) : g.arc[2] * (g.arc[4] - g.arc[3]));

export function paintTile(t, res = 1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(TILE * res);
  const c = cv.getContext('2d'), d = t.def, x0 = t.col * TILE, y0 = t.row * TILE, r = seeded(t.seed % 2147483646 + 1);
  c.scale(res, res);

  // ---- grass, in town coordinates ----
  c.fillStyle = GRASS; c.fillRect(0, 0, TILE, TILE);
  for (const p of patches(x0, y0)) {
    c.fillStyle = p.light ? 'rgba(190,240,140,.4)' : 'rgba(110,190,90,.26)';
    Art.ell(c, p.x - x0, p.y - y0, p.rx, p.ry); c.fill();
  }
  c.lineCap = 'round';
  for (let i = 0; i < 480; i++) {                    // tiny grass blades
    const x = r() * TILE, y = r() * TILE, l = 5 + r() * 9;
    c.strokeStyle = r() < 0.5 ? `rgba(70,150,60,${0.1 + r() * 0.16})` : `rgba(215,250,160,${0.14 + r() * 0.2})`;
    c.lineWidth = 1.6 + r() * 1.4;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y - l); c.stroke();
  }

  // ---- the tile's own shapes, in its own coordinates, turned with it ----
  c.translate(TILE / 2, TILE / 2); c.rotate(t.rot * Math.PI / 2); c.translate(-TILE / 2, -TILE / 2);
  const ground = d.ground || [], roads = ground.filter((g) => g.road).map((g) => g.road);
  const paths = ground.filter((g) => g.path).map((g) => g.path), plazas = ground.filter((g) => g.plaza).map((g) => g.plaza);

  // sandy paths and plaza
  c.lineCap = 'butt';
  for (const [w, color] of [[PATH_HALF * 2 + 16, '#D9C28C'], [PATH_HALF * 2, '#EBD9A8']]) {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = w;
    for (const g of paths) { trace(c, g); c.stroke(); }
    for (const [x, y, rad] of plazas) { Art.circ(c, x, y, rad + (w - PATH_HALF * 2) / 2); c.fill(); }
  }
  if (paths.length || plazas.length) {
    for (let i = 0; i < 400; i++) {                  // pebbles and speckles on the sand
      const x = r() * TILE, y = r() * TILE;
      if (tileSurface(d, x, y) !== 'path') continue;
      const big = r() < 0.12;
      c.fillStyle = big ? (r() < 0.5 ? '#CDB98A' : '#F6EBC8') : `rgba(150,120,70,${0.12 + r() * 0.18})`;
      Art.ell(c, x, y, big ? 5 + r() * 4 : 1.5 + r() * 2, big ? 3.5 + r() * 2 : 1.5 + r() * 1.5); c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 6;
    for (const [x, y, rad] of plazas) { Art.circ(c, x, y, rad - 46); c.stroke(); }
  }

  // sandpits: a wooden rim round soft sand
  for (const sp of ground.filter((s) => s.sand).map((s) => s.sand)) {
    const [x, y, rad] = sp;
    c.fillStyle = '#9A6A3A'; Art.circ(c, x, y, rad + 10); c.fill();
    c.fillStyle = '#B98248'; Art.circ(c, x, y, rad + 6); c.fill();
    c.fillStyle = '#F0DDA8'; Art.circ(c, x, y, rad); c.fill();
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (rad - 4);
      c.fillStyle = r() < 0.5 ? 'rgba(170,140,80,.25)' : 'rgba(255,248,220,.5)';
      Art.circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5 + r() * 2.5); c.fill();
    }
  }

  // roads: pavement and its stones, kerb, asphalt and its speckles, the dashed middle line
  if (roads.length) {
    const full = (ROAD_HALF + WALK) * 2;
    const band = (w, color) => { c.strokeStyle = color; c.lineWidth = w; for (const g of roads) { trace(c, g); c.stroke(); } };
    band(full + 8, '#B9B4A8'); band(full, '#DDD8CC');
    c.fillStyle = 'rgba(120,110,95,.16)';
    for (let x = 0; x < TILE; x += 50) for (let y = 0; y < TILE; y += 50) if (tileSurface(d, x + 3, y + 3) === 'walk') { c.fillRect(x, y, 48, 2.5); c.fillRect(x, y, 2.5, 48); }
    band(ROAD_HALF * 2 + 10, '#9A958B'); band(ROAD_HALF * 2, '#6F7480');
    for (let i = 0; i < 900; i++) {
      const x = r() * TILE, y = r() * TILE;
      if (tileSurface(d, x, y) !== 'road') continue;
      c.fillStyle = r() < 0.5 ? `rgba(40,44,54,${0.1 + r() * 0.14})` : `rgba(210,214,224,${0.08 + r() * 0.1})`;
      Art.circ(c, x, y, 1.2 + r() * 2.4); c.fill();
    }
    c.strokeStyle = '#F4E9B0'; c.lineWidth = 7;
    for (const g of roads) {
      // a whole number of dash-and-gap lengths (about 100), each a gap's half, a dash, a gap's half: so the line runs on
      // into the next tile whichever way either is turned
      const L = length(g), k = L / Math.max(1, Math.round(L / 100));
      c.setLineDash([k * 0.56, k * 0.44]); c.lineDashOffset = -k * 0.22; trace(c, g); c.stroke();
    }
    c.setLineDash([]);
  }
  for (const g of ground) {
    if (g.zebra) {                                   // zebra crossing over a west-east road
      c.fillStyle = '#F2F0E8';
      for (let k = -4; k <= 4; k++) c.fillRect(g.zebra[0] + k * 22 - 7, g.zebra[1] - ROAD_HALF + 8, 14, ROAD_HALF * 2 - 16);
    }
    if (g.bay) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 6; c.strokeRect(...g.bay); }
  }
  return cv;
}
