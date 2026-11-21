// Neon Bay — vehicles: smooth cars and the traffic that drives them.
//
// One clear job: build cars that look like cars — curved extruded bodies with
// bevels, glass cabins, real wheels — and drive the traffic AI: cars that
// follow the road grid, change lanes, brake at lights, and dodge the player.

import * as THREE from 'three';
import { VEHICLE_TYPES, WORLD } from './config.js';
import { range, pick, chance, clamp, angleLerp, dist2D } from './random.js';

const HALF = WORLD.size / 2;

// A smooth car body: an extruded side profile with a bevel, so the silhouette
// is curved and the edges catch the light — never a plain box.
function carBodyShape(len, hgt) {
  const s = new THREE.Shape();
  const l = len / 2;
  s.moveTo(-l, 0.35);
  s.lineTo(-l + 0.4, 0.62);
  s.quadraticCurveTo(-l + 1.1, 0.95, -l + 1.9, 1.0);
  s.lineTo(l - 1.6, 1.0);
  s.quadraticCurveTo(l - 0.7, 0.9, l - 0.25, 0.62);
  s.lineTo(l, 0.35);
  s.quadraticCurveTo(l - 0.1, 0.12, l - 0.5, 0.1);
  s.lineTo(-l + 0.5, 0.1);
  s.quadraticCurveTo(-l + 0.1, 0.12, -l, 0.35);
  return s;
}

function cabinShape(len) {
  const s = new THREE.Shape();
  const l = len / 2;
  s.moveTo(-l * 0.55, 0);
  s.quadraticCurveTo(-l * 0.42, 0.62, -l * 0.18, 0.66);
  s.lineTo(l * 0.28, 0.66);
  s.quadraticCurveTo(l * 0.5, 0.6, l * 0.58, 0);
  s.lineTo(-l * 0.55, 0);
  return s;
}

export function buildCarMesh(type, colorOverride) {
  const def = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  const color = colorOverride ?? def.color;
  const group = new THREE.Group();
  const isTruck = type === 'truck';
  const len = isTruck ? 7.2 : type === 'comet' ? 4.6 : 4.9;
  const wid = isTruck ? 2.4 : 2.0;

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.12, metalness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5, metalness: 0.4 });

  if (isTruck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, wid), paint);
    bed.position.set(-1.2, 0.85, 0);
    bed.castShadow = true;
    group.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, wid), paint);
    cab.position.set(2.2, 1.25, 0);
    cab.castShadow = true;
    group.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, wid - 0.3), glass);
    shield.position.set(3.15, 1.6, 0);
    group.add(shield);
  } else {
    const bodyGeo = new THREE.ExtrudeGeometry(carBodyShape(len, 1.0), {
      depth: wid - 0.24, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 3, curveSegments: 12,
    });
    bodyGeo.translate(0, 0, -(wid - 0.24) / 2);
    const body = new THREE.Mesh(bodyGeo, paint);
    body.castShadow = true;
    group.add(body);
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape(len), {
      depth: wid - 0.7, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 10,
    });
    cabinGeo.translate(0, 0.95, -(wid - 0.7) / 2);
    const cabin = new THREE.Mesh(cabinGeo, glass);
    cabin.castShadow = true;
    group.add(cabin);
    // Spoiler for the sports cars.
    if (type === 'comet' || type === 'coupe') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, wid - 0.3), trim);
      spoiler.position.set(-len / 2 + 0.15, 1.22, 0);
      group.add(spoiler);
    }
  }

  // Headlights + taillights: small emissive lenses with a glow sprite.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), headMat);
    head.position.set(len / 2 - 0.02, 0.62, side * (wid / 2 - 0.42));
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), tailMat);
    tail.position.set(-len / 2 + 0.02, 0.66, side * (wid / 2 - 0.42));
    group.add(tail);
  }

  // Wheels: dark cylinders with a bright hubcap disc.
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.25, metalness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 14), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), hubMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  // Taxi sign.
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd23e, emissiveIntensity: 1.2 }));
    sign.position.set(0, 1.85, 0);
    group.add(sign);
  }
  // Police light bar.
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.3), trim);
    bar.position.set(-0.2, 1.78, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 2 }));
    red.position.set(-0.2, 1.9, 0.32);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.position.set(-0.2, 1.9, -0.32);
    group.add(blue);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    door.position.set(0.1, 0.7, -(wid / 2 + 0.01));
    group.add(door);
  }

  // The body is built with its length along local X; turn the whole car so
  // its length lies along local Z, which is the direction the game drives
  // (forward = +Z at heading 0). Without this the car drives sideways.
  const outer = new THREE.Group();
  outer.add(group);
  group.rotation.y = -Math.PI / 2;
  outer.userData.wheels = wheels;
  outer.userData.length = len;
  outer.userData.width = wid;
  return outer;
}

export class Vehicle {
  constructor(type, x, z, heading) {
    this.type = type;
    this.def = VEHICLE_TYPES[type];
    this.mesh = buildCarMesh(type);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0; // m/s, forward
    this.steer = 0;
    this.wheelSpin = 0;
    this.stolen = false;
    this.health = 100;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Arcade driving: throttle, steering that tightens with speed, handbrake drift.
  drive(dt, throttle, steer, boost, brake, colliders, others) {
    const top = this.def.topSpeed * (boost ? 1.22 : 1) / 3.6;
    const accel = this.def.accel;
    if (throttle > 0) this.speed += accel * dt * throttle;
    if (throttle < 0) this.speed += accel * 0.7 * dt * throttle;
    if (brake) this.speed *= Math.max(0, 1 - 3.2 * dt);
    // Drag + rolling resistance.
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = clamp(this.speed, -top * 0.35, top);
    const steerTarget = steer * this.def.grip * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed < 0 ? -1 : 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 6);
    this.heading += this.steer * dt * (this.speed >= 0 ? 1 : -1) * (brake ? 1.5 : 1);
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    // Stay inside the city.
    nx = clamp(nx, -HALF + 8, HALF - 8);
    nz = clamp(nz, -HALF + 8, HALF - 8);
    // Building collision: slide along the wall, lose speed.
    if (this._hitsCollider(nx, nz, colliders)) {
      if (!this._hitsCollider(this.x, nz, colliders)) nx = this.x;
      else if (!this._hitsCollider(nx, this.z, colliders)) nz = this.z;
      else { nx = this.x; nz = this.z; }
      this.speed *= 0.45;
    }
    // Soft push from other cars.
    for (const o of others) {
      if (o === this) continue;
      const d = dist2D(nx, nz, o.x, o.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) * 0.5;
        nx += ((nx - o.x) / d) * push;
        nz += ((nz - o.z) / d) * push;
        this.speed *= 0.92;
      }
    }
    this.mesh.position.x = nx;
    this.mesh.position.z = nz;
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += this.speed * dt * 2.6;
    for (const w of this.mesh.userData.wheels) w.rotation.z = this.wheelSpin;
    // Body roll + pitch for feel.
    this.mesh.rotation.z = -this.steer * 0.06 * clamp(Math.abs(this.speed) / 12, 0, 1);
    this.mesh.rotation.x = clamp(-throttle * this.speed * 0.0012, -0.03, 0.03);
  }

  _hitsCollider(x, z, colliders) {
    const m = 1.6;
    for (const c of colliders) {
      if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return true;
    }
    return false;
  }
}

// ---- Traffic AI ----
export class Traffic {
  constructor(scene, world, rng) {
    this.world = world;
    this.rng = rng;
    this.cars = [];
    const types = ['sedan', 'sedan', 'taxi', 'coupe', 'truck', 'sedan'];
    for (let i = 0; i < WORLD.trafficCount; i += 1) {
      const p = world.randomRoadPoint(rng);
      const vertical = Math.abs(p.x % 64) < 1;
      const heading = vertical ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = new Vehicle(pick(rng, types), p.x + range(rng, -2.5, 2.5), p.z + range(rng, -2.5, 2.5), heading);
      car.cruise = range(rng, 7, 12);
      car.lane = chance(rng, 0.5) ? 1 : -1;
      car.wait = 0;
      scene.add(car.mesh);
      this.cars.push(car);
    }
    this.lightTimer = 0;
    this.lightGreen = true;
  }

  update(dt, playerVehicle, colliders) {
    this.lightTimer += dt;
    if (this.lightTimer > 9) {
      this.lightTimer = 0;
      this.lightGreen = !this.lightGreen;
    }
    for (const car of this.cars) {
      if (car === playerVehicle) continue;
      const f = car.forward();
      // Look ahead: brake for a car or the player in front, or a red light.
      let wantSpeed = car.cruise;
      const aheadX = car.x + f.x * 9;
      const aheadZ = car.z + f.z * 9;
      const nearIntersection = Math.abs(((car.x + 32) % 64) - 32) < 9 || Math.abs(((car.z + 32) % 64) - 32) < 9;
      if (nearIntersection && !this.lightGreen) wantSpeed = 0;
      for (const o of this.cars) {
        if (o === car) continue;
        if (dist2D(aheadX, aheadZ, o.x, o.z) < 6) { wantSpeed = 0; break; }
      }
      if (playerVehicle && dist2D(aheadX, aheadZ, playerVehicle.x, playerVehicle.z) < 7) wantSpeed = 0;
      // Lane change: if blocked, drift to the other lane.
      if (wantSpeed === 0 && chance(this.rng, dt * 0.4)) car.lane *= -1;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.4);
      // Follow the road: snap gently back to the lane line.
      const vertical = Math.abs(Math.sin(car.heading)) < 0.5;
      const roadCoord = vertical ? car.x : car.z;
      const roads = this.world.roads;
      let nearest = roads[0];
      let best = Infinity;
      for (const r of roads) {
        const d = Math.abs(roadCoord - r);
        if (d < best) { best = d; nearest = r; }
      }
      const target = nearest + car.lane * 3.4;
      const correction = clamp((target - roadCoord) * 0.5, -0.5, 0.5);
      const desiredHeading = vertical
        ? (Math.cos(car.heading) > 0 ? 0 : Math.PI) + correction * 0.12
        : (Math.sin(car.heading) > 0 ? Math.PI / 2 : -Math.PI / 2) + correction * 0.12;
      car.heading = angleLerp(car.heading, desiredHeading, Math.min(1, dt * 1.6));
      // Random turn at an intersection.
      const onIntersection = Math.abs(((car.x + 32) % 64) - 32) < 2 && Math.abs(((car.z + 32) % 64) - 32) < 2;
      if (onIntersection && chance(this.rng, dt * 0.5)) {
        car.heading += pick(this.rng, [-Math.PI / 2, Math.PI / 2]);
      }
      const nf = car.forward();
      let nx = car.x + nf.x * car.speed * dt;
      let nz = car.z + nf.z * car.speed * dt;
      nx = clamp(nx, -HALF + 8, HALF - 8);
      nz = clamp(nz, -HALF + 8, HALF - 8);
      car.mesh.position.x = nx;
      car.mesh.position.z = nz;
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.z = car.wheelSpin;
    }
  }
}
