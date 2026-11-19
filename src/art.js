// 2D drawing for the overlay: HUD pictures and thought bubbles. (3D models live in models.js)
import { TAU } from './util.js';

export function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
export function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

export function starPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.5 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
export function heartPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  c.closePath();
}

// A muddy paw print: the mess counter.
export function drawPaw(c, x, y, s, color = '#8A5A3C') {
  c.fillStyle = color;
  ell(c, x, y + s * 0.25, s * 0.52, s * 0.42); c.fill();
  for (const [dx, dy] of [[-0.55, -0.2], [-0.2, -0.58], [0.2, -0.58], [0.55, -0.2]]) { ell(c, x + dx * s, y + dy * s, s * 0.17, s * 0.22, dx * 0.6); c.fill(); }
}

// A little bird, facing right.
export function drawBird(c, x, y, s) {
  c.fillStyle = '#8E9AAF'; ell(c, x, y, s * 0.62, s * 0.42, -0.15); c.fill();
  c.beginPath(); c.moveTo(x - s * 0.45, y - s * 0.05); c.lineTo(x - s * 1.05, y - s * 0.3); c.lineTo(x - s * 0.5, y + s * 0.22); c.closePath(); c.fill();
  circ(c, x + s * 0.5, y - s * 0.38, s * 0.3); c.fill();
  c.fillStyle = '#6F7B91'; ell(c, x - s * 0.1, y - s * 0.02, s * 0.36, s * 0.22, -0.4); c.fill();
  c.fillStyle = '#F2A33A'; c.beginPath(); c.moveTo(x + s * 0.74, y - s * 0.46); c.lineTo(x + s * 1.08, y - s * 0.34); c.lineTo(x + s * 0.74, y - s * 0.26); c.closePath(); c.fill();
  c.fillStyle = '#22252B'; circ(c, x + s * 0.56, y - s * 0.44, s * 0.07); c.fill();
}

// A steering wheel: "you can drive this".
export function drawWheel(c, x, y, s) {
  c.strokeStyle = '#3A3F4A'; c.lineWidth = s * 0.22; c.lineCap = 'round';
  circ(c, x, y, s * 0.72); c.stroke();
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s * 0.72, y + Math.sin(a) * s * 0.72); c.stroke(); }
  c.fillStyle = '#3A3F4A'; circ(c, x, y, s * 0.2); c.fill();
}

// White thought bubble with a tail pointing down.
export function drawBubble(c, x, y, r) {
  c.fillStyle = '#fff'; c.strokeStyle = 'rgba(60,70,90,.35)'; c.lineWidth = 2;
  circ(c, x, y, r); c.fill(); c.stroke();
  circ(c, x - r * 0.25, y + r * 1.25, r * 0.2); c.fill(); c.stroke();
  circ(c, x - r * 0.4, y + r * 1.62, r * 0.11); c.fill(); c.stroke();
}

export function drawNum(c, n, x, y, size, fill = '#fff', stroke = 'rgba(40,50,40,.55)') {
  c.font = `900 ${size}px "Baloo 2", "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = size * 0.22; c.strokeStyle = stroke; c.strokeText(n, x, y);
  c.fillStyle = fill; c.fillText(n, x, y);
}

// ---- jobs: a card with pictures on it, a tick for one done, stickers ----
export function drawCard(c, x, y, w, h, o = {}) {
  const r = Math.min(w, h) * 0.22;
  c.fillStyle = 'rgba(40,50,40,.2)'; c.beginPath(); c.roundRect(x - w / 2 + 2, y - h / 2 + 5, w, h, r); c.fill();
  c.fillStyle = o.fill || '#FFFDF6'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); c.fill();
  c.strokeStyle = o.edge || '#E8B04A'; c.lineWidth = Math.max(2.5, Math.min(w, h) * 0.05); c.stroke();
}
export function drawTick(c, x, y, r) {
  c.fillStyle = '#4FA653'; circ(c, x, y, r); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = r * 0.28; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.35); c.lineTo(x + r * 0.5, y - r * 0.35); c.stroke();
}
// a poo: a brown swirl of three
function poo(c, x, y, s) {
  c.fillStyle = '#7A4A2A'; ell(c, x, y, s, s * 0.42); c.fill();
  c.fillStyle = '#86532F'; ell(c, x, y - s * 0.4, s * 0.72, s * 0.34); c.fill();
  c.fillStyle = '#93603A'; ell(c, x + s * 0.05, y - s * 0.75, s * 0.42, s * 0.3); c.fill();
}
function teddy(c, x, y, s) {
  const B = '#B5793F', L = '#E8C08A';
  c.fillStyle = B; ell(c, x, y + s * 0.45, s * 0.55, s * 0.6); c.fill();                    // body
  circ(c, x - s * 0.5, y - s * 0.55, s * 0.22); c.fill(); circ(c, x + s * 0.5, y - s * 0.55, s * 0.22); c.fill();   // ears
  circ(c, x, y - s * 0.2, s * 0.5); c.fill();                                                // head
  c.fillStyle = L; ell(c, x, y + s * 0.5, s * 0.3, s * 0.35); c.fill(); ell(c, x, y - s * 0.05, s * 0.2, s * 0.15); c.fill();
  c.fillStyle = '#2A1C14'; circ(c, x - s * 0.18, y - s * 0.3, s * 0.06); c.fill(); circ(c, x + s * 0.18, y - s * 0.3, s * 0.06); c.fill();
  circ(c, x, y - s * 0.08, s * 0.07); c.fill();
}
export function drawBone(c, x, y, s, rot = -0.5) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = '#fff'; c.strokeStyle = '#B9A78A'; c.lineWidth = s * 0.1; c.lineJoin = 'round';
  c.beginPath();
  c.arc(-s * 0.72, -s * 0.2, s * 0.24, Math.PI * 0.5, Math.PI * 1.9); c.arc(s * 0.72, -s * 0.2, s * 0.24, Math.PI * 1.1, Math.PI * 2.5);
  c.arc(s * 0.72, s * 0.2, s * 0.24, Math.PI * 1.5, Math.PI * 2.9); c.arc(-s * 0.72, s * 0.2, s * 0.24, Math.PI * 0.1, Math.PI * 1.5);
  c.closePath(); c.stroke(); c.fill(); c.restore();
}
// Lili's face: white, liver ears and a liver patch over one eye
function lili(c, x, y, s) {
  const L = '#8A5230';
  c.fillStyle = L; ell(c, x - s * 0.62, y + s * 0.1, s * 0.27, s * 0.55, 0.25); c.fill(); ell(c, x + s * 0.62, y + s * 0.1, s * 0.27, s * 0.55, -0.25); c.fill();
  c.fillStyle = '#fff'; c.strokeStyle = 'rgba(90,70,50,.35)'; c.lineWidth = s * 0.05; ell(c, x, y, s * 0.56, s * 0.6); c.fill(); c.stroke();
  c.save(); ell(c, x, y, s * 0.56, s * 0.6); c.clip(); c.fillStyle = L; ell(c, x + s * 0.34, y - s * 0.32, s * 0.36, s * 0.42, -0.3); c.fill(); c.restore();
  c.fillStyle = '#fff'; ell(c, x, y + s * 0.3, s * 0.34, s * 0.26); c.fill();
  c.fillStyle = '#2A1C14'; circ(c, x - s * 0.22, y - s * 0.1, s * 0.08); c.fill(); circ(c, x + s * 0.22, y - s * 0.1, s * 0.08); c.fill();
  ell(c, x, y + s * 0.17, s * 0.13, s * 0.09); c.fill();
  c.fillStyle = '#F2788F'; c.beginPath(); c.roundRect(x - s * 0.1, y + s * 0.32, s * 0.2, s * 0.3, s * 0.1); c.fill();
}
function car(c, x, y, s) {
  c.fillStyle = '#E0453A'; c.beginPath(); c.roundRect(x - s * 0.9, y - s * 0.1, s * 1.8, s * 0.55, s * 0.18); c.fill();
  c.beginPath(); c.roundRect(x - s * 0.5, y - s * 0.55, s * 1.0, s * 0.6, s * 0.2); c.fill();
  c.fillStyle = '#BFE3F5'; c.beginPath(); c.roundRect(x - s * 0.38, y - s * 0.43, s * 0.34, s * 0.3, s * 0.06); c.fill(); c.beginPath(); c.roundRect(x + s * 0.04, y - s * 0.43, s * 0.34, s * 0.3, s * 0.06); c.fill();
  c.fillStyle = '#2A2A30'; circ(c, x - s * 0.5, y + s * 0.47, s * 0.22); c.fill(); circ(c, x + s * 0.5, y + s * 0.47, s * 0.22); c.fill();
  c.fillStyle = '#C9D1D9'; circ(c, x - s * 0.5, y + s * 0.47, s * 0.09); c.fill(); circ(c, x + s * 0.5, y + s * 0.47, s * 0.09); c.fill();
}
function house(c, x, y, s, wall, roof) {
  c.fillStyle = wall; c.fillRect(x - s * 0.7, y - s * 0.2, s * 1.4, s * 0.9);
  c.fillStyle = roof; c.beginPath(); c.moveTo(x - s * 0.95, y - s * 0.15); c.lineTo(x, y - s * 0.9); c.lineTo(x + s * 0.95, y - s * 0.15); c.closePath(); c.fill();
  c.fillStyle = '#8A5A3C'; c.beginPath(); c.roundRect(x - s * 0.18, y + s * 0.15, s * 0.36, s * 0.55, [s * 0.18, s * 0.18, 0, 0]); c.fill();
}
function drops(c, x, y, s, n = 5) {
  c.fillStyle = '#4FA3E0';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.15 + 0.7 * (i / (n - 1))), d = s * (0.62 + (i % 2) * 0.22), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    c.save(); c.translate(px, py); c.rotate(a + Math.PI / 2);
    c.beginPath(); c.moveTo(0, -s * 0.26); c.bezierCurveTo(s * 0.2, 0, s * 0.14, s * 0.16, 0, s * 0.16); c.bezierCurveTo(-s * 0.14, s * 0.16, -s * 0.2, 0, 0, -s * 0.26); c.fill(); c.restore();
  }
}
function water(c, x, y, s) {
  c.fillStyle = '#4FA3E0'; ell(c, x, y + s * 0.25, s * 0.95, s * 0.5); c.fill();
  c.strokeStyle = '#DDF1FB'; c.lineWidth = s * 0.09; c.lineCap = 'round';
  for (const [dx, dy] of [[-0.35, 0.12], [0.3, 0.3], [-0.1, 0.48]]) { c.beginPath(); c.moveTo(x + (dx - 0.22) * s, y + dy * s); c.quadraticCurveTo(x + dx * s, y + (dy - 0.14) * s, x + (dx + 0.22) * s, y + dy * s); c.stroke(); }
}
// Pictures a job is told with. Each draws inside a box of half-size s about (x, y).
const ICONS = {
  lili,
  car,
  teddy: (c, x, y, s) => teddy(c, x, y + s * 0.05, s * 0.8),
  poo: (c, x, y, s) => poo(c, x, y + s * 0.4, s * 0.8),
  bone: (c, x, y, s) => drawBone(c, x, y, s * 0.85),
  birds: (c, x, y, s) => { drawBird(c, x - s * 0.3, y + s * 0.3, s * 0.5); drawBird(c, x + s * 0.25, y - s * 0.35, s * 0.42); },
  heart: (c, x, y, s) => { c.fillStyle = '#F0506E'; heartPath(c, x, y, s * 0.72); c.fill(); },
  fast: (c, x, y, s) => {                            // going fast: streaks and a puff of dust
    c.strokeStyle = '#4FA3E0'; c.lineWidth = s * 0.16; c.lineCap = 'round';
    for (const [dy, a, b] of [[-0.45, -0.7, 0.5], [0, -0.9, 0.8], [0.45, -0.5, 0.6]]) { c.beginPath(); c.moveTo(x + a * s, y + dy * s); c.lineTo(x + b * s, y + dy * s); c.stroke(); }
    c.fillStyle = '#4FA3E0'; c.beginPath(); c.moveTo(x + s * 0.95, y); c.lineTo(x + s * 0.5, y - s * 0.3); c.lineTo(x + s * 0.5, y + s * 0.3); c.closePath(); c.fill();
  },
  friend: (c, x, y, s) => {                          // a smiling child
    c.fillStyle = '#7A4A2A'; circ(c, x, y - s * 0.12, s * 0.66); c.fill();
    c.fillStyle = '#F6C9A0'; circ(c, x, y + s * 0.05, s * 0.56); c.fill();
    c.fillStyle = '#7A4A2A'; c.beginPath(); c.arc(x, y - s * 0.05, s * 0.58, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
    c.fillStyle = '#2A1C14'; circ(c, x - s * 0.2, y + s * 0.02, s * 0.065); c.fill(); circ(c, x + s * 0.2, y + s * 0.02, s * 0.065); c.fill();
    c.strokeStyle = '#B5483A'; c.lineWidth = s * 0.08; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + s * 0.14, s * 0.24, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = 'rgba(240,80,110,.35)'; circ(c, x - s * 0.36, y + s * 0.2, s * 0.1); c.fill(); circ(c, x + s * 0.36, y + s * 0.2, s * 0.1); c.fill();
  },
  bark: (c, x, y, s) => {                            // a bark: Lili, and the noise coming out
    lili(c, x - s * 0.3, y + s * 0.1, s * 0.7);
    c.strokeStyle = '#F29F3A'; c.lineWidth = s * 0.12; c.lineCap = 'round';
    for (const r of [0.3, 0.55, 0.8]) { c.beginPath(); c.arc(x + s * 0.15, y + s * 0.2, s * r, -0.75, 0.35); c.stroke(); }
  },
  jump: (c, x, y, s) => {                            // a jump: an arc up and over, an arrow on the end
    c.strokeStyle = '#4FA653'; c.lineWidth = s * 0.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - s * 0.75, y + s * 0.6); c.quadraticCurveTo(x - s * 0.2, y - s * 1.2, x + s * 0.5, y + s * 0.25); c.stroke();
    c.fillStyle = '#4FA653'; c.beginPath(); c.moveTo(x + s * 0.72, y + s * 0.72); c.lineTo(x + s * 0.2, y + s * 0.38); c.lineTo(x + s * 0.82, y + s * 0.1); c.closePath(); c.fill();
  },
  pot: (c, x, y, s) => {
    c.fillStyle = '#4FA653'; ell(c, x, y - s * 0.2, s * 0.5, s * 0.34); c.fill();
    for (const [dx, dy, col] of [[-0.32, -0.5, '#FF7FA0'], [0.3, -0.52, '#FFD23F'], [0, -0.72, '#fff']]) { c.fillStyle = col; circ(c, x + dx * s, y + dy * s, s * 0.2); c.fill(); c.fillStyle = '#F29F3A'; circ(c, x + dx * s, y + dy * s, s * 0.07); c.fill(); }
    c.fillStyle = '#C9683F'; c.beginPath(); c.moveTo(x - s * 0.52, y); c.lineTo(x + s * 0.52, y); c.lineTo(x + s * 0.36, y + s * 0.8); c.lineTo(x - s * 0.36, y + s * 0.8); c.closePath(); c.fill();
    c.fillStyle = '#D97B50'; c.beginPath(); c.roundRect(x - s * 0.62, y - s * 0.12, s * 1.24, s * 0.26, s * 0.06); c.fill();
  },
  school: (c, x, y, s) => {
    house(c, x, y + s * 0.1, s * 0.95, '#F6D365', '#B5483A');
    c.fillStyle = '#888'; c.fillRect(x + s * 0.42, y - s * 1.0, s * 0.05, s * 0.6); c.fillStyle = '#4FA3E0'; c.fillRect(x + s * 0.47, y - s * 1.0, s * 0.34, s * 0.22);
    c.fillStyle = '#BFE3F5'; c.fillRect(x - s * 0.52, y + s * 0.1, s * 0.24, s * 0.24); c.fillRect(x + s * 0.28, y + s * 0.1, s * 0.24, s * 0.24);
  },
  home: (c, x, y, s) => {                            // Lili's home: the house with her bone over the door
    house(c, x, y + s * 0.1, s * 0.95, '#FBE9C8', '#4FA3E0');
    drawBone(c, x, y - s * 0.22, s * 0.26, 0);
  },
  table: (c, x, y, s) => {
    c.fillStyle = '#9A6A3A'; c.fillRect(x - s * 0.6, y + s * 0.1, s * 0.14, s * 0.75); c.fillRect(x + s * 0.46, y + s * 0.1, s * 0.14, s * 0.75);
    c.fillStyle = '#E0453A'; c.beginPath(); c.roundRect(x - s * 0.92, y - s * 0.1, s * 1.84, s * 0.28, s * 0.08); c.fill();
    c.fillStyle = '#fff'; for (let i = -3; i <= 3; i += 2) c.fillRect(x + i * s * 0.22 - s * 0.1, y - s * 0.1, s * 0.2, s * 0.28);
  },
  lake: water,
  castle: (c, x, y, s) => {                         // a sandcastle with two towers and a flag
    c.fillStyle = '#E3C27E'; c.beginPath(); c.roundRect(x - s * 0.8, y + s * 0.45, s * 1.6, s * 0.35, s * 0.1); c.fill();
    c.fillStyle = '#E9CF8E'; c.fillRect(x - s * 0.45, y - s * 0.15, s * 0.9, s * 0.62); c.fillRect(x - s * 0.75, y - s * 0.3, s * 0.3, s * 0.77); c.fillRect(x + s * 0.45, y - s * 0.3, s * 0.3, s * 0.77);
    for (const k of [-0.3, -0.05, 0.2]) c.fillRect(x + k * s, y - s * 0.3, s * 0.15, s * 0.16);
    c.fillStyle = '#8A6A4A'; c.fillRect(x - s * 0.02, y - s * 0.75, s * 0.05, s * 0.45); c.fillStyle = '#E2453C'; c.beginPath(); c.moveTo(x + s * 0.03, y - s * 0.75); c.lineTo(x + s * 0.35, y - s * 0.63); c.lineTo(x + s * 0.03, y - s * 0.52); c.fill();
  },
  duck: (c, x, y, s) => {                            // a yellow duck, side on, facing right
    c.fillStyle = '#F6C93C'; ell(c, x - s * 0.08, y + s * 0.25, s * 0.62, s * 0.4); c.fill();
    c.beginPath(); c.moveTo(x - s * 0.62, y + s * 0.1); c.lineTo(x - s * 0.82, y - s * 0.12); c.lineTo(x - s * 0.5, y + s * 0.05); c.fill();
    circ(c, x + s * 0.32, y - s * 0.3, s * 0.32); c.fill();
    c.fillStyle = '#F2862E'; ell(c, x + s * 0.72, y - s * 0.24, s * 0.22, s * 0.1); c.fill();
    c.fillStyle = '#E3A92A'; ell(c, x - s * 0.12, y + s * 0.2, s * 0.32, s * 0.16, -0.25); c.fill();
    c.fillStyle = '#2A1C14'; circ(c, x + s * 0.4, y - s * 0.38, s * 0.07); c.fill();
  },
  frisbee: (c, x, y, s) => {                         // a red flying disc, tilted, with its rim
    c.fillStyle = '#E2453C'; ell(c, x, y + s * 0.08, s * 0.82, s * 0.36, -0.2); c.fill();
    c.fillStyle = '#F2675D'; ell(c, x - s * 0.02, y - s * 0.02, s * 0.62, s * 0.24, -0.2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = s * 0.07; c.beginPath(); c.ellipse(x, y - s * 0.02, s * 0.36, s * 0.13, -0.2, 0, TAU); c.stroke();
  },
  icecream: (c, x, y, s) => {                        // an ice cream: a cone with two scoops
    c.fillStyle = '#D9A15A'; c.beginPath(); c.moveTo(x - s * 0.36, y - s * 0.05); c.lineTo(x + s * 0.36, y - s * 0.05); c.lineTo(x, y + s * 0.9); c.closePath(); c.fill();
    c.fillStyle = '#C48A48'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.05); c.lineTo(x + s * 0.06, y - s * 0.05); c.lineTo(x, y + s * 0.9); c.closePath(); c.fill();
    c.fillStyle = '#F7A8C4'; circ(c, x, y - s * 0.18, s * 0.38); c.fill();
    c.fillStyle = '#FFF4D6'; circ(c, x + s * 0.06, y - s * 0.58, s * 0.3); c.fill();
    c.fillStyle = '#E2453C'; circ(c, x + s * 0.12, y - s * 0.9, s * 0.1); c.fill();
  },
  tree: (c, x, y, s) => {                            // a round tree on its trunk
    c.fillStyle = '#8A5A3C'; c.beginPath(); c.roundRect(x - s * 0.1, y + s * 0.1, s * 0.2, s * 0.72, s * 0.05); c.fill();
    c.fillStyle = '#4FA653'; circ(c, x, y - s * 0.18, s * 0.55); c.fill(); circ(c, x - s * 0.42, y + s * 0.05, s * 0.34); c.fill(); circ(c, x + s * 0.42, y + s * 0.05, s * 0.34); c.fill();
    c.fillStyle = '#6CC06A'; circ(c, x - s * 0.14, y - s * 0.34, s * 0.26); c.fill();
  },
  splash: (c, x, y, s) => { water(c, x, y + s * 0.3, s * 0.8); drops(c, x, y + s * 0.25, s * 0.95, 7); },
  shake: (c, x, y, s) => { lili(c, x, y + s * 0.2, s * 0.62); drops(c, x, y + s * 0.2, s * 1.0, 6); },
  cone: (c, x, y, s) => {
    c.fillStyle = '#FF7A2E'; c.beginPath(); c.moveTo(x, y - s * 0.85); c.lineTo(x + s * 0.46, y + s * 0.6); c.lineTo(x - s * 0.46, y + s * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.roundRect(x - s * 0.72, y + s * 0.55, s * 1.44, s * 0.24, s * 0.08); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.2); c.lineTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s * 0.3, y + s * 0.12); c.lineTo(x - s * 0.3, y + s * 0.12); c.closePath(); c.fill();
  },
  lamp: (c, x, y, s) => {
    c.fillStyle = '#5D6772'; c.beginPath(); c.roundRect(x - s * 0.07, y - s * 0.5, s * 0.14, s * 1.35, s * 0.05); c.fill(); c.beginPath(); c.roundRect(x - s * 0.24, y + s * 0.72, s * 0.48, s * 0.16, s * 0.05); c.fill();
    c.fillStyle = 'rgba(255,220,90,.35)'; circ(c, x, y - s * 0.6, s * 0.46); c.fill();
    c.fillStyle = '#FFE27A'; circ(c, x, y - s * 0.6, s * 0.27); c.fill();
    c.fillStyle = '#5D6772'; c.beginPath(); c.roundRect(x - s * 0.3, y - s * 0.95, s * 0.6, s * 0.12, s * 0.05); c.fill();
  },
  bin: (c, x, y, s) => {
    c.fillStyle = '#7C8792'; c.beginPath(); c.moveTo(x - s * 0.5, y - s * 0.45); c.lineTo(x + s * 0.5, y - s * 0.45); c.lineTo(x + s * 0.4, y + s * 0.85); c.lineTo(x - s * 0.4, y + s * 0.85); c.closePath(); c.fill();
    c.fillStyle = '#5D6772'; c.beginPath(); c.roundRect(x - s * 0.62, y - s * 0.62, s * 1.24, s * 0.2, s * 0.08); c.fill(); c.beginPath(); c.roundRect(x - s * 0.16, y - s * 0.78, s * 0.32, s * 0.18, s * 0.06); c.fill();
    c.strokeStyle = '#5D6772'; c.lineWidth = s * 0.07; for (const dx of [-0.2, 0, 0.2]) { c.beginPath(); c.moveTo(x + dx * s, y - s * 0.25); c.lineTo(x + dx * s * 0.85, y + s * 0.65); c.stroke(); }
  },
  apple: (c, x, y, s) => {
    c.fillStyle = '#D9342B'; ell(c, x - s * 0.2, y + s * 0.15, s * 0.5, s * 0.62); c.fill(); ell(c, x + s * 0.2, y + s * 0.15, s * 0.5, s * 0.62); c.fill();
    c.strokeStyle = '#6E4630'; c.lineWidth = s * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - s * 0.3); c.lineTo(x + s * 0.06, y - s * 0.7); c.stroke();
    c.fillStyle = '#4FA653'; ell(c, x + s * 0.3, y - s * 0.62, s * 0.26, s * 0.12, -0.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, x - s * 0.34, y - s * 0.05, s * 0.1, s * 0.2, 0.4); c.fill();
  },
  sausage: (c, x, y, s) => {                         // a string of sausages
    c.strokeStyle = '#C9683F'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(x - s * 0.8, y - s * 0.4); c.lineTo(x + s * 0.8, y + s * 0.4); c.stroke();
    for (const [dx, dy] of [[-0.56, -0.28], [0, 0], [0.56, 0.28]]) {
      c.fillStyle = '#D9705A'; ell(c, x + dx * s, y + dy * s, s * 0.3, s * 0.19, 0.46); c.fill();
      c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, x + dx * s - s * 0.05, y + dy * s - s * 0.08, s * 0.14, s * 0.04, 0.46); c.fill();
    }
  },
  dig: (c, x, y, s) => {                             // a heap of earth with a bone in it, earth flying
    drawBone(c, x + s * 0.1, y - s * 0.1, s * 0.5, -1.0);
    c.fillStyle = '#8A5A3C'; c.beginPath(); c.moveTo(x - s * 0.95, y + s * 0.8); c.quadraticCurveTo(x - s * 0.3, y - s * 0.35, x + s * 0.1, y + s * 0.15); c.quadraticCurveTo(x + s * 0.5, y - s * 0.1, x + s * 0.95, y + s * 0.8); c.closePath(); c.fill();
    c.fillStyle = '#A9744A'; for (const [dx, dy, r] of [[-0.7, -0.35, 0.1], [-0.4, -0.7, 0.08], [0.72, -0.4, 0.09], [0.5, -0.75, 0.07]]) { circ(c, x + dx * s, y + dy * s, s * r); c.fill(); }
  },
  beach: (c, x, y, s) => {                           // sand and water, and a beach ball
    c.fillStyle = '#F0DDA8'; ell(c, x, y + s * 0.35, s * 0.95, s * 0.48); c.fill();
    c.fillStyle = '#4FA3E0'; c.beginPath(); c.ellipse(x, y + s * 0.35, s * 0.95, s * 0.48, 0, 0.15, Math.PI - 0.15); c.closePath(); c.fill();
    c.fillStyle = '#fff'; circ(c, x - s * 0.1, y - s * 0.22, s * 0.44); c.fill();
    c.fillStyle = '#E0453A'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.22); c.arc(x - s * 0.1, y - s * 0.22, s * 0.44, -1.6, -0.5); c.closePath(); c.fill();
    c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.22); c.arc(x - s * 0.1, y - s * 0.22, s * 0.44, 0.5, 1.6); c.closePath(); c.fill();
    c.fillStyle = '#4FA653'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.22); c.arc(x - s * 0.1, y - s * 0.22, s * 0.44, 2.6, 3.7); c.closePath(); c.fill();
  },
  star: (c, x, y, s) => { c.fillStyle = '#FFD23F'; c.strokeStyle = '#E8A21A'; c.lineWidth = s * 0.1; c.lineJoin = 'round'; starPath(c, x, y + s * 0.05, s * 0.9); c.stroke(); c.fill(); },
};
export function drawIcon(c, name, x, y, s) { (ICONS[name] || ((cc, xx, yy, ss) => { cc.fillStyle = '#ccc'; circ(cc, xx, yy, ss * 0.5); cc.fill(); }))(c, x, y, s); }
// A job's pictures in a row, in a box w wide and h high about (x, y).
export function drawPictures(c, names, x, y, w, h) {
  const n = Math.max(1, names.length), s = Math.min(h / 2, w / (n * 2.3)) * 0.92, gap = s * 2.3;
  names.forEach((name, i) => drawIcon(c, name, x + (i - (n - 1) / 2) * gap, y, s));
}
// A sticker: a round badge with the job's pictures on it. state: 'done' (colour, a tick), 'open' (pale, to do),
// 'now' (the one in hand).
export function drawSticker(c, names, x, y, r, state = 'done') {
  c.fillStyle = 'rgba(40,50,40,.18)'; circ(c, x + 1, y + 4, r); c.fill();
  c.fillStyle = state === 'done' ? '#FFF3C4' : '#FFFDF6'; circ(c, x, y, r); c.fill();
  c.strokeStyle = state === 'done' ? '#F2B63A' : state === 'now' ? '#4FA653' : '#D9D3C2'; c.lineWidth = r * (state === 'open' ? 0.07 : 0.12); c.stroke();
  c.save(); if (state === 'open') c.globalAlpha *= 0.8;
  drawPictures(c, names, x, y, r * 1.5, r * 0.95); c.restore();
  if (state === 'done') drawTick(c, x + r * 0.68, y + r * 0.68, r * 0.3);
}
export function drawPadlock(c, x, y, s) {
  c.strokeStyle = '#8D97A3'; c.lineWidth = s * 0.2; c.lineCap = 'round'; c.beginPath(); c.arc(x, y - s * 0.2, s * 0.38, Math.PI, 0); c.lineTo(x + s * 0.38, y); c.moveTo(x - s * 0.38, y - s * 0.2); c.lineTo(x - s * 0.38, y); c.stroke();
  c.fillStyle = '#F2B63A'; c.beginPath(); c.roundRect(x - s * 0.62, y - s * 0.05, s * 1.24, s * 0.95, s * 0.18); c.fill();
  c.fillStyle = '#8A5A3C'; circ(c, x, y + s * 0.32, s * 0.14); c.fill(); c.fillRect(x - s * 0.06, y + s * 0.35, s * 0.12, s * 0.28);
}
// pips for "do it this many times": n of count filled in
export function drawPips(c, x, y, s, n, count, pop = 0) {
  const gap = s * 2.6;
  for (let i = 0; i < count; i++) {
    const px = x + (i - (count - 1) / 2) * gap, on = i < n, r = s * (on && i === n - 1 ? 1 + pop * 0.6 : 1);
    c.fillStyle = on ? '#4FA653' : '#fff'; c.strokeStyle = on ? '#3B8A40' : '#C9C3B2'; c.lineWidth = s * 0.28; circ(c, px, y, r); c.fill(); c.stroke();
  }
}
// a line of words, as big as fits in w
export function drawWords(c, text, x, y, size, w, fill = '#3A3F4A') {
  c.font = `800 ${size}px "Baloo 2", "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
  const tw = c.measureText(text).width; if (tw > w) { size *= w / tw; c.font = `800 ${size}px "Baloo 2", "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`; }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fill; c.fillText(text, x, y);
}

// a big green arrow pointing at angle a (screen), for the way to go; and a bouncing marker over a place
export function drawArrow(c, x, y, a, s) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = '#4FA653'; c.strokeStyle = '#fff'; c.lineWidth = s * 0.16; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.2, -s * 0.8); c.lineTo(-s * 0.2, -s * 0.35); c.lineTo(-s, -s * 0.35); c.lineTo(-s, s * 0.35); c.lineTo(-s * 0.2, s * 0.35); c.lineTo(-s * 0.2, s * 0.8); c.closePath();
  c.stroke(); c.fill(); c.restore();
}
export function drawMarker(c, x, y, s) {
  c.fillStyle = '#4FA653'; c.strokeStyle = '#fff'; c.lineWidth = s * 0.16; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x, y + s); c.lineTo(x - s * 0.7, y); c.lineTo(x - s * 0.3, y); c.lineTo(x - s * 0.3, y - s * 0.8); c.lineTo(x + s * 0.3, y - s * 0.8); c.lineTo(x + s * 0.3, y); c.lineTo(x + s * 0.7, y); c.closePath();
  c.stroke(); c.fill();
}

// a small loudspeaker in the corner of a job's card: "tap, and it is said again". wave 0..1 makes its sound waves pulse.
export function drawSpeaker(c, x, y, s, wave = 0) {
  c.fillStyle = '#B9A77E'; c.beginPath(); c.moveTo(x - s, y - s * 0.35); c.lineTo(x - s * 0.45, y - s * 0.35); c.lineTo(x + s * 0.1, y - s * 0.85); c.lineTo(x + s * 0.1, y + s * 0.85); c.lineTo(x - s * 0.45, y + s * 0.35); c.lineTo(x - s, y + s * 0.35); c.closePath(); c.fill();
  c.strokeStyle = wave ? '#4FA653' : '#B9A77E'; c.lineWidth = s * 0.22; c.lineCap = 'round';
  for (const r of [0.5, 0.9]) { c.globalAlpha *= r === 0.9 ? 0.5 + 0.5 * wave : 1; c.beginPath(); c.arc(x + s * 0.2, y, s * r, -0.75, 0.75); c.stroke(); }
}
// what a job says, written under its card: white with a dark edge so it reads over the town, on two lines if it is long
export function drawCaption(c, text, x, y, size, w) {
  const font = (s) => `800 ${s}px "Baloo 2", "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
  c.font = font(size);
  let lines = [text];
  if (c.measureText(text).width > w) {                // break at the space nearest the middle
    const mid = text.length / 2, at = [...text].map((ch, i) => (ch === ' ' ? i : -1)).filter((i) => i > 0).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    if (at) lines = [text.slice(0, at), text.slice(at + 1)];
    const widest = Math.max(...lines.map((l) => c.measureText(l).width));
    if (widest > w) { size *= w / widest; c.font = font(size); }
  }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = size * 0.26; c.strokeStyle = 'rgba(40,50,40,.75)'; c.fillStyle = '#fff';
  lines.forEach((l, i) => { c.strokeText(l, x, y + i * size * 1.15); c.fillText(l, x, y + i * size * 1.15); });
}
