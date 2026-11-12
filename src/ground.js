// The ground is painted once into a big picture and laid flat under the 3D world:
// grass, the ring road with its pavements, the park's sandy paths and plaza.
import * as Art from './art.js';
import { W, H, ROAD, PARK, PLAZA } from './world.js';

export function paintGround(world, res) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * res); cv.height = Math.round(H * res);
  const c = cv.getContext('2d');
  c.scale(res, res);
  let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  c.fillStyle = '#9BD770'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {                     // light and dark patches
    c.fillStyle = r() < 0.5 ? 'rgba(190,240,140,.4)' : 'rgba(110,190,90,.26)';
    Art.ell(c, r() * W, r() * H, 90 + r() * 170, 50 + r() * 90); c.fill();
  }
  c.lineCap = 'round';
  for (let i = 0; i < 30000; i++) {                  // tiny grass blades
    const x = r() * W, y = r() * H, l = 5 + r() * 9;
    c.strokeStyle = r() < 0.5 ? `rgba(70,150,60,${0.1 + r() * 0.16})` : `rgba(215,250,160,${0.14 + r() * 0.2})`;
    c.lineWidth = 1.6 + r() * 1.4;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y - l); c.stroke();
  }
  // fade the edges into the plain grass outside the map
  for (const [x, y, w, h, x0, y0, x1, y1] of [[0, 0, W, 80, 0, 0, 0, 80], [0, H - 80, W, 80, 0, H, 0, H - 80], [0, 0, 80, H, 0, 0, 80, 0], [W - 80, 0, 80, H, W, 0, W - 80, 0]]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#9BD770'); g.addColorStop(1, 'rgba(155,215,112,0)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
  }

  // ---- the park's sandy paths and plaza ----
  c.lineJoin = 'round';
  const paths = (w, color) => {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = w;
    c.beginPath(); c.moveTo(PARK.x0 - 30, PLAZA.y); c.lineTo(PARK.x1 + 30, PLAZA.y); c.moveTo(PLAZA.x, PARK.y0 - 30); c.lineTo(PLAZA.x, PARK.y1 + 30); c.stroke();
    Art.circ(c, PLAZA.x, PLAZA.y, PLAZA.r + (w - 84) / 2); c.fill();
  };
  paths(100, '#D9C28C'); paths(84, '#EBD9A8');
  for (let i = 0; i < 5000; i++) {                   // pebbles and speckles on the sand
    const x = PARK.x0 + r() * (PARK.x1 - PARK.x0), y = PARK.y0 + r() * (PARK.y1 - PARK.y0);
    if (!(Math.abs(y - PLAZA.y) < 38 || Math.abs(x - PLAZA.x) < 38 || Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r - 6)) continue;
    const big = r() < 0.12;
    c.fillStyle = big ? (r() < 0.5 ? '#CDB98A' : '#F6EBC8') : `rgba(150,120,70,${0.12 + r() * 0.18})`;
    Art.ell(c, x, y, big ? 5 + r() * 4 : 1.5 + r() * 2, big ? 3.5 + r() * 2 : 1.5 + r() * 1.5); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 6; Art.circ(c, PLAZA.x, PLAZA.y, PLAZA.r - 46); c.stroke();

  // ---- the ring road: pavement, kerb, asphalt, middle line ----
  const ring = () => { c.beginPath(); c.roundRect(ROAD.cx - ROAD.hx, ROAD.cy - ROAD.hy, ROAD.hx * 2, ROAD.hy * 2, ROAD.corner); };
  const full = (ROAD.half + ROAD.walk) * 2;
  c.strokeStyle = '#B9B4A8'; c.lineWidth = full + 8; ring(); c.stroke();
  c.strokeStyle = '#DDD8CC'; c.lineWidth = full; ring(); c.stroke();
  c.save(); ring(); c.lineWidth = full; c.strokeStyle = 'rgba(0,0,0,0)';       // paving stones
  c.fillStyle = 'rgba(120,110,95,.16)';
  for (let x = 240; x < W - 240; x += 46) for (let y = 360; y < H - 160; y += 46) {
    if (c.isPointInStroke((x + 2) * res, (y + 2) * res)) { c.fillRect(x, y, 44, 2.5); c.fillRect(x, y, 2.5, 44); }
  }
  c.restore();
  c.strokeStyle = '#9A958B'; c.lineWidth = ROAD.half * 2 + 10; ring(); c.stroke();
  c.strokeStyle = '#6F7480'; c.lineWidth = ROAD.half * 2; ring(); c.stroke();
  c.save(); ring(); c.lineWidth = ROAD.half * 2 - 8;                             // asphalt speckles
  for (let i = 0; i < 40000; i++) {
    const x = r() * W, y = r() * H;
    if (!c.isPointInStroke(x * res, y * res)) continue;
    c.fillStyle = r() < 0.5 ? `rgba(40,44,54,${0.1 + r() * 0.14})` : `rgba(210,214,224,${0.08 + r() * 0.1})`;
    Art.circ(c, x, y, 1.2 + r() * 2.4); c.fill();
  }
  c.restore();
  c.strokeStyle = '#F4E9B0'; c.lineWidth = 7; c.lineCap = 'butt'; c.setLineDash([58, 46]); ring(); c.stroke(); c.setLineDash([]);
  // zebra crossings where the park paths meet the road
  c.fillStyle = '#F2F0E8';
  const y0 = ROAD.cy - ROAD.hy, y1 = ROAD.cy + ROAD.hy, x0 = ROAD.cx - ROAD.hx, x1 = ROAD.cx + ROAD.hx;
  for (let k = -4; k <= 4; k++) {
    for (const y of [y0, y1]) c.fillRect(PLAZA.x + k * 22 - 7, y - ROAD.half + 8, 14, ROAD.half * 2 - 16);
    for (const x of [x0, x1]) c.fillRect(x - ROAD.half + 8, PLAZA.y + k * 22 - 7, ROAD.half * 2 - 16, 14);
  }
  // a parking bay where the car waits
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 6;
  c.strokeRect(world.car.x - 210, world.car.y - 92, 420, 150);
  return cv;
}
