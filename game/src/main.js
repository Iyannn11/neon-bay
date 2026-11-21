// Neon Bay — bootstrap, game loop, camera, vehicles, shooting, shops, save.
// Written fresh for Round 12.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { World } from './world.js';
import { makeCar, makeBike, Driver, Traffic } from './vehicles.js';
import { Player, makeKai } from './player.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Weather } from './weather.js';
import { SHOTS, applyShot, runSelfTest } from './shots.js';
import { MISSIONS, SHOPS, TUNING } from './config.js';
import { clamp, damp } from './random.js';

const SAVE_KEY = 'neonbay-save';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
    this.camera.position.set(0, 6, 30);

    this.sky = new Sky(this.scene);
    this.world = new World(this.scene, this.sky);
    this.player = new Player(this.scene);
    this.hud = new HUD();
    this.traffic = new Traffic(this.scene, this.world);
    this.pedestrians = new Pedestrians(this.scene, this.world);
    this.police = new Police(this.scene, this.world, this.player);
    this.missions = new Missions(this.scene, this.world, this.player, this);
    this.input = new Input(this.canvas, this);
    this.audio = new AudioSys();
    this.weather = new Weather(this.scene);

    this.state = 'title';
    this.hour = 21.6;
    this.freezeClock = false;
    this.camYaw = Math.PI;
    this.camPitch = 0.12;
    this.camMode = 'follow';
    this.shotCam = { pos: new THREE.Vector3(0, 4, 30), look: new THREE.Vector3(0, 4, 0) };
    this.shotName = null;
    this.settings = { sensitivity: 1.0, volume: 0.4 };
    this.headlights = false;
    this.guards = [];
    this.tracers = [];
    this.shopOpen = null;
    this.missionListOpen = false;
    this.isNight = true;

    // the player's own rides
    this.playerCar = makeCar('sport', 0xd21f3c);
    this.playerCar.userData.owned = true;
    this.scene.add(this.playerCar);
    this.playerCarDriver = new Driver(this.playerCar, true);
    this.playerCarDriver.pos.set(6, 0, 34);
    this.playerCarDriver.heading = Math.PI / 2;
    this.bike1 = makeBike(0x1f6fd2);
    this.scene.add(this.bike1);
    this.bike1Driver = new Driver(this.bike1, true);
    this.bike1Driver.pos.set(172, 0, 44);
    this.bike1Driver.heading = 0;
    this.bike2 = makeBike(0xffc233);
    this.scene.add(this.bike2);
    this.bike2Driver = new Driver(this.bike2, true);
    this.bike2Driver.pos.set(-12, 0, 30);
    this.bike2Driver.heading = Math.PI;
    this.drivers = [this.playerCarDriver, this.bike1Driver, this.bike2Driver];
    this.vehicles = [
      { mesh: this.playerCar, driver: this.playerCarDriver },
      { mesh: this.bike1, driver: this.bike1Driver },
      { mesh: this.bike2, driver: this.bike2Driver },
    ];
    this.loadGame();
    this.sky.setTime(this.hour);
    this.bindUI();
    this.wireTouch();

    // shot mode: ?shot=cover|drive|mission|beach&seed=1
    const q = new URLSearchParams(location.search);
    const shot = q.get('shot');
    if (shot && SHOTS[shot]) {
      this.state = 'playing';
      document.getElementById('title-screen').style.display = 'none';
      applyShot(this, shot);
      this.updateCamera(0);
      window.__NEON = window.__NEON || {};
      window.__NEON.ready = false; // flipped true after the first rendered frame
      window.__NEON.shot = shot;
    }
    window.__NEON = window.__NEON || {};
    window.__NEON.game = this;
    window.__NEON.THREE = THREE;
    window.__NEON.test = () => {
      this.state = 'playing';
      document.getElementById('title-screen').style.display = 'none';
      return runSelfTest(this);
    };
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  bindUI() {
    const $ = (id) => document.getElementById(id);
    $('play-btn').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      $('title-screen').style.display = 'none';
      this.state = 'playing';
      this.toast('Welcome to Neon Bay, Kai. Mission: First Fare.');
    });
    $('resume-btn').addEventListener('click', () => {
      $('pause-screen').style.display = 'none';
      this.state = 'playing';
    });
    $('quit-btn').addEventListener('click', () => {
      this.saveGame();
      $('pause-screen').style.display = 'none';
      $('title-screen').style.display = 'flex';
      this.state = 'title';
    });
    $('retry-btn').addEventListener('click', () => {
      $('over-screen').style.display = 'none';
      this.resetRun();
      this.state = 'playing';
    });
    $('shop-close').addEventListener('click', () => this.closeShop());
    $('mission-close').addEventListener('click', () => this.toggleMissionList());
  }

  wireTouch() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    };
    if ('ontouchstart' in window) document.getElementById('touch').style.display = 'block';
    on('t-shoot', () => { this.input.fired = true; });
    on('t-car', () => { this.tryEnterVehicle() || this.exitVehicle(); });
    on('t-jump', () => { this.input.keys['Space'] = true; setTimeout(() => { this.input.keys['Space'] = false; }, 120); });
  }

  toast(msg, ms) { this.hud.toast(msg, ms); }
  setMissionCard(name, brief) { this.hud.setMission(name, brief); }
  setWanted(n) { this.player.wanted = clamp(n, 0, 5); }

  spawnGuards(n) {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
    const spots = [[132, 134], [142, 134], [128, 110]]; // on the marina docks
    for (let i = 0; i < n; i++) {
      const mesh = makeKai(0x3a3f4a);
      mesh.position.set(spots[i][0], 0, spots[i][1]);
      // face the player
      mesh.rotation.y = Math.atan2(this.player.pos.x - spots[i][0], this.player.pos.z - spots[i][1]);
      mesh.userData.armR.rotation.x = -1.25;
      mesh.userData.armL.rotation.x = -1.25;
      mesh.userData.gun.visible = true;
      this.scene.add(mesh);
      this.guards.push({ mesh, hp: 100 });
    }
  }

  resetRun() {
    this.player.health = 100; this.player.armor = 0;
    this.player.pos.set(0, 0, 24);
    this.player.wanted = 0;
    this.setWanted(0);
    this.police.units = [];
    this.missions.startMission(0);
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money, mission: this.missions.idx,
        health: this.player.health, armor: this.player.armor,
        outfit: this.player.outfit, weaponIdx: this.player.weaponIdx,
        ammo: this.player.ammo, reserve: this.player.reserve,
      }));
    } catch (_) {}
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.player.money = s.money;
      if (typeof s.health === 'number') this.player.health = s.health;
      if (typeof s.armor === 'number') this.player.armor = s.armor;
      if (typeof s.weaponIdx === 'number') this.player.weaponIdx = s.weaponIdx;
      if (Array.isArray(s.ammo)) this.player.ammo = s.ammo;
      if (Array.isArray(s.reserve)) this.player.reserve = s.reserve;
    } catch (_) {}
  }

  // --- vehicles ---------------------------------------------------------------
  nearestVehicle(range = 4.5) {
    let best = null, bd = range;
    for (const v of this.vehicles) {
      const d = v.driver.pos.distanceTo(this.player.pos);
      if (d < bd) { bd = d; best = v; }
    }
    // traffic cars are stealable too
    for (const d of this.traffic.cars) {
      const dist = d.pos.distanceTo(this.player.pos);
      if (dist < bd) { bd = dist; best = { mesh: d.v, driver: d, traffic: true }; }
    }
    return best;
  }

  tryEnterVehicle() {
    if (this.player.inVehicle) return false;
    const v = this.nearestVehicle();
    if (!v) return false;
    this.enterVehicle(v.mesh, v.driver);
    return true;
  }

  enterVehicle(mesh, driver) {
    this.player.inVehicle = driver;
    driver.isPlayer = true;
    if (mesh.userData.kind === 'bike') {
      // rider stays visible, seated on the bike
      this.player.mesh.visible = true;
      this.player.mesh.userData.legL.rotation.x = -1.1;
      this.player.mesh.userData.legR.rotation.x = -1.1;
      this.player.mesh.userData.armL.rotation.x = -0.9;
      this.player.mesh.userData.armR.rotation.x = -0.9;
    } else {
      this.player.mesh.visible = false;
    }
    this.player.pos.copy(driver.pos);
    this.camYaw = driver.heading;
    this.audio.engine(true, 0);
    this.toast(mesh.userData.kind === 'bike' ? 'On the bike — W to ride, E to get off.' : 'In the car — W to drive, E to get out.');
  }

  exitVehicle() {
    const d = this.player.inVehicle;
    if (!d) return false;
    const v = d.v;
    this.player.inVehicle = null;
    this.player.mesh.visible = true;
    this.player.mesh.userData.legL.rotation.x = 0;
    this.player.mesh.userData.legR.rotation.x = 0;
    this.player.pos.set(v.position.x + Math.sin(d.heading + 1.2) * 2.2, 0, v.position.z + Math.cos(d.heading + 1.2) * 2.2);
    this.player.heading = d.heading;
    this.audio.engine(false);
    return true;
  }

  // --- shops ---------------------------------------------------------------------
  nearShop() {
    const p = this.player.pos;
    for (const [key, pos] of Object.entries(this.world.shopPos)) {
      if (p.distanceTo(pos) < 5) return key;
    }
    return null;
  }

  openShop(key) {
    this.shopOpen = key;
    const title = document.getElementById('shop-title');
    const items = document.getElementById('shop-items');
    const shop = document.getElementById('shop');
    if (key === 'ammo') {
      title.textContent = 'AMMU-NATION';
      items.innerHTML = SHOPS.ammo.items.map((it) =>
        `<button data-buy="${it.key}">${it.label} — $${it.price}</button>`).join('');
    } else if (key === 'threads') {
      title.textContent = 'THREADS — $50 an outfit';
      items.innerHTML = SHOPS.threads.outfits.map((o) =>
        `<button data-outfit="${o.key}" data-color="${o.jacket}">${o.label} — $${o.price}</button>`).join('');
    } else {
      title.textContent = 'PAY N SPRAY — repair $100';
      items.innerHTML = `<button data-repair="1">Repair vehicle — $${SHOPS.spray.repair}</button>`;
    }
    items.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => this.buyItem(b.dataset.buy)));
    items.querySelectorAll('[data-outfit]').forEach((b) => b.addEventListener('click', () => {
      const o = SHOPS.threads.outfits.find((x) => x.key === b.dataset.outfit);
      if (o && this.player.money >= o.price) {
        this.player.money -= o.price;
        this.player.setOutfit(o.key, parseInt(b.dataset.color));
        this.audio.coin();
        this.toast(`New outfit: ${o.label}`);
        this.closeShop();
      } else this.toast('Not enough cash.');
    }));
    items.querySelectorAll('[data-repair]').forEach((b) => b.addEventListener('click', () => {
      if (this.player.inVehicle && this.player.money >= SHOPS.spray.repair) {
        this.player.money -= SHOPS.spray.repair;
        this.player.inVehicle.v.userData.hp = 100;
        this.audio.coin();
        this.toast('Vehicle repaired.');
        this.closeShop();
      } else this.toast('Get in a vehicle first (and bring $100).');
    }));
    shop.style.display = 'flex';
    this.state = 'shop';
  }

  closeShop() {
    this.shopOpen = null;
    document.getElementById('shop').style.display = 'none';
    if (this.state === 'shop') this.state = 'playing';
  }

  buyItem(key) {
    const it = SHOPS.ammo.items.find((x) => x.key === key);
    if (!it || this.player.money < it.price) { this.toast('Not enough cash.'); return false; }
    this.player.money -= it.price;
    if (key === 'health') this.player.health = Math.min(100, this.player.health + 50);
    else if (key === 'armor') this.player.armor = Math.min(100, this.player.armor + 50);
    else if (key === 'ammo') {
      this.player.reserve = this.player.reserve.map((r, i) => r + [48, 96, 24][i]);
    }
    this.audio.coin();
    this.toast(`Bought ${it.label} — $${it.price}`);
    this.closeShop();
    return true;
  }

  toggleMissionList() {
    this.missionListOpen = !this.missionListOpen;
    const el = document.getElementById('mission-list');
    el.style.display = this.missionListOpen ? 'flex' : 'none';
    if (this.missionListOpen) {
      document.getElementById('mission-items').innerHTML = MISSIONS.map((m, i) =>
        `<div style="${i === this.missions.idx ? 'color:#ffc233;font-weight:bold' : ''}">${i + 1}. ${m.name} — $${m.pay.toLocaleString()}${i < this.missions.idx ? ' ✓' : ''}<br><span style="opacity:.8">${m.brief}</span></div>`).join('');
    }
  }

  win() {
    this.state = 'over';
    document.getElementById('over-text').textContent = 'KING OF THE BAY. You own Neon Bay — $10,000 banked. The city is yours.';
    document.querySelector('#over-screen h1').textContent = 'KING OF THE BAY';
    document.getElementById('over-screen').style.display = 'flex';
    this.saveGame();
  }

  gameOver() {
    this.state = 'over';
    document.getElementById('over-text').textContent = 'Kai got caught. The city keeps its crown — for now.';
    document.querySelector('#over-screen h1').textContent = 'BUSTED';
    document.getElementById('over-screen').style.display = 'flex';
    this.saveGame();
  }

  // --- combat ---------------------------------------------------------------------
  fireShot() {
    const shot = this.player.shoot();
    if (!shot) return;
    if (shot.empty) { this.audio.tone(180, 0.06, 'square', 0.2); return; }
    this.audio.shoot(shot.weapon.key);
    this.addWanted(0.35);
    // tracer
    const end = shot.origin.clone().add(shot.dir.clone().multiplyScalar(46));
    const geo = new THREE.BufferGeometry().setFromPoints([shot.origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
    // muzzle flash
    const flash = new THREE.PointLight(0xffe9a8, 40, 12, 1.8);
    flash.position.copy(shot.origin);
    this.scene.add(flash);
    this.tracers.push({ line: flash, life: 0.06, isLight: true });
    // hits: police units + guards near the ray
    const hit = (pos, r) => {
      const to = new THREE.Vector3().subVectors(pos, shot.origin);
      const along = to.dot(shot.dir);
      if (along < 0 || along > 60) return false;
      const closest = shot.origin.clone().add(shot.dir.clone().multiplyScalar(along));
      return closest.distanceTo(pos) < r;
    };
    for (const u of this.police.units) {
      if (hit(u.driver.pos.clone().setY(1), 3)) {
        u.car.userData.hp = (u.car.userData.hp || 100) - shot.weapon.damage;
        if (u.car.userData.hp <= 0) {
          this.scene.remove(u.car);
          this.police.units.splice(this.police.units.indexOf(u), 1);
          this.toast('Police unit down. +wanted.');
          this.addWanted(0.8);
        }
      }
    }
    for (const gd of this.guards) {
      if (hit(gd.mesh.position.clone().setY(1.2), 2)) {
        gd.hp -= shot.weapon.damage;
        if (gd.hp <= 0) {
          this.scene.remove(gd.mesh);
          this.guards.splice(this.guards.indexOf(gd), 1);
          this.toast('Guard down.');
        }
      }
    }
  }

  // --- main step ---------------------------------------------------------------------
  step(dt, testMode = false) {
    if (this.state === 'title' && !testMode) return;
    if (this.state === 'paused' && !testMode) return;
    if (this.state === 'over' && !testMode) return;
    // clock
    if (!this.freezeClock) {
      this.hour = (this.hour + dt / 120) % 24;
      this.sky.setTime(this.hour);
    }
    this.isNight = this.hour >= 19 || this.hour < 5.5;
    // look
    const [ldx, ldy] = this.input.consumeLook();
    const sens = 0.0026 * this.settings.sensitivity;
    this.camYaw -= ldx * sens;
    this.camPitch = clamp(this.camPitch + ldy * sens, -0.45, 0.9);
    this.player.yaw = this.camYaw;
    this.player.pitch = this.camPitch;
    // touch move stick
    if (this.input.touchMove.active) {
      this.input.keys['KeyW'] = this.input.touchMove.y < -0.25;
      this.input.keys['KeyS'] = this.input.touchMove.y > 0.25;
      this.input.keys['KeyA'] = this.input.touchMove.x < -0.25;
      this.input.keys['KeyD'] = this.input.touchMove.x > 0.25;
    }
    // vehicle or on foot
    if (this.player.inVehicle) {
      const d = this.player.inVehicle;
      const th = (this.input.keys['KeyW'] ? 1 : 0) - (this.input.keys['KeyS'] ? 1 : 0);
      const st = (this.input.keys['KeyA'] ? 1 : 0) - (this.input.keys['KeyD'] ? 1 : 0);
      d.night = this.isNight || this.headlights;
      d.step(th, st, dt, this.world);
      this.player.pos.copy(d.pos);
      this.player.pos.y = 0;
      // rider sits on the bike
      if (d.v.userData.kind === 'bike') {
        this.player.mesh.position.set(d.pos.x, 0.55, d.pos.z);
        this.player.mesh.rotation.y = d.heading;
      }
      this.audio.engine(true, d.speed);
      if (d.v.userData.hp <= 0) {
        this.toast('Vehicle wrecked!');
        this.exitVehicle();
      }
    } else {
      this.player.step(this.input, dt, this.world);
      this.audio.engine(false);
    }
    // keys (edge-triggered)
    if (this.input.wasPressed('KeyE')) {
      if (this.shopOpen) this.closeShop();
      else if (this.player.inVehicle) this.exitVehicle();
      else if (this.nearShop()) this.openShop(this.nearShop());
      else this.tryEnterVehicle();
    }
    if (this.input.wasPressed('KeyT')) this.missions.startTaxi();
    if (this.input.wasPressed('KeyV')) { this.weather.toggle(); this.toast(this.weather.rain ? 'Rain rolling in.' : 'Skies clearing.'); }
    if (this.input.wasPressed('KeyR')) this.player.reload();
    if (this.input.wasPressed('KeyF')) { this.headlights = !this.headlights; this.toast(this.headlights ? 'Headlights on.' : 'Headlights off.'); }
    if (this.input.wasPressed('Escape')) {
      if (this.state === 'playing') { this.state = 'paused'; document.getElementById('pause-screen').style.display = 'flex'; }
      else if (this.state === 'paused') { this.state = 'playing'; document.getElementById('pause-screen').style.display = 'none'; }
    }
    for (const [code, i] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2]]) {
      if (this.input.wasPressed(code)) { this.player.weaponIdx = i; this.audio.click(); }
    }
    if (this.input.fired) this.fireShot();
    // nearby NPC talk prompt
    const npc = this.pedestrians.nearest(this.player.pos, 3.5);
    if (npc && !this.player.inVehicle) {
      this.hud.prompt(`E — Talk to ${npc.name}`);
      if (this.input.wasPressed('KeyE')) { this.hud.toast(`${npc.name}: "${npc.line}"`); }
    } else if (!this.nearShop()) {
      this.hud.prompt(this.player.inVehicle ? '' : this.nearestVehicle(4.5) ? 'E — Enter vehicle' : '');
    }
    if (this.nearShop() && !this.player.inVehicle) {
      const key = this.nearShop();
      this.hud.prompt(`E — ${key === 'ammo' ? 'AMMU-NATION' : key === 'threads' ? 'THREADS' : 'PAY N SPRAY'}`);
    }
    // world systems
    this.traffic.step(dt);
    this.pedestrians.step(dt);
    this.police.step(dt);
    this.missions.step(dt);
    this.weather.step(dt, this.player.pos);
    this.world.update(dt, performance.now() * 0.001);
    this.sky.update(dt, performance.now() * 0.001);
    // tracers fade
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
      else if (!t.isLight) t.line.material.opacity = t.life / 0.09;
    }
    // police siren follows wanted
    this.audio.siren(this.player.wanted >= 1);
    // health / game over
    if (this.player.health <= 0 && this.state === 'playing') this.gameOver();
    this.hud.update(this);
    this.updateCamera(dt);
    this.input.endFrame();
  }

  updateCamera(dt) {
    if (this.camMode === 'shot') {
      this.camera.position.copy(this.shotCam.pos);
      this.camera.lookAt(this.shotCam.look);
      return;
    }
    const target = this.player.inVehicle
      ? new THREE.Vector3(this.player.inVehicle.pos.x, 1.4, this.player.inVehicle.pos.z)
      : new THREE.Vector3(this.player.pos.x, this.player.pos.y + 1.7, this.player.pos.z);
    const dist = this.player.inVehicle ? 11.5 : 9.5;
    const height = this.player.inVehicle ? 4.0 : 3.4;
    const yaw = this.player.inVehicle ? this.player.inVehicle.heading : this.camYaw;
    const cx = target.x - Math.sin(yaw) * dist * Math.cos(this.camPitch);
    const cz = target.z - Math.cos(yaw) * dist * Math.cos(this.camPitch);
    const cy = target.y + height * (0.6 + this.camPitch * 0.8) + Math.sin(this.camPitch) * 4;
    const want = new THREE.Vector3(cx, Math.max(0.6, cy), cz);
    this.camera.position.lerp(want, 1 - Math.exp(-10 * Math.max(dt, 0.001)));
    this.camera.lookAt(target.x, target.y + 0.4, target.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop = (t) => {
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000 || 0.016);
    this.lastT = t;
    if (!this.freezeFrame) {
      if (this.state !== 'title') this.step(dt);
      this.render(); // always draw — the title screen sits over the live scene
    }
    if (this.shotName && window.__NEON && !window.__NEON.ready) window.__NEON.ready = true;
    requestAnimationFrame(this.loop);
  };

  start() {
    requestAnimationFrame(this.loop);
  }
}

// boot
const game = new Game();
game.start();
