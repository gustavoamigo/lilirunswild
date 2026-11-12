// Tiny particle system for puffs, sparkles, hearts, confetti...
// Particles live in the 3D world (x, z on the ground, y = height) and are drawn
// on the 2D overlay canvas, so they are always visible and cheap.
import { TAU } from './util.js';
import { starPath, heartPath } from './art.js';

export const parts = [];

export function spawn(o) {
  if (parts.length > 600) return;
  parts.push(Object.assign({
    type: 'puff', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0,
    life: 1, age: 0, delay: 0, size: 8, grow: 0, rot: 0, vr: 0, color: '#fff', alpha: 1,
  }, o));
}

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy -= p.g * dt;
    if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0 && p.g) { p.y = 0; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
    p.rot += p.vr * dt; p.size += p.grow * dt;
  }
}

// project(x, height, z) -> [screenX, screenY, pixelsPerUnit, inFront]
export function drawFx(c, project) {
  for (const p of parts) {
    if (p.delay > 0) continue;
    const [sx, sy, k, ok] = project(p.x, p.y, p.z);
    if (!ok) continue;
    const life = p.age / p.life;
    const a = p.alpha * (life < 0.15 ? life / 0.15 : 1 - (life - 0.15) / 0.85);
    const s = Math.max(0.5, p.size * k);
    c.save();
    c.globalAlpha = Math.max(0, a);
    c.translate(sx, sy);
    c.fillStyle = p.color; c.strokeStyle = p.color;
    switch (p.type) {
      case 'ring':
        c.lineWidth = Math.max(2, 5 * k); c.beginPath(); c.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); c.stroke();
        break;
      case 'star': c.rotate(p.rot); starPath(c, 0, 0, s); c.fill(); break;
      case 'heart': heartPath(c, 0, 0, s); c.fill(); break;
      case 'confetti': c.rotate(p.rot); c.fillRect(-s / 2, -s / 4, s, s / 2); break;
      case 'leaf': c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); c.fill(); break;
      case 'note':
        c.beginPath(); c.ellipse(0, 0, s * 0.6, s * 0.45, -0.4, 0, TAU); c.fill();
        c.lineWidth = s * 0.22; c.lineCap = 'round';
        c.beginPath(); c.moveTo(s * 0.5, 0); c.lineTo(s * 0.5, -s * 1.6); c.lineTo(s * 1.1, -s * 1.3); c.stroke();
        break;
      default: c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fill();
    }
    c.restore();
  }
}

const CONFETTI = ['#FF7FA0', '#FFC94A', '#6EC6FF', '#8EDB6A', '#C79BFF', '#FF9838'];
export const confettiColor = () => CONFETTI[(Math.random() * CONFETTI.length) | 0];

// A happy pop of stars at a point in the world.
export function burst(x, y, z, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (o.speed || 150) * (0.4 + Math.random() * 0.8);
    spawn({
      type: 'star', x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 120 + Math.random() * 160, g: 420, drag: 1.2,
      life: 0.7 + Math.random() * 0.5, size: 7 + Math.random() * 6, color: confettiColor(), vr: (Math.random() - 0.5) * 8,
    });
  }
}
