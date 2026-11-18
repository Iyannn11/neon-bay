// Neon Bay — boot, game loop, camera, player and the glue between systems.
// The player explores Neon Bay on foot or by car, steals cars, dodges the
// Bay PD, fights, and runs five story missions for Kai Reyes.

import * as THREE from 'three';
import { WORLD, COLOURS, PLAYER, CAR, WANTED, SHOT_SEED } from './config.js';
import { mulberry32 } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { createCity } from './city.js';
import {
  createCarMesh, makeCarState, updatePlayerCar, spawnTraffic, updateTraffic,
  findNearestCar, collideWithBuildings,
} from './vehicles.js';
import { spawnPedestrians, updatePedestrians, scarePedestrians, knockDownPedestrian } from './pedestrians.js';
import { createPolice, addHeat, updatePolice, nearestPoliceDistance, clearWanted } from './police.js';
import { createCombat, tryPunch, tryShoot, policeReturnFire, updateCombatTimers } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { stageShot, driveToward } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotMode = shotName !== null;
// ?lowfx=1 trades antialiasing and shadows for speed on weak machines.
const lowFx = params.get('lowfx') === '1';
const seed = shotMode ? SHOT_SEED : (Date.now() % 100000);
const rng = mulberry32(seed);

// ---------- Renderer / scene ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: !lowFx });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(lowFx ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !lowFx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOURS.skyDay);
scene.fog = new THREE.Fog(0x9fc4e0, 180, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(10, 8, 40);

const sun = new THREE.DirectionalLight(COLOURS.sunDay, 2.4);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5f3a, 0.9);
scene.add(hemi);

// ---------- World ----------
const city = createCity(scene, rng);
const traffic = spawnTraffic(scene, rng, 14, new THREE.Vector3(0, 0, 24));
const peds = spawnPedestrians(scene, rng, 26, new THREE.Vector3(0, 0, 24));
const police = createPolice(scene);
const combat = createCombat();
const audio = createAudio();
const hud = createHud();
const input = createInput(renderer.domElement);

const missionWorld = { landmarks: city.landmarks, courierVan: null, police };
const missions = createMissions(missionWorld);

// Player's own red car, parked near the spawn.
const playerCar = makeCarState(createCarMesh(0xd23b2e, false), 'playerCar', 0xd23b2e);
playerCar.mesh.position.set(4, 0, 30);
playerCar.mesh.rotation.y = Math.PI / 2;
playerCar.heading = Math.PI / 2;
scene.add(playerCar.mesh);

// The yellow Comet GT for mission 2, parked downtown.
const targetCar = makeCarState(createCarMesh(0xf2c230, false), 'target', 0xf2c230);
targetCar.mesh.position.set(60, 0, -60);
targetCar.mesh.rotation.y = -Math.PI / 2;
targetCar.heading = -Math.PI / 2;
targetCar.isTarget = true;
scene.add(targetCar.mesh);

const parkedCars = [playerCar, targetCar];

function enterableCars() {
  return [...traffic, ...parkedCars];
}

// Player humanoid.
function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x18b0a0, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3242, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), jacket);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.8 }));
  cap.position.y = 1.84;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legR.position.set(0.16, 0.36, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
  armL.position.set(-0.42, 1.08, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
  armR.position.set(0.42, 1.08, 0);
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

const playerMesh = createPlayerMesh();
scene.add(playerMesh);

const save = loadSave() || defaultSave();
const player = {
  pos: new THREE.Vector3(0, 0, 24),
  heading: 0,
  speed: 0,
  health: PLAYER.maxHealth,
  driving: null,
  carSpeed: 0,
  shake: 0,
  pressedE: false,
  holdingE: false,
  walkPhase: 0,
  mesh: playerMesh,
};
playerMesh.position.copy(player.pos);

// Objective beacon: a glowing pillar over the current target.
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xffd400, transparent: true, opacity: 0.28,
    side: THREE.DoubleSide, depthWrite: false,
  }),
);
beacon.position.set(0, 15, -1000);
scene.add(beacon);
const beaconRing = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
);
beaconRing.rotation.x = -Math.PI / 2;
beaconRing.position.set(0, 0.1, -1000);
scene.add(beaconRing);

// ---------- Game state ----------
let gameState = 'title'; // title | playing | paused | gameover
let isNight = false;
let elapsed = 0;
let clockMinutes = 10 * 60;
let cameraYaw = 0;
let cameraPitch = 0.32;
let cameraDistance = 9;
let cash = save.cash;
let respect = save.respect;
let shotStaged = false;
let courierVan = null;

const G = {
  scene, camera, renderer, player, playerCar, traffic, peds, police, missions,
  city, audio, hud, time: 0, isNight: false,
  setNight(flag) { setNightFlag(flag); },
  setCameraYaw(yaw) { cameraYaw = yaw; },
  shotAutopilot: null,
  shotTitle: null,
};

function setNightFlag(flag) {
  isNight = flag;
  G.isNight = flag;
  scene.background = new THREE.Color(flag ? COLOURS.skyNight : COLOURS.skyDay);
  scene.fog.color = new THREE.Color(flag ? 0x0b1026 : 0x9fc4e0);
  sun.intensity = flag ? 0.5 : 2.4;
  sun.color = new THREE.Color(flag ? COLOURS.sunNight : COLOURS.sunDay);
  hemi.intensity = flag ? 0.35 : 0.9;
  city.setNight(flag);
}

function applySaveToMissions() {
  missions.index = Math.min(save.missionIndex, 4);
  missions.done = save.storyDone;
}

function persistSave() {
  writeSave({
    cash, respect,
    missionIndex: missions.done ? 5 : missions.index,
    storyDone: missions.done,
  });
}

function startMission() {
  if (!missions.start()) return;
  const mission = missions.currentMission();
  hud.toast(`${mission.title}: ${mission.briefing}`);
  if (missions.index === 3) {
    // Heat Escape starts loud: three stars from the setup.
    addHeat(police.wanted, 65, elapsed);
  }
  if (missions.index === 2) {
    spawnCourierVan();
  }
  audio.pickup();
}

function spawnCourierVan() {
  if (courierVan) return;
  const mesh = createCarMesh(0xeeeeee, false);
  mesh.scale.set(1.15, 1.15, 1.25);
  mesh.position.set(180, 0, 120);
  mesh.rotation.y = -Math.PI / 2;
  scene.add(mesh);
  courierVan = { mesh, speed: 10, arrived: false, heading: -Math.PI / 2 };
  missionWorld.courierVan = courierVan;
}

function enterCar(car) {
  player.driving = car;
  player.carSpeed = car.speed;
  player.mesh.visible = false;
  cameraYaw = 0;
  if (car.kind === 'traffic') {
    // Stealing a stranger's car is a crime — and it stops being traffic.
    const index = traffic.indexOf(car);
    if (index !== -1) traffic.splice(index, 1);
    addHeat(police.wanted, WANTED.stealCar, elapsed);
    hud.toast('Car stolen! The Bay PD is watching.');
    scarePedestrians(peds, player.pos, 20);
  }
  if (car.isTarget) missions.inTargetCar = true;
  audio.unlock();
}

function exitCar() {
  const car = player.driving;
  if (!car || Math.abs(car.speed) > 3) return;
  player.driving = null;
  player.carSpeed = 0;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.pos.copy(car.mesh.position).addScaledVector(side, 3);
  player.heading = car.heading;
  player.mesh.position.copy(player.pos);
  player.mesh.visible = true;
  missions.inTargetCar = false;
  audio.setEngineOff();
}

function updatePlayerOnFoot(dt, move) {
  const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  let mx = forwardX * move.y + rightX * move.x;
  let mz = forwardZ * move.y + rightZ * move.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    const targetHeading = Math.atan2(mx, mz);
    let diff = targetHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += diff * Math.min(1, dt * 10);
    player.speed = speed;
    player.pos.x += mx * speed * dt;
    player.pos.z += mz * speed * dt;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.speed = 0;
  }
  collideWithBuildings(player.pos, PLAYER.radius, city.colliders);
  player.pos.x = Math.max(-245, Math.min(245, player.pos.x));
  player.pos.z = Math.max(-245, Math.min(300, player.pos.z));
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * (player.speed > 0 ? 0.5 : 0);
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing;
  player.mesh.userData.armR.rotation.x = swing;
}

function cameraForward() {
  // The view direction on the ground plane: the camera sits behind the
  // player at (target - forward * distance) and looks back at them.
  return new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
}

function updateCamera(dt) {
  const target = player.driving ? player.driving.mesh.position : player.pos;
  const dist = player.driving ? 13 : cameraDistance;
  const height = player.driving ? 6 : 3.6;
  // On foot the view yaw is cameraYaw; in a car it orbits the car heading.
  const yaw = player.driving ? player.driving.heading + cameraYaw : cameraYaw;
  const desired = new THREE.Vector3(
    target.x - Math.sin(yaw) * dist,
    target.y + height,
    target.z - Math.cos(yaw) * dist,
  );
  camera.position.lerp(desired, Math.min(1, dt * 5));
  const look = new THREE.Vector3(target.x, target.y + 1.6, target.z);
  camera.lookAt(look);
  if (player.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * player.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * player.shake * 0.4;
    player.shake = Math.max(0, player.shake - dt * 2);
  }
}

function gameOver(title, text) {
  gameState = 'gameover';
  audio.stopMusic();
  audio.busted();
  hud.showGameOver(title, text);
}

function respawnAfterGameOver() {
  player.health = PLAYER.maxHealth;
  clearWanted(police);
  player.pos.set(0, 0, 24);
  player.heading = 0;
  player.driving = null;
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  missions.active = false;
  missions.stepIndex = 0;
  hud.hideGameOver();
  gameState = 'playing';
  audio.startMusic();
}

// ---------- Buttons ----------
function bindButton(id, fn) {
  const button = document.getElementById(id);
  if (button) button.addEventListener('click', () => { audio.unlock(); fn(); });
}
bindButton('btn-new', () => {
  clearSave();
  cash = 150;
  respect = 0;
  missions.index = 0;
  missions.done = false;
  missions.active = false;
  hud.hideTitle();
  gameState = 'playing';
  audio.startMusic();
});
bindButton('btn-continue', () => {
  cash = save.cash;
  respect = save.respect;
  applySaveToMissions();
  hud.hideTitle();
  gameState = 'playing';
  audio.startMusic();
});
bindButton('btn-how', () => {
  const how = document.getElementById('howto');
  if (how) how.classList.toggle('hidden');
});
bindButton('btn-resume', () => {
  hud.hidePause();
  gameState = 'playing';
});
bindButton('btn-quit-title', () => {
  hud.hidePause();
  hud.showTitle(loadSave() !== null);
  gameState = 'title';
});
bindButton('btn-retry', () => {
  respawnAfterGameOver();
});

// ---------- Main loop ----------
const clock = new THREE.Clock();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  G.time = elapsed;
  clockMinutes += dt * (60 / 90);

  // Camera orbit from mouse drag, always live (also on the title screen).
  const mouse = input.consumeMouse();
  cameraYaw -= mouse.dx * 0.004;
  cameraPitch = Math.max(0.08, Math.min(0.9, cameraPitch + mouse.dy * 0.003));

  if (gameState === 'playing') {
    const move = shotMode && G.shotAutopilot && G.shotAutopilot.kind === 'drive'
      ? driveToward(G, G.shotAutopilot.target)
      : input.moveVector();
    player.pressedE = input.wasPressed('KeyE');
    player.holdingE = input.isDown('KeyE');

    if (input.wasPressed('Enter') && !missions.active && !missions.done) startMission();
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      hud.showPause();
      gameState = 'paused';
    }
    if (input.wasPressed('KeyM')) audio.setMuted(!audio.muted);
    if (input.wasPressed('Digit2')) {
      combat.hasPistol = !combat.hasPistol;
      hud.toast(combat.hasPistol ? 'Pistol out — click to shoot' : 'Fists out');
    }
    if (input.wasPressed('KeyR') && combat.hasPistol) {
      combat.reloadTimer = PLAYER.reloadSeconds;
      combat.ammo = PLAYER.pistolMagazine;
    }

    if (player.driving) {
      const car = player.driving;
      const driveMove = { x: move.x, y: move.y, handbrake: input.isDown('Space') };
      const events = updatePlayerCar(car, dt, driveMove, city.colliders, traffic, audio);
      player.carSpeed = car.speed;
      player.pos.copy(car.mesh.position);
      player.heading = car.heading;
      if (events.wallHit && Math.abs(car.speed) > 10) {
        player.health -= 4;
        player.shake = 0.7;
        hud.flashDamage();
      }
      if (events.trafficHit) {
        addHeat(police.wanted, 6, elapsed);
        player.shake = 0.6;
      }
      if (input.wasPressed('KeyE')) exitCar();
      // Hitting a pedestrian while driving is a crime.
      for (const ped of peds) {
        if (ped.down) continue;
        const d = Math.hypot(ped.mesh.position.x - player.pos.x, ped.mesh.position.z - player.pos.z);
        if (d < 2 && Math.abs(car.speed) > 5) {
          if (knockDownPedestrian(ped)) {
            addHeat(police.wanted, WANTED.hitPedestrian, elapsed);
            hud.toast('Hit and run! Witnesses called the cops.');
            scarePedestrians(peds, player.pos, 25);
          }
        }
      }
    } else {
      updatePlayerOnFoot(dt, move);
      audio.setEngineOff();
      if (input.wasPressed('KeyE')) {
        const car = findNearestCar(player.pos, enterableCars(), 4.5);
        if (car && Math.abs(car.speed) < 4) enterCar(car);
        else if (missions.active && missions.currentStep() && missions.currentStep().type === 'pickup') {
          // E on a pickup is consumed by the mission step itself.
        }
      }
      if (input.wasPressed('KeyF') || (input.mouseDown && !combat.hasPistol)) {
        const hit = tryPunch(combat, player, peds, police, audio);
        if (hit && hit.kind === 'ped') {
          knockDownPedestrian(hit.obj);
          addHeat(police.wanted, 8, elapsed);
          scarePedestrians(peds, player.pos, 18);
        }
      }
      if (input.mouseDown && combat.hasPistol) {
        const dir = cameraForward();
        const result = tryShoot(combat, player, { x: dir.x, z: dir.z }, peds, police, audio);
        if (result.fired) {
          hud.setMuzzleFlash();
          addHeat(police.wanted, WANTED.shoot, elapsed);
          scarePedestrians(peds, player.pos, 30);
          if (result.hit && result.hit.kind === 'ped') {
            knockDownPedestrian(result.hit.obj);
          }
        }
      }
    }

    updateTraffic(traffic, dt, elapsed, city);
    updatePedestrians(peds, dt, rng, player.pos, player.driving ? Math.abs(player.carSpeed) > 12 : false);
    const bust = updatePolice(police, dt, elapsed, player, city.colliders);
    if (bust === 'busted') {
      gameOver('BUSTED BY THE BAY PD', 'The cops caught Kai. The crew posts bail — but the job is blown.');
    }
    updateCombatTimers(combat, dt);
    if (player.health <= 0) {
      gameOver('KAI IS DOWN', 'Kai took too many hits. The Bay keeps moving without him — for now.');
    }
    const damage = policeReturnFire(police, player, dt, rng);
    if (damage > 0) {
      player.health -= damage;
      hud.flashDamage();
    }
    audio.updateSiren(dt, police.wanted.stars, nearestPoliceDistance(police, player.pos));

    // Courier van for mission 3.
    if (courierVan && !courierVan.arrived) {
      courierVan.mesh.position.x -= courierVan.speed * dt;
      courierVan.mesh.rotation.y = -Math.PI / 2;
      if (courierVan.mesh.position.x <= -120) courierVan.arrived = true;
    }

    // Missions.
    const result = missions.update(dt, player, missionWorld, elapsed);
    if (result === 'failed') {
      hud.toast('Spotted! The courier burned the deal. Job failed — press Enter to retry.');
      missions.fail();
      if (courierVan) {
        scene.remove(courierVan.mesh);
        courierVan = null;
        missionWorld.courierVan = null;
      }
    } else if (result && result.event === 'step') {
      hud.toast(missions.objectiveText());
      audio.pickup();
    } else if (result && result.event === 'complete') {
      cash += result.reward;
      respect += 100;
      persistSave();
      hud.showMissionBanner(result.title, result.reward);
      audio.missionComplete();
      if (missions.done) {
        hud.showStoryComplete();
        persistSave();
      } else {
        hud.toast(`Next job ready — press Enter. ($${result.reward} banked)`);
      }
    }

    // Objective beacon + HUD arrow.
    const target = missions.targetPos();
    if (target && missions.active) {
      beacon.position.set(target.x, 15, target.z);
      beaconRing.position.set(target.x, 0.1, target.z);
      beacon.visible = true;
      beaconRing.visible = true;
    } else {
      beacon.visible = false;
      beaconRing.visible = false;
    }
  } else if (gameState === 'title' || gameState === 'paused') {
    // The city stays alive behind the menus.
    updateTraffic(traffic, dt, elapsed, city);
    updatePedestrians(peds, dt, rng, null, false);
    audio.setEngineOff();
  }

  // HUD + arrow (also on title in shot mode, so the cover shows the HUD).
  const target = missions.targetPos();
  const hours = Math.floor(clockMinutes / 60) % 24;
  const minutes = Math.floor(clockMinutes % 60);
  hud.update({
    health: player.health,
    maxHealth: PLAYER.maxHealth,
    cash,
    stars: police.wanted.stars,
    speedKmh: Math.abs(player.carSpeed) * 3.2,
    clock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    missionTitle: missions.done ? 'NEON BAY LEGEND'
      : missions.currentMission() ? `Job ${missions.index + 1}: ${missions.currentMission().title}` : 'NEON BAY — free roam',
    objective: missions.active ? missions.objectiveText() : (missions.done ? 'Story complete — free roam the Bay.' : 'Press Enter to start the next job'),
    ammo: combat.ammo,
    reloading: combat.reloadTimer > 0,
    hasPistol: combat.hasPistol,
    driving: player.driving !== null,
    playerPos: player.pos,
    playerHeading: player.heading,
    policePositions: police.cars.map((c) => c.mesh.position),
    missionTarget: target,
    trafficPositions: traffic.map((c) => c.mesh.position),
    landmarks: city.landmarks,
  });

  // Objective arrow: show when the target is off-screen, pointing at it.
  if (target && missions.active && gameState === 'playing') {
    const toTarget = new THREE.Vector3(target.x - camera.position.x, 0, target.z - camera.position.z);
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();
    const x = toTarget.dot(right);
    const y = toTarget.dot(up);
    const depth = toTarget.dot(viewDir);
    const onScreen = depth > 0 && Math.abs(x) < depth * 0.9 && Math.abs(y) < depth * 0.55;
    if (!onScreen) {
      const angle = Math.atan2(-y, x);
      const fx = 0.5 + Math.cos(angle) * 0.36;
      const fy = 0.5 - Math.sin(angle) * 0.36;
      hud.setArrow(angle, true, fx, fy);
    } else {
      hud.setArrow(0, false);
    }
  } else {
    hud.setArrow(0, false);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  frames += 1;
  if (frames === 3) {
    window.__neonReady = true;
  }
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Read-only handle for automated playtests (and curious players): the live
// game state, never a cheat — it cannot change anything.
window.__neonDebug = { player, police, missions, traffic, peds };

// ---------- Start ----------
applySaveToMissions();
if (shotMode) {
  // Screenshot mode: stage the scene, play without menus (except 'start').
  const staged = stageShot(shotName, G);
  shotStaged = true;
  void shotStaged;
  if (staged.screen === 'title') {
    hud.showTitle(false);
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.classList.add('shot');
  } else {
    hud.hideTitle();
  }
  gameState = 'playing';
  window.__neonShot = shotName;
} else {
  hud.showTitle(loadSave() !== null);
  gameState = 'title';
}

animate();
