// A park path with a row of flower pots along it, and a boy who is nervous of dogs.
export default {
  park: true,
  ground: [{ path: [0, 200, 400, 200] }],
  props: [0, 1, 2, 3, 4, 5].map((i) => ['pot', 40 + i * 64, 270]),
  flowers: 6,
  people: [{ look: 6, nature: 'nervous', at: [290, 100], heading: Math.PI / 2 }],
};
