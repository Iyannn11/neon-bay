// Neon Bay — the wanted system and the police.
//
// One clear job: crime has a price. Stars 0–5, NBPD interceptors that chase,
// ram and roadblock, and a helicopter with a searchlight from 3 stars up.
// Heat decays when the player stays clean and out of sight.

import * as THREE from 'three';
import { WANTED, WORLD } from './config.js';
import { Vehicle, buildCarMesh } from './vehicles.js';
import { range, pick, chance, clamp, angleLerp, dist2D } from './random.js';

export class Police {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.stars = 0;
    this.heat = 0; // 0..100, stars follow heat
    this.decayTimer = 0;
    this.cars = [];
    this.heli = null;
    this.heliLight = null;
    this._buildHelicopter();
  }

  _buildHelicopter() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.35, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.6, 6, 10), bodyMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.1, metalness: 0.9 }));
    glass.position.set(1.9, -0.2, 0);
    glass.scale.set(1, 0.8, 1);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 3.4, 8), bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-2.8, 0.3, 0);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 7.5), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    rotor.position.y = 1.35;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    tailRotor.position.set(-4.4, 0.4, 0);
    g.add(tailRotor);
    this._rotor = rotor;
    this._tailRotor = tailRotor;
    // Searchlight: a cone of light + a bright spot on the ground.
    this.heliLight = new THREE.SpotLight(0xfff2c0, 0, 120, 0.28, 0.45, 1.2);
    g.add(this.heliLight);
    g.add(this.heliLight.target);
    this.heliLight.target.position.set(0, -40, 0);
    g.visible = false;
    this.scene.add(g);
    this.heli = g;
  }

  spawnCar(x, z, heading) {
    const car = new Vehicle('police', x, z, heading);
    car.cruise = 15;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const next = this.heat <= 4 ? 0 : this.heat <= 22 ? 1 : this.heat <= 42 ? 2 : this.heat <= 62 ? 3 : this.heat <= 84 ? 4 : 5;
    if (next > this.stars) this.stars = next;
  }

  setStars(n) {
    this.stars = clamp(n, 0, 5);
    this.heat = [0, 12, 30, 50, 70, 90][this.stars];
  }

  placeHelicopter(x, y, z) {
    this.heli.position.set(x, y, z);
  }

  update(dt, playerX, playerZ, playerVehicle, colliders, onBusted, playerHeading = 0) {
    const cfg = WANTED[this.stars];
    // Decay: stay clean and the heat bleeds off.
    if (this.stars > 0) {
      this.decayTimer += dt;
      if (this.decayTimer > cfg.decaySec) {
        this.decayTimer = 0;
        this.heat = Math.max(0, this.heat - 20);
        this.stars = this.heat <= 4 ? 0 : this.heat <= 22 ? 1 : this.heat <= 42 ? 2 : this.heat <= 62 ? 3 : this.heat <= 84 ? 4 : 5;
      }
    }
    // Spawn interceptors up to the wanted level's count.
    while (this.cars.length < cfg.policeCars) {
      const angle = this.rng() * Math.PI * 2;
      const px = clamp(playerX + Math.cos(angle) * 55, -280, 280);
      const pz = clamp(playerZ + Math.sin(angle) * 55, -280, 280);
      this.spawnCar(px, pz, Math.atan2(playerX - px, playerZ - pz));
    }
    // Extra cars leave when the heat drops.
    while (this.cars.length > cfg.policeCars) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
    // Chase: interceptors steer at the player, ram on contact, roadblock in pairs.
    for (let i = 0; i < this.cars.length; i += 1) {
      const car = this.cars[i];
      const d = dist2D(car.x, car.z, playerX, playerZ);
      const desired = Math.atan2(playerX - car.x, playerZ - car.z);
      // Roadblock: the second car aims ahead of the player to cut him off.
      const aim = (i === 1 && playerVehicle)
        ? Math.atan2(playerX + Math.sin(playerVehicle.heading) * 18 - car.x, playerZ + Math.cos(playerVehicle.heading) * 18 - car.z)
        : desired;
      car.heading = angleLerp(car.heading, aim, Math.min(1, dt * 1.8));
      const want = d > 6 ? 16.5 : 4;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.2);
      const f = car.forward();
      let nx = clamp(car.x + f.x * car.speed * dt, -WORLD.size / 2 + 8, WORLD.size / 2 - 8);
      let nz = clamp(car.z + f.z * car.speed * dt, -WORLD.size / 2 + 8, WORLD.size / 2 - 8);
      if (!car._hitsCollider(nx, nz, colliders)) {
        car.mesh.position.x = nx;
        car.mesh.position.z = nz;
      }
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.z = car.wheelSpin;
      // Ram: touching the player in a car shoves him; on foot it hurts.
      if (d < 4.2) {
        if (playerVehicle) {
          playerVehicle.speed *= 0.55;
        } else if (onBusted) {
          onBusted('ram');
        }
      }
      // Busted: slow on foot, police right on top of you.
      if (!playerVehicle && d < 2.6 && this.stars >= 1 && playerVehicle === null) {
        if (onBusted) onBusted('busted');
      }
    }
    // Helicopter: hovers ahead of the player from 3 stars, searchlight
    // pinned on the road ahead of him, so the chase reads in the frame.
    const wantHeli = cfg.heli;
    this.heli.visible = wantHeli;
    if (wantHeli) {
      this._rotor.rotation.y += dt * 22;
      this._tailRotor.rotation.x += dt * 30;
      const hx = playerX + Math.sin(playerHeading) * 55;
      const hz = playerZ + Math.cos(playerHeading) * 55;
      this.heli.position.x += (hx - this.heli.position.x) * Math.min(1, dt * 0.8);
      this.heli.position.z += (hz - this.heli.position.z) * Math.min(1, dt * 0.8);
      this.heli.position.y = 16 + Math.sin(performance.now() * 0.001) * 1.5;
      this.heli.rotation.y = Math.atan2(playerX - this.heli.position.x, playerZ - this.heli.position.z);
      this.heliLight.intensity = 900;
    } else {
      this.heliLight.intensity = 0;
    }
  }
}
