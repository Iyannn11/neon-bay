// Neon Bay — shared tuning constants and content tables.
// Every number here is picked for a mid-range laptop: the world is big enough to
// feel like a city, small enough that one draw call per building stays cheap.

export const WORLD = {
  size: 640,          // playable square, metres (x and z in [-320, 320])
  block: 64,          // city block pitch
  roadWidth: 12,
  beachX: 268,        // sand starts here (east edge), water beyond x = 300
  waterX: 300,
  dayLength: 240,     // seconds for a full day/night cycle
  gravity: 22,
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 8.6,
  sprintSpeed: 11.5,
  accel: 34,
  decel: 42,
  turnRate: 9.5,      // rad/s the body turns toward the move direction
  jumpSpeed: 8.4,
  radius: 0.55,
};

export const WEAPONS = {
  pistol:  { name: 'Pistol',  damage: 34, rate: 0.28, spread: 0.030, mag: 12, range: 70,  auto: false, color: 0x2b2f36 },
  smg:     { name: 'SMG',     damage: 16, rate: 0.085, spread: 0.055, mag: 32, range: 60,  auto: true,  color: 0xc8ccd4 },
  shotgun: { name: 'Shotgun', damage: 14, rate: 0.85, spread: 0.16,  mag: 6,  range: 26,  auto: false, pellets: 7, color: 0x6b4a2f },
};

export const OUTFITS = [
  { id: 'street', name: 'Street Black', jacket: 0x1c1e24, pants: 0x23262e, shoes: 0x111214, shirt: 0xd8d8d8 },
  { id: 'vice',   name: 'Vice Pink',    jacket: 0xff2e88, pants: 0x1d2436, shoes: 0xffffff, shirt: 0xffe9f3 },
  { id: 'ocean',  name: 'Ocean Teal',   jacket: 0x0e8f8a, pants: 0x2a2f3a, shoes: 0xf2f2f2, shirt: 0xe6fffa },
  { id: 'gold',   name: 'Gold Rush',    jacket: 0xd9a520, pants: 0x1a1a1a, shoes: 0x3a2a10, shirt: 0xfff6d8 },
];
export const OUTFIT_PRICE = 50;

export const SHOP = {
  health: { name: 'Health +40',  price: 30, key: '1' },
  armor:  { name: 'Armor +50',   price: 40, key: '2' },
  ammo:   { name: 'Ammo +60',    price: 25, key: '3' },
};
export const REPAIR_PRICE = 100;

export const TALK_NPCS = [
  { name: 'Mara',   lines: ['Psst… the neon crates pay well. Ten of them, all over the bay.', 'Cops sweep the marina at night. Keep your head down.', 'You look new. The taxi stand by the plaza is honest money.'] },
  { name: 'Dante',  lines: ['I saw a gold crate behind the AMMU-NATION. Don’t tell anyone.', 'Street races start at the checkered arch. Win one, get paid.', 'The King of the Bay runs this town. You’ll meet him soon enough.'] },
  { name: 'Luna',   lines: ['Golden hour here is unreal. Stand on the beach and just look.', 'My brother stunts off the pier ramps. Five jumps, big air, big cash.', 'Rain makes the roads slick — and the neon twice as pretty.'] },
  { name: 'Rico',   lines: ['Need a ride? I know every shortcut in Neon Bay.', 'The bike by the plaza is fast. Faster than anything with four wheels.', 'Word is the cops set roadblocks when you hit three stars.'] },
  { name: 'Sofia',  lines: ['THREADS has the good jackets. Fifty bucks and you look like a king.', 'I heard the helicopter only comes out at four stars. Scary stuff.', 'The photo spots pay fifty a snap. Bring your best angle.'] },
  { name: 'Kenji',  lines: ['Drift the highway ring at night. No traffic, all lights.', 'A shotgun up close ends arguments. AMMU-NATION sells them.', 'The marina crates glow pink. Follow the glow.'] },
  { name: 'Priya',  lines: ['I drive taxi nights. Tips are good if you’re polite.', 'The wanted stars fade if you lay low for a while.', 'King of the Bay? Finish the five jobs first. Then we’ll talk.'] },
  { name: 'Omar',   lines: ['Pay N Spray fixes anything for a hundred. Worth every cent.', 'Jump the ramps near the beach. Land clean and they pay you.', 'This city never sleeps. Neither do the cops.'] },
];

export const MISSIONS = [
  { id: 'm1', title: 'First Wheels', brief: 'Steal any car and drive it to the yellow marker.', reward: 150 },
  { id: 'm2', title: 'Taxi Driver', brief: 'Pick up the passenger at the plaza and drop them at the beach.', reward: 220 },
  { id: 'm3', title: 'Neon Run', brief: 'Win the street race: hit all 3 checkpoints before the timer ends.', reward: 400 },
  { id: 'm4', title: 'Crate Hunter', brief: 'Collect 3 neon crates hidden around the bay.', reward: 350 },
  { id: 'm5', title: 'Heat', brief: 'You are wanted, 3 stars! Lose the cops and stay clean for 20 seconds.', reward: 500 },
  { id: 'm6', title: 'King of the Bay', brief: 'Finale: reach the marina, take out the 4 guards and claim the crown crate. $10,000.', reward: 10000 },
];

export const STUNT_JUMPS = 5;
export const RACES = 3;
export const PHOTO_SPOTS = 3;
export const CRATE_COUNT = 10;
export const CRATE_VALUE = 100;

export const DAY_START = 0.32; // fraction of the day cycle at load (late afternoon)
