// Neon Bay vehicles: curved extruded car bodies (never boxes), player driving,
// 20 traffic cars on the street grid, parked cars to steal, collisions.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, COLOURS, TUNING, SPAWNS } from './config.js';
import { getGlowTexture } from './city.js';

// A car body extruded from a curved side profile: sloped nose and tail,
// bevelled edges, glossy paint. The cabin is a darker glass greenhouse.
export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.7,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x10151f,
    roughness: 0.12,
    metalness: 0.9,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.6 });

  // Side profile (x = length, -2.4 rear to +2.4 front; y = height).
  const s = new THREE.Shape();
  s.moveTo(-2.35, 0.28);
  s.quadraticCurveTo(-2.45, 0.72, -1.7, 0.82);
  s.quadraticCurveTo(-0.9, 1.02, 0.1, 1.02);
  s.quadraticCurveTo(1.1, 1.0, 1.7, 0.78);
  s.quadraticCurveTo(2.4, 0.62, 2.42, 0.3);
  s.lineTo(2.3, 0.24);
  s.lineTo(-2.3, 0.24);
  s.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.14,
    bevelSegments: 3,
    steps: 1,
  });
  bodyGeo.translate(0, 0, -0.8);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  group.add(body);

  // Glasshouse.
  const c = new THREE.Shape();
  c.moveTo(-1.35, 0.78);
  c.quadraticCurveTo(-0.9, 1.06, 0, 1.06);
  c.quadraticCurveTo(0.85, 1.04, 1.15, 0.78);
  c.closePath();
  const cabGeo = new THREE.ExtrudeGeometry(c, {
    depth: 1.3,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  cabGeo.translate(0, 0, -0.65);
  const cabin = new THREE.Mesh(cabGeo, glass);
  group.add(cabin);

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10);
  hubGeo.rotateX(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.82], [1.5, -0.82], [-1.5, 0.82], [-1.5, -0.82]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(wx, 0.38, wz);
    group.add(wheel);
    group.add(hub);
    wheels.push(wheel);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a0, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xdd2222, emissiveIntensity: 1.0 });
  for (const wz of [0.55, -0.55]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.42), headMat);
    head.position.set(2.42, 0.52, wz);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.4), tailMat);
    tail.position.set(-2.42, 0.55, wz);
    group.add(tail);
  }

  let lightBar = null;
  let lightGlow = null;
  if (kind === 'police') {
    // White doors (readable at night) and a big red/blue light bar.
    const doorMat = new THREE.MeshStandardMaterial({ color: COLOURS.policeWhite, roughness: 0.35, metalness: 0.4 });
    for (const wz of [0.86, -0.86]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.06), doorMat);
      door.position.set(-0.1, 0.62, wz);
      group.add(door);
    }
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), trim);
    barBase.position.set(0.1, 1.14, 0);
    group.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff2222, emissiveIntensity: 2.2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0033cc, emissive: 0x2266ff, emissiveIntensity: 2.2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.5), redMat);
    red.position.set(0.1, 1.26, 0.28);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.5), blueMat);
    blue.position.set(0.1, 1.26, -0.28);
    group.add(blue);
    lightBar = { red, blue, redMat, blueMat, phase: 0 };
    lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0x8899ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    lightGlow.scale.set(4, 2.4, 1);
    lightGlow.position.set(0.1, 1.5, 0);
    group.add(lightGlow);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd23f, emissiveIntensity: 1.2 }),
    );
    sign.position.set(0, 1.16, 0);
    group.add(sign);
  }
  return { group, wheels, lightBar, lightGlow };
}

// Circle (x,z,r) against building AABBs: push the circle out, return the fix.
export function resolveCircle(x, z, r, colliders) {
  let nx = x;
  let nz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const pl = nx - b.minX;
        const pr = b.maxX - nx;
        const pt = nz - b.minZ;
        const pb = b.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.minX - r;
        else if (m === pr) nx = b.maxX + r;
        else if (m === pt) nz = b.minZ - r;
        else nz = b.maxZ + r;
      }
    }
  }
  return { x: nx, z: nz };
}

export function createVehicles(scene, rng, city) {
  const colliders = city.colliders;
  const streets = city.streets;
  const palette = [0x2e6fb0, 0xb03a2e, 0x7d7d84, 0x3a7d44, 0xc0c4cc, 0x8a5a2e, 0x5a3a7d, 0x2e8a8a];

  // Traffic: 20 cars on the grid. Each drives one street, turning at random.
  const traffic = [];
  for (let i = 0; i < TUNING.trafficCount; i++) {
    const kind = rng.next() < 0.12 ? 'taxi' : 'sedan';
    const color = kind === 'taxi' ? COLOURS.taxiYellow : palette[rng.int(0, palette.length - 1)];
    const mesh = makeCarMesh(color, kind);
    const street = streets[rng.int(0, streets.length - 1)];
    const along = rng.range(-190, 190);
    const horizontal = rng.next() < 0.5;
    const dir = rng.next() < 0.5 ? 1 : -1;
    const car = {
      mesh,
      x: horizontal ? along : street + 2.4,
      z: horizontal ? street + 2.4 : along,
      heading: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      // heading 0 = +x, PI/2 = +z, PI = -x, -PI/2 = -z.
      speed: rng.range(6, 10),
      targetSpeed: rng.range(7, 10),
      horizontal,
      dir,
      stopped: false,
    };
    mesh.group.position.set(car.x, 0, car.z);
    mesh.group.rotation.y = -car.heading;
    scene.add(mesh.group);
    traffic.push(car);
  }

  // Parked cars, including the Comet GT outside the casino.
  const parked = [];
  function addParked(x, z, heading, color, kind, name) {
    const mesh = makeCarMesh(color, kind || 'coupe');
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = -heading;
    scene.add(mesh.group);
    const car = { mesh, x, z, heading, speed: 0, parked: true, name: name || 'car' };
    parked.push(car);
    return car;
  }
  const cometGt = addParked(SPAWNS.cometGt.x, SPAWNS.cometGt.z, SPAWNS.cometGt.heading, COLOURS.playerYellow, 'coupe', 'Comet GT');
  addParked(-60, 88, Math.PI / 2, 0x3a7d44, 'sedan', 'car');
  addParked(60, -88, -Math.PI / 2, 0xb03a2e, 'sedan', 'car');
  addParked(-160, -52, 0, 0x2e6fb0, 'sedan', 'car');
  addParked(160, 52, Math.PI, 0xc0c4cc, 'sedan', 'car');
  addParked(20, -120, Math.PI / 2, 0x5a3a7d, 'sedan', 'car');

  // The player's car (created when they steal / enter one; starts as none).
  let playerCar = null;

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(game, car) {
    const idx = parked.indexOf(car);
    if (idx >= 0) parked.splice(idx, 1);
    playerCar = car;
    playerCar.parked = false;
    game.player.inCar = true;
    game.player.car = playerCar;
    return playerCar;
  }

  function exitCar(game) {
    if (!playerCar) return null;
    const car = playerCar;
    playerCar = null;
    game.player.inCar = false;
    game.player.car = null;
    parked.push(car);
    return car;
  }

  function update(dt, game) {
    // --- Traffic AI: drive the grid, turn at intersections, keep spacing.
    for (const car of traffic) {
      // Car ahead in the same lane slows us down.
      let ahead = null;
      let aheadD = 14;
      for (const other of traffic) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const forward = car.horizontal
          ? (car.dir > 0 ? dx : -dx)
          : (car.dir > 0 ? dz : -dz);
        const lateral = car.horizontal ? Math.abs(dz) : Math.abs(dx);
        if (forward > 0 && forward < aheadD && lateral < 3.5) {
          ahead = other;
          aheadD = forward;
        }
      }
      car.targetSpeed = ahead ? Math.max(0, ahead.speed - 1.5) : 9;
      car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      const step = car.speed * dt;
      if (car.horizontal) car.x += car.dir * step;
      else car.z += car.dir * step;
      // At an intersection, sometimes turn.
      const pos = car.horizontal ? car.x : car.z;
      const nearestStreet = Math.round(pos / 40) * 40;
      if (Math.abs(pos - nearestStreet) < step * 0.6 && Math.abs(nearestStreet) <= 200) {
        if (rng.next() < 0.3) {
          const turn = rng.next() < 0.5 ? 1 : -1;
          const newDir = turn;
          if (car.horizontal) {
            car.z = nearestStreet + 2.4 * newDir;
            car.horizontal = false;
            car.dir = newDir;
            car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            car.x = nearestStreet + 2.4 * newDir;
            car.horizontal = true;
            car.dir = newDir;
            car.heading = newDir > 0 ? 0 : Math.PI;
          }
        }
      }
      // Wrap around the city edge.
      if (car.x > 205) car.x = -205;
      if (car.x < -205) car.x = 205;
      if (car.z > 205) car.z = -205;
      if (car.z < -205) car.z = 205;
      car.mesh.group.position.set(car.x, 0, car.z);
      car.mesh.group.rotation.y = -car.heading;
      for (const w of car.mesh.wheels) w.rotation.z += car.speed * dt * 2.2;
    }

    // --- Player car physics.
    if (playerCar && game.player.inCar) {
      const p = game.player;
      const input = game.input;
      const fwd = input.forward();
      const steer = input.steer();
      const brake = input.handbrake();
      const accel = fwd * TUNING.carAccel;
      p.carSpeed += accel * dt;
      p.carSpeed -= p.carSpeed * TUNING.carDrag * dt;
      if (fwd === 0) p.carSpeed *= Math.max(0, 1 - dt * 1.2);
      if (brake) p.carSpeed *= Math.max(0, 1 - dt * 4);
      p.carSpeed = Math.max(-TUNING.carMaxReverse, Math.min(TUNING.carMaxSpeed, p.carSpeed));
      const turnRate = TUNING.carTurn * (brake ? TUNING.handbrakeTurn / TUNING.carTurn : 1) * Math.min(1, Math.abs(p.carSpeed) / 8);
      p.heading -= steer * turnRate * dt * Math.sign(p.carSpeed || 1);
      const nx = p.pos.x + Math.cos(p.heading) * p.carSpeed * dt;
      const nz = p.pos.z + Math.sin(p.heading) * p.carSpeed * dt;
      const fixed = resolveCircle(nx, nz, 2.1, colliders);
      if (fixed.x !== nx || fixed.z !== nz) {
        p.carSpeed *= 0.35;
        if (Math.abs(p.carSpeed) > 12) game.addWanted(0.2);
      }
      p.pos.x = fixed.x;
      p.pos.z = fixed.z;
      // Nudge traffic cars we hit.
      for (const car of traffic) {
        const d = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) * 0.5;
          car.x += ((car.x - p.pos.x) / d) * push;
          car.z += ((car.z - p.pos.z) / d) * push;
          p.carSpeed *= 0.7;
        }
      }
      playerCar.x = p.pos.x;
      playerCar.z = p.pos.z;
      playerCar.heading = p.heading;
      playerCar.mesh.group.position.set(p.pos.x, 0, p.pos.z);
      playerCar.mesh.group.rotation.y = -p.heading;
      for (const w of playerCar.mesh.wheels) w.rotation.z += p.carSpeed * dt * 2.2;
    }
  }

  return {
    traffic,
    parked,
    cometGt,
    get playerCar() {
      return playerCar;
    },
    nearestParked,
    enterCar,
    exitCar,
    update,
  };
}
