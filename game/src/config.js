// Neon Bay — world constants, palette, tuning and the six-mission chain.
// Everything the other modules need to agree on lives here, in one place.

export const WORLD = {
  // City half-size: streets run from -200 to +200 on both axes.
  half: 200,
  // Streets are centred on multiples of this spacing; towers sit in block centres.
  streetSpacing: 40,
  // Road surface width; sidewalks add 3 on each side.
  streetWidth: 10,
  sidewalk: 3,
  // The marina / beach strip at the south edge (positive z).
  beachZ: 176,
  // Seeded world: the same seed always builds the same city.
  seed: 1337,
};

export const COLOURS = {
  asphalt: 0x23252e,
  asphaltLine: 0xd8d8c8,
  sidewalk: 0x3a3d47,
  grass: 0x2e5d3a,
  sand: 0xc9b083,
  water: 0x0e4d6e,
  glassDay: 0x9fc4d8,
  glassNight: 0x1c2f45,
  concrete: 0x8a8f9a,
  neonCyan: 0x00e5ff,
  neonMagenta: 0xff2ea6,
  neonYellow: 0xffd23f,
  neonGreen: 0x39ff88,
  neonOrange: 0xff7a1a,
  policeWhite: 0xf2f2f2,
  policeBlack: 0x14161c,
  taxiYellow: 0xffc21c,
  playerYellow: 0xffc21c,
};

// Named places, all on the street grid (multiples of 40) or in open ground.
export const PLACES = {
  hideout: { x: -120, z: 120, name: 'Hideout' },
  safehouse: { x: -120, z: -120, name: 'Safehouse' },
  garage: { x: 120, z: -120, name: 'Garage' },
  bank: { x: 40, z: 40, name: 'Coral Bank' },
  docks: { x: 0, z: 180, name: 'Docks' },
  casino: { x: 80, z: 40, name: 'Casino' },
  marina: { x: 120, z: 160, name: 'Marina' },
  plaza: { x: 0, z: 0, name: 'Plaza' },
  park: { x: -80, z: -40, name: 'Park' },
  lighthouse: { x: -180, z: 180, name: 'Lighthouse' },
};

export const TUNING = {
  walkSpeed: 6,
  runSpeed: 9,
  carAccel: 14,
  carBrake: 30,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carTurn: 1.9,
  carDrag: 0.6,
  handbrakeTurn: 3.2,
  trafficCount: 20,
  pedestrianCount: 35,
  trafficSpeed: 9,
  pedestrianSpeed: 1.6,
  policeTopSpeed: 36,
  heliHeight: 55,
  wantedDecay: 0.05,
  wantedMax: 5,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 12,
  playerHealth: 100,
  cameraDistance: 13,
  cameraHeight: 6,
  shotFov: 50,
};

// The six-job chain. A step is one objective; the player finishes a mission's
// steps in order and is paid its reward. Types: goto, pickup, deliverCar,
// follow, escape, hold.
export const MISSIONS = [
  {
    id: 'first-light',
    name: 'First Light',
    reward: 500,
    intro: 'Marlowe has a package at the docks. Pick it up, bring it home.',
    steps: [
      { kind: 'goto', place: 'docks', radius: 8, text: 'Drive to the docks' },
      { kind: 'pickup', place: 'docks', radius: 5, text: 'Pick up the package (E)' },
      { kind: 'goto', place: 'hideout', radius: 8, text: 'Deliver it to the hideout' },
    ],
  },
  {
    id: 'comet-gt',
    name: 'The Comet GT',
    reward: 1200,
    intro: 'A Comet GT is parked outside the casino. Take it. Do not wreck it.',
    steps: [
      { kind: 'goto', place: 'casino', radius: 10, text: 'Go to the casino' },
      { kind: 'steal', place: 'casino', radius: 7, text: 'Steal the Comet GT (E)' },
      { kind: 'deliverCar', place: 'garage', radius: 9, text: 'Bring it to the garage in one piece' },
    ],
  },
  {
    id: 'tail-courier',
    name: 'Tail the Courier',
    reward: 2000,
    intro: 'A courier is moving product through downtown. Follow him. Do not be seen.',
    steps: [
      { kind: 'goto', place: 'plaza', radius: 10, text: 'Find the courier downtown' },
      { kind: 'follow', place: 'plaza', radius: 26, text: 'Tail the courier — stay close, not too close' },
      { kind: 'goto', place: 'hideout', radius: 8, text: 'Report back to the hideout' },
    ],
  },
  {
    id: 'heat-escape',
    name: 'Heat Escape',
    reward: 3500,
    intro: 'Three stars and the whole city is after you. Lose them. Reach the safehouse.',
    steps: [
      { kind: 'escape', place: 'safehouse', radius: 10, text: 'Lose the police, then reach the safehouse' },
    ],
  },
  {
    id: 'coral-bank',
    name: 'The Coral Bank Job',
    reward: 6000,
    intro: 'The Coral Bank vault. Hold E for eight seconds and the money is yours.',
    steps: [
      { kind: 'goto', place: 'bank', radius: 9, text: 'Get to the Coral Bank' },
      { kind: 'hold', place: 'bank', radius: 7, hold: 8, text: 'Crack the vault — hold E for 8s' },
      { kind: 'goto', place: 'hideout', radius: 8, text: 'Escape with the cash' },
    ],
  },
  {
    id: 'king-of-the-bay',
    name: 'King of the Bay',
    reward: 10000,
    intro: 'The finale. Four stars, one bag of cash, and the whole bay watching.',
    steps: [
      { kind: 'goto', place: 'bank', radius: 9, text: 'Grab the cash at the bank' },
      { kind: 'escape', place: 'hideout', radius: 10, text: 'Lose the four-star heat' },
      { kind: 'hold', place: 'hideout', radius: 7, hold: 6, text: 'Stash the cash — hold E for 6s' },
    ],
  },
];

// Where the player and the first cars start.
export const SPAWNS = {
  player: { x: -40, z: 80, heading: Math.PI / 2 },
  cometGt: { x: 80, z: 52, heading: -Math.PI / 2 },
  courier: { x: 0, z: 0, heading: 0 },
};
