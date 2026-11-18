// Neon Bay — pedestrians. They stroll the sidewalks between random
// waypoints, and run away from gunfire, speeding cars and the player when
// the heat is on. Getting hit by a car knocks them down and is a crime.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { range } from './random.js';

const SHIRT_COLOURS = [0xe8e8e8, 0x3a7bd5, 0xd53a6e, 0x3ad58a, 0xf2c230, 0x8a5fd0, 0xff7a1a];

export function createPedestrianMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: SHIRT_COLOURS[Math.floor(rng() * SHIRT_COLOURS.length)], roughness: 0.9,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3242, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legL.position.set(-0.14, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legR.position.set(0.14, 0.35, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.torso = torso;
  return group;
}

function randomSidewalkPoint(rng) {
  // Sidewalks run alongside the roads: pick a road and an offset of 9.
  const road = WORLD.roads[Math.floor(rng() * WORLD.roads.length)];
  const along = range(rng, -200, 200);
  if (rng() < 0.5) return new THREE.Vector3(road + 9, 0, along);
  return new THREE.Vector3(along, 0, road + 9);
}

export function spawnPedestrians(scene, rng, count, avoidPos) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPedestrianMesh(rng);
    const pos = randomSidewalkPoint(rng);
    if (avoidPos && Math.hypot(pos.x - avoidPos.x, pos.z - avoidPos.z) < 20) {
      pos.x += 40;
    }
    mesh.position.copy(pos);
    scene.add(mesh);
    peds.push({
      mesh,
      state: 'walk',
      speed: range(rng, 1.2, 2.2),
      heading: range(rng, 0, Math.PI * 2),
      waypoint: randomSidewalkPoint(rng),
      down: false,
      downTimer: 0,
      fleeTimer: 0,
      walkPhase: range(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

export function scarePedestrians(peds, pos, radius) {
  for (const ped of peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.mesh.position.x - pos.x, ped.mesh.position.z - pos.z);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 4;
    }
  }
}

export function updatePedestrians(peds, dt, rng, threatPos, threatActive) {
  for (const ped of peds) {
    const pos = ped.mesh.position;
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    if (threatActive && threatPos) {
      const d = Math.hypot(pos.x - threatPos.x, pos.z - threatPos.z);
      if (d < 14) {
        ped.state = 'flee';
        ped.fleeTimer = 4;
      }
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const awayX = pos.x - (threatPos ? threatPos.x : 0);
      const awayZ = pos.z - (threatPos ? threatPos.z : 0);
      const len = Math.hypot(awayX, awayZ) || 1;
      const targetHeading = Math.atan2(awayX / len, awayZ / len);
      let diff = targetHeading - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += diff * Math.min(1, dt * 6);
      pos.x += Math.sin(ped.heading) * 5.5 * dt;
      pos.z += Math.cos(ped.heading) * 5.5 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      const target = ped.waypoint;
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        ped.waypoint = randomSidewalkPoint(rng);
      } else {
        const targetHeading = Math.atan2(dx / dist, dz / dist);
        let diff = targetHeading - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += diff * Math.min(1, dt * 4);
        pos.x += Math.sin(ped.heading) * ped.speed * dt;
        pos.z += Math.cos(ped.heading) * ped.speed * dt;
      }
    }
    pos.x = Math.max(-WORLD.halfSize - 10, Math.min(WORLD.halfSize + 30, pos.x));
    pos.z = Math.max(-WORLD.halfSize - 10, Math.min(WORLD.halfSize + 40, pos.z));
    ped.mesh.rotation.y = ped.heading;
    ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 7);
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
  }
}

// Knock a pedestrian down (car hit). Returns true when it was a fresh hit.
export function knockDownPedestrian(ped) {
  if (ped.down) return false;
  ped.down = true;
  ped.downTimer = 6;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.35;
  return true;
}
