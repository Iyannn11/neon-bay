// Neon Bay — Kai Reyes: a proper low-poly humanoid (never a black silhouette),
// with walk/run cycles, idle breathing, aim stance and recoil, plus combat.
// Written fresh for Round 12.
import * as THREE from 'three';
import { TUNING, WEAPONS } from './config.js';
import { clamp, damp } from './random.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
}

export function makeKai(jacketColor = 0x0fa3a3) {
  const g = new THREE.Group();
  g.userData.jacketColor = jacketColor;
  const skin = std(0xc98d64);
  const jacket = std(jacketColor, { roughness: 0.7 });
  const pants = std(0x1c2733);
  const shoes = std(0xf2f2f2);
  const cap = std(0xff2e88);
  // legs (pivot at hip for swing)
  g.userData.legL = new THREE.Group(); g.userData.legL.position.set(0, 0.95, 0.14);
  g.userData.legR = new THREE.Group(); g.userData.legR.position.set(0, 0.95, -0.14);
  for (const [leg, s] of [[g.userData.legL, 1], [g.userData.legR, -1]]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.26), pants);
    thigh.position.y = -0.25; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), pants);
    shin.position.y = -0.7; leg.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), shoes);
    shoe.position.set(0.05, -0.95, 0); leg.add(shoe);
    g.add(leg);
  }
  // torso: jacket + chest stripe + collar
  const torso = new THREE.Group(); torso.position.y = 0.95;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.72), jacket);
  chest.position.y = 0.31; torso.add(chest);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.74), std(0xffffff));
  stripe.position.y = 0.42; torso.add(stripe);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.76), std(0x11141a));
  collar.position.y = 0.66; torso.add(collar);
  g.add(torso);
  g.userData.torso = torso;
  // arms (pivot at shoulder)
  g.userData.armL = new THREE.Group(); g.userData.armL.position.set(0.1, 1.52, 0.42);
  g.userData.armR = new THREE.Group(); g.userData.armR.position.set(0.1, 1.52, -0.42);
  for (const arm of [g.userData.armL, g.userData.armR]) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), jacket);
    upper.position.y = -0.17; arm.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.32, 0.17), skin);
    fore.position.y = -0.48; arm.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), skin);
    hand.position.y = -0.68; arm.add(hand);
    g.add(arm);
  }
  // head: skin + cap + hair + face
  const head = new THREE.Group(); head.position.y = 1.78;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), skin);
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, 1.4), std(0x1a1210));
  hair.position.y = 0.03; head.add(hair);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 12), cap);
  capTop.position.y = 0.2; head.add(capTop);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.34), cap);
  brim.position.set(0.26, 0.16, 0); head.add(brim);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), std(0x111111));
    eye.position.set(0.22, 0.02, s * 0.09); head.add(eye);
  }
  g.add(head);
  g.userData.head = head;
  // chrome SMG in the right hand (visible, never hidden)
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.09), std(0xd8dce2, { metalness: 0.9, roughness: 0.25 }));
  gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.09), std(0x11141a));
  grip.position.set(-0.12, -0.12, 0); gun.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.07), std(0x8a8f96, { metalness: 0.8 }));
  mag.position.set(0.05, -0.16, 0); gun.add(mag);
  gun.position.set(0.1, -0.68, 0);
  gun.visible = false;
  g.userData.armR.add(gun);
  g.userData.gun = gun;
  // fill light so Kai is never a black silhouette at night
  const fill = new THREE.PointLight(0xffe9c8, 6, 9, 1.6);
  fill.position.set(1.2, 2.2, 0.8);
  g.add(fill);
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makeKai();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 24); // plaza, clear of the fountain at (0,14)
    this.vel = new THREE.Vector3();
    this.heading = 0; // facing +z at spawn (toward plaza)
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.health = 100;
    this.armor = 0;
    this.money = 500;
    this.weaponIdx = 0;
    this.ammo = [12, 32, 6];
    this.reserve = [48, 96, 24];
    this.cooldown = 0;
    this.recoil = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.aiming = false;
    this.inVehicle = null; // Driver or null
    this.wanted = 0;
    this.outfit = 'teal';
  }

  get weapon() { return WEAPONS[this.weaponIdx]; }

  setOutfit(key, jacketColor) {
    this.outfit = key;
    const chest = this.mesh.userData.torso.children[0];
    chest.material = std(jacketColor, { roughness: 0.7 });
    for (const arm of [this.mesh.userData.armL, this.mesh.userData.armR]) {
      arm.children[0].material = std(jacketColor, { roughness: 0.7 });
    }
  }

  step(input, dt, world) {
    if (this.inVehicle) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = damp(this.recoil, 0, 10, dt);
    const sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    let fx = 0, fz = 0;
    if (input.keys['KeyW']) fz += 1;
    if (input.keys['KeyS']) fz -= 1;
    if (input.keys['KeyA']) fx -= 1;
    if (input.keys['KeyD']) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    // camera-relative movement (yaw faces the camera direction)
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = (fx * cos - fz * sin) * speed;
    const mz = (fx * sin + fz * cos) * speed;
    const tx = this.pos.x + mx * dt, tz = this.pos.z + mz * dt;
    if (!world.isBlocked(tx, this.pos.z, 0.5)) this.pos.x = tx;
    if (!world.isBlocked(this.pos.x, tz, 0.5)) this.pos.z = tz;
    this.pos.x = clamp(this.pos.x, -165, 235);
    this.pos.z = clamp(this.pos.z, -165, 165);
    // jump + gravity
    if (input.keys['Space'] && this.onGround) { this.vel.y = TUNING.jumpVel; this.onGround = false; }
    this.vel.y -= TUNING.gravity * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    this.moving = Math.hypot(mx, mz) > 0.5;
    if (this.moving) this.heading = Math.atan2(mx, mz);
    // walk/run animation
    const rate = sprint ? 13 : 9;
    this.walkPhase += dt * rate * (this.moving ? 1 : 0);
    const sw = this.moving ? Math.sin(this.walkPhase) * (sprint ? 0.75 : 0.55) : 0;
    this.mesh.userData.legL.rotation.x = sw;
    this.mesh.userData.legR.rotation.x = -sw;
    this.mesh.userData.armL.rotation.x = this.aiming ? -1.25 : -sw * 0.7;
    this.mesh.userData.armR.rotation.x = this.aiming ? -1.25 : sw * 0.7;
    // idle breathing
    const breathe = this.moving ? 0 : Math.sin(performance.now() * 0.002) * 0.03;
    this.mesh.userData.torso.position.y = 0.95 + breathe;
    this.mesh.userData.torso.rotation.x = this.aiming ? 0.12 : 0;
    this.mesh.userData.gun.visible = true;
    this.mesh.userData.gun.rotation.x = -this.recoil * 0.5;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // pitch the head slightly with camera pitch
    this.mesh.userData.head.rotation.x = clamp(-this.pitch * 0.3, -0.2, 0.2);
  }

  // returns a shot descriptor or null
  shoot() {
    if (this.cooldown > 0 || this.inVehicle) return null;
    const w = this.weapon;
    if (this.ammo[this.weaponIdx] <= 0) return { empty: true };
    this.ammo[this.weaponIdx]--;
    this.cooldown = w.rate;
    this.recoil = 1;
    return {
      weapon: w, pellets: w.pellets || 1,
      origin: new THREE.Vector3(this.pos.x, this.pos.y + 1.5, this.pos.z),
      dir: new THREE.Vector3(Math.sin(this.yaw), this.pitch, Math.cos(this.yaw)).normalize(),
    };
  }

  reload() {
    const w = this.weapon;
    const need = w.mag - this.ammo[this.weaponIdx];
    const take = Math.min(need, this.reserve[this.weaponIdx]);
    this.ammo[this.weaponIdx] += take;
    this.reserve[this.weaponIdx] -= take;
  }

  damage(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed; amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
  }
}
