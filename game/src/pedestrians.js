// Neon Bay — pedestrians: colourful low-poly NPCs walking the pavements, with
// names and talk lines. Written fresh for Round 12.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { makeRng } from './random.js';

const NAMES = [
  'Maya', 'Rico', 'Luna', 'Diego', 'Sofia', 'Marcus', 'Tara', 'Leo',
  'Nina', 'Omar', 'Ivy', 'Carlos', 'Zoe', 'Felix', 'Rosa', 'Dante',
];
const LINES = [
  'Neon Bay never sleeps, man.',
  'You see the sunset over the bay? Unreal.',
  'Cops are everywhere tonight. Careful.',
  'I heard the King of the Bay pays ten grand.',
  'This city eats people alive. I love it.',
  'Taxi! I need a taxi!',
  'The marina at dawn is the best part of this town.',
  'You look like trouble. Good trouble.',
  'My cousin drives a Comet Sport. Fastest thing here.',
  'Watch out for the potholes on Vice Street.',
];

const SHIRTS = [0xff5a3c, 0x2f8a6a, 0xffc233, 0x7a3fa0, 0x3a7bd5, 0xe84a7a, 0x2eff7a, 0xf2f2f2];
const PANTS = [0x1c2733, 0x3a2a1a, 0x2a3a4a, 0x4a1a2a, 0x1a1a1a];
const SKINS = [0xc98d64, 0x8a5a34, 0xe8b88a, 0x6e4423, 0xd9a06a];

function std(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
}

function makeNpc(rng) {
  const g = new THREE.Group();
  const shirt = std(rng.pick(SHIRTS));
  const pants = std(rng.pick(PANTS));
  const skin = std(rng.pick(SKINS));
  const legL = new THREE.Group(); legL.position.set(0, 0.85, 0.12);
  const legR = new THREE.Group(); legR.position.set(0, 0.85, -0.12);
  for (const leg of [legL, legR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
    m.position.y = -0.4; leg.add(m);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.62), shirt);
  torso.position.y = 1.15; g.add(torso);
  const armL = new THREE.Group(); armL.position.set(0.08, 1.38, 0.38);
  const armR = new THREE.Group(); armR.position.set(0.08, 1.38, -0.38);
  for (const arm of [armL, armR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), shirt);
    m.position.y = -0.28; arm.add(m);
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.62; g.add(head);
  // hair / hat variety
  if (rng.chance(0.5)) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, 1.5), std(rng.pick([0x1a1210, 0x6e4423, 0xd8d8d8, 0xff2e88])));
    hair.position.y = 1.66; g.add(hair);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.1, 10), std(rng.pick(SHIRTS)));
    cap.position.y = 1.8; g.add(cap);
  }
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export class Pedestrians {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    const rng = makeRng(4242);
    this.npcs = [];
    for (let i = 0; i < TUNING.pedCount; i++) {
      const mesh = makeNpc(rng);
      scene.add(mesh);
      const npc = {
        mesh,
        name: NAMES[i % NAMES.length],
        line: LINES[i % LINES.length],
        // walk along a sidewalk segment
        ax: [-120, -60, 0, 60, 120][i % 5],
        z0: -130 + ((i * 37) % 260),
        z1: -130 + ((i * 37 + 130) % 260),
        t: Math.random(),
        speed: 0.9 + rng.next() * 0.9,
        phase: Math.random() * 6,
        side: i % 2 === 0 ? 9.5 : -9.5,
        heading: 0,
      };
      npc.mesh.position.set(npc.ax + npc.side, 0, npc.z0);
      this.npcs.push(npc);
    }
  }

  step(dt) {
    for (const n of this.npcs) {
      n.t += (n.speed * dt) / Math.max(1, Math.abs(n.z1 - n.z0));
      if (n.t >= 1) { n.t = 0; const tmp = n.z0; n.z0 = n.z1; n.z1 = tmp; }
      const z = n.z0 + (n.z1 - n.z0) * n.t;
      const dir = n.z1 > n.z0 ? 1 : -1;
      n.heading = dir > 0 ? 0 : Math.PI;
      n.phase += dt * 7;
      n.mesh.position.set(n.ax + n.side, 0, z);
      n.mesh.rotation.y = n.heading;
      n.mesh.userData.legL.rotation.x = Math.sin(n.phase) * 0.45;
      n.mesh.userData.legR.rotation.x = -Math.sin(n.phase) * 0.45;
      n.mesh.userData.armL.rotation.x = -Math.sin(n.phase) * 0.3;
      n.mesh.userData.armR.rotation.x = Math.sin(n.phase) * 0.3;
    }
  }

  // nearest NPC within range, for talking
  nearest(pos, range = 3.5) {
    let best = null, bd = range;
    for (const n of this.npcs) {
      const d = n.mesh.position.distanceTo(pos);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
}
