// Neon Bay — the game itself.
//
// One clear job: wire every system together — the world, the traffic, the
// pedestrians, Kai, the guns, the police, the missions, the HUD, the sound
// and the save — and run the loop. This is the file the browser opens.

import * as THREE from 'three';
import { WORLD, VEHICLE_TYPES, WEAPONS } from './config.js';
import { mulberry32, range, pick, chance, clamp, dist2D } from './random.js';
import { Input } from './input.js';
import { createWorld } from './world.js';
import { Vehicle, Traffic, buildCarMesh } from './vehicles.js';
import { Pedestrians, buildPersonMesh } from './pedestrians.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { createRenderer, CameraRig } from './render.js';
import { shotParams, applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    const params = shotParams();
    this.shotMode = !!params.shot;
    this.rng = mulberry32(params.seed);
    this.save = loadSave();
    this.money = this.save.money;
    this.hour = WORLD.startHour;
    this.day = 1;
    this.state = 'menu';
    this.input = new Input();
    this.sound = new SoundBank();
    this.hud = new Hud();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b1a5e);
    this.renderer = createRenderer($('app'));
    this.cameraRig = new CameraRig();
    this.world = createWorld(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.world, this.rng);
    this.pedestrians = new Pedestrians(this.scene, this.world, this.rng);
    this.player = new Player(this.scene, this.rng);
    this.combat = new Combat(this.scene, this.rng);
    this.police = new Police(this.scene, this.world, this.rng);
    this.missions = new Missions(this.scene, this.world, this.rng);
    this.missions.index = this.save.missionsDone.length;
    this.missions.cratesFound = this.save.crates.length;
    for (const ci of this.save.crates) {
      if (this.missions.crates[ci]) {
        this.missions.crates[ci].found = true;
        this.missions.crates[ci].mesh.visible = false;
      }
    }
    this.playerVehicle = null;
    this.parked = [];
    this.rivals = [];
    // Headlights: a spotlight the player's car carries, so the road ahead
    // reads at night and the car itself is never lost in the dark.
    this._headlight = new THREE.SpotLight(0xffe9a8, 160, 60, 0.55, 0.5, 1.3);
    this._headlightTarget = new THREE.Object3D();
    this._spawnParkedCars();
    this._missionStartMarker = this._makeStartMarker();
    this.cameraHeading = Math.PI;
    this.frames = 0;
    this.fpsTimer = 0;
    this.fpsCount = 0;
    this.saveTimer = 0;
    this._bindUi();
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.cameraRig.resize();
    });
    if (this.shotMode) {
      this._startPlaying();
      applyShot(this, params.shot);
    } else {
      this._showStart();
    }
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _makeStartMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2eff8f, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 24), new THREE.MeshBasicMaterial({ color: 0x2eff8f }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    g.add(ring);
    g.position.set(32, 0, 96);
    this.scene.add(g);
    return g;
  }

  _spawnParkedCars() {
    const spots = [
      ['comet', 40, 100, Math.PI / 2], ['comet', -40, -100, -Math.PI / 2],
      ['sedan', 104, 40, 0], ['taxi', -104, -40, Math.PI], ['coupe', 168, 104, Math.PI / 2],
      ['sedan', -168, -104, 0], ['truck', 232, -40, Math.PI], ['taxi', -232, 40, 0],
      ['coupe', 104, 232, -Math.PI / 2], ['sedan', -104, -232, Math.PI / 2],
      ['sedan', 296, 168, Math.PI], ['taxi', -296, -168, 0],
    ];
    for (const [type, x, z, h] of spots) {
      const car = new Vehicle(type, x, z, h);
      this.scene.add(car.mesh);
      this.parked.push(car);
    }
  }

  _bindUi() {
    $('play-btn').addEventListener('click', () => this._startPlaying());
    $('resume-btn').addEventListener('click', () => this._resume());
    $('retry-btn').addEventListener('click', () => this._retry());
    $('continue-btn').addEventListener('click', () => this._continueAfterMission());
  }

  _showStart() {
    $('start-screen').classList.remove('hidden');
    $('loading').classList.add('hidden');
    this.hud.hide();
  }

  _startPlaying() {
    this.sound.start();
    $('start-screen').classList.add('hidden');
    $('loading').classList.add('hidden');
    $('pause-screen').classList.add('hidden');
    $('gameover-screen').classList.add('hidden');
    $('mission-complete-screen').classList.add('hidden');
    this.hud.show();
    this.state = 'playing';
    this.hud.toast('Welcome to Neon Bay — find the green marker to start a mission');
  }

  _resume() {
    $('pause-screen').classList.add('hidden');
    this.state = 'playing';
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    $('pause-screen').classList.remove('hidden');
  }

  _retry() {
    $('gameover-screen').classList.add('hidden');
    this.money = Math.floor(this.money * 0.9);
    this._detachHeadlight();
    this.player.reset(0, 40);
    this.police.setStars(0);
    this.missions.abort();
    this._clearRivals();
    this.state = 'playing';
    this.hud.toast('Back on the streets. The city never sleeps.');
  }

  _continueAfterMission() {
    $('mission-complete-screen').classList.add('hidden');
    this.state = 'playing';
  }

  _gameOver(kind) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    const reason = kind === 'busted'
      ? 'The NBPD caught you on foot. The crew posts your bail — but the heat is off, for now.'
      : 'Kai went down in the streets of Neon Bay. The city keeps moving without him.';
    $('gameover-reason').textContent = reason;
    $('gameover-stats').textContent = `$${this.money.toLocaleString('en-US')} · ${this.missions.index}/6 missions done`;
    $('gameover-screen').classList.remove('hidden');
    this.hud.hide();
    this.sound.setEngine(0, false);
  }

  setPlayerVehicle(type, x, z, heading) {
    const car = new Vehicle(type, x, z, heading);
    this.scene.add(car.mesh);
    this.playerVehicle = car;
    this.player.mesh.visible = false;
    this._attachHeadlight(car);
    return car;
  }

  _attachHeadlight(car) {
    this._detachHeadlight();
    // Forward is local +Z now (the car body was turned to lie along Z).
    this._headlight.position.set(0, 1.0, 2.1);
    car.mesh.add(this._headlight);
    this._headlightTarget.position.set(0, -0.6, 16);
    car.mesh.add(this._headlightTarget);
    this._headlight.target = this._headlightTarget;
  }

  _detachHeadlight() {
    if (this._headlight.parent) this._headlight.parent.remove(this._headlight);
    if (this._headlightTarget.parent) this._headlightTarget.parent.remove(this._headlightTarget);
  }

  spawnRivals(x, z, n) {
    this._clearRivals();
    for (let i = 0; i < n; i += 1) {
      const mesh = buildPersonMesh(this.rng);
      mesh.children[0].material = new THREE.MeshStandardMaterial({ color: 0xff2030, roughness: 0.7 });
      mesh.position.set(x + range(this.rng, -12, 12), 0, z + range(this.rng, -12, 12));
      this.scene.add(mesh);
      this.rivals.push({ mesh, health: 60, shootTimer: range(this.rng, 0.8, 2), dead: false, fade: 0 });
    }
  }

  _clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }

  _nearestParked(maxD = 4.5) {
    let best = null;
    let bestD = maxD;
    for (const car of this.parked) {
      const d = dist2D(this.player.x, this.player.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  _enterCar(car) {
    this.parked = this.parked.filter((c) => c !== car);
    this.playerVehicle = car;
    this.player.mesh.visible = false;
    this._attachHeadlight(car);
    this.sound.door();
    if (!car.stolen) {
      car.stolen = true;
      this.police.addHeat(12);
      this.hud.toast('Car stolen! The NBPD noticed.');
      this.sound.wantedUp();
    }
  }

  _exitCar() {
    const car = this.playerVehicle;
    if (!car) return;
    this._detachHeadlight();
    const side = car.heading + Math.PI / 2;
    this.player.reset(car.x + Math.sin(side) * 2.4, car.z + Math.cos(side) * 2.4);
    this.player.mesh.visible = true;
    this.parked.push(car);
    this.playerVehicle = null;
    this.sound.door();
  }

  _fireWeapon() {
    const inCar = !!this.playerVehicle;
    const ox = inCar ? this.playerVehicle.x : this.player.x;
    const oz = inCar ? this.playerVehicle.z : this.player.z;
    const heading = inCar ? this.playerVehicle.heading : this.player.heading;
    const targets = [];
    for (const r of this.rivals) {
      if (!r.dead) targets.push({ x: r.mesh.position.x, z: r.mesh.position.z, health: r.health, rival: r });
    }
    for (const car of this.police.cars) {
      targets.push({ x: car.x, z: car.z, health: car.health, policeCar: car });
    }
    const hits = this.combat.fire(ox, 1.3, oz, heading, targets, (sound) => {
      if (sound === 'shot') this.sound.shot();
      else if (sound === 'boom') this.sound.boom();
      else this.sound.punch();
    });
    if (hits.length > 0) {
      this.police.addHeat(2);
      this.pedestrians.scare(ox, oz, 45);
    }
    for (const t of hits) {
      if (t.rival) {
        t.rival.health = t.health;
        if (t.rival.health <= 0 && !t.rival.dead) {
          t.rival.dead = true;
          t.rival.fade = 3;
          t.rival.mesh.rotation.x = -Math.PI / 2;
          t.rival.mesh.position.y = 0.35;
          this.missions.registerKill();
          this.hud.toast('Rival down!');
        }
      }
      if (t.policeCar) {
        t.policeCar.health = t.health;
        if (t.policeCar.health <= 0) {
          t.policeCar.speed = 0;
          t.policeCar.disabled = true;
          this.police.addHeat(10);
        }
      }
    }
    this.cameraRig.addShake(0.12);
  }

  _missionEvent(kind, data) {
    if (kind === 'start') {
      this.sound.missionStart();
      this.hud.toast(`${data.name} — ${data.brief}`);
      this.hud.center(data.name.toUpperCase(), data.brief);
      if (data.id === 'm5') this.police.setStars(3);
      if (data.id === 'm3') this.hud.toast('Find a Comet GT on the boulevard — press E near one');
    } else if (kind === 'step') {
      this.hud.toast(data.label);
      if (data.label.includes('vault')) this.police.setStars(5);
    } else if (kind === 'done') {
      this.money += data.payout;
      this.save.totalEarned += data.payout;
      this.save.missionsDone.push(data.id);
      this.sound.missionDone();
      this._clearRivals();
      $('mission-complete-name').textContent = `${data.name} — ${data.brief}`;
      $('mission-complete-payout').textContent = `+$${data.payout.toLocaleString('en-US')}`;
      if (!this.shotMode) {
        $('mission-complete-screen').classList.remove('hidden');
        this.state = 'missiondone';
      }
      this._persist();
    } else if (kind === 'fail') {
      this.sound.denied();
      this.hud.toast(`Mission failed — ${data.reason}`);
      this._clearRivals();
    } else if (kind === 'crate') {
      this.money += data.reward;
      this.save.crates.push(this.missions.crates.findIndex((c) => c.found));
      this.save.totalEarned += data.reward;
      this.sound.cash();
      this.hud.toast(`Neon crate found! +$${data.reward} (${data.found}/10)`);
      this._persist();
    } else if (kind === 'taxi') {
      this.sound.pickup();
      this.hud.toast('Passenger aboard — drive to the gold marker');
    } else if (kind === 'fare') {
      this.money += data.fare;
      this.save.totalEarned += data.fare;
      this.save.bestFare = Math.max(this.save.bestFare, data.fare);
      this.sound.cash();
      this.hud.toast(`Fare complete! +$${data.fare}`);
      this._persist();
    }
  }

  _persist() {
    this.save.money = this.money;
    storeSave(this.save);
  }

  _frame() {
    const now = performance.now();
    let dt = (now - this._last) / 1000;
    this._last = now;
    dt = clamp(dt, 0.001, 0.05);
    this.frames += 1;
    this.fpsCount += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer > 0.5) {
      if (!this.shotMode) this.hud.setFps(Math.round(this.fpsCount / this.fpsTimer));
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }

    const input = this.input;
    if (input.wasPressed('KeyM')) {
      this.sound.setMuted(!this.sound.muted);
      this.hud.toast(this.sound.muted ? 'Sound muted' : 'Sound on');
      input.consume('KeyM');
    }

    if (this.state === 'menu') {
      const prevHour = this.hour;
      this.hour = (this.hour + dt * (24 / WORLD.dayLengthSec)) % 24;
      if (this.hour < prevHour) this.day += 1;
      this.world.update(dt, this.hour);
      this.traffic.update(dt, null, this.world.colliders);
      this.pedestrians.update(dt);
      this.cameraRig.orbit(dt, now / 1000, 0, 0);
      this.renderer.render(this.scene, this.cameraRig.camera);
      if (input.wasPressed('Enter')) this._startPlaying();
      input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) this._resume();
      input.endFrame();
      return;
    }
    if (this.state === 'gameover' || this.state === 'missiondone') {
      if (this.state === 'gameover' && input.wasPressed('Enter')) this._retry();
      input.endFrame();
      return;
    }

    // ---- Playing ----
    const prevHour = this.hour;
    this.hour = (this.hour + dt * (24 / WORLD.dayLengthSec)) % 24;
    if (this.hour < prevHour) this.day += 1;
    this.world.update(dt, this.hour);
    const colliders = this.world.colliders;

    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) { this._pause(); input.endFrame(); return; }
    if (input.wasPressed('KeyC')) { this.cameraRig.toggleMode(); input.consume('KeyC'); }
    if (input.wasPressed('KeyR')) { this.combat.reload(); input.consume('KeyR'); }
    if (input.wasPressed('Digit1')) { this.combat.selectWeapon(0); input.consume('Digit1'); }
    if (input.wasPressed('Digit2')) { this.combat.selectWeapon(1); input.consume('Digit2'); }
    if (input.wasPressed('Digit3')) { this.combat.selectWeapon(2); input.consume('Digit3'); }

    const inCar = !!this.playerVehicle;
    const px = inCar ? this.playerVehicle.x : this.player.x;
    const pz = inCar ? this.playerVehicle.z : this.player.z;
    const heading = inCar ? this.playerVehicle.heading : this.player.heading;

    // Enter / exit car.
    if (input.wasPressed('KeyE')) {
      input.consume('KeyE');
      if (inCar) this._exitCar();
      else {
        const car = this._nearestParked();
        if (car) this._enterCar(car);
      }
    }
    // Shooting.
    if (input.wasPressed('KeyF') || input.mouseDown) {
      this._fireWeapon();
      if (input.wasPressed('KeyF')) input.consume('KeyF');
    }

    // Drive or walk.
    if (inCar) {
      // In screenshot mode there is no driver input — cruise at a steady
      // speed so the chase reads in the frame.
      const axes = this.shotMode
        ? { throttle: 0.35, steer: 0, boost: false, brake: false }
        : input.driveAxes();
      this.playerVehicle.drive(dt, axes.throttle, axes.steer, axes.boost, axes.brake, colliders, [...this.traffic.cars, ...this.parked, ...this.police.cars]);
      this.sound.setEngine(Math.abs(this.playerVehicle.speed) / 20, true);
    } else {
      const axes = input.walkAxes();
      this.player.walk(dt, axes, this.cameraHeading, colliders);
      this.sound.setEngine(0, false);
    }

    // Systems.
    this.traffic.update(dt, this.playerVehicle, colliders);
    this.pedestrians.update(dt);
    this.police.update(dt, px, pz, this.playerVehicle, colliders, (kind) => {
      if (kind === 'ram' && !inCar) {
        this.player.damage(14);
        this.cameraRig.addShake(0.5);
        this.sound.crash();
      }
      if (kind === 'busted' && !inCar && this.state === 'playing') this._gameOver('busted');
    }, heading);
    this.missions.update(dt, px, pz, this.playerVehicle, this.police.stars, (k, d) => this._missionEvent(k, d));
    this.combat.update(dt, px, pz, (kind) => {
      if (kind === 'health') { this.player.heal(40); this.sound.pickup(); this.hud.toast('Health +40'); }
      if (kind === 'armor') { this.player.addArmor(50); this.sound.pickup(); this.hud.toast('Armor +50'); }
      if (kind === 'ammo') {
        for (const w of ['pistol', 'smg', 'shotgun']) this.combat.ammo[w].reserve += 24;
        this.sound.pickup(); this.hud.toast('Ammo +24'); 
      }
    });

    // Rivals shoot back.
    for (let i = this.rivals.length - 1; i >= 0; i -= 1) {
      const r = this.rivals[i];
      if (r.dead) {
        r.fade -= dt;
        if (r.fade <= 0) {
          this.scene.remove(r.mesh);
          this.rivals.splice(i, 1);
        }
        continue;
      }
      const d = dist2D(r.mesh.position.x, r.mesh.position.z, px, pz);
      r.mesh.rotation.y = Math.atan2(px - r.mesh.position.x, pz - r.mesh.position.z);
      r.shootTimer -= dt;
      if (r.shootTimer <= 0 && d < 45) {
        r.shootTimer = range(this.rng, 1.3, 2.2);
        const proxy = { x: px, z: pz, health: 100 };
        const heading = Math.atan2(px - r.mesh.position.x, pz - r.mesh.position.z);
        const hits = this.combat.fire(r.mesh.position.x, 1.3, r.mesh.position.z, heading, [proxy], (s) => this.sound.shot(), { free: true });
        if (hits.length > 0) {
          this.player.damage(100 - proxy.health > 0 ? 5 : 0);
          this.cameraRig.addShake(0.15);
        }
      }
    }

    // Mission start marker + taxi stands.
    const nextMission = this.missions.currentDef();
    this._missionStartMarker.visible = !this.missions.active && !!nextMission;
    if (!this.missions.active && nextMission) {
      if (dist2D(px, pz, 32, 96) < 6) {
        this.hud.setMission(nextMission.name, `Press ENTER to start: ${nextMission.brief}`, null);
        if (input.wasPressed('Enter')) {
          input.consume('Enter');
          this.missions.startMission((k, d) => this._missionEvent(k, d));
        }
      }
    }
    if (!this.missions.active && !this.missions.taxi) {
      for (const s of this.missions.stands) {
        if (dist2D(px, pz, s.x, s.z) < 6) {
          this.hud.setMission('TAXI STAND', 'Press T to pick up a fare', null);
          if (input.wasPressed('KeyT')) {
            input.consume('KeyT');
            this.missions.startTaxi((k, d) => this._missionEvent(k, d));
          }
          break;
        }
      }
    }

    // Player death.
    if (this.player.dead && this.state === 'playing') {
      this._gameOver('wasted');
    }

    // Camera.
    const speed = inCar ? this.playerVehicle.speed : this.player.speed;
    const steer = inCar ? this.playerVehicle.steer : 0;
    this.cameraRig.update(dt, px, pz, heading, speed, steer);
    const fwd = new THREE.Vector3();
    this.cameraRig.camera.getWorldDirection(fwd);
    this.cameraHeading = Math.atan2(fwd.x, fwd.z);

    // Siren when the police are close.
    let nearestCop = Infinity;
    for (const c of this.police.cars) nearestCop = Math.min(nearestCop, dist2D(c.x, c.z, px, pz));
    this.sound.setSiren(this.police.stars > 0 && nearestCop < 70, dt);

    // HUD.
    this.hud.setMoney(this.money);
    this.hud.setClock(this.hour, this.day);
    this.hud.setWanted(this.police.stars);
    this.hud.setHealth(this.player.health, this.player.armor);
    if (this.missions.active) {
      const m = this.missions.active;
      const label = m.def.steps[m.step]?.label ?? '';
      const extra = m.def.steps[m.step]?.type === 'kill' ? ` (${m.kills}/${m.def.steps[m.step].count})` : '';
      this.hud.setMission(`${m.def.name} · $${m.def.payout.toLocaleString('en-US')}`, label + extra, m.timer);
    } else if (this.missions.taxi) {
      this.hud.setMission('TAXI FARE', `Drive the passenger to the gold marker — $${this.missions.taxi.fare}`, null);
    } else if (!nextMission) {
      this.hud.setMission('KING OF THE BAY', 'All 6 missions done. Free roam, taxi fares, and 10 neon crates.', null);
    }
    this.hud.setSpeed(Math.abs(speed) * 3.6, inCar ? this.playerVehicle.def.name : 'ON FOOT');
    const w = this.combat.current();
    const slots = ['pistol', 'smg', 'shotgun'].map((s, i) => {
      const label = WEAPONS[s].name;
      return s === this.combat.weapon ? `<b>${i + 1} ${label}</b>` : `${i + 1} ${label}`;
    }).join(' · ');
    this.hud.setWeapon(w.name, this.combat.ammoText(), slots);
    const marker = this.missions.marker
      ? { x: this.missions.marker.position.x, z: this.missions.marker.position.z }
      : this.missions.taxi
        ? { x: this.missions.taxi.drop.x, z: this.missions.taxi.drop.z }
        : null;
    this.hud.drawMinimap(px, pz, heading, marker, this.police.cars, this.missions.taxi ? this.missions.taxi.drop : null, this.missions.crates);

    // Save every 10 s.
    this.saveTimer += dt;
    if (this.saveTimer > 10) {
      this.saveTimer = 0;
      this.save.playSeconds += 10;
      this._persist();
    }

    this.renderer.render(this.scene, this.cameraRig.camera);
    if (this.shotMode && this.frames === 3) window.__neonBayReady = true;
    // Screenshot readiness: the chase camera converges on the moving player
    // in game time, which runs slow under software rendering — only signal
    // the shot once the camera has settled behind the player.
    if (this.shotMode) {
      const dist = this.cameraRig.mode === 0 ? 13.5 : 8.5;
      const tx = px - Math.sin(heading) * dist;
      const tz = pz - Math.cos(heading) * dist;
      const cd = Math.hypot(this.cameraRig.pos.x - tx, this.cameraRig.pos.z - tz);
      this._shotSettle = cd < 5 ? (this._shotSettle || 0) + 1 : 0;
      if (this._shotSettle > 8) window.__neonBayShotReady = true;
    }
    input.endFrame();
  }
}

window.__neonBay = new Game();
$('loading').classList.add('hidden');
