// Neon Bay — missions and side work. Six chained story missions (the finale
// pays $10,000), plus repeatable taxi fares, street races, stunt jumps and
// photo spots. One beacon marks the current objective; the HUD and minimap
// read the same state.

import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS, CRATE_VALUE } from './config.js';
import { clamp, range, pick } from './random.js';

function makeGuard(scene, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.32, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.8 }),
  );
  body.position.y = 1.15;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a06b, roughness: 0.6 }),
  );
  head.position.y = 1.82;
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 }),
  );
  gun.position.set(0.2, 1.35, 0.4);
  g.add(body, head, gun);
  g.position.set(x, 0, z);
  g.userData = { hp: 30, dead: false, fallT: 0 };
  scene.add(g);
  return g;
}

export class Missions {
  constructor(scene, world, hooks) {
    this.scene = scene;
    this.world = world;
    this.hooks = hooks; // {cash(amount, reason), toast(text), banner(text, sub)}
    this.index = 0;
    this.done = false;
    this.allDone = false;
    // side-work counters
    this.cratesCollected = 0;
    this.missionCrates = 0;
    this.stuntsDone = new Set();
    this.photosDone = new Set();
    this.racesWon = new Set();
    this.taxiJobs = 0;
    this.taxi = { active: false, phase: 'idle', dest: null, fare: 0 };
    this.race = { active: false, gate: -1, checkpoints: [], idx: 0, timer: 0 };
    this.cleanTimer = 0;
    this.guards = [];
    this.crownTaken = false;
    // objective beacon — short + soft, so it marks the spot without
    // hiding the scene behind it
    const beaconGeo = new THREE.CylinderGeometry(1.5, 1.5, 6, 14, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(beaconGeo, this.beaconMat);
    this.beacon.position.set(128, 3, 128);
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3, 24);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(128, 0.08, 128);
    scene.add(this.ring);
    this._startMission(0);
  }

  get current() { return MISSIONS[this.index]; }

  objectiveText() {
    if (this.allDone) return 'King of the Bay! Free roam — taxi, races, stunts and photos still pay.';
    const m = this.current;
    if (!m) return '';
    switch (m.id) {
      case 'm1': return this._inVehicle ? 'Drive to the yellow marker.' : 'M1 First Wheels — steal any car (E).';
      case 'm2':
        if (this.taxi.phase === 'pickup') return 'M2 Taxi Driver — pick up the passenger at the plaza.';
        if (this.taxi.phase === 'dropoff') return 'M2 Taxi Driver — drop the passenger at the beach.';
        return 'M2 Taxi Driver — get in the yellow TAXI at the plaza.';
      case 'm3':
        if (this.race.active) return `M3 Neon Run — checkpoint ${this.race.idx + 1}/3, ${Math.ceil(this.race.timer)}s left!`;
        return 'M3 Neon Run — drive through the checkered gate to start the race.';
      case 'm4': return `M4 Crate Hunter — collect neon crates (${this.missionCrates}/3).`;
      case 'm5':
        if (this.cleanTimer > 0) return `M5 Heat — stay clean… ${Math.ceil(10 - this.cleanTimer)}s`;
        return 'M5 Heat — lose the cops! Wanted 3 stars.';
      case 'm6': {
        const left = this.guards.filter((g) => !g.userData.dead).length;
        if (left > 0) return `M6 King of the Bay — take out the marina guards (${4 - left}/4).`;
        if (!this.crownTaken) return 'M6 King of the Bay — grab the crown crate at the marina!';
        return 'M6 King of the Bay — done!';
      }
      default: return m.brief;
    }
  }

  markerPos() {
    if (this.allDone) return null;
    const m = this.current;
    if (!m) return null;
    switch (m.id) {
      case 'm1': return { x: 128, z: 128 };
      case 'm2':
        if (this.taxi.phase === 'pickup') return { x: 20, z: 20 };
        if (this.taxi.phase === 'dropoff') return this.taxi.dest;
        return { x: 24, z: 20 };
      case 'm3':
        if (this.race.active && this.race.idx < this.race.checkpoints.length) return this.race.checkpoints[this.race.idx];
        return this.world.raceGates[0];
      case 'm4': {
        const c = this.world.crates.find((cc) => !cc.taken);
        return c ? { x: c.x, z: c.z } : null;
      }
      case 'm5': return null;
      case 'm6':
        return this.guards.some((g) => !g.userData.dead) ? { x: 300, z: 0 } : { x: 306, z: 0 };
      default: return null;
    }
  }

  _startMission(i) {
    this.index = i;
    const m = this.current;
    if (!m) { this.allDone = true; return; }
    this.hooks.toast(`Mission ${i + 1}: ${m.title} — ${m.brief}`);
    this.hooks.banner(m.title, m.brief);
    if (m.id === 'm2') this.taxi = { active: true, phase: 'enter', dest: { x: 270, z: 40 }, fare: 220 };
    if (m.id === 'm3') this.race = { active: false, gate: -1, checkpoints: [], idx: 0, timer: 0 };
    if (m.id === 'm4') this.missionCrates = 0;
    if (m.id === 'm5') this.cleanTimer = 0;
    if (m.id === 'm6') this._spawnGuards();
  }

  _spawnGuards() {
    const spots = [[296, -20], [304, 10], [292, 30], [308, -40]];
    for (const [x, z] of spots) this.guards.push(makeGuard(this.scene, x, z));
  }

  // Shooting a guard: `point` is the bullet impact point. Returns the guard or null.
  hitGuard(point) {
    for (const g of this.guards) {
      if (g.userData.dead) continue;
      const d = Math.hypot(g.position.x - point.x, g.position.z - point.z);
      if (d < 1.6 && Math.abs(point.y - 1.2) < 1.6) {
        g.userData.hp -= 34;
        if (g.userData.hp <= 0) {
          g.userData.dead = true;
          g.rotation.x = -Math.PI / 2;
          g.position.y = 0.4;
          this.hooks.toast('Guard down!');
        }
        return g;
      }
    }
    return null;
  }

  _completeMission(player) {
    const m = this.current;
    this.hooks.cash(m.reward, `Mission: ${m.title}`);
    this.hooks.banner('MISSION COMPLETE', `${m.title}  +$${m.reward}`);
    if (this.index + 1 >= MISSIONS.length) {
      this.allDone = true;
      this.hooks.banner('KING OF THE BAY', 'You run Neon Bay now. $10,000 earned.');
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    this._startMission(this.index + 1);
  }

  collectCrate(crate) {
    if (crate.taken) return;
    crate.taken = true;
    crate.mesh.visible = false;
    this.cratesCollected++;
    this.hooks.cash(CRATE_VALUE, 'Neon crate');
    this.hooks.toast(`Neon crate +$${CRATE_VALUE} (${this.cratesCollected}/10)`);
    if (this.current && this.current.id === 'm4') {
      this.missionCrates++;
      if (this.missionCrates >= 3) this._completeMission();
    }
  }

  tryStunt(x, z, speed) {
    if (speed < 14) return false;
    for (let i = 0; i < this.world.ramps.length; i++) {
      const r = this.world.ramps[i];
      if (this.stuntsDone.has(i)) continue;
      if (Math.hypot(x - r.x, z - r.z) < 7) {
        this.stuntsDone.add(i);
        this.hooks.cash(60, 'Stunt jump');
        this.hooks.toast(`STUNT JUMP +$60 (${this.stuntsDone.size}/5)`);
        return true;
      }
    }
    return false;
  }

  tryPhoto(x, z) {
    for (let i = 0; i < this.world.photoSpots.length; i++) {
      const s = this.world.photoSpots[i];
      if (this.photosDone.has(i)) continue;
      if (Math.hypot(x - s.x, z - s.z) < 3.5) {
        this.photosDone.add(i);
        this.hooks.cash(50, 'Photo spot');
        this.hooks.toast(`PHOTO SPOT +$50 (${this.photosDone.size}/3)`);
        return true;
      }
    }
    return false;
  }

  // Driving through a race gate starts (or advances) a race.
  tryRaceGate(x, z) {
    for (let i = 0; i < this.world.raceGates.length; i++) {
      const g = this.world.raceGates[i];
      if (Math.hypot(x - g.x, z - g.z) > 8) continue;
      if (this.current && this.current.id === 'm3' && !this.race.active) {
        // mission race: checkpoints are the other two gates in order
        const others = this.world.raceGates.filter((_, j) => j !== i);
        this.race = { active: true, gate: i, checkpoints: [...others, g], idx: 0, timer: 75 };
        this.hooks.toast('Race started! Hit all 3 checkpoints in 75s.');
        return 'race-start';
      }
      if (this.race.active && this.race.idx < this.race.checkpoints.length) {
        const cp = this.race.checkpoints[this.race.idx];
        if (Math.hypot(x - cp.x, z - cp.z) < 8) {
          this.race.idx++;
          if (this.race.idx >= this.race.checkpoints.length) {
            const won = this.current && this.current.id === 'm3';
            this.race.active = false;
            if (won) { this._completeMission(); return 'race-won'; }
            if (!this.racesWon.has(i)) {
              this.racesWon.add(i);
              this.hooks.cash(300, 'Street race win');
              this.hooks.toast('RACE WON +$300');
            }
            return 'race-won';
          }
          this.hooks.toast(`Checkpoint ${this.race.idx + 1}/3!`);
          return 'checkpoint';
        }
      }
      if (!this.race.active && !this.racesWon.has(i) && !(this.current && this.current.id === 'm3')) {
        // free-roam race from this gate
        const others = this.world.raceGates.filter((_, j) => j !== i);
        this.race = { active: true, gate: i, checkpoints: [...others, g], idx: 0, timer: 75 };
        this.hooks.toast('Race started! Hit all 3 checkpoints in 75s.');
        return 'race-start';
      }
      return null;
    }
    return null;
  }

  // Free-roam taxi job: called when the player is in the taxi near the stand.
  tryTaxiJob(player) {
    if (this.taxi.active) return false;
    if (!player.inVehicle || player.inVehicle.kind !== 'taxi') return false;
    if (Math.hypot(player.pos.x - 20, player.pos.z - 20) > 8) return false;
    const dests = [{ x: 270, z: 40 }, { x: -224, z: -224 }, { x: 96, z: 224 }, { x: -96, z: -160 }];
    const dest = pick(Math.random, dests);
    this.taxi = { active: true, phase: 'dropoff', dest, fare: 40 + Math.floor(Math.random() * 50) };
    this.hooks.toast(`Taxi job: take the passenger to the marker. Fare $${this.taxi.fare}.`);
    return true;
  }

  update(dt, ctx) {
    const { player, police } = ctx;
    // beacon follows the objective
    const mp = this.markerPos();
    if (mp && !this.allDone) {
      this.beacon.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(mp.x, 4.5, mp.z);
      this.ring.position.set(mp.x, 0.08, mp.z);
      this.beacon.rotation.y += dt * 1.2;
      this.ringMat.opacity = 0.55 + Math.sin(performance.now() * 0.004) * 0.25;
    } else {
      this.beacon.visible = false;
      this.ring.visible = false;
    }
    if (this.allDone) return;
    const m = this.current;
    if (!m) return;
    const px = player.pos.x, pz = player.pos.z;

    if (m.id === 'm1') {
      if (player.inVehicle && mp && Math.hypot(px - mp.x, pz - mp.z) < 9) this._completeMission(player);
    } else if (m.id === 'm2') {
      if (this.taxi.phase === 'enter' && player.inVehicle && player.inVehicle.kind === 'taxi') {
        this.taxi.phase = 'pickup';
        this.hooks.toast('Drive to the passenger at the plaza.');
      } else if (this.taxi.phase === 'pickup' && Math.hypot(px - 20, pz - 20) < 7) {
        this.taxi.phase = 'dropoff';
        this.hooks.toast('Passenger aboard! Drive to the beach.');
      } else if (this.taxi.phase === 'dropoff' && Math.hypot(px - this.taxi.dest.x, pz - this.taxi.dest.z) < 8) {
        this.taxi.active = false;
        this.taxi.phase = 'idle';
        this._completeMission(player);
      }
    } else if (m.id === 'm3') {
      if (this.race.active) {
        this.race.timer -= dt;
        if (this.race.timer <= 0) {
          this.race.active = false;
          this.hooks.toast('Race failed — drive through the gate to try again.');
        }
      }
    } else if (m.id === 'm5') {
      // mission starts the heat (set once by main via police); complete after 10 clean seconds at 0 stars
      if (police.level === 0) {
        this.cleanTimer += dt;
        if (this.cleanTimer >= 10) this._completeMission(player);
      } else {
        this.cleanTimer = 0;
      }
    } else if (m.id === 'm6') {
      const left = this.guards.filter((g) => !g.userData.dead).length;
      if (left === 0 && !this.crownTaken) {
        // crown crate appears at the marina
        if (Math.hypot(px - 306, pz - 0) < 4) {
          this.crownTaken = true;
          this._completeMission(player);
        }
      }
    }
    // free-roam race timer
    if (this.race.active && !(m.id === 'm3')) {
      this.race.timer -= dt;
      if (this.race.timer <= 0) {
        this.race.active = false;
        this.hooks.toast('Race failed — drive through a gate to try again.');
      }
    }
  }
}
