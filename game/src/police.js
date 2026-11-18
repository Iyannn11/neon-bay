// Neon Bay — wanted level and police.
// Crimes add heat (0..100, stars = heat / 20). Police cars spawn at the city
// edge, chase the player, ram the player's car and try to bust them; on foot
// a cop runs the player down. Heat decays once the player is out of sight
// and quiet for a while.

import * as THREE from 'three';
import { WANTED, CAR, WORLD } from './config.js';
import { createCarMesh, makeCarState, collideWithBuildings } from './vehicles.js';

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    lastCrimeAt: -100,
    bustTimer: 0,
    busted: false,
  };
}

export function addHeat(wanted, amount, time) {
  wanted.heat = Math.min(100, wanted.heat + amount);
  wanted.stars = Math.min(5, Math.floor(wanted.heat / 20));
  wanted.lastCrimeAt = time;
}

export function updateWanted(wanted, dt, time, nearestPoliceDistance) {
  if (wanted.heat <= 0) {
    wanted.stars = 0;
    return;
  }
  const quietFor = time - wanted.lastCrimeAt;
  const hidden = nearestPoliceDistance > 60;
  if (quietFor > WANTED.decayDelayAfterCrime && hidden) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayPerSecond * dt);
    wanted.stars = Math.min(5, Math.floor(wanted.heat / 20));
  }
}

function spawnPoliceCar(scene, playerPos, rng) {
  const mesh = createCarMesh(0x111111, true);
  // Spawn at a road near the city edge, on the player's side of town.
  const edge = Math.random() < 0.5 ? -1 : 1;
  const road = WORLD.roads[Math.floor(Math.random() * WORLD.roads.length)];
  mesh.position.set(
    Math.max(-200, Math.min(200, playerPos.x + edge * 90)),
    0,
    road,
  );
  if (Math.abs(mesh.position.x - playerPos.x) < 30) mesh.position.x += edge * 60;
  scene.add(mesh);
  const car = makeCarState(mesh, 'police', 0x111111);
  car.speed = 10;
  car.targetSpeed = CAR.policeSpeed;
  return car;
}

export function createPolice(scene) {
  return {
    scene,
    cars: [],
    wanted: createWanted(),
    sirenPhase: 0,
  };
}

// Keep the number of pursuit cars matched to the wanted stars.
export function syncPoliceCars(police, playerPos) {
  const wantedCount = police.wanted.stars === 0 ? 0
    : police.wanted.stars <= 2 ? 1
    : police.wanted.stars <= 4 ? 2 : 3;
  while (police.cars.length < wantedCount) {
    police.cars.push(spawnPoliceCar(police.scene, playerPos));
  }
  while (police.cars.length > wantedCount) {
    const car = police.cars.pop();
    police.scene.remove(car.mesh);
  }
}

function steerToward(car, targetX, targetZ, dt, maxTurn) {
  const dx = targetX - car.mesh.position.x;
  const dz = targetZ - car.mesh.position.z;
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff * 2.5));
  car.heading += turn;
}

// Returns 'busted' when the player is caught, otherwise null.
export function updatePolice(police, dt, time, player, colliders) {
  const wanted = police.wanted;
  syncPoliceCars(police, player.pos);
  let nearest = Infinity;
  for (const car of police.cars) {
    const pos = car.mesh.position;
    const dx = player.pos.x - pos.x;
    const dz = player.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    nearest = Math.min(nearest, dist);
    // Chase: steer at the player, drive fast, ram on contact.
    car.speed += (CAR.policeSpeed - car.speed) * Math.min(1, dt * 0.8);
    steerToward(car, player.pos.x, player.pos.z, dt, 2.4);
    pos.x += Math.sin(car.heading) * car.speed * dt;
    pos.z += Math.cos(car.heading) * car.speed * dt;
    if (collideWithBuildings(pos, CAR.radius, colliders)) {
      car.speed *= 0.5;
      car.heading += 0.6;
    }
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.mesh.userData.wheels) {
      wheel.rotation.x += (car.speed * dt) / 0.42;
    }
    // Flashing light bar.
    car.flashPhase += dt * 6;
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      const redOn = Math.sin(car.flashPhase) > 0;
      bar.redMat.emissiveIntensity = redOn ? 2.5 : 0.2;
      bar.blueMat.emissiveIntensity = redOn ? 0.2 : 2.5;
    }
    // Ram the player's car.
    if (player.driving && dist < 3.6) {
      player.carSpeed *= 0.75;
      player.shake = Math.min(1, player.shake + 0.5);
      if (Math.abs(player.carSpeed) < 2) {
        wanted.bustTimer += dt;
        if (wanted.bustTimer > 2.5) return 'busted';
      } else {
        wanted.bustTimer = Math.max(0, wanted.bustTimer - dt);
      }
    }
    // On foot: a police car that gets close enough busts the player.
    if (!player.driving && dist < 2.2) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer > 1.2) return 'busted';
    }
  }
  if (police.cars.length === 0) wanted.bustTimer = 0;
  updateWanted(wanted, dt, time, nearest);
  return null;
}

export function nearestPoliceDistance(police, pos) {
  let nearest = Infinity;
  for (const car of police.cars) {
    nearest = Math.min(nearest, Math.hypot(
      car.mesh.position.x - pos.x,
      car.mesh.position.z - pos.z,
    ));
  }
  return nearest;
}

export function clearWanted(police) {
  police.wanted.heat = 0;
  police.wanted.stars = 0;
  police.wanted.bustTimer = 0;
  syncPoliceCars(police, new THREE.Vector3(0, 0, 0));
}
