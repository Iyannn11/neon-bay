// combat.js — fists and the pistol. Punching is a short-range swing with a
// cooldown; the pistol fires a ray from the camera, costs one round, and
// reloads with R. Police return fire when the wanted level is high, and
// every shot can raise the heat.

import * as THREE from 'three';
import { PLAYER } from './config.js';

export class CombatSystem {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.ammo = PLAYER.pistolMag;
    this.reloading = false;
    this.reloadTimer = 0;
    this.punchCooldown = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    this._buildTracer();
  }

  _buildTracer() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    this.scene.add(this.tracer);
  }

  // A punch: hits the nearest pedestrian or cop within range in front.
  punch(playerPos, playerHeading, peds, police) {
    if (this.punchCooldown > 0) return false;
    this.punchCooldown = 0.45;
    if (this.audio) this.audio.thud();
    const fx = Math.sin(playerHeading);
    const fz = Math.cos(playerHeading);
    // Pedestrians first.
    const ped = peds.nearest(
      playerPos.x + fx * PLAYER.punchRange * 0.5,
      playerPos.z + fz * PLAYER.punchRange * 0.5,
      PLAYER.punchRange,
    );
    if (ped) {
      peds.knockDown(ped);
      return true;
    }
    // Then cops.
    for (const car of police.cars) {
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d < PLAYER.punchRange + 2) {
        car.speed = 0;
        return true;
      }
    }
    return false;
  }

  // Fire the pistol from `origin` along `direction`. Returns what was hit.
  shoot(origin, direction, peds, police) {
    if (this.reloading) return null;
    if (this.ammo <= 0) {
      this.startReload();
      return null;
    }
    this.ammo -= 1;
    if (this.audio) this.audio.gunshot();
    const ray = new THREE.Raycaster(origin, direction, 0.1, PLAYER.pistolRange);
    // Pedestrians: test against their torso spheres by distance to the ray.
    let hit = null;
    let bestT = PLAYER.pistolRange;
    for (const ped of peds.peds) {
      if (ped.down) continue;
      const toPed = new THREE.Vector3(ped.x - origin.x, 1.1 - origin.y, ped.z - origin.z);
      const t = toPed.dot(direction);
      if (t < 0 || t > bestT) continue;
      const closest = new THREE.Vector3().copy(direction).multiplyScalar(t).add(origin);
      const dist = closest.distanceTo(new THREE.Vector3(ped.x, 1.1, ped.z));
      if (dist < 0.9) {
        hit = { type: 'ped', ped, t };
        bestT = t;
      }
    }
    for (const car of police.cars) {
      const toCar = new THREE.Vector3(car.x - origin.x, 0.8 - origin.y, car.z - origin.z);
      const t = toCar.dot(direction);
      if (t < 0 || t > bestT) continue;
      const closest = new THREE.Vector3().copy(direction).multiplyScalar(t).add(origin);
      const dist = closest.distanceTo(new THREE.Vector3(car.x, 0.8, car.z));
      if (dist < 2.2) {
        hit = { type: 'cop', car, t };
        bestT = t;
      }
    }
    const end = new THREE.Vector3().copy(direction).multiplyScalar(bestT).add(origin);
    this._showTracer(origin, end);
    if (hit && hit.type === 'ped') peds.knockDown(hit.ped);
    if (hit && hit.type === 'cop') hit.car.speed = 0;
    return hit;
  }

  _showTracer(from, to) {
    const pos = this.tracer.geometry.getAttribute('position');
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.tracerTimer = 0.08;
  }

  startReload() {
    if (this.reloading || this.ammo === PLAYER.pistolMag) return;
    this.reloading = true;
    this.reloadTimer = 1.1;
  }

  // Police return fire: at 3+ stars a nearby cop occasionally shoots.
  policeFire(dt, playerPos, police, onDamage) {
    if (police.wanted < 3) return;
    for (const car of police.cars) {
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d > 26) continue;
      if (Math.random() < dt * 0.5) {
        if (this.audio) this.audio.gunshot();
        if (d < 18 && Math.random() < 0.45) onDamage(6);
      }
    }
  }

  update(dt) {
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = PLAYER.pistolMag;
      }
    }
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.material.opacity = 0;
    }
  }
}
