// main.js — Neon Bay's boot, game loop and wiring.
// Everything starts here: the renderer, the city, the traffic, the police,
// the pedestrians, the missions, the HUD and the sound. The player is Kai
// Reyes, on foot or in a car, and the camera follows behind him.
// window.__neonReady flips true once the scene has rendered and settled
// (the screenshot tool waits for it); window.__neonDebug carries the state.

import * as THREE from 'three';
import { WORLD, CAR, PLAYER, POLICE, MISSIONS, SPAWNS } from './config.js';
import { makeRng } from './random.js';
import { loadSave, writeSave } from './save.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { TrafficSystem, PlayerCar, createCarMesh } from './vehicles.js';
import { PoliceSystem } from './police.js';
import { PedestrianSystem } from './pedestrians.js';
import { CombatSystem } from './combat.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';
import { getShotParams, stageShot } from './shots.js';

const params = getShotParams();
const rng = makeRng(params.seed);

// --- Renderer, scene, camera -------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9ee);
scene.fog = new THREE.Fog(0xa8c8e8, 160, 520);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 16);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Systems -----------------------------------------------------------------
const input = new Input(canvas);
const audio = new AudioEngine();
const hud = new HUD();
const save = loadSave();

const city = buildCity(scene, rng);
const traffic = new TrafficSystem(scene, rng, city.colliders);
const police = new PoliceSystem(scene, rng, city.colliders);
const peds = new PedestrianSystem(scene, rng);
const combat = new CombatSystem(scene, audio);

// Kai Reyes: a smooth figure (cylinder torso and limbs, sphere head).
function makeKaiMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f6a8a, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.66;
  group.add(head);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.64, 10), jacket);
  torso.position.y = 1.18;
  group.add(torso);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), jacket);
  armL.position.set(-0.29, 1.18, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), jacket);
  armR.position.set(0.29, 1.18, 0);
  group.add(armR);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.74, 8), pants);
  legL.position.set(-0.11, 0.37, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.74, 8), pants);
  legR.position.set(0.11, 0.37, 0);
  group.add(legR);
  group.userData = { armL, armR, legL, legR };
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

const kaiMesh = makeKaiMesh();
kaiMesh.position.set(SPAWNS.player[0], 0, SPAWNS.player[1]);
scene.add(kaiMesh);

const playerCar = new PlayerCar(scene, createCarMesh(0x2e6ac2));
const player = {
  x: SPAWNS.player[0],
  z: SPAWNS.player[1],
  heading: 0,
  health: PLAYER.health,
  cash: save.cash || 0,
  inCar: false,
  car: null,
  mesh: kaiMesh,
  walkPhase: 0,
  camYaw: 0,
  camPitch: 0.32,
};

// The courier for mission 3: a red sedan looping downtown.
const courierMesh = createCarMesh(0xc23b2e);
scene.add(courierMesh);
const courier = { mesh: courierMesh, x: SPAWNS.courier[0], z: SPAWNS.courier[1], heading: 0, speed: 11, routeIndex: 0 };
const courierRoute = [[-80, 80], [80, 80], [80, -80], [-80, -80]];

// The mission beacon: a glowing pillar and a floating diamond at the target.
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true), beaconMat);
scene.add(beacon);
const beaconGem = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.9),
  new THREE.MeshBasicMaterial({ color: 0xffc233 }),
);
scene.add(beaconGem);

const missions = new MissionSystem((kind, data) => {
  if (kind === 'step') {
    hud.toast(data.step.label);
  } else if (kind === 'complete') {
    player.cash += data.mission.reward;
    hud.banner('MISSION COMPLETE', data.mission.name + ' — $' + data.mission.reward.toLocaleString('en-US'));
    hud.setCash(player.cash);
    if (audio) audio.chime();
    save.cash = player.cash;
    save.missionsDone = missions.done.slice();
    save.bestCash = Math.max(save.bestCash, player.cash);
    writeSave(save);
  } else if (kind === 'fail') {
    hud.toast(data.reason);
  } else if (kind === 'chainComplete') {
    hud.banner('KING OF THE BAY', 'Neon Bay is yours, Kai.');
  }
});
missions.done = save.missionsDone.slice();
missions.start(Math.min(save.missionsDone.length, MISSIONS.length - 1));

// --- Screen state ------------------------------------------------------------
let screen = 'title';
let night = false;
let clockMinutes = 21 * 60; // 21:00 to start, night on
let elapsed = 0;
let gameOverReason = '';
let shotFrozen = false;
let framesRendered = 0;

const overlays = {
  title: document.getElementById('titleScreen'),
  pause: document.getElementById('pauseScreen'),
  gameover: document.getElementById('gameOverScreen'),
};

function setScreen(next) {
  screen = next;
  if (overlays.title) overlays.title.classList.toggle('hidden', next !== 'title');
  if (overlays.pause) overlays.pause.classList.toggle('hidden', next !== 'pause');
  if (overlays.gameover) overlays.gameover.classList.toggle('hidden', next !== 'gameover');
  if (next === 'playing') {
    audio.ensure();
    audio.startMusic();
  }
}

// Buttons.
const startBtn = document.getElementById('startBtn');
if (startBtn) startBtn.addEventListener('click', () => setScreen('playing'));
const resumeBtn = document.getElementById('resumeBtn');
if (resumeBtn) resumeBtn.addEventListener('click', () => setScreen('playing'));
const restartBtn = document.getElementById('restartBtn');
if (restartBtn) restartBtn.addEventListener('click', () => restartGame());
const titleContinue = document.getElementById('continueBtn');
if (titleContinue) {
  titleContinue.textContent = save.cash > 0 || save.missionsDone.length > 0
    ? 'Continue — $' + Math.floor(save.cash).toLocaleString('en-US') + ', ' + save.missionsDone.length + ' missions done'
    : 'New Game';
}

function restartGame() {
  player.health = PLAYER.health;
  player.cash = 0;
  player.x = SPAWNS.player[0];
  player.z = SPAWNS.player[1];
  player.heading = 0;
  player.inCar = false;
  if (player.car) { player.car.remove(); player.car = null; }
  kaiMesh.visible = true;
  kaiMesh.position.set(player.x, 0, player.z);
  police.reset();
  missions.start(0);
  hud.setMission(missions.current(), missions.currentStep());
  setScreen('playing');
}

function endGame(reason) {
  gameOverReason = reason;
  const title = document.getElementById('gameOverTitle');
  const sub = document.getElementById('gameOverSub');
  if (title) title.textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
  if (sub) sub.textContent = reason === 'busted'
    ? 'The cops caught you on foot. Neon Bay keeps its secrets — for now.'
    : 'You went down in the streets of Neon Bay.';
  setScreen('gameover');
}

// --- The game object the shot stager uses -----------------------------------
const game = {
  player,
  playerCar,
  police,
  traffic,
  peds,
  missions,
  hud,
  city,
  camera,
  night: false,
  shotFrozen: false,
  setScreen,
};
Object.defineProperty(game, 'night', {
  get: () => night,
  set: (v) => { night = v; },
});
Object.defineProperty(game, 'shotFrozen', {
  get: () => shotFrozen,
  set: (v) => { shotFrozen = v; },
});

// --- Player movement ---------------------------------------------------------
function updatePlayerOnFoot(dt) {
  const steer = input.steerAxis();
  const throttle = input.throttleAxis();
  const speed = (input.held('ShiftLeft') || input.held('ShiftRight')) ? PLAYER.runSpeed : PLAYER.walkSpeed;
  // Camera-relative movement.
  const moveX = Math.sin(player.camYaw) * throttle + Math.cos(player.camYaw) * steer;
  const moveZ = Math.cos(player.camYaw) * throttle - Math.sin(player.camYaw) * steer;
  const len = Math.hypot(moveX, moveZ);
  if (len > 0.01) {
    const nx = player.x + (moveX / len) * speed * dt;
    const nz = player.z + (moveZ / len) * speed * dt;
    let blocked = false;
    for (const c of city.colliders) {
      if (Math.abs(nx - c.x) < c.hx + 0.6 && Math.abs(nz - c.z) < c.hz + 0.6) { blocked = true; break; }
    }
    if (!blocked) {
      player.x = Math.max(-185, Math.min(185, nx));
      player.z = Math.max(-185, Math.min(185, nz));
    }
    player.heading = Math.atan2(moveX, moveZ);
    player.walkPhase += dt * speed * 1.6;
    const swing = Math.sin(player.walkPhase) * 0.6;
    kaiMesh.userData.armL.rotation.x = swing;
    kaiMesh.userData.armR.rotation.x = -swing;
    kaiMesh.userData.legL.rotation.x = -swing;
    kaiMesh.userData.legR.rotation.x = swing;
  } else {
    kaiMesh.userData.armL.rotation.x *= 0.8;
    kaiMesh.userData.armR.rotation.x *= 0.8;
    kaiMesh.userData.legL.rotation.x *= 0.8;
    kaiMesh.userData.legR.rotation.x *= 0.8;
  }
  kaiMesh.position.set(player.x, 0, player.z);
  kaiMesh.rotation.y = player.heading;

  // Enter / steal a car with E.
  if (input.wasPressed('KeyE')) {
    const parked = traffic.nearestParked(player.x, player.z, 5);
    if (parked) {
      const isComet = parked.kind === 'comet';
      traffic.takeParked(parked);
      const colour = isComet ? 0xe81e2a : 0x3a6ac2;
      const mesh = createCarMesh(colour);
      playerCar.mesh = mesh;
      playerCar.place(parked.x, parked.z, parked.mesh.rotation.y);
      player.inCar = true;
      player.car = playerCar;
      kaiMesh.visible = false;
      police.addWanted(1, 'theft');
      hud.toast(isComet ? 'You stole the Comet GT!' : 'You stole a car!');
    }
  }
  // Punch with F, reload with R.
  if (input.wasPressed('KeyF')) {
    if (combat.punch(player, player.heading, peds, police)) police.addWanted(1, 'assault');
  }
  if (input.wasPressed('KeyR')) combat.startReload();
}

function updatePlayerInCar(dt) {
  const steer = input.steerAxis();
  const throttle = input.throttleAxis();
  const handbrake = input.held('Space');
  playerCar.update(dt, steer, throttle, handbrake, city.colliders, traffic);
  player.x = playerCar.x;
  player.z = playerCar.z;
  player.heading = playerCar.heading;
  // Hit a pedestrian: wanted up, ped down.
  for (const ped of peds.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - player.x, ped.z - player.z);
    if (d < 2.6 && Math.abs(playerCar.speed) > 4) {
      peds.knockDown(ped);
      police.addWanted(1, 'hit pedestrian');
    }
  }
  // Exit the car with E.
  if (input.wasPressed('KeyE')) {
    const exitX = player.x - Math.sin(player.heading) * 3;
    const exitZ = player.z - Math.cos(player.heading) * 3;
    playerCar.remove();
    player.car = null;
    player.inCar = false;
    player.x = exitX;
    player.z = exitZ;
    kaiMesh.visible = true;
    kaiMesh.position.set(exitX, 0, exitZ);
  }
}

// --- Camera ------------------------------------------------------------------
function updateCamera(dt) {
  if (shotFrozen) return; // the shot stager owns the camera
  player.camYaw -= input.dragX * 0.004;
  player.camPitch = Math.max(0.08, Math.min(0.9, player.camPitch + input.dragY * 0.003));
  const dist = player.inCar ? 13 : 8;
  const height = player.inCar ? 4.5 : 3.2;
  const yaw = player.inCar ? player.heading + Math.PI : player.camYaw;
  const targetX = player.x;
  const targetZ = player.z;
  const cx = targetX + Math.sin(yaw) * dist * Math.cos(player.camPitch);
  const cz = targetZ + Math.cos(yaw) * dist * Math.cos(player.camPitch);
  const cy = height + Math.sin(player.camPitch) * dist;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
  camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 6);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
  camera.lookAt(targetX, player.inCar ? 1.4 : 1.6, targetZ);
}

// --- Courier -----------------------------------------------------------------
function updateCourier(dt) {
  const target = courierRoute[courier.routeIndex];
  const dx = target[0] - courier.x;
  const dz = target[1] - courier.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 4) {
    courier.routeIndex = (courier.routeIndex + 1) % courierRoute.length;
    return;
  }
  const heading = Math.atan2(dx, dz);
  let diff = heading - courier.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  courier.heading += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
  courier.x += Math.sin(courier.heading) * courier.speed * dt;
  courier.z += Math.cos(courier.heading) * courier.speed * dt;
  courier.mesh.position.set(courier.x, 0, courier.z);
  courier.mesh.rotation.y = courier.heading;
}

// --- Mission beacon ----------------------------------------------------------
function updateBeacon(dt) {
  const target = missions.targetPos();
  if (!target) {
    beacon.visible = false;
    beaconGem.visible = false;
    return;
  }
  beacon.visible = true;
  beaconGem.visible = true;
  beacon.position.set(target[0], 15, target[1]);
  beaconGem.position.set(target[0], 6 + Math.sin(elapsed * 2) * 0.5, target[1]);
  beaconGem.rotation.y += dt * 1.5;
  const step = missions.currentStep();
  beaconMat.opacity = step && step.type === 'hold' && missions.holding ? 0.6 : 0.3;
}

// --- Main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let readyRaised = false;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  framesRendered += 1;

  if (screen === 'playing' && !shotFrozen) {
    // Clock: one game minute per real second.
    clockMinutes += dt;
    const hour = Math.floor(clockMinutes / 60) % 24;
    const isNight = hour >= 19 || hour < 6;
    if (isNight !== night) {
      night = isNight;
      city.setNight(night);
    }

    if (player.inCar) updatePlayerInCar(dt);
    else updatePlayerOnFoot(dt);

    // Shooting with the mouse (only on foot).
    if (!player.inCar && input.mouseClicked) {
      const origin = new THREE.Vector3(player.x, 1.5, player.z);
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit = combat.shoot(origin, dir, peds, police);
      if (hit) police.addWanted(1, 'shooting');
    }

    traffic.update(dt, player);
    updateCourier(dt);
    police.update(dt, player, !player.inCar);
    peds.update(dt, player.inCar ? { x: player.x, z: player.z } : null, player.inCar ? Math.abs(playerCar.speed) : 0);
    combat.update(dt);
    combat.policeFire(dt, player, police, (dmg) => {
      player.health -= dmg;
      if (player.health <= 0) endGame('wasted');
    });
    if (police.busted) endGame('busted');

    // Missions.
    missions.update({
      x: player.x,
      z: player.z,
      inCar: player.inCar,
      car: player.car,
      wanted: police.wanted,
      holdingE: input.held('KeyE'),
      pressedE: input.wasPressed('KeyE'),
      dt,
      courierPos: { x: courier.x, z: courier.z },
      courierHeading: courier.heading,
      police,
    });
    updateBeacon(dt);

    // Audio follows the car and the wanted level.
    if (audio.ctx) {
      audio.setEngine(player.inCar ? Math.abs(playerCar.speed) / CAR.maxSpeed : 0, player.inCar);
      audio.setSiren(police.wanted >= 1);
    }
    if (input.wasPressed('KeyM')) audio.setMuted(!audio.muted);
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) setScreen('pause');
  } else if (shotFrozen) {
    // Frozen staging: render the scene as-is, no simulation.
    updateBeacon(0);
  }

  // HUD, every frame.
  hud.setHealth(player.health);
  hud.setCash(player.cash);
  hud.setWanted(police.wanted);
  hud.setSpeed(player.inCar ? playerCar.speed * 3.6 : 0);
  hud.setClock(clockMinutes);
  hud.setAmmo(combat.ammo, PLAYER.pistolMag, combat.reloading);
  hud.setMission(missions.current(), missions.currentStep());
  hud.drawMinimap(player, traffic, police, missions.targetPos(), night);
  // Objective arrow: screen-space angle from the player to the target.
  const target = missions.targetPos();
  if (target && screen === 'playing') {
    const dx = target[0] - player.x;
    const dz = target[1] - player.z;
    const worldAngle = Math.atan2(dx, dz);
    const camAngle = player.inCar ? player.heading : player.camYaw;
    const rel = worldAngle - camAngle;
    hud.setObjectiveArrow((rel * 180) / Math.PI + 90, true);
  } else {
    hud.setObjectiveArrow(0, false);
  }
  hud.update(dt);

  updateCamera(dt);
  renderer.render(scene, camera);

  // The screenshot hook: once the scene has rendered a few frames, say so.
  if (!readyRaised && framesRendered >= 6) {
    readyRaised = true;
    window.__neonReady = true;
    window.__neonDebug = {
      shot: params.shot || 'game',
      seed: params.seed,
      screen,
      frozen: shotFrozen,
      frames: framesRendered,
      cash: player.cash,
      wanted: police.wanted,
    };
  }
  input.endFrame();
}

// --- Start -------------------------------------------------------------------
// Title screen by default; a ?shot= URL jumps straight into the staged scene.
if (params.shot) {
  setScreen('playing');
  stageShot(game, params.shot);
  city.setNight(game.night);
} else {
  city.setNight(true);
  night = true;
  setScreen('title');
  hud.setMission(missions.current(), missions.currentStep());
  hud.setCash(player.cash);
}

loop();
