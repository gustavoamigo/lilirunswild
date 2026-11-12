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

`?style=toon|real`, `?at=x,y` (start there), `?car` (start driving).

## Test hooks

`window.__G`: `t`, `dog`, `car`, `mess`, `birds`, `world`, `flocks`, `people`, `props`. `__G.api`: `jump()`, `bark()`, `car()`, `knock(i)`, `enterCar()`, `leaveCar()`, `flyAway(i)`.
