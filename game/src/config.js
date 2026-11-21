// Neon Bay — world constants, palettes, vehicle and weapon definitions.
//
// One clear job: every number the rest of the game tunes against lives here,
// so balancing the city, the cars, the guns and the missions means editing
// this file, not hunting through the code.

export const WORLD = {
  size: 640, // the playable square, metres across, centred on (0, 0)
  block: 64, // city block pitch
  roadWidth: 14,
  sidewalkWidth: 4,
  buildingCount: 96,
  trafficCount: 22,
  pedestrianCount: 38,
  dayLengthSec: 300, // one full day/night cycle, in seconds of play
  startHour: 17.4, // golden hour — the sun hangs low over the bay
};

export const PALETTE = {
  skyDayTop: 0x3f8fd2,
  skyDayBottom: 0xbfd9ee,
  skySunsetTop: 0x4a2560,
  skySunsetBottom: 0xff8a3c,
  skyNightTop: 0x050516,
  skyNightBottom: 0x141038,
  fogDay: 0xbfd0e0,
  fogNight: 0x0a0a20,
  asphalt: 0x23232e,
  sidewalk: 0x3a3a48,
  sand: 0xd9b380,
  water: 0x0a4a6e,
  neonPink: 0xff2e63,
  neonCyan: 0x00c2ff,
  neonGold: 0xffd23e,
  neonGreen: 0x2eff8f,
  neonPurple: 0xb44dff,
};

export const VEHICLE_TYPES = {
  comet: { name: 'Comet GT', topSpeed: 62, accel: 26, grip: 2.6, color: 0xff2e63, price: 0 },
  sedan: { name: 'Vulcar Sedan', topSpeed: 44, accel: 18, grip: 2.2, color: 0x2e6bff, price: 0 },
  taxi: { name: 'Bay Taxi', topSpeed: 46, accel: 19, grip: 2.3, color: 0xffd23e, price: 0 },
  truck: { name: 'Hauler Truck', topSpeed: 36, accel: 13, grip: 1.8, color: 0x8a8f9e, price: 0 },
  coupe: { name: 'Stiletto Coupe', topSpeed: 56, accel: 23, grip: 2.5, color: 0x00c2ff, price: 0 },
  police: { name: 'NBPD Interceptor', topSpeed: 58, accel: 25, grip: 2.7, color: 0x11131a, price: 0 },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 2.2, mag: Infinity, reserve: Infinity, spread: 0, auto: false, sound: 'punch' },
  pistol: { name: 'Pistol', damage: 26, rate: 0.28, range: 55, mag: 12, reserve: 96, spread: 0.012, auto: false, sound: 'shot' },
  smg: { name: 'SMG', damage: 15, rate: 0.085, range: 48, mag: 30, reserve: 180, spread: 0.045, auto: true, sound: 'shot' },
  shotgun: { name: 'Shotgun', damage: 14, rate: 0.85, range: 26, mag: 6, reserve: 36, spread: 0.09, pellets: 7, auto: false, sound: 'boom' },
};

export const WANTED = {
  // stars -> { policeCars, heli, heat (wanted gained per crime), decaySec }
  0: { policeCars: 0, heli: false, decaySec: 0 },
  1: { policeCars: 1, heli: false, decaySec: 25 },
  2: { policeCars: 2, heli: false, decaySec: 35 },
  3: { policeCars: 3, heli: true, decaySec: 55 },
  4: { policeCars: 4, heli: true, decaySec: 80 },
  5: { policeCars: 5, heli: true, decaySec: 120 },
};

export const MISSIONS = [
  {
    id: 'm1', name: 'First Pickup', payout: 500, timeLimit: 150,
    brief: 'Meet Rosa at the marina. Pick up the package and bring it to the Coral Bank drop-off.',
    steps: [
      { type: 'goto', label: 'Drive to Rosa at the marina', x: -210, z: 250 },
      { type: 'wait', label: 'Wait for Rosa to load the package', seconds: 4, x: -210, z: 250 },
      { type: 'goto', label: 'Deliver the package to Coral Bank', x: 96, z: -32 },
    ],
  },
  {
    id: 'm2', name: 'Sunset Run', payout: 900, timeLimit: 120,
    brief: 'A buyer is waiting across town. Timed delivery — the package is hot and the clock is ticking.',
    steps: [
      { type: 'goto', label: 'Collect the briefcase at the docks', x: -250, z: -210 },
      { type: 'goto', label: 'Deliver to the Skyline Hotel before time runs out', x: 190, z: 190 },
    ],
  },
  {
    id: 'm3', name: 'Grand Theft', payout: 1400, timeLimit: 180,
    brief: 'The crew needs a Comet GT. Steal one off the boulevard and lose the cops on the way to the lockup.',
    steps: [
      { type: 'steal', label: 'Steal a Comet GT (press E near one)', vehicle: 'comet' },
      { type: 'goto', label: 'Lose the cops, then reach the lockup', x: 250, z: -250, needWanted: 0 },
    ],
  },
  {
    id: 'm4', name: 'Hold the Line', payout: 2000, timeLimit: 210,
    brief: 'Rival crew is hitting our turf at the plaza. Defend the spot — take down 6 rivals.',
    steps: [
      { type: 'goto', label: 'Get to the plaza', x: 32, z: 96 },
      { type: 'kill', label: 'Take down the rivals', count: 6, x: 32, z: 96 },
    ],
  },
  {
    id: 'm5', name: 'Midnight Chase', payout: 3500, timeLimit: 180,
    brief: 'NBPD is onto the crew. Outrun the interceptors and the helicopter to the safehouse — do not get busted.',
    steps: [
      { type: 'goto', label: 'Reach the safehouse across the city', x: -250, z: 250, wanted: 3 },
    ],
  },
  {
    id: 'm6', name: 'King of the Bay', payout: 10000, timeLimit: 300,
    brief: 'The finale. Hit the Coral Bank vault, grab the $10,000, and escape the whole city to the marina yacht.',
    steps: [
      { type: 'goto', label: 'Reach the Coral Bank vault', x: 96, z: -32 },
      { type: 'wait', label: 'Crack the vault', seconds: 8, x: 96, z: -32 },
      { type: 'goto', label: 'Escape to the marina yacht — the whole city is after you', x: -210, z: 250, wanted: 5 },
    ],
  },
];

export const TAXI_FARE = { base: 60, perMetre: 0.35, tipChance: 0.4 };
export const CRATE_COUNT = 10;
export const CRATE_REWARD = 250;
