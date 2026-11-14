// The game: one very busy cocker spaniel, a small town, and nothing he has to do.
// Everything here works on a flat map (x east, y south, z = height). scene.js draws it.
import * as S from './scene.js';
import * as A from './audio.js';
import * as Art from './art.js';
import { input, keyVector, steerMag, initInput } from './input.js';
import { pollPad } from './gamepad.js';
import { spawn, updateFx, drawFx, burst } from './fx.js';
import { buildTown, pushOut, floorAt, platDist, KINDS, BOUNDS } from './world.js';
import { CAR, PERSON_LOOKS, isChild } from './models.js';
import { clamp, lerp, dist, easeInOut, TAU } from './util.js';

const DOG_R = 30, GRAV = 1900, JUMP_V = 430, JUMP_UP = 560;
// a spaniel's trot and flat-out run for her size (84 game units to the metre: 2.5 and 5.5 m/s); flat out is the simulated gallop's own speed
const TROT = 210, ZOOM = 460, ZOOM_AFTER = 0.9;      // run flat out for this long and he gets the zoomies
// the about-turn's slide takes a third of a second from flat out, down to SKID_END, whatever her top speed
const BRAKE = ZOOM * 2.3, SKID_END = ZOOM * 0.23;
const BONK = ZOOM * 0.73;                                    // faster than this into something solid and he sees stars
const CAR_TOP = 900;

const world = buildTown();
const params = new URLSearchParams(location.search);
// ?studio: an empty floor and a close camera, for working on how he moves (see the end of this file)
const STUDIO = params.has('studio');
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
  x: world.start.x, y: world.start.y, z: 0, vx: 0, vy: 0, vz: 0, heading: -Math.PI / 2,
  state: 'idle', stT: 0,            // idle (on his feet) | paws (up on someone) | daze | hop (in or out of the car) | drive
  air: false, zoom: false, runT: 0, footfall: false, stepAt: 0, gait: 0, skid: false, sweepT: 9, ptrX: 0, ptrY: 0, push: false, shake: 0, fidget: 0,
  lookYaw: 0, lookPitch: 0, seen: null, thought: 0, point: 0,
  barkT: 0, landT: 0, spring: 0, bow: 0, idleT: 0, happy: 0, excited: 0, hop: null, carV: 0, carSteer: 0, dustT: 0,
};
const car = { ...world.car, v: 0, steer: 0, bump: 0, on: false, rev: false, skidT: 0 };
const G = { t: 0, mess: 0, birds: 0, pop: 0, dog, car, world, props: world.props, people: world.people, flocks: world.flocks, debris: [], focus: { x: dog.x, y: dog.y, vx: 0, vy: 0, zoom: 1 }, input };
window.__G = G;

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
function land(fromHop) {
  dog.air = false; dog.vz = 0; dog.landT = 0.22;
  dust(dog.x, dog.y, 6); A.land();
  const [, on] = floorAt(world, dog.x, dog.y, dog.z);
  if (on) on.wob = Math.max(on.wob, 0.6);
  // landing on the car is as good as opening the door
  if (!fromHop && on === world.carPlat) enterCar();
}

function jump() {
  if (dog.state === 'drive') { leaveCar(); return; }
  if (dog.air || dog.spring > 0 || (dog.state !== 'idle' && dog.state !== 'paws')) return;
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
}
function takeOff() {
  const sp = Math.max(Math.hypot(dog.vx, dog.vy), 240);
  dog.vx = Math.cos(dog.heading) * sp; dog.vy = Math.sin(dog.heading) * sp;
  dog.vz = dog.high ? JUMP_UP : JUMP_V; dog.air = true; dog.flight = 2 * dog.vz / GRAV;
  A.jump(); dust(dog.x, dog.y, 4);
}

function bark() {
  if (dog.state === 'daze' || dog.state === 'hop') return;
  const driving = dog.state === 'drive';
  dog.barkT = 0.26; dog.bow = 0; dog.idleT = 0;
  if (driving) A.horn(); else A.bark();
  const hx = Math.cos(dog.heading), hy = Math.sin(dog.heading);
  for (let i = 0; i < 3; i++) spawn({ type: 'ring', x: dog.x + hx * 70, z: dog.y + hy * 70, y: dog.z + 70, vx: hx * 260, vz: hy * 260, drag: 2, life: 0.45, delay: i * 0.07, size: 10, grow: 90, color: '#ffffff', alpha: 0.9 });
  for (const f of world.flocks) if (f.state === 'ground' && dist(f.x, f.y, dog.x, dog.y) < (driving ? 650 : 520)) flyAway(f);
  // a bark close by frightens; never wins love
  for (const o of world.people) if (dist(o.x, o.y, dog.x, dog.y) < 400 && o.cool <= 0 && (o.state === 'walk' || o.state === 'stand')) respond(o, reaction(o, 'bark', false));
}

function updateDog(dt) {
  const p = dog;
  p.barkT = Math.max(0, p.barkT - dt); p.landT = Math.max(0, p.landT - dt); p.thought = Math.max(0, p.thought - dt);
  p.happy = Math.max(0, p.happy - dt); p.excited = Math.max(0, p.excited - dt); p.bow = Math.max(0, p.bow - dt); p.shake = Math.max(0, p.shake - dt);
  if (p.state === 'hop') { updateHop(dt); return; }
  if (p.state === 'drive') return;                    // the car carries him (updateCar)
  if (p.state !== 'idle') { p.stT -= dt; if (p.stT <= 0) { if (p.state === 'paws') p.happy = 2; else if (p.state === 'daze') p.shake = 1.4; p.state = 'idle'; } }

  let st = p.state === 'idle' ? steering(p.x, p.y, 34) : ZERO;
  const sp0 = Math.hypot(p.vx, p.vy);
  // A pointer that sits near her means "come here, slowly". One that is being swept past her on its way to the
  // other side is near her too, for a moment, and means nothing of the kind: while it is moving and she is
  // galloping she keeps going flat out, so the reversal finds her at full speed and she has to brake.
  p.sweepT = input.pointerDown && Math.hypot(input.sx - p.ptrX, input.sy - p.ptrY) > 350 * dt ? 0 : p.sweepT + dt;
  p.ptrX = input.sx; p.ptrY = input.sy;
  if (p.zoom && input.pointerDown && p.sweepT < 0.3 && sp0 > 1) st = st.mag ? { x: st.x, y: st.y, mag: 1 } : { x: p.vx / sp0, y: p.vy / sp0, mag: 1 };
  if (p.spring > 0) {                                  // the run-up to a jump: straight on, as fast as she can, whatever the pointer says
    if (p.state !== 'idle' || p.air) p.spring = 0;
    else {
      p.spring -= dt; p.skid = p.push = false;
      st = p.still ? ZERO : st.mag ? { x: st.x, y: st.y, mag: 1 } : { x: Math.cos(p.heading), y: Math.sin(p.heading), mag: 1 };
      if (p.spring <= 0) takeOff();
    }
  }
  watchBirds(st, dt);
  if (st.mag || p.air) p.shake = 0;

  // ---- zoomies: keep running flat out and he tips over into a mad gallop ----
  if (st.mag > 0.85 && sp0 > TROT * 0.6) p.runT += dt; else p.runT = 0;
  const chase = p.seen && st.mag > 0.5 && st.x * Math.cos(p.birdDir) + st.y * Math.sin(p.birdDir) > 0.75;
  if (chase) p.runT = Math.max(p.runT, ZOOM_AFTER);
  if (studio.gait === 'trot') p.runT = 0; else if (studio.gait === 'gallop' && st.mag > 0.5 && !p.push) p.runT = ZOOM_AFTER;
  const was = p.zoom; p.zoom = p.runT >= ZOOM_AFTER && p.state === 'idle';
  if (p.zoom && !was) { A.whoosh(); dust(p.x, p.y, 8, { speed: 110 }); }

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
    const top = (p.zoom ? ZOOM : TROT) * st.mag * (p.zoom ? 1 : clamp(Math.cos(off), 0.1, 1)), k = 1 - Math.exp(-dt * (p.state !== 'idle' ? 12 : p.zoom ? 4.5 : 9));
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
  const hit = pushOut(world, p, DOG_R);
  if (hit) {
    const into = -(p.vx * hit.nx + p.vy * hit.ny);
    if (into > BONK && hit.o && p.state === 'idle') {
      p.vx = hit.nx * 170; p.vy = hit.ny * 170; p.state = 'daze'; p.stT = 0.75; p.runT = 0; p.zoom = false;
      A.bonk(); stars(p.x - hit.nx * 20, p.y - hit.ny * 20, p.z + 70, 7); shake(hit.o);
    } else if (into > 0) { p.vx += hit.nx * into; p.vy += hit.ny * into; }
  }

  // ---- nothing to do? Ask for a game. ----
  if (p.state === 'idle' && !st.mag && !p.air && !p.point && !p.happy) {
    p.idleT += dt;
    if (p.idleT > 4.5) { p.idleT = 0; if (p.fidget++ % 2) p.shake = 1.4; else p.bow = 1.3; }
  } else p.idleT = 0;
}

// Birds. He cannot not look at them.
const POINT_FOR = 3.5, POINT_EVERY = 16;
function watchBirds(st, dt) {
  const p = dog;
  let best = null, bd = 760;
  for (const f of world.flocks) { const d = dist(f.x, f.y, p.x, p.y); if (d < bd && f.h < 420) { bd = d; best = f; } }
  let yaw = 0, pitch = 0; p.point = 0;
  if (best && p.state !== 'daze' && p.state !== 'paws') {
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
      const hit = pushOut(world, q, CAR.r);
      if (!hit) continue;
      c.x += q.x - x0; c.y += q.y - y0;
      const into = -(hx * hit.nx + hy * hit.ny) * c.v;
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
const SOUND = { cone: A.cone, bin: A.bin, box: A.box, ball: A.boing, plate: A.cone, pot: A.smash };
function messUp(o) {
  if (!KINDS[o.kind].mess || o.messed) return;
  o.messed = true; G.mess++; G.pop = 1;
}
function smashProp(o) {
  o.gone = true; messUp(o); A.smash();
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
  messUp(o); SOUND[o.kind](); dust(o.x, o.y, 3);
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
    if (o.gone) continue;
    const K = KINDS[o.kind];
    o.wob = Math.max(0, o.wob - dt * 3);
    if (!o.rest) {
      o.cool -= dt; o.vz -= GRAV * dt;
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
    } else if (o.z > 0) {
      // something resting up high falls when what it was on has gone
      const held = floorAt(world, o.x, o.y, o.z)[0] >= o.z - 1 || world.props.some((q) => q !== o && q.rest && !q.gone && Math.abs(q.z + KINDS[q.kind].h - o.z) < 6 && dist(q.x, q.y, o.x, o.y) < 40);
      if (!held) { o.rest = false; o.cool = 0; }
    }
    for (const m of movers) {
      if (m.z > o.z + K.h || m.z + m.top < o.z) continue;
      const dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy) || 0.01, min = m.r + K.r;
      if (d >= min) continue;
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
  if (r === 'love') { o.state = dist(o.x, o.y, dog.x, dog.y) > 75 ? 'approach' : 'love'; o.heading = o.state === 'love' ? toDog : o.heading; if (o.state === 'love') { A.aww(); hearts(o.x, o.y, 120); } }
  else if (r === 'scared') { o.state = 'scared'; o.runDir = toDog + Math.PI; A.scream(isChild(o.look)); }
  else { o.state = baseState(o); o.glance = 1.4; }
}
function startle(o, x, y) {
  o.state = 'hop'; o.t = 0; o.from = { x: o.x, y: o.y };
  o.to = { x: clamp(x, BOUNDS.x0 + 30, BOUNDS.x1 - 30), y: clamp(y, BOUNDS.y0 + 30, BOUNDS.y1 - 30) };
  A.yelp();
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
    o.t += dt; o.cool = Math.max(0, o.cool - dt); o.wave = Math.max(0, (o.wave || 0) - dt); o.glance = Math.max(0, (o.glance || 0) - dt);
    o.home ||= { x: o.x, y: o.y };
    const dd = dist(o.x, o.y, dog.x, dog.y), toDog = Math.atan2(dog.y - o.y, dog.x - o.x);
    const face = (a, r) => { o.heading += angDiff(a, o.heading) * (1 - Math.exp(-dt * r)); };
    o.glanceYaw = clamp(angDiff(toDog, o.heading), -1.2, 1.2);
    const walkTo = (x, y, v) => { const d = dist(o.x, o.y, x, y) || 1, s = Math.min(d, v * dt); o.x += (x - o.x) / d * s; o.y += (y - o.y) / d * s; face(Math.atan2(y - o.y, x - o.x), 8); return d; };
    if (o.state === 'walk') {
      const w = o.walk;
      if (o.x > w.x1) w.dir = -1; if (o.x < w.x0) w.dir = 1;
      const vy = clamp(w.y - o.y, -40, 40);
      o.x += w.dir * 70 * dt; o.y += vy * dt; face(Math.atan2(vy, w.dir * 70), 6);
    } else if (o.state === 'stand') { if (dd < 420) face(toDog, 5); }
    else if (o.state === 'wobble') { face(toDog, 8); if (o.t > 1.15) respond(o, o.next || 'meh'); }
    else if (o.state === 'sit') { if (o.t > 1.6) respond(o, o.next || 'meh'); }
    else if (o.state === 'hop') {
      const k = clamp(o.t / 0.45, 0, 1);
      o.x = lerp(o.from.x, o.to.x, k); o.y = lerp(o.from.y, o.to.y, k);
      if (k >= 1) { if (o.next) respond(o, o.next); else o.state = baseState(o); o.next = null; }
    }
    else if (o.state === 'approach') { if (walkTo(dog.x, dog.y, 80) < 75 || o.t > 3) { o.state = 'love'; o.t = 0; A.aww(); hearts(o.x, o.y, 120); } }
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
    if (!onFoot() || dog.state === 'daze' || dog.z > 120) continue;
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
  const to = world.birdSpot([dog, car]);
  f.from = { x: f.x, y: f.y }; f.to = to; f.t = 0; f.T = 3.2 + dist(f.x, f.y, to.x, to.y) / 600;
  f.state = 'fly'; f.dir = Math.atan2(to.y - f.y, to.x - f.x);
  A.flutter(); G.birds += f.birds.length; G.pop = 1;
  for (let i = 0; i < 7; i++) spawn({ type: 'leaf', x: f.x + (Math.random() - 0.5) * 80, z: f.y + (Math.random() - 0.5) * 60, y: 20 + Math.random() * 40, vx: (Math.random() - 0.5) * 90, vy: 60, g: 110, drag: 1.5, life: 1.6, size: 6, rot: Math.random() * 6, vr: 5, color: '#DCE2EC' });
}
function updateBirds(dt) {
  for (const f of world.flocks) {
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
    if (world.people.length) { G.focus.x = 1860; G.focus.y = 1490; } else { G.focus.x = dog.x; G.focus.y = dog.y; }
    return;
  }
  updateCar(dt);
  updateProps(dt);
  updatePeople(dt);
  updateBirds(dt);
  for (const o of world.obstacles) o.wob = Math.max(0, o.wob - dt * 2.2);
  for (const o of world.platforms) o.wob = Math.max(0, o.wob - dt * 3);
  for (const t of world.trees) t.wob = Math.max(0, t.wob - dt * 1.6);
  updateFx(dt);
  const f = G.focus;
  if (dog.state === 'drive') { f.x = car.x; f.y = car.y; f.vx = Math.cos(car.heading) * car.v; f.vy = Math.sin(car.heading) * car.v; f.zoom = 1.2 + 0.4 * Math.abs(car.v) / CAR_TOP; }
  else { f.x = dog.x; f.y = dog.y; f.vx = dog.vx; f.vy = dog.vy; f.zoom = dog.zoom ? 1.12 : 1; }
  btnCar.classList.toggle('hidden', !(dog.state === 'drive' || nearCar()));
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
}

function resize() { S.resize(); hud.width = Math.round(S.view.w * S.view.dpr); hud.height = Math.round(S.view.h * S.view.dpr); }

// ---- wiring ----
function act(a) { A.initAudio(); if (a === 'jump') jump(); else if (a === 'bark') bark(); else carAction(); }
G.api = { jump, bark, car: carAction, knock, enterCar, leaveCar, flyAway };
input.onAction = act;
const btnCar = document.getElementById('btn-car'), btnMute = document.getElementById('btn-mute');
for (const [id, a] of [['btn-jump', 'jump'], ['btn-bark', 'bark'], ['btn-car', 'car']]) {
  document.getElementById(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); act(a); });
}
btnMute.addEventListener('click', () => {
  A.initAudio(); A.setMuted(!A.isMuted());
  document.getElementById('mute-waves').style.display = A.isMuted() ? 'none' : '';
  document.getElementById('mute-cross').style.display = A.isMuted() ? '' : 'none';
});

const canvas = document.getElementById('game');
S.initScene(canvas, world);
initInput(canvas);
window.addEventListener('resize', resize); resize();

const at = (params.get('at') || '').split(',').map(Number);
if (at.length === 2 && at.every(Number.isFinite)) { dog.x = at[0]; dog.y = at[1]; }
updateCar(0);
if (params.has('car')) enterCar();
update(0); S.snapCamera(G.focus);

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

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  pollPad();
  if (STUDIO) {
    const sdt = studio.step ? 1 / 60 : studio.paused ? 0 : dt * studio.speed; studio.step = false;
    if (sdt) update(sdt);
    S.render(G, sdt);
    drawOverlay(G.t);
    requestAnimationFrame(frame);
    return;
  }
  update(dt);
  S.render(G, dt);
  drawOverlay(G.t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
