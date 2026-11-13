# Lili Runs Wild

A 3D browser game: a small open town, and the player is a very active liver and white spaniel (Lili). Like GTA in shape (roam, cause chaos, take a car), but nobody gets hurt: he jumps up at people, knocks things over, chases birds and drives. Built on the architecture of [wheek](https://github.com/gustavoamigo/wheek).

Status: **movement prototype**. No missions, no title screen, no saved progress yet.

## How we work

Small iterations with the owner as tester.

1. **Talk first for anything new** (missions, new mechanics, a change of direction): options with a recommendation, the few questions that change the design, then wait. Small fixes and tuning from feedback go straight to code.
2. **Build one playable slice** per iteration.
3. **Check it by script before handing over** (see Testing) and say what was and was not checked. Scripts cannot judge feel, sound or frame rate on a real device.
4. **Hand over the local address and a short numbered test focus**, then wait for feedback.
5. **Write it down** in `docs/iterations.md`; keep the other docs in step with the code in the same change.
6. **Keep a memory of how things were done.** Anything made by a process rather than written by hand (a simulated movement, a searched result, a generated file, a sound cut from a recording, a shape matched to a reference clip) gets its method written in `docs/tech.md` in the same change, so it can be redone or extended later without this conversation: the tool and command, what was asked of it and why, what went wrong on the way and what was changed because of it, where the result is saved, and how it gets into the game. Write it while the work is in progress, marked as such, not only once it is finished. Tools and saved results live in the repo (`tools/`), not in a scratch directory; whatever is needed to set them up again is written down too.

## Design rules

- **Not violent.** Nobody is hurt and nothing is lost. People wobble, sit down or hop clear; a crash is stars and a shake. Mess is the score, not damage.
- **He is a dog.** Everything he does should read as dog: he cannot stop quickly at a gallop, he points at birds, he greets with his paws.
- **The camera never turns** and the player never controls it. Up on the screen always means "away".
- **One finger, a mouse, keys or a pad** must all be enough to play.

## Code

- Three.js r170, vendored in `vendor/`. Plain ES modules, **no build step, no asset files**: models are assembled in code, the ground is painted into a texture, sound is synthesised. The exceptions are sounds: the bark, `sounds/bark.wav` (owner asked for a soundfont sample), and `sounds/lili-growl-*.wav`, Lili's play growl when she pulls on something, chosen by the owner (2026-11-13). It is not a bark. Raw recordings waiting to be chosen go in `sounds/lili/`, which is ignored, never committed: they contain people talking.
- Game logic lives on a flat map (`x` east, `y` south) plus height `z`; `src/scene.js` turns it into 3D. A 2D overlay canvas carries the HUD and bubbles.
- File map, tuning constants, URL parameters and keys are in `docs/tech.md`.

```
python3 tools/serve.py 8765     # http://localhost:8765/
```

## Testing

- Drive the game with headless Chromium (Python Playwright). Keep the scripts in a scratch directory, not in the repo.
- Use `?style=toon` in tests. Start anywhere with `?at=x,y`, or in the car with `?car`. Read state from `window.__G`, act through `window.__G.api`.
- Game time runs slower than real time in the headless browser, and a screenshot stalls it. Wait on `__G.t` or a state value, never on fixed sleeps, and read state before taking a picture.
- When a test sets the dog's speed by hand, hold the direction key first: with no steering he brakes at once.

## Docs

| File | Holds |
|---|---|
| `docs/game-design.md` | The dog, the town, what he can do, controls |
| `docs/tech.md` | Files, constants, test helpers, and how generated things were made (the simulated skeleton, captured moves) |
| `docs/iterations.md` | Iteration log, test focus, feedback, decisions |
