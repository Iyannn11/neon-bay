// Neon Bay — the game itself. Wires world, player, vehicles, crowd, police,
// missions, weather, sound and HUD into one loop: third-person mouse-look
// camera, shooting with tracers, car entry, shops, dialogue, wanted chases,
// save/load, settings, and a ?shot=N mode that stages the four screenshots.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, WEAPONS, SHOP, REPAIR_PRICE, OUTFIT_PRICE, OUTFITS } from './config.js';
import { clamp, lerp, angleLerp } from './random.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Vehicle, Traffic } from './vehicles.js';
import { Crowd } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Weather } from './weather.js';
import { HUD } from './hud.js';

const SAVE_KEY = 'neon-bay-save-v1';

export class Game {
  constructor() {
    const canvas = document.getElementById('game-canvas');
    this.canvas = canvas;
    // ?noaa=1 disables MSAA — only used by the headless test rig, where
    // SwiftShader antialiasing is brutally slow. Real browsers keep MSAA on.
    const noAA = new URLSearchParams(window.location.search).has('noaa');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !noAA, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(10, 5, 16);

    this.sound = new SoundBank();
    this.input = new Input(canvas);
    this.world = new World(this.scene);
    this.player = new Player(this.scene, mulberry32ish());
    this.traffic = new Traffic(this.scene, this.world);
    this.crowd = new Crowd(this.scene, this.world);
    this.police = new Police(this.scene, this.world, this.sound);
    this.weather = new Weather(this.scene);
    this.hud = new HUD(this.input, {
      buy: (item) => this.buy(item),
      closeShop: () => this.closeShop(),
      resume: () => this.resumeGame(),
      restart: () => this.restartGame(),
      start: () => this.startGame(),
      settings: (s) => this.applySettings(s),
      resetSave: () => this.resetSave(),
      pause: () => this.pauseGame(),
    });
    this.missions = new Missions(this.scene, this.world, {
      cash: (a, reason) => this.addCash(a, reason),
      toast: (t) => this.hud.toast(t),
      banner: (t, s) => this.hud.banner(t, s),
    });

    this.state = 'start'; // 'start' | 'playing' | 'paused' | 'gameover'
    this.shopOpen = false;
    this.dialogueOpen = false;
    this.settings = { volume: 0.7, sensitivity: 1.0, quality: 'high', weather: 'sunny' };
    this.camYaw = Math.PI * 0.75;
    this.camPitch = 0.32;
    this.fov = 60;
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.lastShotAt = 0;
    this.m5Started = false;
    this.lastMissionId = null;
    this.shotMode = 0;
    this.shotCamera = null;
    this.shotPose = null;
    this.shotCops = [];
    this._m5HeatDone = false;
    this._tracerTimer = 0;
    this._flashTimer = 0;

    this._parkedVehicles();
    this._makeEffects();
    this._bindKeys();
    this._loadSave();
    this._applyQuality();
    this._readShotParams();
    this._exposeDebug();

    window.addEventListener('resize', () => this._resize());
    canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.shopOpen && !this.dialogueOpen) this.input.lockPointer();
    });
    this.clock = new THREE.Clock();
    this._loop();
  }

  // ---------- setup ----------
  _parkedVehicles() {
    this.parked = [];
    const mk = (kind, color, x, z, h) => {
      const v = new Vehicle(this.scene, kind, color, x, z, h);
      this.parked.push(v);
      return v;
    };
    this.sportCar = mk('sport', 0xd23c2e, -20, 44, Math.PI / 2);
    mk('sedan', 0x2e6fd2, 44, -20, -Math.PI / 2);
    mk('sedan', 0xe8e8e8, -44, 96, 0);
    this.plazaBike = mk('bike', 0xd23c2e, 12, -12, Math.PI);
    this.beachBike = mk('cruiser', 0x2e6fd2, 264, 24, -Math.PI / 2);
    mk('sedan', 0x7a4fd2, 160, -64, Math.PI);
  }

  _makeEffects() {
    // bullet tracer
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95 }));
    this.tracer.visible = false;
    this.scene.add(this.tracer);
    // impact spark
    this.spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    this.spark.visible = false;
    this.scene.add(this.spark);
    // muzzle flash light
    this.flash = new THREE.PointLight(0xffc861, 0, 14, 1.8);
    this.scene.add(this.flash);
    // headlight for the player's vehicle at night
    this.headlight = new THREE.SpotLight(0xfff6c8, 0, 55, 0.55, 0.5, 1.1);
    this.scene.add(this.headlight);
    this.scene.add(this.headlight.target);
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
      }
      if (e.code === 'Escape' && this.shopOpen) this.closeShop();
      if (e.code === 'Escape' && this.dialogueOpen) this.hideDialogue();
    });
  }

  _readShotParams() {
    const q = new URLSearchParams(window.location.search);
    const shot = parseInt(q.get('shot') || '0', 10);
    if (shot >= 1 && shot <= 4) {
      this.shotMode = shot;
      this.state = 'playing';
      this.hud.setScreen('playing');
      this.weather.autoCycle = false;
      this._applyShot(shot);
    }
  }

  // ---------- save / load ----------
  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s.cash !== 'number') return;
      this.savedData = s;
    } catch (e) { /* storage unavailable — play fresh */ }
  }

  saveGame() {
    if (this.shotMode) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        outfit: this.player.outfit,
        weapon: this.player.weapon,
        ammo: this.player.ammo,
        mag: this.player.mag,
        health: this.player.health,
        armor: this.player.armor,
        missionIndex: this.missions.index,
        crates: this.missions.cratesCollected,
        x: this.player.pos.x,
        z: this.player.pos.z,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  resetSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.savedData = null;
    this.hud.toast('Save cleared — next start is a fresh game.');
  }

  _applySave() {
    const s = this.savedData;
    if (!s) return;
    this.player.cash = s.cash;
    this.player.setOutfit(s.outfit || 0);
    this.player.weapon = s.weapon || 'smg';
    this.player.ammo = s.ammo || this.player.ammo;
    this.player.mag = s.mag || this.player.mag;
    this.player.health = s.health ?? 100;
    this.player.armor = s.armor ?? 0;
    this.player.pos.set(s.x ?? 8, 0, s.z ?? 8);
    // resume the mission chain where it stopped
    if (typeof s.missionIndex === 'number' && s.missionIndex > 0 && s.missionIndex < 6) {
      this.missions.index = s.missionIndex;
      this.missions._startMission(s.missionIndex);
    }
    this.missions.cratesCollected = s.crates || 0;
  }

  // ---------- flow ----------
  startGame() {
    this.sound.ensure();
    this._applySave();
    this.state = 'playing';
    this.hud.setScreen('playing');
    this.hud.toast('Welcome to Neon Bay. Follow the yellow marker.');
    this.input.lockPointer();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.unlockPointer();
    this.hud.setScreen('paused');
    this.saveGame();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.setScreen('playing');
    this.sound.ensure();
  }

  restartGame() {
    this.player.health = 100;
    this.player.armor = 0;
    this.player.pos.set(8, 0, 8);
    this.player.dead = false;
    this.police.heat = 0;
    this.police.level = 0;
    this.state = 'playing';
    this.hud.setScreen('playing');
    this.hud.toast('Back on the streets.');
  }

  _busted() {
    const lost = Math.min(this.player.cash, 150);
    this.player.cash -= lost;
    this.police.heat = 0;
    this.police.level = 0;
    this.player.pos.set(8, 0, 8);
    this.player.heading = Math.PI * 0.75;
    this.hud.banner('BUSTED', `The cops took $${lost}. Lay low for a while.`);
    this.sound.busted();
  }

  _wasted() {
    const lost = Math.min(this.player.cash, 250);
    this.player.cash -= lost;
    this.police.heat = 0;
    this.police.level = 0;
    this.state = 'gameover';
    this.input.unlockPointer();
    this.hud.setScreen('gameover');
    const go = document.getElementById('gameover-sub');
    if (go) go.textContent = `You were wasted. The hospital took $${lost}.`;
  }

  addCash(amount, reason) {
    this.player.cash += amount;
    this.sound.cash();
    if (reason) this.hud.toast(`+$${amount} — ${reason}`);
  }

  // ---------- settings ----------
  applySettings(s) {
    Object.assign(this.settings, s);
    if (s.volume !== undefined) this.sound.setVolume(this.settings.volume);
    if (s.sensitivity !== undefined) this.input.sensitivity = this.settings.sensitivity;
    if (s.quality !== undefined) this._applyQuality();
    if (s.weather !== undefined) {
      this.weather.setRain(this.settings.weather === 'rain');
      this.sound.rain(this.settings.weather === 'rain');
    }
    this.saveGame();
  }

  _applyQuality() {
    const q = this.settings.quality;
    if (q === 'low') {
      this.renderer.setPixelRatio(1);
      this.world.sun.castShadow = false;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.world.sun.castShadow = true;
      this.world.sun.shadow.mapSize.set(512, 512);
      if (this.world.sun.shadow.map) { this.world.sun.shadow.map.dispose(); this.world.sun.shadow.map = null; }
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.world.sun.castShadow = true;
      this.world.sun.shadow.mapSize.set(1024, 1024);
      if (this.world.sun.shadow.map) { this.world.sun.shadow.map.dispose(); this.world.sun.shadow.map = null; }
    }
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- economy ----------
  buy(item) {
    const def = SHOP[item];
    if (!def) return;
    if (this.player.cash < def.price) { this.sound.error(); this.hud.toast('Not enough cash.'); return; }
    this.player.cash -= def.price;
    if (item === 'health') this.player.heal(40);
    if (item === 'armor') this.player.armor = clamp(this.player.armor + 50, 0, 100);
    if (item === 'ammo') this.player.ammo[this.player.weapon] += 60;
    this.sound.cash();
    this.hud.toast(`${def.name} — $${def.price}`);
    this.hud.showShop(this.player.cash);
  }

  closeShop() {
    this.shopOpen = false;
    this.hud.hideShop();
  }

  hideDialogue() {
    this.dialogueOpen = false;
    this.hud.hideDialogue();
  }

  // ---------- shooting ----------
  _tryShoot() {
    const now = performance.now() / 1000;
    if (this.reloadTimer > 0) return;
    const w = this.player.weaponDef;
    // Empty magazine: pulling the trigger always starts a reload, even
    // while the previous shot's cooldown is still running.
    if (this.player.mag[this.player.weapon] <= 0) {
      this._startReload();
      return;
    }
    if (this.fireCooldown > 0) return;
    this.player.mag[this.player.weapon]--;
    this.fireCooldown = w.rate;
    this.lastShotAt = now;
    this.player.recoil = 1;
    this.sound.shot(this.player.weapon);
    this.police.addHeat(2);

    // march a ray from the camera centre and take the first hit
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const muzzle = this.player.muzzle();
    const pellets = w.pellets || 1;
    let end = origin.clone().addScaledVector(dir, w.range);
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      if (pellets > 1) {
        d.x += (Math.random() - 0.5) * w.spread * 2;
        d.y += (Math.random() - 0.5) * w.spread * 2;
        d.normalize();
      } else {
        d.x += (Math.random() - 0.5) * w.spread;
        d.y += (Math.random() - 0.5) * w.spread;
        d.normalize();
      }
      const hit = this._marchRay(origin, d, w.range, w.damage);
      if (hit && hit.dist < end.distanceTo(origin)) end = hit.point;
    }
    // tracer from the muzzle to the impact
    const pos = this.tracer.geometry.attributes.position.array;
    pos[0] = muzzle.origin.x; pos[1] = muzzle.origin.y; pos[2] = muzzle.origin.z;
    pos[3] = end.x; pos[4] = end.y; pos[5] = end.z;
    this.tracer.geometry.attributes.position.needsUpdate = true;
    this.tracer.visible = true;
    this._tracerTimer = 0.06;
    this.spark.position.copy(end);
    this.spark.visible = true;
    this._flashTimer = 0.05;
    this.flash.position.copy(muzzle.origin);
    this.flash.intensity = 60;
    // pedestrians nearby flee from the shot
    this.crowd.scare(this.player.pos.x, this.player.pos.z, 26);
    if (this.player.mag[this.player.weapon] === 0) this._startReload();
  }

  _marchRay(origin, dir, range, damage) {
    const step = 0.5;
    const p = new THREE.Vector3();
    for (let d = 1; d <= range; d += step) {
      p.copy(origin).addScaledVector(dir, d);
      if (p.y < 0) p.y = 0.05;
      // buildings
      for (const c of this.world.colliders) {
        if (p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y < 60) {
          return { point: p.clone(), dist: d };
        }
      }
      // mission guards
      const g = this.missions.hitGuard(p);
      if (g) return { point: p.clone(), dist: d };
      // cop cars
      const cop = this.police.nearestCopVehicle(p.x, p.z, 2.2);
      if (cop && Math.abs(p.y - 1) < 1.6) {
        if (this.police.hitCop(cop, damage)) this.hud.toast('Cop car disabled!');
        return { point: p.clone(), dist: d };
      }
      // traffic / parked vehicles
      for (const v of [...this.traffic.allVehicles(), ...this.parked]) {
        const vp = v.group.position;
        if (Math.hypot(vp.x - p.x, vp.z - p.z) < 2 && Math.abs(p.y - 1) < 1.4) {
          v.damage(14);
          return { point: p.clone(), dist: d };
        }
      }
      // pedestrians
      const w = this.crowd.nearestWalker(p.x, p.z, 1.3);
      if (w && Math.abs(p.y - 1.2) < 1.4) {
        w.walker.dead = true;
        w.walker.mesh.rotation.x = -Math.PI / 2;
        w.walker.mesh.position.y = 0.3;
        this.police.addHeat(25);
        this.hud.toast('Pedestrian down — the cops noticed.');
        return { point: p.clone(), dist: d };
      }
    }
    return null;
  }

  _startReload() {
    const w = this.player.weapon;
    const pool = this.player.ammo[w];
    if (pool <= 0) { this.sound.error(); return; }
    this.reloadTimer = 1.1;
    this.sound.click();
  }

  _finishReload() {
    const w = this.player.weapon;
    const def = WEAPONS[w];
    const need = def.mag - this.player.mag[w];
    const take = Math.min(need, this.player.ammo[w]);
    this.player.ammo[w] -= take;
    this.player.mag[w] += take;
    this.sound.click();
  }

  // ---------- interaction ----------
  _nearestVehicle(maxDist = 4.5) {
    let best = null, bd = maxDist;
    const all = [...this.parked, ...this.traffic.allVehicles(), this.traffic.taxi];
    for (const v of all) {
      if (v.driver === 'player') continue;
      const d = Math.hypot(v.group.position.x - this.player.pos.x, v.group.position.z - this.player.pos.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  _interact() {
    const p = this.player.pos;
    // In a vehicle: PAY N SPRAY repairs, otherwise E exits the vehicle.
    if (this.player.inVehicle) {
      const sp = this.world.markers.spray;
      const v = this.player.inVehicle;
      if (sp && Math.hypot(p.x - sp.x, p.z - sp.z) < 7 && v.condition < 100) {
        if (this.player.cash < REPAIR_PRICE) { this.sound.error(); this.hud.toast('Repair costs $100.'); return; }
        this.player.cash -= REPAIR_PRICE;
        v.condition = 100;
        this.sound.cash();
        this.hud.toast('Car repaired — good as new!');
        return;
      }
      this._exitVehicle();
      return;
    }
    // 1. talk to an NPC
    const talker = this.crowd.nearestTalker(p.x, p.z, 3.4);
    if (talker && !this.player.inVehicle) {
      const line = talker.lines[Math.floor(Math.random() * talker.lines.length)];
      this.hud.showDialogue(talker.name, line);
      this.dialogueOpen = true;
      this.sound.click();
      if (!talker.talked && Math.random() < 0.35) {
        const tip = 15 + Math.floor(Math.random() * 16);
        this.addCash(tip, `Tip from ${talker.name}`);
      }
      talker.talked = true;
      talker.mesh.rotation.y = Math.atan2(p.x - talker.mesh.position.x, p.z - talker.mesh.position.z);
      return;
    }
    // 2. AMMU-NATION shop
    const ammu = this.world.markers.ammu;
    if (ammu && Math.hypot(p.x - ammu.x, p.z - ammu.z) < 5 && !this.player.inVehicle) {
      this.shopOpen = true;
      this.hud.showShop(this.player.cash);
      this.sound.click();
      return;
    }
    // 3. THREADS wardrobe — change outfit for $50
    const th = this.world.markers.threads;
    if (th && Math.hypot(p.x - th.x, p.z - th.z) < 5 && !this.player.inVehicle) {
      if (this.player.cash < OUTFIT_PRICE) { this.sound.error(); this.hud.toast('Need $50 for a new outfit.'); return; }
      this.player.cash -= OUTFIT_PRICE;
      this.player.setOutfit(this.player.outfit + 1);
      this.sound.cash();
      this.hud.toast(`New outfit: ${OUTFITS[this.player.outfit].name} (-$${OUTFIT_PRICE})`);
      return;
    }
    // 4. PAY N SPRAY is handled inside the in-vehicle branch above.
    // 5. enter / exit a vehicle
    if (!this.player.inVehicle && !this.player.entering) {
      const v = this._nearestVehicle();
      if (v) {
        if (v.driver === 'traffic') this.police.addHeat(15);
        else this.police.addHeat(6);
        v.driver = 'player';
        this.player.startEnter(v, v.doorPos());
        this.sound.click();
        return;
      }
    }
  }

  _exitVehicle() {
    const v = this.player.inVehicle;
    if (!v || this.player.entering) return;
    v.driver = null;
    v.speed = 0;
    this.player.startExit(v.exitPos());
    this.sound.click();
  }

  // ---------- per-frame ----------
  _loop() {
    requestAnimationFrame(() => this._loop());
    // _loopPaused is a test-rig hook only: logic tests drive _update() by hand
    // while the render loop is paused, so CDP round-trips stay fast.
    if (this._loopPaused) { this.input.endFrame(); return; }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (this.state === 'playing') this._update(dt, t);
    // world ambience always animates (even on the start screen)
    const env = this.weather.update(this.state === 'playing' ? dt : 0, this.camera.position, this.world);
    this.world.update(this.state === 'playing' ? dt : 0, t, this.camera.position, env);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _update(dt, t) {
    const input = this.input;
    const player = this.player;

    // mouse look (pointer lock) — yaw orbits, pitch clamps
    if (input.locked) {
      const { dx, dy } = input.consumeMouseDelta();
      this.camYaw -= dx * 0.0022;
      this.camPitch = clamp(this.camPitch + dy * 0.0018, -0.35, 0.85);
    }

    // mission 5 starts the heat once
    const cur = this.missions.current;
    if (cur && cur.id === 'm5' && !this._m5HeatDone) {
      this.police.addHeat(65);
      this._m5HeatDone = true;
      this.hud.toast('3 stars! Lose the cops!');
    }
    if (cur && cur.id !== 'm5') this._m5HeatDone = false;

    // weapon switching + reload
    if (input.pressed('Digit1')) { player.weapon = 'pistol'; this.sound.click(); }
    if (input.pressed('Digit2')) { player.weapon = 'smg'; this.sound.click(); }
    if (input.pressed('Digit3')) { player.weapon = 'shotgun'; this.sound.click(); }
    if (input.pressed('KeyR')) this._startReload();
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this._finishReload();
    }
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // weather toggle
    if (input.pressed('KeyV')) {
      const raining = this.weather.toggleRain();
      this.applySettings({ weather: raining ? 'rain' : 'sunny' });
      const w = document.getElementById('weather-toggle');
      if (w) w.value = raining ? 'rain' : 'sunny';
      this.hud.toast(raining ? 'Rain rolling in.' : 'Skies clearing.');
    }

    // photo spot
    if (input.pressed('KeyF')) this.missions.tryPhoto(player.pos.x, player.pos.z);
    // taxi job (T near the stand, while in the taxi)
    if (input.pressed('KeyT')) this.missions.tryTaxiJob(player);
    // interact / enter / exit (E handles both, via _interact)
    if (input.pressed('KeyE') || input.touchPressed.car) this._interact();

    const inVehicle = player.inVehicle;
    const aiming = !inVehicle && input.aiming() && !this.shopOpen && !this.dialogueOpen;
    player.aiming = aiming;
    player._sprinting = input.sprinting();

    // --- movement ---
    if (!this.shopOpen && !this.dialogueOpen) {
      if (inVehicle) {
        const v = inVehicle;
        const throttle = (input.held('KeyW') || input.held('ArrowUp') ? 1 : 0) + (input.held('KeyS') || input.held('ArrowDown') ? -1 : 0) + (input.joy.active ? -input.joy.y : 0);
        const steer = (input.held('KeyA') || input.held('ArrowLeft') ? -1 : 0) + (input.held('KeyD') || input.held('ArrowRight') ? 1 : 0) + (input.joy.active ? input.joy.x : 0);
        const spd = v.drive(dt, { throttle: clamp(throttle, -1, 1), steer: clamp(steer, -1, 1) }, this.world, [...this.traffic.allVehicles(), ...this.parked]);
        if (v.isBike) {
          player.group.visible = true;
          player.group.position.copy(v.group.position);
          player.group.position.y = 0.15;
          player.group.rotation.y = v.heading;
          player.ridePose(dt);
        }
        this.sound.engine(Math.abs(spd) > 0.5, clamp(Math.abs(spd) / v.topSpeed, 0, 1));
        // stunts + race gates while driving
        this.missions.tryStunt(v.group.position.x, v.group.position.z, Math.abs(spd));
        this.missions.tryRaceGate(v.group.position.x, v.group.position.z);
        // horn
        if (input.pressed('KeyH')) this.sound.horn();
        if (v.condition <= 0) this.hud.toast('This wreck barely moves — visit PAY N SPRAY.');
      } else {
        // on foot: camera-relative movement
        const mv = input.moveVector();
        const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
        const rx = fz, rz = -fx;
        const wx = fx * mv.z + rx * mv.x;
        const wz = fz * mv.z + rz * mv.x;
        const wantJump = input.pressed('Space') || input.touchPressed.jump;
        if (aiming) player._aimHeading = this.camYaw;
        player._aimPitch = -Math.sin(this.camPitch) * 0.5;
        player.update(dt, { x: wx, z: wz }, wantJump, this.world);
        if (wantJump && player.onGround) this.sound.jump();
        this.sound.engine(false);
        // crates on foot
        for (const c of this.world.crates) {
          if (!c.taken && Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 2.2) {
            this.missions.collectCrate(c);
            this.sound.pickup();
          }
        }
        // shooting
        const w = player.weaponDef;
        const wantFire = w.auto ? input.firing() : input.mouseClicked() || input.touchPressed.fire;
        if (wantFire && !this.shopOpen && !this.dialogueOpen) this._tryShoot();
      }
    }

    // --- systems ---
    this.traffic.update(dt, player.pos);
    this.crowd.update(dt);
    const busted = this.police.update(dt, player, this.world);
    if (busted === 'busted') this._busted();
    this.missions.update(dt, { player, police: this.police });

    // player death by cop damage is via takeDamage; check wasted
    if (player.dead && this.state === 'playing') this._wasted();

    // --- camera ---
    this._updateCamera(dt);

    // --- effects timers ---
    if (this._tracerTimer > 0) { this._tracerTimer -= dt; if (this._tracerTimer <= 0) { this.tracer.visible = false; this.spark.visible = false; } }
    if (this._flashTimer > 0) { this._flashTimer -= dt; this.flash.intensity = Math.max(0, this.flash.intensity - dt * 1200); }

    // headlight follows the player's vehicle at night
    const night = this.weather.night01;
    if (inVehicle && night > 0.4) {
      const v = inVehicle;
      const f = v.forward();
      this.headlight.position.copy(v.group.position).addScaledVector(f, 2).add(new THREE.Vector3(0, 1, 0));
      this.headlight.target.position.copy(v.group.position).addScaledVector(f, 24);
      this.headlight.intensity = 140;
    } else {
      this.headlight.intensity = 0;
    }

    // --- HUD ---
    this._updatePrompt();
    this.hud.update({
      health: player.health,
      armor: player.armor,
      cash: player.cash,
      wanted: this.police.level,
      weapon: player.weapon,
      ammo: player.ammo[player.weapon],
      mag: player.mag[player.weapon],
      vehicle: inVehicle ? { condition: inVehicle.condition, label: inVehicle.isBike ? (inVehicle.kind === 'cruiser' ? 'Cruiser' : 'Sport Bike') : inVehicle.kind === 'sport' ? 'Sports Car' : inVehicle.kind === 'taxi' ? 'Taxi' : inVehicle.kind === 'cop' ? 'Police' : 'Sedan' } : null,
      speedKmh: inVehicle ? Math.abs(inVehicle.speed) * 3.6 : Math.abs(player.moveSpeed) * 3.6,
      missionText: this.missions.objectiveText(),
      timeLabel: this._timeLabel(),
    });
    this.hud.drawMinimap(player, this.world, this.world.markers, this.police.cops, this.missions.markerPos());

    // shot-mode pose override (character frozen mid-stride for the cover)
    if (this.shotPose) {
      player.walkPhase = this.shotPose.phase;
      player._pose(0, this.shotPose.mode, this.shotPose.speed01);
    }

    // autosave
    this._saveTimer = (this._saveTimer || 0) + dt;
    if (this._saveTimer > 20) { this._saveTimer = 0; this.saveGame(); }
  }

  _timeLabel() {
    const mins = Math.floor(this.weather.time * 24 * 60);
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const rain = this.weather.rain01 > 0.5 ? ' · Rain' : '';
    const gold = this.weather.golden01 > 0.5 ? ' · Golden hour' : '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${rain}${gold}`;
  }

  _updatePrompt() {
    // Staged screenshots hide the interactive prompt (and the crosshair,
    // hidden in _applyShot) — they are play hints, not game content.
    if (this.shotMode) { this.hud.hidePrompt(); return; }
    if (this.shopOpen || this.dialogueOpen || this.state !== 'playing') { this.hud.hidePrompt(); return; }
    const p = this.player.pos;
    const v = this.player.inVehicle;
    let text = '';
    if (!v) {
      const talker = this.crowd.nearestTalker(p.x, p.z, 3.4);
      const ammu = this.world.markers.ammu;
      const th = this.world.markers.threads;
      const near = this._nearestVehicle(4.5);
      if (talker) text = `E — Talk to ${talker.name}`;
      else if (ammu && Math.hypot(p.x - ammu.x, p.z - ammu.z) < 5) text = 'E — AMMU-NATION (buy weapons & gear)';
      else if (th && Math.hypot(p.x - th.x, p.z - th.z) < 5) text = 'E — THREADS (change outfit — $50)';
      else if (near) text = `E — Enter ${near.isBike ? 'bike' : 'car'}`;
      else {
        for (const s of this.world.photoSpots) {
          if (Math.hypot(p.x - s.x, p.z - s.z) < 3.5) { text = 'F — Take photo (+$50)'; break; }
        }
      }
    } else {
      const sp = this.world.markers.spray;
      if (sp && Math.hypot(p.x - sp.x, p.z - sp.z) < 7 && v.condition < 100) text = 'E — PAY N SPRAY (repair — $100)';
      else text = 'E — Exit vehicle';
      if (v.kind === 'taxi' && Math.hypot(p.x - 20, p.z - 20) < 8 && !this.missions.taxi.active) text = 'T — Start taxi job';
    }
    if (text) this.hud.showPrompt(text);
    else this.hud.hidePrompt();
  }

  _updateCamera(dt) {
    if (this.shotCamera) {
      this.camera.position.copy(this.shotCamera.pos);
      this.camera.lookAt(this.shotCamera.look);
      return;
    }
    const player = this.player;
    const inVehicle = player.inVehicle;
    const anchor = inVehicle ? inVehicle.group.position : player.pos;
    const aiming = player.aiming;
    // aim zooms the camera in and narrows the FOV
    const targetFov = aiming ? 42 : 60;
    this.fov = lerp(this.fov, targetFov, Math.min(1, dt * 8));
    if (Math.abs(this.camera.fov - this.fov) > 0.1) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const dist = inVehicle ? 9.5 : aiming ? 4.6 : 7.2;
    const height = 2.1 + Math.sin(this.camPitch) * dist * 0.55;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const cx = anchor.x - fx * dist * Math.cos(this.camPitch);
    const cz = anchor.z - fz * dist * Math.cos(this.camPitch);
    const cy = (anchor.y || 0) + height;
    // keep the camera out of buildings
    const c = this.world.collide(cx, cz, 0.6);
    this.camera.position.set(c.x, Math.max(cy, 0.9), c.z);
    const lookY = (anchor.y || 0) + (inVehicle ? 1.4 : 1.55) - Math.sin(this.camPitch) * 1.2;
    this.camera.lookAt(anchor.x + fx * 2, lookY, anchor.z + fz * 2);
  }

  // ---------- screenshot staging ----------
  _applyShot(n) {
    const p = this.player;
    // hide the crosshair for staged shots (it would sit on the hero)
    const ch = document.getElementById('crosshair');
    if (ch) ch.style.display = 'none';
    const setCam = (x, y, z, lx, ly, lz) => {
      this.shotCamera = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(lx, ly, lz) };
    };
    if (n === 1) {
      // COVER: night neon street, Kai mid-stride, SMG in hand, cop behind
      this.weather.setTimeOfDay(0.78);
      this.weather.setRain(false);
      this.police.frozen = true;
      p.pos.set(-10, 0, 6);
      p.heading = 4.9; // 3/4 view to the camera — stride reads from the side
      p.group.rotation.y = p.heading;
      p.aiming = false;
      this.camYaw = 2.55;
      this.shotPose = { phase: Math.PI / 2, mode: 'walk', speed01: 0.7 };
      setCam(-16, 2.4, 12.5, -9.5, 1.3, 5.5);
      this.police.heat = 40;
      this.police.level = 2;
      // no staged cop here: the plaza fountain hides any car parked behind
      // the player from this camera; the 2 wanted stars carry the signal
      this.missions.index = 0;
    } else if (n === 2) {
      // DRIVING: golden-hour sunset on the highway ring in the red sports car
      this.weather.setTimeOfDay(0.48);
      this.weather.setRain(false);
      const v = this.sportCar;
      v.group.position.set(40, 0, 288);
      v.heading = -Math.PI / 2; // heading west along the south ring
      v.group.rotation.y = v.heading;
      v.speed = 0; // staged: parked mid-highway, sunset behind the camera
      v.driver = 'player';
      p.inVehicle = v;
      p.group.visible = false;
      // camera southeast of the car, looking northwest at the skyline
      setCam(56, 3.8, 300, 38, 1.3, 288);
      this.missions.index = 0;
    } else if (n === 3) {
      // MISSION: daytime marina showdown, Kai aiming at the guards, wanted 3
      this.weather.setTimeOfDay(0.25);
      this.weather.setRain(false);
      this.police.frozen = true;
      p.pos.set(290, 0, -8);
      p.heading = 1.35;
      p.group.rotation.y = p.heading;
      p.aiming = true;
      this.camYaw = 1.35;
      this.camPitch = 0.3;
      this.shotPose = { phase: 0, mode: 'aim', speed01: 0 };
      setCam(283, 3.0, -14, 294, 1.4, -4);
      this.missions.index = 5;
      this.missions._startMission(5);
      this.police.heat = 65;
      this.police.level = 3;
      const cop1 = new Vehicle(this.scene, 'cop', 0x111318, 300, -10, 2.2);
      const cop2 = new Vehicle(this.scene, 'cop', 0x111318, 262, -44, 1.2);
      this.shotCops.push(cop1, cop2);
      this.police.cops.push({ vehicle: cop1, hp: 100, disabled: false }, { vehicle: cop2, hp: 100, disabled: false });
    } else if (n === 4) {
      // BEACH: golden hour, Kai on the cruiser by the palms and the sea.
      // Bike sits between palm rows (z=44) so no trunk blocks the rider.
      this.weather.setTimeOfDay(0.48);
      this.weather.setRain(false);
      const v = this.beachBike;
      v.group.position.set(276, 0, 48);
      v.heading = -Math.PI / 2 + 0.5;
      v.group.rotation.y = v.heading;
      v.driver = 'player';
      p.inVehicle = v;
      p.group.visible = true;
      p.group.position.copy(v.group.position);
      p.group.position.y = 0.15;
      p.group.rotation.y = v.heading;
      p.ridePose(0);
      // clear the beach of strolling pedestrians — one walked into frame
      for (const w of this.crowd.walkers) {
        if (!w.isTalker) {
          w.mesh.position.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
          w.target = { x: w.mesh.position.x, z: w.mesh.position.z };
        }
      }
      setCam(269, 2.0, 42, 276, 1.2, 48);
      this.missions.index = 0;
    }
    // keep the HUD on for the screenshots
    this.hud.setScreen('playing');
  }

  // ---------- headless test hooks ----------
  _exposeDebug() {
    window.__NEON = {
      version: 10,
      game: this,
      state: () => ({
        screen: this.state,
        cash: this.player.cash,
        health: this.player.health,
        armor: this.player.armor,
        outfit: this.player.outfit,
        weapon: this.player.weapon,
        mag: this.player.mag[this.player.weapon],
        ammo: this.player.ammo[this.player.weapon],
        wanted: this.police.level,
        mission: this.missions.index,
        missionText: this.missions.objectiveText(),
        inVehicle: !!this.player.inVehicle,
        vehicleKind: this.player.inVehicle ? this.player.inVehicle.kind : null,
        vehicleCondition: this.player.inVehicle ? this.player.inVehicle.condition : null,
        pos: { x: this.player.pos.x, z: this.player.pos.z },
        rain: this.weather.rain01,
        night: this.weather.night01,
        time: this.weather.time,
        quality: this.settings.quality,
        volume: this.settings.volume,
        sensitivity: this.settings.sensitivity,
        crates: this.missions.cratesCollected,
        errors: window.__NEON_ERRORS || [],
      }),
      actions: {
        pauseLoop: () => { this._loopPaused = true; },
        resumeLoop: () => { this._loopPaused = false; },
        teleport: (x, z) => { this.player.pos.set(x, 0, z); this.player.vel.set(0, 0, 0); },
        setWeather: (w) => this.applySettings({ weather: w }),
        setTime: (t) => this.weather.setTimeOfDay(t),
        giveCash: (n) => { this.player.cash += n; },
        setWanted: (n) => { this.police.heat = [0, 20, 40, 60, 80, 95][n] || 0; this.police.level = n; this.police.quietTimer = 0; },
        buy: (item) => this.buy(item),
        changeOutfit: () => { this.player.cash = Math.max(this.player.cash, 50); this._interactAtThreads(); },
        talk: () => {
          const t = this.crowd.nearestTalker(this.player.pos.x, this.player.pos.z, 3.4);
          if (t) { this._interact(); return t.name; }
          return null;
        },
        enterVehicle: () => { const v = this._nearestVehicle(6); if (v) { v.driver = 'player'; this.player.startEnter(v, v.doorPos()); return v.kind; } return null; },
        exitVehicle: () => this._exitVehicle(),
        shoot: () => this._tryShoot(),
        jump: () => { this.player.update(0.016, { x: 0, z: 0 }, true, this.world); },
        setMission: (i) => this.missions._startMission(i),
        collectCrateAt: (x, z) => {
          const c = this.world.crates.find((cc) => Math.hypot(cc.x - x, cc.z - z) < 3);
          if (c) this.missions.collectCrate(c);
        },
        openShop: () => { this.shopOpen = true; this.hud.showShop(this.player.cash); },
        closeShop: () => this.closeShop(),
        setQuality: (q) => this.applySettings({ quality: q }),
        setSensitivity: (s) => this.applySettings({ sensitivity: s }),
        setVolume: (v) => this.applySettings({ volume: v }),
      },
    };
  }

  _interactAtThreads() {
    const th = this.world.markers.threads;
    this.player.pos.set(th.x, 0, th.z + 2);
    this._interact();
  }
}

function mulberry32ish() {
  let a = (Date.now() % 2147483647) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// boot
window.addEventListener('error', (e) => {
  (window.__NEON_ERRORS = window.__NEON_ERRORS || []).push(String(e.message || e.error));
});
window.addEventListener('unhandledrejection', (e) => {
  (window.__NEON_ERRORS = window.__NEON_ERRORS || []).push('rejection: ' + String(e.reason));
});

new Game();
