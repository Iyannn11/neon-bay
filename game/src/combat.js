// Neon Bay — combat.
//
// One clear job: guns. Three weapons with their own feel (pistol, SMG,
// shotgun), ammo and reloads, muzzle flash, tracers, hit sparks, and the
// pickups scattered around the city (health, armor, ammo).

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { range, pick, clamp } from './random.js';

export class Combat {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.weapon = 'pistol';
    this.ammo = { pistol: { mag: 12, reserve: 96 }, smg: { mag: 30, reserve: 180 }, shotgun: { mag: 6, reserve: 36 } };
    this.cooldown = 0;
    this.tracers = [];
    this.sparks = [];
    this.pickups = [];
    this._tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    this._sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 1 });
    this._muzzle = new THREE.PointLight(0xffe9a8, 0, 18, 2);
    scene.add(this._muzzle);
    this._spawnPickups();
  }

  _spawnPickups() {
    const defs = [
      { kind: 'health', color: 0x2eff8f, spots: 6 },
      { kind: 'armor', color: 0x00c2ff, spots: 4 },
      { kind: 'ammo', color: 0xffd23e, spots: 8 },
    ];
    for (const d of defs) {
      for (let i = 0; i < d.spots; i += 1) {
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12),
          new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.9, roughness: 0.3 }),
        );
        const x = range(this.rng, -270, 270);
        const z = range(this.rng, -270, 270);
        mesh.position.set(x, 0.5, z);
        this.scene.add(mesh);
        this.pickups.push({ kind: d.kind, mesh, taken: false, respawn: 0 });
      }
    }
  }

  selectWeapon(slot) {
    const order = ['pistol', 'smg', 'shotgun'];
    const w = order[slot];
    if (w) this.weapon = w;
  }

  current() {
    return WEAPONS[this.weapon];
  }

  ammoText() {
    const w = this.current();
    if (w.mag === Infinity) return '—';
    const a = this.ammo[this.weapon];
    return `${a.mag} / ${a.reserve}`;
  }

  reload() {
    const w = this.current();
    if (w.mag === Infinity) return;
    const a = this.ammo[this.weapon];
    if (a.mag >= w.mag || a.reserve <= 0) return;
    const need = w.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  // Fire from (ox, oy, oz) along a heading. Returns the hit points for scoring.
  // opts.free: an enemy's shot — it never spends the player's ammo or
  // the player's fire cooldown.
  fire(ox, oy, oz, heading, targets, onShot, opts = {}) {
    if (this.cooldown > 0 && !opts.free) return [];
    const w = this.current();
    if (w.mag !== Infinity && !opts.free) {
      const a = this.ammo[this.weapon];
      if (a.mag <= 0) {
        this.reload();
        return [];
      }
      a.mag -= 1;
    }
    if (!opts.free) this.cooldown = w.rate;
    this._muzzle.position.set(ox + Math.sin(heading) * 1.2, oy + 0.4, oz + Math.cos(heading) * 1.2);
    this._muzzle.intensity = 60;
    const hits = [];
    const pellets = w.pellets ?? 1;
    for (let p = 0; p < pellets; p += 1) {
      const spread = (this.rng() - 0.5) * 2 * w.spread;
      const dir = heading + spread + (this.rng() - 0.5) * 0.004;
      const dx = Math.sin(dir);
      const dz = Math.cos(dir);
      const endX = ox + dx * w.range;
      const endZ = oz + dz * w.range;
      this._addTracer(ox, oy + 0.35, oz, endX, oy + 0.35, endZ);
      // Nearest target along the ray.
      let best = null;
      let bestT = Infinity;
      for (const t of targets) {
        const tx = t.x - ox;
        const tz = t.z - oz;
        const along = tx * dx + tz * dz;
        if (along < 0 || along > w.range) continue;
        const perp = Math.abs(tx * dz - tz * dx);
        if (perp < 1.6 && along < bestT) { best = t; bestT = along; }
      }
      if (best) {
        best.health -= w.damage;
        hits.push(best);
        this._addSpark(ox + dx * bestT, oy + 0.4, oz + dz * bestT);
      }
    }
    if (onShot) onShot(w.sound);
    return hits;
  }

  _addTracer(x1, y1, z1, x2, y2, z2) {
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), this._tracerMat);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mesh.lookAt(x2, y2, z2);
    mesh.rotateX(Math.PI / 2);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  _addSpark(x, y, z) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), this._sparkMat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.sparks.push({ mesh, life: 0.18, grow: 2.2 });
  }

  update(dt, playerX, playerZ, onPickup) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this._muzzle.intensity = Math.max(0, this._muzzle.intensity - dt * 500);
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const s = this.sparks[i];
      s.life -= dt;
      s.mesh.scale.multiplyScalar(1 + s.grow * dt);
      s.mesh.material.opacity = clamp(s.life / 0.18, 0, 1);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }
    // Pickups: spin, bob, and hand out their reward on touch.
    for (const p of this.pickups) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.taken = false;
          p.mesh.visible = true;
        }
        continue;
      }
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.003 + p.mesh.position.x) * 0.12;
      const d = Math.hypot(p.mesh.position.x - playerX, p.mesh.position.z - playerZ);
      if (d < 1.8) {
        p.taken = true;
        p.respawn = 25;
        p.mesh.visible = false;
        if (onPickup) onPickup(p.kind);
      }
    }
  }
}
