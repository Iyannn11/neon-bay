// Neon Bay — cars: mesh factory, arcade driving physics, traffic AI and
// collisions. A car is a THREE group plus a small state object; the player
// car, traffic and police all share this module.

import * as THREE from 'three';
import { WORLD, COLOURS, CAR } from './config.js';
import { pick, range } from './random.js';

export function createCarMesh(colour, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.35, metalness: 0.55,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x18242e, roughness: 0.15, metalness: 0.7,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glass);
  cabin.position.set(0, 1.3, -0.3);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c9, emissive: 0xffe9a0, emissiveIntensity: 0.9,
  });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    head.position.set(hx, 0.7, 2.22);
    group.add(head);
  }
  let lightBar = null;
  if (isPolice) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
    barBase.position.set(0, 1.72, -0.3);
    group.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), redMat);
    red.position.set(-0.35, 1.78, -0.3);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), blueMat);
    blue.position.set(0.35, 1.78, -0.3);
    group.add(blue);
    lightBar = { redMat, blueMat, phase: 0 };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.42),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

export function makeCarState(mesh, kind, colour) {
  return {
    mesh,
    kind,
    colour,
    heading: 0,
    speed: 0,
    steer: 0,
    // Traffic AI fields.
    axis: 'ns',
    lane: 3.5,
    direction: 1,
    targetSpeed: CAR.trafficSpeed,
    stopped: false,
    // Police fields.
    flashPhase: 0,
    stuckTimer: 0,
  };
}

// Circle (x, z, radius) vs building AABBs. Pushes the position out and
// returns true when a wall was hit.
export function collideWithBuildings(pos, radius, colliders) {
  let hit = false;
  for (const box of colliders) {
    const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        pos.x = cx + (dx / dist) * radius;
        pos.z = cz + (dz / dist) * radius;
      } else {
        pos.x = box.maxX + radius;
      }
    }
  }
  return hit;
}

function clampToCity(pos) {
  const limit = WORLD.halfSize + 30;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

// Arcade player driving. Returns an event object when something notable
// happened this frame (wall hit, traffic hit, ...).
export function updatePlayerCar(car, dt, move, colliders, traffic, audio) {
  const events = { wallHit: false, trafficHit: false };
  const throttle = move.y;
  const steering = move.x;
  const handbrake = move.handbrake === true;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.7) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  const grip = handbrake ? 1.9 : 1;
  const targetSteer = steering * CAR.steerMax;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  car.heading += car.steer * speedFactor * (car.speed >= 0 ? 1 : -1) * dt * 2.1 * grip;
  const forwardX = Math.sin(car.heading);
  const forwardZ = Math.cos(car.heading);
  car.mesh.position.x += forwardX * car.speed * dt;
  car.mesh.position.z += forwardZ * car.speed * dt;
  clampToCity(car.mesh.position);
  if (collideWithBuildings(car.mesh.position, CAR.radius, colliders)) {
    if (Math.abs(car.speed) > 8) events.wallHit = true;
    car.speed *= 0.45;
  }
  // Bump into traffic cars.
  for (const other of traffic) {
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.4 && dist > 0.01) {
      const push = (3.4 - dist) / 2;
      const nx = dx / dist;
      const nz = dz / dist;
      car.mesh.position.x -= nx * push;
      car.mesh.position.z -= nz * push;
      other.mesh.position.x += nx * push;
      other.mesh.position.z += nz * push;
      if (Math.abs(car.speed) > 6) {
        events.trafficHit = true;
        other.speed = Math.max(0, other.speed - 3);
      }
      car.speed *= 0.8;
    }
  }
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.mesh.userData.wheels) {
    wheel.rotation.x += (car.speed * dt) / 0.42;
  }
  if (audio) audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed);
  return events;
}

export function spawnTraffic(scene, rng, count, avoidPos) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const colour = pick(rng, COLOURS.carPalette);
    const mesh = createCarMesh(colour, false);
    const axis = rng() < 0.5 ? 'ns' : 'ew';
    const road = WORLD.roads[Math.floor(rng() * WORLD.roads.length)];
    const direction = rng() < 0.5 ? 1 : -1;
    const lane = direction > 0 ? 3.5 : -3.5;
    const along = range(rng, -200, 200);
    if (axis === 'ns') mesh.position.set(road + lane, 0, along);
    else mesh.position.set(along, 0, road + lane);
    const heading = axis === 'ns' ? (direction > 0 ? 0 : Math.PI) : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = makeCarState(mesh, 'traffic', colour);
    car.axis = axis;
    car.lane = lane;
    car.direction = direction;
    car.heading = heading;
    car.speed = range(rng, 8, CAR.trafficSpeed);
    car.targetSpeed = car.speed;
    if (avoidPos && Math.hypot(mesh.position.x - avoidPos.x, mesh.position.z - avoidPos.z) < 25) {
      mesh.position.x += 60;
      mesh.position.z += 60;
    }
    cars.push(car);
  }
  return cars;
}

function nearestIntersectionCoord(value) {
  let best = WORLD.roads[0];
  let bestDist = Math.abs(value - best);
  for (const road of WORLD.roads) {
    const d = Math.abs(value - road);
    if (d < bestDist) {
      bestDist = d;
      best = road;
    }
  }
  return { coord: best, dist: bestDist };
}

export function updateTraffic(cars, dt, time, city) {
  for (const car of cars) {
    const pos = car.mesh.position;
    // Am I approaching an intersection? If my light is red, stop at the line.
    const along = car.axis === 'ns' ? pos.z : pos.x;
    const cross = car.axis === 'ns' ? pos.x : pos.z;
    const next = nearestIntersectionCoord(along + car.direction * 12);
    let wantSpeed = car.targetSpeed;
    if (next.dist < 12) {
      const ix = WORLD.roads.indexOf(Math.round(cross / 60) * 60);
      const iz = WORLD.roads.indexOf(next.coord);
      const green = city.trafficLightGreen(car.axis, Math.max(0, ix), Math.max(0, iz), time);
      if (!green) wantSpeed = 0;
    }
    // Slow down for a car ahead in the same lane.
    for (const other of cars) {
      if (other === car || other.axis !== car.axis || other.lane !== car.lane) continue;
      const otherAlong = other.axis === 'ns' ? other.mesh.position.z : other.mesh.position.x;
      const gap = (otherAlong - along) * car.direction;
      if (gap > 0 && gap < 10) wantSpeed = Math.min(wantSpeed, other.speed * 0.8);
    }
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
    if (car.speed < 0.2 && wantSpeed === 0) car.speed = 0;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    pos.x += fx * car.speed * dt;
    pos.z += fz * car.speed * dt;
    // Wrap around the city edge and sometimes turn at an intersection.
    const edge = WORLD.halfSize + 25;
    if (Math.abs(pos.x) > edge || Math.abs(pos.z) > edge) {
      if (car.axis === 'ns') pos.z = -Math.sign(pos.z) * edge;
      else pos.x = -Math.sign(pos.x) * edge;
    }
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.mesh.userData.wheels) {
      wheel.rotation.x += (car.speed * dt) / 0.42;
    }
  }
}

export function findNearestCar(pos, cars, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}
