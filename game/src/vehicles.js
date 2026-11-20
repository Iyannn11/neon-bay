// vehicles.js — cars for Neon Bay: the player's ride, the traffic and the
// cars to steal. A car body is extruded from a curved side profile (sloped
// nose and tail, bevelled edges) with glossy paint — never a plain box.
// Traffic cars follow the street grid in lanes and stop at the lights.

import * as THREE from 'three';
import { WORLD, CAR } from './config.js';

// A smooth car body: a side-profile shape (low nose, rising hood, cabin,
// sloping tail) extruded across the width, with a bevel that rounds the edges.
export function createCarMesh(colour, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: colour,
    metalness: 0.7,
    roughness: 0.28,
    envMapIntensity: 0.9,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x101c28,
    metalness: 0.85,
    roughness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.6, roughness: 0.5 });

  // Side profile, x = length axis (front at +x), y = up.
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0.25);
  s.lineTo(-2.05, 0.55);
  s.quadraticCurveTo(-1.9, 0.85, -1.4, 0.95); // tail deck
  s.lineTo(-0.7, 1.0);
  s.quadraticCurveTo(-0.2, 1.35, 0.35, 1.32); // cabin rise
  s.lineTo(0.9, 1.3);
  s.quadraticCurveTo(1.5, 1.05, 1.95, 0.8); // hood slope
  s.quadraticCurveTo(2.15, 0.55, 2.1, 0.25); // nose
  s.lineTo(2.1, 0.15);
  s.lineTo(-2.1, 0.15);
  s.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.7,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 3,
    steps: 1,
  });
  bodyGeo.translate(0, 0, -0.85);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  group.add(body);

  // Windshield + rear glass: thin curved panels laid on the cabin slope.
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.5), glassMat);
  windshield.position.set(0.45, 1.28, 0);
  windshield.rotation.z = -0.42;
  group.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.5), glassMat);
  rearGlass.position.set(-0.55, 1.26, 0);
  rearGlass.rotation.z = 0.5;
  group.add(rearGlass);

  // Wheels: dark cylinders with a lighter hub.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 0.8, roughness: 0.3 });
  const wheelPositions = [[1.35, 0.36, 0.85], [1.35, 0.36, -0.85], [-1.35, 0.36, 0.85], [-1.35, 0.36, -0.85]];
  const wheels = [];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, wy, wz);
    group.add(wheel);
    group.add(hub);
    wheels.push(wheel);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  for (const z of [-0.55, 0.55]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), headMat);
    head.position.set(2.12, 0.55, z);
    head.scale.set(0.5, 1, 1);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const z of [-0.55, 0.55]) {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), tailMat);
    tail.position.set(-2.12, 0.6, z);
    tail.scale.set(0.5, 1, 1);
    group.add(tail);
  }

  // A police car gets white doors and a light bar.
  if (opts.police) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.5, roughness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.86), doorMat);
    door.position.set(-0.1, 0.62, 0);
    group.add(door);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.2), trimMat);
    barBase.position.set(0.1, 1.45, 0);
    group.add(barBase);
    const redLens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    redLens.position.set(0.1, 1.52, 0.32);
    group.add(redLens);
    const blueLens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blueLens.position.set(0.1, 1.52, -0.32);
    group.add(blueLens);
    group.userData.lightBar = { red: redLens, blue: blueLens };
  }

  group.userData.wheels = wheels;
  return group;
}

// All streets in the grid, as axis-aligned segments, for traffic routing.
function streetLines() {
  const lines = [];
  for (let v = -160; v <= 160; v += 40) {
    lines.push({ axis: 'x', at: v, from: -180, to: 180 });
    lines.push({ axis: 'z', at: v, from: -180, to: 180 });
  }
  return lines;
}

export class TrafficSystem {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.cars = [];
    this.parked = [];
    this.lines = streetLines();
    this.lightTimer = 0;
    this.lightNorthSouth = true; // which axis has green
    this.colours = [0xc23b2e, 0x2e6ac2, 0xd8a928, 0x3a9a4a, 0x8a5ac2, 0xd8d8d8, 0x222528, 0x2ab2a0];
    this._spawnTraffic();
    this._spawnParked();
  }

  _randomStreetPoint() {
    const line = this.lines[Math.floor(this.rng.next() * this.lines.length)];
    const along = this.rng.range(line.from + 10, line.to - 10);
    const lane = this.rng.next() < 0.5 ? -3 : 3;
    if (line.axis === 'x') return { x: along, z: line.at + lane, axis: 'x', dir: this.rng.next() < 0.5 ? 1 : -1 };
    return { x: line.at + lane, z: along, axis: 'z', dir: this.rng.next() < 0.5 ? 1 : -1 };
  }

  _spawnTraffic() {
    for (let i = 0; i < CAR.trafficCount; i++) {
      const p = this._randomStreetPoint();
      const mesh = createCarMesh(this.colours[i % this.colours.length]);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(mesh);
      this.cars.push({
        mesh,
        x: p.x,
        z: p.z,
        axis: p.axis,
        dir: p.dir,
        speed: CAR.trafficSpeed * this.rng.range(0.8, 1.2),
        stopped: false,
      });
    }
  }

  _spawnParked() {
    // Parked cars along the kerbs, including the Comet GT mission car.
    const spots = [
      [80, -40, 0xe81e2a, 'comet'],
      [-40, 80, 0x2e6ac2, 'parked'],
      [120, -80, 0xd8a928, 'parked'],
      [-120, -40, 0x3a9a4a, 'parked'],
      [40, 120, 0xd8d8d8, 'parked'],
      [-80, 120, 0x2ab2a0, 'parked'],
    ];
    for (const [x, z, colour, kind] of spots) {
      const mesh = createCarMesh(colour);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = this.rng.range(0, Math.PI * 2);
      this.scene.add(mesh);
      this.parked.push({ mesh, x, z, kind, taken: false });
    }
  }

  // Simple AABB test against building colliders.
  _hitsBuilding(x, z, pad = 2.2) {
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad) return true;
    }
    return false;
  }

  update(dt, playerPos) {
    this.lightTimer += dt;
    if (this.lightTimer > 9) {
      this.lightTimer = 0;
      this.lightNorthSouth = !this.lightNorthSouth;
    }
    for (const car of this.cars) {
      // Stop at a red light when approaching an intersection.
      const nearCross = car.axis === 'x'
        ? Math.abs(((car.x % 40) + 40) % 40 - 20) < 6
        : Math.abs(((car.z % 40) + 40) % 40 - 20) < 6;
      const green = car.axis === 'x' ? !this.lightNorthSouth : this.lightNorthSouth;
      car.stopped = nearCross && !green;
      // Slow down for the car ahead.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car) continue;
        if (car.axis !== other.axis) continue;
        const along = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.z - car.z) * car.dir;
        const lateral = car.axis === 'x' ? Math.abs(other.z - car.z) : Math.abs(other.x - car.x);
        if (along > 0 && along < 9 && lateral < 3) { ahead = true; break; }
      }
      if (ahead) car.stopped = true;
      if (car.stopped) continue;
      const step = car.speed * dt;
      if (car.axis === 'x') {
        car.x += step * car.dir;
        if (car.x > 185) { car.x = -185; }
        if (car.x < -185) { car.x = 185; }
      } else {
        car.z += step * car.dir;
        if (car.z > 185) { car.z = -185; }
        if (car.z < -185) { car.z = 185; }
      }
      car.mesh.position.set(car.x, 0, car.z);
      // Spin the wheels.
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.y += (step / 0.36) * 0.2;
    }
    // Parked cars sit still; nothing to update.
  }

  // The nearest parked car within `radius` of a point, if any.
  nearestParked(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const car of this.parked) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  // Remove a parked car from the world (the player just stole it).
  takeParked(car) {
    car.taken = true;
    this.scene.remove(car.mesh);
    return car;
  }
}

// The player's car: speed, steering, handbrake, collisions.
export class PlayerCar {
  constructor(scene, mesh) {
    this.scene = scene;
    this.mesh = mesh;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.active = false;
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.active = true;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.scene.add(this.mesh);
  }

  remove() {
    this.active = false;
    this.scene.remove(this.mesh);
  }

  update(dt, steer, throttle, handbrake, colliders, traffic) {
    if (!this.active) return;
    const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
    if (throttle > 0) this.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.accel * 0.5 * dt;
    } else {
      this.speed *= Math.pow(0.4, dt);
    }
    if (this.speed > CAR.maxSpeed) this.speed = CAR.maxSpeed;
    if (this.speed < -CAR.maxReverse) this.speed = -CAR.maxReverse;
    const steerAmount = steer * CAR.steer * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 8);
    this.heading -= steerAmount * dt * (handbrake ? 1.6 : 1);
    this.speed *= Math.pow(grip, dt * 2);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    // Collide with buildings: stop dead and lose a little speed.
    let blocked = false;
    for (const c of colliders) {
      if (Math.abs(nx - c.x) < c.hx + 2 && Math.abs(nz - c.z) < c.hz + 2) { blocked = true; break; }
    }
    if (nx < -WORLD.halfSize - 15 || nx > WORLD.halfSize + 15 || nz < -WORLD.halfSize - 15 || nz > WORLD.halfSize + 15) {
      blocked = true;
    }
    if (blocked) {
      this.speed *= -0.25;
    } else {
      this.x = nx;
      this.z = nz;
    }
    // Bump traffic cars aside (and slow down).
    for (const car of traffic.cars) {
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < 4.4) {
        this.speed *= 0.6;
        const push = 4.4 - d;
        const ax = (car.x - this.x) / (d || 1);
        const az = (car.z - this.z) / (d || 1);
        car.x += ax * push;
        car.z += az * push;
        car.mesh.position.set(car.x, 0, car.z);
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Lean into the turn and spin the wheels.
    this.mesh.rotation.z = -steer * 0.05 * Math.min(1, Math.abs(this.speed) / 10);
    for (const wheel of this.mesh.userData.wheels) {
      wheel.rotation.y += (this.speed * dt / 0.36) * 0.2;
    }
  }
}
