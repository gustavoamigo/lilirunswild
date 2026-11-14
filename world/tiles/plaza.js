// The plaza where the park's paths cross, and two children by it: one standing, one wandering. Lili starts here.
export default {
  park: true,
  ground: [{ path: [0, 200, 400, 200] }, { path: [200, 0, 200, 400] }, { plaza: [200, 200, 150] }],
  people: [
    { look: 3, nature: 'lover', at: [80, 330], heading: -Math.PI / 2 },
    { look: 4, nature: 'meh', walk: [[30, 370], [370, 370]] },
  ],
  spots: [['start', 200, 280], ['plaza', 200, 200]],
};
