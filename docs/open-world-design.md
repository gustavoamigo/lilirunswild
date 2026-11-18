# Open world and missions: design

Status: approved; steps 1 (tiles), 2 (bigger town, only nearby tiles built) and 3 (missions) done 2026-11-15, step 4 (the jobs reworked for children of 5 to 7, see *Jobs for five to seven year olds*) done 2026-11-17; see *The town: tiles on a map* and *Missions* in `docs/tech.md`. Choices made in step 3: a poo happens on its own when she stands still where an open mission wants one; she drops what she carries on her own where a mission wants it (or when she barks); grabbing a toy from someone works with or without a mission.

## What the game becomes

An open-world game for children of 5 to 7, played as Lili: one big town with no levels or loading screens, where you go anywhere you like, at any time. You roam it, borrow the car, cause harmless mischief and make friends. Missions give ideas of what to do, never a path you must follow. Playing without any mission is always fun on its own, as it is today.

Two things make it scale:

1. **The town is built from reusable tiles** placed on a grid, so a large town does not need every corner designed.
2. **Missions are files**, written in a small vocabulary of actions the game knows, so a new mission usually needs no code.

## Who it is for

Children of 5 to 7, most of whom read little or not at all.

- **Nothing to read.** Jobs are spoken (a recorded voice in the end; the browser's own for now) and shown as pictures on a card. Paw prints and an arrow show the way. Guidance for pre-readers: audio and pictures, few and large buttons, literal icons.
- **No points, no timers, no losing.** Scores and leaderboards push children of this age towards competing, and rewards lift performance for a while but not the wish to play. Toca Boca, very popular at this age, has no score, timer or levels.
- **Rewards you can see and play with.** A sticker book that fills; later, new things for Lili (a collar, a hat, a ball) and new parts of town opening.
- **One finger is enough** (already a rule in `CLAUDE.md`).

The model: an open area to play in freely, with one bit of mischief suggested at a time and a book of all of them to pick from; earning enough stickers opens harder ones.

## The town: tiles on a map

### Tiles

A tile is a square of town, `TILE` 400 units a side (about 4.7 m; Lili is about 0.5 m long), so one tile is about what fits on screen now. A tile is a file in `world/tiles/`, one per kind, and holds everything that lives on it, in its own coordinates (0 to 400):

- **ground**: the surface by area (road, pavement, path, grass, sand, water), from which the ground picture is painted;
- **solid things** (trees, lamps, walls, houses) and **things to stand on** (benches, tables, the car's spot);
- **props** (pots, bins, balls, toys) and **birds**;
- **spots**: named places that missions point at, with tags: `table`, `school-door`, `sandpit`, `home`, `toy`, `bin`.

People and cars are not part of tiles: they are placed on the map in their own file (`world/people.js`: a map square and a place in it, or two places to walk between), so a tile can be used any number of times and people go wherever they are wanted.

Each tile also says what its four edges are (road, pavement, grass, hedge), so the map editor and a later check can see that neighbours fit, and how it may be turned (0, 90, 180, 270°).

First kit: road straight, corner, T, crossing; park lawn, park with trees, plaza, playground; row of houses, Lili's home, school, shop street, beach. About 15 tiles.

### The map

One text file, `world/map.txt`: a grid of letters, one per tile, with a legend. Edited by hand.

```
# H houses  R road  + crossing  P park  S school  L Lili's home  B beach
H L R H H
P P R S S
P P R S S
R R + R R
B B R H H
```

A turned tile is written with a suffix (`R>` for a road turned a quarter). The map, not chance, decides where the school and the beach are: children find their way by landmarks, so the town is laid out by hand. Generating outskirts from tiles (for instance by Wave Function Collapse) can come later; it only controls which neighbours fit, not where the landmarks go.

### Only what is near is built

The game builds the meshes of the tiles within about two tiles of Lili (or the car) and drops the rest, so a town of any size costs about the same to draw. People and props of a dropped tile are kept as data and carry on simply (a walker keeps walking along its path) so a tile looks lived in when she comes back. The ground is painted per tile, not as one picture of the whole town as now.

### What changes in the code

Today the town is one hand-built layout (`buildTown` in `src/world.js`, with the ring road as a formula) and its ground is painted once into a single texture. Both become tile-based. The rest of the game (Lili, the car, people, birds, collisions) already works from lists of things with positions, so it keeps working; the lists are filled from the tiles near her.

## Jobs for five to seven year olds

The first three missions were three cards at the top, open at once, with small pictures. A child of five did not know which to do, what a picture meant or where to go. This section replaces that (2026-11-17). Jobs are what the files in `missions/` describe; the code still calls them missions.

What the research says about this age (links under *References*): they are only starting to read, so say it and show it; pictures must be literal; one thing at a time; big targets; no fail states and no clock. And from playtests of open-ended games: with nothing suggested, children ask "what should I do?", so always have one idea on offer. Open-world games for this age that hand out the same errand again and again are found dull, so jobs must differ in what the hands do, not only in where.

### Jobs come from people she meets

Jobs used to come one after another, a moment after the last (2026-11-17), and the owner found there was no time left to explore (2026-11-18). Now exploring comes first and the jobs are found in it:

- **Askers.** People about town have jobs for her (`from:` in a job's file, an `id` in `world/people.js`): her neighbour next door, a cheeky boy in the park full of naughty ideas, a girl at the plaza, a girl in the playground, the boy with the teddy, the butcher, a boy by the fountain, the man at the café, the apple seller, a boy on the beach, a girl on the lawn. Each shows what they want in a speech bubble over their head (the job's pictures), seen from afar.
- **Asking.** She comes up to one on foot and they turn to her and ask, in their own voice ("Lili! Look at all the pigeons! Chase them!"): that is the job. Each asks for their jobs in turn, once that job's level is open; a job done is not asked for again (the sticker book plays it again).
- **All the bubbles at once.** Everyone with a job open shows their bubble, while a job is in hand too: the child always sees who else needs help, and chooses. One job is in hand at a time (one card, one way shown: three cards at once confused a five year old), but standing still for a moment beside another asker swaps to their job; just running past does not, nor does it while she carries something. The job left goes back to whoever asked for it, to be asked for again. After a job is done or swapped nobody asks for a few seconds, so finishing a job beside someone does not start the next.
- **Lost.** A child who finds no one for a while (12 s before the first sticker, then 40 s) is shown the way to the nearest asker: paw prints, a marker, an arrow at the screen's edge.
- **The first asker is in sight at the start**: the neighbour, in front of the house next door.
- **Nothing is in hand when the game opens.** A job in hand is not saved; whoever asked for an unfinished one asks again.
- **Words.** The askers speak to Lili, by name. The game speaks to the child: "You did it!", "Brilliant!", never "good girl" (that treated the child as the dog).
- **No jobs that are only a button**: run, jump and bark were not jobs, and are gone. The buttons are learnt by playing and by the jobs that need them.

### One job at a time

- **One card**, top middle: the job as two or three big pictures (who or how, then what: `Lili` + `fast`, `car` + `school`, `sausages` + `home`). A job that wants something several times shows pips that fill; a job of several steps shows a pip per step, and the pictures change with the step.
- **Told three ways.** Said out loud when it starts (and each new step). Shown in pictures on the card. Shown in the town: paw prints lead to the nearest thing it needs, a marker bounces over it, an arrow at the screen's edge points to it, and the button to press (bark, jump) pulses.
- **New job**: the card bounces in at its place at the top and pulses for a moment, its words under it. The game does not stop. (It used to come up big in the middle first, and hid Lili and whoever had just asked her, right when the job began beside them. Anything shown over the town stays high on the screen for the same reason: the sticker when a job is done, the banner when a level opens.)
- **Tap the card**: it is said again, the words show, and the way is shown for a while. This is the one "help" the child needs to know, and the loudspeaker on the card hints at it.
- **Done**: a fanfare, confetti, praise, and the job turns into a sticker that flies into the sticker book. Then she is free to explore until she meets the next asker. A child never has to open a menu or read to keep playing.
- **Never fails, never timed.** A job stays until it is done, or another is picked from the book. One late job (`five-friends`) has a rule, be gentle: scaring somebody empties its pips with a soft "oops" and it carries on.

### It gets trickier as they learn

Jobs come in four levels. A level opens when enough stickers are earned (2, 7, 13 of 23), not when every job below is done, so nobody is stuck behind one job they cannot manage.

| Level | What it asks | The way |
|---|---|---|
| 1 | one thing: find a bone, say hello, chase birds | shown |
| 2 | one skill where *how* matters, or a count of three: smash a pot (needs a gallop), drive to school, poo on the table (needs a jump up), swim then shake, three cones, three bones, three hellos | shown |
| 3 | two steps, or a thing that needs working out: take the teddy and bring it home, sausages from the butcher, lamp posts with the car, dig up a bone, apples off the market stall (needs a jump), a jump into the lake, three pots | not shown: tap the card to ask, or it shows after 25 seconds of getting nowhere |
| 4 | three steps, long hunts, a rule: a drive round three places, ten bones, five friends without scaring anybody, sausages to the picnic table, a big mess of three kinds, three buried bones | as level 3 |

So the help is taken away as the child learns the town, and comes back by itself when they are lost.

### The sticker book

A star button, top right, with the number of stickers on it. It opens a page with every job as a sticker, a row per level: done in gold with a tick, to do in pale, the one in hand ringed green, a level not yet open dimmed behind a padlock with the number of stickers still needed. Tapping a sticker starts that job, done or not: favourite jobs can be played again, and a job that is too hard can be swapped. The town waits while the book is open.

### More to do in the same town

- **Bones** lie all over town (26). Running or driving over one picks it up; a counter at the top keeps them. They come back after a minute, once she is far away.
- **Heaps of earth** (7: under the trees, in the sandpit, on the beach) hide a bone: standing still on one, she digs it up.
- **More people** (19, from 11): a butcher with sausages outside his shop, a market seller, children by the fountain, on the beach and the lawn, walkers across the town square and along the lake.
- **Things are put back**: what she broke or knocked over is back when a job needs it, and otherwise once she is far away. What she took goes back to its owner.

All of it works with no job in hand: playing freely stays the game.

### The big park (2026-11-18)

The owner wanted more open space: a big park east of the town, through a gate in the houses opposite the middle road, half the size of the town again. Agreed plan, in two pieces:

1. **The park** (built): woods all round with a path through them, a wide meadow in the middle, a round pond with ducks, the ice cream van at the end of the main path. New askers: the duck on the pond's bank (an animal, quacking), a girl with a frisbee in the meadow, the park keeper in the woods, the ice cream seller. Seven jobs: swim in the pond and a big splash into it (the duck), fetch the frisbee three and five times (the girl: she throws it, Lili brings it back, she throws it again), three bones in the woods and the treasure buried there (the keeper), and a run round the whole park: the pond, the woods, back to the van (the ice cream seller). The ducks paddle away from her across the water and never fly off.
2. **The dog park** (next): a fenced corner with jumps, a tunnel and a see-saw, and other dogs to play with.

Not yet: the wooden bridge over the pond, kites, the hill, squirrels to chase up trees.

### What comes next

1. **The dog park**, in the big park (above).
2. **Prizes**: one for every job, things to wear, toys she can play with, a new dog house (agreed 2026-11-18).
3. **The farm**, past the edge of town: sheep to round up, chickens, mud to roll in, hay bales, a tractor to drive.
4. Then the other places in `docs/game-design.md`.

Also open: a cat who asks, a note in a bottle on the beach, a recorded voice.

## Missions: the files and the runner

### A mission is a file

One file per job in `missions/`, listed in `missions/list.txt` (the order they are offered in): markdown with a header the game reads and notes for us below it.

```markdown
---
id: steal-the-teddy
level: 3
picture: [teddy, home]          # the sticker, and the card unless a step has its own
say: "Get the teddy and bring it home!"
steps:
  - take: teddy
    from: child
    say: "Get the teddy!"
    picture: [lili, teddy]
  - bring: teddy
    to: home
    say: "Bring the teddy home!"
    picture: [teddy, home]
---
A boy outside the school holds a teddy. ...
```

- **level** (1 to 4) decides when it opens. **needs** (a list of ids) can also hold a job back until others are done; none uses it now.
- **picture** names icons drawn in `src/art.js` (`ICONS`). **say** is spoken and shown as the caption; **praise** replaces the usual "Good girl, Lili!".
- **steps** are done in order; each is one action from the vocabulary with its target, which is a tag (`child`, `table`, `school-door`, `pot`), not a place on the map: the nearest is used. A step may have `count`, its own `say` and `picture`, and `from`, `to`, `at`.
- **careful: scare** makes that event empty the job's progress.

### The action vocabulary

| Action | Done when |
|---|---|
| `go: <spot>` | she is at a spot with that tag, on foot |
| `drive: <spot>` | the car is there with her in it |
| `poo: <spot>` | she poos there (she squats when she stands still on it) |
| `take: <thing>` `from: child / adult` | she has pulled it away from somebody |
| `pick: <thing>` | she picks up a thing lying about |
| `bring: <thing>` `to: <spot>` | she drops what she carries there (she does when she stands still) |
| `greet: any / child / adult` | somebody loves her |
| `scare: any / child / adult` | somebody is frightened |
| `chase: birds` | a flock flies up |
| `smash: pot / plate` | it breaks |
| `knock: cone / bin / box / apple / lamp` | it is knocked over |
| `hop: bench / table / stall / car` | she lands on it |
| `zoom`, `jump`, `bark`, `honk` | she gallops, jumps, barks, sounds the horn |
| `swim`, `splash`, `shake` | she is in the water, jumps into it, shakes dry after it |
| `collect: bone` | she gets a bone (found or dug up) |
| `dig: mound` | she digs up a heap of earth |

Every action is code written once. Counted steps count different things: the same pot, person or bone counts once.

### How it runs

The game reports what happens as plain events (`zoom`, `knock` with what and where, `greet` with who); the runner (`src/missions.js`) checks the step in hand against them, and checks the steps about where she is itself. Nothing in Lili's or people's code knows about jobs. Stickers, the job in hand and the counters are kept in the browser (local storage), so the book is still full tomorrow; `?fresh` starts over.

## Building it, in steps

Each step is playable and shown to the owner before the next.

1. **Tile format.** Today's park and ring road rebuilt as tiles on a small map. Done.
2. **Bigger town and loading.** A town several times larger from `map.txt`, only nearby tiles built. Done.
3. **Missions.** The file format, the runner, the first actions, three missions. Done.
4. **For the child.** One job at a time, said and pictured, levels, the sticker book, saving, 26 jobs, bones and digging. Done 2026-11-17 (*Jobs for five to seven year olds*).
4b. **Exploring first.** Jobs asked for by people she meets, prizes, a cat and a duck, a note in a bottle. Begun 2026-11-18 (*Jobs come from people she meets*).
5. **The dog park**, with its jobs.
6. **The farm**, with its jobs.

## Open questions for the owner

- The voice: the jobs are said by clips made with a speech model, in English (docs/tech.md, "The voice"; the browser's own voice was horrible). Which language do the children speak? And a recorded family voice would still suit a game about your dog best: a recording can take the place of any clip in `sounds/voice/`.
- Rewards beyond stickers: things for Lili to wear for finishing a level?

## References

- Rewards and motivation: [MDPI review](https://www.mdpi.com/2227-7102/13/7/668), [MIT gamification chapter](https://lcl.media.mit.edu/resources/readings/chapter3-gamification.pdf), [Harvard GSE, why children play](https://www.gse.harvard.edu/ideas/usable-knowledge/23/09/why-do-children-play)
- No scores or levels, open-ended play: [Toca Boca](https://tocaboca.com/?p=16287), [Toca Boca on open-ended play](https://tocaboca.com/magazine/open-ended-play/), [Kidscreen interview](https://kidscreen.com/?p=49360), [Toca Blocks](https://gamesbeat.com/toca-blocks-brings-world-building-to-a-new-younger-audience/)
- A to-do list of mischief in an open area: [a guide to one such game](https://nintendolife.com/news/2020/05/guide_untitled_goose_game_walkthrough_-_puzzle_solutions_and_to-do_list_objectives)
- Open-world games for this age, and what reviewers found repetitive: [Paw Patrol World (GameSpew)](https://www.gamespew.com/2023/10/paw-patrol-world-review/), [Paw Patrol World (TheXboxHub)](https://www.thexboxhub.com/paw-patrol-world-review/), [Bluey: The Videogame](https://www.thexboxhub.com/bluey-the-videogame-review/)
- Tile towns by Wave Function Collapse: [Marian42](https://marian42.github.io/article/wfc/)
- Interfaces for children who are starting to read: [Google, building for kids](https://developers.google.com/building-for-kids/designing-engaging-apps), [Apple, designing for kids](https://developer.apple.com/news/?id=3t6o5jec), [Nielsen Norman Group, children's physical development](https://www.nngroup.com/articles/children-ux-physical-development/), [Aten Design](https://atendesigngroup.com/articles/designing-young-audiences), [UXmatters](https://www.uxmatters.com/mt/archives/2010/05/designing-user-experiences-for-children.php)
