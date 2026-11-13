# Tech

Three.js r170 (vendored), plain ES modules, no build step, and no asset files but sounds (`sounds/CREDITS.md`): the bark is a soundfont sample, because a synthesised bark did not sound like a dog, and `sounds/lili-growl-*.wav` are Lili's own play growl, the sound she makes pulling on something. There is nothing to pull on yet, so for now it plays with the play bow. Same architecture as wheek.

## Files

| File | Holds |
|---|---|
| `index.html`, `style.css` | Two canvases (`#game` 3D, `#hud` 2D overlay) and the buttons |
| `src/main.js` | Game state `G`, the dog, the car, props, people, birds, the overlay, the frame loop |
| `src/world.js` | The town as data: obstacles, platforms, props, people, flocks; `pushOut`, `floorAt` |
| `src/scene.js` | The 3D view: camera, lights, everything placed from the flat map each frame |
| `src/models.js` | Dog, car, people, birds, props, trees, houses, all assembled from simple shapes |
| `src/ground.js` | The ground painted into one texture |
| `src/art.js` | 2D drawing for the overlay (bubbles, counters, icons) |
| `src/fx.js` | Overlay particles (dust, stars, hearts, leaves) |
| `src/audio.js` | Synthesised sound (WebAudio) |
| `src/input.js`, `src/gamepad.js` | Keys, pointer, pad |
| `src/style.js` | `?style=real` (default) or `toon` |
| `tools/serve.py` | Local server with caching off |
| `tools/sim/` | Lili's skeleton in a physics engine, to capture movement from instead of posing it (see below) |

## Coordinates and camera

Logic is on a flat map: `x` east, `y` south, `z` height. In the scene, map `y` is three.js `z` and height is three.js `y`. Models face +x; `root.rotation.y = -heading`.

The camera looks north from above and behind, never turns, leads the dog by 0.3 s of his velocity and backs off at speed and in the car (`G.focus.zoom`). On a narrow screen it backs off further (`fit`). Leaves between the camera and the dog, and trees in the near foreground, fade.

## How the dog moves (`updateDog`)

Constants at the top of `src/main.js`: `TROT` 420, `ZOOM` 640 (after `ZOOM_AFTER` 0.9 s flat out), `JUMP_V` 430, `GRAV` 1900 (a leap about 45 high and 0.45 s long), `JUMP_UP` 560 (about 82 high, used when there is something to get up onto ahead), `BONK` 470 (speed into a solid thing that dazes him), `CAR_TOP` 900.

- On the ground, velocity eases toward steering × top speed: fast at a trot, slowly in zoomies (that is the skid).
- In the air it eases toward steering at no less than 0.75 × `TROT`.
- Solid things are circles (`world.obstacles`) and capsules with a flat top (`world.platforms`: benches, table, the parked car). A platform is solid from the side and floor from above (`floorAt`).
- States: `idle`, `paws`, `daze`, `hop` (scripted arc into and out of the car), `drive`. The model reads the state and velocity and blends its own pose (`makeDog().update`).

## URL parameters

`?style=toon|real`, `?at=x,y` (start there), `?car` (start driving), `?studio` (below).

## How the dog moves (`makeDog` in `src/models.js`)

On the ground nothing is recorded or key-framed; only a jump plays motion data (`src/moves.js`, below). The legs are solved every frame:

- **Paws stand on the ground.** Each paw has a place in map coordinates. While it stands it does not move; the leg is bent to reach from the joint to the paw. Each leg has three bones in the proportions of the simulated skeleton, scaled to her leg height (`BONES` in `src/moves.js`): upper arm, forearm, pastern; thigh, shin and the bone below the hock. Three bones can reach a paw in many ways, so `solve()` sets the lowest by rule (it leans with the leg, the pastern folds back as a forepaw lifts, the hock sinks as a hind leg folds) and the other two then have one answer (elbow back, knee forward). A paw that cannot be reached any more lifts.
- **The stride follows the ground.** The gait cycle advances with the distance the paws have to cover (the average speed of the four rest positions, so turning on the spot counts), never with the clock. When a paw's turn comes it swings to a spot ahead of its shoulder: half of what the shoulder will cover while the paw stands. Trot is diagonal pairs; gallop is hind pair, front pair, then all four off the ground. Faster means a longer stride and a shorter share of it on the ground.
- **Standing still**, any paw left more than a few units from its rest position steps back under the body.
- **Poses** (jump, hello, bow, point, daze, driving) hold a paw at an angle and length from its joint instead; each paw blends between the pose and its place on the ground.
- **Body skin.** Chest, back, belly and rump are one surface (`torsoGeo`), not separate shapes. Each frame `bendBody` moves its vertices: the rump end with the rear half of the spine, the chest end with the front half, blended between. Tail likewise has one surface (`TAIL`); neck, head, ears and legs are still ellipsoids.
- **Turning.** In `updateDog` the heading turns towards the stick at a limited rate (8.5 rad/s trotting, 5.5 galloping, 4 in the air) and the velocity follows the heading, so a change of direction is a curve; trotting, speed drops with the angle still to turn, so an about-turn is walked round almost on the spot. The model reads the turn rate: the spine bends in the middle, the head and tail lead into the turn, and the body leans in at speed.
- **Jump.** `jump()` does not lift her: it sets `dog.spring` and decides `dog.high` (a bench, the table or the car within about half a second ahead of where she will leave the ground). From a stand (`dog.still`) she stays where she is for 0.34 s and plays the start of a captured move: she sinks, rocks back and drives off her hind legs. From a run the run-up is 0.3 s down to 0.12 s at a trot or faster, straight on at full strength whatever the pointer says, with a posed gather over the last 0.11 s. `takeOff()` launches her at the speed she has (at least 240) with `JUMP_V`, or `JUMP_UP` when `dog.high`. In the air she plays the flight of the capture (`stand` or `high` in `src/moves.js`): each frame gives her tilt, the bend of her back and, for each leg, the angles of its three bones against her body. The flight is stretched to the time she is really in the air (`dog.flight`, and `dog.eta`, the time left until she is down), so landing on a bench still ends on the landing frame. The ground stops any paw. Off a run her tilt is scaled to 0.7. A fall off an edge starts the capture from its top. After landing the legs blend back to the ground. `python tools/sim/export.py` writes `src/moves.js` from `tools/sim/out/`. The hop into the car is still posed by hand. The ears take 70% of her rise and fall with them and are flapped a fifth as much as on the ground, so they hang and trail instead of rising like wings.
- **About-turn at a gallop.** Asking for a direction more than about 115° off her travel while galloping (faster than 330) sets `dog.skid`: she brakes at `BRAKE` 1500 with the front legs braced and the haunches low. Below 150 the brake hands over to `dog.push`: she is back at a trot and steps round as in any trot turn, and once she faces within 0.45 rad of where she is going she pushes off at 330, straight into the gallop. Letting go of the stick, a jump or a bump ends it. With the pointer, steering strength falls with the pointer's distance from her, so a pointer dragged across her to the other side used to read as "slow down" and she had lost the gallop before it was behind her. While the pointer is moving on screen (more than 350 px/s, and for 0.3 s after) a galloping dog ignores its distance and keeps going flat out, also while it is right on top of her, so the reversal meets her at speed. A pointer held still is unchanged: she slows as she reaches it. After the turn she pushes off into a gallop only if the pointer is far enough to ask for one.
- **Spine.** The chest and the haunches are two halves hinged in the middle. At a gallop they fold under as the hind paws reach forward and open out as she stretches; the leg joints move with them.
- **Ears.** Each ear is a chain of four points hanging from the head, simulated every frame (gravity, drag, a weak spring towards hanging straight, kept outside the head). The air she moves through lifts them out sideways and flutters them, more the faster she goes, and the head rolls a little with the stride, so they flap in and out and up and down as well as trailing. Nothing poses them.
- **Shake.** `dog.shake` (seconds left, 1.4 s). A twist about her spine that travels from head to tail (`shakeAt(sT, u)` in `src/models.js`: roll at place `u` along her, `sT` seconds in; about 4.8 turns a second, each place 1.9 rad of phase and up to 0.4 s behind the head). The head, bowed a little, rolls 1.35 rad each way, the body skin 0.8 rad (applied per vertex in `bendBody`, so the back marks go round with it), the whole body rocks 0.2 rad over the planted paws, the opposite way to the head (as does the skin) (the same roll goes into the leg joints), the front of the spine swings sideways and the rear after it, and the tail whirls last; paws stay planted, eyes shut; the ears are thrown straight out and up (`fling` in `swingEars`). She shakes after a bonk, every other time she is left standing (the other time is the play bow), and on the studio's `shake` button (K). Moving cancels it.
- **Stopping.** A paw caught in the air when she slows finishes its step at once rather than at the gait's pace.
- The model reports `dog.footfall` when a paw lands (the step sound), `dog.gait` (cycle phase) and `dog.feet` (for tests: `x`, `y`, `u` = progress of the step, 1 when standing, `off` = distance from rest).

## The studio (`?studio`)

For working on how he moves: the dog alone on a ruled floor (a line every 100 units, a darker one every 400), seen from close by. The camera is locked on him, so he runs on the spot and the floor slides past; he is carried back a whole number of squares before he reaches the edge, which cannot be seen. It runs the same `updateDog` and the same model as the game, so what is tuned here is what is played.

| | Buttons | Keys |
|---|---|---|
| View (how far, how high; it never turns) | low, game, top, + − | 1 2 3, wheel |
| Gait | auto, trot (never zoomies), gallop (at once) | G |
| Time | ×1 ×0.5 ×0.25 ×0.1, pause, step (one 1/60 s frame) | T, P, `.` |
| Poses | hello (paws up), bonk (daze), bow, point (stays on while he stands) | H N V C |

Run left or right for a side view, toward the camera for the front. The readout shows state, speed, height and stride phase (0–1, one full cycle). Not in the studio: the car and the driving pose. Tests: `__G.studio`, `__G.api.pose('hello'|'bonk'|'bow'|'point')`.

## Test hooks

`window.__G`: `t`, `dog`, `car`, `mess`, `birds`, `world`, `flocks`, `people`, `props`. `__G.api`: `jump()`, `bark()`, `car()`, `knock(i)`, `enterCar()`, `leaveCar()`, `flyAway(i)`.

- **Auditioning recordings in the studio.** If `sounds/lili/index.json` exists (a list of `{file, label, dur, dog}`), the studio gets a `recordings` button that unfolds a row of buttons, one per clip (folded by default: there are thirty); pressing one plays it (`playClip` in `src/audio.js`) and opens her mouth. The folder is in `.gitignore`: raw recordings stay on the machine until one is chosen as a game sound.

## The simulated skeleton (`tools/sim/`)

Movement posed by hand did not look like a dog. `tools/sim/dog.py` is a springer spaniel's skeleton for MuJoCo, side on: back, neck, head, tail, and for each leg the real bones (shoulder blade, upper arm, forearm, wrist to paw; thigh, shin, hock to paw), with a dog's joint ranges, about 20 kg spread over the bones, and servos limited to a dog's strength. `tools/sim/jump.py` drives the joints from knots over time and searches (cross-entropy, 16 processes, about 3 minutes) for the leap that reaches the asked height and speed, lands forepaws first, ends standing and costs the least effort. The first guess is rough; the result is whatever the physics allows.

- Each case in `CASES` says what is asked: take-off speed, how far her middle rises, and for the high jump how far she must sink first (`crouch`, 13 cm) and how far she may rear (`tip`). Without `crouch` the search found a high jump with almost no wind-up, which is not how a dog does it.
- `python jump.py stand` (long leap) or `high`; `python jump.py stand 0` replays the saved result. Setup, once, outside the repo: `python3 -m venv ~/sim-venv && ~/sim-venv/bin/pip install mujoco numpy pillow`, then run the tools from `tools/sim` with `~/sim-venv/bin/python` (made with MuJoCo 4.0.1 on Python 3.14).
- Output in `tools/sim/out/`: `<case>.json` (every joint's position 100 times a second, and which paws are down), `<case>.png` (a strip), `<case>.npy` (the knots, to resume a search).
- `tools/sim/view.html` plays a capture in slow motion: `/tools/sim/view.html` on the local server.
- **Gaits (in progress, not in the game yet).** `tools/sim/gait.py` searches for a steady trot or gallop: `python gait.py trot` or `gallop` (about 5 minutes; a second run resumes from the saved result, `--fresh` starts over, `0` replays). Each joint's target is a repeating curve over the stride (a mean and three harmonics), and the four legs run the same curve at different points of the stride (`lag` in `CASES`: diagonal pairs together for the trot; for the gallop the search may move them). She starts standing at the asked speed and runs 7 strides; the first 3 do not count. The cost asks for: the asked speed, no fall, each stride like the last, her middle kept at standing height and level, each paw on the ground for a share of the stride within `duty`, nothing but paws touching the ground, least effort. One stride (the sixth) is recorded to `out/<case>.json` with `loop: true`.
  - What went wrong first, and why the cost is as it is: with only speed, repetition and effort asked, the trot came out crouched with the hind paws barely touching (on the ground 11% of the stride). Hence the height term and the `duty` range.
- Not done yet: a running take-off, the landing after touchdown and people are not simulated; the gaits are being searched for. The game plays the two captures in a jump (see *Jump* above).
