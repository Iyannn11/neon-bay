// Neon Bay — shared constants: city layout, palette, missions, tuning.
// Written fresh for Round 12. All units are metres; y is up; the city centre
// (plaza + fountain) is at the origin, the beach and sea are east (+x).

export const CITY = {
  // drivable city bounds (roads + blocks)
  half: 150,
  // beach sand strip and sea
  beachX0: 168, beachX1: 236, seaX0: 236, seaX1: 320,
  // marina basin (south-east corner)
  marina: { x0: 96, x1: 168, z0: 96, z1: 168 },
  // avenue / street centre lines (roads are 14 wide, sidewalks 3 each side)
  avenues: [-120, -60, 0, 60, 120],
  streets: [-120, -60, 0, 60, 120],
  roadWidth: 14,
  sidewalk: 3,
  // plaza at the centre
  plazaR: 26,
  seed: 1337,
};

export const PALETTE = {
  night: 0x0a0e1e,
  duskTop: 0x2a1a4a, duskMid: 0xb34a6e, duskLow: 0xff8c4a,
  dayTop: 0x3f8fd2, dayLow: 0xbfd9e8,
  asphalt: 0x23262b, asphaltLine: 0xd8d8d8,
  sidewalk: 0x8a8f96, curb: 0xb9bec6,
  sand: 0xd9c08a, sea: 0x0e3a5e, seaDeep: 0x082a44,
  neonPink: 0xff2e88, neonCyan: 0x00e5ff, neonGold: 0xffc233, neonPurple: 0xb14aff,
  kaiJacket: 0x0fa3a3, kaiPants: 0x1c2733, kaiSkin: 0xc98d64, kaiCap: 0xff2e88,
  taxiYellow: 0xffc233, policeWhite: 0xf2f2f2, policeBlack: 0x14181f,
};

export const MISSIONS = [
  { id: 0, name: 'First Fare', brief: 'Drive the taxi to the plaza pickup.', pay: 500, type: 'taxi' },
  { id: 1, name: 'Neon Run', brief: 'Race through 3 gates on the highway ring.', pay: 1200, type: 'race' },
  { id: 2, name: 'Crate Rush', brief: 'Collect 5 neon crates before the cops notice.', pay: 1500, type: 'collect' },
  { id: 3, name: 'Harbor Heat', brief: 'Clear the marina guards and take the boat.', pay: 2500, type: 'combat' },
  { id: 4, name: 'Night Shift', brief: 'Lose a 3-star wanted level, then reach the hideout.', pay: 4000, type: 'escape' },
  { id: 5, name: 'King of the Bay', brief: 'Take the crown at the plaza. No backup. $10,000.', pay: 10000, type: 'finale' },
];

export const SHOPS = {
  ammo: { name: 'AMMU-NATION', items: [
    { key: 'health', label: 'Health', price: 30 },
    { key: 'armor', label: 'Armor', price: 40 },
    { key: 'ammo', label: 'Ammo', price: 25 },
  ]},
  threads: { name: 'THREADS', outfits: [
    { key: 'teal', label: 'Teal Rider', price: 50, jacket: 0x0fa3a3 },
    { key: 'pink', label: 'Vice Pink', price: 50, jacket: 0xff2e88 },
    { key: 'gold', label: 'Gold Hour', price: 50, jacket: 0xffc233 },
    { key: 'violet', label: 'Neon Violet', price: 50, jacket: 0xb14aff },
  ]},
  spray: { name: 'PAY N SPRAY', repair: 100 },
};

export const WEAPONS = [
  { key: 'pistol', name: 'Pistol', damage: 34, rate: 0.28, mag: 12, spread: 0.012, auto: false },
  { key: 'smg', name: 'SMG', damage: 16, rate: 0.085, mag: 32, spread: 0.03, auto: true },
  { key: 'shotgun', name: 'Shotgun', damage: 22, rate: 0.85, mag: 6, spread: 0.075, auto: false, pellets: 6 },
];

export const TUNING = {
  walkSpeed: 5.2, sprintSpeed: 8.6, jumpVel: 7.5, gravity: 20,
  carAccel: 14, carBrake: 30, carMax: 34, carReverse: 10, carTurn: 1.9,
  bikeAccel: 17, bikeMax: 38,
  wantedDecay: 6, policeSpawn: 2.2, heliAt: 3,
  crateCount: 10, trafficCount: 14, pedCount: 26,
  camDist: 9.5, camHeight: 3.4,
};
