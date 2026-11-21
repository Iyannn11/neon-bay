// Neon Bay — vehicles: drivable cars and motorcycles plus street traffic.
// Cars steer, accelerate and brake; bikes lean into turns and wobble gently.
// Traffic cars cruise the street grid, turn at intersections and brake for
// the car ahead. Every vehicle has a condition meter: crashes wear it down
// and a wrecked car barely moves.

import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, range, int, pick, clamp, angleLerp, angleDiff } from './random.js';

const CAR_COLORS = [0xd23c2e, 0x2e6fd2, 0xe8e8e8, 0x2a2d36, 0x7a4fd2, 0x2e9e6b, 0xd28a2e];
const TRAFFIC_COLORS = [0x8a8f99, 0x3a5a8a, 0x6b3a3a, 0x2e6b4a, 0xb8b0a0, 0x4a4a55];

let wheelGeo = null;
let wheelMat = null;
function sharedWheel() {
  if (!wheelGeo) {
    wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 });
  }
  return { wheelGeo, wheelMat };
}

export class Vehicle {
  constructor(scene, kind, color, x, z, heading) {
    this.scene = scene;
    this.kind = kind; // 'sport' | 'sedan' | 'taxi' | 'cop' | 'bike' | 'cruiser'
    this.isBike = kind === 'bike' || kind === 'cruiser';
    this.color = color;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.speed = 0;
    this.steer = 0;
    this.condition = 100;
    this.driver = null; // 'player' | 'traffic' | null
    this.doorOpen = 0;
    this._build();
    scene.add(this.group);
  }

  _build() {
    const { wheelGeo, wheelMat } = sharedWheel();
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.35, metalness: 0.55 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.12, metalness: 0.7 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.2, metalness: 0.95 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    this.wheels = [];

    if (this.isBike) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 1.8), bodyMat);
      frame.position.y = 0.62; frame.castShadow = true;
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.6), bodyMat);
      tank.position.set(0, 0.82, 0.15);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 }));
      seat.position.set(0, 0.78, -0.45);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), chromeMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.02, 0.62);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lightMat);
      head.position.set(0, 0.78, 0.95);
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.5), bodyMat);
      fender.position.set(0, 0.62, 0.85);
      this.group.add(frame, tank, seat, bar, head, fender);
      for (const z of [0.78, -0.78]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.scale.set(1, 1, 0.55);
        w.position.set(0, 0.34, z);
        w.castShadow = true;
        this.group.add(w);
        this.wheels.push(w);
      }
      return;
    }

    // car body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
    body.position.y = 0.55; body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.52, 2.1), glassMat);
    cabin.position.set(0, 1.06, -0.25); cabin.castShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.9), bodyMat);
    hood.position.set(0, 0.86, 1.5);
    this.group.add(body, cabin, hood);
    // headlights + taillights
    for (const sx of [-0.62, 0.62]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
      h.position.set(sx, 0.62, 2.11);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
      t.position.set(sx, 0.62, -2.11);
      this.group.add(h, t);
    }
    // driver door (left side, hinged at the front edge)
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-0.96, 0.62, 0.85);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 1.05), bodyMat);
    door.position.set(0, 0.12, -0.5);
    door.castShadow = true;
    this.doorPivot.add(door);
    this.group.add(this.doorPivot);
    // wheels
    for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.34, wz);
      w.castShadow = true;
      this.group.add(w);
      this.wheels.push(w);
    }
    if (this.kind === 'cop') {
      const barMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.5 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), barMat);
      bar.position.set(0, 1.38, -0.25);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
      red.position.set(-0.28, 1.48, -0.25);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      blue.position.set(0.28, 1.48, -0.25);
      this.copLights = [red, blue];
      this.group.add(bar, red, blue);
    }
    if (this.kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      sign.position.set(0, 1.42, -0.25);
      this.group.add(sign);
    }
  }

  setDoorOpen(a) {
    this.doorOpen = a;
    if (this.doorPivot) this.doorPivot.rotation.y = a * 1.1;
  }

  seatPos() {
    const p = new THREE.Vector3(-0.45, 0.7, 0.3);
    return this.group.localToWorld(p);
  }

  doorPos() {
    const p = new THREE.Vector3(-1.5, 0, 0.6);
    return this.group.localToWorld(p);
  }

  exitPos() {
    const p = new THREE.Vector3(-2.4, 0, 0.6);
    return this.group.localToWorld(p);
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  damage(amount) {
    this.condition = clamp(this.condition - amount, 0, 100);
  }

  get topSpeed() {
    const base = this.kind === 'sport' ? 34 : this.isBike ? 40 : this.kind === 'cop' ? 32 : 26;
    const worn = this.condition < 25 ? 0.45 : this.condition < 60 ? 0.75 : 1;
    return base * worn;
  }

  get accelRate() {
    return this.isBike ? 26 : this.kind === 'sport' ? 22 : 15;
  }

  // Player driving. input: {throttle (-1..1), steer (-1..1)}
  drive(dt, input, world, others) {
    const maxF = this.topSpeed;
    const maxR = 9;
    if (input.throttle > 0) this.speed += this.accelRate * dt * input.throttle;
    else if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= 34 * dt; // brake
      else this.speed += this.accelRate * 0.6 * dt * input.throttle; // reverse
    } else {
      // engine braking / drag
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    }
    this.speed = clamp(this.speed, -maxR, maxF);
    const spd01 = clamp(Math.abs(this.speed) / maxF, 0, 1);
    const steerTarget = input.steer * (this.isBike ? 0.85 : 0.62) * (1 - spd01 * 0.45);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 7);
    this.heading += this.steer * (this.speed / 8) * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward();
    this.group.position.addScaledVector(f, this.speed * dt);
    this.group.rotation.y = this.heading;
    // bike lean + gentle wobble
    if (this.isBike) {
      const lean = -this.steer * spd01 * 0.55 + Math.sin(performance.now() * 0.007) * 0.02 * spd01;
      this.group.rotation.z = lean;
    }
    // wheels spin
    const spin = (this.speed * dt) / 0.34;
    for (const w of this.wheels) w.rotation.x += spin;
    // collisions
    const p = this.group.position;
    const c = world.collide(p.x, p.z, this.isBike ? 0.9 : 1.7);
    if (c.hit) {
      if (Math.abs(this.speed) > 4) {
        this.damage(Math.abs(this.speed) * 0.9);
        this.speed *= -0.22;
      } else {
        this.speed *= 0.4;
      }
      p.x = c.x; p.z = c.z;
    }
    for (const o of others) {
      if (o === this) continue;
      const d = Math.hypot(o.group.position.x - p.x, o.group.position.z - p.z);
      if (d < 3.2 && d > 0.01) {
        const push = (3.2 - d) / 2;
        const nx = (p.x - o.group.position.x) / d, nz = (p.z - o.group.position.z) / d;
        p.x += nx * push; p.z += nz * push;
        if (Math.abs(this.speed) > 5) this.damage(4);
        this.speed *= 0.6;
      }
    }
    return Math.abs(this.speed);
  }
}

export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(777);
    this.cars = [];
    const spots = [
      [-64, -128, 0], [64, 64, Math.PI / 2], [128, -64, Math.PI], [-128, 192, -Math.PI / 2],
      [0, 128, 0], [192, 0, Math.PI / 2], [-192, -64, Math.PI], [64, -192, 0],
      [-64, 256, Math.PI / 2], [256, 128, Math.PI], [128, 192, -Math.PI / 2], [-256, -128, 0],
    ];
    for (const [x, z, h] of spots) {
      const v = new Vehicle(scene, 'sedan', pick(this.rng, TRAFFIC_COLORS), x, z, h);
      v.driver = 'traffic';
      v._target = this._nextTarget(v.group.position.x, v.group.position.z, h);
      v._speed = range(this.rng, 8, 12);
      this.cars.push(v);
    }
    // the taxi waits at the plaza stand
    this.taxi = new Vehicle(scene, 'taxi', 0xffc400, 24, 20, Math.PI / 2);
    this.taxi.driver = null;
    this.cars.push(this.taxi);
  }

  _nextTarget(x, z, heading) {
    // pick a neighbouring intersection on the grid
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dz] = pick(this.rng, dirs);
    return {
      x: clamp(x + dx * 64, -256, 256),
      z: clamp(z + dz * 64, -256, 256),
    };
  }

  update(dt, playerPos) {
    for (const v of this.cars) {
      if (v.driver === 'player') continue; // the player drives it now, not the AI
      if (v === this.taxi && v.driver === null) continue; // parked taxi
      const p = v.group.position;
      const dx = v._target.x - p.x, dz = v._target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 5) {
        v._target = this._nextTarget(p.x, p.z, v.heading);
        continue;
      }
      const want = Math.atan2(dx, dz);
      const diff = angleDiff(v.heading, want);
      v.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
      // brake for the car ahead
      let speed = v._speed;
      for (const o of this.cars) {
        if (o === v) continue;
        const odx = o.group.position.x - p.x, odz = o.group.position.z - p.z;
        const od = Math.hypot(odx, odz);
        if (od < 8 && od > 0.01) {
          const ahead = (odx * Math.sin(v.heading) + odz * Math.cos(v.heading)) / od;
          if (ahead > 0.6) { speed = 0; break; }
        }
      }
      if (playerPos) {
        const pd = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
        if (pd < 7) speed = Math.min(speed, 2);
      }
      const f = v.forward();
      p.addScaledVector(f, speed * dt);
      v.group.rotation.y = v.heading;
      const spin = (speed * dt) / 0.34;
      for (const w of v.wheels) w.rotation.x += spin;
      // stay on the road: snap back if pushed off-grid
      const rp = this.world.nearestRoadPoint(p.x, p.z);
      const off = Math.hypot(p.x - rp.x, p.z - rp.z);
      if (off > 9) { p.x = rp.x; p.z = rp.z; }
    }
  }

  allVehicles() { return this.cars; }
}
