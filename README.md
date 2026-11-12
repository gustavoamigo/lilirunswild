# Zoomies (working title)

A browser game about a very active cocker spaniel loose in a small town. He gallops, jumps on things and people, breaks pots, chases birds and drives a car. Nobody gets hurt.

This is the movement prototype: the dog, how he moves and how you move him. No missions yet.

```
python3 tools/serve.py 8765     # then open http://localhost:8765/
```

| | Keys | Touch / mouse | Pad |
|---|---|---|---|
| Run | arrows / WASD | tap or hold where he should go | stick / D-pad |
| Jump | Space | green button | A |
| Bark (horn in the car) | B, Q or X | pink button | X |
| In / out of the car | E, F or Enter | yellow button (shows near the car) | Y |

Keep running and he gets the zoomies. See `docs/game-design.md` for what he does and `docs/tech.md` for the code.

Three.js (vendored), plain ES modules, no build step, no asset files.
