// Market stalls on the square, apples piled on them.
export default {
  ground: [{ pave: [0, 0, 400, 400] }],
  stalls: [[110, 200], [290, 200]],
  props: [[80, 186], [104, 200], [128, 188], [266, 192], [290, 204], [314, 190]].map(([x, y]) => ['apple', x, y, 58]),
  spots: [['market', 200, 200]],
};
