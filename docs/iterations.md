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
