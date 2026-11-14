// Sounds are synthesised with WebAudio, all but the bark and Lili's own play growl.
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
  loadVoice();
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
// Recorded sounds (sounds/CREDITS.md): a soundfont bark, because a synthesised one never sounded like a dog,
// and Lili herself, growling the way she does when she is pulling on something in play.
const voice = {};
function loadVoice() {
  for (const k of ['bark', 'lili-growl-1', 'lili-growl-2', 'lili-growl-3']) {
    fetch(new URL(`../sounds/${k}.wav`, import.meta.url)).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((b) => { voice[k] = b; }).catch(() => {});
  }
}
function say(k, vol, rate = 1) {
  if (!ac || !voice[k]) return;
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = voice[k]; src.playbackRate.value = rate; g.gain.value = vol;
  src.connect(g); g.connect(sfx); src.start();
}
export function bark() { say('bark', 0.9, 1.2); }   // a spaniel: a bit higher than the recording
// her play growl, three takes in turn. There is nothing to pull on yet, so it goes with the play bow.
let growls = 0;
export function playGrowl() { say('lili-growl-' + (growls++ % 3 + 1), 0.7); }
// an excited little yip: "a bird!"
// Studio: audition a recording. Decoded on first use and kept.
const clips = new Map();
export function playClip(url) {
  if (!ac) return;
  const play = (buf) => { const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 0.9; src.connect(g); g.connect(sfx); src.start(); };
  if (clips.has(url)) { play(clips.get(url)); return; }
  fetch(url).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(b => { clips.set(url, b); play(b); }).catch(() => {});
}
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
// a cartoon scream: a rising wail with a wobble in it, higher from a child
export function scream(child) { const f = child ? 900 : 620; for (const [d, v] of [[0, 0.06], [7, 0.04]]) tone(f + d, 0, 0.6, { type: 'sawtooth', to: f * 1.35 + d, sweep: 0.25, vol: v, attack: 0.03 }); tone(f * 1.3, 0.3, 0.35, { type: 'triangle', to: f * 1.1, vol: 0.05 }); }
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
