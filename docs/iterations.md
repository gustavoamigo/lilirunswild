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
