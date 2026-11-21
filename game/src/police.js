// Neon Bay — the law. A wanted level (0–5 stars) rises with crimes and cools
// off when you lay low. Cop cars chase and ram, roadblocks appear at 3 stars,
// and a helicopter with a sweeping searchlight joins at 4. Get caught on foot
// and you are busted; lose all health and you are wasted.

import * as THREE from '../vendor/three.module.min.js';
import { Vehicle } from './vehicles.js';
import { clamp, angleLerp, angleDiff, range } from './random.js';

const LEVEL_HEAT = [0, 20, 40, 60, 80, 95]; // heat needed for each star

export class Police {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.heat = 0;
    this.level = 0;
    this.quietTimer = 0; // seconds since the last crime
    this.cops = [];      // {vehicle, hp, disabled}
    this.roadblocks = []; // parked cop vehicles
    this.heli = null;
    this.heliLight = null;
    this.bustedCooldown = 0;
    this._spawnTimer = 0;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.quietTimer = 0;
    const lvl = this.levelFor(this.heat);
    if (lvl !== this.level) this.level = lvl;
  }

  levelFor(heat) {
    let lvl = 0;
    for (let i = 1; i <= 5; i++) if (heat >= LEVEL_HEAT[i]) lvl = i;
    return lvl;
  }

  _spawnCopNear(playerPos) {
    const a = Math.random() * Math.PI * 2;
    const r = 70 + Math.random() * 40;
    const p = this.world.nearestRoadPoint(
      clamp(playerPos.x + Math.sin(a) * r, -256, 256),
      clamp(playerPos.z + Math.cos(a) * r, -256, 256),
    );
    const v = new Vehicle(this.scene, 'cop', 0x111318, p.x, p.z, Math.random() * Math.PI * 2);
    v.driver = 'cop';
    this.cops.push({ vehicle: v, hp: 100, disabled: false });
    return v;
  }

  _clearRoadblocks() {
    for (const v of this.roadblocks) {
      this.scene.remove(v.group);
    }
    this.roadblocks = [];
  }

  _placeRoadblock(playerPos, playerHeading) {
    this._clearRoadblocks();
    const ahead = 55;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const rp = this.world.nearestRoadPoint(clamp(cx, -256, 256), clamp(cz, -256, 256));
    for (const off of [-4, 4]) {
      const v = new Vehicle(this.scene, 'cop', 0x111318, rp.x + off, rp.z, playerHeading + Math.PI / 2);
      v.driver = 'cop';
      this.roadblocks.push(v);
    }
  }

  _ensureHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.4, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), bodyMat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), bodyMat);
    tail.position.set(0, 0.2, -3.4);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.5, metalness: 0.7 }));
    rotor.position.y = 1.0;
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), rotor.material);
    tailRotor.position.set(0.3, 0.4, -4.8);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lamp.position.set(0, -0.8, 1.2);
    g.add(body, tail, rotor, tailRotor, lamp);
    this.heliRotor = rotor;
    this.heliTailRotor = tailRotor;
    // searchlight: a real spotlight + a visible cone
    const spot = new THREE.SpotLight(0xfff6c8, 900, 90, 0.32, 0.45, 1.2);
    spot.position.set(0, -0.8, 1.2);
    const coneGeo = new THREE.ConeGeometry(7, 26, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, -13.8, 1.2);
    cone.rotation.x = Math.PI;
    g.add(spot, cone);
    spot.target.position.set(0, -26, 0);
    g.add(spot.target);
    g.position.set(0, 30, 0);
    this.scene.add(g);
    this.heli = g;
    this.heliLight = spot;
  }

  _removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli);
    this.heli = null;
    this.heliLight = null;
  }

  // Shooting a cop car. Returns true if it was disabled.
  hitCop(vehicle, damage) {
    const cop = this.cops.find((c) => c.vehicle === vehicle);
    if (!cop || cop.disabled) return false;
    cop.hp -= damage;
    if (cop.hp <= 0) {
      cop.disabled = true;
      cop.vehicle.speed = 0;
      cop.vehicle.group.rotation.z = 0.06;
      this.addHeat(6);
      return true;
    }
    return false;
  }

  nearestCopVehicle(x, z, radius) {
    let best = null, bd = radius;
    for (const c of this.cops) {
      if (c.disabled) continue;
      const d = Math.hypot(c.vehicle.group.position.x - x, c.vehicle.group.position.z - z);
      if (d < bd) { bd = d; best = c.vehicle; }
    }
    return best;
  }

  update(dt, player, world) {
    this.bustedCooldown = Math.max(0, this.bustedCooldown - dt);
    // frozen (screenshot staging): cops stay parked where they were put.
    if (this.frozen) return null;
    // heat decay after 8 quiet seconds
    this.quietTimer += dt;
    if (this.quietTimer > 8 && this.heat > 0) {
      this.heat = clamp(this.heat - 2.2 * dt, 0, 100);
      const lvl = this.levelFor(this.heat);
      if (lvl !== this.level) this.level = lvl;
    }
    const pPos = player.pos;
    const want = this.level;

    // spawn / despawn cop cars to match the wanted level
    this._spawnTimer -= dt;
    const activeCops = this.cops.filter((c) => !c.disabled).length;
    if (want > 0 && activeCops < want && this._spawnTimer <= 0) {
      this._spawnCopNear(pPos);
      this._spawnTimer = 1.2;
    }
    if (want === 0 && this.cops.length > 0) {
      for (const c of this.cops) this.scene.remove(c.vehicle.group);
      this.cops = [];
      this._clearRoadblocks();
    }

    // roadblocks at 3+ stars, refreshed ahead of the player
    if (want >= 3) {
      this._rbTimer = (this._rbTimer || 0) - dt;
      if (this._rbTimer <= 0) {
        this._placeRoadblock(pPos, player.heading);
        this._rbTimer = 9;
      }
    } else if (this.roadblocks.length) {
      this._clearRoadblocks();
    }

    // helicopter at 4+ stars
    if (want >= 4) this._ensureHeli();
    else if (this.heli) this._removeHeli();

    // siren follows the wanted level
    if (this.sound) this.sound.siren(want >= 1);

    // cop pursuit
    const inVehicle = player.inVehicle;
    for (const c of this.cops) {
      const v = c.vehicle;
      if (c.disabled) {
        // blink the light bar on a wreck
        if (v.copLights) {
          const on = Math.floor(performance.now() / 300) % 2 === 0;
          v.copLights[0].visible = on;
          v.copLights[1].visible = !on;
        }
        continue;
      }
      const vp = v.group.position;
      const dx = pPos.x - vp.x, dz = pPos.z - vp.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 170) {
        // too far: respawn closer on the road grid
        const a = Math.random() * Math.PI * 2;
        const rp = world.nearestRoadPoint(
          clamp(pPos.x + Math.sin(a) * 80, -256, 256),
          clamp(pPos.z + Math.cos(a) * 80, -256, 256),
        );
        vp.x = rp.x; vp.z = rp.z;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      v.heading = angleLerp(v.heading, wantHeading, Math.min(1, dt * 2.4));
      const chaseSpeed = Math.min(30, 20 + want * 2.2);
      const f = v.forward();
      vp.addScaledVector(f, chaseSpeed * dt);
      v.group.rotation.y = v.heading;
      const spin = (chaseSpeed * dt) / 0.34;
      for (const w of v.wheels) w.rotation.x += spin;
      // light bar strobe
      if (v.copLights) {
        const on = Math.floor(performance.now() / 180) % 2 === 0;
        v.copLights[0].visible = on;
        v.copLights[1].visible = !on;
      }
      // ram the player
      if (dist < 2.6 && this.bustedCooldown <= 0) {
        if (inVehicle) {
          inVehicle.damage(10);
          v.speed = 0;
          this.bustedCooldown = 0.8;
        } else {
          this.bustedCooldown = 2;
          return 'busted';
        }
      }
      // bump the player's car
      if (inVehicle && dist < 3.4) {
        const push = (3.4 - dist) / 2;
        const nx = (inVehicle.group.position.x - vp.x) / (dist || 1);
        const nz = (inVehicle.group.position.z - vp.z) / (dist || 1);
        inVehicle.group.position.x += nx * push;
        inVehicle.group.position.z += nz * push;
        inVehicle.damage(2);
      }
    }

    // helicopter follows and sweeps its searchlight
    if (this.heli) {
      const t = performance.now() * 0.001;
      const hx = pPos.x + Math.sin(t * 0.5) * 14;
      const hz = pPos.z + Math.cos(t * 0.4) * 14;
      this.heli.position.set(hx, 27 + Math.sin(t * 0.8) * 1.5, hz);
      this.heli.rotation.y = Math.atan2(pPos.x - hx, pPos.z - hz);
      this.heliRotor.rotation.y += dt * 22;
      this.heliTailRotor.rotation.x += dt * 30;
      // searchlight target sweeps around the player
      const sx = pPos.x + Math.sin(t * 1.3) * 9;
      const sz = pPos.z + Math.cos(t * 1.1) * 9;
      this.heliLight.target.position.set(sx - hx, -27, sz - hz);
    }
    return null;
  }
}
