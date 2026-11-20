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

function spawnPoliceCar(scene, playerPos) {
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

// Police helicopter: a simple hovering mesh with a spinning rotor and a
// searchlight cone. It only shows at 4+ stars, so the 5-star chase (and
// the 4-star night finale) get a helicopter in the sky.
function createHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 6), bodyMat);
  group.add(body);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2), glassMat);
  glass.position.set(0, 0.4, 2.2);
  group.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.3, -5);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 1.2), bodyMat);
  fin.position.set(0, 1.2, -7);
  group.add(fin);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  for (const sx of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4.5), skidMat);
    skid.position.set(sx, -1.2, 0.5);
    group.add(skid);
  }
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.6), rotorMat);
  rotor.position.y = 1.4;
  group.add(rotor);
  const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 11), rotorMat);
  rotor2.position.y = 1.4;
  group.add(rotor2);
  // Searchlight cone: apex at the heli, wide base on the ground.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 20, 16, 1, true), beamMat);
  beam.position.y = -10;
  group.add(beam);
  // Red beacon light under the tail.
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), beaconMat);
  beacon.position.set(0, -1.1, -6.5);
  group.add(beacon);
  return { group, rotor, rotor2, beaconMat };
}

export function createPolice(scene) {
  return {
    scene,
    cars: [],
    wanted: createWanted(),
    sirenPhase: 0,
    heli: null,
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
  // Helicopter at 4+ stars: hover ahead of the player, rotor spinning,
  // beacon flashing. Hidden below 4 stars.
  if (wanted.stars >= 4) {
    if (!police.heli) {
      police.heli = createHeliMesh();
      police.scene.add(police.heli.group);
    }
    const heli = police.heli;
    heli.group.visible = true;
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    heli.group.position.set(player.pos.x + fx * 60 + 5, 20, player.pos.z + fz * 60);
    heli.group.rotation.y = player.heading;
    heli.rotor.rotation.y += dt * 18;
    heli.rotor2.rotation.y += dt * 18;
    heli.beaconMat.emissiveIntensity = Math.sin(time * 6) > 0 ? 2.5 : 0.3;
  } else if (police.heli) {
    police.heli.group.visible = false;
  }
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
