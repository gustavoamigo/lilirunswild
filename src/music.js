// Background music: a bouncy little tune for walking round town, played by synthesised instruments (no file), like
// every other sound but the recorded ones. 32 bars at 108 beats a minute (about 70 s), round and round: A A' B A.
// A toy marimba carries the tune, a soft plucked chord answers on the off-beats, a round bass walks on the beat, and a
// shaker keeps the eighths. It sits well under the effects and dips further while a line is being said (duck).
//
// The score is written in eighth notes, one bar a string: a note name per eighth, "-" holds the one before, "." rests.

const BPM = 108, E8 = 60 / BPM / 2;                     // an eighth note, in seconds
const LOUD = 0.2, DUCKED = 0.35;                         // the music's level, and how much of it is left under a line

const A = [
  'E5 - G5 - E5 D5 C5 -', 'A4 - C5 - E5 - - -', 'F5 - A5 - G5 F5 E5 -', 'D5 - - - G4 - - -',
  'E5 - G5 - C6 - B5 A5', 'G5 - E5 - C5 - D5 E5', 'F5 - E5 - D5 - B4 -', 'C5 - - - - - . .',
];
const A2 = [...A.slice(0, 7), 'C5 - G4 - C5 - . .'];
const B = [
  'A5 - - G5 F5 - E5 -', 'D5 - - E5 F5 - G5 -', 'E5 - - D5 C5 - B4 -', 'A4 - - - C5 - E5 -',
  'F5 - F5 - A5 - G5 F5', 'D5 - G5 - - - F5 -', 'E5 - - - G5 - C6 -', 'B5 - - - D5 - . .',
];
const TUNE = [...A, ...A2, ...B, ...A];
// a chord a bar (two in a bar where written "Dm G"), as the notes of the chord in the middle of the keyboard
const CA = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm G', 'C'], CB = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G'];
const CHORDS = [...CA, ...CA, ...CB, ...CA];
const NOTES = { C: ['C4', 'E4', 'G4'], Am: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'], G: ['G3', 'B3', 'D4'], Dm: ['D4', 'F4', 'A4'], Em: ['E3', 'G3', 'B3'] };

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (n) => 440 * 2 ** ((SEMI[n[0]] + 12 * (Number(n.slice(-1)) + 1) - 69) / 12);
// the tune as notes: { at, len, f } in eighths from the start of the 32 bars
const MELODY = (() => {
  const out = [];
  TUNE.forEach((bar, b) => bar.split(' ').forEach((tok, i) => {
    const at = b * 8 + i;
    if (tok === '-') { if (out.length) out[out.length - 1].len++; } else if (tok !== '.') out.push({ at, len: 1, f: hz(tok) });
  }));
  return out;
})();
const BARS = TUNE.length, STEPS = BARS * 8;
const chordAt = (step) => { const names = CHORDS[Math.floor(step / 8) % BARS].split(' '); return names[Math.min(names.length - 1, Math.floor((step % 8) / (8 / names.length)))]; };

// ---- the instruments: each schedules one note on any audio context (the game's, or an offline one in tests) ----
function voice(ctx, out, t, dur, parts, vol, attack = 0.006) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  for (const [type, f, k] of parts) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; og.gain.value = k;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }
}
const marimba = (ctx, out, t, f, len) => voice(ctx, out, t, Math.min(0.9, 0.35 + len * E8 * 0.5), [['sine', f, 1], ['sine', f * 4, 0.12], ['sine', f * 2, 0.18]], 0.5);
const pluck = (ctx, out, t, f) => voice(ctx, out, t, 0.22, [['triangle', f, 1], ['sine', f * 2, 0.3]], 0.09, 0.004);
const bass = (ctx, out, t, f) => voice(ctx, out, t, 0.42, [['sine', f, 1], ['triangle', f, 0.35]], 0.42, 0.01);
function shaker(ctx, out, t, noise, vol) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; f.type = 'highpass'; f.frequency.value = 6500;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random() * 0.4); src.stop(t + 0.07);
}
function noiseOf(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// everything that sounds on one eighth, at time t
function playStep(ctx, out, noise, step, t) {
  const s = step % STEPS, beat = s % 8, chord = NOTES[chordAt(s)];
  for (const n of MELODY) if (n.at === s) marimba(ctx, out, t, n.f, n.len);
  if (beat === 0 || beat === 4) bass(ctx, out, t, hz(chord[0]) / (beat === 0 ? 2 : 1) * (beat === 4 ? 0.75 : 1));
  if (beat % 2 === 1) for (const n of chord) pluck(ctx, out, t + 0.012 * chord.indexOf(n), hz(n));
  shaker(ctx, out, t, noise, beat % 2 ? 0.05 : 0.025);
}

// ---- playing it in the game ----
let ac = null, gain = null, noise = null, step = 0, next = 0, timer = null;
export function startMusic(ctx, dest) {
  if (timer || !ctx) return;
  ac = ctx; noise ||= noiseOf(ac);
  gain = ac.createGain(); gain.gain.value = 0.0001; gain.connect(dest);
  gain.gain.setTargetAtTime(LOUD, ac.currentTime + 0.1, 0.8);              // it fades in
  next = ac.currentTime + 0.15; step = 0;
  // a little ahead of time, so a slow frame does not make it stumble
  timer = setInterval(() => {
    if (ac.state !== 'running') return;
    if (next < ac.currentTime) next = ac.currentTime + 0.05;           // back from a hidden tab: carry on from now
    while (next < ac.currentTime + 0.25) { playStep(ac, gain, noise, step++, next); next += E8; }
  }, 50);
}
// a line is being said: the music dips for `secs`, then comes back
export function duck(secs) {
  if (!gain) return;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(LOUD * DUCKED, t, 0.06); gain.gain.setTargetAtTime(LOUD, t + secs, 0.4);
}

// For tests: the whole tune rendered offline, and how loud it is.
export async function renderMusic(secs = BARS * 8 * E8) {
  const ctx = new OfflineAudioContext(1, Math.ceil(secs * 44100), 44100), g = ctx.createGain(), nz = noiseOf(ctx);
  g.gain.value = LOUD; g.connect(ctx.destination);
  for (let i = 0, t = 0.05; t < secs; i++, t += E8) playStep(ctx, g, nz, i, t);
  return ctx.startRendering();
}
