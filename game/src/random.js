// Seeded random numbers for Neon Bay: deterministic scenes from one seed.
// mulberry32 is small, fast and good enough for a city layout and traffic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A tiny helper bundle around one seeded stream.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // pick one element of an array
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
  };
}

// A deterministic hash of a string, so a shot name can seed its own stream.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
