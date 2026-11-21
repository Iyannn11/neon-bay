// Neon Bay — wanted level, police pursuit cars, roadblocks and the helicopter
// with its searchlight. Written fresh for Round 12.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { makeCar, Driver } from './vehicles.js';
import { clamp, damp } from './random.js';

export class Police {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.units = []; // {driver, car}
    this.spawnTimer = 0;
    this.heli = null;
    this.heliLight = null;
    this.roadblocks = [];
    this.flash = 0;
  }

  get wanted() { return this.player.wanted; }

  addWanted(n) {
    this.player.wanted = clamp(this.player.wanted + n, 0, 5);
  }

  step(dt) {
    const p = this.player;
    // wanted decays when the player stays out of trouble
    if (p.wanted > 0) {
      p.wanted = Math.max(0, p.wanted - (dt / TUNING.wantedDecay) * 0.12);
      if (p.wanted < 0.5) p.wanted = 0;
    }
    const want = Math.min(4, Math.floor(p.wanted) + (p.wanted >= 1 ? 1 : 0));
    // spawn pursuit units up to the wanted count
    this.spawnTimer -= dt;
    if (this.units.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = TUNING.policeSpawn;
      const car = makeCar('police', 0xf2f2f2);
      this.scene.add(car);
      const d = new Driver(car);
      const a = Math.random() * Math.PI * 2;
      d.pos.set(p.pos.x + Math.cos(a) * 55, 0, p.pos.z + Math.sin(a) * 55);
      d.heading = Math.atan2(p.pos.x - d.pos.x, p.pos.z - d.pos.z);
      this.units.push({ driver: d, car });
    }
    // pursuit steering: chase the player, ram on contact
    for (const u of this.units) {
      const dx = p.pos.x - u.driver.pos.x, dz = p.pos.z - u.driver.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantH = Math.atan2(dx, dz);
      let dh = wantH - u.driver.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.4, -1, 1);
      const throttle = dist > 6 ? 1 : 0.4;
      u.driver.step(throttle, steer, dt, this.world);
      // flashing light bar
      this.flash += dt;
      const on = Math.sin(this.flash * 14) > 0;
      if (u.car.userData.lightR) u.car.userData.lightR.material.emissiveIntensity = on ? 3 : 0.2;
      if (u.car.userData.lightB) u.car.userData.lightB.material.emissiveIntensity = on ? 0.2 : 3;
      if (dist < 3.2 && !p.inVehicle) {
        p.damage(6 * dt);
        p.vel.x += (dx / dist) * 4 * dt * 10;
        p.vel.z += (dz / dist) * 4 * dt * 10;
      }
      if (dist < 4 && p.inVehicle) {
        p.inVehicle.v.userData.hp -= 8 * dt;
      }
    }
    // drop units when wanted is gone
    if (p.wanted < 0.5) {
      for (const u of this.units) this.scene.remove(u.car);
      this.units = [];
      this.clearRoadblocks();
    }
    // roadblocks at wanted 3+
    if (p.wanted >= 3 && this.roadblocks.length === 0) this.makeRoadblocks();
    if (p.wanted < 3 && this.roadblocks.length > 0) this.clearRoadblocks();
    // helicopter at wanted 3+
    if (p.wanted >= TUNING.heliAt && !this.heli) this.makeHeli();
    if (p.wanted < TUNING.heliAt && this.heli) {
      this.scene.remove(this.heli); this.scene.remove(this.heliLight);
      this.heli = null; this.heliLight = null;
    }
    if (this.heli) {
      const t = performance.now() * 0.001;
      const hx = p.pos.x + Math.sin(t * 0.35) * 26;
      const hz = p.pos.z + Math.cos(t * 0.3) * 26;
      this.heli.position.set(hx, 42 + Math.sin(t * 0.8) * 2, hz);
      this.heli.rotation.y = Math.atan2(p.pos.x - hx, p.pos.z - hz);
      this.heli.children[0].rotation.y += dt * 22; // rotor
      this.heliLight.position.set(hx, 40, hz);
      this.heliLight.target.position.set(p.pos.x, 0, p.pos.z);
      this.heliLight.target.updateMatrixWorld();
      // searchlight cone follows the player
      this.heli.children[1].lookAt(p.pos.x, 0, p.pos.z);
    }
  }

  makeRoadblocks() {
    const p = this.player;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const bx = p.pos.x + Math.cos(a) * 26, bz = p.pos.z + Math.sin(a) * 26;
      const g = new THREE.Group();
      g.position.set(bx, 0, bz);
      for (let j = -1; j <= 1; j++) {
        const car = makeCar('police', 0xf2f2f2);
        car.position.set(j * 4.6, 0, 0);
        car.rotation.y = a + Math.PI / 2;
        g.add(car);
      }
      const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.7 });
      for (let j = -3; j <= 3; j++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), coneMat);
        cone.position.set(j * 2.2, 0.45, 5);
        g.add(cone);
      }
      this.scene.add(g);
      this.roadblocks.push(g);
      this.world.addCollider(bx, bz, 8, 3);
    }
  }

  clearRoadblocks() {
    for (const g of this.roadblocks) this.scene.remove(g);
    this.roadblocks = [];
  }

  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2), new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.4, metalness: 0.5 }));
    body.position.y = 0; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), body.material);
    tail.position.set(-3.4, 0.3, 0); g.add(tail);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x0e1a24, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(2.0, 0.2, 0); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x11141a }));
    rotor.position.y = 1.1; g.add(rotor);
    g.children.push(rotor); // index 0 is the rotor for spin (kept first via unshift below)
    // searchlight cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -21; g.add(cone);
    // reorder: rotor first so children[0] is the rotor
    g.children = [rotor, cone, body, tail, glass];
    g.position.set(this.player.pos.x + 20, 42, this.player.pos.z + 20);
    this.scene.add(g);
    this.heli = g;
    const spot = new THREE.SpotLight(0xfff2c8, 120, 70, 0.32, 0.5, 1.1);
    spot.position.copy(g.position);
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.heliLight = spot;
  }
}
