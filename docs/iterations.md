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

**Feedback**: the shake is a movement of the whole body; that should have been taken from the clip.

**Decision**: looked at the clip frame by frame for the body, not just the head: the chest and shoulders rock from side to side over planted paws, the trunk twists after the head, the dog sits lower. Now her whole body rolls over her paws (0.2 rad, the legs taking it up), the front of the spine swings one way and the rear the other a moment later, and she sinks lower, on top of the skin's roll. **Checked by script**: strips from the side and from the front every 0.07 s; paws stay on their spots. **Not checked**: at full speed by eye; forelegs still not braced wide apart.

**Feedback**: dogs bow their head down a little when they shake.

**Decision**: her head is bowed (0.32 rad down) through the shake instead of held nose up. **Checked by script**: side strip. **Not checked**: at full speed by eye.

**Feedback**: the body shakes in the opposite direction to the head.

**Decision**: the body's rock and the skin's roll now go against the head's roll instead of following it a little late. **Checked by script**: front strip. **Not checked**: at full speed by eye.

**Feedback**: running is not bad, but would benefit from the simulation. Go.

**Decision**: a steady trot and a gallop searched for on the simulated skeleton (`tools/sim/gait.py`, method in `docs/tech.md`), shown in the viewer first; nothing in the game changes until they are approved. Two gallops to choose from: a longer stride (0.32 s) and a quicker one (0.25 s). **Checked by script**: speed, stride time, share of stride each paw is down, contacts other than paws, strips of one stride, the viewer loops them without errors. **Not checked**: by eye in motion; how they look on Lili's body.

**Feedback**: the trot needs to be more jumpy; the regular gallop (longer stride) is the better one.

**Decision**: the trot searched again asking for her middle to rise and fall (about 4 cm), a longer stride (0.36 s) and less time on the ground; the first one is kept as `trot_flat` to compare. The 0.32 s gallop is the one to use. **Checked by script**: numbers and a strip of one stride. **Not checked**: by eye in motion.

**Feedback**: the bouncier trot works.

**Decision**: the simulated trot and gallop are now what she runs in the game from a brisk trot up: paw timing, body tilt, bend and bounce, and how the legs fold come from the strides; paws still plant on the ground without sliding. A stride is stretched to 110 (trot) and 170 (gallop) of ground because she runs faster for her size than the simulated dog. **Checked by script**: strips of 16 frames at a trot and at a gallop in the studio, paw order (diagonal pairs at the trot; hind right, hind left, fore right, fore left at the gallop, with all four off the ground in between), no errors; jumps from a stand and from a run still play. **Not checked**: at full speed by eye; turning, the about-turn and stopping while the strides play; the step sounds' rhythm. Not done: the take-off from a run is still posed by hand.

**Feedback**: in the game the trot is too jumpy and clunky; she looks as if she is hurt; her legs look shorter and she needs a diet.

**Decision**: the trot plays only part of the simulated tilt, bend and bounce and takes a longer stride (130); its two half-strides are made mirror images in the export, so no limp; her height while running stays about standing height instead of the simulated dog's crouch; her body is slimmer (belly and sides in, back line unchanged). **Checked by script**: strips at a trot and a gallop, the turnaround views standing, a jump from a run, no errors. **Not checked**: by eye in motion; the skin against the legs in the shake, sit and other poses with the slimmer body.

**Feedback**: the tail is not natural when she runs or trots; was the tail's movement copied?

**Decision**: it was not: she kept wagging side to side at a fixed rate whatever her legs did. The simulated tail's swing is now exported with each stride and played: carried out behind, rising and falling with the stride, hardly wagging. **Checked by script**: strips at a trot and a gallop, no errors. **Not checked**: by eye in motion; whether 0.4 of the simulated swing is the right amount.

**Feedback**: it doesn't look as if anything was copied from the simulation; the simulation has a natural flow for the legs, the head and the tail. Not pinning the paws while running is fine.

**Decision**: running now plays the simulated strides whole: every leg bone at the simulated angle (paws not pinned), body, neck, head and tail as simulated, each stride at its true length with the tempo following her speed. The gait is picked by speed: trot below 260, gallop above, so her normal run is a gallop; the studio's trot button holds her at half speed to show the trot. **Checked by script**: strips of the trot at 210 and the gallop at 420 and 640 against the simulated strips, jumps from a stand and from a run, no errors. **Not checked**: by eye in motion; the change from trot to gallop and back; turning, stopping and the skid with unpinned paws; whether the low-carried head (as simulated) reads well.

**Feedback**: the trot is too jumpy; running, the head goes up and down too heavily; at 1.0× she is crazy fast, not realistic (played at 0.5×). Asked what to slow: her speeds, with the legs at their real tempo.

**Decision**: her speeds halved: `TROT` 210 and `ZOOM` 320 (2.5 and 3.8 m/s for her size), with the speed thresholds in `src/main.js` (zoomies, skid, bonk, flying hello, bird watching) and the hand-made walk rules scaled with them. A new gallop searched at 3.8 m/s and a new trot with half the bounce (0.8 cm); the old ones are kept as `gallop_fast` and `trot_bouncy`. The neck and head keep 0.35 of their simulated swing. The studio's trot button no longer halves her speed (her trot is now the simulated trot's speed). **Checked by script**: both searches clean (no contacts but paws), strips of the trot at 210 and the gallop at 320, jumps from a stand and from a run, no errors. **Not checked**: by eye in motion; whether she can still jump onto or over everything in the town at the lower speeds (run-up leaps are now shorter); the car is unchanged; the camera's feel at the lower speeds.

**Feedback**: everything looks really bad; we are in the uncanny valley. Go back to the hand-made running from before the simulation.

**Decision**: running is hand-made again, as before the simulated strides; the jumps keep their simulated take-off and flight. Kept from the rounds since: the slower speeds (asked for separately) and the slimmer body (asked for). The hand-made stride is shortened (reach 16 to 28, from 20 to 36) so its tempo suits the slower speeds. The tail wags again while she runs. `GAITS` stays in `src/moves.js`, unused, with the sim tools and results. **Checked by script**: strips at a trot (210) and a gallop (320), jumps from a stand and from a run, no errors. **Not checked**: by eye in motion. Open: whether the slower speeds and the slimmer body stay (asked, not answered).

**Feedback**: the jump from a walk, trot or run is funny, especially the ears starting to flap. Fix it.

**Decision**: in the air the ears ride along: no flutter from the moment she leaves the ground, carried fully with her rise and fall, stiffer and more damped; after landing they ease back over a quarter second instead of slapping. **Checked by script**: the ear tip's height against the head through a jump from a stand, a trot and a run (no more flip over the head at take-off), a strip of a jump from a run, no errors. **Not checked**: by eye in motion; jumps onto the bench, table and car; the shake (its fling is unchanged).

**Feedback**: in the game she runs really slow; the simulated gallop was really good (asked: the gallop, not just the speed). Also: why is the brake movement gone?

**Decision**: flat out (zoomies) she plays the simulated gallop again, the 5.5 m/s one (`gallop_fast`), at its own speed: `ZOOM` 460. Walk and trot stay hand-made; the head keeps 0.35 of the simulated swing. The brake had gone because its end speed (150) and force (1500) were fixed: with top speed halved the slide lasted a tenth of a second. Both now scale with `ZOOM`, so it slides about a third of a second as before. **Checked by script**: strips of the trot at 210 and the gallop at 460, the about-turn (20 frames of braced slide, then she steps round), jumps from a stand and from a run, the ears in a jump from a run, no errors. **Not checked**: by eye in motion; the change from trot into the gallop; whether the town's distances and the camera suit the faster gallop.

**Feedback**: gallop and speed are good. The ears are too fast; running, the wind should pull them back, also when she drives the car.

**Decision**: the ears flap at about half the rate and are damped three times more; the wind of her speed pushes them back (28° at a trot, 51° at a gallop, about 68° in the car at full speed). Found on the way: the ears' root jumped a whole frame's distance in the first sub-step, which threw them forward in the fast car; it now moves step by step. **Checked by script**: the ear angle and how much the tip moves a frame standing, trotting, galloping and driving; jumps from a stand and a run (no flip); the shake still flings them; a gallop strip; no errors. **Not checked**: by eye in motion; the ears when she brakes or turns sharply; reversing the car.

**Feedback**: a bug: when she turns her head towards things, the ears turn too instead of flowing in the direction she is going; visible in the car.

**Decision**: the side-of-head limit that kept each ear out of her cheeks reached as far as the ear could, so with her head turned it held one ear out in front; it now applies only beside her face (and everywhere during a shake). The air's lift pushes the ears out across her direction of travel instead of out from her head. **Checked by script**: galloping and driving with her head held turned (both ears trail back), standing turnaround, the shake, no errors. **Not checked**: by eye in motion; her head turned while trotting slowly or standing in a breeze-free spot.

**Feedback**: in the car, when she looks at birds, the ears look rigid and follow the head's movement.

**Decision**: measured first: the ear tips do keep trailing back (within a few degrees) while her head turns, so what looked rigid is how the ear pieces are drawn: each flat piece faced out from her head, so the whole ear turned with it. Now only the root piece faces with her head; further down the ear faces out from her body. **Checked by script**: the tip directions in the car with her head turning, strips galloping while she turns her head before and after (the difference is subtle in stills), standing turnaround, no errors. **Not checked**: by eye in motion, which is where it showed. If it still looks rigid, next is softer springs where the ear joins the head.

**Feedback**: it would be cool if her ears had some movement of wind.

**Decision**: gusts: while she moves, the line the wind hangs each ear along wavers up and down and side to side in slow uneven waves, more the faster she goes and most at the tips; each ear has its own. Slow on purpose (the earlier quick flapping was too fast). **Checked by script**: the tip's swing galloping (about double the stride's own swing) and driving (15 to 25° either side), a close strip in the car, no errors. **Not checked**: by eye in motion; whether the gusts are too much at the car's top speed.

**Feedback**: make the humans look better and more natural, keeping the cartoon style. Three reactions only: love with the dog, indifference, scared and running away. Adults and children. Later: Lili stealing a child's toy (they resist, get scared, scream, run), the same with adults; scaring by jumping at them; love when she is gentle.

**Decision**: in steps, each shown before the next. This step: the people's look and movement. New rounded bodies with knees, elbows, hands, a neck and faces (eyes that blink, brows, nose, smile, an open mouth for later); torso and limbs as smooth one-piece shapes (separate shapes looked like a wooden mannequin); five looks, three adults and two children (two thirds the height, bigger heads); a walk driven by the ground covered with knees, heel and toe, bob, hip and shoulder turn and arm swing; standing with weight shifts and glances; the existing poses (paws up, sit, jump clear, wave) redone. Two children added by the plaza. A studio line-up: `?studio&people`. Next: the three reactions, then who reacts how (to be asked: the person's nature, Lili's manner, or both; whether paws up counts as gentle). **Checked by script**: line-up from low and high views, close faces, a walk cycle strip, the four poses, the town with the children, no errors. **Not checked**: by eye in motion; Lili's paws-up hello against a child's shorter chest (the scripted approach missed); people in the car's path.

**Feedback**: when they turn, the feet are not pinned to the ground: creepy. The children look better than the adults; make the adults more like cartoon children (a different shape, maybe shorter).

**Decision**: standing people turn their chest and head first and step round with their feet, one foot then the other, turning about the foot that stays down. Adults are now built like the children a size up: about 185 high instead of 205, chunkier, bigger heads. **Checked by script**: feet over a 1.2 rad turn (each slid 12 to 15 units while down before, now 0.6 and 3.8), the line-up, close faces, the four poses, no errors. **Not checked**: by eye in motion; turning while walking (feet move anyway).

**Feedback**: the people step is good. Asked: reactions depend on both the person's nature and Lili's manner; paws up counts as gentle.

**Decision**: the three reactions. Love: they come over, crouch and pet her, hearts. Indifference: a glance and a shrug. Fright: a scream, running away with arms up, hands on knees to catch their breath, then back. Each person has a nature (the woman with the bun and the girl love dogs, the man in blue and the boy are not interested, the older man is nervous; children like dogs more); calm standing, paws up, a bark, a near miss with the car and crashing into them push it, and the sum picks the reaction (numbers in `docs/tech.md`). **Checked by script**: each nature against paws up, calm standing, a bark and a gallop into them, logged state by state (love, glance, scream and run, catch breath, return; crash: sit, run, then love once she stands calmly), screenshots of love, fright, glance and a child petting her, the poses in the studio, no errors. **Not checked**: by eye in motion; the scream's sound; a car near miss followed by fright; how often love repeats when she stays by someone (8 s pause).

**Feedback**: in the game, standing still, she should wag her tail and do the bow or shake once in a while, as in the studio.

**Decision**: the cause was the birds: in town a flock is nearly always in sight, and she pointed at it, stiff, for as long as she stood. Now she points for 3.5 s and relaxes; she points again 16 s later or at a new flock. **Checked by script**: 20 s standing in town: point, wag, bow, shake, bow, point again; no errors. **Not checked**: by eye.

**Feedback**: no growl with the bow; the growl is for pulling a toy from someone.

**Decision**: the bow is silent; the growl stays in the game, unused until there is a toy to pull. **Checked by script**: page loads, no errors. **Not checked**: by ear.

**Feedback**: when children pet her she should get excited: wag faster, her body wiggling a little.

**Decision**: petted by a child she wags fast and wide with her tongue out, and her rump and chest swing opposite ways with each wag; petted by an adult she is happy (the quicker wag she had after a hello). Being petted also stops her pointing at birds or bowing. Found on the way: people could stand on each other (two children crouched on the same spot); they now keep apart. **Checked by script**: a child coming over and petting her (excited while petted, then not), the two children 48 to 59 apart while both near her, no errors. **Not checked**: the wiggle by eye in motion.

**Feedback**: the excited wiggle is too strong and not natural.

**Decision**: the chest no longer swings against the rump and the body no longer rolls; the tail is a little slower and narrower and the rump sways only a little more than in an ordinary wag. **Checked by script**: page loads, a child petting her, no errors. **Not checked**: by eye.

**Feedback**: make it a GTA for children of 6 to 7 that scales easily: a world of reusable tiles for a large open world, missions from a markdown template with dependencies (not linear), simple missions (drive to school, steal a toy from a child, poo on the table, play ball with a person). Unsure about points. Asked for an expert view, with references.

**Decision**: written up as `docs/open-world-design.md` for approval: hand-placed tiles on a text map (not generated), only nearby tiles built; missions as files built from a small vocabulary of actions, targets by tag; no points, timers or failing; picture to-do list, voice, rewards to wear and play with. Four build steps. Nothing built yet.

**Feedback**: picked generated sounds: bark, a man's yell, a paw step, the car crash and horn, light panting. The woman's and children's screams are too frightened; the engine is too real, it should be cartoon; paws on grass and heavy panting not wanted. No credits file; the bark can be replaced so none is needed.

**Decision**: the picks are in the game (prepared by `tools/sound_prep.py`); she pants after zoomies, tongue out; the soundfont bark and `sounds/CREDITS.md` are gone. New rounds generated for a less frightened woman and child and a cartoon engine, for the owner to pick. Found on the way: the generator gives noise at lengths that are not whole seconds; every short sound of the first round was broken and was made again. **Checked by script**: the sounds load and play without errors (bark, steps, a fright, panting after zoomies). **Not checked**: by ear in the game: levels against each other, the panting loop's seam.

**Feedback**: the generated paw step is horrible; keep the synthetic one. Asked for a plain "woman screaming, frightened".

**Decision**: the synthetic step is back and the file is gone. Eight "woman screaming, frightened" generated for the owner to pick. **Checked by script**: audio.js parses. **Not checked**: by ear.

**Feedback**: the woman's scream: two picks from a plain "woman screaming" prompt. For the panting, a cocker spaniel panting while running, to make a loop.

**Decision**: both screams in the game, one or the other at random. Panting-while-running generated for the owner to pick. **Checked by script**: page loads and the files load. **Not checked**: by ear.

**Feedback**: panting: seed 2013129909, at a lower volume.

**Decision**: it replaces the earlier panting loop, at about half the volume. **Not checked**: by ear.

**Feedback**: the car's engine: seed 593775792 (a cartoon one).

**Decision**: the synthesised engine is replaced by that loop, faster and a little louder with speed; panting and engine share one loop player. **Checked by script**: driving, no errors. **Not checked**: by ear.

**Feedback**: a better bark: seed 1995100440.

**Decision**: it replaces the bark. **Not checked**: by ear.

**Feedback**: the car sound is not continuous.

**Decision**: the generated clip went silent for half a second near its end; the loop now uses only its first two continuous seconds (`--span` in `tools/sound_prep.py`). **Checked by script**: the loop's loudness never drops more than 11 dB below its peak, and the seam is smooth. **Not checked**: by ear.

**Feedback**: the engine is good now. She should breathe heavily while running.

**Decision**: flat out (zoomies) she pants all the way, louder as she gets out of breath and a little quicker than standing; after she slows, as before. **Checked by script**: page loads, a gallop, no errors. **Not checked**: by ear.

**Feedback**: the panting is not continuous, like the engine was.

**Decision**: the same cause (the clip fades in and is silent for its last 0.75 s); the loop now uses only its steady middle. **Checked by script**: the loop's loudness over time has no silent stretch. **Not checked**: by ear.

**Feedback**: the panting should stop when she stops running.

**Decision**: she pants only while flat out; it fades within about a quarter second of her slowing. **Checked by script**: page loads, no errors. **Not checked**: by ear.

**Feedback**: add a woman and a child who get scared, so the screams come up.

**Decision**: two more people, both nervous of dogs: a woman with long red hair walking the west lawn, a boy in green on the east lawn. A bark sends either running, a paws-up hello sends the woman running. Plain "child screaming" generated for the owner to pick (the child still has the synthesised wail). **Checked by script**: bark and paws-up against both, the studio line-up with seven looks, no errors. **Not checked**: by eye in town.

**Feedback**: a longer child's scream, from "5 year old child screaming" (plain "child screaming" did not sound like a child); seed 1997700765.

**Decision**: in the game for all three children (pitch varied a little); the synthesised wail is gone. **Checked by script**: the nervous boy screams and runs at a bark, no errors. **Not checked**: by ear.

**Feedback**: the cups need a breaking sound when they fall on the floor; picks 1216753226 and 1741754685.

**Decision**: the things on the picnic table break with one or the other; the flower pots keep their synthesised smash. **Checked by script**: jumping on the table, no errors. **Not checked**: by ear.

**Feedback**: bug: a knocked-over bin goes into the ground.

**Decision**: bins and cones tipped about the middle of their base, so lying on their side half of them was underground; they now fall over the edge of their base (`FOOT` in `makeProp`). **Checked by script**: a fallen bin and a fallen cone in town, lying on the ground. **Not checked**: the fall itself in motion.

**Feedback**: the synthesised sound of hitting a bin is horrible; picks 887578184 and 1314752365.

**Decision**: a knocked bin plays one or the other (pitch varied a little). **Checked by script**: page loads, no errors. **Not checked**: by ear.

**Feedback**: two more bin sounds, 1342402161 and 1223742836 (metal); all four at random.

**Decision**: a knocked bin plays one of the four. **Not checked**: by ear.

**Feedback**: the cones should sound like the box (the synthesised one).

**Decision**: a knocked cone plays the box's thud. The plates still knock with the old cone sound. **Not checked**: by ear.

**Feedback**: the plates (knocked, not broken) should sound similar to the box too.

**Decision**: a lighter, higher version of the box's thud for plates; the old cone sound is removed. **Checked by script**: jumping on the table, no errors. **Not checked**: by ear.

**Feedback**: the plates should use the generated crash sound.

**Decision**: knocked or broken, a plate plays the generated cup and plate breaking; the thud for plates is removed. **Checked by script**: jumping on the table, no errors. **Not checked**: by ear.

**Feedback**: implement the plan in the design doc. The park does not need to be exactly the same.

**Decision**: step 1 of 4: the town is now built from 15 kinds of tile on a 9 × 7 map (`world/map.txt`, `world/tiles/`), each painted on its own; the ring road runs through the middle of tiles with quarter-circle corners, the park is 5 × 3 tiles, everything (people, birds, the car, props) belongs to a tile. Walking people go to and fro between two points (any direction, not only west-east). `?zoom=4` pulls the camera back to look over the map. **Checked by script**: the whole town from above and a corner up close (no seams, dashes and roads join), driving, jumping on the table, standing idle, people reacting, no errors. **Not checked**: by eye in play; every tile up close. Next: step 2, a bigger town with only nearby tiles built.

**Feedback**: go ahead with step 2.

**Decision**: the town is now 17 × 13 tiles (about three and a half times the old one): a grid of streets with crossroads and T-junctions, six blocks, houses all round; new tiles for crossroads, T-junction, Lili's home (with her kennel and bowl; she starts there), the school (clock, double door, flag, a mum waiting) and a playground (sandpit, two new children). Only tiles near the camera are built, two a frame, and far ones are dropped. Buildings turn with their tile, are solid, and fade when they stand between the camera and her. Lili's home and the school sit north of the ring road so their fronts face the camera. **Checked by script**: the whole town from above, Lili's home and the school close up, a gallop into a house (she bonks and stops at its wall), driving, the picnic table, people reacting (including the playground girl), painting time per tile (1 to 2 ms), no errors. **Not checked**: smoothness on a real device while driving fast (the test browser renders in software); every tile up close; the houses' fade by eye in play.

**Feedback**: asked whether tiles are reusable; people and cars are not part of tiles and should be placed on the map separately (the owner's first thought too).

**Decision**: people and the car moved out of the tiles into `world/people.js`, placed by map square and a place in it (`at: [col, row, x, y]`, `walk` between two such places, `facing: north` etc.). Tiles now hold only the place itself and its props and birds, so any tile can be used any number of times. Everyone is where they were. **Checked by script**: everyone's place read back the same as before, driving, a frightened man, no errors.

**Feedback**: the town needs a school, a park, a lake, a town centre and an amusement park; asked what else. Suggested places for a dog and for children of 6 and 7 (dog park, vet, butcher, postman, farm, fire station, building site, football pitch, train station, ice-cream van, woods, beach). Agreed order: town centre with the butcher, lake with a little beach, dog park, farm.

**Decision**: the town centre, in the middle block below the park: the butcher's, the baker's and a café (what they sell shown in pictures, since the players cannot read) facing south onto a paved square with a fountain, two benches and four market stalls with apples. New: paving, shops, fixtures (the kennel, fountain and café tables are one kind of thing now), stalls she can jump onto, apples that roll. Found on the way: benches in a turned tile were drawn unturned. **Checked by script**: the square from above and close up, a leap onto a stall from the front (lands on top, apples fly), no errors. **Not checked**: by eye in play. Next: the lake.

**Feedback**: the road looks worse than before the tiles; the owner wants it plain, without texture, as it was.

**Decision**: the asphalt speckles are gone (plain asphalt); the sand's pebbles thinned to the old density. **Checked by script**: the same view before tiles and now, side by side. **Not checked**: on the owner's screen.

**Feedback**: go on with the lake.

**Decision**: a lake (3 × 3 tiles, west, below Lili's home) with a sandy beach all round, ducks and a ball on its north shore; four tiles (`lake`, `shore`, `shore-corner`, `beach`) give the whole lake by turning. She swims in it: slowly, low in the water, head up, paddling, splashing; out of it she shakes herself dry when she stops. The car stops at the water's edge. Found on the way: the deeper-water bands showed every tile's edge until the water shapes reached past the tiles. **Checked by script**: the lake from above, swimming in and out (half speed, shakes after), the car driven at the lake stops at the beach, no errors. **Not checked**: by eye in play; the splash sound (synthesised; a generated one can be picked). Next: the dog park.

**Feedback**: it does not look like swimming.

**Decision**: she sat on the water like a toy on a table (a shadow under her, no waterline, nothing moving round her, front paws showing). Now: tilted chest-up with her rump low, head up, legs out of sight, a see-through waterline over her lower body, soft rings spreading from her, a V wake when she moves, no shadow while swimming. **Checked by script**: close-ups swimming sideways and towards the camera. **Not checked**: by eye in motion.

**Feedback**: swimming is good, but the trail should go against the direction she swims; the jump should do something else in the water or not be available.

**Decision**: the wake's V opened forward (its angle was the wrong way round); it now opens behind her, and the rings are left behind as she swims. Jump in the water is a splash: spray, a splash sound, a little surge forward. **Checked by script**: close-ups swimming, jump in the water does not leave the water, no errors. **Not checked**: by eye in motion.

**Feedback**: the trail lies across the direction she swims (a screenshot swimming north); the graphic got much worse than the first version, which was much better, just needing the fix.

**Decision**: the cause was a code comment that had switched off the turning of the swim effects, so they never faced her way (unseen in tests that swam only sideways). Fixed; the ripples are back as in the version the owner preferred (round her), with the V opening behind her. **Checked by script**: swimming north and west, the waterline and wake along her. **Not checked**: by eye in motion.

**Feedback**: asked whether shaders could do the water better. Proposed: (1) a water surface with its own shader, (2) ripples simulated on the GPU that she makes as she swims. Go.

**Decision**: part 1 done: the lake's surface is a shader (depth from the shore, drifting wavelets, sparkles, foam lapping the beach), her waterline is the surface itself. **Checked by script**: the lake from above and close, swimming north and west (rings and wake over the surface), no errors. **Not checked**: on a real GPU; phones. Next: part 2, the ripple simulation.

**Decision** (part 2 of the water): ripples simulated on the GPU. She pushes the water with her chest as she paddles, a splash drops a big ring; the waves spread, cross and bounce off the shore, lit on their slopes. The hand-made rings and wake are gone. **Checked by script**: swimming north and west (rings spread from her, crowding ahead as she goes), a splash ring, driving and the town, no errors. **Not checked**: on a real GPU and phones (the test browser renders in software, so its waves run slower).

**Feedback**: the water is hyper-realistic in a cartoon-style game; adapt to its language.

**Decision**: same simulation, drawn flat: three colour bands by depth with clean edges, a few clean white wave marks drifting, thin white lines round the ripples' crests, a solid white foam band along the beach. Smooth shading, slope lighting, noisy wavelets and sparkles are gone. **Checked by script**: the lake from above, swimming north and west. **Not checked**: by eye in motion on a real GPU.

**Feedback**: make the ripples milder, slower and just around the dog.

**Decision**: half the wave speed, strong damping (they die out within a body length or two), gentler pushes from her paddling and the splash. **Checked by script**: close-ups swimming. **Not checked**: by eye in motion.

**Feedback**: the gentler ripples are good. Jumping into the water should make a splash.

**Decision**: a leap into the lake throws up a fountain of cartoon water drops (white, outlined in blue; plain white puffs did not show on the water), a splash sound and a ring on the water; the jump-in-the-water splash uses the same drops. **Checked by script**: a running leap from the beach into the lake. **Not checked**: by eye in motion.

**Feedback**: as soon as she gets out of the lake she should shake, with water drops coming off her.

**Decision**: climbing out, she stops and shakes at once (steering waits for it), drops flying off her sides. **Checked by script**: swimming out onto the beach with the key held: she shakes on the sand, drops fly. **Not checked**: by eye in motion.

**Feedback**: does not like the water drops; it should be more splashy, not so well defined, like fog.

**Decision**: the drops are now soft white puffs, misty at the edge, that spread as they fly; more of them, for the leap, the splash and the shake. **Checked by script**: a leap into the lake and the shake on the beach. **Not checked**: by eye in motion.

**Feedback**: too foggy now; is there something in between? How do people do water splashes?

**Decision**: as cartoon games do: a crown of water (rounded tongues rising round her and falling back), a handful of chunky two-tone drops that shrink as they fall, and only a little mist at the foot. The shake throws a few small drops. **Checked by script**: the crown and drops in still frames. **Not checked**: by eye in motion.

**Feedback**: almost; the crown looks like bowling pins. The drops in the shake are bad: too literal, not what was meant.

**Decision**: the crown is one flaring sheet of water with a pointed rim; the shake flings soft spray off her coat in bursts, side to side with its swing. **Checked by script**: the crown and the shake spray in still frames. **Not checked**: by eye in motion.

**Feedback**: the splash could be enough. The shake out of the water: can she do it walking slowly?

**Decision**: she keeps shaking as she walks on, held to a slow walk (a third of a trot) until the shake ends. **Checked by script**: swimming out with the key held: she shakes for the whole 1.4 s while walking about 150 on. **Not checked**: by eye.

**Feedback**: filter the breathing a little; it is too rough, like sandpaper.

**Decision**: the panting plays through a gentle low-pass filter (1800 Hz), a touch louder to make up. **Not checked**: by ear.

**Feedback**: lower the breathing's volume a little.

**Decision**: panting gain 0.2 to 0.13 at most. **Not checked**: by ear.

**Feedback**: disable looking at the birds when she gets out of the water.

**Decision**: while she shakes the lake off she ignores birds: no head turn, no yip, no thought bubble. **Checked by script**: page loads. **Not checked**: by eye.

**Feedback**: also no bird-watching while swimming.

**Decision**: done. **Not checked**: by eye.

**Feedback**: her body is still not continuous; she looks like a balloon dog.

**Decision**: the legs are smooth tapered limbs (one shape per bone, joints matching), the ears one smooth flap each bent through the swinging chain; the shape-from-profile builder no longer leaves ridges (people get slightly smoother too). Not yet: the head, chest and paws are still made of ovals. **Checked by script**: the turnaround standing, a trot and a gallop strip (no holes in the ears), the ears' swing, the people line-up. **Not checked**: by eye in motion.

**Feedback**: the eyes are a little creepy.

**Decision**: small dark beads sunk in the dark patch under heavy, slanted brows looked stern. Now: bigger, rounder eyes set forward, warm dark brown, a large and a small shine, a lighter ring of fur round each so they stand out from the patch, thinner level brows set higher. **Checked by script**: her face from the front and both sides. **Not checked**: blinking and the bark/point brow lift by eye.

**Feedback**: no: the new eyes are too big and cartoonish.

**Decision**: back to a spaniel's size, a soft almond shape, dark warm brown, one quiet shine, no ring; kept the softer, higher brows and the eye set a little forward (not sunk in the patch). **Checked by script**: her face from the front and both sides.

**Feedback**: shared two reference pictures of friendly cartoon dogs from children's TV (big eyes with white, coloured iris, pupil and shines; happy open mouths; soft fur marks rather than brows).

**Decision**: her eyes are built that way: white, a big warm brown iris, a dark pupil, two shines, a thin dark line along the top; brows softened to a mark close to her fur colour. Lili's own face otherwise (no characters copied). **Checked by script**: her face from the front and both sides. Next to discuss: a happy open-mouth smile, a smoother head.

**Feedback**: balls stick out of her eyeball; an eye is one ball, not several. Do a much better job.

**Decision**: each eye is now one ball with the iris, pupil, shines and top line painted on it as a texture. **Checked by script**: her face from the front and both sides.

**Feedback**: the mouth is three or four balloons blended together; the eyeballs stick out of her head.

**Decision**: the head is now one smooth surface from skull to nose with her markings, freckles, nose and brows painted on; the lower jaw is one smooth piece; the eyes are set into the head. Still ovals: neck, chest and paws. **Checked by script**: the turnaround, the face close up, the shake, no errors.

**Feedback**: the eyes pop out of her head (a screenshot from the front three-quarters); the tongue out is horrible.

**Decision**: each eye is a round ball sunk behind the skin, only a shallow cap showing, placed from the head's own surface, the iris facing out through it. The tongue is a flat, soft tongue shape with a rounded tip and a groove, hanging over her lower lip. **Checked by script**: her face from the front, three-quarters and the side, tongue in and out.

**Feedback**: the eyes are misplaced, almost on her nose (a screenshot from the front); part of the tongue is white.

**Decision**: the eyes are placed by height and spacing on the front of the skull, above the muzzle, facing forward; the tongue lay partly inside the white lower jaw and now lies on it. **Checked by script**: her face from the front, three-quarters and side, tongue in and out.

**Feedback**: the first move of the eyes (high on the skull, looking out) was better; a bit more to the centre.

**Decision**: that height, closer together (height 10.5, 8.6 from the middle), brow marks above. **Checked by script**: front, three-quarters, side.

**Feedback**: the tongue still comes out through the jaw a little.

**Decision**: tipped down as a whole, its middle went through the jaw. Now it is bent: flat along the jaw, curving down over the lip, and it slides out until the bend is at the lip. Hidden when in (a bark shows the open mouth without it). **Checked by script**: three-quarters, side and front, tongue out.

**Feedback**: it looks like she has a tumour on her chest.

**Decision**: a separate oval of chest feathering stood out between her front legs; removed, the chest is now the body's own smooth surface. **Checked by script**: the turnaround.

**Feedback**: some movement in the eyes might make them more natural. Do not start the dog with a shake.

**Decision**: her eyes glance about on their own every second or two and lead her head towards what she watches. The shake at the start was a bug: before the first frame `swim` was unset, which counted as climbing out of the lake. **Checked by script**: no shake in the first two seconds; still frames with the eyes looking different ways.

**Feedback**: only the ears need fixing now: you can see through them at some angles; attach them to the head. The eye movement is good.

**Decision**: each ear's root was an open end floating beside the head; it is now closed and sunk into the skull, so the ear grows out of the head. **Checked by script**: the turnaround, the face close up, a gallop strip.

**Feedback**: attach her ears a little higher.

**Decision**: the ear roots moved up the skull (root at height 15.5, from 11). **Checked by script**: face and turnaround.

**Feedback**: her ears do not move up and down when she jumps.

**Decision**: in the air they are softer again and carried only a third by her rise and fall: they lag, float up near the top and drop on landing, still without the flutter. **Checked by script**: the ear tip's height through a jump from a stand (rises about 12) and from a run (about 25, up near the head), then back down.

**Feedback**: make the car destroy things like the light poles.

**Decision**: a pole hit by the car topples away from it with a crash and stars, bounces once and lies there, no longer solid; the car ploughs on, slowed a little; it counts on the mess counter. Only the car does it. **Checked by script**: driving into a pole (falls, not solid after, car keeps going, counter up), the fallen pole lying on the pavement. **Not checked**: by eye in motion. Open: should poles stand up again; should the car knock down other things (benches, café tables, trees?).

**Feedback**: hitting a pole should be a crash: the car stops or at least slows right down, with a crash sound.

**Decision**: the crash keeps the sound, the car shudders and is nearly stopped (a fifth of its speed); the pole still falls.

**Feedback**: you can see the pole through the car.

**Decision**: the car kept rolling onto the pole it had knocked down; now it stops dead and rocks back a little, so the pole lies in front of it. **Checked by script**: the car's position after the crash stays short of the pole's base.

**Feedback**: continue with the plan in the design doc.

**Decision**: step 3, missions: the file format and its reader, the runner, the actions they need, and three missions (poo on the picnic table; drive to school; take the teddy from a boy and bring it home, which opens after the school). New in the game: a poo (she squats where a mission wants one), a teddy held by a boy outside the school, a tug of war with her play growl, carrying in her mouth, dropping at home or when she barks, mission cards at the top of the screen with a tick and confetti when done. **Checked by script**: each mission played through (a leap onto the table and a poo on it; driving past the school; tug, carry, drop at home), the cards opening and ticking, the teddy hugged, pulled and carried, no errors. **Not checked**: by eye in motion; sounds by ear. Next: step 4 (picture list, voice, saving, rewards). The dog park and the farm are still to come.

**Feedback**: can't find the things the missions need.

**Decision**: brought forward from step 4: a trail of white paw prints on the ground towards the place the followed mission needs (the car first for a drive, the boy with the teddy, then home), a bouncing marker when close, a big arrow at the screen edge when it is out of sight; tapping a card picks which mission to follow. **Checked by script**: the trail and arrow from home towards the car and towards the picnic table, tapping a card, no errors. **Not checked**: by eye in play.

## Iteration 10: jobs for children of 5 to 7

**Feedback**: the missions are a little confusing for children; rework them for 5 to 7 year olds, add a bunch of them, give the town lots to do, and have them get harder or trickier as the children learn. "You are the expert, you can do some research first."

**Decision** (design in `docs/open-world-design.md`, *Jobs for five to seven year olds*; the research is under its *References*):
- **One job at a time** on one card, in two or three big pictures, said out loud, with the way shown in the town; tapping the card says it again and shows the way. Three cards open at once was the confusing part.
- **A sticker book**: a job done becomes a sticker; the book shows every job, and tapping one starts it (again). The next job starts by itself, so nobody has to choose or read.
- **Four levels, 26 jobs**: one button or one run; then a skill or a count of three; then two steps with the way no longer shown unless asked for (or after 25 s of nothing); then three steps, long hunts and one rule (make five friends without scaring anybody). A level opens on stickers earned (4, 9, 15), not on every job below it.
- **More to do**: 26 bones to find with a counter, 7 heaps of earth to dig up, 8 more people (a butcher whose sausages can be stolen), things put back once she is far away. A person out walking now stops when she waits beside them.
- Stickers, the job in hand and the counters are saved in the browser (`?fresh` starts over).
- Not built, proposed as the next slices: the dog park, then the farm. More jobs now need more places.

**Checked by script** (headless, waiting on game time):
- All 26 jobs played to the end in one run, each step logged: by keys for galloping, barking, jumping, swimming and shaking, the jump into the lake, the jump onto the picnic table and the poo there, the tug of war and carrying home; by really driving into lamp posts; by putting her beside things for bones, heaps, people; by the test hooks for birds, pots, cones and apples. No page errors.
- Standing beside each of the 16 people who are not nervous wins a hello (three who were out walking used to walk away first); every heap digs up; say hello done by keys alone following the paw prints; a run and a jump at a market stall knocks its three apples off.
- The card (new, at the top, tapped: said again and 14 s of help, and she does not run to the tap), pips filling and emptying on a scare, the celebration, the count on the book button, the "New jobs!" banner at 4 stickers, the book (the town waits, a locked sticker stays locked, an open or done one starts, Escape closes), and the save surviving a reload: looked at in screenshots at 1100×700, 390×844 and 844×390.

**Found and fixed on the way**: the first frame started the first job and saved over the saved game; the poo job passed beside the table, not on it; tests that waited on the clock instead of game time reported jobs as stuck that were not.

**Not checked**: the voice (no sound in the test browser; it is the browser's own English voice, which differs by device, and a stand-in); touch on a real phone or tablet; whether a five year old understands the pictures, which only a child can tell us; how it feels over a whole sitting.

**Feedback**: Lili starts looking away from the camera.

**Decision**: she starts facing the camera (south), as if just out of her door, so the first thing a child sees is her face. The same in the studio.

**Checked by script**: screenshots of the start at 1100×700, on a phone and in the studio: her face is to the camera. **Not checked**: nothing else changed.


**Feedback**: jumping on the picnic table is really hard; maybe she should snap to the table.

**Decision**: a jump at something to get up onto lands on it (`jumpAim` in `src/main.js`, docs/tech.md "Jump"). It was hard for three reasons: from a stand she jumped on the spot and went nowhere; from a run she had to leave the ground at one distance (from 200 away it worked, from 130 a little to one side or from 270 it did not); and the table's side stopped her on the way up. Now, when jump is pressed near the table, a bench, a market stall or the car, and she is heading roughly at it (within about 50°, from up to 260 away) or standing right beside it whichever way she looks, she turns to it, leaps at the speed that brings her down on it, is not stopped by its side, and stops on top for 0.6 s so that she does not run off the far side. From a stand further away she takes a few bounds at it first. Any other jump is as it was, and she can still lean in the air. It is an aim, not a magnet: nothing pulls her while she is just running past.

**Checked by script** (headless, keys; the same trials on the version before and on this one):

| Jump at the table | before | now |
| --- | --- | --- |
| standing, 112 to 240 away, facing it or up to 45° off (36 trials) | 3 | 33 |
| trotting at it, jump pressed 130 to 270 away, on line or 50 to one side (24) | 12 | 24 |
| galloping at it, the same (24) | 12 | 24 |

- The three still missed are one spot 240 away where she had turned to point at pigeons before the jump was pressed, so she was not facing the table: an ordinary jump, as meant.
- A bench (and the end of it she runs at), a market stall and the car (she gets in): landed on from 135 away at 23° off, and from right beside facing sideways.
- No aim, and the jump as before: in the open; 200 and 300 away from the table; 70° off it at a distance.
- The poo job done by keys alone (run at the table, jump, let go). A tap on the table (she runs to its foot) and then the jump button puts her on it. Galloping with the key held, she lands, stays, and runs off after the stop if the key is still down.
- Looked at four frozen frames of a standing jump from beside the table, facing sideways: she turns to it, leaps and lands in the middle.

**Found on the way**: `node --check` passes a module with a name declared twice; the game did not start and the check said nothing. Check a `.mjs` copy and load the page once (docs/tech.md, test hooks). More than two test browsers at once overload this machine and the game in them does not start.

**Not checked**: touch on a real phone or tablet; a gamepad; whether a five year old now gets up first time, which only a child can tell us.

**Feedback**: the voice that says the jobs is horrible. (It was the browser's own speech synthesis.)

**Decision**: every line is now a clip, the same on every device, made on this machine by a speech model (Kokoro 82M, voice `af_heart`, a little slow) with `tools/voice.py` (docs/tech.md, "The voice"). The browser's voice is gone altogether: a line with no clip is not said, so nothing can fall back to it. 47 lines, 0.6 MB as mp3. To keep every line a whole clip, the book now says "Get more stickers first!" without the number. The game's own lines are in one place (`SAY`, `PRAISE` in `src/main.js`). Six lines in ten voices of the same model are on a listening page (`http://linuxpc.tailafeefd.ts.net:8791/`) for the owner to pick another, or to say none will do; a recorded family voice is still the better answer for a game about your own dog.

**Checked by script**:
- A speech recognizer wrote down what each of the 47 clips says: 46 match their words. "Bark! Woof, woof!" is written "Bark with with"; the model was given the right sounds for "woof", and "Woof! You did it!" is heard right, so this is likely the recognizer.
- Every line a job can say (37) has a clip, and all 47 files load.
- In the browser: nothing is said before the first key; then the first job's line; after the job, the praise and the next job's line; a tap on the card says it again; muted, a tap says nothing; no errors.

**Not checked**: how it sounds. I cannot hear it, and the check only says the words are there. Loudness against the barks and the car; on a phone or tablet.

**Feedback**: af_bella is really good.

**Decision**: `af_bella` is the voice; every clip was made again with it (`tools/voice.py`, its default now).

**Checked by script**: the speech recognizer heard 45 of the 47 clips word for word. "Bark! Woof, woof!" as before ("bark with wuss"), and "Say hello! Go to a friend and stand still." heard without the "a" (with `af_heart` it was heard whole). **Not checked**: how either sounds; that needs ears.

## Iteration 11: a title, a bark button that says WOOF, music, and exploring

**Feedback**: it needs a title screen with "Lili Runs Wild" and a play button. The bark button does not look like barking: it looks like a sound button. Jobs come one after another too soon, so there is no exploring; better if she explores and meets a person, an animal or a box with a note that gives the job, with rewards like a new colour. It treats the child as a dog ("good girl"). Some jobs are silly (Jump!). Background music would help.

**Decision (title and bark)**: the game opens on a title over the live town: the name in big wobbling letters, Lili at her door, a big green play button; any tap, key or pad button plays, she barks and the first job follows. `?play` skips it, for tests. The bark button is now a speech bubble saying WOOF!. The rest (music; jobs handed out around town; what to win; the words) follow below.

**Checked by script**: the title at 1100×700, 390×844 and 844×390 (looked at); a key, and a tap anywhere, play; the first job's card comes after it and not before; nothing on the title steers her. The new button looked at beside the jump button.

**Decision (music)**: a bouncy tune in C at 108 beats a minute, about 70 s before it comes round again, synthesised in `src/music.js` (a toy marimba tune over plucked off-beat chords, a soft bass and a shaker; docs/tech.md, "Music"). It starts on play, fades in, sits well under everything and dips while a line is said. Mute silences it with the rest.

**Checked by script**: the whole tune rendered offline: 71 s, peak 0.21 (no clipping), about −33 dB against −17 dB for a spoken line and −18 dB for the bark. It starts on play and nothing breaks. **Not checked**: whether it is nice, or annoying after ten minutes: I cannot hear it.

**Owner's answers**: prizes are things to wear, toys she can play with, a new dog house and so on; yes to a cat and a duck; the prize comes right when the job is done; children's voices: try raising the pitch.

**Decision (exploring first)**: no job starts by itself any more. Eleven people about town ask for them (`from:` in each job, `id` and `voice` in `world/people.js`), each with what they want in a bubble over their head; she comes up to one and they ask, in their own voice. While a job is in hand nobody asks, and nobody does for a few seconds after one. A child who finds nobody for a while (12 s at first, then 40 s) is shown the way to the nearest asker. The neighbour next door asks first and is in sight from the start. The run, jump and bark jobs are gone (23 jobs; levels open at 2, 7 and 13 stickers). Every job's words are new, spoken to Lili by whoever asks; the game's praise speaks to the child ("You did it!", "Brilliant!") and "good girl" is gone. Grown-ups have voices of their own (`af_heart`, `af_sarah`, `am_michael`, `bm_george`); children are a woman's voice raised in pitch (girls `af_jessica` ×1.25, boys `af_nova` ×1.4: about 270 and 250 Hz, as a child of five to seven), with samples on the listening page (docs/tech.md, "The voice").

**Checked by script**: from a fresh start, nothing is asked for 3 s and more; at 12 s the way to the neighbour is shown; beside her she asks and the job is "find a bone" in her voice; done, nobody asks for 4 s even beside an asker; after one sticker the girl at the plaza and the café have a job and the rest wait for their level. The neighbour and her bubble seen from the start at 1100×700 and 390×844. The recognizer heard all 46 clips word for word, but for "Hee hee" written "Hehe".

**Not checked**: how the raised children's voices sound (I cannot hear them); whether children find askers by themselves.

**Feedback**: children's voices: af_sky at 1.25. And the game started with "Lili! Go and say hello to three friends!", a job starting by itself.

**Decision**: every child is `af_sky` raised 1.25. The job came from the saved game: the old version had it in hand, and the new one resumed it after play. A job in hand is no longer kept at all: the game always opens with exploring, and whoever asked for an unfinished job asks again.

**Checked by script**: an old save with "hello-three" in hand opens, plays, and 4 s later has no job and has said nothing; the stickers are kept.
The recognizer heard all 46 clips word for word with the new children's voice (but "Hee hee" written "Hehe").

**Feedback**: the WOOF! bubble is not good: an icon with text in it is not an icon, and children of 5 to 7 in Denmark do not read. It should be a dog barking.

**Decision**: the bark button is a picture of a dog's head barking, in profile: round head, floppy ear, mouth open, three shout lines. Not arcs (they made the old loudspeaker read as the sound switch). From now on every button and prompt has to work as a picture alone; the spoken lines carry the words.

**Checked by script**: drawn large and at both button sizes beside the jump button (looked at), then in the game at 1100×700 and 390×844.

**Feedback**: the teddy: she should play with it more: pull, and the child keeps pulling until they let go. Carried, it is fixed in the air; it should be in her mouth and move, like her ears. She bows and shakes far too often; the bow should be now and then, the shake rare. And a button to leave a toy where she is, and a place at her house where she leaves her things.

**Decision**:
- **Tug of war**: grabbing a toy from someone is now a pull the child has to win: steering her away from them pulls (growl, dust, braced), and stopping lets them pull it back slowly. 1.6 s of pulling in all and they let go and sit down with a bump. If the child does nothing, an arrow on the ground shows which way to pull. A bark lets go.
- **In her mouth**: what she carries hangs from between her teeth on the model and swings like a pendulum as she speeds up, stops and turns, jiggled by her stride (the teddy hangs by its head, the sausages by one end).
- **Bow and shake**: standing about, she bows after 12 to 22 s, and about one time in seven shakes instead (it was one or the other every 4.5 s).
- **Putting down**: a purple button with an arrow down (the jump button's points up), shown only while she carries something; G or C, pad B. A wicker basket by her kennel: whatever she puts down near it goes in and is kept there, and she can take it out again by running at it. Bringing something home means to the basket.

**Checked by script**: with no pulling for 3 s the tug stays at 0 and the arrow shows (looked at); pulling away wins the teddy after 1.65 s of game time and the boy sits; a bark during a tug leaves him the teddy. The teddy looked at in four frozen frames while she starts, runs and turns: it hangs from her mouth and swings. The button hidden with nothing carried and shown while carrying; the teddy put down in the street lies there; put down by the basket it is in it, 6 up, kept (looked at).

**Not checked**: how the tug feels by touch (pulling means holding a finger behind her); the bow and shake rates over a real play session.

**Feedback**: picking up the teddy, the pop-up was in front of the dog and the girl, and I could not see what was happening.

**Decision**: the new job's card no longer comes up big in the middle: it bounces in at its place at the top and pulses for a moment. The sticker when a job is done is smaller and higher (its rays shorter), and the "new jobs" banner is higher too, so Lili and whoever she is with stay in sight.

**Checked by script**: frozen frames of the teddy boy asking, at 1100×700 and 390×844: the card at the top, Lili and the boy clear below it; the sticker of a finished job above them (looked at).

**Feedback**: pressing play, Lili barks without the sound: only the animation.

**Decision**: sounds from files start loading with the first touch (browsers allow nothing before), and play was barking before the bark had loaded. The hello bark now waits for it (`A.ready('bark')`).

**Checked by script**: pressing play, the bark sound (0.37 s) starts in the same frame as her bark.

**Feedback**: the tug of war can be more real: the teddy stretched between them, and actually pulling, something you keep pressing until she has more power than the girl. After she drops the teddy there is no way to pick it up again. And she could bring her toy to another child to play: they throw it and she fetches it, or they hold it and it is a tug of war. That is how you play with a dog.

**Decision**:
- **Tug won by tapping**: every tap (screen, any button, any key) is a yank; the child pulls back all the time. A bar over them, her face at one end and theirs at the other with the toy between, shows who is winning; the buttons pulse. She wins with about three taps a second in four seconds; with no taps the child wins in four and a half and keeps the toy. The pull runs across the screen, her mouth a toy's length from their hands, the toy lying along it and stretched, more on each yank.
- **Picking up again**: the bug was the short pause before something put down can be picked up: it stopped counting once the thing settled, so it never ended. Fixed (it also kept resting things from being knocked).
- **Playing with people**: stopping beside a child or a dog lover with a toy, they take it, then throw it over her head to fetch or hold it out for a tug.

**Checked by script**: no taps for 5.5 s: the boy wins and keeps the teddy. Tapping every 0.2 s: won after 11 taps, 3.9 s; the boy sits. Put down, she picks it up again running over it. Brought to the girl at the plaza: thrown and fetched; offered and tugged. The tug looked at from both sides, at rest and on a yank: the teddy stretched between her mouth and his hands, the bar the right way round.

**Feedback**: when the game starts, the first thing she does is bark: a bug.

**Decision**: the bark on play is gone (it was meant as a hello). Play starts the music and nothing else.

**Checked by script**: pressing play, no bark in the 2 s after it.

**Feedback**: a favicon and an icon, so the game looks right added to the home screen on iOS (it already works like an app).

**Decision**: the icon is Lili's face from the job cards on the grass green, drawn in code (`tools/icon.html`) and saved at each size by `tools/make_icons.py`: the iPhone home screen icon (180), 192 and 512 for Android, a maskable one, and a 32 favicon. A web app manifest and Apple's tags: added to the home screen it is called "Lili" and opens full screen.

**Checked by script**: the icons saved and the 512 looked at; the manifest, icons and page served, and the page loads. **Not checked**: adding it to a real iPhone's home screen.

**Feedback**: maybe not just one job: three at the same time, all of a level's, as she explores. What do you think? (Answer: everyone with a job open already shows a bubble at once; keep one job in hand, since three cards confused a five year old, but keep the bubbles up during a job and let the child swap. Owner: yes.)

**Decision**: the bubbles stay up while a job is in hand (not the one whose job it is). Standing still for 0.8 s beside another asker swaps to their job; running past does not, nor does it while she carries something. The job left goes back to its asker. Nobody asks for 3 s after a swap.

**Checked by script**: during the neighbour's bone job the café man's bubble is up (looked at); running past him keeps the bone job; standing by him swaps to his; the neighbour offers the bone job again. Carrying a toy beside a dog lover, she gives it to him first (playing) and then he asks: a toy is not a job's thing, so that is meant; a job's own thing (the teddy or the sausages on their way somewhere) is never given away, and carrying it keeps the job.

**Feedback**: can the game draw only what is on the screen? On my daughter's iPad (the old one) it does not run that fast.

**Decision**: three.js already leaves out what is off screen, and only the town near her is built; the cost on a tablet is pixels, shadows and triangles. Measured what a frame draws (`__G.api.stats()`, `heaviest()`): people were 21 000 to 29 000 triangles each, Lili 77 000 of which her head alone is 42 000. People's smooth shapes now have a quarter of the detail (a frame in the town centre 468 000 → 350 000 triangles); her head's shadow is cast by a plain egg. And quality levels: when frames are slower than 45 a second while playing, it steps down (fewer 3D pixels, then plainer shadows, last none) and remembers the level for next time. `?fps` shows the frame rate on the device.

**Checked by script**: triangles per frame at six places before and after; each level sets the 3D picture's size (2048×1536 down to 1024×768 on a 1024×768 screen at 2×) and the shadows; on this machine's software renderer the watcher stepped down to the last level within a few seconds and kept it; full quality and the last level looked at side by side. **Not checked**: the frame rate on the iPad itself; that needs `?fps` on it.

## Iteration 12: the big park

**Feedback**: expand the world: a big park next to the town, with lots of open space. (Plan agreed: east of the town through a gate; the park first, then a dog park with other dogs, then the prizes.)

**Decision**: the park, 8 × 11 tiles east of the town, entered through a gate in the houses opposite the middle road: woods all round (three big trees a tile), a path through them north to south, a wide meadow, a round pond with ducks who paddle away from her and never fly off, the ice cream van at the end of the main path. New askers: a big white duck on the pond's bank (an animal, quacking, in a raised child's voice), a girl with a frisbee, the park keeper, the ice cream seller. Seven jobs (levels 2 and 3): swim in the pond, a big splash into it, fetch the frisbee three and five times (she throws it about 300 away, Lili brings it back, she throws it again), three bones in the woods, the treasure buried there, and a run round the park (pond, woods, van). On the way: each body of water has its own surface (one over both the lake and the pond would have covered the town); the way shown follows a step's place (the pond, not the lake; bones in the woods).

Found while measuring the park: the hedge and the flowers were each one batch for the whole map, drawn whole wherever the camera looked; with the park, 440 000 triangles a frame. Now a batch per area and lighter flowers: a frame in the meadow 621 000 → 276 000 triangles, the town centre 350 000 → 248 000, at home 220 000 → 98 000.

**Checked by script**: five places in the park looked at (gate, meadow, pond, van, woods); the ducks paddled 216 away and stayed on the water; the duck asked for the swim and a swim in the pond did it; the frisbee girl asked and threw, three fetches (291 to 361 away) and returns did the job; the park tour advanced pond bank → woods → van; the way from home leads to the pond, the woods and the park; frames measured at six places in town and four in the park; the flowers looked at up close; the recognizer heard every new line.

**Not checked**: how it runs on the iPad; whether the park's size feels right to a child; the duck's voice.

**Feedback**: the frisbee could be thrown further.

**Decision**: thrown faster (420 to 510 a second) and sliding a little more when it lands: about 500 away, not 300.

**Checked by script**: three throws landed 499 to 517 from the girl, all fetched; the job done.

**Feedback**: the scratching sound when she brakes to turn and run the other way is too quiet, or gone.

**Decision**: it was never changed, but the music came in this round, and its shaker is the same kind of hiss: the skid, a narrow band of noise, measured 17 dB under the music. Now a wider scrape with a gritty low layer under it, about 9 dB over the music (the bark is about 15 over), peak 0.59.

**Checked by script**: the old and new skid rendered offline against the tune, and three loudnesses compared; the page runs. **Not checked**: how it sounds: I cannot hear it.

**Feedback**: the older skid sound was better; it was only too quiet.

**Decision**: the old sound back (a hiss sweeping from 1700 to 900 Hz, 0.22 s), only louder: 2.4 where it was 0.09, about 9 dB over the music, peak 0.53.

**Checked by script**: the old sound rendered offline at 0.09 (18 dB under the music) and louder; the chosen level about 9 dB over.

**Feedback**: drive to the beach? Which beach? (Answer: the sand round the lake. Owner: yes to calling it the lake.)

**Decision**: the drive round town says "the lake", and its card shows the lake: children know it by that, there is no sea, and the park's pond has a sandy edge too. Where it counts is unchanged (the sand round the lake).

**Checked by script**: both new lines made in their voices and heard word for word.

**Feedback** (with a screenshot): she never gets the frisbee back.

**Decision**: the girl only took a toy when she was not resting after something (`cool`), but Lili coming close makes children pet her, and petting starts that rest: she was always petting and never took it. The test had cleared the rest before going back, so it passed. Now taking a toy is not held back by it (only by a short pause after a throw), and they take it while coming to pet her or petting her too.

**Checked by script**: running back to her and stopping, as a child would (nothing reset): she took it 0.7 s after Lili stopped, twice, and the job was done after three.

## Iteration 13: the beach

**Feedback**: a beach along the bottom of the world: you only see the beach, never the horizon. Keep it simple.

**Decision**: one long strip of sand under the town and the park, the sea below it (Lili can swim out a little way), two paths down between the houses and the park's woods path onto the sand. Sandcastles (knocked down at a trot, built again when she is far away), umbrellas with towels, seagulls (they fly off and land further along the sand), a heap of sand with treasure. A boy and a girl with sandcastles and a woman by her umbrella ask for five jobs. The sea has no ripples (too big to work out on an old tablet; a splash still shows) and no hedge stands in it. Left out: a crab, a lifeguard's tower, waves.

**Checked by script**: five places looked at (the path down, the sandcastles, the umbrella, swimming in the sea, the park's end of the beach), 140 000 to 260 000 triangles a frame; the boy asked and three sandcastles knocked down did his job; the girl asked and running at the seagulls did hers, and they landed on sand; the woman asked and a swim in the sea did hers; the recognizer heard every new line ("sand castles" for "sandcastles").

**Not checked**: on the iPad; the treasure and bones jobs played through (the same actions as in the woods, which were).

**Feedback** (with a picture): the heap on the beach looks like a bone stuck in a pile of poo.

**Decision**: it had the poo's dark brown. On sand a heap is now sand-coloured; on earth a lighter, warmer brown; both with clods thrown round and more of the bone showing.

**Checked by script**: the beach's heap and a heap on a lawn looked at.

**Feedback**: the bone stuck in sand is silly (three other treasure ideas offered). Owner: just remove it.

**Decision**: every heap on sand is gone (the beach's, the lake's beach, the sandpit), and with it the beach's treasure job (34 jobs). Heaps of earth stay under the trees and in the woods.

**Checked by script**: the game loads with no heap on sand and 34 jobs.

**Feedback**: the way to where a job wants her (paw prints, the marker, the arrow) does not look good and is confusing; maybe have it on the floor.

**Decision**: the way is drawn on the ground in the 3D scene, under everyone standing on it: up to seven orange chevrons with a white rim from a little ahead of her towards the place, a glow running along them the way to go, and a pulsing orange ring round the place. The paw prints, the bouncing marker and the arrow at the screen's edge are gone.

**Checked by script**: looked at four ways: to the neighbour at the start (chevrons, ring round her feet), a bone close by (the ring alone), the sea from the town centre (chevrons down the screen), the seagulls on the sand.

**Feedback**: the game's first load is slow.

**Decision**: profiled the start. Half a second went on finding which tile a point is on by looking through every tile (the sea's shore map asks half a million times; the beach and park made the map much bigger), now a grid lookup; half a second on building the same shapes again for every bone, heap, bird and person, now built once and shared.

**Checked by script**: the first frame in headless Chromium 7.1 s → 3.5 s (most of the rest is its software renderer); four places on the beach looked at, unchanged. **Not checked**: the start on the iPad.
