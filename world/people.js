// Who is in town, and the car. They are placed on the map, not on its tiles, so a tile can be used any number of times
// and people go wherever they are wanted.
//
// at: [col, row, x, y]: the map square (counting from 0, top left, as in world/map.txt) and the place within it (0 to
// 400 across, 0 to 400 down). walk: two such places; they walk to and fro between them, and may cross several squares.
// facing: north, south, east or west. look: how they look (LOOKS in src/models.js: 0 to 2, 5 and 9 adults, the rest
// children). nature: how they take to dogs: lover, meh or nervous (children like dogs more whatever theirs).
export default {
  car: { at: [4, 2, 200, 248], facing: 'east' },
  people: [
    { look: 9, nature: 'lover', at: [12, 1, 330, 340], facing: 'north' },           // a mum waiting at the school door
    { look: 1, nature: 'lover', at: [4, 2, 330, 350], facing: 'south' },            // by the parked car
    { look: 6, nature: 'nervous', at: [7, 4, 290, 100], facing: 'south' },          // in the park, by the flower pots
    { look: 3, nature: 'lover', at: [8, 4, 80, 330], facing: 'north' },             // two children at the plaza
    { look: 4, nature: 'meh', walk: [[8, 4, 30, 370], [8, 4, 370, 370]] },
    { look: 0, nature: 'meh', walk: [[8, 4, 20, 200], [10, 4, 380, 200]] },         // walking the park path
    { look: 7, nature: 'lover', at: [12, 4, 250, 250], facing: 'west' },            // two children in the playground
    { look: 8, nature: 'meh', walk: [[12, 4, 60, 60], [12, 4, 340, 60]] },
    { look: 5, nature: 'nervous', walk: [[7, 5, 20, 80], [7, 5, 380, 80]] },        // past the picnic table
    { look: 2, nature: 'nervous', at: [12, 6, 140, 345], facing: 'north' },         // watching the road works
  ],
};
