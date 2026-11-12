// Input: touch / mouse "go where I point", keyboard arrows or WASD.
// The same steering moves the dog and, when he is driving, the car.
export const input = {
  keys: new Set(),
  pointerDown: false,
  tapPending: false,     // a quick tap that still has to become a target
  sx: 0, sy: 0,          // last pointer position (CSS px)
  target: null,          // world-space point he is heading for
  stick: null,           // game controller: { x, y, mag } while its stick or D-pad is pushed (see gamepad.js)
  onAction: null,        // ('jump' | 'bark' | 'car')
};

const MOVE_KEYS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
};
const ACTION_KEYS = { Space: 'jump', KeyQ: 'bark', KeyX: 'bark', KeyB: 'bark', KeyE: 'car', KeyF: 'car', Enter: 'car' };

export function keyVector() {
  let x = 0, y = 0;
  for (const k of input.keys) { const v = MOVE_KEYS[k]; if (v) { x += v[0]; y += v[1]; } }
  const m = Math.hypot(x, y);
  if (!m && input.stick) return [input.stick.x, input.stick.y];
  return m ? [x / m, y / m] : [0, 0];
}
// how hard he is being steered: keys are all or nothing, a stick can be pushed gently
export const steerMag = () => (input.stick && ![...input.keys].some((k) => MOVE_KEYS[k]) ? input.stick.mag : 1);

export function initInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.sx = e.clientX; input.sy = e.clientY;
    input.pointerDown = true; input.tapPending = true;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (input.pointerDown) { input.sx = e.clientX; input.sy = e.clientY; }
  });
  const up = () => { input.pointerDown = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('blur', () => { input.keys.clear(); input.pointerDown = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS[e.code]) { input.keys.add(e.code); e.preventDefault(); return; }
    if (e.repeat || !ACTION_KEYS[e.code]) return;
    e.preventDefault(); input.onAction?.(ACTION_KEYS[e.code]);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
}
