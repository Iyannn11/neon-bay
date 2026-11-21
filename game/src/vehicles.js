// Neon Bay — vehicles. Every car is built from many parts (low wide body,
// cabin with dark glass, hood and trunk, wheel arches, cylinder wheels with
// rims, glowing lights, spoiler on the sport) — never one box. Sport,
// sedan, taxi and police all read differently. Motorcycles lean into turns.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { makeGlowTexture, makeSignTexture } from './textures.js';

const CAR_DEFS = {
  sport: { body: 0xd21f3c, name: 'Comet Sport', top: 42, accel: 20, len: 4.6, spoiler: true },
  sedan: { body: 0x2d6a9f, name: 'Ocean Sedan', top: 34, accel: 15, len: 4.8, spoiler: false },
  taxi: { body: 0xf2c200, name: 'Bay Taxi', top: 32, accel: 14, len: 4.8, spoiler: false },
  police: { body: 0xe8e8e8, name: 'NBPD Cruiser', top: 36, accel: 18, len: 4.8, spoiler: false },
  van: { body: 0x2a9d8f, name: 'Bay Van', top: 30, accel: 12, len: 5.6, spoiler: false },
};

function makeWheel(r = 0.38) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.28, 14),
    new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95 }),
  );
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  // Bigger, brighter rim with a dark hub for depth.
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.2, metalness: 0.95 }),
  );
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.26, r * 0.26, 0.32, 8),
    new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4, metalness: 0.6 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

export function makeCarMesh(type) {
  const def = CAR_DEFS[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: def.body, roughness: 0.28, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.08, metalness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.7 });
  const L = def.len, W = 1.95;

  // Low wide main body with a slightly narrower upper beltline.
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.56, W), paint);
  body.position.y = 0.6;
  body.castShadow = true;
  g.add(body);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.82, 0.3, W * 0.92), paint);
  belt.position.y = 0.98;
  g.add(belt);
  // Dark lower skirt so the car sits on the road, not on stilts.
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.88, 0.2, W * 0.98), trim);
  skirt.position.y = 0.3;
  g.add(skirt);
  // Hood and trunk as separate SLOPED panels — a flat hood reads as a box.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 0.12, W * 0.9), paint);
  hood.position.set(L * 0.32, 0.94, 0);
  hood.rotation.z = -0.22;
  g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, 0.12, W * 0.9), paint);
  trunk.position.set(-L * 0.36, 0.94, 0);
  trunk.rotation.z = 0.16;
  g.add(trunk);
  // Sloped nose: the front fascia leans back instead of standing vertical.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, W * 0.88), paint);
  nose.position.set(L / 2 - 0.08, 0.56, 0);
  nose.rotation.z = -0.35;
  g.add(nose);
  // Cabin with dark glass all round.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.46, 0.62, W * 0.82), glass);
  cabin.position.set(-L * 0.04, 1.42, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.36, 0.08, W * 0.74), paint);
  roof.position.set(-L * 0.04, 1.76, 0);
  g.add(roof);
  // Sunroof: a glass strip in the roof.
  const sunroof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.18, 0.04, W * 0.5), glass);
  sunroof.position.set(-L * 0.04, 1.81, 0);
  g.add(sunroof);
  // Sloped windshield + rear glass: flat cabin glass reads as a black box.
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, W * 0.72), glass);
  windshield.position.set(L * 0.17, 1.48, 0);
  windshield.rotation.z = -0.5;
  g.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, W * 0.72), glass);
  rearGlass.position.set(-L * 0.25, 1.46, 0);
  rearGlass.rotation.z = 0.45;
  g.add(rearGlass);
  // Door seams + side skirts: the sides need panel lines, not one slab.
  for (const sx of [L * 0.08, -L * 0.14]) {
    for (const wz of [W / 2 + 0.01, -W / 2 - 0.01]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.03), trim);
      seam.position.set(sx, 0.74, wz);
      g.add(seam);
    }
  }
  for (const wz of [W / 2 + 0.01, -W / 2 - 0.01]) {
    const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 0.12, 0.05), trim);
    sideSkirt.position.set(0, 0.34, wz);
    g.add(sideSkirt);
  }
  // Van variant: tall boxy cargo body with a long glass band instead of a
  // low cabin — a completely different silhouette from the cars.
  if (type === 'van') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 1.15, W * 0.96), paint);
    cargo.position.set(-L * 0.12, 1.55, 0);
    cargo.castShadow = true;
    g.add(cargo);
    const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 0.4, W + 0.06), glass);
    band.position.set(-L * 0.12, 1.85, 0);
    g.add(band);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, W * 0.85), glass);
    windshield.position.set(L * 0.28, 1.45, 0);
    windshield.rotation.z = -0.25;
    g.add(windshield);
  }
  // Bumpers and side skirts.
  for (const sx of [L / 2 - 0.05, -L / 2 + 0.05]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, W * 0.96), trim);
    bumper.position.set(sx, 0.42, 0);
    g.add(bumper);
  }
  // Lower front lip under the bumper.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, W * 0.9), trim);
  lip.position.set(L / 2 - 0.02, 0.26, 0);
  g.add(lip);
  // Wheel arches: dark half-torus over each wheel, wheels tucked under the
  // body (not sticking out like discs).
  const wheels = [];
  for (const [wx, wz] of [[L * 0.32, W / 2 - 0.08], [L * 0.32, -W / 2 + 0.08], [-L * 0.32, W / 2 - 0.08], [-L * 0.32, -W / 2 + 0.08]]) {
    const wheel = makeWheel();
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
    wheels.push(wheel);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 6, 12, Math.PI), trim);
    arch.position.set(wx, 0.42, wz + (wz > 0 ? 0.06 : -0.06));
    arch.rotation.y = Math.PI / 2;
    g.add(arch);
  }
  // Headlights: wider glowing bars + a light strip across the nose.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });
  const glowTex = makeGlowTexture('rgba(255,246,207,0.9)', 'rgba(255,246,207,0)');
  for (const wz of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.62), headMat);
    hl.position.set(L / 2 + 0.02, 0.78, wz);
    g.add(hl);
    // Additive glow sprite so the headlight reads as ON, not painted.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff6cf, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(L / 2 + 0.25, 0.78, wz);
    glow.scale.set(0.9, 0.9, 1);
    g.add(glow);
  }
  // A thin glowing strip across the nose, under the hood edge.
  const noseStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, W * 0.7), headMat);
  noseStrip.position.set(L / 2 + 0.04, 0.96, 0);
  g.add(noseStrip);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, W * 0.85), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tail.position.set(-L / 2 - 0.02, 0.78, 0);
  g.add(tail);
  // Exhaust pipes: twin chrome cylinders under the rear bumper.
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.25, metalness: 0.9 });
  for (const wz of [-0.45, 0.45]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), exhaustMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-L / 2 - 0.15, 0.35, wz);
    g.add(pipe);
  }
  // Grille + mirrors.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, W * 0.6), trim);
  grille.position.set(L / 2 + 0.02, 0.5, 0);
  g.add(grille);
  for (const wz of [W / 2 + 0.12, -W / 2 - 0.12]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), trim);
    mirror.position.set(L * 0.18, 1.2, wz);
    g.add(mirror);
  }
  // Sport spoiler; taxi sign; police light bar.
  if (def.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, W * 0.9), trim);
    wing.position.set(-L / 2 + 0.1, 1.32, 0);
    g.add(wing);
    for (const wz of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), trim);
      strut.position.set(-L / 2 + 0.1, 1.12, wz);
      g.add(strut);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe45c }));
    sign.position.set(-L * 0.04, 1.92, 0);
    g.add(sign);
    const checker = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    checker.position.set(0, 0.86, W / 2 + 0.01);
    g.add(checker);
  }
  let lightBar = null;
  if (type === 'police') {
    // Black doors + white body: two-tone by painting the middle band black.
    const doors = new THREE.Mesh(new THREE.BoxGeometry(L * 0.44, 0.5, W + 0.04), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.4 }));
    doors.position.set(-L * 0.04, 0.72, 0);
    g.add(doors);
    // POLICE door decals: white glowing letters on a dark plate, both sides.
    const policeTex = makeSignTexture('POLICE', '#ffffff');
    for (const wz of [W / 2 + 0.04, -W / 2 - 0.04]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: policeTex }));
      decal.position.set(-L * 0.04, 0.72, wz);
      if (wz < 0) decal.rotation.y = Math.PI;
      g.add(decal);
    }
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(0, 0, 0.35);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0, 0, -0.35);
    lightBar.add(red, blue);
    lightBar.position.set(-L * 0.04, 1.92, 0);
    lightBar.userData = { red, blue };
    g.add(lightBar);
  }
  g.userData = { def, wheels, lightBar, type };
  return g;
}

export function makeBikeMesh(sport) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: sport ? 0xc2142e : 0x2d6a9f, roughness: 0.3, metalness: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7 });
  // Two thin wheels.
  const wheels = [];
  for (const wx of [0.85, -0.85]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 14), trim);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, 0);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Frame, tank, seat, fenders.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.22), trim);
  frame.position.y = 0.62;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), paint);
  tank.scale.set(1.5, 0.8, 0.8);
  tank.position.set(0.25, 0.82, 0);
  tank.castShadow = true;
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.3), trim);
  seat.position.set(-0.45, 0.78, 0);
  g.add(seat);
  for (const wx of [0.85, -0.85]) {
    const fender = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 6, 10, Math.PI), paint);
    fender.position.set(wx, 0.36, 0);
    fender.rotation.y = Math.PI / 2;
    g.add(fender);
  }
  // Handlebar + headlight + tail.
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), trim);
  bars.rotation.x = Math.PI / 2;
  bars.position.set(0.85, 1.0, 0);
  g.add(bars);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6cf }));
  lamp.position.set(1.02, 0.85, 0);
  g.add(lamp);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.2), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tail.position.set(-1.02, 0.8, 0);
  g.add(tail);
  g.userData = { wheels, sport };
  return g;
}

// ---- Traffic: cars loop around the blocks, brake at red lights, keep lanes.
export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(4242);
    this.cars = [];
    // A rectangular loop around each block ring, plus the highway ring.
    this.loops = [];
    for (const r of [32, 96, 160, 224]) {
      this.loops.push([
        { x: -r, z: -r }, { x: r, z: -r }, { x: r, z: r }, { x: -r, z: r },
      ]);
    }
    const types = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'sedan', 'taxi', 'police'];
    for (let i = 0; i < 14; i++) {
      const type = types[i % types.length];
      const mesh = makeCarMesh(type);
      const loop = this.loops[i % this.loops.length];
      const seg = Math.floor(this.rng() * 4);
      const t = this.rng();
      const a = loop[seg], b = loop[(seg + 1) % 4];
      mesh.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
      mesh.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      scene.add(mesh);
      this.cars.push({
        mesh, type, loop, seg, t, speed: range(this.rng, 8, 13),
        lane: (this.rng() - 0.5) * 4,
      });
    }
  }

  // One shared stoplight rule: cars slow near the plaza corners on red.
  update(dt, playerPos) {
    for (const c of this.cars) {
      const loop = c.loop;
      const a = loop[c.seg], b = loop[(c.seg + 1) % 4];
      const dx = b.x - a.x, dz = b.z - a.z;
      const segLen = Math.hypot(dx, dz);
      let target = c.speed;
      // Brake for a red light near a plaza corner.
      for (const tl of this.world.trafficLights) {
        if (tl.state === 'red') {
          const d = Math.hypot(c.mesh.position.x - tl.red.position.x, c.mesh.position.z - tl.red.position.z);
          if (d < 16) target = 0;
        }
      }
      // Brake for the player in front.
      const pd = Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z);
      if (pd < 7) target = 0;
      c.t += (target * dt) / segLen;
      if (c.t >= 1) { c.t = 0; c.seg = (c.seg + 1) % 4; }
      const na = loop[c.seg], nb = loop[(c.seg + 1) % 4];
      const nx = na.x + (nb.x - na.x) * c.t;
      const nz = na.z + (nb.z - na.z) * c.t;
      // Lane offset perpendicular to travel.
      const px = -(nb.z - na.z) / segLen, pz = (nb.x - na.x) / segLen;
      c.mesh.position.set(nx + px * c.lane, 0, nz + pz * c.lane);
      c.mesh.rotation.y = Math.atan2(-(nb.z - na.z), nb.x - na.x);
      // Wheel spin.
      for (const w of c.mesh.userData.wheels) w.rotation.x += target * dt * 2.4;
    }
  }
}

export { CAR_DEFS };
