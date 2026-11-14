// A playground: a sandpit with a ball in it, a bench, and two children playing.
export default {
  park: true,
  ground: [{ sand: [190, 200, 110] }],
  benches: [[200, 355]],
  props: [['ball', 160, 180]],
  people: [
    { look: 7, nature: 'lover', at: [250, 250], heading: Math.PI },
    { look: 8, nature: 'meh', walk: [[60, 60], [340, 60]] },
  ],
  spots: [['sandpit', 190, 200], ['playground', 200, 200]],
};
