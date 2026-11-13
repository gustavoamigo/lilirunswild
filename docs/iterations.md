# Iteration log

Each iteration: what was built → what to test → feedback received → what that changes.

---

## Iteration 1 – the dog and how he moves (2026-11-13)

**Asked for**: "a game that is similar to GTA. But instead of a person in an open world, it's a dog, a very active cocker spaniel. The dog is not violent, but jumps into things, people, breaks stuff and is obsessed with birds. It can also drive cars and make a mess. Before building missions and all that, can you make a prototype of this dog, its movements and how to move it?"

**Built**
- The spaniel: trot, zoomies with skidding, jump (with a lean in the air), bonk and daze, paws-up hello, flying hello, play bow, bark, pointing at and chasing birds.
- A small town to try him in: park, ring road, houses, three people, three flocks, pots, bins, cones, boxes, a ball, benches, a picnic table with plates.
- One car he can get into (E, the button, or by jumping on it), drive, crash and leave.
- Controls: keys, tap/hold to run there, on-screen buttons, game pad.
- Two counters, mess and birds, with nothing depending on them yet.

**Checked automatically** (headless Chromium, toon style, no console errors): trot, zoomies, jump, smashing the pot row, jumping onto the table from a standstill (plates fall), paws hello at a trot, flying hello, tree bonk at a gallop, birds scared and counted, into the car with E, driving, turning, reversing out of a hedge, out again; touch steering and the jump button on an upright phone screen; default style renders.
**Not checked**: feel of the skid and the car, sound, real fingers, a real game pad, frame rate on a real device, jumping onto the car to get in, cones/bins hit by the car.

**Test focus**
1. Trot, then hold a direction: do the zoomies come in at the right moment, and is the skid fun or annoying?
2. Jump onto a bench and the table; run through the pots.
3. Trot into a person, then gallop into one.
4. Stand near birds, then run at them.
5. Take the car round the ring road and through the park.

**Decisions to revisit**: the name; fixed camera while driving; one car; town size; no title, music or saved progress yet.

**Feedback**: (waiting)

**Added after hand-over**: "Can we create a scene with the dog with more zoom in so we can work on the dog's movement?" → `?studio`: the dog alone on a ruled floor, close camera at three heights, gait lock, slow motion, pause and single frames, pose buttons. Described in `docs/tech.md`. Checked by script: loads with no errors, gallop, hello, view and gait keys, point, half speed. Not checked: wheel zoom, the buttons by touch.

## Iteration 2: movement that touches the ground

**Feedback** (from the studio): the tail wags too fast in the crouch; turning is a block rotating; running is not synchronised to the floor, "like she is running in the air". Suggested looking at datasets (Kirin / AiM3D, DigiDogs).

**Decisions**
- No dataset. DigiDogs estimates poses from pictures (no motion clips in the repository, non-commercial licence); AiM3D is joint positions for a different skeleton, 876 GB in all, no licence stated, and the project has no assets by rule. The legs are solved instead (see `docs/tech.md`, *How the dog moves*).
- Legs rebuilt as two bones and a paw; paws planted on the ground; stride driven by distance covered.
- Heading turns at a limited rate and velocity follows it; spine bend, head lead, lean.
- Tail: play bow from 3.2 to 1.35 wags a second (wider); hello and happy slowed too; the wag no longer jumps when its speed changes.

**Checked by script**: frame-by-frame sheets of trot, gallop, an about-turn and a quarter turn; bow, hello, point, bonk, jump, rest; game run with jump, driving and leaving the car, touch layout; no errors. **Not checked by eye in motion**: only stills.

## Iteration 3: ears, spine, stopping, the about-turn

**Feedback**: "much better", but the long ears are rigid and should flow; the body is rigid at a gallop, with no movement of the spine; sometimes a leg stays up when she stops; a galloping dog asked to go the other way brakes and pushes off.

**Decisions**
- Ears are simulated chains, not posed (see `docs/tech.md`).
- The spine flexes with the gallop cycle; the jump holds it stretched.
- A swing in progress finishes fast once she is slow. In random run-and-stop trials a paw was still off the ground a quarter of a second after letting go in 16 of 24 before and 8 to 10 of 24 after; none at half a second, before or after. A paw held up for longer was not reproduced in the studio. In the town, the raised front paw near birds is the point pose, on purpose.
- Opposite direction at a gallop: brake, come round, push off (`dog.skid`). At a trot the about-turn is still walked round.

**Checked by script**: frame sheets of the gallop (spine, ears), the brake and push-off, trot; hello and bonk; game run with a jump and a reversal; driving and leaving the car; no errors. **Not checked by eye in motion**: only stills; the ears' swing and the timing of the brake need a look.

## Iteration 4: ears in every direction, stepping about-turn, the shake

**Feedback**: "Much better." The ears only swing back and forth, not in all directions; the brake is good but the turn after it is a rigid body with no leg movement, and should be the normal turn; add the head shake dogs do.

**Decisions**
- Ears: air lift and flutter that grow with speed, and a small roll of the head with the stride.
- About-turn: the brake ends while she is still moving and the ordinary trot turn takes over, then the push-off (`dog.push`).
- Shake: after a bonk, when left standing (alternating with the bow), and on a studio button. Read "head spinning" as the shake; to be confirmed.

**Checked by script**: frame sheets of the gallop from above (ears out and in), the brake, turn and push-off, the shake; game run with a jump and a reversal; bonk; no errors. **Not checked**: in motion; touch layout and the car were not re-run.

## Iteration 5: the brake with the mouse

**Feedback**: the brake is not consistent. Holding the mouse to run and sliding the pointer to the opposite side, she often follows the pointer round instead of braking.

**Cause**: pointer steering weakens as the pointer nears her. A slide across her passes close, so she slowed and dropped out of the gallop before the pointer was behind her; only an instant jump of the pointer braked.

**Decision**: a pointer that is moving is not an arrival. While it moves, a galloping dog keeps full speed (see `docs/tech.md`).

**Checked by script**: reversals stepped frame by frame in the studio, straight across her and in an arc round her, taking 0.06 to 0.9 s, ending far and near: all brake, turn and push off, except a slow arc (0.45 s or more) to a point close by, which she curves to. Before, only the instant jump braked. A pointer held still on screen: no brake. Stop trials unchanged (8 of 24 with a paw up at a quarter second). **Not checked**: touch; by eye in motion.

## Iteration 6: Lili's own voice

**Feedback**: three recordings of Lili. Cut into 30 events and named by a classifier; the owner listened and chose three from the first recording: events 6, 7 and 9. None had her breathing.

**Decisions**
- First guess, wrong: event 9 as the bark. Owner: none of them is a bark; all three are the "grururururu" she makes when playing at pulling something. The soundfont bark is back.
- The three growls play in turn with the play bow until there is something to pull.
- The studio shows the unchosen clips as buttons (local only).

**Checked by script**: the three files load and decode, bark and bow raise no errors. **Not checked**: by ear.


## Iteration 7: Lili as she is, and a jump with a run-up

**Feedback**: fog too heavy, most of all in the car. Two photos of Lili: liver and white, a longer tail. Studio: the recording buttons take up room. Tail should wag a little faster. The jump is not realistic, has no running start, and her ears move as if she were about to fly with them.

**Decisions**
- Fog starts half as far again and moves out with the camera.
- Coat, blaze, freckles, pink collar, tail patch and back marks from the photos.
- Recordings fold behind one studio button.
- Wag a third faster in every pose.
- Jump: run-up, gather, take-off; a rising and a falling pose; heavier gravity (0.57 s in the air, was 0.72); landing squash halved; ears carried with her and calmed in the air. Cost: from a standstill the jump now starts 0.3 s after the button and covers more ground, so hopping onto a bench she stands beside needs a step back.

**Checked by script**: frame-stepped jumps from a standstill and from a gallop (run-up 18 and 7 frames, peak 78, enough for the car at 64), side-on screenshots of each phase. **Not checked**: by eye in motion, hopping onto bench, table and car in the game, touch.

## Iteration 8: a lower leap, and a simulated skeleton to capture movement from

**Feedback**: the reworked jump is still "not realistic at all". Then: simulate a real dog, its skeleton and joints, and capture the movement, instead of posing it; the same will be needed for people. A full muscle model (simtk.org dogmodel) may be too much.

**Decisions**
- Stop-gap in the game: a long low leap (45 high, was 80), high only with something to get up onto ahead; body along her path; forelegs down first; no paw through the ground.
- `tools/sim/`: her bones, joints, joint ranges and masses in MuJoCo, and a search for the leap. Two captures: a long leap (2.5 m/s, middle rises 25 cm, 0.44 s in the air) and a high jump. A page plays them.
- Agreed the muscle model is too much.
- Next, if the captures look right to the owner: give Lili's legs the real bones in the game and play the captures; then a running take-off and the gaits; then people.

**Checked by script**: the search converges and the captures land forepaws first and end standing; the page loads without errors; in the game, a trotting jump lands on the bench and on the table, and a jump in the open stays low. **Not checked**: by eye in motion; the car; a jump started right beside a bench (she bumps its side during the run-up and misses).

**Feedback on the captures**: both really good, but the high jump is wrong: she needs to crouch to get more momentum.

**Decision**: the high jump must sink her middle 13 cm before take-off and may rear further. She now drops chest and haunches, rocks back and drives up: middle rises 54 cm (was 45), 0.65 s in the air.

**Checked by script**: sinks 12.7 cm, lands forepaws first, ends standing. **Not checked**: by eye in motion. She shuffles one hind paw forward under her as she sinks, and the asked rise of 62 cm is not reached.


## Iteration 9: real leg bones, and the captures played in the game

**Feedback**: both captures are really good.

**Decisions**
- Her legs have three bones each, in the skeleton's proportions scaled to her short legs: elbow back under the chest, knee forward, hock behind. This changes how she stands and runs, not only how she jumps.
- A jump plays a capture: the long leap, or the high jump when there is something to get up onto. From a stand she now jumps from where she is (sinks, drives, goes) instead of taking a few bounds first. From a run only the flight is played, with her tilt scaled down.
- The game keeps its own flight path; the capture gives the pose, stretched to the time in the air.

**Checked by script**: frame-stepped strips in the studio of a standing leap, a standing high jump and a running leap, and of standing and trotting; no page errors; a trotting jump still lands on the bench and the table (the jump from close to the bench still bumps its side, as before). **Not checked**: by eye in motion, the car hop, falls off an edge, touch.

**Feedback**: the tail looks like two things, and hers is longer.

**Decision**: one tail, about 40% longer; the feathering lies along its underside into the tip instead of standing off it. **Checked by script**: side-on strips. **Not checked**: by eye in motion, from behind.

**Feedback**: length right, but the tail still reads as two sausages laid together; is that because she is built from separate shapes with no skin?

**Decision**: yes: she is ellipsoids set into each other, no single surface. The tail is now the first part with a skin of its own: one surface that thins to the tip, with the feathering drawn down from it as a fringe (`TAIL` in `src/models.js`). The rest of her is still separate shapes. **Checked by script**: side-on screenshots. **Not checked**: in motion, from behind.

**Feedback**: the tail is good now; do the same for the creases in her body.

**Decision**: chest, back, belly and rump are one skin (`torsoGeo` in `src/models.js`): the outline of the old shapes, smoothed along her length. Its rump end follows the rear of the spine and its chest end the front, blended between them every frame (`bendBody`), so it bends with her instead of hinging. Neck, head, ears and legs are still separate shapes. **Checked by script**: strips of standing, trotting, a standing leap and a running leap; no page errors. **Not checked**: by eye in motion, tight turns, shake, sit, the toon style.

**Feedback**: buggy: two flat plates, endlessly tall, stand through her body.

**Decision**: the body's outline was sampled half a unit past each end, where no shape covers it, so the two end rings of the skin were stretched off to infinity. The skin now ends inside the shapes, and building it fails loudly if a slice is uncovered. The plates were in the earlier check strips and were taken for studio scenery. **Checked by script**: her standing, seen from eight directions round her: no plates. **Not checked**: in motion by eye.

**Feedback**: the shake is really bad; the other movements are realistic; running may need fine tuning.

**Decision**: the shake rocked her whole body like a toy. Now it is a twist about her spine that starts at the head and runs down her back to the tail (`shakeAt`): the head rolls far each way, the skin of her body rolls round her a little later (and the marks on her back with it), the rump and tail last; her paws stay planted and her head is lowered. **Checked by script**: a strip of the shake every 0.12 s; no page errors. **Not checked**: by eye at full speed.

**Feedback**: a slow-motion clip of a spaniel shaking (not kept in the repo): nose held up and nearly still, the head rolling far each way about it, the ears thrown straight out and up, for well over a second.

**Decision**: matched to it: nose up (the last note said lowered; it was not), head roll 1.35 rad each way, 1.4 s long, body skin roll 0.8 rad, and the ears are thrown outwards from the head and upwards while she shakes (`fling` in `swingEars`). **Checked by script**: a strip every 0.15 s set beside the clip's frames. **Not checked**: at full speed by eye; forelegs are not braced wide as in the clip.
