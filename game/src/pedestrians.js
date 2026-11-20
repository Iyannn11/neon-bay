// Neon Bay pedestrians: 35 walkers on the sidewalks, scattering when a car
// bears down on them, and knockdowns when one is hit.

import * as THREE from '../vendor/three.module.min.js';
import { TUNING } from './config.js';

// A person from cylinders (torso, limbs, head) — smooth, never a box.
function makePersonMesh(color, skinTone) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.85, 10), cloth);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.75, 8);
  const legL = new THREE.Mesh(legGeo, skin);
  legL.position.set(0.13, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, skin);
  legR.position.set(-0.13, 0.38, 0);
  group.add(legR);
  const armGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.65, 8);
  const armL = new THREE.Mesh(armGeo, cloth);
  armL.position.set(0.34, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, cloth);
  armR.position.set(-0.34, 1.05, 0);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function createPedestrians(scene, rng, city) {
  const streets = city.streets;
  const shirts = [0xc0392b, 0x2471a3, 0x229954, 0x7d3c98, 0xca6f1e, 0x2c3e50, 0xbfc9ca, 0xf1c40f];
  const skins = [0xe8b88a, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d];
  const walkers = [];

  for (let i = 0; i < TUNING.pedestrianCount; i++) {
    const mesh = makePersonMesh(shirts[rng.int(0, shirts.length - 1)], skins[rng.int(0, skins.length - 1)]);
    const street = streets[rng.int(0, streets.length - 1)];
    const along = rng.range(-190, 190);
    const horizontal = rng.next() < 0.5;
    // Sidewalk: just off the road edge.
    const side = rng.next() < 0.5 ? 1 : -1;
    const off = (10 / 2 + 1.6) * side;
    const w = {
      mesh,
      x: horizontal ? along : street + off,
      z: horizontal ? street + off : along,
      heading: horizontal ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: rng.range(1.1, 2.1),
      horizontal,
      side,
      down: false,
      downTimer: 0,
      walkPhase: rng.next() * 6,
      flee: 0,
    };
    mesh.group.position.set(w.x, 0, w.z);
    mesh.group.rotation.y = -w.heading;
    scene.add(mesh.group);
    walkers.push(w);
  }

  function update(dt, game) {
    const p = game.player;
    for (const w of walkers) {
      if (w.down) {
        w.downTimer -= dt;
        w.mesh.group.rotation.x = -Math.PI / 2 + 0.3;
        w.mesh.group.position.y = 0.3;
        if (w.downTimer <= 0) {
          w.down = false;
          w.mesh.group.rotation.x = 0;
          w.mesh.group.position.y = 0;
        }
        continue;
      }
      // Scatter: a fast car (or the player) nearby makes them flee.
      const dp = Math.hypot(w.x - p.pos.x, w.z - p.pos.z);
      let fleeX = 0;
      let fleeZ = 0;
      if (dp < 7 && (p.inCar ? Math.abs(p.carSpeed || 0) > 4 : true)) {
        w.flee = 1.6;
        fleeX = (w.x - p.pos.x) / (dp || 1);
        fleeZ = (w.z - p.pos.z) / (dp || 1);
      }
      if (w.flee > 0) w.flee -= dt;
      const speed = w.speed * (w.flee > 0 ? 2.6 : 1);
      const step = speed * dt;
      if (w.flee > 0) {
        w.x += fleeX * step;
        w.z += fleeZ * step;
        w.heading = Math.atan2(fleeZ, fleeX);
      } else {
        if (w.horizontal) w.x += Math.cos(w.heading) * step;
        else w.z += Math.sin(w.heading) * step;
        // At an intersection, sometimes turn onto the crossing street.
        const pos = w.horizontal ? w.x : w.z;
        const nearest = Math.round(pos / 40) * 40;
        if (Math.abs(pos - nearest) < step && rng.next() < 0.25) {
          w.horizontal = !w.horizontal;
          const turn = rng.next() < 0.5 ? 1 : -1;
          if (w.horizontal) {
            w.z = nearest + (10 / 2 + 1.6) * turn;
            w.heading = turn > 0 ? 0 : Math.PI;
          } else {
            w.x = nearest + (10 / 2 + 1.6) * turn;
            w.heading = turn > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
      }
      // Wrap at the city edge.
      if (w.x > 205) w.x = -205;
      if (w.x < -205) w.x = 205;
      if (w.z > 205) w.z = -205;
      if (w.z < -205) w.z = 205;
      // Knocked down by the player's car.
      if (p.inCar && dp < 2.6 && Math.abs(p.carSpeed || 0) > 3) {
        w.down = true;
        w.downTimer = 4;
        game.addWanted(0.5);
        if (game.audio) game.audio.punch();
      }
      w.walkPhase += dt * speed * 3.2;
      w.mesh.legL.rotation.x = Math.sin(w.walkPhase) * 0.55;
      w.mesh.legR.rotation.x = -Math.sin(w.walkPhase) * 0.55;
      w.mesh.armL.rotation.x = -Math.sin(w.walkPhase) * 0.4;
      w.mesh.armR.rotation.x = Math.sin(w.walkPhase) * 0.4;
      w.mesh.group.position.set(w.x, 0, w.z);
      w.mesh.group.rotation.y = -w.heading;
    }
  }

  return { walkers, update };
}
