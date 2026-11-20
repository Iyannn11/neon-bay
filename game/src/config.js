// config.js — every constant Neon Bay tunes by, in one place.
// The world is a square city on a street grid. Streets run along X and Z at a
// fixed spacing; blocks sit between them. All distances are in metres.

export const WORLD = {
  // City footprint: streets at -160, -120, -80, -40, 0, 40, 80, 120, 160.
  halfSize: 190,
  streetSpacing: 40,
  streetWidth: 12,
  blockSize: 28,
  // The highway ring that circles the city.
  ringRadius: 205,
  // Sea to the south (negative Z is the coast), beach and boardwalk there.
  coastZ: -190,
  beachDepth: 26,
};

export const PALETTE = {
  skyDay: 0x8ec9ee,
  skyNight: 0x0b1026,
  fogDay: 0xa8c8e8,
  fogNight: 0x0d1428,
  asphalt: 0x2a2d34,
  asphaltLine: 0xd8d8c8,
  sidewalk: 0x6a6f78,
  sand: 0xd9c08a,
  grass: 0x3f7a3a,
  sea: 0x1a5f8a,
  boardwalk: 0x8a6a44,
  // Neon sign colours, bright and saturated.
  neonPink: 0xff2e88,
  neonCyan: 0x00e5ff,
  neonGold: 0xffc233,
  neonGreen: 0x39ff88,
  neonPurple: 0xb44dff,
  neonRed: 0xff3b30,
  // Glass towers: deep blue glass with a warm lit-window glow.
  glass: 0x1d3a5f,
  glassEdge: 0x3d6a9a,
  windowWarm: 0xffd27a,
  windowCool: 0x9fd8ff,
};

export const CAR = {
  accel: 26,
  brake: 42,
  maxSpeed: 46,
  maxReverse: 12,
  steer: 0.55,
  grip: 0.92,
  handbrakeGrip: 0.45,
  // Traffic cars cruise slower and keep to their lane.
  trafficSpeed: 9,
  trafficCount: 20,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  health: 100,
  punchDamage: 12,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 60,
};

export const POLICE = {
  maxWanted: 5,
  // How many patrol cars chase at each wanted level.
  chaseCars: [0, 1, 2, 3, 4, 5],
  chaseSpeed: 40,
  heliAtWanted: 4,
  // Wanted decays when the player is out of sight of every cop.
  decayDelay: 6,
  decayRate: 0.35,
  bustDistance: 2.4,
};

export const PEDS = {
  count: 35,
  walkSpeed: 1.6,
  scatterRadius: 14,
};

// The six-mission chain. Each mission is a list of steps; a step is one of:
//   goto      — reach the marker (radius given)
//   pickup    — press E at the marker to pick something up
//   deliverCar— drive the named car to the marker without wrecking it
//   follow    — stay inside the tail zone behind the target, never too close
//   escape    — lose the wanted level, then reach the marker
//   hold      — hold E at the marker for `seconds`
// A step's `at` is a world position [x, z]. Rewards pay on completion.
export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Light',
    reward: 500,
    briefing: 'Kai, the package is waiting at the docks. Bring it to the hideout. Keep it quiet.',
    steps: [
      { type: 'goto', at: [-150, -165], radius: 6, label: 'Drive to the docks' },
      { type: 'pickup', at: [-150, -165], radius: 4, label: 'Pick up the package (E)' },
      { type: 'goto', at: [120, 120], radius: 6, label: 'Deliver it to the hideout' },
    ],
  },
  {
    id: 'm2',
    name: 'The Comet GT',
    reward: 1200,
    briefing: 'A Comet GT is parked outside the casino. Take it. Bring it to the garage in one piece.',
    steps: [
      { type: 'goto', at: [80, -40], radius: 6, label: 'Find the Comet GT' },
      { type: 'deliverCar', at: [-120, 80], radius: 7, label: 'Steal the Comet GT (E) and drive it to the garage' },
    ],
  },
  {
    id: 'm3',
    name: 'Tail the Courier',
    reward: 2000,
    briefing: 'A courier is moving product through downtown. Follow him. Do not let him see you.',
    steps: [
      { type: 'follow', at: [0, 0], radius: 26, label: 'Tail the courier — stay in the zone, not too close' },
    ],
  },
  {
    id: 'm4',
    name: 'Heat Escape',
    reward: 3500,
    briefing: 'Three stars and the whole precinct on your tail. Lose them and get to the safehouse.',
    steps: [
      { type: 'escape', at: [-120, 120], radius: 8, label: 'Lose the cops, then reach the safehouse' },
    ],
  },
  {
    id: 'm5',
    name: 'The Coral Bank Job',
    reward: 6000,
    briefing: 'The Coral Bank vault. Hold the drill steady, grab the cash, and get out before the sirens close in.',
    steps: [
      { type: 'goto', at: [40, 40], radius: 6, label: 'Get to the Coral Bank' },
      { type: 'hold', at: [40, 40], radius: 5, seconds: 8, label: 'Crack the vault — hold E for 8 seconds' },
      { type: 'goto', at: [-120, 120], radius: 8, label: 'Escape with the cash' },
    ],
  },
  {
    id: 'm6',
    name: 'King of the Bay',
    reward: 10000,
    briefing: 'The finale. Four stars, one bag of cash, one hideout. Bring it home and Neon Bay is yours.',
    steps: [
      { type: 'goto', at: [0, -120], radius: 6, label: 'Grab the cash at the marina' },
      { type: 'escape', at: [120, 120], radius: 8, label: 'Escape the 4-star heat to the hideout' },
      { type: 'hold', at: [120, 120], radius: 5, seconds: 6, label: 'Stash the cash — hold E for 6 seconds' },
    ],
  },
];

// Where the player, the key cars and the mission markers start.
export const SPAWNS = {
  player: [0, 40],
  cometGT: [80, -40],
  courier: [-80, 80],
  bank: [40, 40],
  hideout: [120, 120],
  safehouse: [-120, 120],
  marina: [0, -120],
  docks: [-150, -165],
};
