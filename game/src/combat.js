// Neon Bay — hand-to-hand and pistol combat, plus police return fire.
// Hitscan pistol: a shot hits the nearest ped or cop inside a narrow cone
// in front of the camera. Police shoot back when the wanted level is 2+.

import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createCombat() {
  return {
    punchCooldown: 0,
    reloadTimer: 0,
    ammo: PLAYER.pistolMagazine,
    hasPistol: false,
    muzzleTimer: 0,
  };
}

// A punch in front of the player. Returns the ped/cop hit, if any.
export function tryPunch(combat, player, peds, police, audio) {
  if (combat.punchCooldown > 0) return null;
  combat.punchCooldown = PLAYER.punchCooldown;
  if (audio) audio.punch();
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const targets = [];
  for (const ped of peds) {
    if (!ped.down) targets.push({ kind: 'ped', obj: ped, pos: ped.mesh.position });
  }
  for (const car of police.cars) {
    targets.push({ kind: 'copcar', obj: car, pos: car.mesh.position });
  }
  let best = null;
  let bestDist = PLAYER.punchRange;
  for (const target of targets) {
    const dx = target.pos.x - player.pos.x;
    const dz = target.pos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > bestDist) continue;
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dot < 0.3) continue;
    bestDist = dist;
    best = target;
  }
  return best;
}

// Fire the pistol toward the camera forward direction. Returns a hit record
// { kind, obj, distance } or null. Ammo and reload are handled here.
export function tryShoot(combat, player, cameraDir, peds, police, audio) {
  if (combat.reloadTimer > 0) return { fired: false, reason: 'reloading' };
  if (combat.ammo <= 0) {
    combat.reloadTimer = PLAYER.reloadSeconds;
    combat.ammo = PLAYER.pistolMagazine;
    return { fired: false, reason: 'reloading' };
  }
  combat.ammo -= 1;
  combat.muzzleTimer = 0.08;
  if (audio) audio.gunshot();
  if (combat.ammo === 0) {
    combat.reloadTimer = PLAYER.reloadSeconds;
    combat.ammo = PLAYER.pistolMagazine;
  }
  const origin = player.pos;
  const dir = cameraDir;
  const targets = [];
  for (const ped of peds) {
    if (!ped.down) targets.push({ kind: 'ped', obj: ped, pos: ped.mesh.position, radius: 0.9 });
  }
  for (const car of police.cars) {
    targets.push({ kind: 'copcar', obj: car, pos: car.mesh.position, radius: 2.2 });
  }
  let best = null;
  let bestDist = PLAYER.pistolRange;
  for (const target of targets) {
    const dx = target.pos.x - origin.x;
    const dz = target.pos.z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 1 || along > bestDist) continue;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    const allowed = 0.6 + along * 0.07;
    if (perp > allowed) continue;
    bestDist = along;
    best = { kind: target.kind, obj: target.obj, distance: along };
  }
  return { fired: true, hit: best };
}

// Police return fire: each nearby police car has a small chance per second
// to land a hit on the player. Returns damage dealt this frame.
export function policeReturnFire(police, player, dt, rng) {
  if (police.wanted.stars < 2 || player.driving) return 0;
  let damage = 0;
  for (const car of police.cars) {
    const dist = Math.hypot(
      car.mesh.position.x - player.pos.x,
      car.mesh.position.z - player.pos.z,
    );
    if (dist > 26) continue;
    const hitChance = dt * (0.55 - Math.min(0.4, dist / 60));
    if (rng() < hitChance) damage += 5;
  }
  return damage;
}

export function updateCombatTimers(combat, dt) {
  combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);
  combat.reloadTimer = Math.max(0, combat.reloadTimer - dt);
  combat.muzzleTimer = Math.max(0, combat.muzzleTimer - dt);
}
