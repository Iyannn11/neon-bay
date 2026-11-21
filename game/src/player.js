// Neon Bay — Kai Reyes, the player character. A jointed figure (legs, torso,
// arms, head, chrome SMG) driven by a small animation state machine: idle
// breathing, walk and run cycles, jump tuck, two-handed aim, recoil, and a
// scripted walk-to-door / sit-down car entry. Movement is smooth: velocity
// ramps up and down and the body turns toward the travel direction.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, PLAYER, WEAPONS, OUTFITS } from './config.js';
import { clamp, angleLerp } from './random.js';

const SKINS = [0xf2c9a0, 0xd9a06b, 0x8a5a3b];
const HAIRS = [0x1a1a1a, 0x2a1a0a, 0x4a2f18];

export class Player {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.group = new THREE.Group();
    this.group.position.set(8, 0, 8);
    this.heading = Math.PI * 0.75;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.onGround = true;
    this.health = 100;
    this.armor = 0;
    this.cash = 100;
    this.outfit = 0;
    this.weapon = 'smg';
    this.ammo = { pistol: 48, smg: 96, shotgun: 18 };
    this.mag = { pistol: 12, smg: 32, shotgun: 6 };
    this.aiming = false;
    this.recoil = 0;
    this.walkPhase = 0;
    this.moveSpeed = 0;
    this.inVehicle = null;
    this.entering = null;   // {vehicle, t, from:Vector3, doorPos:Vector3}
    this.exiting = null;
    this.dead = false;
    this._buildMesh();
    scene.add(this.group);
  }

  _buildMesh() {
    const o = OUTFITS[this.outfit];
    const skin = SKINS[Math.floor(this.rng() * SKINS.length)];
    const hairC = HAIRS[Math.floor(this.rng() * HAIRS.length)];
    const jacketMat = new THREE.MeshStandardMaterial({ color: o.jacket, roughness: 0.75 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: o.pants, roughness: 0.85 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: o.shoes, roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });
    this.mats = { jacketMat, pantsMat, shirtMat, skinMat, shoeMat, hairMat };

    // legs pivot at the hip (geometry translated down from the joint)
    const legGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.85, 8);
    legGeo.translate(0, -0.425, 0);
    this.legL = new THREE.Mesh(legGeo, pantsMat);
    this.legL.position.set(-0.14, 0.86, 0);
    this.legR = new THREE.Mesh(legGeo, pantsMat);
    this.legR.position.set(0.14, 0.86, 0);
    // shoes
    const shoeGeo = new THREE.BoxGeometry(0.16, 0.09, 0.3);
    shoeGeo.translate(0, -0.85, 0.05);
    this.legL.add(new THREE.Mesh(shoeGeo, shoeMat));
    this.legR.add(new THREE.Mesh(shoeGeo, shoeMat));
    this.legL.castShadow = this.legR.castShadow = true;

    // torso (jacket) + shirt panel on the chest
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.75, 10);
    this.torso = new THREE.Mesh(torsoGeo, jacketMat);
    this.torso.position.y = 1.22;
    this.torso.castShadow = true;
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.06), shirtMat);
    shirt.position.set(0, 1.24, 0.24);
    this.torso.add(shirt);

    // arms pivot at the shoulder
    const armGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.68, 8);
    armGeo.translate(0, -0.34, 0);
    this.armL = new THREE.Mesh(armGeo, jacketMat);
    this.armL.position.set(-0.36, 1.55, 0);
    this.armR = new THREE.Mesh(armGeo, jacketMat);
    this.armR.position.set(0.36, 1.55, 0);
    const handGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.armL.add(new THREE.Mesh(handGeo, skinMat));
    this.armL.children[0].position.set(0, -0.68, 0);
    this.armR.add(new THREE.Mesh(handGeo, skinMat));
    this.armR.children[0].position.set(0, -0.68, 0);
    this.armL.castShadow = this.armR.castShadow = true;

    // head + hair
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), skinMat);
    this.head.position.y = 1.84;
    this.head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 0.04;
    this.head.add(hair);

    // chrome SMG in the right hand — bright steel so it reads against the jacket
    this.smg = new THREE.Group();
    this.smg.scale.setScalar(1.3); // slightly oversized so the chrome reads
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.22, metalness: 0.95 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.5), chrome);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.36);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), darkMetal);
    mag.position.set(0, -0.16, 0.05);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), darkMetal);
    grip.position.set(0, -0.12, -0.16);
    grip.rotation.x = 0.3;
    this.smg.add(body, barrel, mag, grip);
    this.smg.position.set(0, -0.72, 0.08);
    this.smg.rotation.x = Math.PI / 2 - 0.15; // barrel forward when the arm points ahead
    this.armR.add(this.smg);

    this.group.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head);
    this.group.rotation.y = this.heading;
  }

  setOutfit(i) {
    this.outfit = ((i % OUTFITS.length) + OUTFITS.length) % OUTFITS.length;
    const o = OUTFITS[this.outfit];
    this.mats.jacketMat.color.setHex(o.jacket);
    this.mats.pantsMat.color.setHex(o.pants);
    this.mats.shirtMat.color.setHex(o.shirt);
    this.mats.shoeMat.color.setHex(o.shoes);
  }

  get pos() { return this.group.position; }

  takeDamage(amount) {
    if (this.dead) return false;
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
      return true;
    }
    return false;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  // Begin the scripted car entry: walk to the door, door swings, sit down.
  startEnter(vehicle, doorPos) {
    this.entering = { vehicle, t: 0, from: this.pos.clone(), doorPos: doorPos.clone() };
  }

  startExit(exitPos) {
    this.exiting = { t: 0, to: exitPos.clone() };
    this.inVehicle = null;
    this.group.visible = true;
  }

  // Per-frame pose. mode: 'idle' | 'walk' | 'run' | 'air' | 'aim' | 'enter'
  _pose(dt, mode, speed01) {
    const u = this;
    // on foot the weapon is in hand again (ridePose hides it on a bike)
    u.smg.visible = true;
    // ease the recoil back to zero
    u.recoil = Math.max(0, u.recoil - dt * 6);
    const breathe = Math.sin(performance.now() * 0.0016) * 0.02;
    if (mode === 'idle') {
      u.walkPhase += dt * 1.2;
      const s = Math.sin(u.walkPhase) * 0.04;
      u.legL.rotation.x = s; u.legR.rotation.x = -s;
      u.armL.rotation.x = -s * 1.2; u.armR.rotation.x = s * 1.2;
      u.torso.position.y = 1.22 + breathe;
      u.torso.rotation.x = 0;
      u.head.rotation.x = 0;
    } else if (mode === 'walk' || mode === 'run') {
      const freq = mode === 'run' ? 11 : 7.5;
      const amp = mode === 'run' ? 0.85 : 0.55;
      u.walkPhase += dt * freq * (0.6 + speed01 * 0.6);
      const s = Math.sin(u.walkPhase);
      u.legL.rotation.x = s * amp;
      u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * (mode === 'run' ? 0.75 : 0.45);
      u.armR.rotation.x = s * (mode === 'run' ? 0.75 : 0.45);
      u.torso.rotation.x = mode === 'run' ? 0.16 : 0.05;
      u.torso.position.y = 1.22 + Math.abs(Math.cos(u.walkPhase)) * 0.045;
      u.head.rotation.x = mode === 'run' ? -0.08 : 0;
    } else if (mode === 'air') {
      // jump: front leg tucked up, back leg trailing, arms out for balance
      u.legL.rotation.x = -0.95;
      u.legR.rotation.x = 0.55;
      u.armL.rotation.x = -0.9; u.armL.rotation.z = 0.35;
      u.armR.rotation.x = -0.9; u.armR.rotation.z = -0.35;
      u.torso.rotation.x = 0.08;
    }
    if (mode === 'aim' || u.aiming) {
      // two-handed aim: both arms forward, SMG level, slight crouch
      u.armR.rotation.x = -1.42 - u.recoil * 0.35;
      u.armR.rotation.z = -0.08;
      u.armL.rotation.x = -1.3;
      u.armL.rotation.z = 0.35;
      u.torso.rotation.x = 0.06;
      u.head.rotation.x = -0.04;
    } else if (mode !== 'air') {
      u.armL.rotation.z = 0;
      u.armR.rotation.z = 0;
    }
  }

  update(dt, move, wantJump, world) {
    // move: {x, z} camera-relative, already normalized; wantJump edge
    if (this.entering) {
      const e = this.entering;
      e.t += dt;
      const v = e.vehicle;
      if (e.t < 0.55) {
        // walk to the door
        const k = clamp(e.t / 0.55, 0, 1);
        this.pos.lerpVectors(e.from, e.doorPos, k);
        this.heading = angleLerp(this.heading, Math.atan2(e.doorPos.x - e.from.x, e.doorPos.z - e.from.z) || this.heading, dt * 8);
        this.group.rotation.y = this.heading;
        this._pose(dt, 'walk', 0.6);
        v.setDoorOpen(clamp(e.t / 0.55, 0, 1) * 0.9);
      } else if (e.t < 1.05) {
        // step in and sit: sink into the seat, door swings shut
        const k = clamp((e.t - 0.55) / 0.5, 0, 1);
        this.pos.lerpVectors(e.doorPos, v.seatPos(), k);
        this.group.rotation.y = angleLerp(this.group.rotation.y, v.group.rotation.y, dt * 8);
        v.setDoorOpen(0.9 * (1 - k));
        this._pose(dt, 'idle', 0);
      } else {
        this.entering = null;
        this.inVehicle = v;
        this.group.visible = false;
        v.setDoorOpen(0);
      }
      return;
    }
    if (this.exiting) {
      const e = this.exiting;
      e.t += dt;
      const k = clamp(e.t / 0.45, 0, 1);
      this.pos.lerpVectors(this.pos.clone(), e.to, k);
      if (e.t >= 0.45) this.exiting = null;
      this._pose(dt, 'walk', 0.5);
      return;
    }
    if (this.dead) return;

    const speed = this.aiming ? PLAYER.walkSpeed * 0.55 : PLAYER.walkSpeed;
    const maxSpeed = this._sprinting ? PLAYER.sprintSpeed : (Math.hypot(move.x, move.z) > 0.1 ? speed : 0);
    const target = new THREE.Vector3(move.x, 0, move.z).multiplyScalar(maxSpeed);
    // smooth accel / decel — never stops dead
    const rate = (move.x || move.z) ? PLAYER.accel : PLAYER.decel;
    this.vel.x += clamp(target.x - this.vel.x, -rate * dt, rate * dt);
    this.vel.z += clamp(target.z - this.vel.z, -rate * dt, rate * dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // gravity + jump
    if (wantJump && this.onGround) {
      this.vy = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    this.vy -= WORLD.gravity * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }

    // collide with buildings (circle push-out)
    const c = world.collide(this.pos.x, this.pos.z, PLAYER.radius);
    this.pos.x = c.x; this.pos.z = c.z;
    // stay inside the map
    this.pos.x = clamp(this.pos.x, -316, 316);
    this.pos.z = clamp(this.pos.z, -316, 316);

    // face the travel direction, smoothly
    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.moveSpeed = spd;
    if (spd > 0.6) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      this.heading = angleLerp(this.heading, want, dt * PLAYER.turnRate);
    }
    if (this.aiming) this.heading = this._aimHeading ?? this.heading;
    this.group.rotation.y = this.heading;

    const speed01 = clamp(spd / PLAYER.runSpeed, 0, 1);
    const mode = !this.onGround ? 'air' : this.aiming ? 'aim' : spd > 7 ? 'run' : spd > 0.6 ? 'walk' : 'idle';
    this._pose(dt, mode, speed01);
  }

  // Sitting pose on a motorcycle: legs bent to the pegs, both hands on the bars.
  ridePose(dt) {
    this.smg.visible = false; // the gun is holstered while riding
    this.legL.rotation.x = -1.15;
    this.legR.rotation.x = -1.05;
    this.armL.rotation.x = -1.05;
    this.armL.rotation.z = 0.22;
    this.armR.rotation.x = -1.05;
    this.armR.rotation.z = -0.22;
    this.torso.rotation.x = 0.22;
    this.torso.position.y = 1.2;
  }

  // Muzzle world position + forward direction for shooting.
  muzzle() {
    const p = new THREE.Vector3();
    this.smg.getWorldPosition(p);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
    dir.y = this._aimPitch ?? 0;
    dir.normalize();
    return { origin: p, dir };
  }

  get weaponDef() { return WEAPONS[this.weapon]; }
}
