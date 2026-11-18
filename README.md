# Lili Runs Wild

A browser game about a very active cocker spaniel loose in a small town. She gallops, jumps on things and people, breaks pots, chases birds and drives a car. Nobody gets hurt.

For children of 5 to 7: a town to run wild in, where people she meets ask her for help, out loud and in pictures (find a bone, take the sausages home, dig up treasure): 23 jobs, one at a time, and a sticker book that fills as they are done. Nothing is timed and nothing fails. Play it at https://gustavoamigo.github.io/lilirunswild/.

```
python3 tools/serve.py 8765     # then open http://localhost:8765/
```

| | Keys | Touch / mouse | Pad |
|---|---|---|---|
| Run | arrows / WASD | tap or hold where she should go | stick / D-pad |
| Jump | Space | green button | A |
| Start | any key | tap anywhere on the title | any button |
| Bark (horn in the car) | B, Q or X | pink WOOF! button | X |
| In / out of the car | E, F or Enter | yellow button (shows near the car) | Y |
| Hear the job again, and be shown the way | | tap the job card | |
| Sticker book | | star button | |

Keep running and she gets the zoomies. `?play` skips the title; `http://localhost:8765/?studio` shows the dog alone, close up, with slow motion and pose buttons. See `docs/game-design.md` for what she does and `docs/tech.md` for the code.

Three.js (vendored), plain ES modules, no build step. The only asset files are sounds (`sounds/`): recordings of Lili's play growl, generated effects, and the spoken lines of the jobs (`sounds/voice/`, made by `tools/voice.py`).
