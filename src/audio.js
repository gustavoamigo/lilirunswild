// All sounds are synthesised with WebAudio: no asset files to load.
let ac = null, master, sfx, noiseBuf, eng = null;
let muted = false;

export function initAudio() {
  if (ac) { ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });
}

// iPhone and iPad only let sound start from a finished touch (touchend / click), and count a web page
// as "background sound" that the ring/silent switch mutes unless it asks for the "playback" kind.
function unlock() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
  initAudio();
  if (!ac || ac.state === 'running') return;
  ac.resume();
  const src = ac.createBufferSource(); src.buffer = ac.createBuffer(1, 1, 22050); src.connect(ac.destination); src.start(0);
}
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

export function setMuted(m) {
  muted = m;
  if (ac) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.03);
}
export const isMuted = () => muted;

function tone(freq, when, dur, o = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.sweep || dur));
  const vol = o.vol ?? 0.3, att = o.attack ?? 0.012;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(sfx);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function noise(when, dur, o = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 1200, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  f.Q.value = o.q ?? 1;
  const g = ac.createGain(), vol = o.vol ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sfx);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}

// ---- the dog ----
// "Ruff!" A bark is a voice pushed through a mouth that snaps open and shut: a buzzing source whose pitch
// jumps up and falls away, with breath in it, shaped by three resonances that open with the mouth and close again.
let grit = null;
function woof(when, f0, dur, vol) {
  const t0 = ac.currentTime + when, t1 = t0 + dur;
  if (!grit) { grit = new Float32Array(257); for (let i = 0; i < 257; i++) grit[i] = Math.tanh((i / 128 - 1) * 2.5); }
  const mix = ac.createGain(); mix.gain.value = 1;
  const rough = ac.createOscillator(), roughG = ac.createGain();               // the growl in the throat
  rough.frequency.value = 62 + Math.random() * 14; roughG.gain.value = f0 * 0.07; rough.connect(roughG);
  for (const [det, type, g] of [[1, 'sawtooth', 0.5], [1.008, 'sawtooth', 0.35], [0.5, 'square', 0.18]]) {
    const o = ac.createOscillator(), og = ac.createGain(); o.type = type; og.gain.value = g;
    o.frequency.setValueAtTime(f0 * 0.72 * det, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * det, t0 + 0.03);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.5 * det, t1);
    roughG.connect(o.frequency); o.connect(og); og.connect(mix); o.start(t0); o.stop(t1 + 0.05);
  }
  rough.start(t0); rough.stop(t1 + 0.05);
  const br = ac.createBufferSource(), brG = ac.createGain(); br.buffer = noiseBuf; br.loop = true;   // breath
  brG.gain.setValueAtTime(0.5, t0); brG.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05); brG.gain.setValueAtTime(0.12, t1 - 0.04); brG.gain.linearRampToValueAtTime(0.3, t1);
  br.connect(brG); brG.connect(mix); br.start(t0, Math.random() * 0.5); br.stop(t1 + 0.05);
  const out = ac.createGain(), shape = ac.createWaveShaper(); shape.curve = grit;
  for (const [shut, open, q, g] of [[520, 980, 5, 1], [1250, 1900, 7, 0.55], [2600, 3100, 8, 0.22]]) {
    const f = ac.createBiquadFilter(), fg = ac.createGain(); f.type = 'bandpass'; f.Q.value = q; fg.gain.value = g;
    f.frequency.setValueAtTime(shut, t0); f.frequency.exponentialRampToValueAtTime(open, t0 + 0.035); f.frequency.exponentialRampToValueAtTime(shut * 0.9, t1);
    mix.connect(f); f.connect(fg); fg.connect(shape);
  }
  const body = ac.createBiquadFilter(), bodyG = ac.createGain(); body.type = 'lowpass'; body.frequency.value = 380; bodyG.gain.value = 0.35;
  mix.connect(body); body.connect(bodyG); bodyG.connect(shape);
  out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  out.gain.setValueAtTime(vol * 0.85, t0 + dur * 0.6); out.gain.exponentialRampToValueAtTime(0.0001, t1);
  shape.connect(out); out.connect(sfx);
}
export function bark() {
  if (!ac) return;
  const f = 430 + Math.random() * 70;
  woof(0, f, 0.19, 0.95);
  if (Math.random() < 0.4) woof(0.23, f * 0.94, 0.16, 0.8);                  // sometimes "ruff-ruff"
}
// an excited little yip: "a bird!"
export function yip() { tone(700, 0, 0.12, { type: 'triangle', to: 1300, sweep: 0.08, vol: 0.2 }); tone(900, 0.13, 0.12, { type: 'triangle', to: 1500, sweep: 0.08, vol: 0.16 }); }
export function jump() { tone(280, 0, 0.2, { to: 720, sweep: 0.16, vol: 0.18 }); }
export function land() { tone(170, 0, 0.1, { to: 90, vol: 0.22 }); noise(0, 0.06, { freq: 500, q: 1.2, vol: 0.1 }); }
export function step() { noise(0, 0.035, { freq: 420, q: 1.5, vol: 0.05 }); }
export function whoosh() { noise(0, 0.35, { freq: 500, to: 2200, q: 1.2, vol: 0.14, attack: 0.1 }); }
export function skid() { noise(0, 0.22, { freq: 1700, to: 900, q: 2.5, vol: 0.09, attack: 0.03 }); }
// running flat out into something solid
export function bonk() { tone(220, 0, 0.22, { to: 70, vol: 0.4 }); noise(0, 0.1, { freq: 300, q: 0.8, vol: 0.3 }); tone(1300, 0.1, 0.3, { to: 900, vol: 0.06 }); }

// ---- things he knocks about ----
export function cone() { tone(520, 0, 0.09, { type: 'triangle', to: 300, vol: 0.2 }); noise(0, 0.05, { freq: 1400, vol: 0.12 }); }
export function box() { tone(140, 0, 0.12, { to: 80, vol: 0.3 }); noise(0, 0.09, { freq: 600, q: 0.7, vol: 0.2 }); }
export function bin() {
  for (let i = 0; i < 4; i++) { tone(300 + Math.random() * 500, i * 0.07, 0.2, { type: 'square', to: 180, vol: 0.07 }); noise(i * 0.07, 0.09, { freq: 2600 + Math.random() * 1500, q: 3, vol: 0.2 }); }
}
export function smash() {
  noise(0, 0.25, { type: 'highpass', freq: 3200, vol: 0.3 });
  for (let i = 0; i < 5; i++) tone(1800 + Math.random() * 2400, i * 0.035, 0.12, { type: 'triangle', vol: 0.09 });
  tone(180, 0, 0.1, { to: 90, vol: 0.2 });
}
export function boing() { tone(260, 0, 0.16, { to: 520, sweep: 0.1, vol: 0.14 }); }

// ---- birds and people ----
export function flutter() { for (let i = 0; i < 9; i++) noise(i * 0.055, 0.05, { freq: 1500 + (i % 2) * 700, q: 1.4, vol: 0.13 }); }
export function coo() { tone(520, 0, 0.22, { to: 610, sweep: 0.1, vol: 0.05, attack: 0.05 }); tone(560, 0.26, 0.3, { to: 470, vol: 0.05, attack: 0.05 }); }
export function aww() { tone(440, 0, 0.5, { type: 'triangle', to: 660, sweep: 0.25, vol: 0.13, attack: 0.06 }); tone(660, 0.3, 0.4, { type: 'triangle', to: 520, vol: 0.1, attack: 0.06 }); }
export function oof() { tone(300, 0, 0.25, { type: 'triangle', to: 130, vol: 0.2 }); noise(0.05, 0.12, { freq: 400, q: 0.8, vol: 0.18 }); }
export function yelp() { tone(600, 0, 0.18, { type: 'triangle', to: 1100, sweep: 0.1, vol: 0.14 }); }

// ---- the car ----
export function door() { tone(150, 0, 0.08, { to: 90, vol: 0.3 }); noise(0, 0.05, { freq: 900, vol: 0.2 }); }
export function horn() { for (const f of [392, 494]) { tone(f, 0, 0.14, { type: 'square', vol: 0.09 }); tone(f, 0.18, 0.3, { type: 'square', vol: 0.09 }); } }
export function crash() { tone(160, 0, 0.25, { to: 60, vol: 0.4 }); noise(0, 0.2, { freq: 700, q: 0.6, vol: 0.35 }); noise(0.03, 0.15, { freq: 3000, q: 2, vol: 0.12 }); }
// The engine hums while he is driving: level 0..1 is how fast the car is going.
export function engine(level, on) {
  if (!ac) return;
  if (!eng) {
    eng = { osc: ac.createOscillator(), lfo: ac.createOscillator(), f: ac.createBiquadFilter(), g: ac.createGain(), lg: ac.createGain() };
    eng.osc.type = 'sawtooth'; eng.lfo.type = 'sine'; eng.lfo.frequency.value = 23; eng.lg.gain.value = 9;
    eng.f.type = 'lowpass'; eng.f.frequency.value = 500; eng.g.gain.value = 0;
    eng.lfo.connect(eng.lg); eng.lg.connect(eng.osc.frequency);
    eng.osc.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(sfx);
    eng.osc.start(); eng.lfo.start();
  }
  const t = ac.currentTime;
  eng.osc.frequency.setTargetAtTime(52 + level * 95, t, 0.08);
  eng.f.frequency.setTargetAtTime(380 + level * 900, t, 0.08);
  eng.g.gain.setTargetAtTime(on ? 0.07 + level * 0.06 : 0, t, 0.12);
}
