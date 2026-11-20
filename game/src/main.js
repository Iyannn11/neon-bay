// Neon Bay — boot, game loop, player, camera and game state.
// Third-person open world: Kai Reyes on foot and by car, six jobs, wanted 0–5.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, COLOURS, TUNING, PLACES, SPAWNS, MISSIONS } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createVehicles, resolveCircle } from './vehicles.js';
import { createPolice } from './police.js';
import { createPedestrians } from './pedestrians.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { applyShot, readShotParam, readSeedParam } from './shots.js';

// ---- Error tracking (the shot harness reads __neonDebug.errors) ----
const debugInfo = { errors: [], ready: false, wanted: 0, cash: 0, mission: '', fps: 0 };
window.addEventListener('error', (e) => {
  debugInfo.errors.push(String(e.message || e.error || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  debugInfo.errors.push(String((e.reason && e.reason.message) || e.reason || 'rejection'));
});
window.__neonDebug = debugInfo;

// ---- Renderer / scene / camera ----
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3dd, 160, 520);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- World ----
const seed = readSeedParam();
const rng = makeRng(seed);
const city = buildCity(scene, rng);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud(document);
const saved = loadSave();

// ---- Player mesh: Kai Reyes, yellow jacket, cylinder limbs ----
function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: COLOURS.playerYellow, roughness: 0.6 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2e4a6b, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 12), jacket);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.6 }));
  cap.position.y = 1.96;
  group.add(cap);
  const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.8, 10);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(0.15, 0.4, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(-0.15, 0.4, 0);
  group.add(legR);
  const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.7, 10);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(0.38, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(-0.38, 1.1, 0);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}
const playerMesh = makePlayerMesh();
scene.add(playerMesh.group);

// A soft light that follows the player, so Kai and his car read at night.
// Bright after dark, off in daylight.
const playerLight = new THREE.PointLight(0xffe9c0, 0, 26, 1.6);
playerLight.position.set(0, 5, 0);
scene.add(playerLight);

// ---- Game state ----
const game = {
  scene,
  camera,
  renderer,
  rng,
  city,
  input,
  audio,
  hud,
  time: 0,
  isNight: false,
  wanted: 0,
  cash: saved.cash,
  missionsDone: saved.missionsDone,
  bestCash: saved.bestCash,
  muted: saved.muted,
  paused: false,
  over: false,
  started: false,
  shotFrozen: false,
  cameraShot: null,
  cameraHeading: 0,
  cameraPitch: 0.32,
  sirenClock: 0,
  fireClock: 0,
  player: {
    pos: new THREE.Vector3(SPAWNS.player.x, 0, SPAWNS.player.z),
    heading: SPAWNS.player.heading,
    onFootHeading: SPAWNS.player.heading,
    walkSpeed: 0,
    carSpeed: 0,
    inCar: false,
    car: null,
    health: TUNING.playerHealth,
  },
  vehicles: null,
  police: null,
  pedestrians: null,
  combat: null,
  missions: null,
  walkPhase: 0,
};

game.addWanted = function addWanted(amount) {
  game.wanted = Math.max(0, Math.min(TUNING.wantedMax, game.wanted + amount));
  debugInfo.wanted = game.wanted;
};
game.setNight = function setNight(isNight) {
  if (game.isNight === isNight) return;
  game.isNight = isNight;
  city.setNight(isNight);
};
game.save = function save() {
  saveGame(game);
};
game.busted = function busted() {
  if (game.over || !game.started) return;
  game.over = true;
  game.wanted = 0;
  if (game.audio) game.audio.busted();
  showGameOver('BUSTED', 'The Neon Bay PD caught you. The city moves on.');
};
game.wasted = function wasted() {
  if (game.over || !game.started) return;
  game.over = true;
  game.wanted = 0;
  showGameOver('WASTED', 'Kai Reyes is down. The bay keeps its secrets.');
};

function showGameOver(title, sub) {
  const over = document.getElementById('gameover-screen');
  document.getElementById('gameover-title').textContent = title;
  document.getElementById('gameover-sub').textContent = sub;
  over.classList.add('show');
}
function hideGameOver() {
  document.getElementById('gameover-screen').classList.remove('show');
}
function resetPlayer() {
  const p = game.player;
  if (p.inCar && game.vehicles) game.vehicles.exitCar(game);
  p.pos.set(SPAWNS.player.x, 0, SPAWNS.player.z);
  p.heading = SPAWNS.player.heading;
  p.onFootHeading = SPAWNS.player.heading;
  p.carSpeed = 0;
  p.walkSpeed = 0;
  p.inCar = false;
  p.car = null;
  p.health = TUNING.playerHealth;
  game.wanted = 0;
  game.over = false;
  hideGameOver();
  game.missions.startMission(game.missions.index);
}

// ---- Subsystems (wired to the shared game object) ----
game.vehicles = createVehicles(scene, rng, city);
game.police = createPolice(scene, rng, city);
game.pedestrians = createPedestrians(scene, rng, city);
game.combat = createCombat(scene, game);
game.missions = createMissions(scene, game);
audio.setMuted(game.muted);

// ---- Overlays: title / pause / game over ----
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
function startGame() {
  if (game.started) return;
  game.started = true;
  titleScreen.classList.remove('show');
  audio.unlock();
  audio.startMusic();
  game.missions.startMission(0);
  hud.banner('NEON BAY', 'Six jobs. One crown. Kai Reyes is back.');
}
document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('resume-button').addEventListener('click', () => {
  game.paused = false;
  pauseScreen.classList.remove('show');
});
document.getElementById('restart-button').addEventListener('click', () => {
  resetPlayer();
  game.paused = false;
  pauseScreen.classList.remove('show');
});
document.getElementById('retry-button').addEventListener('click', () => {
  resetPlayer();
});
document.getElementById('mute-button').addEventListener('click', () => {
  game.muted = !game.muted;
  audio.setMuted(game.muted);
  game.save();
  document.getElementById('mute-button').textContent = game.muted ? '🔇 Sound: off' : '🔊 Sound: on';
});
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

// Place the visible player meshes at the player's state. The frozen shot
// loop never runs the updates that normally place them, so staging must.
function placePlayerMesh() {
  const p = game.player;
  if (p.inCar && p.car) {
    playerMesh.group.visible = false;
    p.car.mesh.group.position.set(p.pos.x, 0, p.pos.z);
    p.car.mesh.group.rotation.y = -p.heading;
  } else {
    playerMesh.group.visible = true;
    playerMesh.group.position.set(p.pos.x, 0, p.pos.z);
    playerMesh.group.rotation.y = -p.heading + Math.PI / 2;
  }
}

// ---- Shot staging (headless renders skip the title screen) ----
const shot = readShotParam();
if (shot) {
  game.started = true;
  titleScreen.classList.remove('show');
  applyShot(game, shot);
  game.shotFrozen = true;
  placePlayerMesh();
} else {
  titleScreen.classList.add('show');
  placePlayerMesh();
}

// ---- Camera ----
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const p = game.player;
  if (game.cameraShot) {
    const s = game.cameraShot;
    camera.position.set(s.x, s.y, s.z);
    camera.lookAt(s.lookX, s.lookY, s.lookZ);
    camera.fov = s.fov || 50;
    camera.updateProjectionMatrix();
    game.cameraHeading = Math.atan2(s.lookZ - s.z, s.lookX - s.x);
    return;
  }
  // Mouse drag orbits the chase camera.
  game.cameraHeading -= input.dragX * 0.004;
  game.cameraPitch = Math.max(0.08, Math.min(0.9, game.cameraPitch + input.dragY * 0.003));
  const dist = TUNING.cameraDistance;
  const height = TUNING.cameraHeight;
  const backX = Math.cos(game.cameraHeading);
  const backZ = Math.sin(game.cameraHeading);
  const px = p.pos.x;
  const pz = p.pos.z;
  const tx = px - backX * dist * Math.cos(game.cameraPitch);
  const tz = pz - backZ * dist * Math.cos(game.cameraPitch);
  const ty = height + dist * Math.sin(game.cameraPitch) * 0.4;
  camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 6));
  camTarget.set(px + Math.cos(p.heading) * 4, 1.6, pz + Math.sin(p.heading) * 4);
  camera.lookAt(camTarget);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

// ---- Player on foot ----
function updatePlayerOnFoot(dt) {
  const p = game.player;
  const fwd = input.forward();
  const steer = input.steer();
  const running = input.keys['shift'] === true;
  const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
  // Movement is relative to the camera heading.
  const moveAngle = game.cameraHeading;
  let mx = 0;
  let mz = 0;
  if (fwd !== 0 || steer !== 0) {
    mx = Math.cos(moveAngle) * fwd + Math.cos(moveAngle + Math.PI / 2) * steer;
    mz = Math.sin(moveAngle) * fwd + Math.sin(moveAngle + Math.PI / 2) * steer;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    p.onFootHeading = Math.atan2(mz, mx);
    p.walkSpeed = speed;
  } else {
    p.walkSpeed = 0;
  }
  const nx = p.pos.x + mx * p.walkSpeed * dt;
  const nz = p.pos.z + mz * p.walkSpeed * dt;
  const fixed = resolveCircle(nx, nz, 0.7, city.colliders);
  p.pos.x = fixed.x;
  p.pos.z = fixed.z;
  p.heading = p.onFootHeading;
  // Walk animation: legs and arms swing, body bobs.
  if (p.walkSpeed > 0) {
    game.walkPhase += dt * p.walkSpeed * 1.9;
    const s = Math.sin(game.walkPhase);
    playerMesh.legL.rotation.x = s * 0.6;
    playerMesh.legR.rotation.x = -s * 0.6;
    playerMesh.armL.rotation.x = -s * 0.45;
    playerMesh.armR.rotation.x = s * 0.45;
    playerMesh.group.position.y = Math.abs(Math.cos(game.walkPhase)) * 0.06;
  } else {
    playerMesh.legL.rotation.x = 0;
    playerMesh.legR.rotation.x = 0;
    playerMesh.armL.rotation.x = 0;
    playerMesh.armR.rotation.x = 0;
    playerMesh.group.position.y = 0;
  }
  playerMesh.group.position.set(p.pos.x, playerMesh.group.position.y, p.pos.z);
  playerMesh.group.rotation.y = -p.heading + Math.PI / 2;
  playerMesh.group.visible = true;
}

// ---- Main loop ----
const clock = new THREE.Clock();
let frames = 0;
let fpsTimer = 0;
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;
  fpsTimer += dt;
  if (fpsTimer >= 1) {
    debugInfo.fps = Math.round(frames / fpsTimer);
    frames = 0;
    fpsTimer = 0;
  }

  // Day / night cycle: 150s of day, 150s of night.
  game.time += dt;
  const shouldBeNight = Math.floor(game.time / 150) % 2 === 1;
  if (!game.shotFrozen && shouldBeNight !== game.isNight) game.setNight(shouldBeNight);

  if (!game.shotFrozen && game.started && !game.paused && !game.over) {
    const p = game.player;
    // Edge-triggered actions.
    if (input.pressedM) {
      game.muted = !game.muted;
      audio.setMuted(game.muted);
      game.save();
    }
    if (input.pressedEsc) {
      game.paused = true;
      pauseScreen.classList.add('show');
    }
    if (input.pressedF) game.combat.punch();
    if (input.pressedR) game.combat.reload();
    if (input.clicked && !p.inCar) game.combat.shoot(input.clickX, input.clickY);
    // Enter / exit cars with E.
    if (input.pressedE) {
      if (p.inCar) {
        const car = game.vehicles.exitCar(game);
        if (car) {
          p.pos.x = car.x + Math.cos(p.heading + Math.PI / 2) * 3;
          p.pos.z = car.z + Math.sin(p.heading + Math.PI / 2) * 3;
          p.carSpeed = 0;
        }
      } else {
        const near = game.vehicles.nearestParked(p.pos.x, p.pos.z, 4.5);
        if (near) {
          game.vehicles.enterCar(game, near);
          game.addWanted(0.3);
          hud.flash(`You took the ${near.name || 'car'}`);
          if (audio) audio.pickup();
        }
      }
    }
    if (p.inCar) {
      playerMesh.group.visible = false;
      p.walkSpeed = 0;
    } else {
      updatePlayerOnFoot(dt);
    }
    game.vehicles.update(dt, game);
    game.police.update(dt, game);
    game.pedestrians.update(dt, game);
    game.combat.update(dt);
    game.missions.update(dt);
    // Wanted decays slowly when the player stays clean.
    if (game.wanted > 0) game.addWanted(-TUNING.wantedDecay * dt);
    audio.update(p.inCar ? Math.abs(p.carSpeed || 0) / TUNING.carMaxSpeed : 0, p.inCar);
    hud.update(dt, game);
    debugInfo.wanted = game.wanted;
    debugInfo.cash = game.cash;
    debugInfo.mission = game.missions.mission ? game.missions.mission.name : '';
    input.consume();
  } else if (game.shotFrozen) {
    // Frozen staged shot: render once, no simulation.
    hud.update(0, game);
    input.consume();
  }

  updateCamera(dt);
  // The player light follows Kai and brightens after dark.
  playerLight.position.set(game.player.pos.x, 4.5, game.player.pos.z);
  playerLight.intensity = game.isNight ? 55 : 0;
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    window.__neonReady = true;
    debugInfo.ready = true;
  }
}

window.__neonReady = false;
window.__neonDebug = debugInfo;
tick();
