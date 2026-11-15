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

// ---- missions: a card with a picture on it, and a tick for one done ----
export function drawCard(c, x, y, r) {
  c.fillStyle = 'rgba(40,50,40,.18)'; c.beginPath(); c.roundRect(x - r + 2, y - r + 4, r * 2, r * 2, r * 0.35); c.fill();
  c.fillStyle = '#FFFDF6'; c.beginPath(); c.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35); c.fill();
  c.strokeStyle = '#E8B04A'; c.lineWidth = Math.max(2, r * 0.08); c.stroke();
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
const PICTURES = {
  'poo-table': (c, x, y, s) => {                     // the picnic table with a poo on it
    c.fillStyle = '#9A6A3A'; c.fillRect(x - s * 0.55, y + s * 0.1, s * 0.12, s * 0.7); c.fillRect(x + s * 0.43, y + s * 0.1, s * 0.12, s * 0.7);
    c.fillStyle = '#E0453A'; c.beginPath(); c.roundRect(x - s * 0.85, y - s * 0.05, s * 1.7, s * 0.22, s * 0.08); c.fill();
    poo(c, x, y - s * 0.12, s * 0.42);
  },
  'car-school': (c, x, y, s) => {                    // the school (yellow, a flag) and the red car in front of it
    c.fillStyle = '#F6D365'; c.fillRect(x - s * 0.75, y - s * 0.55, s * 1.1, s * 0.75);
    c.fillStyle = '#B5483A'; c.beginPath(); c.moveTo(x - s * 0.85, y - s * 0.5); c.lineTo(x - s * 0.2, y - s * 0.9); c.lineTo(x + s * 0.45, y - s * 0.5); c.fill();
    c.fillStyle = '#8A5A3C'; c.fillRect(x - s * 0.3, y - s * 0.2, s * 0.22, s * 0.4);
    c.fillStyle = '#4FA3E0'; c.fillRect(x + s * 0.15, y - s * 1.0, s * 0.25, s * 0.16); c.fillStyle = '#888'; c.fillRect(x + s * 0.13, y - s * 1.0, s * 0.03, s * 0.5);
    c.fillStyle = '#E0453A'; c.beginPath(); c.roundRect(x - s * 0.2, y + s * 0.2, s * 1.0, s * 0.35, s * 0.12); c.fill();
    c.fillStyle = '#2A2A30'; circ(c, x, y + s * 0.58, s * 0.13); c.fill(); circ(c, x + s * 0.6, y + s * 0.58, s * 0.13); c.fill();
  },
  teddy: (c, x, y, s) => teddy(c, x, y + s * 0.05, s * 0.8),
};
export function drawMissionPicture(c, name, x, y, s) { (PICTURES[name] || ((cc, xx, yy, ss) => { cc.fillStyle = '#ccc'; circ(cc, xx, yy, ss * 0.5); cc.fill(); }))(c, x, y, s); }
