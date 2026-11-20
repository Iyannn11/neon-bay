// Neon Bay shots: deterministic staging for the 4 screenshots.
// ?shot=start|chase|mission|night&seed=1337 freezes a composed scene so the
// render is the same every time. The night shot stages Kai DRIVING.
// Cameras sit ON streets and look ALONG them, so towers frame the view
// instead of blocking it; the player is 15–25 units ahead of the lens.

import { PLACES } from './config.js';

// Stage one shot: position the player, cars and police, set day/night, freeze.
export function applyShot(game, shot) {
  const p = game.player;
  const v = game.vehicles;
  const police = game.police;
  game.shotFrozen = true;

  if (shot === 'start') {
    // Day: Kai on foot on street x=0, downtown and the docks ahead.
    game.setNight(false);
    p.inCar = false;
    p.car = null;
    p.pos.x = 0;
    p.pos.z = -40;
    p.heading = Math.PI / 2;
    p.onFootHeading = Math.PI / 2;
    p.health = 100;
    game.wanted = 0;
    game.missions.startMission(0);
    game.cameraShot = { x: 0, y: 5.5, z: -52, lookX: 0, lookY: 3, lookZ: -15, fov: 50 };
    game.hud.hideBanner();
  } else if (shot === 'chase') {
    // Night, 5 stars: Kai driving the Comet GT up street x=0 toward the
    // neon downtown, police convoy and helicopter behind him.
    game.setNight(true);
    const gt = v.cometGt;
    v.enterCar(game, gt);
    p.pos.x = 0;
    p.pos.z = 60;
    p.heading = -Math.PI / 2;
    p.carSpeed = 22;
    p.health = 100;
    game.wanted = 5;
    game.missions.startMission(3);
    police.ensureCars(5);
    const cars = police.cars;
    const spots = [
      { x: -4, z: 78, h: -Math.PI / 2 },
      { x: 5, z: 82, h: -Math.PI / 2 },
      { x: 0, z: 88, h: -Math.PI / 2 },
      { x: -5, z: 70, h: -Math.PI / 2 },
      { x: 6, z: 74, h: -Math.PI / 2 },
    ];
    for (let i = 0; i < spots.length; i++) {
      if (!cars[i]) break;
      cars[i].x = spots[i].x;
      cars[i].z = spots[i].z;
      cars[i].heading = spots[i].h;
      cars[i].speed = 22;
      cars[i].mesh.group.position.set(spots[i].x, 0, spots[i].z);
      cars[i].mesh.group.rotation.y = -spots[i].h;
    }
    // A traffic car ahead for depth.
    const t = v.traffic[0];
    t.x = 2;
    t.z = 8;
    t.heading = -Math.PI / 2;
    t.mesh.group.position.set(2, 0, 8);
    t.mesh.group.rotation.y = Math.PI / 2;
    game.cameraShot = { x: 6, y: 5, z: 78, lookX: -2, lookY: 1.5, lookZ: 55, fov: 50 };
    game.hud.hideBanner();
  } else if (shot === 'mission') {
    // Day: the Coral Bank Job — Kai on foot on street x=40, the bank and
    // its vault beacon ahead, police closing in behind him.
    game.setNight(false);
    p.inCar = false;
    p.car = null;
    p.pos.x = 40;
    p.pos.z = 56;
    p.heading = -Math.PI / 2;
    p.onFootHeading = -Math.PI / 2;
    p.health = 100;
    game.wanted = 2;
    game.missions.startMission(4);
    police.ensureCars(2);
    const cars = police.cars;
    if (cars[0]) {
      cars[0].x = 36;
      cars[0].z = 68;
      cars[0].heading = -Math.PI / 2;
      cars[0].mesh.group.position.set(36, 0, 68);
      cars[0].mesh.group.rotation.y = Math.PI / 2;
    }
    if (cars[1]) {
      cars[1].x = 44;
      cars[1].z = 30;
      cars[1].heading = Math.PI / 2;
      cars[1].mesh.group.position.set(44, 0, 30);
      cars[1].mesh.group.rotation.y = -Math.PI / 2;
    }
    game.cameraShot = { x: 40, y: 6, z: 74, lookX: 40, lookY: 2, lookZ: 36, fov: 50 };
    game.hud.hideBanner();
  } else {
    // Night, driving: Kai in the Comet GT up street x=0 toward the neon
    // downtown, one police car behind him.
    game.setNight(true);
    const gt = v.cometGt;
    v.enterCar(game, gt);
    p.pos.x = 0;
    p.pos.z = 80;
    p.heading = -Math.PI / 2;
    p.carSpeed = 14;
    p.health = 100;
    game.wanted = 1;
    game.missions.startMission(0);
    police.ensureCars(1);
    const cars = police.cars;
    if (cars[0]) {
      cars[0].x = -4;
      cars[0].z = 94;
      cars[0].heading = -Math.PI / 2;
      cars[0].speed = 14;
      cars[0].mesh.group.position.set(-4, 0, 94);
      cars[0].mesh.group.rotation.y = Math.PI / 2;
    }
    game.cameraShot = { x: -2, y: 7, z: 98, lookX: 0, lookY: 2, lookZ: 60, fov: 50 };
    game.hud.hideBanner();
  }
}

// Read the shot from the URL. Returns the shot name or null.
export function readShotParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot === 'start' || shot === 'chase' || shot === 'mission' || shot === 'night') return shot;
    return null;
  } catch (err) {
    return null;
  }
}

export function readSeedParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const seed = parseInt(params.get('seed') || '1337', 10);
    return Number.isFinite(seed) ? seed : 1337;
  } catch (err) {
    return 1337;
  }
}
