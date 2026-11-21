// Neon Bay — game bootstrap, loop, driving, shooting, shops, save, and the
// debug/test hook. This is the file that ties every system together.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Sky } from './sky.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Traffic, makeCarMesh, makeBikeMesh } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Weather } from './weather.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'neonbay-r11-save';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.noAA = params.get('noaa') === '1';
    // ?lowfx=1 forces the cheap render path (no shadows, pixel ratio 1).
    // Used by the headless logic tests so frames run fast on SwiftShader;
    // screenshots still use the full-quality path.
    this.lowFx = params.get('lowfx') === '1';
    this.shotName = params.get('shot');
    this.quality = 'med';

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.noAA && !this.lowFx, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(this.lowFx ? 1 : Math.min(devicePixelRatio, this.quality === 'high' ? 2 : 1.5));
    this.renderer.shadowMap.enabled = !this.lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1600);

    // Lights: warm sun with shadows + sky hemisphere.
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, CONFIG.hemiIntensity);
    this.scene.add(this.hemi);

    // A soft fill light so Kai is never a black silhouette, plus a real
    // headlight beam for the player's vehicle at night.
    this.camFill = new THREE.PointLight(0x9fd8ff, 4, 7, 1.6);
    this.scene.add(this.camFill);
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 42, 0.55, 0.45, 1.1);
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;
    this.scene.add(this.headlight);
    // Floating "E" markers above enterable vehicles (big, clear prompt).
    this.eMarkerTex = this.makeEMarkerTexture();
    this.eMarkers = [];

    // Systems.
    this.sky = new Sky(this.scene);
    this.sky.attachLights(this.sun, this.hemi);
    this.world = buildWorld(this.scene);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.world);
    this.peds = new Pedestrians(this.scene, this.world);
    this.police = new Police(this.scene, this.world);
    this.missions = new Missions(this.scene);
    this.weather = new Weather(this.scene, this.sky);
    this.hud = new HUD();
    this.audio = new AudioSys();
    this.input = new Input(this.renderer.domElement);

    // Settings + save.
    this.settings = { volume: 0.7, sensitivity: 1, quality: 'med', weather: 'clear' };
    this.clockMinutes = 10 * 60;
    this.timeOfDay = 'day';
    this.loadSave();

    // Drivable parked vehicles (parked at road edges, never in the plaza).
    this.parked = [];
    this.spawnParked('sport', 70, 24, 0.4);
    this.spawnParked('sedan', -70, -24, -0.9);
    this.spawnParked('taxi', 4, -52, 1.7);
    this.spawnParked('sedan', -70, 20, 0.2);
    this.spawnBike(true, 232, 30);
    this.spawnBike(false, 236, 44);
    this.vehicle = null; // { mesh, type, speed, angle, hp, isBike, airTime }
    this.guards = [];
    this.guardsDead = 0;
    this.fare = null; // { x, z } taxi fare target
    this.cratesFound = 0;
    this.photoFound = new Set();
    this.airTimer = 0;
    this.stuntCooldown = 0;
    this.state = 'start';
    this.elapsed = 0;
    this.camPos = new THREE.Vector3(0, 4, 22);
    this.camLook = new THREE.Vector3();
    this.errors = [];

    // Ramps for stunt jumps on the highway ring — tilted wedges, not flat
    // boxes, so they read as launch ramps.
    this.ramps = [];
    for (const [x, z, rot, tilt] of [[160, -160, 0, 0.38], [-160, 160, Math.PI, -0.38]]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.6 }));
      ramp.position.set(x, 0.4, z);
      ramp.rotation.y = rot;
      ramp.rotation.z = tilt;
      ramp.name = 'stuntRamp';
      this.scene.add(ramp);
      this.ramps.push({ x, z });
    }

    this.wireUI();
    this.applyQuality('med');
    this.setTimeOfDay('day');
    this.hud.show('start-screen');

    // Shot staging (?shot=cover|drive|mission|beach) for screenshots.
    if (this.shotName) {
      stageShot(this, this.shotName);
      this.state = 'playing';
      this.hud.show(null);
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    window.addEventListener('error', (e) => this.errors.push(String(e.message)));

    // Debug + test hook for the headless harness.
    window.__neon = {
      game: this,
      ready: true,
      errors: this.errors,
      runTests: () => this.runTests(),
    };

    this.renderer.setAnimationLoop((t) => this.loop(t));
  }

  // ---- Vehicles (parked + driving).
  makeEMarkerTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,45,120,0.92)';
    g.beginPath(); g.roundRect(14, 14, 100, 100, 24); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(14, 14, 100, 100, 24); g.stroke();
    g.font = 'bold 72px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText('E', 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  addEMarker(v) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.eMarkerTex, transparent: true, depthWrite: false,
    }));
    s.scale.set(1.1, 1.1, 1);
    s.position.copy(v.mesh.position).add(new THREE.Vector3(0, 2.6, 0));
    this.scene.add(s);
    const m = { sprite: s, vehicle: v };
    this.eMarkers.push(m);
    return m;
  }

  updateEMarkers(dt) {
    for (const m of this.eMarkers) {
      const v = m.vehicle;
      const inUse = this.vehicle === v;
      const d = Math.hypot(v.mesh.position.x - this.player.pos.x, v.mesh.position.z - this.player.pos.z);
      m.sprite.visible = !inUse && d < 16 && this.state === 'playing' && !this.showcase;
      if (m.sprite.visible) {
        m.sprite.position.set(v.mesh.position.x, 2.6 + Math.sin(this.elapsed * 2.4) * 0.18, v.mesh.position.z);
      }
    }
    // Headlight beam: only on the player's vehicle, only after dark.
    if (this.vehicle && (this.timeOfDay === 'night' || this.timeOfDay === 'golden')) {
      const v = this.vehicle;
      const fx = Math.cos(v.angle), fz = -Math.sin(v.angle);
      this.headlight.position.set(v.mesh.position.x + fx * 2, 1.0, v.mesh.position.z + fz * 2);
      this.headlightTarget.position.set(v.mesh.position.x + fx * 30, 0.4, v.mesh.position.z + fz * 30);
      this.headlight.intensity = this.timeOfDay === 'night' ? 90 : 40;
    } else {
      this.headlight.intensity = 0;
    }
    // Fill light follows Kai so he never reads as a black silhouette.
    this.camFill.position.set(this.player.pos.x + 2, 3, this.player.pos.z + 2);
  }

  spawnParked(type, x, z, rot) {
    const mesh = makeCarMesh(type);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rot;
    this.scene.add(mesh);
    const v = { mesh, type, speed: 0, angle: rot, hp: 100, isBike: false, airTime: 0, vy: 0 };
    this.parked.push(v);
    this.addEMarker(v);
    return v;
  }

  spawnBike(sport, x, z) {
    const mesh = makeBikeMesh(sport);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = 0.6;
    this.scene.add(mesh);
    const v = { mesh, type: sport ? 'bike-sport' : 'bike-cruiser', speed: 0, angle: 0.6, hp: 100, isBike: true, airTime: 0, vy: 0 };
    this.parked.push(v);
    this.addEMarker(v);
    return v;
  }

  nearestVehicle(maxDist = 4) {
    let best = null, bd = maxDist;
    for (const v of this.parked) {
      const d = Math.hypot(v.mesh.position.x - this.player.pos.x, v.mesh.position.z - this.player.pos.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  enterVehicle(v) {
    const idx = this.parked.indexOf(v);
    if (idx >= 0) this.parked.splice(idx, 1);
    this.vehicle = v;
    this.player.inVehicle = v;
    if (v.isBike) {
      // On a motorcycle Kai stays VISIBLE, seated on the bike — a
      // riderless bike reads as a bug in screenshots.
      this.player.group.visible = true;
      this.player.legL.rotation.x = -1.1;
      this.player.legR.rotation.x = -1.1;
      this.player.armL.rotation.x = -1.2;
      this.player.armR.rotation.x = -1.2;
      this.player.torso.rotation.x = 0.15;
      if (this.player.smg) this.player.smg.visible = false;
    } else {
      this.player.group.visible = false;
    }
    this.audio.startEngine(0);
    this.audio.ensure();
    this.hud.toast(`You took the ${v.mesh.userData.def?.name || 'motorcycle'}.`);
    if (v.type !== 'taxi') this.police.addHeat(6); // stealing raises heat
  }

  exitVehicle() {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const side = new THREE.Vector3(Math.cos(v.angle), 0, -Math.sin(v.angle));
    this.player.pos.set(v.mesh.position.x + side.x * 2.2, 0, v.mesh.position.z + side.z * 2.2);
    this.player.group.visible = true;
    this.player.group.position.copy(this.player.pos);
    this.player.vel.set(0, 0, 0);
    this.player.inVehicle = null;
    this.vehicle = null;
    this.parked.push(v);
    this.audio.stopEngine();
    // The next on-foot frame's animate() resets the limbs and the weapon.
    this.player.torso.rotation.x = 0;
  }

  // ---- Shooting.
  shoot() {
    const w = this.player.currentWeapon();
    const def = CONFIG.weapons[w];
    if (this.player.reloading || this.player.fireCooldown > 0) return;
    if (this.player.mag[w] <= 0) { this.reload(); return; }
    this.player.mag[w]--;
    this.player.fireCooldown = def.rateMs;
    this.player.recoil();
    this.audio.shoot(w);
    // Muzzle flash.
    const from = this.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    const dir = this.player.aimDir();
    const pellets = def.pellets || 1;
    let hitAnything = false;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * def.spread * 2;
      d.y += (Math.random() - 0.5) * def.spread * 2;
      d.z += (Math.random() - 0.5) * def.spread * 2;
      d.normalize();
      const hit = this.raycastShot(from, d, def.range);
      if (hit) {
        hitAnything = true;
        this.tracer(from, hit.point);
        this.damageTarget(hit.target, def.damage, hit.point);
      } else {
        this.tracer(from, from.clone().add(d.multiplyScalar(def.range)));
      }
    }
    if (!hitAnything) this.police.addHeat(1);
    if (this.player.mag[w] === 0) this.reload();
  }

  raycastShot(from, dir, range) {
    const ray = new THREE.Raycaster(from, dir, 0, range);
    const targets = [];
    for (const g of this.guards) if (!g.dead) targets.push(g.mesh);
    for (const c of this.police.cops) targets.push(c.mesh);
    const hits = ray.intersectObjects(targets, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.isGuard && !obj.userData.isCop) obj = obj.parent;
    return { point: hits[0].point, target: obj };
  }

  damageTarget(target, dmg, point) {
    if (target.userData.isGuard) {
      const g = this.guards.find((x) => x.mesh === target);
      if (!g || g.dead) return;
      g.hp -= dmg;
      this.flashHit(point);
      if (g.hp <= 0) {
        g.dead = true;
        g.mesh.rotation.x = -Math.PI / 2;
        g.mesh.position.y = 0.4;
        this.guardsDead++;
        this.hud.toast('Guard down.', '#ff8f8f');
        this.audio.pickup();
      }
    } else if (target.userData.isCop) {
      this.police.addHeat(12);
      this.flashHit(point);
    }
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    setTimeout(() => { this.scene.remove(line); geo.dispose(); }, 70);
  }

  flashHit(point) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe45c }));
    s.position.copy(point);
    this.scene.add(s);
    setTimeout(() => this.scene.remove(s), 90);
  }

  reload() {
    const w = this.player.currentWeapon();
    const def = CONFIG.weapons[w];
    if (this.player.reloading || this.player.mag[w] === def.mag) return;
    if (this.player.ammo[w] <= 0) { this.hud.toast('No ammo — buy more at AMMU-NATION.', '#ff8f8f'); return; }
    this.player.reloading = true;
    this.audio.reload();
    setTimeout(() => {
      const need = def.mag - this.player.mag[w];
      const take = Math.min(need, this.player.ammo[w]);
      this.player.mag[w] += take;
      this.player.ammo[w] -= take;
      this.player.reloading = false;
    }, def.reloadMs);
  }

  // ---- Guards for the finale.
  spawnGuards() {
    if (this.guards.length) return;
    const spots = [[185, 125], [215, 125], [185, 158], [215, 158]];
    for (const [x, z] of spots) {
      const mesh = new THREE.Group();
      const shirt = new THREE.MeshStandardMaterial({ color: 0x8a1f2d, roughness: 0.85 });
      const pants = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
      body.position.y = 1.25;
      mesh.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc98d64 }));
      head.position.y = 1.72;
      mesh.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.85, 0.19), pants);
      legL.position.set(-0.12, 0.45, 0);
      mesh.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.12;
      mesh.add(legR);
      mesh.position.set(x, 0, z);
      mesh.userData.isGuard = true;
      this.scene.add(mesh);
      this.guards.push({ mesh, hp: 100, dead: false, shootTimer: 1 + Math.random() });
    }
  }

  updateGuards(dt) {
    for (const g of this.guards) {
      if (g.dead) continue;
      g.mesh.lookAt(this.player.pos.x, 0, this.player.pos.z);
      const d = Math.hypot(g.mesh.position.x - this.player.pos.x, g.mesh.position.z - this.player.pos.z);
      g.shootTimer -= dt;
      if (g.shootTimer <= 0 && d < 42 && !this.player.inVehicle) {
        g.shootTimer = 1.1 + Math.random() * 0.6;
        if (Math.random() < 0.45) {
          this.damagePlayer(6);
          this.tracer(g.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
          this.audio.noiseBurst(0.08, 0.2, 1800);
        }
      }
    }
  }

  damagePlayer(amount) {
    if (this.state !== 'playing') return;
    let rest = amount;
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, rest);
      this.player.armor -= absorbed;
      rest -= absorbed;
    }
    this.player.health -= rest;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.gameOver('The Neon Bay police caught up with you.');
    }
  }

  gameOver(text) {
    this.state = 'over';
    document.getElementById('over-text').textContent = text;
    this.hud.show('over-screen');
    this.audio.stopEngine();
    this.audio.stopSiren();
    this.audio.busted();
    document.exitPointerLock?.();
  }

  // ---- Time of day.
  setTimeOfDay(t) {
    this.timeOfDay = t;
    this.sky.setTime(t);
  }

  updateClock(dt) {
    this.clockMinutes += dt * 0.9; // 1 real second ≈ 0.9 game minutes
    const h = (this.clockMinutes / 60) % 24;
    const next = (h >= 5.5 && h < 8) ? 'morning' : (h >= 8 && h < 16.5) ? 'day' : (h >= 16.5 && h < 19.5) ? 'golden' : 'night';
    if (next !== this.timeOfDay && this.weather.mode === 'clear') this.setTimeOfDay(next);
  }

  // ---- Save / load.
  saveGame() {
    const data = {
      money: this.player.money, outfit: this.player.outfit,
      mission: this.missions.index, health: this.player.health,
      settings: this.settings, clock: this.clockMinutes,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.player.money = d.money ?? 500;
      this.player.outfit = d.outfit ?? 0;
      this.missions.index = d.mission ?? 0;
      this.player.health = d.health ?? 100;
      this.clockMinutes = d.clock ?? 600;
      Object.assign(this.settings, d.settings || {});
    } catch (e) { /* corrupted save: start fresh */ }
  }

  // ---- Quality.
  applyQuality(q) {
    this.quality = q;
    if (this.lowFx) {
      // Headless logic-test path: always cheap, never re-enable shadows.
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      return;
    }
    const pr = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'low' ? 1 : Math.min(devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
  }

  // ---- UI wiring.
  wireUI() {
    this.hud.onStart = () => {
      this.audio.ensure();
      this.state = 'playing';
      this.hud.show(null);
      this.audio.click();
      this.hud.toast('Mission: ' + this.missions.current().name);
    };
    this.hud.onResume = () => {
      this.state = 'playing';
      this.hud.show(null);
    };
    this.hud.onRetry = () => {
      this.player.health = 100;
      this.player.armor = 0;
      this.player.pos.set(0, 0, 14);
      this.player.money = Math.max(100, this.player.money - 100);
      this.police.clearWanted();
      this.state = 'playing';
      this.hud.show(null);
    };
    this.hud.onShopBuy = (kind) => {
      const prices = CONFIG.prices;
      const price = kind === 'repair' ? prices.repair : prices[kind];
      if (this.player.money < price) { this.hud.toast('Not enough money.', '#ff8f8f'); return; }
      this.player.money -= price;
      if (kind === 'health') this.player.health = Math.min(100, this.player.health + 50);
      if (kind === 'armor') this.player.armor = Math.min(100, this.player.armor + 50);
      if (kind === 'ammo') { for (const k of Object.keys(this.player.ammo)) this.player.ammo[k] += 60; }
      if (kind === 'repair' && this.vehicle) this.vehicle.hp = 100;
      this.audio.cash();
      this.hud.toast(`Bought ${kind} for $${price}.`);
      this.saveGame();
    };
    this.hud.onOutfitBuy = (i) => {
      if (this.player.money < CONFIG.prices.outfit) { this.hud.toast('Not enough money.', '#ff8f8f'); return; }
      this.player.money -= CONFIG.prices.outfit;
      this.player.changeOutfit(i);
      this.audio.cash();
      this.hud.toast(`Now wearing ${['Neon Street', 'Vice Sunset', 'Midnight', 'Palm Gold'][i]}.`);
      this.saveGame();
    };
    this.hud.onSettingsChange = (patch) => {
      Object.assign(this.settings, patch);
      if (patch.volume !== undefined) this.audio.setVolume(patch.volume);
      if (patch.quality) this.applyQuality(patch.quality);
      if (patch.weather) this.weather.set(patch.weather);
      this.saveGame();
    };
    this.hud.onSettingsReset = () => {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    };
    this.input.onAction = (action) => {
      if (this.state === 'start') return;
      if (action === 'pause') {
        if (this.state === 'playing') { this.state = 'paused'; this.hud.show('pause-screen'); }
        else if (this.state === 'paused') { this.state = 'playing'; this.hud.show(null); }
        return;
      }
      if (this.state !== 'playing') return;
      if (action === 'enter') this.tryInteract();
      if (action === 'reload') this.reload();
      if (action === 'taxi') this.tryTaxiJob();
      if (action === 'weather') {
        const m = this.weather.toggle();
        this.hud.toast(m === 'rain' ? 'Rain rolling in.' : 'Skies clearing.');
      }
      if (action === 'weapon1') this.player.weaponIndex = 0;
      if (action === 'weapon2') this.player.weaponIndex = 1;
      if (action === 'weapon3') this.player.weaponIndex = 2;
      if (action === 'minimap') {
        this.hud.minimapZoom = this.hud.minimapZoom === 1 ? 2 : 1;
      }
    };
  }

  tryInteract() {
    if (this.vehicle) { this.exitVehicle(); return; }
    // Talk to an NPC.
    const talker = this.peds.nearestTalker(this.player.pos);
    if (talker) {
      this.hud.showDialog(talker.name, talker.line);
      this.audio.click();
      return;
    }
    // Shop / wardrobe.
    if (Math.hypot(this.player.pos.x - this.world.shopPos.x, this.player.pos.z - this.world.shopPos.z) < 8) {
      this.hud.show('shop-screen');
      this.audio.click();
      return;
    }
    if (Math.hypot(this.player.pos.x - this.world.wardrobePos.x, this.player.pos.z - this.world.wardrobePos.z) < 8) {
      this.hud.show('wardrobe-screen');
      this.audio.click();
      return;
    }
    // Enter the nearest vehicle.
    const v = this.nearestVehicle();
    if (v) this.enterVehicle(v);
  }

  tryTaxiJob() {
    if (!this.vehicle || this.vehicle.type !== 'taxi') {
      this.hud.toast('You need to be driving a taxi for a fare (F).', '#ff8f8f');
      return;
    }
    if (this.fare) { this.hud.toast('Finish the current fare first.'); return; }
    const spots = [[0, 0], [180, -120], [-140, 90], [210, 60], [-80, -140]];
    const s = spots[Math.floor(Math.random() * spots.length)];
    this.fare = { x: s[0], z: s[1] };
    this.hud.toast('New fare: drive to the marker.');
    this.missions.beacon.position.set(s[0], 30, s[1]);
    this.missions.ring.position.set(s[0], 0.3, s[1]);
  }

  // ---- Driving.
  updateVehicle(dt) {
    const v = this.vehicle;
    if (!v) return;
    const top = v.isBike ? CONFIG.bikeTopSpeed : (v.mesh.userData.def?.top || 34);
    const accel = v.isBike ? CONFIG.bikeAccel : (v.mesh.userData.def?.accel || 15);
    const steerInput = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    if (this.input.forward) v.speed += accel * dt;
    else if (this.input.back) v.speed -= accel * 0.8 * dt;
    else v.speed *= Math.max(0, 1 - dt * 1.2);
    if (this.input.sprint) v.speed += accel * 0.5 * dt;
    v.speed = Math.max(-10, Math.min(top, v.speed));
    const turning = steerInput * (v.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 8);
    v.angle += turning * 1.9 * dt;
    const fx = Math.cos(v.angle), fz = -Math.sin(v.angle);
    v.mesh.position.x += fx * v.speed * dt;
    v.mesh.position.z += fz * v.speed * dt;
    v.mesh.position.x = Math.max(-272, Math.min(258, v.mesh.position.x));
    v.mesh.position.z = Math.max(-272, Math.min(272, v.mesh.position.z));
    // Ramps launch the car for stunt airtime.
    for (const r of this.ramps) {
      if (Math.hypot(v.mesh.position.x - r.x, v.mesh.position.z - r.z) < 4 && v.vy === 0 && Math.abs(v.speed) > 18) {
        v.vy = 9;
      }
    }
    if (v.vy !== 0 || v.mesh.position.y > 0) {
      v.vy -= 26 * dt;
      v.mesh.position.y += v.vy * dt;
      v.airTime += dt;
      if (v.mesh.position.y <= 0) {
        v.mesh.position.y = 0;
        if (v.airTime > 0.6 && this.stuntCooldown <= 0) {
          this.player.money += CONFIG.rewards.stunt;
          this.hud.toast(`Stunt! +$${CONFIG.rewards.stunt}`, '#ffd23e');
          this.audio.cash();
          this.stuntCooldown = 30;
        }
        v.vy = 0;
        v.airTime = 0;
      }
    }
    v.mesh.rotation.y = v.angle;
    if (v.isBike) v.mesh.rotation.z = -turning * 0.28; // lean into turns
    for (const w of v.mesh.userData.wheels || []) w.rotation.x += v.speed * dt * 2.4;
    // Player follows the vehicle; on a bike the rider stays visible and
    // faces the bike's forward (player fwd = (-sin yaw, -cos yaw)).
    this.player.pos.copy(v.mesh.position);
    this.player.group.position.copy(v.mesh.position);
    if (v.isBike) {
      this.player.yaw = v.angle - Math.PI / 2;
      this.player.group.rotation.y = this.player.yaw;
    }
    this.audio.setEngineSpeed(Math.abs(v.speed) / top);
    if (this.stuntCooldown > 0) this.stuntCooldown -= dt;
    // Fare delivery.
    if (this.fare && Math.hypot(v.mesh.position.x - this.fare.x, v.mesh.position.z - this.fare.z) < 7) {
      this.player.money += CONFIG.taxiFare;
      this.hud.toast(`Fare complete! +$${CONFIG.taxiFare}`);
      this.audio.cash();
      this.fare = null;
      const m = this.missions.current();
      this.missions.beacon.position.set(m.target[0], 30, m.target[1]);
      this.missions.ring.position.set(m.target[0], 0.3, m.target[1]);
    }
  }

  // ---- Pickups.
  updatePickups() {
    const p = this.player.pos;
    for (const c of this.world.crates) {
      if (c.taken) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 2.4) {
        c.taken = true;
        c.mesh.visible = false;
        this.cratesFound++;
        this.player.money += CONFIG.rewards.crate;
        this.hud.toast(`Neon crate! +$${CONFIG.rewards.crate} (${this.cratesFound}/10)`, '#ff8fb8');
        this.audio.pickup();
      }
    }
    for (const s of this.world.photoSpots) {
      if (this.photoFound.has(s.name)) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 6) {
        this.photoFound.add(s.name);
        this.player.money += CONFIG.rewards.photo;
        this.hud.toast(`Photo spot: ${s.name}! +$${CONFIG.rewards.photo}`, '#7dd7ff');
        this.audio.pickup();
      }
    }
  }

  // ---- Camera.
  updateCamera(dt) {
    const mouse = this.input.takeMouse();
    const sens = this.settings.sensitivity * 0.0022;
    this.player.yaw -= mouse.dx * sens;
    this.player.pitch -= mouse.dy * sens;
    this.player.pitch = Math.max(-0.9, Math.min(0.9, this.player.pitch));
    this.player.aiming = this.input.aimDown && !this.vehicle;
    const targetFov = this.player.aiming ? 50 : 72;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
    this.camera.updateProjectionMatrix();

    const yaw = this.player.yaw, pitch = this.player.pitch;
    let dist = this.vehicle ? 10 : this.player.aiming ? 4.5 : 7.5;
    let height = this.vehicle ? 3.6 : 2.6;
    const cx = this.player.pos.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = this.player.pos.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = this.player.pos.y + height + Math.sin(pitch) * dist * 0.6;
    const desired = new THREE.Vector3(cx, Math.max(0.7, cy), cz);
    this.camPos.lerp(desired, Math.min(1, dt * 8));
    this.camera.position.copy(this.camPos);
    this.camLook.set(this.player.pos.x, this.player.pos.y + (this.vehicle ? 1.6 : 1.7), this.player.pos.z);
    this.camera.lookAt(this.camLook);
  }

  // ---- Main loop.
  loop(t) {
    const now = (t || 0) / 1000;
    const dt = Math.min(0.05, this._lastT === undefined ? 0.016 : Math.max(0.001, now - this._lastT));
    this._lastT = now;
    this.elapsed += dt;

    if (this.state === 'start') {
      // Slow cinematic orbit over the plaza behind the title screen.
      const a = this.elapsed * 0.07;
      this.camera.position.set(Math.sin(a) * 55, 26, Math.cos(a) * 55);
      this.camera.lookAt(0, 8, 0);
      this.sky.update(dt, this.elapsed);
      this.world.update(dt, this.elapsed, this.timeOfDay);
      this.traffic.update(dt, this.player.pos);
      this.peds.update(dt, this.elapsed, this.player.pos);
    }

    if (this.state === 'playing') {
      // The clock never runs during a staged screenshot: the shot sets its
      // own time of day and updateClock would override it back to 10:00.
      if (!this.showcase) this.updateClock(dt);
      this.weather.update(dt, this.player.pos);
      this.sky.update(dt, this.elapsed);
      this.world.update(dt, this.elapsed, this.timeOfDay);
      this.peds.update(dt, this.elapsed, this.player.pos);
      this.traffic.update(dt, this.player.pos);
      // Cops freeze during a staged screenshot: they are props in the
      // frame, not chasers (otherwise they drive in front of Kai).
      if (!this.showcase) this.police.update(dt, this.elapsed, this.player.pos, this.vehicle ? Math.abs(this.vehicle.speed) : 0);
      this.missions.update(dt, this.elapsed);
      this.updateGuards(dt);
      if (this.showcase) {
        // Staged screenshot: frozen hero pose, fixed camera, but the city
        // stays alive (traffic, ocean, clouds, lights keep moving).
        if (this.shotDrive && this.vehicle) {
          const v = this.vehicle;
          v.mesh.position.x += Math.cos(v.angle) * this.shotDrive * dt;
          v.mesh.position.z += -Math.sin(v.angle) * this.shotDrive * dt;
          for (const w of v.mesh.userData.wheels || []) w.rotation.x += this.shotDrive * dt * 2.4;
          this.player.pos.copy(v.mesh.position);
          // Keep the bike rider glued to the bike (same as updateVehicle).
          this.player.group.position.copy(v.mesh.position);
          if (v.isBike) {
            this.player.yaw = v.angle - Math.PI / 2;
            this.player.group.rotation.y = this.player.yaw;
          }
        }
        if ((this.shotName === 'drive' || this.shotName === 'beach') && this.vehicle) {
          // Chase camera: track the moving vehicle so it never drives out
          // of frame. A 3/4 rear angle (offset to the side) shows the
          // vehicle's side profile — dead-behind reads as a flat box.
          const v = this.vehicle;
          const fx = Math.cos(v.angle), fz = -Math.sin(v.angle);
          const rx = -fz, rz = fx; // right vector
          const dist = v.isBike ? 6 : 7.5;
          const height = v.isBike ? 2.6 : 3.0;
          const side = v.isBike ? 2.5 : 3.5;
          const lookAhead = v.isBike ? 6 : 5;
          this.camera.position.set(
            v.mesh.position.x - fx * dist + rx * side, height, v.mesh.position.z - fz * dist + rz * side,
          );
          this.camera.lookAt(v.mesh.position.x + fx * lookAhead, 1.4, v.mesh.position.z + fz * lookAhead);
        } else if (this.shotCam) {
          this.camera.position.copy(this.shotCam.pos);
          this.camera.lookAt(this.shotCam.look);
        }
      } else {
        this.driveAndFight(dt);
      }
      this.updateEMarkers(dt);
      this.hud.update({
        health: this.player.health, armor: this.player.armor,
        wanted: this.police.wanted, money: this.player.money,
        weaponIndex: this.player.weaponIndex,
        weaponName: this.player.currentWeapon().toUpperCase(),
        ammo: this.player.mag[this.player.currentWeapon()],
        reserve: this.player.ammo[this.player.currentWeapon()],
        clockMinutes: this.clockMinutes, weather: this.weather.mode,
        missionName: this.missions.done ? 'King of the Bay' : this.missions.current().name,
        missionText: this.missions.done ? 'You own Neon Bay. Free roam!' : this.missions.current().blurb,
        inVehicle: !!this.vehicle, speed: this.vehicle ? Math.abs(this.vehicle.speed) : 0,
        vehicleName: this.vehicle ? (this.vehicle.mesh.userData.def?.name || 'Motorcycle') : '',
        aiming: this.player.aiming,
        player: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw },
        mission: { x: this.fare ? this.fare.x : this.missions.current().target[0], z: this.fare ? this.fare.z : this.missions.current().target[1] },
        cops: this.police.cops.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      });
    }
    this.renderer.render(this.scene, this.camera);
  }

  // Player control, combat, pickups, missions and hints (skipped in showcase).
  driveAndFight(dt) {
    if (this.vehicle) this.updateVehicle(dt);
    else this.player.updateOnFoot(dt, this.input, this.world.colliders);
    if (this.input.mouseDown) this.shoot();
    this.updatePickups();
    // Mission arrival (with mission-specific gates).
    const reward = this.missions.checkArrival(this.player.pos, {
      crates: this.cratesFound,
      wanted: this.police.wanted,
      inTaxi: !!(this.vehicle && this.vehicle.type === 'taxi'),
      guardsDead: this.guardsDead,
    });
    if (reward > 0) {
      this.player.money += reward;
      this.audio.mission();
      this.hud.toast(`Mission complete! +$${reward.toLocaleString()}`, '#ffd23e');
      this.saveGame();
      if (this.missions.done) this.hud.toast('KING OF THE BAY! You own Neon Bay.', '#ffd23e');
    }
    // Mission 6 spawns its guards when the player gets close.
    if (this.missions.index === 5 && !this.guards.length) {
      const d = Math.hypot(this.player.pos.x - 200, this.player.pos.z - 140);
      if (d < 60) this.spawnGuards();
    }
    // Siren while wanted.
    if (this.police.wanted > 0 && !this.audio.sirenOn) this.audio.startSiren();
    if (this.police.wanted === 0 && this.audio.sirenOn) this.audio.stopSiren();
    if (this.audio.sirenOn) this.audio.updateSiren(this.elapsed);
    // HUD hints + the big interact prompt (entering a car must be obvious:
    // a large pink "Press E" banner plus a floating E marker on the car).
    const interact = document.getElementById('interact');
    const talker = this.peds.nearestTalker(this.player.pos);
    if (talker) { this.hud.hint(`Press E to talk to ${talker.name}`); interact.innerHTML = `Press <b>E</b> to talk to ${talker.name}`; interact.style.display = 'block'; }
    else if (Math.hypot(this.player.pos.x - this.world.shopPos.x, this.player.pos.z - this.world.shopPos.z) < 8) { this.hud.hint('Press E — AMMU-NATION'); interact.innerHTML = 'Press <b>E</b> — AMMU-NATION'; interact.style.display = 'block'; }
    else if (Math.hypot(this.player.pos.x - this.world.wardrobePos.x, this.player.pos.z - this.world.wardrobePos.z) < 8) { this.hud.hint('Press E — THREADS wardrobe'); interact.innerHTML = 'Press <b>E</b> — THREADS wardrobe'; interact.style.display = 'block'; }
    else if (this.nearestVehicle()) { this.hud.hint('Press E to enter vehicle'); interact.innerHTML = 'Press <b>E</b> to enter vehicle'; interact.style.display = 'block'; }
    else { this.hud.hint('WASD move · Shift sprint · Space jump · E enter car · Click to lock mouse'); interact.style.display = 'none'; }
    this.updateCamera(dt);
  }

  // ---- Headless self-test (drives the game programmatically).
  runTests() {
    const results = [];
    const check = (name, ok) => results.push({ name, ok: !!ok });
    try {
      check('boot', !!this.scene && !!this.camera);
      check('world-built', this.world.colliders.length > 50);
      check('sky-present', !!this.sky.dome);
      check('traffic-count', this.traffic.cars.length === 14);
      check('talkers', this.peds.talkers.length === 8);
      check('crates', this.world.crates.length === 10);

      // Walk forward changes position.
      this.state = 'playing';
      const x0 = this.player.pos.x, z0 = this.player.pos.z;
      this.input.forward = true;
      this.player.updateOnFoot(0.5, this.input, this.world.colliders);
      this.input.forward = false;
      check('walk', Math.hypot(this.player.pos.x - x0, this.player.pos.z - z0) > 1);
      // Jump leaves the ground.
      this.input.jump = true;
      this.player.updateOnFoot(0.1, this.input, this.world.colliders);
      this.input.jump = false;
      check('jump', this.player.pos.y > 0.3);
      // Shoot spends a round.
      const mag0 = this.player.mag.smg;
      this.player.fireCooldown = 0;
      this.shoot();
      check('shoot', this.player.mag.smg === mag0 - 1);
      // Enter a parked car.
      const car = this.parked[0];
      this.player.pos.set(car.mesh.position.x + 2, 0, car.mesh.position.z);
      this.enterVehicle(car);
      check('enter-car', !!this.vehicle && this.player.inVehicle === car);
      // Drive it.
      this.input.forward = true;
      this.updateVehicle(1.0);
      this.input.forward = false;
      check('drive', Math.abs(this.vehicle.speed) > 5);
      this.exitVehicle();
      check('exit-car', !this.vehicle && this.player.group.visible);
      // Motorcycle.
      const bike = this.parked.find((v) => v.isBike);
      this.player.pos.set(bike.mesh.position.x + 2, 0, bike.mesh.position.z);
      this.enterVehicle(bike);
      this.input.forward = true;
      this.updateVehicle(1.0);
      this.input.forward = false;
      check('bike', !!this.vehicle && Math.abs(this.vehicle.speed) > 5);
      this.exitVehicle();
      // Taxi fare.
      const taxi = this.parked.find((v) => v.type === 'taxi');
      this.player.pos.set(taxi.mesh.position.x + 2, 0, taxi.mesh.position.z);
      this.enterVehicle(taxi);
      this.tryTaxiJob();
      check('taxi-job', !!this.fare);
      this.exitVehicle();
      // Police heat.
      this.police.clearWanted();
      this.police.addHeat(45);
      check('police', this.police.wanted >= 2 && this.police.cops.length >= 2);
      this.police.clearWanted();
      check('police-clear', this.police.wanted === 0);
      // Mission advance by teleport.
      const m0 = this.missions.index;
      const t = this.missions.current().target;
      this.player.pos.set(t[0], 0, t[1]);
      const r = this.missions.checkArrival(this.player.pos, { crates: 3, wanted: 0, inTaxi: true, guardsDead: 4 });
      check('mission', this.missions.index !== m0 || this.missions.done || r > 0);
      // Shop: buy health.
      const money0 = this.player.money;
      this.player.health = 50;
      this.hud.onShopBuy('health');
      check('shop', this.player.health > 50 && this.player.money === money0 - CONFIG.prices.health);
      // Wardrobe.
      const out0 = this.player.outfit;
      this.player.money += 200;
      this.hud.onOutfitBuy((out0 + 1) % 4);
      check('wardrobe', this.player.outfit !== out0);
      // NPC talk.
      const talker = this.peds.talkers[0];
      this.player.pos.set(talker.x + 1, 0, talker.z);
      check('npc', !!this.peds.nearestTalker(this.player.pos));
      // Weather.
      const w = this.weather.toggle();
      check('weather', w === 'rain' && this.weather.mode === 'rain');
      this.weather.toggle();
      check('weather-back', this.weather.mode === 'clear');
      // Settings.
      this.hud.onSettingsChange({ volume: 0.3 });
      check('settings', this.settings.volume === 0.3);
      // Save / load round-trip.
      this.saveGame();
      const saved = localStorage.getItem(SAVE_KEY);
      check('save', !!saved && JSON.parse(saved).money === this.player.money);
      // Guards.
      this.spawnGuards();
      check('guards', this.guards.length === 4);
    } catch (e) {
      results.push({ name: 'exception', ok: false, error: String(e && e.message || e) });
    }
    const passed = results.filter((r) => r.ok).length;
    return { passed, total: results.length, results };
  }
}

// Boot the game.
new Game();
