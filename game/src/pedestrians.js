// Neon Bay — pedestrians. A crowd of walkers with their own walk cycles who
// flee when shots ring out, plus eight named talkable NPCs: walk up, press E,
// and they answer with one of their lines — sometimes with a cash tip or a
// mission hint in return.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, TALK_NPCS } from './config.js';
import { mulberry32, range, int, pick, clamp, angleLerp } from './random.js';

const SHIRTS = [0xff5a5a, 0x5a8aff, 0x39d98a, 0xffc400, 0xb537f2, 0xf2f2f2, 0x2a2c33, 0xff8a3c];
const PANTS = [0x2a2c33, 0x3a4a6b, 0x5a3a2a, 0x222222, 0x4a4a4a];
const SKINS = [0xf2c9a0, 0xd9a06b, 0x8a5a3b, 0xc98a5a, 0xffe0b8];

function buildWalker(rng) {
  const g = new THREE.Group();
  const skin = pick(rng, SKINS);
  const shirt = pick(rng, SHIRTS);
  const pants = pick(rng, PANTS);
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 });

  const legGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.85, 8);
  legGeo.translate(0, -0.425, 0);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.14, 0.86, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.14, 0.86, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.75, 10), shirtMat);
  torso.position.y = 1.22;
  const armGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.68, 8);
  armGeo.translate(0, -0.34, 0);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.36, 1.55, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.36, 1.55, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = 1.84;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2f18, 0x777777, 0x2a1a0a]), roughness: 0.9 }),
  );
  hair.position.y = 0.04;
  head.add(hair);
  legL.castShadow = legR.castShadow = torso.castShadow = true;
  g.add(legL, legR, torso, armL, armR, head);
  g.userData = { legL, legR, armL, armR, head, torso };
  return g;
}

class Walker {
  constructor(scene, x, z, rng) {
    this.mesh = buildWalker(rng);
    this.mesh.position.set(x, 0, z);
    this.heading = rng() * Math.PI * 2;
    this.speed = range(rng, 1.0, 1.9);
    this.baseSpeed = this.speed;
    this.walkPhase = rng() * Math.PI * 2;
    this.fleeTimer = 0;
    this.rng = rng;
    this.target = null;
    this.dead = false;
    this._pickTarget();
    scene.add(this.mesh);
  }

  _pickTarget() {
    const half = WORLD.size / 2 - 40;
    this.target = { x: range(this.rng, -half, half), z: range(this.rng, -half, half) };
  }

  fleeFrom(x, z) {
    this.fleeTimer = 3.5;
    const dx = this.mesh.position.x - x, dz = this.mesh.position.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.target = {
      x: this.mesh.position.x + (dx / d) * 40,
      z: this.mesh.position.z + (dz / d) * 40,
    };
  }

  update(dt) {
    if (this.dead) return;
    const p = this.mesh.position;
    const dx = this.target.x - p.x, dz = this.target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { this._pickTarget(); return; }
    const wantHeading = Math.atan2(dx, dz);
    this.heading = angleLerp(this.heading, wantHeading, Math.min(1, dt * 3));
    this.speed = this.fleeTimer > 0 ? this.baseSpeed * 2.6 : this.baseSpeed;
    if (this.fleeTimer > 0) this.fleeTimer -= dt;
    p.x += Math.sin(this.heading) * this.speed * dt;
    p.z += Math.cos(this.heading) * this.speed * dt;
    p.x = clamp(p.x, -310, 310);
    p.z = clamp(p.z, -310, 310);
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * this.speed * 4.2;
    const s = Math.sin(this.walkPhase);
    const u = this.mesh.userData;
    u.legL.rotation.x = s * 0.55;
    u.legR.rotation.x = -s * 0.55;
    u.armL.rotation.x = -s * 0.45;
    u.armR.rotation.x = s * 0.45;
    this.mesh.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.04;
  }
}

export class Crowd {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(4242);
    this.walkers = [];
    const half = WORLD.size / 2 - 40;
    for (let i = 0; i < 32; i++) {
      const w = new Walker(scene, range(this.rng, -half, half), range(this.rng, -half, half), this.rng);
      this.walkers.push(w);
    }
    // The eight talkable NPCs stand at the world's talk spots.
    this.talkers = [];
    for (let i = 0; i < TALK_NPCS.length; i++) {
      const spot = world.talkSpots[i % world.talkSpots.length];
      const w = new Walker(scene, spot.x, spot.z, this.rng);
      w.isTalker = true;
      w.name = TALK_NPCS[i].name;
      w.lines = TALK_NPCS[i].lines;
      w.talked = false;
      // talkers wait in place, facing the street
      w.target = { x: spot.x, z: spot.z };
      w.baseSpeed = 0;
      w.speed = 0;
      this.talkers.push(w);
      this.walkers.push(w);
    }
  }

  update(dt) {
    for (const w of this.walkers) {
      if (w.isTalker) {
        // talkers idle in place with a small breathing sway
        const u = w.mesh.userData;
        const t = performance.now() * 0.001;
        u.armL.rotation.x = Math.sin(t + 1) * 0.06;
        u.armR.rotation.x = -Math.sin(t + 1) * 0.06;
        w.mesh.rotation.y += Math.sin(t * 0.3) * 0.0004;
        continue;
      }
      w.update(dt);
    }
  }

  scare(x, z, radius = 26) {
    for (const w of this.walkers) {
      if (w.dead || w.isTalker) continue;
      const d = Math.hypot(w.mesh.position.x - x, w.mesh.position.z - z);
      if (d < radius) w.fleeFrom(x, z);
    }
  }

  // Nearest living talker within `radius` of (x, z), or null.
  nearestTalker(x, z, radius = 3.2) {
    let best = null, bd = radius;
    for (const w of this.talkers) {
      if (w.dead) continue;
      const d = Math.hypot(w.mesh.position.x - x, w.mesh.position.z - z);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  // Nearest living walker within `radius` (for shooting). Returns {walker, dist}.
  nearestWalker(x, z, radius = 2.2) {
    let best = null, bd = radius;
    for (const w of this.walkers) {
      if (w.dead || w.isTalker) continue;
      const d = Math.hypot(w.mesh.position.x - x, w.mesh.position.z - z);
      if (d < bd) { bd = d; best = w; }
    }
    return best ? { walker: best, dist: bd } : null;
  }
}
