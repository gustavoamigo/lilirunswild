# Lili Runs Wild

A browser game about a very active cocker spaniel loose in a small town. She gallops, jumps on things and people, breaks pots, chases birds and drives a car. Nobody gets hurt.

For children of 5 to 7: a town, a big park and a beach to run wild in, where people (and a duck) she meets ask her for help, out loud and in pictures (find a bone, take the sausages home, fetch the frisbee): 31 jobs, one at a time, and a sticker book that fills as they are done. Nothing is timed and nothing fails. Play it at https://gustavoamigo.github.io/lilirunswild/.

```
python3 tools/serve.py 8765     # then open http://localhost:8765/
npm ci && npm run build         # dist/: the game packed into a few files, as GitHub Pages serves it
```

| | Keys | Touch / mouse | Pad |
|---|---|---|---|
| Run | arrows / WASD | tap or hold where she should go | stick / D-pad |
| Jump | Space | green button | A |
| Start | any key | tap anywhere on the title | any button |
| Bark (horn in the car) | B, Q or X | pink button (a dog barking) | X |
| Pull in a tug of war | any key, again and again | tap again and again | any button |
| Put down what she carries | G or C | purple button (shows while she carries something) | B |
| In / out of the car | E, F or Enter | yellow button (shows near the car) | Y |
| Hear the job again, and be shown the way | | tap the job card | |
| Sticker book | | star button | |

Keep running and she gets the zoomies. `?play` skips the title; `http://localhost:8765/?studio` shows the dog alone, close up, with slow motion and pose buttons. See `docs/game-design.md` for what she does and `docs/tech.md` for the code.

Three.js (vendored), plain ES modules that run as they are; the published site is packed into one file by esbuild (`tools/build.mjs`, on every push). The only asset files are the icon (drawn in code, `tools/make_icons.py`) and sounds (`sounds/`): recordings of Lili's play growl, generated effects, and the spoken lines of the jobs (`sounds/voice/`, made by `tools/voice.py`).
