// Neon Bay — Kai Reyes on foot.
//
// One clear job: the player character when he is not in a car — smooth
// third-person walking with a run, a little hop of a walk cycle, entering and
// leaving cars, and taking damage.

import * as THREE from 'three';
import { clamp, angleLerp } from './random.js';
import { buildPersonMesh } from './pedestrians.js';
import { WORLD } from './config.js';

export class Player {
  constructor(scene, rng) {
    this.rng = rng;
    this.mesh = buildPersonMesh(rng);
    // Kai: black jacket, gold chain — the crew's colours. The torso and the
    // arms share the jacket; the random shirt colour underneath never shows.
    const jacket = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 });
    this.mesh.children[0].material = jacket;
    for (const arm of this.mesh.userData.arms) arm.material = jacket;
    this.mesh.position.set(0, 0, 40);
    this.mesh.rotation.y = Math.PI;
    scene.add(this.mesh);
    this.heading = Math.PI;
    this.speed = 0;
    this.walkPhase = 0;
    this.health = 100;
    this.armor = 0;
    this.inVehicle = null;
    this.dead = false;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  reset(x, z) {
    this.mesh.position.set(x, 0, z);
    this.heading = Math.PI;
    this.health = 100;
    this.armor = 0;
    this.dead = false;
    this.inVehicle = null;
  }

  damage(amount) {
    if (this.dead) return;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  addArmor(amount) {
    this.armor = clamp(this.armor + amount, 0, 100);
  }

  // Walk relative to the camera heading: forward is away from the camera.
  walk(dt, axes, cameraHeading, colliders) {
    if (this.dead) return;
    const mag = Math.hypot(axes.x, axes.z);
    if (mag > 0.01) {
      const moveAngle = Math.atan2(axes.x, -axes.z) + cameraHeading;
      const targetHeading = moveAngle;
      this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 10));
      const speed = axes.sprint ? 8.5 : 5.2;
      this.speed = speed;
      let nx = this.x + Math.sin(this.heading) * speed * dt;
      let nz = this.z + Math.cos(this.heading) * speed * dt;
      nx = clamp(nx, -WORLD.size / 2 + 6, WORLD.size / 2 - 6);
      nz = clamp(nz, -WORLD.size / 2 + 6, WORLD.size / 2 - 6);
      if (!this._hitsCollider(nx, nz, colliders)) {
        this.mesh.position.x = nx;
        this.mesh.position.z = nz;
      } else if (!this._hitsCollider(this.x, nz, colliders)) {
        this.mesh.position.z = nz;
      } else if (!this._hitsCollider(nx, this.z, colliders)) {
        this.mesh.position.x = nx;
      }
      this.walkPhase += dt * speed * 2.2;
    } else {
      this.speed = 0;
      this.walkPhase += dt * 0.4;
    }
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * clamp(this.speed / 8.5, 0.1, 1) * 0.5;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    this.mesh.userData.arms[1].rotation.x = swing * 0.7;
    // A little bounce while moving.
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05 * clamp(this.speed / 8.5, 0, 1);
  }

  _hitsCollider(x, z, colliders) {
    const m = 0.6;
    for (const c of colliders) {
      if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return true;
    }
    return false;
  }
}
