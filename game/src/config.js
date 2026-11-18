// Neon Bay — shared tuning constants and world layout.
// One source of truth for sizes, speeds, colours and mission rewards so
// every system (city, cars, police, missions, HUD) agrees with the others.

export const WORLD = {
  // City blocks live inside [-210, 210] on x and z. The beach and ocean
  // sit on the south edge (z > 210).
  halfSize: 210,
  block: 60,
  roadWidth: 14,
  // Road centre lines, one every 60 units.
  roads: [-180, -120, -60, 0, 60, 120, 180],
  groundSize: 620,
  beachStart: 212,
  oceanStart: 262,
};

export const COLOURS = {
  skyDay: 0x87bfe8,
  skyNight: 0x0b1026,
  sunDay: 0xfff2d0,
  sunNight: 0x8fa3ff,
  asphalt: 0x2b2e36,
  sidewalk: 0x9aa0a8,
  sand: 0xe8d29a,
  ocean: 0x1d6f9e,
  grass: 0x5d8a4a,
  buildingPalette: [0xcf8f6a, 0x7fa8c9, 0xc9b458, 0x8a7fb8, 0x6fb08a, 0xd98a8a, 0x9fb4c7, 0xe0a458],
  neonPalette: [0xff2e88, 0x00e5ff, 0xffd400, 0x7cff00, 0xff6a00, 0xb967ff],
  carPalette: [0xd23b2e, 0x2e6fd2, 0xf2c230, 0xeeeeee, 0x222222, 0x2fae6e, 0x7a4fd0, 0xff7a1a],
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.7,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.4,
  punchCooldown: 0.45,
  pistolDamage: 55,
  pistolRange: 42,
  pistolMagazine: 12,
  reloadSeconds: 1.8,
};

export const CAR = {
  accel: 16,
  brake: 30,
  maxSpeed: 40,
  reverseMax: 12,
  steerMax: 0.55,
  trafficSpeed: 11,
  policeSpeed: 44,
  radius: 1.6,
};

export const WANTED = {
  // Heat 0..100; stars = floor(heat / 20), capped at 5.
  stealCar: 22,
  hitPedestrian: 25,
  shoot: 14,
  hitPolice: 30,
  decayPerSecond: 3.5,
  decayDelayAfterCrime: 6,
};

export const MISSIONS = [
  {
    id: 1,
    title: 'First Pickup',
    reward: 300,
    briefing: 'Mara needs a package from the marina crate. Grab it and bring it back to the hideout.',
  },
  {
    id: 2,
    title: 'Hot Wheels',
    reward: 500,
    briefing: 'A yellow Comet GT is parked downtown. Steal it and deliver it to the garage — no scratches, no cops.',
  },
  {
    id: 3,
    title: 'Tail the Courier',
    reward: 700,
    briefing: 'Follow the courier van across town. Stay 15 to 40 metres back — if he spots you, the deal is off.',
  },
  {
    id: 4,
    title: 'Heat Escape',
    reward: 900,
    briefing: 'The setup went loud. Three stars and the whole Bay PD on your tail. Lose them, then get to the hideout.',
  },
  {
    id: 5,
    title: 'The Bay Heist',
    reward: 5000,
    briefing: 'The vault under Coral Bank. Crack it, grab the cash, and escape to the yacht while the city burns.',
  },
];

export const SAVE_KEY = 'neonbay-save-v1';

export const SHOT_SEED = 1337;
