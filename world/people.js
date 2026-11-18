// Who is in town, and the car. They are placed on the map, not on its tiles, so a tile can be used any number of times
// and people go wherever they are wanted.
//
// at: [col, row, x, y]: the map square (counting from 0, top left, as in world/map.txt) and the place within it (0 to
// 400 across, 0 to 400 down). walk: two such places; they walk to and fro between them, and may cross several squares.
// facing: north, south, east or west. look: how they look (LOOKS in src/models.js: 0 to 2, 5 and 9 adults, the rest
// children). holds: a prop in their arms (a teddy, a string of sausages). nature: how they take to dogs: lover, meh or nervous (children like dogs more whatever theirs).
// id: someone who asks for jobs (a job's `from:` in missions/), and voice: how they say them (tools/voice.py: a voice of
// the speech model, or kid:<voice>:<how much higher> for a child).
export default {
  car: { at: [4, 2, 200, 248], facing: 'east' },
  people: [
    { look: 9, nature: 'lover', at: [12, 1, 330, 340], facing: 'north' },           // a mum waiting at the school door
    { look: 1, nature: 'lover', at: [4, 1, 35, 350], facing: 'west', id: 'neighbour', voice: 'af_heart' },   // Lili's neighbour, in front of her house next door (the first to ask: seen from the start)
    { look: 6, nature: 'lover', at: [7, 4, 290, 100], facing: 'south', id: 'cheeky', voice: 'kid:af_sky:1.25' },   // in the park by the flower pots: a cheeky boy full of naughty ideas
    { look: 3, nature: 'lover', at: [8, 4, 80, 330], facing: 'north', id: 'plaza-girl', voice: 'kid:af_sky:1.25' },   // two children at the plaza
    { look: 4, nature: 'meh', walk: [[8, 4, 30, 370], [8, 4, 370, 370]] },
    { look: 0, nature: 'meh', walk: [[8, 4, 20, 200], [10, 4, 380, 200]] },         // walking the park path
    { look: 7, nature: 'lover', at: [12, 4, 250, 250], facing: 'west', id: 'playground-girl', voice: 'kid:af_sky:1.25' },   // two children in the playground
    { look: 8, nature: 'meh', walk: [[12, 4, 60, 60], [12, 4, 340, 60]] },
    { look: 5, nature: 'nervous', walk: [[7, 5, 20, 80], [7, 5, 380, 80]] },        // past the picnic table
    { look: 2, nature: 'nervous', at: [12, 6, 140, 345], facing: 'north' },         // watching the road works
    { look: 10, nature: 'meh', at: [12, 1, 250, 345], facing: 'south', holds: 'teddy', id: 'teddy-boy', voice: 'kid:af_sky:1.25' },   // a boy with his teddy outside the school
    { look: 2, nature: 'meh', at: [7, 7, 150, 325], facing: 'south', holds: 'sausage', id: 'butcher', voice: 'bm_george' },   // the butcher, out front with a string of sausages
    { look: 4, nature: 'lover', at: [8, 8, 200, 335], facing: 'south', id: 'fountain-boy', voice: 'kid:af_sky:1.25' },   // a child by the fountain
    { look: 5, nature: 'meh', walk: [[7, 8, 60, 345], [9, 8, 340, 345]] },          // across the town square
    { look: 0, nature: 'lover', at: [9, 7, 150, 350], facing: 'south', id: 'cafe', voice: 'am_michael' },   // outside his café
    { look: 9, nature: 'meh', at: [9, 9, 290, 135], facing: 'south', id: 'apples', voice: 'af_sarah' },   // selling apples at the market
    { look: 8, nature: 'lover', at: [4, 7, 150, 70], facing: 'south', id: 'beach-boy', voice: 'kid:af_sky:1.25' },   // a child on the beach
    { look: 1, nature: 'meh', walk: [[3, 7, 60, 30], [5, 7, 340, 30]] },            // along the lake's north shore
    { look: 3, nature: 'lover', at: [3, 4, 200, 180], facing: 'south', id: 'lawn-girl', voice: 'kid:af_sky:1.25' },   // a child on the lawn between the houses
    // the park, east of town
    { look: 7, nature: 'lover', at: [19, 7, 200, 210], facing: 'south', holds: 'frisbee', id: 'frisbee-girl', voice: 'kid:af_sky:1.25' },   // in the meadow with her frisbee
    { look: 0, nature: 'lover', at: [19, 7, 330, 250], facing: 'west' },            // her dad
    { look: 9, nature: 'lover', at: [21, 6, 300, 175], facing: 'south', id: 'icecream', voice: 'af_kore' },   // selling ice cream from her van
    { look: 2, nature: 'meh', at: [17, 9, 120, 210], facing: 'east', id: 'keeper', voice: 'am_adam' },   // the park keeper, by the path in the woods
    { look: 5, nature: 'meh', walk: [[16, 6, 60, 260], [20, 6, 340, 260]] },        // walking the main path
    { look: 4, nature: 'lover', walk: [[18, 4, 60, 200], [22, 4, 340, 200]] },      // running about the meadow
    { look: 8, nature: 'lover', at: [20, 4, 120, 60], facing: 'north' },            // watching the ducks
  ],
  // animals who ask for jobs: kind (a model in src/models.js), id and voice as for people
  animals: [
    { kind: 'duck', id: 'duck', voice: 'kid:af_sky:1.5', at: [21, 3, 0, 378], facing: 'south' },   // on the pond's south bank
  ],
};
