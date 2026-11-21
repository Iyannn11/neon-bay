// Neon Bay — missions, taxi fares, and collectibles.
//
// One clear job: the story. A 6-mission chain from the first pickup to the
// $10,000 finale, plus taxi fares and ten hidden neon crates as side work.
// Each step has a glowing 3D marker, a HUD objective, and a payout.

import * as THREE from 'three';
import { MISSIONS, TAXI_FARE, CRATE_COUNT, CRATE_REWARD } from './config.js';
import { range, pick, clamp, dist2D } from './random.js';

function markerMesh(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 4;
  g.add(diamond);
  g.userData.diamond = diamond;
  return g;
}

export class Missions {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.index = 0; // next mission to run
    this.active = null; // { def, step, timer, kills }
    this.marker = null;
    this.taxi = null; // { pickup, drop, fare, passenger }
    this.crates = [];
    this.cratesFound = 0;
    this._spawnCrates();
    this._spawnTaxiStands();
  }

  _spawnCrates() {
    for (let i = 0; i < CRATE_COUNT; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xff2e63, emissive: 0xff2e63, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4 }),
      );
      const x = range(this.rng, -270, 270);
      const z = range(this.rng, -270, 270);
      mesh.position.set(x, 0.9, z);
      mesh.rotation.y = this.rng() * Math.PI;
      this.scene.add(mesh);
      this.crates.push({ mesh, found: false });
    }
  }

  _spawnTaxiStands() {
    // Taxi stands glow at the hotel and the pier — walk up to start a fare.
    this.stands = [];
    for (const [x, z] of [[190, 190], [-210, 250], [32, 96]]) {
      const m = markerMesh(0xffd23e);
      m.position.set(x, 0, z);
      m.scale.setScalar(0.7);
      this.scene.add(m);
      this.stands.push({ x, z, mesh: m });
    }
  }

  currentDef() {
    return MISSIONS[this.index] ?? null;
  }

  startMission(onEvent) {
    const def = this.currentDef();
    if (!def || this.active) return false;
    this.active = { def, step: 0, timer: def.timeLimit, kills: 0, waitLeft: 0 };
    this._placeMarker();
    if (onEvent) onEvent('start', def);
    return true;
  }

  _placeMarker() {
    this._clearMarker();
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (!step || step.x === undefined) return;
    this.marker = markerMesh(0x00c2ff);
    this.marker.position.set(step.x, 0, step.z);
    this.scene.add(this.marker);
  }

  _clearMarker() {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker = null;
    }
  }

  stepLabel() {
    if (!this.active) return null;
    return this.active.def.steps[this.active.step]?.label ?? '';
  }

  // Taxi: start a fare from a stand, drive the passenger to the drop-off.
  startTaxi(onEvent) {
    if (this.taxi || this.active) return false;
    const drop = this.world.randomRoadPoint(this.rng);
    const dist = dist2D(0, 0, drop.x, drop.z);
    this.taxi = {
      drop,
      fare: Math.round(TAXI_FARE.base + dist * TAXI_FARE.perMetre),
      marker: markerMesh(0xffd23e),
    };
    this.taxi.marker.position.set(drop.x, 0, drop.z);
    this.scene.add(this.taxi.marker);
    if (onEvent) onEvent('taxi', this.taxi);
    return true;
  }

  update(dt, playerX, playerZ, inVehicle, wanted, onEvent) {
    // Animate markers.
    if (this.marker) {
      this.marker.userData.diamond.rotation.y += dt * 2.4;
      this.marker.userData.diamond.position.y = 4 + Math.sin(performance.now() * 0.004) * 0.5;
    }
    for (const s of this.stands) {
      s.mesh.userData.diamond.rotation.y += dt * 1.6;
    }
    // Crates.
    for (const c of this.crates) {
      if (c.found) continue;
      c.mesh.rotation.y += dt * 1.2;
      c.mesh.position.y = 0.9 + Math.sin(performance.now() * 0.003 + c.mesh.position.x) * 0.15;
      if (dist2D(playerX, playerZ, c.mesh.position.x, c.mesh.position.z) < 2.2) {
        c.found = true;
        c.mesh.visible = false;
        this.cratesFound += 1;
        if (onEvent) onEvent('crate', { reward: CRATE_REWARD, found: this.cratesFound });
      }
    }
    // Taxi drop-off.
    if (this.taxi) {
      this.taxi.marker.userData.diamond.rotation.y += dt * 2.4;
      if (dist2D(playerX, playerZ, this.taxi.drop.x, this.taxi.drop.z) < 5) {
        const fare = this.taxi.fare + (chance(this.rng, TAXI_FARE.tipChance) ? 40 : 0);
        this.scene.remove(this.taxi.marker);
        this.taxi = null;
        if (onEvent) onEvent('fare', { fare });
      }
    }
    // Mission logic.
    if (!this.active) return;
    const m = this.active;
    m.timer -= dt;
    if (m.timer <= 0) {
      this._fail('Time ran out.');
      if (onEvent) onEvent('fail', { reason: 'Time ran out.' });
      return;
    }
    const step = m.def.steps[m.step];
    if (!step) return;
    if (step.type === 'goto') {
      if (step.wanted !== undefined && wanted < step.wanted) {
        // The finale wants the heat on — the escape only counts once the city is after you.
      }
      if (dist2D(playerX, playerZ, step.x, step.z) < 6) {
        if (step.needWanted !== undefined && wanted > step.needWanted) {
          // Not yet: the cops are still on you. Keep running.
        } else {
          this._advance(onEvent);
        }
      }
    } else if (step.type === 'wait') {
      if (dist2D(playerX, playerZ, step.x, step.z) < 7) {
        m.waitLeft += dt;
        if (m.waitLeft >= step.seconds) this._advance(onEvent);
      } else {
        m.waitLeft = 0;
      }
    } else if (step.type === 'steal') {
      if (inVehicle && inVehicle.type === step.vehicle) {
        this._advance(onEvent);
      }
    } else if (step.type === 'kill') {
      if (m.kills >= step.count) this._advance(onEvent);
    }
  }

  registerKill() {
    if (this.active) this.active.kills += 1;
  }

  _advance(onEvent) {
    const m = this.active;
    m.step += 1;
    m.waitLeft = 0;
    if (m.step >= m.def.steps.length) {
      const def = m.def;
      this.active = null;
      this._clearMarker();
      this.index += 1;
      if (onEvent) onEvent('done', def);
    } else {
      this._placeMarker();
      if (onEvent) onEvent('step', m.def.steps[m.step]);
    }
  }

  _fail(reason) {
    this.active = null;
    this._clearMarker();
  }

  abort() {
    this.active = null;
    this._clearMarker();
    if (this.taxi) {
      this.scene.remove(this.taxi.marker);
      this.taxi = null;
    }
  }
}
