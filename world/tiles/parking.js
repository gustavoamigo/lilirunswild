// A straight road with a parking bay in its south lane, where the car waits, and a dog lover on the pavement.
export default {
  ground: [{ road: [0, 200, 400, 200] }, { bay: [20, 156, 360, 150] }],
  car: [200, 248, 0],
  people: [{ look: 1, nature: 'lover', at: [330, 350], heading: Math.PI / 2 }],
  spots: [['car', 200, 248]],
};
