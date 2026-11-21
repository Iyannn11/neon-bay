// Neon Bay — the 6-mission chain. A glowing beacon marks the current
// objective; completing it pays out, advances the story, and updates the HUD.
import * as THREE from 'three';
import { MISSIONS, CONFIG } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.done = false;
    this.raceGates = [];
    this.raceIndex = 0;
    this.cratesFound = 0;

    // Beacon: a vertical pillar of light + a pulsing ground ring.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.4, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beacon.position.set(0, 30, 0);
    scene.add(this.beacon);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.25, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2d78 }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.set(0, 0.3, 0);
    scene.add(this.ring);
    this.setMission(0);
  }

  current() {
    return MISSIONS[this.index];
  }

  setMission(i) {
    this.index = i;
    const m = MISSIONS[i];
    this.beacon.position.set(m.target[0], 30, m.target[1]);
    this.ring.position.set(m.target[0], 0.3, m.target[1]);
    // Mission 2 is a race: three gates on the highway ring.
    if (i === 1) this.buildRaceGates();
    else this.clearRaceGates();
  }

  buildRaceGates() {
    this.clearRaceGates();
    const spots = [[180, -120], [-180, -120], [-180, 120]];
    for (const [x, z] of spots) {
      const gate = new THREE.Group();
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 8), new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffd23e, emissiveIntensity: 0.6 }));
        post.position.set(0, 3.5, s * 5);
        gate.add(post);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 11), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7 }));
      bar.position.y = 6.5;
      gate.add(bar);
      gate.position.set(x, 0, z);
      this.scene.add(gate);
      this.raceGates.push({ group: gate, x, z, passed: false });
    }
    this.raceIndex = 0;
  }

  clearRaceGates() {
    for (const g of this.raceGates) this.scene.remove(g.group);
    this.raceGates = [];
  }

  // Returns a reward amount when the player reaches the objective, else 0.
  // `state` carries what the game knows (wanted, crates, race progress).
  checkArrival(playerPos, state) {
    if (this.done) return 0;
    const m = MISSIONS[this.index];
    const d = Math.hypot(playerPos.x - m.target[0], playerPos.z - m.target[1]);
    // Mission 2 needs all 3 gates; mission 3 needs 3 crates; mission 4
    // needs the wanted level back to 0; mission 1 needs a taxi; mission 6
    // needs all 4 marina guards down.
    if (this.index === 0 && !state.inTaxi) return 0;
    if (this.index === 5 && state.guardsDead < 4) return 0;
    if (this.index === 1) {
      const gate = this.raceGates[this.raceIndex];
      if (gate && Math.hypot(playerPos.x - gate.x, playerPos.z - gate.z) < 7) {
        gate.passed = true;
        this.scene.remove(gate.group);
        this.raceIndex++;
        if (this.raceIndex >= 3) return this.complete();
      }
      return 0;
    }
    if (this.index === 2 && state.crates < 3) return 0;
    if (this.index === 3 && state.wanted > 0) return 0;
    if (d < 6) return this.complete();
    return 0;
  }

  complete() {
    const m = MISSIONS[this.index];
    const reward = m.reward;
    if (this.index + 1 >= MISSIONS.length) {
      this.done = true;
      this.beacon.visible = false;
      this.ring.visible = false;
      this.clearRaceGates();
    } else {
      this.setMission(this.index + 1);
    }
    return reward;
  }

  update(dt, elapsed) {
    const s = 1 + Math.sin(elapsed * 3) * 0.12;
    this.ring.scale.set(s, s, 1);
    this.beacon.material.opacity = 0.22 + Math.sin(elapsed * 2) * 0.08;
    this.beacon.rotation.y = elapsed * 0.4;
  }
}
