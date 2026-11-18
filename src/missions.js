// Jobs (docs/open-world-design.md, "Jobs for five to seven year olds"): each is a file in missions/ (listed in
// missions/list.txt), a header the game reads and notes for us below it. There is one job at a time, asked for by
// someone in town (`from`: an id in world/people.js; src/main.js has them ask). A job has a `level`; a level opens once
// enough stickers (jobs done) are earned, so nobody is stuck behind one job. Its `steps` are
// done in order, each one action from a small vocabulary with tags as targets (a spot's tag on a tile, a kind of person,
// a kind of thing), never places on the map, and each may want doing `count` times. The game tells the runner what
// happens (`event`); the runner checks the steps that depend on where she is itself (`update`). Nothing in Lili's or
// people's code knows about jobs.

// ---- reading the files ----
// The header is a small subset of YAML: `key: value`, `key: [a, b]`, and `steps:` followed by `  - action: target`
// items, each of which may go on with `    key: value` lines.
export function parseMission(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('mission: no header');
  const out = { steps: [] };
  let step = null, inSteps = false;
  const value = (v) => {
    v = v.trim();
    if (v.startsWith('[')) return v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    if (v.startsWith('"')) return v.slice(1, -1);
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  };
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(\w+):\s*(.*)$/), more = line.match(/^\s{3,}(\w+):\s*(.*)$/), top = line.match(/^(\w+):\s*(.*)$/);
    if (inSteps && item) { step = { action: item[1], target: value(item[2]) }; out.steps.push(step); }
    else if (inSteps && more && step) step[more[1]] = value(more[2]);
    else if (top) { inSteps = top[1] === 'steps'; if (!inSteps) out[top[1]] = value(top[2]); }
  }
  out.needs ||= []; out.level ||= 1; out.picture = [].concat(out.picture || []);
  for (const st of out.steps) if (st.picture) st.picture = [].concat(st.picture);
  return out;
}

export async function loadMissions() {
  const base = new URL('../missions/', import.meta.url);
  const list = (await (await fetch(new URL('list.txt', base))).text()).split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  return Promise.all(list.map(async (name) => parseMission(await (await fetch(new URL(`${name}.md`, base))).text())));
}

// ---- running them ----
// How near counts as "there", for each kind of step.
const NEAR = { go: 120, drive: 350, poo: 110, bring: 130, at: 260 };   // drive: the road in front of a building counts
// Stickers needed before a level's jobs open.
export const LEVEL_AT = { 1: 0, 2: 2, 3: 7, 4: 13 };
// Steps whose target is a place (a spot's tag); every other step's target is a kind of thing or person.
const PLACE = { go: 1, drive: 1, poo: 1 };

export function makeRunner(missions, world, hooks = {}) {
  const done = new Set(), seen = new Set(), lamps = (world.tiles || []).flatMap((t) => t.things.lamps);
  let job = null, at = 0, n = 0, quiet = 0;
  const spots = (tag) => world.spots.filter((s) => s.tag === tag);
  const nearSpot = (tag, x, y, r) => spots(tag).some((s) => Math.hypot(s.x - x, s.y - y) < r);
  const unlocked = (level) => done.size >= (LEVEL_AT[level] ?? 0);
  const available = (m) => unlocked(m.level) && m.needs.every((q) => done.has(q));
  const step = () => (job ? job.steps[at] : null);
  // the place a step is about, if it has one: where to go, where to bring, where to do it
  const place = (s) => (PLACE[s.action] ? s.target : s.to || s.at);
  const fits = (s, type, d) => {
    if (s.action !== type) return false;
    if (PLACE[type]) return nearSpot(s.target, d.x, d.y, NEAR[type]);
    if (s.target && s.target !== 'any' && s.target !== d.kind) return false;
    if (s.from && s.from !== d.from) return false;
    if (s.to && !nearSpot(s.to, d.x, d.y, NEAR.bring)) return false;
    if (s.at && !nearSpot(s.at, d.x, d.y, NEAR.at)) return false;
    return !(d.id && seen.has(d.id));                  // the same pot, person or bone counts once
  };
  const advance = () => {
    const m = job, s = step();
    n++; quiet = 0;
    if (n < (s.count || 1)) { hooks.progress?.(m, s, n); return; }
    n = 0; seen.clear(); at++;
    if (at < m.steps.length) { hooks.step?.(m, m.steps[at]); return; }
    const first = !done.has(m.id), levels = runner.levels().filter((l) => !unlocked(l));
    done.add(m.id); job = null; at = 0;
    hooks.done?.(m, first, levels.filter(unlocked));
  };
  const runner = {
    missions,
    done,
    job: () => job,
    step,
    // how far the step in hand has got: which step, how many times done, of how many
    progress: () => ({ i: at, n, count: step()?.count || 1 }),
    quiet: () => quiet,
    levels: () => [...new Set(missions.map((m) => m.level))].sort((a, b) => a - b),
    unlocked,
    available,
    missing: (level) => Math.max(0, (LEVEL_AT[level] ?? 0) - done.size),
    // take a job in hand (from the start)
    start(m) { job = m; at = 0; n = 0; seen.clear(); quiet = 0; hooks.start?.(m); },
    stop() { job = null; },
    // the step in hand, if it is this action: what the game may offer to do (a poo on the table, dropping what she
    // carries at home)
    wants: (action) => { const s = step(); return s && s.action === action ? s : null; },
    // is (x, y) at the place the step in hand is about?
    near: (x, y) => { const s = step(), tag = s && place(s); return !!tag && nearSpot(tag, x, y, NEAR[s.action] || NEAR.at); },
    // something happened: { kind, x, y, id, from }. kind: what or who it was about; id: the thing itself, so that it
    // counts once; from: who a thing was taken from.
    event(type, d = {}) {
      if (!job) return;
      if (job.careful === type && (n || at)) { n = 0; at = 0; seen.clear(); quiet = 0; hooks.oops?.(job); return; }
      if (!fits(step(), type, d)) return;
      if (d.id) seen.add(d.id);
      advance();
    },
    // steps that are about where she is: go somewhere on foot, drive somewhere
    update(dt, dog, car) {
      const s = step(); if (!s) return;
      quiet += dt;
      if (s.action === 'go' && dog.state !== 'drive' && nearSpot(s.target, dog.x, dog.y, NEAR.go)) advance();
      else if (s.action === 'drive' && dog.state === 'drive' && nearSpot(s.target, car.x, car.y, NEAR.drive)) advance();
    },
    // where to go next for the step in hand: the nearest place or thing it needs, or null if it can be done anywhere.
    // A drive needs the car first, a take the person holding the thing, a bring the thing first if she has not got it.
    target(dog, car) {
      const s = step(); if (!s) return null;
      const me = dog.state === 'drive' ? car : dog;
      const from = (list) => list.reduce((b, p) => (!b || Math.hypot(p.x - me.x, p.y - me.y) < Math.hypot(b.x - me.x, b.y - me.y) ? p : b), null);
      // (a step with `at` only wants the things there: bones in the woods, not the nearest bone in town)
      const things = (kind) => world.props.filter((o) => o.kind === kind && !o.gone && !seen.has(o) && (!s.at || nearSpot(s.at, o.x, o.y, NEAR.at)));
      const thing = (kind) => { const o = from(things(kind)); return o && o.held ? o.held : o; };
      const spot = (tag) => from(spots(tag));
      switch (s.action) {
        case 'drive': return dog.state === 'drive' ? spot(s.target) : { x: car.x, y: car.y };
        case 'take': case 'pick': return dog.carry && dog.carry.kind === s.target ? null : thing(s.target);
        case 'bring': return dog.carry && dog.carry.kind === s.target ? spot(s.to) : thing(s.target);
        case 'greet': {
          // whoever will love her however she says hello (dog lovers, children) before those who want her calm
          const all = world.people.filter((o) => o.nature !== 'nervous' && !seen.has(o) && (!s.target || s.target === 'any' || s.target === o.who));
          return from(all.filter((o) => o.nature === 'lover' || o.who === 'child')) || from(all);
        }
        case 'scare': return from(world.people.filter((o) => !seen.has(o)));
        case 'chase': return from(world.flocks.filter((f) => f.state === 'ground'));
        case 'smash': return thing(s.target);
        case 'knock': return s.target === 'lamp' ? from(lamps.filter((o) => !o.fallen)) : thing(s.target);
        case 'hop': return from(world.platforms.filter((o) => o.kind === s.target && !o.off && !seen.has(o)).map((o) => ({ x: (o.ax + o.bx) / 2, y: (o.ay + o.by) / 2 })));
        case 'fetch': return dog.carry && dog.carry.kind === s.target ? dog.carry.owner || null : thing(s.target);   // the thrown thing, then back to whoever throws it
        case 'collect': return thing('bone') || thing('mound');
        case 'dig': return thing('mound');
        case 'swim': case 'splash': return spot(s.at || 'lake');
        case 'shake': return dog.swim ? spot('shore') : dog.shakeWet > 0 ? null : spot('lake');
        default: { const tag = place(s); return tag ? spot(tag) : null; }
      }
    },
    // what is kept between visits, and putting it back
    // (a job in hand is not kept: the game opens with exploring, and whoever asked for it asks again)
    state: () => ({ done: [...done] }),
    restore(st) {
      for (const id of st.done || []) if (missions.some((m) => m.id === id)) done.add(id);
    },
  };
  return runner;
}
