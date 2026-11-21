// Neon Bay — wanted level and police. Stars rise when Kai shoots, steals
// or rams; cruisers chase, roadblocks form at 3 stars, and a helicopter
// with a searchlight joins at 4. Lay low and the heat fades.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.heat = 0; // 0..100, stars derive from it
    this.quietTimer = 0;
    this.cops = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliLight = null;
    this.sirenWanted = false;
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    const stars = Math.min(CONFIG.maxWanted, Math.ceil(this.heat / 20));
    if (stars > this.wanted) this.setWanted(stars);
    this.quietTimer = 0;
  }

  setWanted(stars) {
    this.wanted = stars;
    this.quietTimer = 0;
    // Spawn or remove cruisers to match the wanted level.
    while (this.cops.length < stars && this.cops.length < 4) this.spawnCop();
    while (this.cops.length > stars) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
    if (stars >= 3 && this.roadblocks.length === 0) this.buildRoadblock();
    if (stars < 3 && this.roadblocks.length > 0) {
      for (const r of this.roadblocks) this.scene.remove(r);
      this.roadblocks = [];
    }
    if (stars >= 4 && !this.heli) this.spawnHeli();
    if (stars < 4 && this.heli) {
      this.scene.remove(this.heli);
      this.scene.remove(this.heliLight);
      this.heli = null;
      this.heliLight = null;
    }
  }

  spawnCop() {
    const mesh = makeCarMesh('police');
    mesh.userData.isCop = true;
    mesh.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
    this.scene.add(mesh);
    this.cops.push({ mesh, speed: 0, stuck: 0 });
  }

  buildRoadblock() {
    // Two cruisers parked across the road ahead of the plaza + a barrier.
    for (const [x, z, rot] of [[0, -70, Math.PI / 2], [8, -70, Math.PI / 2]]) {
      const mesh = makeCarMesh('police');
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rot;
      this.scene.add(mesh);
      this.roadblocks.push(mesh);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(14, 1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.6 }),
    );
    barrier.position.set(4, 0.8, -70);
    this.scene.add(barrier);
    this.roadblocks.push(barrier);
  }

  spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.4, metalness: 0.5 }));
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 2), new THREE.MeshStandardMaterial({ color: 0x0d1a26, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(2.2, 0.2, 0);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 0.5), body.material);
    tail.position.set(-4, 0.3, 0);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111214 }));
    rotor.position.y = 1.1;
    g.add(rotor);
    g.userData.rotor = rotor;
    // Searchlight: a translucent cone + a real spotlight aimed down.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6cf, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    cone.position.y = -17;
    g.add(cone);
    const spot = new THREE.SpotLight(0xfff2c0, 900, 60, 0.35, 0.5, 1.2);
    spot.position.set(0, -1, 0);
    g.add(spot);
    g.userData.spot = spot;
    g.position.set(30, 42, 30);
    this.scene.add(g);
    this.heli = g;
    this.heliLight = spot;
  }

  clearWanted() {
    this.heat = 0;
    this.setWanted(0);
  }

  update(dt, elapsed, playerPos, playerSpeed) {
    // Heat fades while Kai stays out of trouble.
    if (this.wanted > 0) {
      this.quietTimer += dt;
      if (this.quietTimer > CONFIG.wantedDecaySeconds) {
        this.heat = Math.max(0, this.heat - 25);
        const stars = Math.ceil(this.heat / 20);
        if (stars !== this.wanted) this.setWanted(stars);
        this.quietTimer = 0;
      }
    }
    // Cruisers chase: steer toward the player, ram, and get unstuck.
    for (const c of this.cops) {
      const dx = playerPos.x - c.mesh.position.x;
      const dz = playerPos.z - c.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(-dz, dx);
      let dy = targetYaw - c.mesh.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.mesh.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
      const speed = dist > 6 ? CONFIG.copChaseSpeed : 6;
      c.mesh.position.x += Math.cos(c.mesh.rotation.y) * speed * dt;
      c.mesh.position.z += -Math.sin(c.mesh.rotation.y) * speed * dt;
      for (const w of c.mesh.userData.wheels) w.rotation.x += speed * dt * 2.4;
      // Flash the light bar.
      if (c.mesh.userData.lightBar) {
        const on = Math.sin(elapsed * 10) > 0;
        c.mesh.userData.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
        c.mesh.userData.lightBar.userData.blue.material.color.setHex(on ? 0x113366 : 0x2266ff);
      }
    }
    // Helicopter circles above the player, searchlight tracking him.
    if (this.heli) {
      const a = elapsed * 0.35;
      this.heli.position.set(playerPos.x + Math.cos(a) * 26, 42 + Math.sin(elapsed * 0.7) * 2, playerPos.z + Math.sin(a) * 26);
      this.heli.userData.rotor.rotation.y = elapsed * 22;
      this.heli.lookAt(playerPos.x, 0, playerPos.z);
      this.heli.userData.spot.target.position.set(playerPos.x, 0, playerPos.z);
      this.heli.add(this.heli.userData.spot.target);
    }
  }
}
