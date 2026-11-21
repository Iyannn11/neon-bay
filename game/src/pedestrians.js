// Neon Bay — pedestrians.
//
// One clear job: fill the sidewalks with people. Cylinder-based characters
// (rounded bodies, sphere heads, simple limbs) that wander the pavements,
// cross at intersections, and run away when shots are fired.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { range, pick, chance, clamp, angleLerp, dist2D } from './random.js';

const HALF = WORLD.size / 2;

const SHIRTS = [0xff2e63, 0x00c2ff, 0xffd23e, 0x2eff8f, 0xb44dff, 0xffffff, 0xff8a3c, 0x7a5cff];
const PANTS = [0x1d2438, 0x2a2f45, 0x3a3a48, 0x4f2a2a, 0x24384f];

export function buildPersonMesh(rng) {
  const group = new THREE.Group();
  const shirt = pick(rng, SHIRTS);
  const pants = pick(rng, PANTS);
  const skin = pick(rng, [0xe8b88a, 0xc98d5f, 0x8a5a3b, 0xf2c9a0]);
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 0.85, 10),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }),
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
  );
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: pick(rng, [0x111111, 0x3a2a1a, 0x6b6b6b, 0x8a5a2b]), roughness: 0.9 }),
  );
  hair.position.y = 1.76;
  group.add(hair);
  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.72, 8), legMat);
    leg.position.set(side * 0.14, 0.36, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.62, 8), armMat);
    arm.position.set(side * 0.44, 1.1, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export class Pedestrians {
  constructor(scene, world, rng) {
    this.world = world;
    this.rng = rng;
    this.people = [];
    this.fleeing = false;
    for (let i = 0; i < WORLD.pedestrianCount; i += 1) {
      const mesh = buildPersonMesh(rng);
      const p = world.randomRoadPoint(rng);
      // Stand on the sidewalk, beside the road.
      const vertical = Math.abs(p.x % 64) < 1;
      const off = (rng() < 0.5 ? -1 : 1) * 9.5;
      mesh.position.set(vertical ? p.x + off : p.x, 0, vertical ? p.z : p.z + off);
      const heading = rng() * Math.PI * 2;
      mesh.rotation.y = heading;
      scene.add(mesh);
      this.people.push({
        mesh, heading,
        speed: range(rng, 1.1, 2.0),
        target: null,
        walkPhase: rng() * Math.PI * 2,
        scared: 0,
      });
    }
  }

  scare(x, z, radius = 40) {
    for (const p of this.people) {
      if (dist2D(p.mesh.position.x, p.mesh.position.z, x, z) < radius) {
        p.scared = 6;
      }
    }
  }

  _pickTarget(p) {
    const roads = this.world.roads;
    const road = pick(this.rng, roads);
    const along = range(this.rng, -280, 280);
    const vertical = chance(this.rng, 0.5);
    const off = (this.rng() < 0.5 ? -1 : 1) * 9.5;
    p.target = vertical ? { x: road + off, z: along } : { x: along, z: road + off };
  }

  update(dt) {
    for (const p of this.people) {
      if (!p.target || dist2D(p.mesh.position.x, p.mesh.position.z, p.target.x, p.target.z) < 2) {
        this._pickTarget(p);
      }
      if (p.scared > 0) p.scared -= dt;
      const fleeing = p.scared > 0;
      const speed = fleeing ? 5.2 : p.speed;
      const dx = p.target.x - p.mesh.position.x;
      const dz = p.target.z - p.mesh.position.z;
      const desired = Math.atan2(dx, dz);
      p.heading = angleLerp(p.heading, desired, Math.min(1, dt * 4));
      p.mesh.rotation.y = p.heading;
      p.mesh.position.x += Math.sin(p.heading) * speed * dt;
      p.mesh.position.z += Math.cos(p.heading) * speed * dt;
      p.mesh.position.x = clamp(p.mesh.position.x, -HALF + 6, HALF - 6);
      p.mesh.position.z = clamp(p.mesh.position.z, -HALF + 6, HALF - 6);
      // Walk cycle: swing the arms and legs.
      p.walkPhase += dt * speed * 3.4;
      const swing = Math.sin(p.walkPhase) * (fleeing ? 0.7 : 0.45);
      p.mesh.userData.legs[0].rotation.x = swing;
      p.mesh.userData.legs[1].rotation.x = -swing;
      p.mesh.userData.arms[0].rotation.x = -swing * 0.8;
      p.mesh.userData.arms[1].rotation.x = swing * 0.8;
    }
  }
}
