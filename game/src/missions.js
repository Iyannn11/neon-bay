// Neon Bay — the 6-mission chain, taxi jobs and collectible neon crates.
// Written fresh for Round 12.
import * as THREE from 'three';
import { MISSIONS, TUNING } from './config.js';
import { clamp } from './random.js';

export class Missions {
  constructor(scene, world, player, game) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.game = game;
    this.idx = 0; // current mission
    this.state = 'brief'; // brief | active | done
    this.progress = 0;
    this.target = null;
    this.marker = null;
    this.taxi = { active: false, fare: 0, pickup: null, dropoff: null, timer: 0 };
    this.crates = [];
    this.collected = 0;
    this.buildCrates();
    this.buildMarker();
    this.startMission(0);
  }

  buildMarker() {
    // floating beacon over the current objective
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.6, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30; g.add(beam);
    const dia = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffc233 }));
    dia.rotation.x = Math.PI / 2; dia.position.y = 0.4; g.add(dia);
    g.visible = false;
    this.scene.add(g);
    this.marker = g;
  }

  buildCrates() {
    const spots = [
      [14, -20], [-30, 44], [70, -70], [-80, -30], [44, 80], [-110, 90],
      [130, -20], [-40, -110], [100, 40], [180, -60],
    ];
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      g.position.set(x, 1.0, z);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x00e5ff, emissiveIntensity: 1.6 }));
      g.add(box);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 2.5 }));
      g.add(core);
      this.scene.add(g);
      this.crates.push({ mesh: g, pos: new THREE.Vector3(x, 1.0, z), taken: false });
    }
  }

  startMission(i) {
    this.idx = i;
    this.state = 'active';
    this.progress = 0;
    const m = MISSIONS[i];
    this.game.setMissionCard(m.name, m.brief);
    if (m.type === 'taxi') {
      this.target = new THREE.Vector3(0, 0, 0); // plaza pickup
      this.game.toast('Mission: ' + m.name + ' — get in the taxi (E) and reach the plaza.');
    } else if (m.type === 'race') {
      this.target = new THREE.Vector3(141, 0, -141);
      this.game.toast('Mission: ' + m.name + ' — race the highway ring gates.');
    } else if (m.type === 'collect') {
      this.target = this.crates[0].pos;
      this.game.toast('Mission: ' + m.name + ' — collect 5 neon crates.');
    } else if (m.type === 'combat') {
      this.target = this.world.boatPos.clone();
      this.game.toast('Mission: ' + m.name + ' — clear the marina guards.');
    } else if (m.type === 'escape') {
      this.target = new THREE.Vector3(-120, 0, -120);
      this.game.toast('Mission: ' + m.name + ' — lose the cops, reach the hideout.');
    } else {
      this.target = new THREE.Vector3(0, 0, 0);
      this.game.toast('Mission: ' + m.name + ' — take the crown at the plaza.');
    }
    if (this.marker) {
      this.marker.position.copy(this.target);
      this.marker.visible = true;
    }
  }

  completeMission() {
    const m = MISSIONS[this.idx];
    this.player.money += m.pay;
    this.state = 'done';
    this.game.toast(`Mission complete: ${m.name} — +$${m.pay}`);
    this.game.setMissionCard('Complete', `${m.name} done. +$${m.pay}`);
    if (this.marker) this.marker.visible = false;
    if (this.idx + 1 < MISSIONS.length) {
      setTimeout(() => this.startMission(this.idx + 1), 2500);
    } else {
      this.game.setMissionCard('King of the Bay', 'You own Neon Bay. $10,000 banked.');
      this.game.win();
    }
  }

  // taxi job (T key): pickup then dropoff, paid by distance
  startTaxi() {
    if (this.taxi.active) return;
    const p = this.player.pos;
    const spots = [
      new THREE.Vector3(60, 0, 60), new THREE.Vector3(-60, 0, -60),
      new THREE.Vector3(120, 0, -120), new THREE.Vector3(-120, 0, 120),
      new THREE.Vector3(0, 0, 60), new THREE.Vector3(180, 0, 0),
    ];
    this.taxi.pickup = spots[Math.floor(Math.random() * spots.length)];
    this.taxi.dropoff = spots[Math.floor(Math.random() * spots.length)];
    this.taxi.active = true;
    this.taxi.fare = 120;
    this.target = this.taxi.pickup.clone();
    if (this.marker) { this.marker.position.copy(this.target); this.marker.visible = true; }
    this.game.toast('Taxi fare: pick up the passenger at the marker.');
  }

  step(dt) {
    const p = this.player.pos;
    // objective marker pulse
    if (this.marker && this.marker.visible) {
      this.marker.rotation.y += dt * 1.2;
      this.marker.children[1].position.y = 0.4 + Math.sin(performance.now() * 0.004) * 0.3;
    }
    // crates: collect on touch
    for (const c of this.crates) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 1.5;
      c.mesh.position.y = 1.0 + Math.sin(performance.now() * 0.003 + c.pos.x) * 0.15;
      if (p.distanceTo(c.pos) < 2.4) {
        c.taken = true;
        c.mesh.visible = false;
        this.collected++;
        this.player.money += 150;
        this.game.toast(`Neon crate ${this.collected}/${TUNING.crateCount} — +$150`);
        if (this.state === 'active' && MISSIONS[this.idx].type === 'collect' && this.collected >= 5) this.completeMission();
      }
    }
    if (this.state !== 'active') return;
    const m = MISSIONS[this.idx];
    const d = p.distanceTo(this.target);
    if (m.type === 'taxi') {
      if (d < 5) this.completeMission();
    } else if (m.type === 'race') {
      // gates: 3 ring checkpoints
      const gates = [
        new THREE.Vector3(141, 0, -141), new THREE.Vector3(141, 0, 141), new THREE.Vector3(-141, 0, 141),
      ];
      const g = gates[this.progress];
      if (g) {
        this.target.copy(g);
        if (this.marker) this.marker.position.copy(g);
        if (d < 8) {
          this.progress++;
          this.game.toast(`Gate ${this.progress}/3!`);
          if (this.progress >= 3) this.completeMission();
        }
      }
    } else if (m.type === 'combat') {
      if (d < 8) {
        this.progress++;
        if (this.progress >= 1) this.completeMission();
      }
    } else if (m.type === 'escape') {
      if (this.player.wanted >= 3) { /* stay hot */ }
      if (d < 6 && this.player.wanted < 1) this.completeMission();
    } else if (m.type === 'finale') {
      if (d < 6) this.completeMission();
    }
    // taxi job progress
    if (this.taxi.active) {
      const td = p.distanceTo(this.target);
      if (td < 5) {
        if (this.target.equals(this.taxi.pickup)) {
          this.target.copy(this.taxi.dropoff);
          if (this.marker) this.marker.position.copy(this.target);
          this.game.toast('Passenger aboard — drive to the dropoff.');
        } else {
          const pay = 120 + Math.floor(this.taxi.pickup.distanceTo(this.taxi.dropoff) / 10) * 10;
          this.player.money += pay;
          this.taxi.active = false;
          if (this.marker) this.marker.visible = this.state === 'active';
          this.game.toast(`Fare complete — +$${pay}`);
        }
      }
    }
  }
}
