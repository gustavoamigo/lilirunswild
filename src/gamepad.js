// Game controller (any pad with the standard layout). Stick or D-pad steers,
// A / X / Y are jump / bark / car. Read once a frame; nothing happens if no pad is there.
import { input } from './input.js';

const DEAD = 0.28;                                   // a resting stick is never quite at zero
const BUTTONS = { 0: 'jump', 2: 'bark', 3: 'car' };
let prev = {};

export function pollPad() {
  let g = null;
  try { for (const q of navigator.getGamepads ? navigator.getGamepads() : []) if (q && q.connected && q.buttons.length >= 4) { g = q; break; } } catch {}
  if (!g) { input.stick = null; prev = {}; return; }
  const down = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
  let x = g.axes[0] || 0, y = g.axes[1] || 0;
  if (down(14)) x = -1; if (down(15)) x = 1; if (down(12)) y = -1; if (down(13)) y = 1;
  const m = Math.hypot(x, y);
  // a full push is a run (and, kept up, zoomies); a gentle one is a trot
  input.stick = m > DEAD ? { x: x / m, y: y / m, mag: m > 0.9 ? 1 : 0.4 + (0.5 * (m - DEAD)) / (0.9 - DEAD) } : null;
  for (const i in BUTTONS) { const d = down(i); if (d && !prev[i]) input.onAction?.(BUTTONS[i]); prev[i] = d; }
}
