// A straight road with a row of cones in its north lane, and a nervous man watching from the south pavement.
export default {
  ground: [{ road: [0, 200, 400, 200] }],
  props: [0, 1, 2, 3, 4, 5].map((i) => ['cone', 50 + i * 60, 128 + (i % 2) * 34]),
  people: [{ look: 2, nature: 'nervous', at: [140, 345], heading: -Math.PI / 2 }],
};
