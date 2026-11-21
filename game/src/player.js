// Neon Bay — Kai Reyes. A real person, not a dark capsule: proper
// proportions, a coloured jacket, separate arms and legs that swing,
// a cap, and a chrome SMG that catches the light. A fill light keeps him
// readable at night instead of a black silhouette.
import * as THREE from 'three';
import { CONFIG, OUTFITS } from './config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'kai';
    this.yaw = Math.PI * 0.75;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, 0, 14);
    this.vel = new THREE.Vector3();
    this.onGround = true;
    this.health = 100;
    this.armor = 0;
    this.money = 500;
    this.outfit = 0;
    this.weaponIndex = 1; // SMG
    this.ammo = { pistol: 48, smg: 128, shotgun: 24 };
    this.mag = { pistol: 12, smg: 32, shotgun: 6 };
    this.reloading = false;
    this.fireCooldown = 0;
    this.inVehicle = null;
    this.walkPhase = 0;
    this.moving = false;
    this.aiming = false;

    this.buildMesh();
    scene.add(this.group);

    // Fill light: a soft light that follows Kai so he never reads as a
    // black silhouette against the night city.
    this.fill = new THREE.PointLight(0xbfd4ff, 22, 14, 1.6);
    this.fill.position.set(0, 3, 0);
    this.group.add(this.fill);
  }

  buildMesh() {
    const outfit = OUTFITS[this.outfit];
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
    const jacket = new THREE.MeshStandardMaterial({ color: outfit.jacket, roughness: 0.75 });
    const pants = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 });
    const capMat = new THREE.MeshStandardMaterial({ color: outfit.cap, roughness: 0.8 });
    // Keep the three outfit materials so changeOutfit can recolour them.
    this.jacketMat = jacket;
    this.pantsMat = pants;
    this.capMat = capMat;
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.15, metalness: 1.0 });

    // Legs: separate pivots at the hip so they swing.
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]]) {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), pants);
      thigh.position.y = -0.25;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.2), pants);
      shin.position.y = -0.68;
      leg.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.34), shoe);
      foot.position.set(0, -0.92, 0.06);
      leg.add(foot);
      leg.position.set(side * 0.14, 0.95, 0);
      this.group.add(leg);
    }

    // Torso: jacket with a bright chest stripe.
    this.torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), jacket);
    chest.position.y = 0.32;
    chest.castShadow = true;
    this.torso.add(chest);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x222222 }));
    stripe.position.y = 0.45;
    this.torso.add(stripe);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.26), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 }));
    collar.position.y = 0.66;
    this.torso.add(collar);
    this.torso.position.y = 0.95;
    this.group.add(this.torso);

    // Arms: separate shoulder pivots.
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), jacket);
      upper.position.y = -0.21;
      arm.add(upper);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
      hand.position.y = -0.48;
      arm.add(hand);
      arm.position.set(side * 0.34, 0.58, 0);
      this.torso.add(arm);
    }

    // Head: skin sphere, hair cap, backwards neon cap.
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
    skull.position.y = 0.12;
    skull.castShadow = true;
    this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 }));
    hair.position.y = 0.14;
    this.head.add(hair);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.09, 12), capMat);
    cap.position.y = 0.3;
    this.head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.2), capMat);
    brim.position.set(0, 0.28, -0.24);
    this.head.add(brim);
    this.head.position.y = 0.78;
    this.torso.add(this.head);

    // Chrome SMG in the right hand: body, barrel, magazine, stock.
    this.smg = new THREE.Group();
    const smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), chrome);
    this.smg.add(smgBody);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.38);
    this.smg.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), chrome);
    mag.position.set(0, -0.16, 0.08);
    this.smg.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.18), chrome);
    stock.position.set(0, 0, -0.3);
    this.smg.add(stock);
    this.smg.position.set(0, -0.5, 0.16);
    this.armR.add(this.smg);

    this.group.position.copy(this.pos);
  }

  changeOutfit(index) {
    this.outfit = index;
    const outfit = OUTFITS[index];
    this.jacketMat.color.setHex(outfit.jacket);
    this.pantsMat.color.setHex(outfit.pants);
    this.capMat.color.setHex(outfit.cap);
  }

  // Called every frame while on foot: movement, gravity, walk cycle.
  updateOnFoot(dt, input, colliders, groundY = 0) {
    const sprint = input.sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (input.forward) move.add(fwd);
    if (input.back) move.sub(fwd);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);
    this.moving = move.lengthSq() > 0;
    if (this.moving) {
      move.normalize().multiplyScalar(sprint);
      this.vel.x = move.x;
      this.vel.z = move.z;
      this.walkPhase += dt * (input.sprint ? 13 : 9);
    } else {
      this.vel.x *= Math.max(0, 1 - dt * 10);
      this.vel.z *= Math.max(0, 1 - dt * 10);
    }
    if (input.jump && this.onGround) {
      this.vel.y = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    this.vel.y -= CONFIG.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    }
    // Keep inside the city + beach, out of the deep ocean.
    this.pos.x = Math.max(-272, Math.min(258, this.pos.x));
    this.pos.z = Math.max(-272, Math.min(272, this.pos.z));
    this.resolveCollisions(colliders);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.animate(dt);
    if (this.fireCooldown > 0) this.fireCooldown -= dt * 1000;
  }

  resolveCollisions(colliders) {
    const r = CONFIG.playerRadius;
    for (const c of colliders) {
      if (this.pos.x > c.minX - r && this.pos.x < c.maxX + r && this.pos.z > c.minZ - r && this.pos.z < c.maxZ + r) {
        const dxl = this.pos.x - (c.minX - r), dxr = (c.maxX + r) - this.pos.x;
        const dzl = this.pos.z - (c.minZ - r), dzr = (c.maxZ + r) - this.pos.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) this.pos.x = c.minX - r;
        else if (m === dxr) this.pos.x = c.maxX + r;
        else if (m === dzl) this.pos.z = c.minZ - r;
        else this.pos.z = c.maxZ + r;
      }
    }
  }

  animate(dt) {
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const breathe = Math.sin(performance.now() * 0.002) * 0.02;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    // Arms counter-swing; right arm holds the SMG forward when aiming.
    if (this.aiming) {
      this.armR.rotation.x = -Math.PI / 2 + 0.15;
      this.armL.rotation.x = -Math.PI / 2 + 0.3;
      this.torso.rotation.x = 0.08;
    } else {
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = swing * 0.8;
      this.torso.rotation.x = breathe;
    }
    // Idle breathing + slight head bob while running.
    this.torso.position.y = 0.95 + Math.abs(Math.sin(this.walkPhase)) * (this.moving ? 0.05 : 0) + breathe * 0.5;
    this.head.rotation.x = this.pitch * 0.4;
    // Recoil kick after firing.
    if (this.recoilT > 0) {
      this.recoilT -= dt;
      this.armR.rotation.x -= 0.25 * (this.recoilT / 0.12);
      this.torso.rotation.x -= 0.06 * (this.recoilT / 0.12);
    }
  }

  recoil() {
    this.recoilT = 0.12;
  }

  currentWeapon() {
    return ['pistol', 'smg', 'shotgun'][this.weaponIndex];
  }

  // Aim direction from the camera yaw/pitch.
  aimDir() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }
}
