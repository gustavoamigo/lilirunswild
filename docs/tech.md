# Tech

Three.js r170 (vendored), plain ES modules, no build step, no asset files. Same architecture as wheek.

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

## Coordinates and camera

Logic is on a flat map: `x` east, `y` south, `z` height. In the scene, map `y` is three.js `z` and height is three.js `y`. Models face +x; `root.rotation.y = -heading`.

The camera looks north from above and behind, never turns, leads the dog by 0.3 s of his velocity and backs off at speed and in the car (`G.focus.zoom`). On a narrow screen it backs off further (`fit`). Leaves between the camera and the dog, and trees in the near foreground, fade.

## How the dog moves (`updateDog`)

Constants at the top of `src/main.js`: `TROT` 420, `ZOOM` 640 (after `ZOOM_AFTER` 0.9 s flat out), `JUMP_V` 540, `GRAV` 1500, `BONK` 470 (speed into a solid thing that dazes him), `CAR_TOP` 900.

- On the ground, velocity eases toward steering × top speed: fast at a trot, slowly in zoomies (that is the skid).
- In the air it eases toward steering at no less than 0.75 × `TROT`.
- Solid things are circles (`world.obstacles`) and capsules with a flat top (`world.platforms`: benches, table, the parked car). A platform is solid from the side and floor from above (`floorAt`).
- States: `idle`, `paws`, `daze`, `hop` (scripted arc into and out of the car), `drive`. The model reads the state and velocity and blends its own pose (`makeDog().update`).

## URL parameters

`?style=toon|real`, `?at=x,y` (start there), `?car` (start driving), `?studio` (below).

## How the dog moves (`makeDog` in `src/models.js`)

Nothing is recorded or key-framed, and there is no motion data to load. The legs are solved every frame:

- **Paws stand on the ground.** Each paw has a place in map coordinates. While it stands it does not move; the two-bone leg is bent to reach from the joint to the paw (elbows back, knees forward). A paw that cannot be reached any more lifts.
- **The stride follows the ground.** The gait cycle advances with the distance the paws have to cover (the average speed of the four rest positions, so turning on the spot counts), never with the clock. When a paw's turn comes it swings to a spot ahead of its shoulder: half of what the shoulder will cover while the paw stands. Trot is diagonal pairs; gallop is hind pair, front pair, then all four off the ground. Faster means a longer stride and a shorter share of it on the ground.
- **Standing still**, any paw left more than a few units from its rest position steps back under the body.
- **Poses** (jump, hello, bow, point, daze, driving) hold a paw at an angle and length from its joint instead; each paw blends between the pose and its place on the ground.
- **Turning.** In `updateDog` the heading turns towards the stick at a limited rate (8.5 rad/s trotting, 5.5 galloping, 4 in the air) and the velocity follows the heading, so a change of direction is a curve; trotting, speed drops with the angle still to turn, so an about-turn is walked round almost on the spot. The model reads the turn rate: the spine bends in the middle, the head and tail lead into the turn, and the body leans in at speed.
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
