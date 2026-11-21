// Neon Bay — tuning constants. One place for every number the rest of the
// game reads, so balancing never means hunting through files.
export const CONFIG = {
  // World layout (units are metres; the city core is a grid around origin).
  worldSize: 560,
  blockSize: 64,
  roadWidth: 12,
  beachX: 236, // east edge: sand starts here
  oceanX: 268, // east edge: water starts here
  plaza: { x: 0, z: 0, half: 42 },

  // Player
  walkSpeed: 6,
  sprintSpeed: 10.5,
  jumpSpeed: 8.5,
  gravity: 24,
  playerRadius: 0.55,

  // Vehicles
  carTopSpeed: 38,
  carAccel: 16,
  carBrake: 30,
  bikeTopSpeed: 46,
  bikeAccel: 20,
  taxiFare: 120,

  // Combat
  weapons: {
    pistol: { name: 'Pistol', damage: 34, mag: 12, reloadMs: 900, rateMs: 260, range: 60, spread: 0.012 },
    smg: { name: 'SMG', damage: 18, mag: 32, reloadMs: 1400, rateMs: 85, range: 55, spread: 0.03 },
    shotgun: { name: 'Shotgun', damage: 22, pellets: 6, mag: 6, reloadMs: 1800, rateMs: 700, range: 28, spread: 0.09 },
  },

  // Economy
  prices: { health: 30, armor: 40, ammo: 25, repair: 100, outfit: 50 },
  rewards: { crate: 100, photo: 50, stunt: 60, race: 250, missionFinale: 10000 },

  // Police
  maxWanted: 5,
  wantedDecaySeconds: 14,
  copChaseSpeed: 30,

  // Visual
  fogNear: 130,
  fogFar: 480,
  sunIntensity: 2.6,
  hemiIntensity: 0.85,
  shadowMapSize: 1024,

  // Times of day (0..1 around the clock; used by the sky dome)
  times: {
    morning: { top: 0x6a8fd0, horizon: 0xffb08a, sun: 0xffd9a0, fog: 0xe8b48a, hemi: 0.75, sunI: 2.2, ambient: 0.45 },
    day: { top: 0x2f7fd0, horizon: 0xbfdcff, sun: 0xfff3c4, fog: 0xc7d9ea, hemi: 0.9, sunI: 2.8, ambient: 0.55 },
    golden: { top: 0x3a4a8f, horizon: 0xff9a52, sun: 0xffd27a, fog: 0xe8a06a, hemi: 0.7, sunI: 2.2, ambient: 0.42 },
    night: { top: 0x050914, horizon: 0x1a2340, sun: 0x8fb4ff, fog: 0x0d1526, hemi: 0.32, sunI: 0.5, ambient: 0.2 },
  },
};

// Mission chain data: name, blurb, target position, reward.
export const MISSIONS = [
  { name: 'First Fare', blurb: 'Drive the taxi to the plaza pickup.', target: [0, 0], reward: 150 },
  { name: 'Neon Run', blurb: 'Race through 3 gates on the highway ring.', target: [180, -120], reward: 300 },
  { name: 'Crate Hunter', blurb: 'Collect 3 neon crates around the marina.', target: [150, 150], reward: 400 },
  { name: 'Heat Up', blurb: 'Lose a 2-star wanted level.', target: [-120, 120], reward: 600 },
  { name: 'The Pickup', blurb: 'Meet the contact at the beach bar.', target: [210, 60], reward: 900 },
  { name: 'King of the Bay', blurb: 'Clear the marina guards and take the crown.', target: [150, 150], reward: 10000 },
];

// Named NPC dialogue lines (8 named characters).
export const NPC_LINES = [
  { name: 'Mara', line: 'The marina guards change shift at midnight. Just saying.' },
  { name: 'Dante', line: 'Golden hour on the highway ring — best photos in the city.' },
  { name: 'Luz', line: 'Taxis pay best near the plaza after dark. Trust me.' },
  { name: 'Rico', line: 'AMMU-NATION restocked this morning. SMG ammo is cheap today.' },
  { name: 'Sofia', line: 'Neon crates glow pink at night. Ten of them, all over town.' },
  { name: 'Kenji', line: 'The Vortex R1 corners like it is on rails. The cruiser is comfier.' },
  { name: 'Aya', line: 'Rain makes the roads slick. Brake early or you will meet a wall.' },
  { name: 'Marco', line: 'King of the Bay? Nobody has cleared the marina in years.' },
];

export const OUTFITS = [
  { name: 'Neon Street', jacket: 0x00c2a8, pants: 0x1c2733, cap: 0xff2d78 },
  { name: 'Vice Sunset', jacket: 0xff5a3c, pants: 0x2a1e33, cap: 0xffc233 },
  { name: 'Midnight', jacket: 0x2b3a67, pants: 0x11131a, cap: 0x7dd7ff },
  { name: 'Palm Gold', jacket: 0xd9a441, pants: 0x24382b, cap: 0xffffff },
];
