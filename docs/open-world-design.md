# Open world and missions: design

Status: approved; steps 1 (tiles), 2 (bigger town, only nearby tiles built) and 3 (missions) done 2026-11-15, see *The town: tiles on a map* and *Missions* in `docs/tech.md`. Choices made in step 3: a poo happens on its own when she stands still where an open mission wants one; she drops what she carries on her own where a mission wants it (or when she barks); grabbing a toy from someone works with or without a mission.

## What the game becomes

An open-world game for children of 6 and 7, played as Lili: one big town with no levels or loading screens, where you go anywhere you like, at any time. You roam it, borrow the car, cause harmless mischief and make friends. Missions give ideas of what to do, never a path you must follow. Playing without any mission is always fun on its own, as it is today.

Two things make it scale:

1. **The town is built from reusable tiles** placed on a grid, so a large town does not need every corner designed.
2. **Missions are files**, written in a small vocabulary of actions the game knows, so a new mission usually needs no code.

## Who it is for

Children of 6 and 7, most of whom read little or not at all.

- **Nothing to read.** Missions are spoken in a warm recorded voice and shown as a picture, in a thought bubble like the bird she sees now. Footprints or an arrow can show the way. Guidance for pre-readers: audio and pictures, few and large buttons, literal icons.
- **No points, no timers, no losing.** Scores and leaderboards push children of this age towards competing, and rewards lift performance for a while but not the wish to play. Toca Boca, very popular at this age, has no score, timer or levels.
- **Rewards you can see and play with.** A picture to-do list that gets stamped like a sticker book; new things for Lili (a collar, a hat, a ball); new parts of town opening.
- **One finger is enough** (already a rule in `CLAUDE.md`).

The model: an open area to play in freely, with a to-do list of bits of mischief that can be done in almost any order; finishing enough of them opens the next area.

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

## Missions

### A mission is a file

One file per mission in `missions/`, markdown with a header the game reads and notes for us below it.

```markdown
---
id: steal-toy
needs: [meet-the-kids]      # shown only once these are done
picture: teddy              # what the child sees in the bubble and on the to-do list
say: "Can you get the teddy?"
steps:
  - take: toy
    from: child
  - bring: toy
    to: home
reward: red-collar
---
The child holds on and they pull (her play growl), then the child gets scared, screams and runs.
```

- **needs** makes the missions a graph, not a line: several are open at once, and finishing one can open others.
- **steps** are done in order; each is one action from the vocabulary with its targets, which are tags (`child`, `table`, `school-door`), not places on the map. So a mission works in any part of town that has what it needs, and the nearest is used.
- **reward** names something from the rewards list (below), or nothing.

### The action vocabulary

What a step can ask. Each is code, written once; every mission can then use it.

| Action | Done when |
|---|---|
| `go: <spot>` | she is at a spot with that tag (or drives there) |
| `take: <thing> from: <who or spot>` | she picks it up (from a person: a tug, then they let go) |
| `bring: <thing> to: <spot>` | she drops what she carries there |
| `poo: <spot>` | she poos on or next to it |
| `bark: <who or spot>` | she barks near it |
| `play: <thing> with: <who>` | she brings the ball and they throw it for her |
| `greet: <who>` | someone loves her (crouches and pets her) |
| `scare: <who>` | someone runs off frightened |
| `drive: <spot>` | the car arrives there with her in it |

The first missions use these. A mission that needs something new (dig, swim, fetch the post) means adding one action.

### Rewards

A list in `missions/rewards.md`: things for Lili to wear (collars, hats, a bandana), things to play with (a ball, a frisbee), and places that open (the beach). Getting one is shown big and spoken. The to-do list keeps what has been won.

### How it runs

The game reports what happens as plain events: she arrived at a spot, picked up a thing, pooed, someone loved her, the car arrived. The mission runner checks the current step of each open mission against them. Nothing in Lili's or people's code knows about missions. Progress is saved in the browser (local storage), so the to-do list is still stamped tomorrow.

### What the child sees

- A picture to-do list, opened with one large button: a card per open mission, stamped when done. Pressing a card says it again.
- When a mission opens, the bubble shows its picture and the voice says it once.
- A paw-print trail can lead to the nearest place of the current step, on if the child seems lost (a while with no progress), not always.
- Nothing ever fails or runs out of time.

## Building it, in steps

Each step is playable and shown to the owner before the next.

1. **Tile format.** Today's park and ring road rebuilt as tiles on a small map: the same town, now made of pieces, painted per tile.
2. **Bigger town and loading.** A town several times larger from `map.txt`, with Lili's home and the school, only nearby tiles built.
3. **Missions.** The file format, the runner, the first actions, and three missions: poo on the picnic table, drive to school, take the teddy from a child.
4. **For the child.** The picture to-do list, the voice, the trail, saving progress, the first rewards.

## Open questions for the owner

- The voice: whose? (A recorded family voice would suit a game about your dog.)
- The first missions after the three above.
- How far the town should grow before it is "big enough" for this age; a dense town is better than a large empty one.

## References

- Rewards and motivation: [MDPI review](https://www.mdpi.com/2227-7102/13/7/668), [MIT gamification chapter](https://lcl.media.mit.edu/resources/readings/chapter3-gamification.pdf), [Harvard GSE, why children play](https://www.gse.harvard.edu/ideas/usable-knowledge/23/09/why-do-children-play)
- No scores or levels: [Toca Boca](https://tocaboca.com/?p=16287), [Kidscreen interview](https://kidscreen.com/?p=49360)
- A to-do list of mischief in an open area: [a guide to one such game](https://nintendolife.com/news/2020/05/guide_untitled_goose_game_walkthrough_-_puzzle_solutions_and_to-do_list_objectives)
- Tile towns by Wave Function Collapse: [Marian42](https://marian42.github.io/article/wfc/)
- Interfaces for pre-readers: [Aten Design](https://atendesigngroup.com/articles/designing-young-audiences), [UXmatters](https://www.uxmatters.com/mt/archives/2010/05/designing-user-experiences-for-children.php)
