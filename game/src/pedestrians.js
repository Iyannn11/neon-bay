// pedestrians.js — the people of Neon Bay. Each pedestrian is a small
// figure with a cylinder torso and cylinder limbs (never boxes): a head, a
// torso, arms and legs that swing as they walk. They stroll the sidewalks,
// scatter when a car bears down on them, and can be knocked down.

import * as THREE from 'three';
import { PEDS } from './config.js';

function makePedestrianMesh(rng) {
  const group = new THREE.Group();
  const skinTones = [0xd9a986, 0xb98a5e, 0x8a5a34, 0xe8c39a];
  const shirts = [0xc23b2e, 0x2e6ac2, 0xd8a928, 0x3a9a4a, 0x8a5ac2, 0xd8d8d8, 0x2ab2a0, 0xff7a3c];
  const skin = new THREE.MeshStandardMaterial({ color: skinTones[Math.floor(rng.next() * skinTones.length)], roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirts[Math.floor(rng.next() * shirts.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: [0x2a2d34, 0x3a3f4a, 0x4a3a2a][Math.floor(rng.next() * 3)], roughness: 0.9 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.62;
  group.add(head);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.58, 8), shirt);
  armL.position.set(-0.28, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.58, 8), shirt);
  armR.position.set(0.28, 1.15, 0);
  group.add(armR);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.72, 8), pants);
  legL.position.set(-0.11, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.72, 8), pants);
  legR.position.set(0.11, 0.36, 0);
  group.add(legR);
  group.userData = { armL, armR, legL, legR, head };
  return group;
}

export class PedestrianSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
    this._spawn();
  }

  _sidewalkPoint() {
    // A point on a sidewalk: near a street line, offset to the kerb.
    const street = Math.floor(this.rng.next() * 9) * 40 - 160;
    const along = this.rng.range(-170, 170);
    const kerb = this.rng.next() < 0.5 ? -8.5 : 8.5;
    if (this.rng.next() < 0.5) return { x: along, z: street + kerb };
    return { x: street + kerb, z: along };
  }

  _spawn() {
    for (let i = 0; i < PEDS.count; i++) {
      const p = this._sidewalkPoint();
      const mesh = makePedestrianMesh(this.rng);
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);
      this.peds.push({
        mesh,
        x: p.x,
        z: p.z,
        heading: this.rng.next() * Math.PI * 2,
        speed: PEDS.walkSpeed * this.rng.range(0.7, 1.3),
        down: false,
        downTimer: 0,
        panic: 0,
        walkPhase: this.rng.next() * Math.PI * 2,
      });
    }
  }

  // A car hit this pedestrian: knock them down for a few seconds.
  knockDown(ped) {
    if (ped.down) return;
    ped.down = true;
    ped.downTimer = 4;
    ped.mesh.rotation.x = Math.PI / 2;
    ped.mesh.position.y = 0.35;
  }

  update(dt, carPos, carSpeed) {
    for (const ped of this.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      // Scatter when a fast car is close.
      if (carPos && carSpeed > 6) {
        const d = Math.hypot(ped.x - carPos.x, ped.z - carPos.z);
        if (d < PEDS.scatterRadius) {
          ped.panic = 1.5;
          const away = Math.atan2(ped.x - carPos.x, ped.z - carPos.z);
          ped.heading = away;
        }
      }
      if (ped.panic > 0) ped.panic -= dt;
      const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      // Wander: occasionally turn, and stay inside the city.
      if (this.rng.next() < dt * 0.25) ped.heading += this.rng.range(-1.2, 1.2);
      if (Math.abs(ped.x) > 178 || Math.abs(ped.z) > 178) ped.heading += Math.PI;
      ped.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.mesh.userData.armL.rotation.x = swing;
      ped.mesh.userData.armR.rotation.x = -swing;
      ped.mesh.userData.legL.rotation.x = -swing;
      ped.mesh.userData.legR.rotation.x = swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  // The nearest pedestrian within `radius` of a point, if any.
  nearest(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const ped of this.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) { best = ped; bestD = d; }
    }
    return best;
  }
}
