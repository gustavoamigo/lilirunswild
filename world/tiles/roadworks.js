// A straight road with a row of cones in its north lane.
export default {
  ground: [{ road: [0, 200, 400, 200] }],
  props: [0, 1, 2, 3, 4, 5].map((i) => ['cone', 50 + i * 60, 128 + (i % 2) * 34]),
};
