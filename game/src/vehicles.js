// Neon Bay — vehicles: multi-part cars (never a plain box) and motorcycles,
// plus arcade driving physics and traffic AI that loops the city blocks.
// Written fresh for Round 12.
import * as THREE from 'three';
import { TUNING, PALETTE } from './config.js';
import { clamp, damp, angleLerp } from './random.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55, ...opts });
}
function glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0x0e1a24, roughness: 0.08, metalness: 0.9 });
}
function lightMat(color, on = true) {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: on ? 2.4 : 0.15 });
}

export function makeWheel(r = 0.38) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 14), std(0x0c0d10, { roughness: 0.95, metalness: 0 }));
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.32, 10), std(0xc8ccd4, { metalness: 0.9, roughness: 0.25 }));
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

// A proper car: sloped hood + nose, sloped glass cabin, sunroof, door lines,
// side skirts, spoiler, exhausts, light strips — built from many parts.
export function makeCar(kind = 'sport', color = 0xd21f3c) {
  const g = new THREE.Group();
  g.userData.kind = kind;
  const body = std(color);
  const dark = std(0x14181f, { roughness: 0.6, metalness: 0.3 });
  const isPolice = kind === 'police';
  const isTaxi = kind === 'taxi';
  const paint = isPolice ? std(PALETTE.policeWhite) : isTaxi ? std(PALETTE.taxiYellow) : body;

  // lower body (beveled look: main slab + sloped nose + sloped tail)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.62, 1.95), paint);
  slab.position.y = 0.62; g.add(slab);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 1.9), paint);
  nose.position.set(2.35, 0.55, 0); nose.rotation.z = -0.22; g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.46, 1.9), paint);
  tail.position.set(-2.3, 0.56, 0); tail.rotation.z = 0.18; g.add(tail);
  // side skirts + bumpers
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.08), dark);
    skirt.position.set(0, 0.34, s * 1.0); g.add(skirt);
  }
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 1.95), dark);
  bumpF.position.set(2.72, 0.42, 0); g.add(bumpF);
  const bumpR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 1.95), dark);
  bumpR.position.set(-2.62, 0.42, 0); g.add(bumpR);
  // cabin: sloped windshield + roof + sloped rear glass + sunroof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.7), glassMat());
  cabin.position.set(-0.25, 1.18, 0); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.62), paint);
  roof.position.set(-0.25, 1.5, 0); g.add(roof);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.66), glassMat());
  shield.position.set(0.85, 1.2, 0); shield.rotation.z = -0.5; g.add(shield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.66), glassMat());
  rearGlass.position.set(-1.32, 1.2, 0); rearGlass.rotation.z = 0.5; g.add(rearGlass);
  const sunroof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.1), glassMat());
  sunroof.position.set(-0.25, 1.56, 0); g.add(sunroof);
  // door lines (thin dark insets)
  for (const s of [-1, 1]) {
    for (const dx of [-0.7, 0.35]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), dark);
      line.position.set(dx, 0.85, s * 0.99); g.add(line);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.03), std(0xd8dce2, { metalness: 0.9, roughness: 0.2 }));
    handle.position.set(0.15, 1.0, s * 0.99); g.add(handle);
  }
  // headlights (glowing strip) + taillight bar
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 1.7), lightMat(0xfff2c8));
  head.position.set(2.82, 0.62, 0); g.add(head);
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.8), lightMat(0xff2e3c));
  tailLight.position.set(-2.74, 0.66, 0); g.add(tailLight);
  // spoiler + exhausts on sport
  if (kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 1.8), dark);
    wing.position.set(-2.5, 1.12, 0); wing.rotation.z = 0.12; g.add(wing);
    for (const s of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), dark);
      strut.position.set(-2.5, 0.95, s); g.add(strut);
    }
  }
  for (const s of [-0.5, 0.5]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 8), std(0x8a8f96, { metalness: 0.9, roughness: 0.3 }));
    ex.rotation.z = Math.PI / 2; ex.position.set(-2.8, 0.32, s); g.add(ex);
  }
  // police / taxi extras
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.1), dark);
    bar.position.set(-0.25, 1.62, 0); g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.5), lightMat(0xff2e3c));
    r.position.set(-0.25, 1.72, -0.28); g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.5), lightMat(0x2e7dff));
    b.position.set(-0.25, 1.72, 0.28); g.add(b);
    g.userData.lightR = r; g.userData.lightB = b;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.2, 1.97), std(0x14181f));
    stripe.position.y = 0.85; g.add(stripe);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), lightMat(0xffc233));
    sign.position.set(-0.25, 1.66, 0); g.add(sign);
  }
  // wheels, tucked into arches
  g.userData.wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const w = makeWheel(kind === 'sport' ? 0.42 : 0.38);
    w.position.set(wx, 0.4, wz);
    g.add(w);
    g.userData.wheels.push(w);
  }
  // headlight beam (visible at night)
  const beam = new THREE.SpotLight(0xfff2c8, 0, 26, 0.5, 0.5, 1.2);
  beam.position.set(2.7, 0.7, 0);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(12, 0, 0);
  g.add(beamTarget);
  beam.target = beamTarget;
  g.add(beam);
  g.userData.beam = beam;
  g.userData.speed = 0;
  g.userData.steer = 0;
  g.userData.hp = 100;
  return g;
}

export function makeBike(color = 0x1f6fd2) {
  const g = new THREE.Group();
  g.userData.kind = 'bike';
  const paint = std(color, { roughness: 0.3, metalness: 0.6 });
  const dark = std(0x14181f);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.55), paint);
  tank.position.set(0.1, 0.95, 0); g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.5), dark);
  seat.position.set(-0.75, 0.95, 0); g.add(seat);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.2), dark);
  frame.position.set(0, 0.7, 0); g.add(frame);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), std(0xc8ccd4, { metalness: 0.9 }));
  fork.position.set(0.85, 0.85, 0); fork.rotation.z = -0.5; g.add(fork);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.85), dark);
  bars.position.set(1.05, 1.3, 0); g.add(bars);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lightMat(0xfff2c8));
  head.position.set(1.0, 1.05, 0); g.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), lightMat(0xff2e3c));
  tail.position.set(-1.15, 0.9, 0); g.add(tail);
  g.userData.wheels = [];
  for (const wx of [0.95, -0.95]) {
    const w = makeWheel(0.36);
    w.position.set(wx, 0.36, 0);
    g.add(w);
    g.userData.wheels.push(w);
  }
  const beam = new THREE.SpotLight(0xfff2c8, 0, 20, 0.5, 0.5, 1.2);
  beam.position.set(1.0, 1.0, 0);
  const bt = new THREE.Object3D(); bt.position.set(10, 0, 0);
  g.add(bt); beam.target = bt; g.add(beam);
  g.userData.beam = beam;
  g.userData.speed = 0;
  g.userData.hp = 100;
  return g;
}

// --- driving ---------------------------------------------------------------
export class Driver {
  constructor(vehicle, isPlayer = false) {
    this.v = vehicle;
    this.isPlayer = isPlayer;
    this.speed = 0;
    this.heading = 0;
    this.pos = new THREE.Vector3();
  }

  // throttle -1..1, steer -1..1, dt seconds. Arcade model with smooth accel.
  step(throttle, steer, dt, world) {
    const max = this.v.userData.kind === 'bike' ? TUNING.bikeMax : TUNING.carMax;
    const accel = this.v.userData.kind === 'bike' ? TUNING.bikeAccel : TUNING.carAccel;
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) this.speed += (this.speed > 0.5 ? -TUNING.carBrake : TUNING.carAccel * 0.7) * dt;
    else this.speed = damp(this.speed, 0, 1.6, dt);
    this.speed = clamp(this.speed, -TUNING.carReverse, max);
    const turnRate = TUNING.carTurn * clamp(Math.abs(this.speed) / 8, 0.25, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading += steer * turnRate * dt;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    // stay in the world + don't drive through buildings
    if (Math.abs(nx) < 165 && Math.abs(nz) < 165 && !(nx > 168 && this.speed > 0) && !world.isBlocked(nx, nz, 1.6)) {
      this.pos.x = nx; this.pos.z = nz;
    } else {
      this.speed *= 0.4;
    }
    this.v.position.set(this.pos.x, 0, this.pos.z);
    this.v.rotation.y = this.heading;
    // lean into turns (bike leans hard, cars a touch)
    const lean = this.v.userData.kind === 'bike' ? -steer * clamp(Math.abs(this.speed) / 20, 0, 1) * 0.45 : -steer * 0.05;
    this.v.rotation.z = damp(this.v.rotation.z, lean, 8, dt);
    // spin wheels
    for (const w of this.v.userData.wheels) w.rotation.x += (this.speed / 0.38) * dt;
    // headlights at night
    if (this.v.userData.beam) this.v.userData.beam.intensity = this.night ? 55 : 0;
  }
}

// --- traffic AI ---------------------------------------------------------------
export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    const kinds = ['sedan', 'sedan', 'van', 'sport', 'taxi'];
    const colors = [0x3a7bd5, 0xd8d8d8, 0x2f8a6a, 0xd21f3c, 0x8a5a2e, 0x4a4a55];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const kind = kinds[i % kinds.length];
      const car = makeCar(kind === 'van' ? 'sedan' : kind, colors[i % colors.length]);
      if (kind === 'van') car.scale.set(1.15, 1.25, 1.05);
      scene.add(car);
      const loop = world.trafficLoops[i % world.trafficLoops.length];
      const d = new Driver(car);
      d.loop = loop;
      d.seg = i % loop.length;
      d.t = Math.random();
      d.speed = 7 + Math.random() * 5;
      d.pos.copy(loop[d.seg]);
      this.cars.push(d);
    }
  }

  step(dt) {
    for (const d of this.cars) {
      const loop = d.loop;
      const a = loop[d.seg], b = loop[(d.seg + 1) % loop.length];
      const target = new THREE.Vector3().lerpVectors(a, b, d.t);
      const dx = target.x - d.pos.x, dz = target.z - d.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      d.heading = angleLerp(d.heading, want, clamp(4 * dt, 0, 1));
      d.speed = damp(d.speed, 9, 1, dt);
      d.pos.x += Math.sin(d.heading) * d.speed * dt;
      d.pos.z += Math.cos(d.heading) * d.speed * dt;
      if (dist < 1.2) { d.seg = (d.seg + 1) % loop.length; d.t = 0; }
      else d.t = clamp(d.t + (d.speed * dt) / Math.max(1, a.distanceTo(b)), 0, 1);
      d.v.position.set(d.pos.x, 0, d.pos.z);
      d.v.rotation.y = d.heading;
      for (const w of d.v.userData.wheels) w.rotation.x += (d.speed / 0.38) * dt;
    }
  }
}
