// police.js — the wanted system and the police who answer it.
// Wanted runs 0–5. Crimes raise it; hiding and outrunning the cops lowers it.
// Patrol cars chase and ram; at 4+ stars a helicopter joins with a
// searchlight; at high stars roadblocks appear. A cop touching the player on
// foot at high wanted means BUSTED.

import * as THREE from 'three';
import { POLICE, WORLD } from './config.js';
import { createCarMesh } from './vehicles.js';

export class PoliceSystem {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.wanted = 0;
    this.heat = 0; // 0..1, how "hot" the player is right now
    this.lastSeen = 0;
    this.decayTimer = 0;
    this.cars = [];
    this.heli = null;
    this.heliLight = null;
    this.roadblocks = [];
    this.busted = false;
    this._buildHeli();
  }

  _buildHeli() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.6, roughness: 0.4 });
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 5.5, 12), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), bodyMat);
    nose.position.set(0, 0, 2.6);
    nose.scale.set(1, 0.9, 1);
    group.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 5, 8), bodyMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.3, -4.5);
    group.add(tail);
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.7, roughness: 0.4 });
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), rotorMat);
    rotor.position.y = 1.9;
    group.add(rotor);
    this.heliRotor = rotor;
    // Searchlight: a visible cone plus a real spotlight.
    const coneGeo = new THREE.ConeGeometry(5, 26, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, -13, 0);
    cone.rotation.x = Math.PI;
    group.add(cone);
    const spot = new THREE.SpotLight(0xfff2c0, 220, 60, 0.28, 0.5, 1.2);
    spot.position.set(0, -1, 0);
    group.add(spot);
    group.add(spot.target);
    spot.target.position.set(0, -26, 0);
    this.heliLight = spot;
    group.visible = false;
    this.scene.add(group);
    this.heli = group;
  }

  addWanted(amount, reason) {
    if (amount <= 0) return;
    this.wanted = Math.min(POLICE.maxWanted, this.wanted + amount);
    this.heat = 1;
    this.decayTimer = 0;
  }

  setWanted(level) {
    this.wanted = Math.max(0, Math.min(POLICE.maxWanted, level));
    this.heat = level > 0 ? 1 : 0;
    this.decayTimer = 0;
  }

  _spawnCar(x, z) {
    const mesh = createCarMesh(0x14181f, { police: true });
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, sirenPhase: this.rng.next() * Math.PI * 2 };
    this.cars.push(car);
    return car;
  }

  _removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  _spawnRoadblock(x, z, angle) {
    const block = new THREE.Group();
    for (const dx of [-3, 0, 3]) {
      const mesh = createCarMesh(0x14181f, { police: true });
      mesh.position.set(Math.cos(angle) * dx, 0, Math.sin(angle) * dx);
      mesh.rotation.y = angle + Math.PI / 2;
      block.add(mesh);
    }
    block.position.set(x, 0, z);
    this.scene.add(block);
    this.roadblocks.push(block);
  }

  _clearRoadblocks() {
    for (const block of this.roadblocks) this.scene.remove(block);
    this.roadblocks.length = 0;
  }

  // How far the player is from the nearest cop car.
  nearestCopDistance(px, pz) {
    let best = Infinity;
    for (const car of this.cars) {
      const d = Math.hypot(car.x - px, car.z - pz);
      if (d < best) best = d;
    }
    return best;
  }

  update(dt, player, onFoot) {
    // Wanted decays only after the player has been unseen for a while.
    const nearest = this.nearestCopDistance(player.x, player.z);
    const seen = nearest < 55 || this.wanted >= 4;
    if (seen) {
      this.lastSeen = 0;
      this.decayTimer = 0;
    } else {
      this.decayTimer += dt;
      if (this.decayTimer > POLICE.decayDelay && this.wanted > 0) {
        this.wanted = Math.max(0, this.wanted - POLICE.decayRate * dt);
        if (this.wanted < 0.05) this.wanted = 0;
      }
    }
    const want = Math.round(this.wanted);
    const targetCars = POLICE.chaseCars[want] || 0;

    // Spawn or remove chase cars to match the wanted level.
    while (this.cars.length < targetCars) {
      const angle = this.rng.next() * Math.PI * 2;
      const dist = 55 + this.rng.next() * 25;
      this._spawnCar(
        Math.max(-180, Math.min(180, player.x + Math.cos(angle) * dist)),
        Math.max(-180, Math.min(180, player.z + Math.sin(angle) * dist)),
      );
    }
    while (this.cars.length > targetCars) {
      this._removeCar(this.cars[this.cars.length - 1]);
    }

    // Chase: steer toward the player, ram on contact.
    for (const car of this.cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      const targetSpeed = dist > 8 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.5;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = Math.max(-WORLD.halfSize - 10, Math.min(WORLD.halfSize + 10, car.x));
      car.z = Math.max(-WORLD.halfSize - 10, Math.min(WORLD.halfSize + 10, car.z));
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Flash the light bar.
      car.sirenPhase += dt * 9;
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const redOn = Math.sin(car.sirenPhase) > 0;
        bar.red.material.color.setHex(redOn ? 0xff2222 : 0x551111);
        bar.blue.material.color.setHex(redOn ? 0x111155 : 0x2244ff);
      }
      // Busted: a cop touches the player on foot at 3+ stars.
      if (onFoot && want >= 3 && dist < POLICE.bustDistance) {
        this.busted = true;
      }
      // Ram the player's car: slow it down.
      if (!onFoot && dist < 4.2 && player.car) {
        player.car.speed *= 0.55;
      }
    }

    // Helicopter at 4+ stars: circles above the player, searchlight on them.
    const heliWanted = want >= POLICE.heliAtWanted;
    this.heli.visible = heliWanted;
    if (heliWanted) {
      const t = performance.now() / 1000;
      const angle = t * 0.35;
      this.heli.position.set(player.x + Math.cos(angle) * 16, 34, player.z + Math.sin(angle) * 16);
      this.heli.rotation.y = -angle;
      this.heliRotor.rotation.y = t * 22;
      this.heliLight.target.position.set(player.x - this.heli.position.x, -34, player.z - this.heli.position.z);
      this.heliLight.target.updateMatrixWorld();
    }

    // Roadblocks at 4+ stars: two fixed blocks ahead of the player.
    if (want >= 4 && this.roadblocks.length === 0) {
      this._spawnRoadblock(player.x + 40, player.z, 0.4);
      this._spawnRoadblock(player.x - 35, player.z + 30, 1.2);
    } else if (want < 4 && this.roadblocks.length > 0) {
      this._clearRoadblocks();
    }
  }

  reset() {
    this.wanted = 0;
    this.heat = 0;
    this.busted = false;
    this.decayTimer = 0;
    while (this.cars.length) this._removeCar(this.cars[0]);
    this._clearRoadblocks();
    this.heli.visible = false;
  }
}
