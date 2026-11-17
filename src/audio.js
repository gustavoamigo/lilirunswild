// Sounds are synthesised with WebAudio, but for the recorded and generated ones in sounds/ (loaded in loadVoice).
let ac = null, master, sfx, noiseBuf;
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
  touched = true; if (waiting) { const w = waiting; waiting = null; speak(w); }
  if (!ac || ac.state === 'running') return;
  ac.resume();
  const src = ac.createBufferSource(); src.buffer = ac.createBuffer(1, 1, 22050); src.connect(ac.destination); src.start(0);
}
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

export function setMuted(m) {
  muted = m;
  if (m) { waiting = null; try { window.speechSynthesis?.cancel(); } catch {} }
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
// Sounds from files: Lili herself, growling the way she does when she is pulling on something in play (recorded), and
// generated ones (docs/tech.md, "Generated sounds"): her bark and panting, the car's engine, horn and crash, a man's yell, a woman's scream (two takes), a child's scream, crockery breaking (two takes), a bin knocked over (four takes).
const voice = {};
const FILES = ['bark', 'lili-growl-1', 'lili-growl-2', 'lili-growl-3', 'panting', 'car-horn', 'car-crash', 'man-yell', 'woman-scream-1', 'woman-scream-2', 'child-scream', 'car-engine', 'cup-break-1', 'cup-break-2', 'bin-1', 'bin-2', 'bin-3', 'bin-4'];
function loadVoice() {
  for (const k of FILES) {
    fetch(new URL(`../sounds/${k}.wav`, import.meta.url)).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((b) => { voice[k] = b; }).catch(() => {});
  }
}
function say(k, vol, rate = 1) {
  if (!ac || !voice[k]) return;
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = voice[k]; src.playbackRate.value = rate; g.gain.value = vol;
  src.connect(g); g.connect(sfx); src.start();
}
export function bark() { say('bark', 0.8); }
// her play growl, three takes in turn: only for pulling a toy from someone (not the play bow). Nothing plays it until then.
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
export function box() { tone(140, 0, 0.12, { to: 80, vol: 0.3 }); noise(0, 0.09, { freq: 600, q: 0.7, vol: 0.2 }); }
// a bin knocked over (one of four takes)
export function bin() { say('bin-' + (1 + Math.floor(Math.random() * 4)), 0.55, 0.95 + Math.random() * 0.1); }
// crockery off the picnic table breaking on the ground (one of two takes)
export function breakCup() { say('cup-break-' + (1 + (Math.random() < 0.5)), 0.5, 0.95 + Math.random() * 0.1); }
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
// a fright: a man yells, a woman screams (one of two takes), a child screams (all generated)
export function scream(who) {
  if (who === 'man') say('man-yell', 0.5, 0.95 + Math.random() * 0.1);
  else if (who === 'woman') say('woman-scream-' + (1 + (Math.random() < 0.5)), 0.45);
  else say('child-scream', 0.45, 0.97 + Math.random() * 0.06);
}
export function splash() { noise(0, 0.3, { freq: 900, to: 400, q: 0.8, vol: 0.18, attack: 0.02 }); noise(0.05, 0.25, { freq: 2600, q: 1.5, vol: 0.08 }); }
export function plop() { tone(260, 0, 0.14, { type: 'sine', to: 110, vol: 0.18 }); noise(0.02, 0.08, { freq: 400, q: 1, vol: 0.06 }); }
export function yelp() { tone(600, 0, 0.18, { type: 'triangle', to: 1100, sweep: 0.1, vol: 0.14 }); }

// ---- the car ----
export function door() { tone(150, 0, 0.08, { to: 90, vol: 0.3 }); noise(0, 0.05, { freq: 900, vol: 0.2 }); }
export function horn() { say('car-horn', 0.5); }
export function crash() { say('car-crash', 0.7); }
// A sound file played round and round (loops are made with tools/sound_prep.py --loop), its volume and speed eased
// towards what is asked; started the first time it is asked for.
const loops = {};
// `soften`: a low-pass filter's cut-off (Hz), to take the hiss off a rough recording.
function loopAt(k, vol, rate, soften) {
  if (!ac || !voice[k]) return;
  let l = loops[k];
  if (!l) {
    l = loops[k] = { src: ac.createBufferSource(), g: ac.createGain() };
    l.src.buffer = voice[k]; l.src.loop = true; l.g.gain.value = 0;
    let out = l.src;
    if (soften) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = soften; f.Q.value = 0.5; out.connect(f); out = f; }
    out.connect(l.g); l.g.connect(sfx); l.src.start();
  }
  l.g.gain.setTargetAtTime(vol, ac.currentTime, 0.2);
  l.src.playbackRate.setTargetAtTime(rate, ac.currentTime, 0.2);
}
// The engine while she is driving: level 0..1 is how fast the car is going. It runs faster and a little louder with speed.
export function engine(level, on) { loopAt('car-engine', on ? 0.25 + level * 0.15 : 0, 0.8 + level * 0.7); }
// Her panting while she runs flat out: level 0..1 is how out of breath she is.
export function panting(level) { loopAt('panting', level * 0.13, 1.05 + level * 0.2, 1800); }   // softened: raw, it rasped like sandpaper

// ---- jobs: said out loud, and the sounds of getting on with them ----
// A job is said by the browser's own voice (speechSynthesis): the children this is for are only starting to read. Until
// the first touch or key nothing may sound, so what was to be said waits for it. Recordings can replace this later:
// the words are all in the job files.
let touched = false, waiting = null, talker;
function pickVoice() {
  const all = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  return all.find((v) => /female|samantha|karen|moira|tessa|serena|zira|libby|sonia|google uk english female/i.test(v.name)) || all.find((v) => v.default) || all[0] || null;
}
export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text || muted) return;
  if (!touched) { waiting = text; return; }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    talker ||= pickVoice(); if (talker) u.voice = talker;
    u.lang = talker ? talker.lang : 'en-GB'; u.rate = 0.92; u.pitch = 1.25; u.volume = 1;
    synth.speak(u);
  } catch {}
}
export function fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, i === 3 ? 0.5 : 0.16, { type: 'triangle', vol: 0.16, attack: 0.01 })); tone(1319, 0.44, 0.45, { type: 'sine', vol: 0.08, attack: 0.02 }); }
export function chime() { tone(880, 0, 0.12, { type: 'sine', vol: 0.14 }); tone(1320, 0.08, 0.22, { type: 'sine', vol: 0.12 }); }
export function ding() { tone(660, 0, 0.1, { type: 'triangle', vol: 0.13 }); tone(990, 0.07, 0.18, { type: 'triangle', vol: 0.11 }); }
export function dig() { noise(0, 0.11, { type: 'bandpass', freq: 700, to: 320, q: 0.8, vol: 0.16 }); }
export function oops() { tone(392, 0, 0.18, { type: 'triangle', to: 330, vol: 0.13 }); tone(294, 0.16, 0.3, { type: 'triangle', to: 247, vol: 0.12 }); }
export function pageTurn() { noise(0, 0.14, { type: 'highpass', freq: 1800, to: 3200, vol: 0.07 }); }

