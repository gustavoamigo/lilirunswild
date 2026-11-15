// Missions (docs/open-world-design.md, "Missions"): each is a file in missions/ (listed in missions/list.txt), a header
// the game reads and notes for us below it. A mission opens once the missions it `needs` are done; its `steps` are done
// in order, each one action from a small vocabulary with tags as targets (a spot's tag on a tile, a kind of person, a
// kind of thing), never places on the map. The game tells the runner what happens (`event`); the runner checks the
// steps that depend on where she is itself (`update`). Nothing in Lili's or people's code knows about missions.

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
    return v;
  };
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(\w+):\s*(.*)$/), more = line.match(/^\s{3,}(\w+):\s*(.*)$/), top = line.match(/^(\w+):\s*(.*)$/);
    if (inSteps && item) { step = { action: item[1], target: value(item[2]) }; out.steps.push(step); }
    else if (inSteps && more && step) step[more[1]] = value(more[2]);
    else if (top) { inSteps = top[1] === 'steps'; if (!inSteps) out[top[1]] = value(top[2]); }
  }
  out.needs ||= [];
  return out;
}

export async function loadMissions() {
  const base = new URL('../missions/', import.meta.url);
  const list = (await (await fetch(new URL('list.txt', base))).text()).split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  return Promise.all(list.map(async (name) => parseMission(await (await fetch(new URL(`${name}.md`, base))).text())));
}

// ---- running them ----
// How near counts as "there", for each kind of step.
const NEAR = { go: 120, drive: 350, poo: 110, bring: 110 };   // drive: the road in front of a building counts

export function makeRunner(missions, world, hooks = {}) {
  const done = new Set(), at = new Map(), opened = new Set();
  const isOpen = (m) => !done.has(m.id) && m.needs.every((n) => done.has(n));
  const spots = (tag) => world.spots.filter((s) => s.tag === tag);
  const near = (tag, x, y, r) => spots(tag).some((s) => Math.hypot(s.x - x, s.y - y) < r);
  const advance = (m) => {
    const i = (at.get(m.id) || 0) + 1;
    if (i < m.steps.length) { at.set(m.id, i); return; }
    done.add(m.id); at.delete(m.id); hooks.done?.(m);
    for (const n of missions) if (!opened.has(n.id) && isOpen(n)) { opened.add(n.id); hooks.open?.(n); }
  };
  const runner = {
    missions,
    done,
    open: () => missions.filter(isOpen),
    step: (m) => m.steps[at.get(m.id) || 0],
    // open steps of one kind of action, with their mission: what the game may offer to do (a poo on the table, dropping
    // what she carries at home)
    wants: (action) => runner.open().map((m) => ({ m, s: runner.step(m) })).filter((w) => w.s.action === action),
    // is (x, y) near a spot this step aims at?
    near: (w, x, y) => near(w.s.action === 'bring' ? w.s.to : w.s.target, x, y, NEAR[w.s.action] || 120),
    // something happened. poo: { x, y }; take: { thing, from: 'child' | 'adult' }; bring: { thing, x, y };
    // greet / scare / bark: { who: 'child' | 'adult' }
    event(type, d) {
      for (const w of runner.wants(type)) {
        const s = w.s;
        const ok = type === 'poo' ? runner.near(w, d.x, d.y)
          : type === 'take' ? s.target === d.thing && (!s.from || s.from === d.from)
          : type === 'bring' ? s.target === d.thing && runner.near(w, d.x, d.y)
          : !s.target || s.target === d.who;
        if (ok) advance(w.m);
      }
    },
    // steps that are about where she is: go somewhere on foot, drive somewhere
    update(dog, car) {
      for (const w of runner.wants('go')) if (dog.state !== 'drive' && runner.near(w, dog.x, dog.y)) advance(w.m);
      for (const w of runner.wants('drive')) if (dog.state === 'drive' && runner.near(w, car.x, car.y)) advance(w.m);
    },
    // where to go next for an open mission, from (x, y): the nearest place its step needs. A drive needs the car first,
    // a take the person holding the thing, a bring the thing first if she does not have it.
    target(m, dog, car) {
      const s = runner.step(m), from = (list) => list.reduce((b, p) => (!b || Math.hypot(p.x - dog.x, p.y - dog.y) < Math.hypot(b.x - dog.x, b.y - dog.y) ? p : b), null);
      if (s.action === 'drive') return dog.state === 'drive' ? from(spots(s.target)) : { x: car.x, y: car.y };
      if (s.action === 'take') return from(world.people.filter((o) => o.holds && o.holds.kind === s.target));
      if (s.action === 'bring') return dog.carry && dog.carry.kind === s.target ? from(spots(s.to)) : from(world.props.filter((o) => o.kind === s.target && !o.gone));
      if (s.action === 'greet' || s.action === 'scare') return from(world.people);
      return from(spots(s.target));
    },
    start() { for (const m of missions) if (isOpen(m)) { opened.add(m.id); hooks.open?.(m); } },
  };
  return runner;
}
