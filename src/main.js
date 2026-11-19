// The game: one very busy cocker spaniel, a small town, and nothing he has to do.
// Everything here works on a flat map (x east, y south, z = height). scene.js draws it.
import * as S from './scene.js';
import * as A from './audio.js';
import * as Art from './art.js';
import { input, keyVector, steerMag, initInput } from './input.js';
import { pollPad } from './gamepad.js';
import { spawn, updateFx, drawFx, burst, confettiColor } from './fx.js';
import { loadTown, pushOut, floorAt, platDist, nearestOn, KINDS, BOUNDS } from './world.js';
import { CAR, PERSON_LOOKS, isChild, personVoice } from './models.js';
import { loadMissions, makeRunner } from './missions.js';
import { clamp, lerp, dist, easeInOut, easeOut, TAU } from './util.js';

const DOG_R = 30, GRAV = 1900, JUMP_V = 430, JUMP_UP = 560;
const AIM_FAR = 260, AIM_SPEED = 540;   // jumping at something to get up onto: from how far, and how fast she may fly to it
// a spaniel's trot and flat-out run for her size (84 game units to the metre: 2.5 and 5.5 m/s); flat out is the simulated gallop's own speed
const TROT = 210, ZOOM = 460, ZOOM_AFTER = 0.9;      // run flat out for this long and he gets the zoomies
// the about-turn's slide takes a third of a second from flat out, down to SKID_END, whatever her top speed
const SWIM = 0.5, SHAKE_WALK = 0.35;                 // swimming, she goes at half her trot; shaking herself dry, a slow walk
const BRAKE = ZOOM * 2.3, SKID_END = ZOOM * 0.23;
const BONK = ZOOM * 0.73;                                    // faster than this into something solid and he sees stars
const CAR_TOP = 900;

// the town and the jobs are loaded side by side (the jobs used to wait for the town)
const [world, jobs] = await Promise.all([loadTown(), location.search.includes('studio') ? [] : loadMissions()]);
const params = new URLSearchParams(location.search);
// ?studio: an empty floor and a close camera, for working on how he moves (see the end of this file)
const STUDIO = params.has('studio');
// ?zoom=4: the camera that much further back (for looking over the map)
const VIEW_ZOOM = Number(params.get('zoom')) || 1;
const studio = { gait: 'auto', point: false, speed: 1, paused: false, step: false };
if (STUDIO) {
  world.studio = true;
  for (const k of ['obstacles', 'props', 'people', 'flocks', 'trees', 'lamps', 'houses', 'flowers']) world[k].length = 0;
  world.platforms.length = 0; world.car.x = world.car.y = -9000;
  world.start = { x: 1800, y: 1500 };
  // ?studio&people: every look of person in a line, standing (facing the camera) and walking on the spot (side on);
  // R turns them all
  if (params.has('people')) {
    world.start = { x: 1450, y: 1500 };
    for (let i = 0; i < PERSON_LOOKS; i++) for (const walk of [false, true])
      world.people.push({ look: i, x: 1640 + i * 110, y: walk ? 1580 : 1400, heading: walk ? 0 : Math.PI / 2, state: walk ? 'walk' : 'stand', t: 0, cool: 0, seed: i, pace: walk ? 70 : 0 });
  }
}
const dog = {
  x: world.start.x, y: world.start.y, z: 0, vx: 0, vy: 0, vz: 0, heading: Math.PI / 2,   // out of her door, looking at the camera
  state: 'idle', stT: 0,            // idle (on his feet) | paws (up on someone) | daze | hop (in or out of the car) | drive
  air: false, zoom: false, runT: 0, footfall: false, stepAt: 0, gait: 0, skid: false, sweepT: 9, ptrX: 0, ptrY: 0, push: false, shake: 0, fidgetAt: 0,
  lookYaw: 0, lookPitch: 0, seen: null, thought: 0, point: 0,
  barkT: 0, landT: 0, spring: 0, bow: 0, idleT: 0, happy: 0, excited: 0, puff: 0, hop: null, carV: 0, carSteer: 0, dustT: 0,
};
const car = { ...world.car, v: 0, steer: 0, bump: 0, on: false, rev: false, skidT: 0 };
// jobs: one at a time, on a card at the top of the screen (see "jobs" below)
const missions = makeRunner(jobs, world, {
  start: (m) => jobStarted(m),
  step: (m, s) => stepStarted(m, s),
  progress: () => { ui.pip = 1; A.ding(); },
  oops: () => { ui.oops = 1; A.oops(); A.speak(SAY.oops); },
  done: (m, first, levels) => jobDone(m, first, levels),
});
const ui = { card: null, cele: null, banner: null, askT: 0, lostT: 0, book: false, helpT: 0, sayT: 0, pip: 0, oops: 0, bonePop: 0, fly: [], saidAll: false, tidyT: 0, saveT: 10, rect: null, boneAt: [0, 0] };
const G = { t: 0, mess: 0, birds: 0, bones: 0, pop: 0, ui, missions, dog, car, world, props: world.props, people: world.people, flocks: world.flocks, debris: [], focus: { x: dog.x, y: dog.y, vx: 0, vy: 0, zoom: 1 }, input };
window.__G = G;
for (const o of world.people) o.who = isChild(o.look) ? 'child' : 'adult';

const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const ZERO = { x: 0, y: 0, mag: 0 };
const onFoot = () => dog.state !== 'drive' && dog.state !== 'hop';

// ---------------------------------------------------------------- steering --
// Keys or a stick give a direction. A finger gives a place: hold it down and he keeps coming.
function steering(px, py, arrive) {
  const [kx, ky] = keyVector();
  if (kx || ky) { input.target = null; input.tapPending = false; return { x: kx, y: ky, mag: steerMag() }; }
  if (input.pointerDown || input.tapPending) {
    const g = S.screenToGround(input.sx, input.sy);
    if (g) input.target = { x: clamp(g.x, BOUNDS.x0, BOUNDS.x1), y: clamp(g.y, BOUNDS.y0, BOUNDS.y1) };
    input.tapPending = false;
  }
  if (!input.target) return ZERO;
  const dx = input.target.x - px, dy = input.target.y - py, d = Math.hypot(dx, dy);
  if (d < arrive) { if (!input.pointerDown) input.target = null; return ZERO; }
  return { x: dx / d, y: dy / d, mag: clamp(d / 200, 0.3, 1) };
}

// ------------------------------------------------------------------ puffs --
function dust(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (o.speed || 60) * (0.4 + Math.random());
    spawn({ x: x + Math.cos(a) * 8, z: y + Math.sin(a) * 8, y: 4, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 20 + Math.random() * 40, drag: 3,
      life: 0.4 + Math.random() * 0.3, size: o.size || 9, grow: 26, color: o.color || '#F3EAD3', alpha: 0.7 });
  }
}
function stars(x, y, h, n = 6) { burst(x, h, y, n, { speed: 170 }); }
function hearts(x, y, h, n = 5) {
  for (let i = 0; i < n; i++) spawn({ type: 'heart', x: x + (Math.random() - 0.5) * 50, z: y + (Math.random() - 0.5) * 30, y: h + Math.random() * 30, vy: 70 + Math.random() * 50, life: 1 + Math.random() * 0.5, delay: i * 0.12, size: 9 + Math.random() * 5, color: '#FF7FA0' });
}
function leaves(t) {
  for (let i = 0; i < 12; i++) spawn({ type: 'leaf', x: t.x + (Math.random() - 0.5) * 190 * t.s, z: t.y + (Math.random() - 0.5) * 120 * t.s, y: (150 + Math.random() * 110) * t.s, vx: (Math.random() - 0.5) * 60, vy: -40, g: 130, drag: 1.2,
    life: 1.5 + Math.random(), delay: Math.random() * 0.3, size: 7 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, color: ['#57B56B', '#74CF82', '#9BE39C'][i % 3] });
}
function shake(o) { if (!o) return; o.wob = 1; if (o.tree) { o.tree.wob = 1; leaves(o.tree); } }

// -------------------------------------------------------------------- dog --
// spray thrown up from the water: a jump in the water, a leap into it
function spray(x, y, n, up) {
  for (let i = 0; i < n; i++) {                        // chunky drops, shrinking as they fall
    const a = Math.random() * TAU, s = 50 + Math.random() * 110;
    spawn({ type: 'drop', x, z: y, y: 20, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.5 + Math.random() * 0.6), g: 900, drag: 0.6, life: 0.7 + Math.random() * 0.3, size: 5 + Math.random() * 4, grow: -5, color: '#ffffff', alpha: 1 });
  }
  for (let i = 0; i < 5; i++) {                        // and a little mist at its foot
    const a = Math.random() * TAU;
    spawn({ type: 'mist', x: x + Math.cos(a) * 20, z: y + Math.sin(a) * 20, y: 12, vx: Math.cos(a) * 40, vz: Math.sin(a) * 40, vy: 20, drag: 2, life: 0.6, size: 14, grow: 16, color: '#ffffff', alpha: 0.6 });
  }
}
function land(fromHop) {
  dog.air = false; dog.vz = 0; dog.landT = 0.22;
  const aim = dog.aim; dog.aim = null;
  // a leap into the lake: a big splash, and a ring across the water
  if (!fromHop && dog.state !== 'drive' && world.surfaceAt(dog.x, dog.y) === 'water') { spray(dog.x, dog.y, 16, 440); dog.crown = 1; A.splash(); dog.splashed = 2.5; dog.swim = true; missions.event('splash', { x: dog.x, y: dog.y }); missions.event('swim', { x: dog.x, y: dog.y }); return; }
  dust(dog.x, dog.y, 6); A.land();
  const [, on] = floorAt(world, dog.x, dog.y, dog.z);
  if (on) { on.wob = Math.max(on.wob, 0.6); if (!fromHop) missions.event('hop', { kind: on.kind, id: on, x: dog.x, y: dog.y }); }
  // up on what she jumped at: she stops there for a moment (or she would run straight off the other side)
  if (aim && on === aim.o) { dog.vx *= 0.15; dog.vy *= 0.15; dog.stay = 0.6; dog.zoom = false; dog.runT = 0; input.target = null; }
  // landing on the car is as good as opening the door
  if (!fromHop && on === world.carPlat) enterCar();
}

function jump() {
  if (dog.state === 'drive') { leaveCar(); return; }
  if (dog.air || dog.spring > 0 || (dog.state !== 'idle' && dog.state !== 'paws')) return;
  // in the water the jump is a splash: she slaps the water, spray flies up, and she surges on a little
  if (dog.swim) {
    if (G.t - (dog.splashAt || -9) < 0.5) return;
    dog.splashAt = G.t; dog.splashed = 1.6; A.splash(); dog.barkT = 0.2;
    spray(dog.x + Math.cos(dog.heading) * 30, dog.y + Math.sin(dog.heading) * 30, 8, 270);
    dog.vx += Math.cos(dog.heading) * 120; dog.vy += Math.sin(dog.heading) * 120;
    return;
  }
  dog.state = 'idle'; dog.bow = 0;
  // A dog does not go up from where it stands. She takes a run at it: a few bounds from a standstill, a stride
  // if she is already running, and gathers herself over the last of it (updateDog, src/models.js).
  // From a stand she does it where she is: sinks, drives off her hind legs and goes (a captured move: src/moves.js).
  const sp = Math.hypot(dog.vx, dog.vy);
  dog.still = sp < 60;
  dog.spring = dog.still ? 0.34 : lerp(0.3, 0.12, clamp(sp / TROT, 0, 1));
  // A long, low leap, about two thirds of her own height. Only with something to get up onto in front of where
  // she will leave the ground (a bench, the table, the car) does she go for height.
  const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading), from = dog.still ? 0 : sp * dog.spring, far = from + Math.max(sp, 240) * 0.55;
  dog.high = false;
  for (let d = 30; d < far && !dog.high; d += 20) for (const o of [0, 22, -22]) dog.high ||= floorAt(world, dog.x + hx * d - hy * o, dog.y + hy * d + hx * o, 1e4)[0] > dog.z + 30;
  dog.aim = jumpAim();
  if (dog.aim) {
    dog.high = true;
    // too far for a jump from where she stands: a few bounds at it first
    if (dog.still && dist(dog.aim.x, dog.aim.y, dog.x, dog.y) > 150) { dog.still = false; dog.spring = 0.3; }
  }
}
// What she is jumping at: something to get up onto (the table, a bench, a market stall, the car) that is near and
// roughly in front of her; or right beside her and not behind; or right beside her wherever she looks, if she is
// standing (she turns to birds on her own when she stands, and a jump on the spot beside the table means the table).
// The jump then lands on it: she turns to it over the run-up and leaves the ground at the speed that brings her down
// on its middle (takeOff). Children of five aim roughly, and without this the table was very hard to get onto.
function jumpAim() {
  const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading), standing = Math.hypot(dog.vx, dog.vy) < 60;
  let best = null, least = 9;
  for (const o of world.platforms) {
    if (o.off || o.h <= dog.z + 30 || o.h > dog.z + JUMP_UP * JUMP_UP / (2 * GRAV) - 8) continue;
    // the part of it nearest to the way she is heading (a bench is long: she lands on the end she is running at)
    let c = nearestOn(o, dog.x, dog.y), near = 1e9;
    for (let d = 0; d <= AIM_FAR; d += 20) {
      const x = dog.x + hx * d, y = dog.y + hy * d, q = nearestOn(o, x, y), e = Math.hypot(q[0] - x, q[1] - y);
      if (e < near - 1) { near = e; c = q; }
    }
    const D = Math.hypot(c[0] - dog.x, c[1] - dog.y), off = Math.abs(angDiff(Math.atan2(c[1] - dog.y, c[0] - dog.x), dog.heading));
    if (D > AIM_FAR || off > (D < o.r + DOG_R + 50 ? (standing ? 4 : 1.6) : 0.9)) continue;
    if (off + D / 300 < least) { least = off + D / 300; best = { o, x: c[0], y: c[1] }; }
  }
  return best;
}
function takeOff() {
  let sp = Math.max(Math.hypot(dog.vx, dog.vy), 240);
  dog.vz = dog.high ? JUMP_UP : JUMP_V;
  const a = dog.aim;
  if (a) {                                             // straight at what she is jumping at, to come down on it
    const down = (dog.vz + Math.sqrt(Math.max(0, dog.vz * dog.vz - 2 * GRAV * (a.o.h - dog.z)))) / GRAV;
    dog.heading = Math.atan2(a.y - dog.y, a.x - dog.x); sp = Math.min(dist(a.x, a.y, dog.x, dog.y) / down, AIM_SPEED);
  }
  dog.vx = Math.cos(dog.heading) * sp; dog.vy = Math.sin(dog.heading) * sp;
  dog.air = true; dog.flight = 2 * dog.vz / GRAV;
  A.jump(); dust(dog.x, dog.y, 4); missions.event('jump', { x: dog.x, y: dog.y });
}

function bark() {
  if (dog.state === 'daze' || dog.state === 'hop') return;
  const driving = dog.state === 'drive';
  dog.barkT = 0.26; dog.bow = 0; dog.idleT = 0;
  if (dog.carry) drop();                              // she opens her mouth to bark: whatever she carries falls
  if (driving) A.horn(); else A.bark();
  missions.event(driving ? 'honk' : 'bark', { x: dog.x, y: dog.y });
  const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading);
  for (let i = 0; i < 3; i++) spawn({ type: 'ring', x: dog.x + hx * 70, z: dog.y + hy * 70, y: dog.z + 70, vx: hx * 260, vz: hy * 260, drag: 2, life: 0.45, delay: i * 0.07, size: 10, grow: 90, color: '#ffffff', alpha: 0.9 });
  for (const f of world.flocks) if (f.state === 'ground' && dist(f.x, f.y, dog.x, dog.y) < (driving ? 650 : 520)) flyAway(f);
  // a bark close by frightens; never wins love
  for (const o of world.people) if (dist(o.x, o.y, dog.x, dog.y) < 400 && o.cool <= 0 && (o.state === 'walk' || o.state === 'stand')) respond(o, reaction(o, 'bark', false));
}

function updateDog(dt) {
  const p = dog;
  p.barkT = Math.max(0, p.barkT - dt); p.landT = Math.max(0, p.landT - dt); p.thought = Math.max(0, p.thought - dt);
  p.happy = Math.max(0, p.happy - dt); p.excited = Math.max(0, p.excited - dt);
  // out of breath: built up over about 3 s of zoomies, gone over about 8 s once she slows down. She breathes hard only
  // while she is flat out, heavier the longer it lasts, and stops when she stops running.
  p.puff = p.zoom && !p.air ? Math.min(1, p.puff + dt / 3) : Math.max(0, p.puff - dt / 8);
  A.panting(onFoot() && p.zoom && !p.air ? 0.5 + 0.5 * p.puff : 0); p.bow = Math.max(0, p.bow - dt); p.shake = Math.max(0, p.shake - dt);
  if (p.state === 'hop') { updateHop(dt); return; }
  if (p.state === 'drive') return;                    // the car carries him (updateCar)
  if (p.state !== 'idle') { p.stT -= dt; if (p.stT <= 0) { if (p.state === 'paws') p.happy = 2; else if (p.state === 'daze') p.shake = 1.4; p.state = 'idle'; } }

  p.stay = Math.max(0, (p.stay || 0) - dt);
  let st = p.state === 'idle' && !(p.poo > 0) && !(p.stay > 0) ? steering(p.x, p.y, 34) : ZERO;
  const sp0 = Math.hypot(p.vx, p.vy);
  // A pointer that sits near her means "come here, slowly". One that is being swept past her on its way to the
  // other side is near her too, for a moment, and means nothing of the kind: while it is moving and she is
  // galloping she keeps going flat out, so the reversal finds her at full speed and she has to brake.
  p.sweepT = input.pointerDown && Math.hypot(input.sx - p.ptrX, input.sy - p.ptrY) > 350 * dt ? 0 : p.sweepT + dt;
  p.ptrX = input.sx; p.ptrY = input.sy;
  if (p.zoom && input.pointerDown && p.sweepT < 0.3 && sp0 > 1) st = st.mag ? { x: st.x, y: st.y, mag: 1 } : { x: p.vx / sp0, y: p.vy / sp0, mag: 1 };
  if (p.spring > 0) {                                  // the run-up to a jump: straight on, as fast as she can, whatever the pointer says
    if (p.state !== 'idle' || p.air) { p.spring = 0; p.aim = null; }
    else {
      p.spring -= dt; p.skid = p.push = false;
      st = p.still ? ZERO : st.mag ? { x: st.x, y: st.y, mag: 1 } : { x: Math.cos(p.heading), y: Math.sin(p.heading), mag: 1 };
      if (p.aim) {                                     // jumping at something: she turns to it, and goes up once she is at its foot
        const ax = p.aim.x - p.x, ay = p.aim.y - p.y, D = Math.hypot(ax, ay) || 1;
        if (p.still) p.heading += angDiff(Math.atan2(ay, ax), p.heading) * (1 - Math.exp(-dt * 16));
        else { st = { x: ax / D, y: ay / D, mag: 1 }; if (D < p.aim.o.r + DOG_R + 16) p.spring = 0; }
      }
      if (p.spring <= 0) takeOff();
    }
  }
  if (p.air && p.aim) st = ZERO;                       // on her way to what she jumped at: nothing turns her
  watchBirds(st, dt);
  if ((st.mag && !(p.shakeWet > 0)) || p.air) p.shake = 0;          // shaking the lake off goes on as she walks

  // ---- zoomies: keep running flat out and he tips over into a mad gallop ----
  if (st.mag > 0.85 && sp0 > TROT * 0.6) p.runT += dt; else p.runT = 0;
  const chase = p.seen && st.mag > 0.5 && st.x * Math.cos(p.birdDir) + st.y * Math.sin(p.birdDir) > 0.75;
  if (chase) p.runT = Math.max(p.runT, ZOOM_AFTER);
  if (studio.gait === 'trot') p.runT = 0; else if (studio.gait === 'gallop' && st.mag > 0.5 && !p.push) p.runT = ZOOM_AFTER;
  // ---- in the lake she swims: slowly, low in the water, splashing; out of it she shakes herself dry when she stops ----
  const wet = !STUDIO && onFoot() && !p.air && world.surfaceAt(p.x, p.y) === 'water';
  // (!!: at the start swim is unset, which once counted as climbing out of the lake, and she shook)
  if (wet !== !!p.swim) { dust(p.x, p.y, 10, { speed: 120, color: '#E6F6FC', size: 7 }); if (wet) { A.splash(); missions.event('swim', { x: p.x, y: p.y }); } else { p.shake = 1.4; p.shakeWet = 1.4; p.drip = false; missions.event('shake', { x: p.x, y: p.y }); } }
  p.swim = wet;
  if (wet) { p.runT = 0; p.dripT = (p.dripT || 0) - dt; if (p.dripT <= 0 && sp0 > 30) { p.dripT = 0.18; dust(p.x + Math.cos(p.heading) * 30, p.y + Math.sin(p.heading) * 30, 2, { speed: 50, color: '#E6F6FC', size: 6 }); } }
  // out of the lake she shakes at once, and water flies off her sideways, more as the shake gets going
  if (p.shakeWet > 0) {
    p.shakeWet -= dt; p.shake = Math.max(p.shake, 0.05); p.runT = 0;
    const v = Math.hypot(p.vx, p.vy), most = TROT * SHAKE_WALK;      // and she only walks while she does it
    if (v > most) { p.vx *= most / v; p.vy *= most / v; }
    // spray flung off her coat in bursts, to one side and then the other with the shake's swing
    const k = 1.4 - p.shakeWet, swing = Math.sin(k * 30), side = swing > 0 ? 1 : -1;
    if (k > 0.2 && Math.abs(swing) > 0.7) for (let i = 0; i < 3; i++) {
      const a = p.heading + side * Math.PI / 2 + (Math.random() - 0.5) * 0.9, along = (Math.random() - 0.5) * 50, s = 140 + Math.random() * 100;
      spawn({ type: 'mist', x: p.x + Math.cos(p.heading) * along, z: p.y + Math.sin(p.heading) * along, y: 35 + Math.random() * 15, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 40 + Math.random() * 60, g: 200, drag: 3, life: 0.5, size: 9, grow: 34, color: '#ffffff', alpha: 0.9 });
    }
  }
  const was = p.zoom; p.zoom = p.runT >= ZOOM_AFTER && p.state === 'idle';
  if (p.zoom && !was) { A.whoosh(); dust(p.x, p.y, 8, { speed: 110 }); missions.event('zoom', { x: p.x, y: p.y }); }

  // ---- about-turn at a gallop: she cannot curve round, so she throws out the brakes and slides until she is
  // slow enough to get her feet back, steps round the way she turns at a trot, and pushes off into the gallop ----
  if (!p.skid && p.zoom && !p.air && sp0 > ZOOM * 0.52 && st.mag > 0.25 && (p.vx * st.x + p.vy * st.y) / sp0 < -0.4) { p.skid = true; A.skid(); }
  if (p.skid) {
    const back = st.mag > 0.25 && (sp0 < 60 || p.vx * st.x + p.vy * st.y < sp0 * 0.3);
    if (p.air || p.state !== 'idle' || !back) p.skid = false;
    else {
      const slow = Math.max(0, sp0 - BRAKE * dt), f = sp0 > 0 ? slow / sp0 : 0;
      p.vx *= f; p.vy *= f; p.runT = ZOOM_AFTER;
      p.dustT -= dt; if (p.dustT <= 0) { p.dustT = 0.035; dust(p.x + Math.cos(p.heading) * 30, p.y + Math.sin(p.heading) * 30, 2, { speed: 90 }); }
      if (slow < SKID_END) { p.skid = false; p.push = true; }
    }
  }
  if (p.push) {
    const want = Math.atan2(st.y, st.x);
    if (p.air || p.state !== 'idle' || st.mag < 0.25) p.push = false;
    else if (Math.abs(angDiff(want, p.heading)) < 0.45) {                          // round: off she goes
      p.push = false;
      if (st.mag > 0.85) { p.runT = ZOOM_AFTER; p.zoom = true; p.vx = Math.cos(want) * ZOOM * 0.52; p.vy = Math.sin(want) * ZOOM * 0.52; dust(p.x, p.y, 6, { speed: 120 }); A.whoosh(); }
    } else { p.runT = 0; p.zoom = false; }
  }

  // ---- turning: the body comes round at its own pace, towards where she wants to go ----
  let off = 0;
  if (st.mag && p.state === 'idle' && !p.skid) {
    off = angDiff(Math.atan2(st.y, st.x), p.heading);
    const most = (p.air ? 4 : p.zoom ? 5.5 : 8.5) * dt;
    p.heading += clamp(off * (1 - Math.exp(-dt * 14)), -most, most);
  }
  if (p.skid) { /* sliding: the brakes have her */ }
  else if (!p.air) {
    // She runs the way she is pointing, so a change of direction is a curve: at a trot a tight one
    // (she slows right down to turn about), at full gallop a wide skid, because she has no brakes.
    const top = (p.zoom ? ZOOM : TROT) * st.mag * (p.zoom ? 1 : clamp(Math.cos(off), 0.1, 1)) * (p.swim ? SWIM : 1), k = 1 - Math.exp(-dt * (p.state !== 'idle' ? 12 : p.zoom ? 4.5 : 9));
    p.vx = lerp(p.vx, Math.cos(p.heading) * top, k); p.vy = lerp(p.vy, Math.sin(p.heading) * top, k);
    if (p.zoom && sp0 > ZOOM * 0.6) {
      p.dustT -= dt;
      const slide = (p.vx * st.x + p.vy * st.y) / sp0 < 0.55;
      if (p.dustT <= 0) { p.dustT = slide ? 0.04 : 0.1; dust(p.x - (p.vx / sp0) * 20, p.y - (p.vy / sp0) * 20, slide ? 2 : 1); if (slide && Math.random() < 0.3) A.skid(); }
    }
  }
  else if (st.mag) {
    // in the air he can still lean where he wants to go: enough to hop up onto a bench from a standstill
    const top = Math.max(sp0, TROT * 0.75) * st.mag, k = 1 - Math.exp(-dt * 6);
    p.vx = lerp(p.vx, st.x * top, k); p.vy = lerp(p.vy, st.y * top, k);
  }
  const sp = Math.hypot(p.vx, p.vy);
  p.x += p.vx * dt; p.y += p.vy * dt;

  // ---- up and down ----
  if (p.air) {
    p.vz -= GRAV * dt; p.z += p.vz * dt;
    const [fl] = floorAt(world, p.x, p.y, p.z);
    p.clear = p.z - fl; p.eta = (p.vz + Math.sqrt(p.vz * p.vz + 2 * GRAV * Math.max(p.clear, 0))) / GRAV;   // how long until she is down
    if (p.vz <= 0 && p.z <= fl) { p.z = fl; land(false); if (p.state === 'drive') return; }
  } else {
    const [fl] = floorAt(world, p.x, p.y, p.z);
    if (fl < p.z - 1) { p.air = true; p.vz = 0; p.flight = 0; p.high = false; p.eta = Math.sqrt(2 * (p.z - fl) / GRAV); } else p.z = fl;      // ran off the edge of something
    // the model says when a paw comes down (src/models.js)
    if (p.footfall && sp > 60 && G.t - p.stepAt > 0.1) { p.stepAt = G.t; A.step(); }
    p.footfall = false;
  }

  // ---- bumping into solid things ----
  const hit = pushOut(world, p, DOG_R, p.air && !!p.aim);   // (a jump aimed at something is not stopped by its side on the way up)
  if (hit) {
    const into = -(p.vx * hit.nx + p.vy * hit.ny);
    if (into > BONK && hit.o && p.state === 'idle') {
      p.vx = hit.nx * 170; p.vy = hit.ny * 170; p.state = 'daze'; p.stT = 0.75; p.runT = 0; p.zoom = false;
      A.bonk(); stars(p.x - hit.nx * 20, p.y - hit.ny * 20, p.z + 70, 7); shake(hit.o);
    } else if (into > 0) { p.vx += hit.nx * into; p.vy += hit.ny * into; }
  }

  // ---- a mission wants a poo here, and she has stopped: she squats and does one ----
  const still = p.state === 'idle' && !st.mag && !p.air && Math.hypot(p.vx, p.vy) < 20;
  if (still && !(p.poo > 0) && missions.wants('poo') && missions.near(p.x, p.y) && onIt(missions.wants('poo').target)) { p.pooT = (p.pooT || 0) + dt; if (p.pooT > 0.8) { p.poo = POO_T; p.pooT = 0; } }
  else p.pooT = 0;
  if (p.poo > 0 && (p.poo -= dt) <= 0) {
    G.debris.push({ kind: 'poo', x: p.x - Math.cos(p.heading) * 30, y: p.y - Math.sin(p.heading) * 30, z: p.z, dir: Math.random() * TAU });
    A.plop(); missions.event('poo', { x: p.x, y: p.y });
  }
  // ---- carrying something to where a mission wants it: she drops it there once she stands still ----
  if (still && p.carry && missions.wants('bring')?.target === p.carry.kind && missions.near(p.x, p.y)) { p.dropT = (p.dropT || 0) + dt; if (p.dropT > 0.6) drop(); }
  else p.dropT = 0;

  // ---- nothing to do? Now and then she asks for a game (a play bow), and once in a long while has a shake. A bow or a
  // shake every 4.5 s in turn was far too often: she seemed to do nothing else. ----
  if (p.state === 'idle' && !st.mag && !p.air && !p.point && !p.happy && !(p.poo > 0)) {
    p.idleT += dt;
    if (p.idleT > (p.fidgetAt ||= FIDGET_MIN + Math.random() * FIDGET_MORE)) { p.idleT = 0; p.fidgetAt = 0; if (Math.random() < SHAKE_ODDS) p.shake = 1.4; else p.bow = 1.3; }
  } else p.idleT = 0;
}

// Birds. He cannot not look at them.
const POINT_FOR = 3.5, POINT_EVERY = 16;
function watchBirds(st, dt) {
  const p = dog;
  let best = null, bd = 760;
  for (const f of world.flocks) { const d = dist(f.x, f.y, p.x, p.y); if (d < bd && f.h < 420) { bd = d; best = f; } }
  let yaw = 0, pitch = 0; p.point = 0;
  // swimming, or shaking the lake off, she has no eyes for birds: no look, no yip, no bubble
  if (best && p.state !== 'daze' && p.state !== 'paws' && !p.swim && !(p.shakeWet > 0)) {
    p.birdDir = Math.atan2(best.y - p.y, best.x - p.x);
    // (at a run he only glances: he still has to see where he is going)
    const most = Math.hypot(p.vx, p.vy) > TROT * 0.5 ? 0.6 : 1.3;
    yaw = clamp(angDiff(p.birdDir, p.heading), -most, most); pitch = clamp(best.h / 300, 0, 1) * 0.5;
    if (p.seen !== best) { p.seen = best; p.pointT = 0; if (best.state === 'ground' && G.t - (p.yipAt || -9) > 5) { p.yipAt = G.t; p.thought = 1.8; A.yip(); } }
    if (p.state === 'idle' && !st.mag && !p.air && best.state === 'ground' && !p.bow && !p.shake && !p.happy) {
      // frozen, one paw up, all of him aimed at the bird: for a few seconds, then she relaxes (wags, bows, shakes) and
      // points again a while later, or at once at another flock. Pointing for as long as birds were in sight, she stood
      // stiff in town and never wagged or asked for a game.
      p.pointT = (p.pointT || 0) + dt;
      if (p.pointT > POINT_EVERY) p.pointT = 0;
      if (p.pointT < POINT_FOR) { p.point = 1; p.heading += angDiff(p.birdDir, p.heading) * (1 - Math.exp(-dt * 4)); }
    }
  } else if (!best) p.seen = null;
  if (studio.point && p.state === 'idle' && !st.mag && !p.air && !p.bow) p.point = 1;
  const k = 1 - Math.exp(-dt * 10);
  p.lookYaw = lerp(p.lookYaw, yaw, k); p.lookPitch = lerp(p.lookPitch, pitch, k);
}

// ------------------------------------------------------- in and out of the car --
const seat = () => ({ x: car.x + Math.cos(car.heading) * CAR.seatX, y: car.y + Math.sin(car.heading) * CAR.seatX, z: CAR.seatY });
const nearCar = () => !STUDIO && onFoot() && platDist(world.carPlat, dog.x, dog.y) < 230;

function hopTo(to, T, then) {
  dog.hop = { x0: dog.x, y0: dog.y, z0: dog.z, to, t: 0, T, then };
  dog.state = 'hop'; dog.air = true; dog.vx = dog.vy = 0; dog.vz = 1; dog.zoom = false; dog.runT = 0;
  input.target = null; A.jump();
}
function updateHop(dt) {
  const p = dog, h = p.hop; h.t += dt;
  const k = clamp(h.t / h.T, 0, 1), to = typeof h.to === 'function' ? h.to() : h.to;
  p.x = lerp(h.x0, to.x, k); p.y = lerp(h.y0, to.y, k); p.z = lerp(h.z0, to.z, k) + Math.sin(k * Math.PI) * 70;
  p.vz = k < 0.5 ? 300 : -300;
  if (k < 0.8 && dist(h.x0, h.y0, to.x, to.y) > 5) p.heading += angDiff(Math.atan2(to.y - h.y0, to.x - h.x0), p.heading) * (1 - Math.exp(-dt * 12));
  if (k >= 1) { p.hop = null; p.state = 'idle'; land(true); h.then?.(); }
}
// What she carries in her mouth: kept there every frame, and dropped (it falls, then lies there) when she reaches where
// a mission wants it, or barks.
// is she up on the thing a job names (a poo on the table is on it, not beside it)? True if it is not a thing to be on.
const onIt = (kind) => !world.platforms.some((o) => o.kind === kind) || floorAt(world, dog.x, dog.y, dog.z)[1]?.kind === kind;
const MOUTH = 86, MOUTH_UP = 22, POO_T = 1.6;
// the tug of war: where it starts (0 they win, 1 she does), how much each tap pulls, how fast they pull back (a second)
const TUG_START = 0.4, TUG_YANK = 0.085, TUG_BACK = 0.09;
const FIDGET_MIN = 12, FIDGET_MORE = 10, SHAKE_ODDS = 0.15;   // standing about: a bow after 12 to 22 s, now and then a shake instead
// What she carries hangs from her mouth and swings, as her ears do: a pendulum (SWING_L long) hung from the front of
// her mouth, pushed by the mouth's own speeding up, slowing down and turning, and jiggled by her stride. o.swingF is its
// swing forward (+) and back, o.swingS to her left (+) and right; src/scene.js hangs it from her real mouth with them.
const SWING_L = 40, SWING_C = 4.5, SWING_MAX = 1.0;
function carryAt(dt) {
  const o = dog.carry; if (!o) return;
  const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading), x = dog.x + hx * MOUTH, y = dog.y + hy * MOUTH;
  if (dt > 0 && o.px !== undefined) {
    const vx = (x - o.px) / dt, vy = (y - o.py) / dt, ax = clamp((vx - o.pvx) / dt, -5000, 5000), ay = clamp((vy - o.pvy) / dt, -5000, 5000);
    const fwd = ax * hx + ay * hy, side = -ax * hy + ay * hx, run = clamp(Math.hypot(dog.vx, dog.vy) / TROT, 0, 1.5), k = GRAV / SWING_L;
    o.wF += (-k * Math.sin(o.swingF) - SWING_C * o.wF - fwd / SWING_L + Math.sin(G.t * 13) * 14 * run) * dt;
    o.wS += (-k * Math.sin(o.swingS) - SWING_C * o.wS + side / SWING_L + Math.sin(G.t * 6.5) * 5 * run) * dt;
    o.swingF = clamp(o.swingF + o.wF * dt, -SWING_MAX, SWING_MAX); o.swingS = clamp(o.swingS + o.wS * dt, -SWING_MAX, SWING_MAX);
    o.pvx = vx; o.pvy = vy;
  } else { o.swingF = o.swingS = o.wF = o.wS = o.pvx = o.pvy = 0; }
  o.px = x; o.py = y;
  o.x = x; o.y = y; o.z = dog.z + MOUTH_UP; o.dir = dog.heading;
}
function drop() {
  const o = dog.carry; dog.carry = null; o.carried = false; o.px = undefined; o.rest = false; o.vx = o.vy = o.vz = 0; o.cool = 0.5;
  if (dist(o.x, o.y, basket.x, basket.y) < BASKET_R) intoBasket(o);
  missions.event('bring', { kind: o.kind, x: dog.x, y: dog.y });
}
// Her basket at home, by the kennel: what she puts down near it goes in, and stays there (it is not tidied away or given
// back) until she takes it out again by running at it, or a job needs it back with its owner.
const BASKET_R = 110, basket = world.tiles.flatMap((t) => t.things.fixtures).find((f) => f.kind === 'basket');
const IN_BASKET = [[-7, -5], [8, 4], [-3, 9], [6, -9], [0, 0]];
function intoBasket(o) {
  const n = world.props.filter((q) => q.kept).length, [ox, oy] = IN_BASKET[n % IN_BASKET.length];
  Object.assign(o, { x: basket.x + ox, y: basket.y + oy, z: 6, vx: 0, vy: 0, vz: 0, rest: true, kept: true, tip: 0, roll: 0, dir: Math.random() * TAU });
  A.chime(); stars(basket.x, basket.y, 40, 6);
}
function enterCar() {
  dog.state = 'drive'; dog.air = false; dog.vx = dog.vy = dog.vz = 0; dog.zoom = false; dog.runT = 0; dog.point = 0;
  car.on = true; world.carPlat.off = true; input.target = null;
  A.door(); placeInCar();
}
function placeInCar() {
  const s = seat(); dog.x = s.x; dog.y = s.y; dog.z = s.z; dog.heading = car.heading;
  dog.carV = car.v; dog.carSteer = car.steer;
}
function leaveCar() {
  // out over the side, whichever side has room
  const nx = -Math.sin(car.heading), ny = Math.cos(car.heading);
  let to = null;
  for (const s of [1, -1]) { const x = dog.x + nx * 150 * s, y = dog.y + ny * 150 * s; if (world.freeSpot(x, y, 34)) { to = { x, y, z: 0 }; break; } }
  to ||= { x: clamp(dog.x + nx * 150, BOUNDS.x0 + 40, BOUNDS.x1 - 40), y: clamp(dog.y + ny * 150, BOUNDS.y0 + 40, BOUNDS.y1 - 40), z: 0 };
  car.on = false; world.carPlat.off = false; A.door();
  hopTo(to, 0.42);
}
function carAction() {
  if (dog.state === 'drive') leaveCar();
  else if (dog.state === 'idle' && !dog.air && nearCar()) hopTo(seat, 0.42, enterCar);
}

// -------------------------------------------------------------------- car --
function updateCar(dt) {
  const c = car;
  c.bump = Math.max(0, c.bump - dt * 2.5);
  const st = c.on ? steering(c.x, c.y, 140) : ZERO;
  let turn = 0;
  if (st.mag) {
    const want = Math.atan2(st.y, st.x), diff = angDiff(want, c.heading);
    // pointed the wrong way and standing still: back out, like a three-point turn
    if (!c.rev && Math.abs(diff) > 2.3 && Math.abs(c.v) < 140) c.rev = true;
    if (c.rev && Math.abs(diff) < 1.3) c.rev = false;
    const grip = clamp(Math.abs(c.v) / 200, 0, 1);
    let top;
    if (c.rev) { turn = clamp(angDiff(want, c.heading + Math.PI) * 4, -2.6, 2.6) * grip; top = -260; }
    else { turn = clamp(diff * 4, -2.6, 2.6) * grip; top = CAR_TOP * st.mag * (1 - 0.5 * Math.min(1, Math.abs(diff) / 1.5)); }
    const rate = (top > c.v) === (c.v >= 0) ? 700 : 1100;
    c.v += clamp(top - c.v, -rate * dt, rate * dt);
  } else { c.v -= clamp(c.v, -520 * dt, 520 * dt); c.rev = false; }
  c.heading += turn * dt;
  c.steer = lerp(c.steer, (c.rev ? -1 : 1) * turn / 2.6, 1 - Math.exp(-dt * 10));
  const hx = Math.cos(c.heading), hy = Math.sin(c.heading);
  c.x += hx * c.v * dt; c.y += hy * c.v * dt;

  // tyres squeal and smoke when he throws it round a corner
  c.skidT -= dt;
  if (Math.abs(turn) > 1.7 && Math.abs(c.v) > 380 && c.skidT <= 0) {
    c.skidT = 0.06; if (Math.random() < 0.35) A.skid();
    for (const s of [1, -1]) dust(c.x - hx * 100 - hy * 68 * s, c.y - hy * 100 + hx * 68 * s, 1, { size: 12 });
  }

  // ---- the car is two circles, nose and tail, kept out of anything solid ----
  if (Math.abs(c.v) > 1) {
    const off = world.carPlat.off; world.carPlat.off = true;
    for (const s of [1, -1]) {
      const q = { x: c.x + hx * CAR.half * s, y: c.y + hy * CAR.half * s, z: 0 }, x0 = q.x, y0 = q.y;
      let hit = pushOut(world, q, CAR.r);
      // the lake: the car stops at the water's edge, as at a wall
      if (!hit && world.surfaceAt(q.x + hx * CAR.r * s, q.y + hy * CAR.r * s) === 'water') { q.x -= hx * s * Math.abs(c.v) * dt * 1.2; q.y -= hy * s * Math.abs(c.v) * dt * 1.2; hit = { nx: -hx * s, ny: -hy * s, o: null }; }
      if (!hit) continue;
      c.x += q.x - x0; c.y += q.y - y0;
      const into = -(hx * hit.nx + hy * hit.ny) * c.v;
      // a light pole hit by the car goes over, away from it, and the crash stops the car
      if (hit.o && hit.o.kind === 'lamp' && into > 150) {
        const o = hit.o; o.fallen = true; o.fallT = 0; o.fallDir = c.heading + (c.v < 0 ? Math.PI : 0);
        world.obstacles.splice(world.obstacles.indexOf(o), 1);
        // a real crash: the car stops dead and rocks back a little, so the pole falls in front of it, not under it
        A.crash(); c.bump = 1; stars(o.x, o.y, 120, 8); G.mess++; G.pop = 1; missions.event('knock', { kind: 'lamp', id: o, x: o.x, y: o.y }); c.v = -Math.sign(c.v) * 45;
        continue;
      }
      if (into > 260) { A.crash(); c.bump = 1; stars(x0 - hit.nx * 60, y0 - hit.ny * 60, 60, 8); shake(hit.o); c.v *= -0.3; }
      else if (into > 0) c.v -= c.v * Math.min(1, 2.2 * dt);
    }
    world.carPlat.off = off;
  }
  const P = world.carPlat;
  P.ax = c.x - hx * CAR.half; P.ay = c.y - hy * CAR.half; P.bx = c.x + hx * CAR.half; P.by = c.y + hy * CAR.half;
  if (dog.state === 'drive') { placeInCar(); watchBirds(ZERO, dt); dog.point = 0; }
  A.engine(Math.abs(c.v) / CAR_TOP, c.on);
}

// ------------------------------------------------------------------ props --
const SOUND = { cone: A.box, bin: A.bin, box: A.box, ball: A.boing, apple: A.box, plate: A.breakCup, pot: A.smash };
function messUp(o) {
  if (!KINDS[o.kind].mess || o.messed) return;
  o.messed = true; G.mess++; G.pop = 1;
}
function smashProp(o) {
  o.gone = true; messUp(o); if (o.kind === 'plate') A.breakCup(); else A.smash();
  missions.event('smash', { kind: o.kind, id: o, x: o.x, y: o.y });
  G.debris.push({ kind: o.kind, x: o.x, y: o.y, dir: Math.random() * TAU });
  const cols = o.kind === 'pot' ? ['#C9683F', '#D97B50', '#4FA653', '#FF7FA0'] : ['#ffffff', '#F6A6C1', '#E9EDF2'];
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * TAU, s = 80 + Math.random() * 170;
    spawn({ type: 'confetti', x: o.x, z: o.y, y: o.z + 14, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 140 + Math.random() * 200, g: 700, drag: 0.8, life: 0.8 + Math.random() * 0.4, size: 8 + Math.random() * 6, rot: a, vr: (Math.random() - 0.5) * 14, color: cols[i % cols.length] });
  }
}
// Send something flying: away along (nx, ny), as hard as it was hit.
function knock(o, nx, ny, speed) {
  const K = KINDS[o.kind];
  if (K.breaks) { smashProp(o); return; }
  const s = clamp(speed, 160, 950) * K.fly, a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 0.5;
  o.rest = false; o.cool = 0.25; o.vx = Math.cos(a) * s; o.vy = Math.sin(a) * s; o.vz = K.pop * (0.7 + Math.random() * 0.5);
  if (!K.tips || !o.tip) o.dir = a;
  if (K.spills && !o.messed) G.debris.push({ kind: 'bin', x: o.x + nx * 70, y: o.y + ny * 70, dir: a });
  messUp(o); (SOUND[o.kind] || A.box)(); dust(o.x, o.y, 3);
  missions.event('knock', { kind: o.kind, id: o, x: o.x, y: o.y });
}
function updateProps(dt) {
  // whatever is moving about and can hit things: him, and both ends of a rolling car
  const movers = [];
  if (onFoot()) movers.push({ x: dog.x, y: dog.y, z: dog.z, r: DOG_R, top: 50, vx: dog.vx, vy: dog.vy, air: dog.air, dog: true });
  if (Math.abs(car.v) > 30) {
    const hx = Math.cos(car.heading), hy = Math.sin(car.heading);
    for (const s of [1, -1]) movers.push({ x: car.x + hx * CAR.half * s, y: car.y + hy * CAR.half * s, z: 0, r: CAR.r, top: 70, vx: hx * car.v, vy: hy * car.v, air: true });
  }
  for (const o of world.props) {
    if (o.gone || o.held || o.carried) continue;          // in someone's arms or her mouth: they place it
    const K = KINDS[o.kind];
    if (K.find) continue;                              // bones stay where they are (updateFinds)
    o.wob = Math.max(0, o.wob - dt * 3);
    o.cool -= dt;                                      // (counted down at rest too: it used to stop when a thing settled, and she could never pick up again what she had put down)
    if (!o.rest) {
      o.vz -= GRAV * dt * (K.glide && o.vz < 0 ? 0.22 : 1);   // a frisbee floats down
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      const [fl] = floorAt(world, o.x, o.y, o.z);
      const sp = Math.hypot(o.vx, o.vy);
      if (o.z <= fl) {
        o.z = fl;
        if (K.fragile && o.vz < -250) { smashProp(o); continue; }
        if (K.rolls && o.vz < -150) { o.vz *= -0.55; A.boing(); } else { if (o.vz < -300) dust(o.x, o.y, 2); o.vz = 0; }
        const k = Math.exp(-K.drag * dt); o.vx *= k; o.vy *= k;
      }
      if (K.tips) o.tip = lerp(o.tip, Math.PI / 2, 1 - Math.exp(-dt * 9));
      if (K.tumbles) o.roll += (sp * dt) / 24;
      if (K.rolls) { o.roll += (sp * dt) / 13; if (sp > 5) o.dir = Math.atan2(o.vy, o.vx); }
      const hit = pushOut(world, o, K.r);
      if (hit) { const into = -(o.vx * hit.nx + o.vy * hit.ny); if (into > 0) { o.vx += hit.nx * into * 1.4; o.vy += hit.ny * into * 1.4; } }
      if (o.z <= fl && o.vz === 0 && sp < 14) {
        o.rest = true; o.vx = o.vy = 0;
        if (K.tips) o.tip = Math.PI / 2;
        if (K.tumbles) o.roll = Math.round(o.roll / (Math.PI / 2)) * (Math.PI / 2);
      }
    } else if (o.z > 0 && !o.kept) {
      // something resting up high falls when what it was on has gone
      const held = floorAt(world, o.x, o.y, o.z)[0] >= o.z - 1 || world.props.some((q) => q !== o && q.rest && !q.gone && Math.abs(q.z + KINDS[q.kind].h - o.z) < 6 && dist(q.x, q.y, o.x, o.y) < 40);
      if (!held) { o.rest = false; o.cool = 0; }
    }
    for (const m of movers) {
      if (m.z > o.z + K.h || m.z + m.top < o.z) continue;
      const dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy) || 0.01, min = m.r + K.r;
      if (d >= min) continue;
      // something she can carry: running over it, it is in her mouth
      if (m.dog && K.carry && !dog.carry && !(o.cool > 0) && dog.state === 'idle' && Math.hypot(dog.vx, dog.vy) > 40) {
        o.carried = true; o.kept = false; o.rest = true; o.vx = o.vy = o.vz = 0; o.tip = 0; dog.carry = o; A.yip(); missions.event('pick', { kind: o.kind, id: o, x: o.x, y: o.y });
        if (o.thrown) { o.thrown = false; missions.event('fetch', { kind: o.kind, x: o.x, y: o.y }); }   // (no id: the same frisbee counts each time)
        break;
      }
      const nx = dx / d, ny = dy / d, rel = (m.vx - o.vx) * nx + (m.vy - o.vy) * ny;
      if (rel > 20 && !(o.cool > 0) && (rel > K.tough || m.air)) {
        knock(o, nx, ny, rel * (m.dog ? 1.2 : 1.35));
        if (m.dog && !dog.air) { dog.vx *= 0.8; dog.vy *= 0.8; }
      } else if (o.z < 1 || !o.rest) {
        // too slow to send it flying: it just gets shoved along
        o.x = m.x + nx * min; o.y = m.y + ny * min;
        if (rel > 20) { o.wob = Math.max(o.wob, 0.7); if (m.dog) { dog.vx *= 1 - Math.min(1, 6 * dt); dog.vy *= 1 - Math.min(1, 6 * dt); } }
      }
    }
  }
}

// ----------------------------------------------------------------- people --
// Each person has a warmth (their nature, and children like dogs more); what Lili does adds to it, and the sum decides:
// love, indifference, or fright. A bark or a near miss with the car never wins love, only less fright.
const WARMTH = { lover: 0.7, meh: 0, nervous: -0.7 }, CHILD_WARMTH = 0.3, LOVE_AT = 0.3, SCARED_AT = -0.35;
const MANNER = { calm: 0.4, paws: 0.25, bark: -0.7, car: -0.9, crash: -1.2 };
const PERSON_R = 24, RUN = { adult: 230, child: 200 }, RUN_T = 1.8, BREATH_T = 1.4, LOVE_T = 2.6, LOVE_REST = 8;   // after petting her, a while before they would again
const baseState = (o) => (o.walk ? 'walk' : 'stand');
const warmth = (o) => WARMTH[o.nature || 'meh'] + (isChild(o.look) ? CHILD_WARMTH : 0);
function reaction(o, manner, mayLove = true) {
  const w = warmth(o) + MANNER[manner];
  return w >= LOVE_AT && mayLove ? 'love' : w <= SCARED_AT ? 'scared' : 'meh';
}
// what they do once it is decided (after any wobble, sit or jump that came first)
function respond(o, r) {
  const toDog = Math.atan2(dog.y - o.y, dog.x - o.x);
  o.t = 0; o.cool = 4;
  missions.event(r === 'love' ? 'greet' : r === 'scared' ? 'scare' : 'meh', { kind: o.who, id: o, x: o.x, y: o.y });
  if (r === 'love') { o.state = dist(o.x, o.y, dog.x, dog.y) > 75 ? 'approach' : 'love'; o.heading = o.state === 'love' ? toDog : o.heading; if (o.state === 'love') { A.aww(); hearts(o.x, o.y, 120); } }
  else if (r === 'scared') { o.state = 'scared'; o.runDir = toDog + Math.PI; A.scream(personVoice(o.look)); }
  else { o.state = baseState(o); o.glance = 1.4; }
}
function startle(o, x, y) {
  o.state = 'hop'; o.t = 0; o.from = { x: o.x, y: o.y };
  o.to = { x: clamp(x, BOUNDS.x0 + 30, BOUNDS.x1 - 30), y: clamp(y, BOUNDS.y0 + 30, BOUNDS.y1 - 30) };
  A.yelp();
}
// ---- playing with people ----
// With a toy in her mouth she stops beside a child or a dog lover, and they take it: then they throw it for her to fetch
// (she runs after it and picks it up), or hold it out and wiggle it for a tug of war. Not someone frightened of dogs, and
// not while a job wants the toy taken somewhere. That is how you play with a dog: she brings it, you throw it or pull.
// how each toy is played with: 'either' thrown or held out for a tug, 'throw' always thrown (a frisbee)
const TOY = { teddy: 'either', frisbee: 'throw' }, PLAY_R = 100, GIVE_T = 0.5, THROW_ODDS = 0.6, OFFER_T = 8;
function updatePlay(dt) {
  const toy = dog.carry, still = Math.hypot(dog.vx, dog.vy) < 50;
  if (!toy || !TOY[toy.kind] || dog.state !== 'idle' || dog.air || !still || missions.wants('bring')?.target === toy.kind) { dog.giveT = 0; return; }
  // (not q.cool: petting her starts it, and she came close, so they were always petting her and never took the toy)
  const o = world.people.find((q) => !q.holds && !(q.playCool > 0) && ['stand', 'walk', 'love', 'approach'].includes(q.state) && (isChild(q.look) || q.nature === 'lover') && dist(q.x, q.y, dog.x, dog.y) < PLAY_R);
  if (!o) { dog.giveT = 0; return; }
  if ((dog.giveT = (dog.giveT || 0) + dt) < GIVE_T) return;
  dog.giveT = 0; dog.carry = null; Object.assign(toy, { carried: false, px: undefined, held: o, rest: true, kept: false }); o.holds = toy;
  o.state = 'play'; o.t = 0; o.play = TOY[toy.kind] === 'throw' || Math.random() < THROW_ODDS ? 'throw' : 'offer'; dog.happy = Math.max(dog.happy, 1);
}
function updatePeople(dt) {
  const hx = Math.cos(car.heading), hy = Math.sin(car.heading);
  // nobody stands inside anybody else (two children both coming to pet her used to crouch on the same spot)
  const P = world.people;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j], d = dist(a.x, a.y, b.x, b.y), min = PERSON_R * 2;
    if (d >= min || a.state === 'hop' || b.state === 'hop') continue;
    const nx = d > 0.01 ? (b.x - a.x) / d : 1, ny = d > 0.01 ? (b.y - a.y) / d : 0, push = (min - d) / 2;
    a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
  }
  for (const o of world.people) {
    o.t += dt; o.cool = Math.max(0, o.cool - dt); o.playCool = Math.max(0, (o.playCool || 0) - dt); o.wave = Math.max(0, (o.wave || 0) - dt); o.glance = Math.max(0, (o.glance || 0) - dt);
    o.home ||= { x: o.x, y: o.y };
    const dd = dist(o.x, o.y, dog.x, dog.y), toDog = Math.atan2(dog.y - o.y, dog.x - o.x);
    const face = (a, r) => { o.heading += angDiff(a, o.heading) * (1 - Math.exp(-dt * r)); };
    o.glanceYaw = clamp(angDiff(toDog, o.heading), -1.2, 1.2);
    if (o.holds && o.state !== 'tug') { const h = o.holds; h.x = o.x + Math.cos(o.heading) * 14; h.y = o.y + Math.sin(o.heading) * 14; h.z = isChild(o.look) ? 52 : 80; h.dir = o.heading; }
    const walkTo = (x, y, v) => { const d = dist(o.x, o.y, x, y) || 1, s = Math.min(d, v * dt); o.x += (x - o.x) / d * s; o.y += (y - o.y) / d * s; face(Math.atan2(y - o.y, x - o.x), 8); return d; };
    if (o.state === 'walk') {
      // to and fro along their walk (from a to b and back); off it, they head back to the end they were making for
      const w = o.walk, tx = w.dir > 0 ? w.bx : w.ax, ty = w.dir > 0 ? w.by : w.ay, d = dist(o.x, o.y, tx, ty) || 1;
      if (o.calmT > 0) face(toDog, 6);               // she is waiting beside them: they stop for her
      else if (d < 6) w.dir = -w.dir;
      else { o.x += (tx - o.x) / d * 70 * dt; o.y += (ty - o.y) / d * 70 * dt; face(Math.atan2(ty - o.y, tx - o.x), 6); }
    } else if (o.state === 'stand') { if (dd < 420) face(toDog, 5); }
    else if (o.state === 'wobble') { face(toDog, 8); if (o.t > 1.15) respond(o, o.next || 'meh'); }
    else if (o.state === 'sit') { if (o.t > 1.6) respond(o, o.next || 'meh'); }
    else if (o.state === 'hop') {
      const k = clamp(o.t / 0.45, 0, 1);
      o.x = lerp(o.from.x, o.to.x, k); o.y = lerp(o.from.y, o.to.y, k);
      if (k >= 1) { if (o.next) respond(o, o.next); else o.state = baseState(o); o.next = null; }
    }
    else if (o.state === 'approach') { if (walkTo(dog.x, dog.y, 80) < 75 || o.t > 3) { o.state = 'love'; o.t = 0; A.aww(); hearts(o.x, o.y, 120); } }
    else if (o.state === 'tug') {
      // She has hold of their toy: a tug of war, won by tapping (yank). Every tap pulls her side up; they pull back all the
      // time. Her side full, they let go and sit down with a bump, and it is in her mouth; theirs full (she stopped), she
      // lets go and they keep it. The tug bar over them shows who is winning (drawTug), and the toy is stretched between
      // her mouth and their hands (src/scene.js).
      face(toDog, 8);
      const T = dog.tug, toy = o.holds, nx = T.nx, ny = 0;
      T.jerk = Math.max(0, T.jerk - dt * 4); T.growlT -= dt;
      if (T.win < 1) T.win = clamp(T.win - TUG_BACK * dt, 0, 1);   // (not once a tap has filled it: then she has won)
      // her mouth (MOUTH in front of her) a toy's length from their hands, further as she wins and on each yank
      const reach = MOUTH + 46 + 22 * T.win + 14 * T.jerk + Math.sin(o.t * 16) * 2, hands = 16;
      const ease = 1 - Math.exp(-dt * 14);                // (she goes round to her side quickly, not in one jump)
      dog.x = lerp(dog.x, o.x + nx * reach, ease); dog.y = lerp(dog.y, o.y + ny * reach, ease); dog.vx = dog.vy = 0;
      dog.heading += angDiff(Math.atan2(o.y - dog.y, o.x - dog.x), dog.heading) * ease;
      const mid = (hands + reach - MOUTH) / 2; toy.x = o.x + nx * mid; toy.y = o.y + ny * mid; toy.z = isChild(o.look) ? 62 : 76; toy.dir = Math.atan2(ny, nx);   // between their hands and her mouth
      toy.tugged = true; toy.stretch = 1.15 + 0.12 * T.win + 0.3 * T.jerk + 0.05 * Math.sin(o.t * 16);
      if (T.win >= 1) {
        toy.tugged = false; o.holds = null; toy.held = null; toy.carried = true; dog.carry = toy; dog.tug = null; dog.state = 'idle'; dog.stT = 0;
        dog.vx = nx * 170; dog.vy = ny * 170; input.target = null;                    // she staggers back with it
        o.state = 'sit'; o.t = 0; o.cool = 6; o.next = 'meh'; A.oof();
        missions.event('take', { kind: toy.kind, id: toy, from: o.who, x: o.x, y: o.y });
      } else if (T.win <= 0) {                                                       // they won: they keep it, and laugh
        toy.tugged = false; dog.tug = null; dog.state = 'idle'; dog.stT = 0; dog.vx = -nx * 90; dog.vy = -ny * 90;
        o.state = baseState(o); o.cool = 3; o.wave = 1.4; A.aww();
      }
    }
    else if (o.state === 'play') {
      // she has brought them her toy: they throw it for her to fetch, or hold it out for a tug of war (updatePlay)
      face(toDog, 6);
      const toy = o.holds;
      if (!toy) o.state = baseState(o);
      else if (o.play === 'throw' && o.t > 0.9) {
        // over her head, more or less; a frisbee further and flatter (it glides)
        const disc = toy.kind === 'frisbee', a = toDog + (Math.random() - 0.5) * 1.8, s = disc ? 420 + Math.random() * 90 : 300 + Math.random() * 120;
        o.holds = null; toy.held = null; Object.assign(toy, { rest: false, cool: 0.6, thrown: true, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: disc ? 330 : 560, z: isChild(o.look) ? 60 : 85 });
        o.state = baseState(o); o.wave = 1.4; o.cool = 2; o.playCool = 1.5; dog.excited = 0.8; A.yip();
      } else if (o.play === 'offer' && o.t > OFFER_T) o.state = baseState(o);       // they keep it; she can still come and tug
    }
    else if (o.state === 'love') {
      face(toDog, 6);
      if (dd < 130) { dog.happy = Math.max(dog.happy, 0.4); if (isChild(o.look)) dog.excited = 0.4; }    // being petted: happy, and by a child, beside herself
      if (o.t > LOVE_T) { o.state = baseState(o); o.wave = 1.4; o.t = 0; o.cool = LOVE_REST; }
    }
    else if (o.state === 'scared') {
      // away from her, bending round anything in the way, still away if she follows
      o.runDir += angDiff(toDog + Math.PI, o.runDir) * (1 - Math.exp(-dt * 2));
      const v = isChild(o.look) ? RUN.child : RUN.adult;
      o.x += Math.cos(o.runDir) * v * dt; o.y += Math.sin(o.runDir) * v * dt; face(o.runDir, 10);
      pushOut(world, o, 22);
      o.x = clamp(o.x, BOUNDS.x0 + 40, BOUNDS.x1 - 40); o.y = clamp(o.y, BOUNDS.y0 + 40, BOUNDS.y1 - 40);
      if (o.t > RUN_T) { o.state = 'breath'; o.t = 0; }
    }
    else if (o.state === 'breath') { if (o.t > BREATH_T) { o.state = o.walk ? 'walk' : 'return'; o.t = 0; } }
    else if (o.state === 'return') { if (walkTo(o.home.x, o.home.y, 70) < 4) { o.state = 'stand'; o.t = 0; } pushOut(world, o, 22); }

    // ---- a car is coming: jump clear. Nobody ever gets run over. ----
    if (Math.abs(car.v) > 60) {
      const rx = o.x - car.x, ry = o.y - car.y, along = rx * hx + ry * hy, side = -rx * hy + ry * hx;
      const ahead = along * Math.sign(car.v);
      if (o.state !== 'hop' && ahead > -60 && ahead < 190 + Math.abs(car.v) * 0.45 && Math.abs(side) < 120) {
        const s = side >= 0 ? 1 : -1;
        startle(o, o.x - hy * s * (210 - Math.abs(side)), o.y + hx * s * (210 - Math.abs(side)));
        o.next = reaction(o, 'car', false);
      }
      for (const s of [1, -1]) {
        const cx = car.x + hx * CAR.half * s, cy = car.y + hy * CAR.half * s, d = dist(o.x, o.y, cx, cy) || 1;
        if (d < CAR.r + 24) { o.x = cx + ((o.x - cx) / d) * (CAR.r + 24); o.y = cy + ((o.y - cy) / d) * (CAR.r + 24); if (o.from) o.from = { x: o.x, y: o.y }; }
      }
    }

    // ---- she is near ----
    if (!onFoot() || dog.state === 'daze' || dog.z > 120) { o.calmT = 0; continue; }
    const busy = o.cool > 0 || !(o.state === 'walk' || o.state === 'stand');
    // calm: she has stood still near them for a second
    if (!busy && dd < 130 && !dog.air && Math.hypot(dog.vx, dog.vy) < 20) { o.calmT = (o.calmT || 0) + dt; if (o.calmT > 1) { o.calmT = 0; respond(o, reaction(o, 'calm')); } }
    else o.calmT = 0;
    if (dd > DOG_R + 28) continue;
    const sp = Math.hypot(dog.vx, dog.vy), nx = (dog.x - o.x) / (dd || 1), ny = (dog.y - o.y) / (dd || 1);
    if (o.cool <= 0 && !['hop', 'sit', 'scared', 'breath'].includes(o.state)) {
      if (dog.air || sp > ZOOM * 0.8) {
        // a flying hello: they sit down with a bump, he bounces off, and then they decide
        o.state = 'sit'; o.t = 0; o.cool = 4.5; o.heading = toDog; o.next = reaction(o, 'crash');
        A.oof(); stars(o.x, o.y, 150, 7); G.mess++; G.pop = 1;
        dog.vx = nx * 150; dog.vy = ny * 150;
      } else if (o.holds && TOY[o.holds.kind] === 'throw' && o.state !== 'play') {
        // a frisbee is not pulled from them: running up to them, she gets it thrown
        o.state = 'play'; o.t = 0.4; o.play = 'throw';
      } else if (o.holds && dog.state === 'idle' && sp > 40 && !dog.carry) {
        // they have a toy: she grabs it, and it is a tug of war (her play growl)
        o.state = 'tug'; o.t = 0; o.cool = 4; o.heading = toDog;
        // the pull runs across the screen (she goes round to their side she came from): along the camera's view her head
        // hid the toy stretched between them
        dog.state = 'tug'; dog.stT = Infinity; dog.tug = { o, win: TUG_START, jerk: 0, growlT: 1.1, nx: dog.x >= o.x ? 1 : -1 }; dog.vx = dog.vy = 0; dog.heading = toDog + Math.PI; dog.runT = 0;
        dog.zoom = false; input.target = null;
        dog.x = o.x + nx * 62; dog.y = o.y + ny * 62;
        A.playGrowl();
      } else if (dog.state === 'idle' && sp > 40 && o.state !== 'love' && o.state !== 'approach') {
        // paws up for a proper hello, unless they are frightened of her
        const r = reaction(o, 'paws');
        if (r === 'scared') respond(o, r);
        else {
          o.state = 'wobble'; o.t = 0; o.cool = 4; o.next = r;
          dog.state = 'paws'; dog.stT = 1.15; dog.vx = dog.vy = 0; dog.heading = toDog + Math.PI; dog.runT = 0;
          dog.x = o.x + nx * 50; dog.y = o.y + ny * 50;
          if (r === 'love') { A.aww(); hearts(o.x, o.y, 150); }
        }
      }
    }
    if (!dog.air && dog.state !== 'paws' && dd < 50) { dog.x = o.x + nx * 50; dog.y = o.y + ny * 50; }
  }
}

// ------------------------------------------------------------------ birds --
function flyAway(f) {
  const to = world.birdSpot([dog, car], f.kind);
  f.from = { x: f.x, y: f.y }; f.to = to; f.t = 0; f.T = 3.2 + dist(f.x, f.y, to.x, to.y) / 600;
  f.state = 'fly'; f.dir = Math.atan2(to.y - f.y, to.x - f.x);
  A.flutter(); G.birds += f.birds.length; G.pop = 1; missions.event('chase', { kind: 'birds', id: f, x: f.x, y: f.y });
  for (let i = 0; i < 7; i++) spawn({ type: 'leaf', x: f.x + (Math.random() - 0.5) * 80, z: f.y + (Math.random() - 0.5) * 60, y: 20 + Math.random() * 40, vx: (Math.random() - 0.5) * 90, vy: 60, g: 110, drag: 1.5, life: 1.6, size: 6, rot: Math.random() * 6, vr: 5, color: '#DCE2EC' });
}
// Ducks paddle about on the pond and never fly off: when she comes near (swimming, or on the bank) they paddle away
// across the water, quacking, and settle again; now and then they drift a little by themselves.
const wetAround = (x, y, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => world.surfaceAt(x + a, y + b) === 'water');
function updateDucks(f, dt) {
  const dd = dist(f.x, f.y, dog.x, dog.y), near = dd < 240;
  if (!f.to && (near || Math.random() < dt * 0.06)) {
    for (let i = 0; i < 12 && !f.to; i++) {
      const a = near ? Math.atan2(f.y - dog.y, f.x - dog.x) + (Math.random() - 0.5) * 2.2 : Math.random() * TAU, r = near ? 220 : 70;
      if (wetAround(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 55)) f.to = { x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, fast: near };
    }
    if (f.to && near) A.quack();
  }
  if (f.to) {
    const dx = f.to.x - f.x, dy = f.to.y - f.y, d = Math.hypot(dx, dy), step = (f.to.fast ? 120 : 30) * dt;
    f.dir = Math.atan2(dy, dx);
    if (d <= step) f.to = null; else { f.x += (dx / d) * step; f.y += (dy / d) * step; }
  }
  if (dd < 700 && Math.random() < dt * 0.08) A.quack();
}
function updateBirds(dt) {
  for (const f of world.flocks) {
    if (f.kind === 'duck') { updateDucks(f, dt); continue; }
    if (f.state === 'ground') {
      const dd = dist(f.x, f.y, dog.x, dog.y);
      if ((onFoot() && dd < 250) || (Math.abs(car.v) > 80 && dist(f.x, f.y, car.x, car.y) < 340)) flyAway(f);
      else if (dd < 800 && Math.random() < dt * 0.12) A.coo();
    } else {
      f.t += dt;
      const k = clamp(f.t / f.T, 0, 1), e = easeInOut(k);
      f.x = lerp(f.from.x, f.to.x, e); f.y = lerp(f.from.y, f.to.y, e);
      f.h = Math.sin(Math.min(1, k * 1.15) * Math.PI) ** 0.6 * 300 * Math.min(1, f.T / 4);
      if (k >= 1) { f.state = 'ground'; f.h = 0; f.t = 0; }
    }
  }
}

// ------------------------------------------------------------------- loop --
function update(dt) {
  G.t += dt; G.pop = Math.max(0, G.pop - dt * 3);
  updateDog(dt);
  if (STUDIO) {
    // the floor repeats every 400, so carrying him back a whole number of squares cannot be seen
    for (const [a, mid] of [['x', 1800], ['y', 1500]]) {
      const d = dog[a] > mid + 800 ? -1600 : dog[a] < mid - 800 ? 1600 : 0;
      if (d) { dog[a] += d; if (input.target) input.target[a] += d; }
    }
    updateFx(dt);
    for (const o of world.people) o.t += dt;
    if (world.people.length) { G.focus.x = 1640 + (PERSON_LOOKS - 1) * 55; G.focus.y = 1490; } else { G.focus.x = dog.x; G.focus.y = dog.y; }
    return;
  }
  updateCar(dt);
  updateProps(dt);
  updatePeople(dt);
  updatePlay(dt);
  carryAt(dt);
  updateFinds(dt);
  updateJobs(dt);
  updateBirds(dt);
  for (const o of world.obstacles) o.wob = Math.max(0, o.wob - dt * 2.2);
  for (const o of world.platforms) o.wob = Math.max(0, o.wob - dt * 3);
  for (const t of world.trees) t.wob = Math.max(0, t.wob - dt * 1.6);
  updateFx(dt);
  const f = G.focus;
  if (dog.state === 'drive') { f.x = car.x; f.y = car.y; f.vx = Math.cos(car.heading) * car.v; f.vy = Math.sin(car.heading) * car.v; f.zoom = 1.2 + 0.4 * Math.abs(car.v) / CAR_TOP; }
  else { f.x = dog.x; f.y = dog.y; f.vx = dog.vx; f.vy = dog.vy; f.zoom = dog.zoom ? 1.12 : 1; }
  f.zoom *= VIEW_ZOOM;
  btnCar.classList.toggle('hidden', !(dog.state === 'drive' || nearCar()));
  btnDrop.classList.toggle('hidden', !dog.carry);
}

// ---- overlay: particles, the counters, and what he is thinking ----
const hud = document.getElementById('hud'), c = hud.getContext('2d');
function drawOverlay(t) {
  const { w, h, dpr } = S.view;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  if (input.target) {
    const [sx, sy, k, ok] = S.project(input.target.x, 0, input.target.y);
    if (ok) { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; Art.ell(c, sx, sy, (18 + Math.sin(t * 8) * 3) * k * 1.6, (18 + Math.sin(t * 8) * 3) * k * 0.9); c.stroke(); }
  }
  drawFx(c, S.project);
  if (dog.thought > 0) {
    const [sx, sy, k, ok] = S.project(dog.x, dog.z + 150, dog.y);
    if (ok) { const r = Math.max(20, 34 * k) * Math.min(1, (1.8 - dog.thought) * 6, dog.thought * 4); Art.drawBubble(c, sx + r * 0.5, sy - r * 1.6, r); Art.drawBird(c, sx + r * 0.5, sy - r * 1.6 + r * 0.1, r * 0.62); }
  }
  if (nearCar() && dog.state === 'idle' && !(dog.thought > 0)) {
    const [sx, sy, k, ok] = S.project(car.x, 190, car.y);
    if (ok) { const r = Math.max(20, 36 * k), y = sy - r + Math.sin(t * 4) * 4; Art.drawBubble(c, sx, y, r); Art.drawWheel(c, sx, y, r * 0.66); }
  }
  if (STUDIO) { drawStudio(); return; }
  const u = clamp(Math.min(w, h) / 620, 0.75, 1.3), x = 18 * u, y = 34 * u, pop = 1 + G.pop * 0.25;
  Art.drawPaw(c, x + 18 * u, y, 20 * u * pop); Art.drawNum(c, G.mess, x + 46 * u, y + 2 * u, 34 * u);
  const x2 = x + 46 * u + c.measureText(G.mess).width + 30 * u;
  Art.drawBird(c, x2 + 20 * u, y + 2 * u, 22 * u); Art.drawNum(c, G.birds, x2 + 50 * u, y + 2 * u, 34 * u);
  const x3 = x2 + 50 * u + c.measureText(G.birds).width + 30 * u;
  Art.drawBone(c, x3 + 18 * u, y + 2 * u, 19 * u * (1 + ui.bonePop * 0.35)); Art.drawNum(c, G.bones, x3 + 46 * u, y + 2 * u, 34 * u);
  ui.boneAt = [x3 + 18 * u, y + 2 * u]; ui.hudRight = x3 + 46 * u + c.measureText(G.bones).width;
  drawAskers(t);
  drawTug(t);
  for (const f of ui.fly) {                           // a bone just found, on its way to the counter
    const k = easeInOut(clamp(f.t / 0.6, 0, 1));
    Art.drawBone(c, lerp(f.x, ui.boneAt[0], k), lerp(f.y, ui.boneAt[1], k) - Math.sin(k * Math.PI) * 60, lerp(28, 19, k) * u, -0.5 + k * 6.28);
  }
  drawJob(t, w, h, u);
  drawCelebration(t, w, h, u);
  if (SHOW_FPS) drawFps();
}

// ------------------------------------------------------------------- jobs --
// One job at a time (docs/open-world-design.md, "Jobs for five to seven year olds"). Jobs are not handed out one after
// another: people about town ask for them, each with what they want in a bubble over their head, when she comes by
// (askers below); in between she explores. A job is told three ways: said out loud by whoever asked, shown as pictures
// on a card at the top, and pointed to in the town (chevrons and a ring on the ground, the button to press pulsing).
// Done, it becomes a sticker in the sticker book. Nothing is timed and nothing can be failed.
// What the game itself says (a job's own words are in its file). Each line is a clip made by tools/voice.py: run it
// after changing one.
const SAY = { oops: 'Oops! Gently. Try again.', jobs: 'Wow! New jobs!', all: 'You helped everyone in town! Hooray!', more: 'Get more stickers first!', wait: 'Not yet!' };
// said to the child, not to the dog they play (it said good girl)
const PRAISE = ['You did it!', 'Well done!', 'Hooray!', 'Brilliant!', 'Amazing!'];
const picture = (m) => missions.step()?.picture || m.picture;
const words = (m) => missions.step()?.say || m.say;
// Is the way shown? Always in the first two levels. After that the child finds it, unless they ask (a tap on the card)
// or have got nowhere for a while.
const guided = () => { const m = missions.job(); return !!m && (m.level <= 2 || ui.helpT > 0 || missions.quiet() > 25); };

function jobStarted(m) {
  ui.card = { m, t: 0 }; ui.cele = null; ui.banner = null; ui.helpT = 0; ui.sayT = 4.2; ui.say = m.say;
  for (const s of m.steps) prepare(s);
  A.speak(m.say); save();
}
function stepStarted(m, s) { ui.pip = 1; ui.sayT = 4; ui.say = s.say || m.say; A.ding(); if (s.say) A.speak(s.say); }
function jobDone(m, first, levels) {
  ui.card = null; ui.cele = { m, t: 0, first, levels }; ui.askT = 4; ui.lostT = 0;
  A.fanfare(); A.speak(m.praise || PRAISE[missions.done.size % PRAISE.length]); G.pop = 1;
  for (let i = 0; i < 30; i++) spawn({ type: 'confetti', x: dog.x, z: dog.y, y: 120, vx: (Math.random() - 0.5) * 340, vz: (Math.random() - 0.5) * 340, vy: 200 + Math.random() * 240, g: 500, drag: 1, life: 1.6, size: 9, rot: Math.random() * 6, vr: 8, color: confettiColor() });
  save();
}
function updateJobs(dt) {
  missions.update(dt, dog, car);
  ui.helpT = Math.max(0, ui.helpT - dt); ui.sayT = Math.max(0, ui.sayT - dt); ui.pip = Math.max(0, ui.pip - dt * 2.5);
  ui.oops = Math.max(0, ui.oops - dt * 1.6); ui.bonePop = Math.max(0, ui.bonePop - dt * 3);
  if (ui.card) ui.card.t += dt;
  for (const f of ui.fly) f.t += dt;
  while (ui.fly.length && ui.fly[0].t > 0.6) { ui.fly.shift(); ui.bonePop = 1; }
  const k = ui.cele;
  if (k && (k.t += dt) > 2.6) {                       // the sticker has reached the book
    ui.cele = null; bookN.textContent = missions.done.size; A.chime();
    btnBook.classList.remove('pop'); void btnBook.offsetWidth; btnBook.classList.add('pop');
    if (k.levels.length) { ui.banner = { level: k.levels[k.levels.length - 1], t: 0 }; A.fanfare(); A.speak(SAY.jobs); }
  }
  if (ui.banner && (ui.banner.t += dt) > 2.6) ui.banner = null;
  updateAskers(dt);
  // the button the job wants pressed pulses
  const s = guided() ? missions.step() : null, a = s && s.action, at = s && missions.target(dog, car), close = !!at && dist(at.x, at.y, dog.x, dog.y) < 330;
  btnBark.classList.toggle('hint', a === 'bark' || a === 'honk' || !!dog.tug);   // in a tug, the buttons pulse: press, press!
  btnJump.classList.toggle('hint', !!dog.tug || a === 'jump' || (close && (a === 'hop' || a === 'splash' || a === 'poo' || (a === 'knock' && s.target === 'apple'))));
  if ((ui.tidyT -= dt) <= 0) { ui.tidyT = 2; tidyFar(); }
  if ((ui.saveT -= dt) <= 0) { ui.saveT = 10; save(); }
}
input.onTap = (x, y) => {
  if (ui.book) { tapBook(x, y); return true; }
  if (dog.tug) { A.initAudio(); yank(); return true; }       // in a tug of war every tap is a pull

  const r = ui.rect;
  if (!r || !ui.card || x < r[0] || x > r[0] + r[2] || y < r[1] || y > r[1] + r[3]) return false;
  ui.helpT = 14; ui.sayT = 4; ui.say = words(ui.card.m); A.initAudio(); A.yip(); A.speak(ui.say); return true;   // tapped: said again, and the way shown
};

// ---- the tug of war ----
// A tap, a button or a key: she yanks it, and her side of the tug bar goes up.
function yank() {
  const T = dog.tug; if (!T) return;
  T.win = Math.min(1, T.win + TUG_YANK); T.jerk = 1;
  dust(dog.x - Math.cos(dog.heading) * 20, dog.y - Math.sin(dog.heading) * 20, 2, { speed: 90 });
  if (T.growlT <= 0) { T.growlT = 1.1; A.playGrowl(); }
}
// The tug bar, over the two of them: her face at her end, theirs at theirs, and the toy between, where the pulling is.
// Her side fills pink as she wins. No words: the children cannot read.
function drawTug(t) {
  const T = dog.tug; if (!T) return;
  const o = T.o, [dx, dy, k, ok] = S.project(dog.x, 150, dog.y), [px, py, , ok2] = S.project(o.x, isChild(o.look) ? 175 : 215, o.y); if (!ok || !ok2) return;
  const u = clamp(k * 1.4, 0.75, 1.3), w = 170 * u, hgt = 24 * u, cx = (dx + px) / 2, cy = Math.min(dy, py) - 26 * u, left = dx < px;
  const at = left ? cx - w / 2 + w * T.win : cx + w / 2 - w * T.win;
  c.save(); c.fillStyle = 'rgba(40,40,30,.2)'; c.beginPath(); c.roundRect(cx - w / 2 + 2, cy - hgt / 2 + 3, w, hgt, hgt / 2); c.fill();
  c.fillStyle = '#BFE3F7'; c.beginPath(); c.roundRect(cx - w / 2, cy - hgt / 2, w, hgt, hgt / 2); c.fill();
  c.fillStyle = '#FF7FA0'; c.beginPath(); c.roundRect(left ? cx - w / 2 : at, cy - hgt / 2, left ? at - (cx - w / 2) : cx + w / 2 - at, hgt, hgt / 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 3 * u; c.beginPath(); c.roundRect(cx - w / 2, cy - hgt / 2, w, hgt, hgt / 2); c.stroke();
  const face = 22 * u * (1 + 0.15 * T.jerk);
  Art.drawIcon(c, 'lili', left ? cx - w / 2 - 6 * u : cx + w / 2 + 6 * u, cy, face);
  Art.drawIcon(c, 'friend', left ? cx + w / 2 + 6 * u : cx - w / 2 - 6 * u, cy, 22 * u);
  Art.drawIcon(c, o.holds ? o.holds.kind : 'teddy', at, cy + Math.sin(t * 16) * 2 * u, 18 * u);
  c.restore();
}

// ---- who asks ----
// Someone with a job for her shows it in a bubble over their head (the pictures of the job), all of them at once, so
// the child sees who needs help and chooses. She comes within ASK_R of one on foot and they turn to her and ask: the
// job starts, in their voice. Each asks for their jobs in list order, a job once its level is open; one done is not
// asked for again (the sticker book has it). One job is in hand at a time, but the other bubbles stay up: standing
// still beside another asker for SWAP_T (not just running past, and not while carrying something) swaps to their job,
// and the one left goes back to whoever asked for it, to be asked for again. Just after a job is done or swapped,
// nobody asks for a moment. A child with no job who finds no one for a while (LOST, shorter before the first sticker)
// is shown the way to the nearest asker, as to a job.
const ASK_R = 120, SWAP_T = 0.8, LOST = 40, LOST_FIRST = 12;
const askers = [...world.people, ...world.animals].filter((o) => o.id && missions.missions.some((m) => m.from === o.id));
const askerTop = (o) => (o.kind === 'duck' ? 95 : isChild(o.look) ? 150 : 200);   // where their bubble goes
const offer = (o) => missions.missions.find((m) => m.from === o.id && !missions.done.has(m.id) && missions.available(m)) || null;
const open = () => !ui.cele && !ui.title && ui.askT <= 0;
const asking = () => !missions.job() && open();
function updateAskers(dt) {
  ui.askT = Math.max(0, ui.askT - dt);
  const job = missions.job(), still = Math.hypot(dog.vx, dog.vy) < 40;
  ui.stillT = still ? (ui.stillT || 0) + dt : 0;
  ui.lostT = asking() ? ui.lostT + dt : 0;
  if (!open()) return;
  if (!job && !ui.saidAll && missions.done.size === missions.missions.length) { ui.saidAll = true; A.speak(SAY.all); }
  if (dog.state !== 'idle' || dog.air || (job && (dog.carry || ui.stillT < SWAP_T))) return;
  for (const o of askers) {
    const m = offer(o); if (!m || m === job || dist(o.x, o.y, dog.x, dog.y) > ASK_R) continue;
    o.heading = Math.atan2(dog.y - o.y, dog.x - o.x); if (o.kind === 'duck') A.quack(); missions.start(m); if (job) ui.askT = 3; return;
  }
}
// the asker to show the way to, if she has been looking for one long enough
function lostWay() {
  if (!asking() || ui.lostT < (missions.done.size ? LOST : LOST_FIRST)) return null;
  let best = null;
  for (const o of askers) if (offer(o) && (!best || dist(o.x, o.y, dog.x, dog.y) < dist(best.x, best.y, dog.x, dog.y))) best = o;
  return best;
}
function drawAskers(t) {
  if (!open()) return;
  const job = missions.job();
  for (const o of askers) {
    const m = offer(o); if (!m || m === job) continue;     // (whoever asked for the job in hand has nothing more to show)
    const [sx, sy, k, ok] = S.project(o.x, askerTop(o), o.y); if (!ok) continue;
    const s = clamp(34 * k, 20, 46), pics = m.picture.slice(0, 2), bw = s * (pics.length * 1.9 + 0.6), bh = s * 2.3;
    const x = sx, y = sy - bh / 2 + Math.sin(t * 3 + o.seed) * s * 0.12;
    c.save(); c.fillStyle = 'rgba(40,40,30,.18)'; c.beginPath(); c.roundRect(x - bw / 2 + 2, y - bh / 2 + 4, bw, bh, s * 0.7); c.fill();
    c.fillStyle = '#FFFDF4'; c.strokeStyle = '#E8A93A'; c.lineWidth = Math.max(2, s * 0.12);
    c.beginPath(); c.roundRect(x - bw / 2, y - bh / 2, bw, bh, s * 0.7); c.moveTo(x - s * 0.35, y + bh / 2 - 1); c.lineTo(x, y + bh / 2 + s * 0.55); c.lineTo(x + s * 0.35, y + bh / 2 - 1);
    c.fill(); c.stroke(); c.fillStyle = '#FFFDF4'; c.fillRect(x - s * 0.3, y + bh / 2 - c.lineWidth * 1.5, s * 0.6, c.lineWidth * 2);
    pics.forEach((p, i) => Art.drawIcon(c, p, x + (i - (pics.length - 1) / 2) * s * 1.9, y, s * 0.82));
    c.restore();
  }
}

// ---- the card ----
// Where it sits: top middle; under the counters and the round buttons when there is no room between them.
function cardBox(w, u, m) {
  const n = Math.max(1, picture(m).length), cw = Math.max(170, n * 96 + 52) * u, ch = 120 * u;
  const narrow = w / 2 - cw / 2 < (ui.hudRight || 0) + 12 || w / 2 + cw / 2 > w - 136;
  return { x: w / 2, y: (narrow ? 70 : 12 * u) + ch / 2, w: cw, h: ch };
}
function drawJob(t, w, h, u) {
  const k = ui.card; if (!k) { ui.rect = null; return; }
  const m = k.m, b = cardBox(w, u, m), pr = missions.progress(), steps = m.steps.length;
  // new: it bounces in at its place at the top and pulses for a moment. (It used to come up big in the middle of the
  // screen first, and hid Lili and whoever had just asked her, just when the job began beside them.)
  const pop = k.t < 0.5 ? easeOut(k.t / 0.5) * (1 + Math.sin(k.t / 0.5 * Math.PI) * 0.3) : 1 + Math.max(0, Math.sin(k.t * 7)) * 0.05 * clamp(3 - k.t, 0, 1);
  const sc = pop * (1 + ui.pip * 0.07);
  const cx = b.x + Math.sin(ui.oops * 28) * 7 * ui.oops, cy = b.y;
  if (sc < 0.02) return;
  c.save(); c.translate(cx, cy); c.scale(sc, sc);
  Art.drawCard(c, 0, 0, b.w, b.h);
  const pips = pr.count > 1 ? [pr.n, pr.count] : steps > 1 ? [pr.i, steps] : null;
  Art.drawPictures(c, picture(m), 0, pips ? -11 * u : 0, b.w - 40 * u, (pips ? 70 : 90) * u);
  if (pips) Art.drawPips(c, 0, b.h / 2 - 16 * u, Math.min(7 * u, (b.w - 30 * u) / (pips[1] * 2.7)), pips[0], pips[1], ui.pip);
  Art.drawSpeaker(c, b.w / 2 - 16 * u, -b.h / 2 + 16 * u, 9 * u, guided() ? 0 : 0.5 + 0.5 * Math.sin(t * 5));
  c.restore();
  ui.rect = [cx - b.w * sc / 2, cy - b.h * sc / 2, b.w * sc, b.h * sc];
  const a = Math.min(1, k.t * 3, ui.sayT * 2);         // the words under it, while it is new or just tapped
  if (a > 0) { c.globalAlpha = a; Art.drawCaption(c, ui.say, w / 2, cy + b.h * sc / 2 + 26 * u, 22 * u, w - 24); c.globalAlpha = 1; }
}
function drawCelebration(t, w, h, u) {
  const k = ui.cele;
  if (k) {
    const R = Math.min(100 * u, w * 0.28, h * 0.13), a = clamp(k.t / 0.4, 0, 1), fly = easeInOut(clamp((k.t - 1.9) / 0.7, 0, 1));
    // high on the screen, so Lili and whoever she helped stay in sight below it
    const br = btnBook.getBoundingClientRect(), x = lerp(w / 2, br.left + br.width / 2, fly), y = lerp(R * 1.2 + 44, br.top + br.height / 2, fly);
    const r = R * (easeOut(a) + Math.sin(a * Math.PI) * 0.2) * lerp(1, 0.24, fly);
    if (fly < 0.01) {                                 // rays turning behind it
      c.save(); c.translate(x, y); c.rotate(t * 0.8); c.fillStyle = `rgba(255,226,122,${0.5 * a})`;
      for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.5, -r * 0.3); c.lineTo(r * 1.5, r * 0.3); c.closePath(); c.fill(); }
      c.restore();
    }
    Art.drawSticker(c, k.m.picture, x, y, r, 'done');
  }
  const bn = ui.banner;
  if (bn) {                                           // a level has opened
    const a = clamp(Math.min(bn.t * 4, (2.6 - bn.t) * 4), 0, 1), bw = Math.min(w - 30, 330 * u), y = Math.max(140 * u, h * 0.22);
    c.globalAlpha = a; Art.drawCard(c, w / 2, y, bw, 124 * u, { edge: '#4FA653' });
    for (let i = 0; i < bn.level; i++) Art.drawIcon(c, 'star', w / 2 + (i - (bn.level - 1) / 2) * 52 * u, y - 18 * u, 23 * u * (1 + 0.1 * Math.sin(t * 6 + i)));
    Art.drawWords(c, 'New jobs!', w / 2, y + 36 * u, 28 * u, bw - 30 * u, '#3B8A40'); c.globalAlpha = 1;
  }
}

// ---- the way ----
// Where to go, on the ground (drawn by src/scene.js, `guide`): orange chevrons from her feet towards what the job needs,
// a glow running along them the way to go, and a ring round the place itself. The paw prints, the bouncing marker and
// the arrow at the screen's edge it replaced looked messy and confused (owner, 2026-11-19).
function wayTo() {
  if (dog.state === 'hop' || ui.title) return null;
  const at = missions.job() ? guided() && missions.target(dog, car) : lostWay(); if (!at) return null;
  const from = dog.state === 'drive' ? car : dog;
  return { x0: from.x, y0: from.y, x1: at.x, y1: at.y, big: dog.state === 'drive' };
}

// ---- bones ----
// Bones lie about town to be found: run over one (or drive over it) and it is hers. A heap of earth has one buried:
// standing on it she digs it up (updateDog). Both come back after a while, once she is far away, so there is always one
// to find; the count is kept.
const BONE_BACK = 60, FAR = 1200;
function gotBone(o) {
  G.bones++; A.chime(); stars(o.x, o.y, 40, 8);
  const [sx, sy, , ok] = S.project(o.x, 40, o.y); if (ok) ui.fly.push({ x: sx, y: sy, t: 0 });
  missions.event('collect', { kind: 'bone', id: o, x: o.x, y: o.y }); save();
}
function updateFinds() {
  const me = dog.state === 'drive' ? car : dog, reach = dog.state === 'drive' ? 95 : 54;
  for (const o of world.props) {
    const K = KINDS[o.kind]; if (!K.find) continue;
    if (o.gone) { if (G.t > o.back && dist(o.x, o.y, dog.x, dog.y) > FAR) o.gone = false; continue; }
    if (K.find && dog.state !== 'hop' && dist(o.x, o.y, me.x, me.y) < reach && dog.z < 60) { o.gone = true; o.back = G.t + BONE_BACK; gotBone(o); }
  }
}

// ---- putting things back ----
// What she broke or knocked over is put back when a job needs it, and otherwise once she is far away: there is always
// something to knock over. What she took goes back to whoever had it.
const TIDY = ['cone', 'bin', 'box', 'pot', 'plate', 'apple', 'sandcastle', 'lamp'], lampPosts = world.tiles.flatMap((t) => t.things.lamps);
function giveBack(o) {
  const p = o.owner; if (!p || o.held === p) return;
  if (o.held) { o.held.holds = null; o.held = null; }  // someone else is playing with it
  if (dog.carry === o) dog.carry = null;
  Object.assign(o, { carried: false, kept: false, held: p, rest: true, vx: 0, vy: 0, vz: 0, tip: 0, roll: 0 }); p.holds = o;
}
function tidy(kind, far = 0) {
  const away = (o) => !far || (dist(o.x, o.y, dog.x, dog.y) > far && (!o.home || dist(o.home.x, o.home.y, dog.x, dog.y) > far));
  if (kind === 'lamp') { for (const o of lampPosts) if (o.fallen && away(o)) { o.fallen = false; world.obstacles.push(o); } return; }
  for (const o of world.props) if (o.kind === kind && !o.owner && !o.carried && (o.gone || o.messed) && away(o)) Object.assign(o, { x: o.home.x, y: o.home.y, z: o.home.z, vx: 0, vy: 0, vz: 0, tip: 0, roll: 0, rest: true, gone: false, messed: false, cool: 0 });
  for (const d of G.debris) if (d.kind === kind && !d.gone && away(d)) d.gone = true;
}
function tidyFar() {
  for (const kind of TIDY) tidy(kind, 1500);
  for (const o of world.props) if (o.owner && !o.held && !o.carried && !o.kept && dist(o.x, o.y, dog.x, dog.y) > 1500 && dist(o.owner.x, o.owner.y, dog.x, dog.y) > 1500) giveBack(o);
}
// a job is starting: what this step of it needs is there
function prepare(s) {
  const need = s.count || 1;
  if (s.action === 'take') { for (const o of world.props) if (o.kind === s.target) giveBack(o); }
  else if (s.action === 'fetch') {                   // whoever has the frisbee throws it straight away
    for (const o of world.props) if (o.kind === s.target) giveBack(o);
    for (const p of world.people) if (p.holds && p.holds.kind === s.target) { p.state = 'play'; p.play = 'throw'; p.t = 0.3; }
  }
  else if (s.action === 'knock' && s.target === 'lamp') { if (lampPosts.filter((o) => !o.fallen).length < need + 4) tidy('lamp'); }
  else if (s.action === 'smash' || s.action === 'knock') { if (world.props.filter((o) => o.kind === s.target && !o.gone && !o.messed).length < need) tidy(s.target); }
}

// ---- kept between visits (in the browser): stickers, the job in hand, the counters. ?fresh starts over. ----
const SAVE = 'lili-save-1';
function save() {
  if (STUDIO) return;
  try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, ...missions.state(), bones: G.bones, mess: G.mess, birds: G.birds })); } catch {}
}
function load() {
  try {
    if (params.has('fresh')) localStorage.removeItem(SAVE);
    const st = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (st && st.v === 1) { missions.restore(st); G.bones = st.bones || 0; G.mess = st.mess || 0; G.birds = st.birds || 0; }
  } catch {}
}

// ---- the sticker book ----
// Every job as a sticker, a row for each level: done ones in gold with a tick, the one in hand ringed in green, a level
// not yet open behind a padlock with the stickers still needed. A tap on a sticker starts that job (again, if it is
// done). The town waits while the book is open.
function openBook() { ui.book = true; A.pageTurn(); actions.classList.add('hidden'); keysHelp.classList.add('hidden'); btnBook.classList.add('open'); input.target = null; }
function closeBook() { ui.book = false; A.pageTurn(); actions.classList.remove('hidden'); keysHelp.classList.remove('hidden'); btnBook.classList.remove('open'); }
function bookLayout(w, h, u) {
  const levels = missions.levels(), by = levels.map((l) => missions.missions.filter((m) => m.level === l));
  const pad = 12 * u, top = 72, headW = 56 * u;
  let best = null;
  for (let cols = 3; cols <= 8; cols++) {
    const rows = by.reduce((n, list) => n + Math.ceil(list.length / cols), 0), cell = Math.min((w - pad * 2 - headW) / cols, (h - top - pad) / rows);
    if (!best || cell > best.cell) best = { cols, rows, cell };
  }
  const { cols, rows, cell } = best, r = cell / 2.3, x0 = (w - (headW + cols * cell)) / 2 + headW, items = [], heads = [];
  let y = top + Math.max(0, (h - top - pad - rows * cell) / 2);
  by.forEach((list, i) => {
    const n = Math.ceil(list.length / cols);
    heads.push({ level: levels[i], x: x0 - headW / 2, y: y + (n * cell) / 2, top: y, h: n * cell, x0: x0 - headW, w: headW + cols * cell, open: missions.unlocked(levels[i]), missing: missions.missing(levels[i]) });
    list.forEach((m, j) => items.push({ m, x: x0 + ((j % cols) + 0.5) * cell, y: y + (Math.floor(j / cols) + 0.5) * cell, r }));
    y += n * cell;
  });
  return { items, heads };
}
function drawBook(now) {
  const { w, h, dpr } = S.view, u = clamp(Math.min(w, h) / 620, 0.75, 1.3);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,248,226,.96)'; c.fillRect(0, 0, w, h);
  Art.drawIcon(c, 'star', 34 * u, 36, 20 * u); Art.drawNum(c, `${missions.done.size} / ${missions.missions.length}`, 62 * u, 38, 30 * u, '#8A5A3C', 'rgba(255,255,255,.9)');
  const L = ui.layout = bookLayout(w, h, u), job = missions.job();
  for (const hd of L.heads) {
    c.fillStyle = hd.level % 2 ? 'rgba(242,182,58,.16)' : 'rgba(79,163,224,.13)'; c.beginPath(); c.roundRect(hd.x0 - 4, hd.top + 3, hd.w + 8, hd.h - 6, 18 * u); c.fill();
    if (hd.open) for (let i = 0; i < hd.level; i++) Art.drawIcon(c, 'star', hd.x + ((i % 2) - (hd.level > 1 ? 0.5 : 0)) * 21 * u, hd.y + (Math.floor(i / 2) - (hd.level > 2 ? 0.5 : 0)) * 21 * u, 10 * u);
    else {
      Art.drawPadlock(c, hd.x, hd.y - 14 * u, 16 * u); Art.drawIcon(c, 'star', hd.x - 11 * u, hd.y + 22 * u, 9 * u);
      Art.drawNum(c, hd.missing, hd.x + 1 * u, hd.y + 23 * u, 20 * u, '#8A5A3C', 'rgba(255,255,255,.9)');
    }
  }
  for (const it of L.items) {
    const done = missions.done.has(it.m.id), mine = it.m === job;
    c.globalAlpha = missions.available(it.m) ? 1 : 0.4;
    Art.drawSticker(c, it.m.picture, it.x, it.y, it.r * (mine ? 1 + 0.05 * Math.sin(now * 5) : 1), done ? 'done' : mine ? 'now' : 'open');
    if (mine && done) { c.strokeStyle = '#4FA653'; c.lineWidth = it.r * 0.1; Art.circ(c, it.x, it.y, it.r * 1.12); c.stroke(); }
    c.globalAlpha = 1;
  }
}
function tapBook(x, y) {
  const it = ui.layout?.items.find((q) => Math.hypot(q.x - x, q.y - y) < q.r * 1.15);
  if (!it) return;
  A.initAudio();
  if (!missions.available(it.m)) { const n = missions.missing(it.m.level); A.oops(); A.speak(n > 0 ? SAY.more : SAY.wait); return; }
  closeBook(); missions.start(it.m);
}

function resize() { S.resize(); hud.width = Math.round(S.view.w * S.view.dpr); hud.height = Math.round(S.view.h * S.view.dpr); }

// ---- wiring ----
function act(a) { A.initAudio(); if (ui.title) { play(); return; } if (ui.book) return; if (dog.tug) { yank(); return; } if (a === 'jump') jump(); else if (a === 'bark') bark(); else if (a === 'drop') { if (dog.carry) drop(); } else carAction(); }
G.api = { play, stats: S.stats, heaviest: S.heaviest, byKind: S.byKind, quality: (l) => setLevel(l), perf: () => perf, renderMusic: A.renderMusic, jump, bark, car: carAction, knock, smash: smashProp, enterCar, leaveCar, flyAway, openBook, closeBook, tidy, save, spoken: A.spoken };
input.onAction = act;
input.onKey = () => { if (dog.tug) yank(); };   // and so is every arrow key
const btnDrop = document.getElementById('btn-drop'), btnCar = document.getElementById('btn-car'), btnMute = document.getElementById('btn-mute'), btnBook = document.getElementById('btn-book'), bookN = document.getElementById('book-n');
const btnBark = document.getElementById('btn-bark'), btnJump = document.getElementById('btn-jump'), actions = document.getElementById('actions'), keysHelp = document.getElementById('keys');
for (const [id, a] of [['btn-jump', 'jump'], ['btn-bark', 'bark'], ['btn-car', 'car'], ['btn-drop', 'drop']]) {
  document.getElementById(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); act(a); });
}
btnMute.addEventListener('click', () => {
  A.initAudio(); A.setMuted(!A.isMuted());
  document.getElementById('mute-waves').style.display = A.isMuted() ? 'none' : '';
  document.getElementById('mute-cross').style.display = A.isMuted() ? '' : 'none';
});

btnBook.addEventListener('click', () => { A.initAudio(); if (ui.book) closeBook(); else openBook(); });
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && ui.book) closeBook(); });
if (STUDIO) btnBook.classList.add('hidden');

const canvas = document.getElementById('game');
S.initScene(canvas, world);
initInput(canvas);
window.addEventListener('resize', resize); resize();

const at = (params.get('at') || '').split(',').map(Number);
if (at.length === 2 && at.every(Number.isFinite)) { dog.x = at[0]; dog.y = at[1]; }
updateCar(0);
if (params.has('car')) enterCar();
// the saved stickers first, before anything saves over them; nobody asks in the studio
if (STUDIO) { ui.saidAll = true; ui.askT = Infinity; }
else { load(); ui.saidAll = missions.done.size === missions.missions.length; bookN.textContent = missions.done.size; }
update(0); S.snapCamera(G.focus);

// ---- the title ----
// The town is already there behind it, Lili at her door. Any tap, click, key or pad button plays: a five year old taps
// wherever, and the first touch is also what lets the browser make sound. ?play skips it (tests), as does the studio.
const title = document.getElementById('title');
function play() {
  if (!ui.title) return;
  ui.title = false; document.body.classList.remove('title'); title.classList.add('gone');
  setTimeout(() => title.classList.add('hidden'), 500);
  A.initAudio(); A.music();
}
if (!STUDIO && !params.has('play')) {
  ui.title = true; document.body.classList.add('title'); title.classList.remove('hidden');
  for (const sp of title.querySelectorAll('h1 span')) sp.innerHTML = [...sp.textContent].map((ch, i) => (ch === ' ' ? ' ' : `<i style="--i:${i}">${ch}</i>`)).join('');
  title.addEventListener('click', play);
  window.addEventListener('keydown', (e) => { if (!ui.title) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) play(); }, true);
}

// ------------------------------------------------------------------ studio --
// What the buttons do. Each pose is the same state the game puts him in, so what is tuned here is what is played.
const POSES = {
  hello() { if (dog.air) return; dog.state = 'paws'; dog.stT = 1.15; dog.vx = dog.vy = 0; dog.runT = 0; hearts(dog.x + Math.cos(dog.heading) * 40, dog.y + Math.sin(dog.heading) * 40, 110); },
  bonk() {
    if (dog.air) return;
    const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading);
    dog.vx = -hx * 170; dog.vy = -hy * 170; dog.state = 'daze'; dog.stT = 0.75; dog.runT = 0; dog.zoom = false;
    A.bonk(); stars(dog.x + hx * 20, dog.y + hy * 20, dog.z + 70, 7);
  },
  bow() { dog.bow = 1.3; dog.idleT = 0; },
  shake() { dog.shake = 1.4; dog.idleT = 0; },
  point() { studio.point = !studio.point; },
};
const VIEWS = { low: [420, 0.12], game: [520, 0.62], top: [620, 1.45] };
const SPEEDS = [1, 0.5, 0.25, 0.1];
function drawStudio() {
  const sp = Math.hypot(dog.vx, dog.vy);
  const rows = [
    `${dog.state}${dog.air ? ' · air' : ''}${dog.zoom ? ' · zoomies' : ''}${dog.skid ? ' · brakes' : ''}${dog.point ? ' · point' : ''}${dog.bow > 0 ? ' · bow' : ''}${dog.shake > 0 ? ' · shake' : ''}`,
    `speed ${sp.toFixed(0)}   height ${dog.z.toFixed(0)}   stride ${dog.gait.toFixed(2)}`,
    `gait ${studio.gait}   time ×${studio.paused ? 0 : studio.speed}`,
  ];
  c.font = '600 14px ui-monospace, Menlo, Consolas, monospace'; c.textBaseline = 'top';
  rows.forEach((r, i) => { c.fillStyle = 'rgba(30,50,40,.8)'; c.fillText(r, 14, 12 + i * 19); });
}
function initStudio() {
  document.getElementById('btn-car').remove();
  document.getElementById('keys').textContent = '1 2 3 view · wheel zoom · G gait · T slow · P pause · . step · H N V K C poses';
  const bar = document.createElement('div'); bar.id = 'studio'; document.getElementById('ui').append(bar);
  const btn = (label, fn, on) => {
    const b = document.createElement('button'); b.textContent = label; bar.append(b);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.initAudio(); fn(); refresh(); });
    b.isOn = on; return b;
  };
  const gap = () => bar.append(document.createElement('span'));
  const view = (k) => { [S.studioCam.dist, S.studioCam.elev] = VIEWS[k]; studio.view = k; };
  const all = [];
  for (const k of Object.keys(VIEWS)) all.push(btn(k, () => view(k), () => studio.view === k));
  all.push(btn('+', () => zoomBy(0.8)), btn('−', () => zoomBy(1.25))); gap();
  for (const g of ['auto', 'trot', 'gallop']) all.push(btn(g, () => { studio.gait = g; }, () => studio.gait === g)); gap();
  for (const s of SPEEDS) all.push(btn('×' + s, () => { studio.speed = s; studio.paused = false; }, () => !studio.paused && studio.speed === s));
  all.push(btn('pause', () => { studio.paused = !studio.paused; }, () => studio.paused), btn('step', () => { studio.paused = true; studio.step = true; })); gap();
  for (const k of Object.keys(POSES)) all.push(btn(k, POSES[k], k === 'point' ? () => studio.point : null));
  function refresh() { for (const b of all) b.classList.toggle('on', !!b.isOn?.()); }
  function zoomBy(k) { S.studioCam.dist = clamp(S.studioCam.dist * k, 140, 1600); studio.view = null; }
  const KEYS = {
    Digit1: () => view('low'), Digit2: () => view('game'), Digit3: () => view('top'),
    KeyG: () => { studio.gait = { auto: 'trot', trot: 'gallop', gallop: 'auto' }[studio.gait]; },
    KeyT: () => { studio.speed = SPEEDS[(SPEEDS.indexOf(studio.speed) + 1) % SPEEDS.length]; studio.paused = false; },
    KeyP: () => { studio.paused = !studio.paused; }, Period: () => { studio.paused = true; studio.step = true; },
    KeyR: () => { for (const o of world.people) o.heading += Math.PI / 4; },
    KeyH: POSES.hello, KeyN: POSES.bonk, KeyV: POSES.bow, KeyK: POSES.shake, KeyC: POSES.point,
  };
  window.addEventListener('keydown', (e) => { const f = KEYS[e.code]; if (f && !e.repeat) { f(); refresh(); } });
  window.addEventListener('wheel', (e) => { zoomBy(e.deltaY > 0 ? 1.1 : 0.9); refresh(); }, { passive: true });
  // Recordings waiting to be chosen: sounds/lili/ is not in the repository, so this only shows where the files are.
  // There are thirty of them, so they stay folded away behind one button.
  fetch(new URL('../sounds/lili/index.json', import.meta.url)).then(r => r.ok ? r.json() : []).then((list) => {
    if (!list.length) return;
    let open = false; const row = [];
    const show = () => { for (const e of row) e.style.display = open ? '' : 'none'; };
    gap(); btn('recordings', () => { open = !open; show(); }, () => open);
    const br = document.createElement('i'); br.style.flexBasis = '100%'; bar.append(br); row.push(br);
    for (const c of list) {
      const b = btn(c.label, () => { A.playClip(new URL('../sounds/lili/' + c.file, import.meta.url).href); dog.barkT = Math.min(0.5, c.dur); dog.idleT = 0; });
      if (!c.dog) b.style.opacity = 0.55;
      row.push(b);
    }
    show(); refresh();
  }).catch(() => {});
  view('low'); refresh();
  G.studio = studio; G.api.pose = (k) => POSES[k]();
}
if (STUDIO) initStudio();

// ---- keeping it smooth on a slow tablet ----
// The frame time is watched while playing (not on the title, in the book or the studio): averaged over 3 s, slower than
// SLOW (45 frames a second), the next level of QUALITY is taken: fewer 3D pixels first, then plainer shadows, and last
// no shadows. It never goes back up in a visit, and the level is kept for the next one (QKEY). ?quality=N sets the
// level and stops the watching; ?fps shows the frame rate, the level and what a frame draws.
const QUALITY = [{ dpr: 2, shadow: 'soft' }, { dpr: 1.5, shadow: 'soft' }, { dpr: 1.25, shadow: 'hard' }, { dpr: 1, shadow: 'hard' }, { dpr: 1, shadow: 'off' }];
const SLOW = 1 / 45, QKEY = 'lili-quality-1', SHOW_FPS = params.has('fps');
const perf = { level: 0, sum: 0, n: 0, settle: 3, fps: 60 };
function setLevel(l) {
  perf.level = clamp(l, 0, QUALITY.length - 1); S.setQuality(QUALITY[perf.level]); perf.settle = 2; perf.sum = perf.n = 0;
  if (!params.has('quality')) try { localStorage.setItem(QKEY, String(perf.level)); } catch {}
}
{
  let l = Number(params.get('quality') ?? (() => { try { return localStorage.getItem(QKEY); } catch { return null; } })() ?? 0);
  if (Number.isFinite(l) && l > 0) setLevel(l);
}
function watchFrames(raw) {
  perf.fps = lerp(perf.fps, 1 / Math.max(raw, 1e-3), 0.05);
  if (ui.title || ui.book || STUDIO || params.has('quality') || raw > 1) return;   // (a gap of a second or more is a hidden tab, not slowness)
  if ((perf.settle -= raw) > 0) return;
  perf.sum += raw; perf.n++;
  if (perf.sum < 3) return;
  const avg = perf.sum / perf.n; perf.sum = perf.n = 0;
  if (avg > SLOW && perf.level < QUALITY.length - 1) setLevel(perf.level + 1);
}
function drawFps() {
  const st = S.stats(), { w, h } = S.view;
  c.font = '700 14px ui-monospace, Menlo, monospace'; c.textAlign = 'left'; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(8, h - 92, 300, 24);
  c.fillStyle = '#fff'; c.fillText(`${Math.round(perf.fps)} fps · level ${perf.level} · ${st.calls} calls · ${Math.round(st.triangles / 1000)}k tri`, 14, h - 75);
}

let last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now; watchFrames(raw);
  pollPad(); if (ui.title) input.stick = null;           // on the title a pad's buttons play, its stick does nothing
  if (STUDIO) {
    const sdt = studio.step ? 1 / 60 : studio.paused ? 0 : dt * studio.speed; studio.step = false;
    if (sdt) update(sdt);
    S.render(G, sdt);
    drawOverlay(G.t);
    requestAnimationFrame(frame);
    return;
  }
  if (ui.book) { S.render(G, 0); drawBook(now / 1000); requestAnimationFrame(frame); return; }   // the sticker book is open: the town waits
  update(dt);
  G.guide = wayTo();
  S.render(G, dt);
  drawOverlay(G.t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
