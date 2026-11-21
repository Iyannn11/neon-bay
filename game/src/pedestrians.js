// Neon Bay — pedestrians and NPCs. Walkers cross the sidewalks, drivers
// cruise the streets, and eight named characters will talk to Kai when he
// walks up and presses E near them.
import * as THREE from 'three';
import { NPC_LINES } from './config.js';
import { mulberry32, pick, range } from './random.js';

const SHIRT_COLORS = [0xff5a3c, 0x2d9bff, 0xffd23e, 0x9df2c0, 0xc06bff, 0xffffff, 0x2ee66b];
const SKIN_COLORS = [0xc98d64, 0x8a5a3b, 0xe8b48c, 0x6b4423];

function makePersonMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRT_COLORS), roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, SKIN_COLORS), roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1210, 0x3a2a18, 0x555555]), roughness: 0.95 });
  // Different heights: no two pedestrians are the same size.
  g.scale.setScalar(range(rng, 0.9, 1.1));
  // Legs.
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [leg, s] of [[legL, -1], [legR, 1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.85, 0.19), pants);
    m.position.y = -0.42;
    leg.add(m);
    leg.position.set(s * 0.12, 0.88, 0);
    g.add(leg);
  }
  // Torso.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.26), shirt);
  torso.position.y = 1.2;
  torso.castShadow = true;
  g.add(torso);
  // Striped shirt: a contrasting band across the chest (some people).
  if (rng() < 0.3) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.12, 0.28),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0xffffff, 0x111111, 0xffd23e]), roughness: 0.85 }),
    );
    stripe.position.y = 1.28;
    g.add(stripe);
  }
  // Arms.
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [arm, s] of [[armL, -1], [armR, 1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), shirt);
    m.position.y = -0.26;
    arm.add(m);
    arm.position.set(s * 0.3, 1.42, 0);
    g.add(arm);
  }
  // A bag in the left hand (some people carry one).
  if (rng() < 0.35) {
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.3, 0.12),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0x8a5a3b, 0x2d6a9f, 0xd21f3c, 0x111111]), roughness: 0.8 }),
    );
    bag.position.set(0, -0.62, 0.05);
    armL.add(bag);
  }
  // Head + hair.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
  head.position.y = 1.68;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.195, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
  hairM.position.y = 1.7;
  g.add(hairM);
  g.userData = { legL, legR, armL, armR };
  return g;
}

// A seated person: legs bent forward at the bench, arms resting — for the
// plaza benches (does not walk).
function makeSeatedMesh(rng) {
  const g = makePersonMesh(rng);
  const u = g.userData;
  // Thighs horizontal, forward — the hips stay at the bench seat level.
  u.legL.rotation.x = -Math.PI / 2 + 0.15;
  u.legR.rotation.x = -Math.PI / 2 + 0.15;
  u.armL.rotation.x = -0.35;
  u.armR.rotation.x = -0.35;
  // A phone in the right hand for some sitters.
  if (rng() < 0.5) {
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.14, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 }),
    );
    phone.position.set(0, -0.5, 0.08);
    u.armR.add(phone);
  }
  return g;
}

export class Pedestrians {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(777);
    this.walkers = [];
    this.talkers = [];

    // Sidewalk walkers: pick a random block corner, walk the sidewalk loop.
    for (let i = 0; i < 16; i++) {
      const mesh = makePersonMesh(this.rng);
      const bx = range(this.rng, -180, 180);
      const bz = range(this.rng, -180, 180);
      mesh.position.set(bx, 0, bz);
      scene.add(mesh);
      this.walkers.push({
        mesh, speed: range(this.rng, 1.1, 2.0),
        dir: this.rng() * Math.PI * 2, phase: this.rng() * 6,
        turnTimer: range(this.rng, 3, 8),
        // Some walkers hold a phone to their ear while walking.
        phone: this.rng() < 0.22,
      });
    }

    // Three seated NPCs on the plaza benches (same spots as world.js).
    // Group y = -0.2 puts the hips at bench-seat height (seat top ≈ 0.68).
    this.sitters = [];
    for (const [x, z, rotY] of [[14, 14, Math.PI * 0.75], [-14, -14, -Math.PI * 0.25], [14, -14, Math.PI * 0.25]]) {
      const mesh = makeSeatedMesh(this.rng);
      mesh.position.set(x, -0.2, z);
      mesh.rotation.y = rotY;
      scene.add(mesh);
      this.sitters.push({ mesh, phase: this.rng() * 6 });
    }

    // Eight named talkers stand near landmarks; E near one opens dialogue.
    const spots = [
      [-20, -20], [24, 8], [-60, 44], [80, -40],
      [150, 100], [205, 40], [-120, -90], [40, 120],
    ];
    NPC_LINES.forEach((npc, i) => {
      const mesh = makePersonMesh(this.rng);
      mesh.position.set(spots[i][0], 0, spots[i][1]);
      mesh.rotation.y = this.rng() * Math.PI * 2;
      scene.add(mesh);
      // A small floating marker so players know this one talks.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.05, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0x7dd7ff }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(spots[i][0], 0.12, spots[i][1]);
      scene.add(ring);
      this.talkers.push({ mesh, ring, ...npc, x: spots[i][0], z: spots[i][1], phase: this.rng() * 6 });
    });
  }

  nearestTalker(pos, maxDist = 3.2) {
    let best = null, bd = maxDist;
    for (const t of this.talkers) {
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  update(dt, elapsed, playerPos) {
    for (const w of this.walkers) {
      w.turnTimer -= dt;
      if (w.turnTimer <= 0) {
        w.turnTimer = range(this.rng, 4, 9);
        w.dir += (this.rng() - 0.5) * 1.6;
      }
      w.phase += dt * 7;
      const nx = w.mesh.position.x + Math.sin(w.dir) * w.speed * dt;
      const nz = w.mesh.position.z + Math.cos(w.dir) * w.speed * dt;
      // Stay on the sidewalks: bounce off roads' edges and buildings.
      if (Math.abs(nx) > 225 || Math.abs(nz) > 225) { w.dir += Math.PI; continue; }
      let blocked = false;
      for (const c of this.world.colliders) {
        if (nx > c.minX - 0.4 && nx < c.maxX + 0.4 && nz > c.minZ - 0.4 && nz < c.maxZ + 0.4) { blocked = true; break; }
      }
      if (blocked) { w.dir += Math.PI * 0.7; continue; }
      w.mesh.position.x = nx;
      w.mesh.position.z = nz;
      w.mesh.rotation.y = w.dir;
      const swing = Math.sin(w.phase) * 0.5;
      w.mesh.userData.legL.rotation.x = swing;
      w.mesh.userData.legR.rotation.x = -swing;
      w.mesh.userData.armL.rotation.x = -swing * 0.7;
      // Phone walkers keep the right arm raised to their ear.
      w.mesh.userData.armR.rotation.x = w.phone ? -2.0 + swing * 0.1 : swing * 0.7;
    }
    // Sitters idle-breathe on their benches.
    for (const s of this.sitters) {
      s.mesh.position.y = -0.2 + Math.sin(elapsed * 1.2 + s.phase) * 0.015;
    }
    // Talkers idle-breathe and their rings bob.
    for (const t of this.talkers) {
      t.ring.position.y = 0.12 + Math.sin(elapsed * 2 + t.phase) * 0.06;
      t.ring.rotation.z = elapsed * 0.8;
    }
  }
}
