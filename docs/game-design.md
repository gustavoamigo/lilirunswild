# Game design

Where the game is going: an open-world game (one big town to roam freely, with cars to take and missions to pick up), played as a dog. Roam freely, take a car, cause chaos, later do missions. The chaos is a spaniel's: affection and enthusiasm, never harm.

What exists now is the dog and a small town to try him in.

## The title

The game opens on a title over the live town: "Lili Runs Wild" in big wobbling letters at the top, Lili at her door in the middle, a big green play button at the bottom. Any tap, click, key or pad button plays (a five year old taps wherever); she barks, and the first job comes a moment later. The tap is also what lets the browser make sound.

## Music

A light, bouncy tune plays under everything from the moment the title is played, quiet enough that the barks, the car and the spoken jobs stay on top, and dipping while a job is said. It is synthesised, like most sounds: a toy marimba tune over plucked chords, a soft bass and a shaker.

## The dog

Lili, liver and white: a white body, brown sides to her head with a white blaze between, long wavy brown ears, a brown nose with freckles round it, a pale pink collar with a silver tag, a brown patch where her tail begins and two small marks on her back, a wagging tail of some length, tongue out. Modelled on a photo of her (2026-11-13).

| He does | How |
|---|---|
| Trot | Steer. He turns on the spot and stops when you let go. |
| Zoomies | Keep running flat out for about a second (or run at birds) and he tips into a gallop: half as fast again, ears flying, dust. He has no brakes and skids wide round corners. |
| Jump | From a stand she sinks on her haunches and drives off them; when already running she takes a stride and springs: a long low leap, or a high one when there is a bench, the table, a market stall or the car in front of her. Jumping near one of those and roughly towards it, or standing right beside it, lands her on it: she turns to it, leaps and stops on top (a five year old aims roughly). In any other jump she can still lean in the air. |
| Bonk | Gallop straight into a tree, lamp, bench or the hedge: stars, a dazed moment, leaves fall. A glancing hit only slides him past. |
| Say hello | People react by their nature and how she behaves. Stand calmly by someone and dog lovers and children come and pet her; trot into them and it is paws up on their chest, which dog lovers love and the uninterested shrug off; fly into them (jumping or galloping) and they sit down with a bump, then run away screaming. Nervous people run from anything but calm, a bark sends most of them off, and a near miss with the car too. |
| Break stuff | Run into pots, bins, cones, boxes and a ball. Pots smash, bins spill. Jump on the picnic table and the plates go flying. Each thing counts once on the paw counter. |
| Birds | He notices any flock nearby: his head turns, he yips, a bird appears in a thought bubble. Standing still he freezes and points for a few seconds, then relaxes (wags, bows, shakes) and points again a while later, or at once at another flock. Run at them and he goes straight into zoomies; they fly off to another spot and the bird counter goes up. Barking scares them too. |
| Bark | Startles people and birds near him. Its button is a picture of a dog's head barking: mouth open, shout lines. A loudspeaker read as the sound switch, and a bubble saying WOOF! was text: the children (Danish, 5 to 7) mostly cannot read. |
| Play bow | Left alone for a few seconds, he asks for a game. |
| Drive | Near the car a wheel bubble and a yellow button appear. E (or jump onto the car) and he hops into the seat, paws on the wheel. |

## The car

An open red car, one in town. Steer where it should go; steering against the way it faces brakes and then reverses. It is quick (about one and a half times a gallop), slides a little, knocks over anything loose, scares birds, and people hop out of its way. It knocks light poles flat (they topple away from it, and count on the mess counter). Hitting anything else solid stops it with a crunch and a bounce. Bark is the horn. E hops out over whichever side has room.

## The town

Built from tiles on a map (`world/map.txt`): streets in a grid (a ring road, a middle road, two cross streets) with crossroads, zebra crossings, road works and a parking bay; houses round lawns, a park with a plaza, benches, flower pots and a picnic table, a playground with a sandpit; Lili's home (her kennel and bowl by the door), where she starts, and the school; the town centre: the butcher's, the baker's and a café round a square with a fountain and market stalls piled with apples; a lake with a sandy beach all round, ducks and a ball (she swims in it and shakes herself dry after); houses all round, a hedge round the edge. Seven people: four adults and three children; two of them (a woman walking the west lawn and a boy on the east lawn) are nervous of dogs; three flocks of birds.

## People

Cartoon adults and children, natural in how they walk and stand. Three reactions to Lili: love (they crouch and pet her; a child petting her sets her tail going fast and her bottom wiggling), indifference (a glance and a shrug), and fright (they scream, run, catch their breath and come back). Who reacts how depends on both their nature (dog lover, not interested, nervous; children like dogs more) and how gentle she is. Planned later: Lili steals a child's toy, the child holds on, then gets scared, screams and runs; the same with adults; jumping at people frightens them, gentleness wins them over.

## Places still to come

Agreed with the owner (2026-11-15), built one district at a time, each with a few missions later: a dog park, a farm at the edge of town, then (later) an amusement park. Also suggested: a vet or groomer (the bath she runs from), a post office or postman, a fire station, a building site, a football pitch, a train station, an ice-cream van, woods with a stream. Layout: the town centre in the middle, homes and the school round it, big open places at the edges.

## Rules that will hold

See *Design rules* in `CLAUDE.md`: not violent, he is a dog, the camera never turns, one finger is enough.

## Missions

Jobs for children of 5 to 7 (`docs/open-world-design.md`, *Jobs for five to seven year olds*): asked for by people she meets while exploring (a bubble over their head shows what they want), one at a time, said out loud, shown as big pictures on one card and pointed to in the town; done, it becomes a sticker in a sticker book and the next starts by itself. Nothing is timed and nothing fails. 26 jobs in four levels that get trickier: first one button or one run, then a skill or a count of three, then two steps with the way no longer shown, then three steps, long hunts and one rule (be gentle). Any job can be picked or played again from the book.

Things to do without a job: bones to find all over town and a counter for them, heaps of earth to dig up, more people to meet (a butcher with sausages to steal). What she breaks is put back once she is far away.

## Where it is going

An open-world game for children of 5 to 7: one big town built from reusable tiles, jobs as files, no points or timers (`docs/open-world-design.md`). The town grows by places, each small and full of its own things to do, with its own jobs: next the dog park, then the farm.

## Not decided yet

- The voice that says the jobs: which language, and whether a family voice should replace the generated one (docs/tech.md, "The voice").
- Rewards beyond stickers (things for Lili to wear).
- Camera: fixed and looking north, as in wheek. A camera that follows behind the car, turning with it, would break "up means away"; to decide when driving matters more.
- How big the town gets, more cars, traffic, people who react for longer (chasing him, calling him).
